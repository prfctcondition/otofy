import { Innertube, ClientType, UniversalCache } from 'youtubei.js';
import scResolver from './scResolver.js';
import { cleanArtistAndTitle } from './trackParser.js';

export interface ResolveResult {
  url: string;
  format: string;
  duration: number;
}

export interface YTSearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  durationSec: number;
  source: 'YT';
  artworkUrl?: string;
  sourceId: string;
}

interface StreamCacheEntry {
  url: string;
  format: string;
  duration: number;
  expiresAt: number;
}

const streamCache = new Map<string, StreamCacheEntry>();

let visionClientPromise: Promise<Innertube> | null = null;
let vrClientPromise: Promise<Innertube> | null = null;
let iosClientPromise: Promise<Innertube> | null = null;
let tvClientPromise: Promise<Innertube> | null = null;

export async function getVisionClient(): Promise<Innertube> {
  if (!visionClientPromise) {
    visionClientPromise = Innertube.create({
      client_type: ClientType.VISIONOS,
      cache: new UniversalCache(false),
      generate_session_locally: true,
    }).catch((err) => {
      visionClientPromise = null;
      throw err;
    });
  }
  return visionClientPromise;
}

export async function getVrClient(): Promise<Innertube> {
  if (!vrClientPromise) {
    vrClientPromise = Innertube.create({
      client_type: ClientType.ANDROID_VR,
      cache: new UniversalCache(false),
      generate_session_locally: true,
    }).catch((err) => {
      vrClientPromise = null;
      throw err;
    });
  }
  return vrClientPromise;
}

export async function getIosClient(): Promise<Innertube> {
  if (!iosClientPromise) {
    iosClientPromise = Innertube.create({
      client_type: ClientType.IOS,
      cache: new UniversalCache(false),
      generate_session_locally: true,
    }).catch((err) => {
      iosClientPromise = null;
      throw err;
    });
  }
  return iosClientPromise;
}

export async function getTvClient(): Promise<Innertube> {
  if (!tvClientPromise) {
    tvClientPromise = Innertube.create({
      client_type: ClientType.TV,
      cache: new UniversalCache(false),
      generate_session_locally: true,
    }).catch((err) => {
      tvClientPromise = null;
      throw err;
    });
  }
  return tvClientPromise;
}

// Background pre-warm of VisionOS and iOS client sessions
getVisionClient().catch((e) => {
  console.warn('[YTResolver] Initial VisionOS client pre-warm:', e?.message || e);
});
getIosClient().catch((e) => {
  console.warn('[YTResolver] Initial iOS client pre-warm:', e?.message || e);
});

export function parseDurationToSec(durationStr: string): number {
  if (!durationStr) return 0;
  const parts = durationStr.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function verifyStreamUrl(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Referer: 'https://www.youtube.com/',
      },
    });
    clearTimeout(timeout);
    return res.ok || res.status === 206;
  } catch {
    return false;
  }
}

export async function extractFromVideoId(
  vId: string,
  userCookie?: string
): Promise<ResolveResult | null> {
  // 1. VisionOS
  try {
    const yt = await getVisionClient();
    const info = await yt.getBasicInfo(vId);
    if (!info.playability_status || info.playability_status.status === 'OK') {
      const audioFormat = info.chooseFormat({ type: 'audio', quality: 'best' });
      if (audioFormat && audioFormat.url) {
        const isReachable = await verifyStreamUrl(audioFormat.url);
        if (isReachable) {
          const durSec =
            Math.round(Number(audioFormat.approx_duration_ms || 0) / 1000) ||
            Math.round(info.basic_info?.duration || 0);
          return {
            url: audioFormat.url,
            format: audioFormat.mime_type?.includes('opus') ? 'opus' : 'm4a',
            duration: durSec,
          };
        }
      }
    } else {
      console.warn(`[YTResolver] Video ${vId} playability status: ${info.playability_status.status} (${info.playability_status.reason || ''})`);
    }
  } catch (err: any) {
    console.warn(`[YTResolver] VisionOS failed for ${vId}:`, err?.message || err);
  }

  // 2. Android VR
  try {
    const ytVr = await getVrClient();
    const info = await ytVr.getBasicInfo(vId);
    if (!info.playability_status || info.playability_status.status === 'OK') {
      const audioFormat = info.chooseFormat({ type: 'audio', quality: 'best' });
      if (audioFormat && audioFormat.url) {
        const isReachable = await verifyStreamUrl(audioFormat.url);
        if (isReachable) {
          const durSec =
            Math.round(Number(audioFormat.approx_duration_ms || 0) / 1000) ||
            Math.round(info.basic_info?.duration || 0);
          return {
            url: audioFormat.url,
            format: audioFormat.mime_type?.includes('opus') ? 'opus' : 'm4a',
            duration: durSec,
          };
        }
      }
    }
  } catch (err: any) {
    console.warn(`[YTResolver] Android VR failed for ${vId}:`, err?.message || err);
  }

  // 3. iOS
  try {
    const ytIos = await getIosClient();
    const info = await ytIos.getBasicInfo(vId);
    if (!info.playability_status || info.playability_status.status === 'OK') {
      const audioFormat = info.chooseFormat({ type: 'audio', quality: 'best' });
      if (audioFormat && audioFormat.url) {
        const isReachable = await verifyStreamUrl(audioFormat.url);
        if (isReachable) {
          const durSec =
            Math.round(Number(audioFormat.approx_duration_ms || 0) / 1000) ||
            Math.round(info.basic_info?.duration || 0);
          return {
            url: audioFormat.url,
            format: audioFormat.mime_type?.includes('opus') ? 'opus' : 'm4a',
            duration: durSec,
          };
        }
      }
    }
  } catch (err: any) {
    console.warn(`[YTResolver] iOS failed for ${vId}:`, err?.message || err);
  }

  // 4. TV
  try {
    const ytTv = await getTvClient();
    const info = await ytTv.getBasicInfo(vId);
    if (!info.playability_status || info.playability_status.status === 'OK') {
      const audioFormat = info.chooseFormat({ type: 'audio', quality: 'best' });
      if (audioFormat && audioFormat.url) {
        const isReachable = await verifyStreamUrl(audioFormat.url);
        if (isReachable) {
          const durSec =
            Math.round(Number(audioFormat.approx_duration_ms || 0) / 1000) ||
            Math.round(info.basic_info?.duration || 0);
          return {
            url: audioFormat.url,
            format: audioFormat.mime_type?.includes('opus') ? 'opus' : 'm4a',
            duration: durSec,
          };
        }
      }
    }
  } catch (err: any) {
    console.warn(`[YTResolver] TV failed for ${vId}:`, err?.message || err);
  }

  // 5. ANDROID_MUSIC endpoint
  try {
    const endpoint = 'https://music.youtube.com/youtubei/v1/player';
    const body = {
      context: {
        client: {
          clientName: 'ANDROID_MUSIC',
          clientVersion: '7.27.52',
          androidSdkVersion: 30,
          hl: 'en',
          gl: 'US',
        },
      },
      videoId: vId,
    };
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.android.apps.youtube.music/7.27.52 (Linux; U; Android 11; en_US) gzip',
    };
    if (userCookie) headers['Cookie'] = userCookie;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data: any = await response.json();
      if (!data?.playabilityStatus || data.playabilityStatus.status === 'OK') {
        const adaptiveFormats: any[] = data?.streamingData?.adaptiveFormats || [];
        const audioFormats = adaptiveFormats.filter(
          (f) => f.mimeType && f.mimeType.startsWith('audio/') && f.url
        );
        if (audioFormats.length > 0) {
          const chosen =
            audioFormats.find((f) => f.itag === 251) ||
            audioFormats.find((f) => f.itag === 140) ||
            audioFormats[0];
          if (chosen?.url) {
            const isReachable = await verifyStreamUrl(chosen.url);
            if (isReachable) {
              const durSec = Math.round(Number(chosen.approxDurationMs) / 1000) || 0;
              return {
                url: chosen.url,
                format: chosen.mimeType?.includes('opus') ? 'opus' : 'm4a',
                duration: durSec,
              };
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.warn(`[YTResolver] ANDROID_MUSIC failed for ${vId}:`, err?.message || err);
  }

  return null;
}

export async function resolve(
  videoId: string,
  title?: string,
  artist?: string,
  userCookie?: string,
  excludeIds: string[] = []
): Promise<ResolveResult> {
  let actualVideoId = videoId;
  const isDirectYtId = Boolean(
    videoId && videoId.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(videoId)
  );

  if (!isDirectYtId) {
    try {
      const q = `${title || ''} ${artist || ''}`.trim() || videoId;
      const hits = await search(q);
      if (hits.length > 0 && hits[0].sourceId) {
        actualVideoId = hits[0].sourceId;
      }
    } catch (err) {
      console.warn('[YTResolver] VideoId lookup failed:', err);
    }
  }

  const now = Date.now();
  const excludedSet = new Set<string>(excludeIds || []);

  // 0. Check in-memory stream cache
  if (actualVideoId && !excludedSet.has(actualVideoId)) {
    const cached = streamCache.get(actualVideoId);
    if (cached && cached.expiresAt > now) {
      return {
        url: cached.url,
        format: cached.format,
        duration: cached.duration,
      };
    }
  }

  // 1. Try primary video ID
  if (actualVideoId && !excludedSet.has(actualVideoId)) {
    const primaryRes = await extractFromVideoId(actualVideoId, userCookie);
    if (primaryRes) {
      streamCache.set(actualVideoId, {
        ...primaryRes,
        expiresAt: now + 5 * 60 * 60 * 1000,
      });
      return primaryRes;
    }
    excludedSet.add(actualVideoId);
  }

  // 2. If primary video is unavailable/geo-blocked, search YouTube for alternative uploads of this song
  const query = `${title || ''} ${artist || ''}`.trim() || videoId;
  console.warn(
    `[YTResolver] Primary video "${actualVideoId}" is unavailable or restricted in this region. Searching YouTube for alternative uploads of "${query}"...`
  );

  try {
    const hits = await search(query);
    for (const cand of hits) {
      if (!cand.sourceId || excludedSet.has(cand.sourceId)) continue;
      excludedSet.add(cand.sourceId);

      const altRes = await extractFromVideoId(cand.sourceId, userCookie);
      if (altRes) {
        console.log(
          `[YTResolver] Found working alternative YouTube stream: ${cand.sourceId} ("${cand.title}" by ${cand.artist})`
        );
        if (actualVideoId) {
          streamCache.set(actualVideoId, {
            ...altRes,
            expiresAt: now + 5 * 60 * 60 * 1000,
          });
        }
        return altRes;
      }
    }
  } catch (searchErr) {
    console.warn('[YTResolver] YouTube alternative search failed:', searchErr);
  }

  // 3. Fallback: SoundCloud search
  console.warn(`[YTResolver] No working YouTube alternatives found for "${query}". Trying SoundCloud fallback...`);
  try {
    const scStream = await scResolver.resolveBySearch(title || query, artist);
    if (scStream) {
      return {
        url: scStream.url,
        format: scStream.format || 'mp3',
        duration: scStream.duration,
      };
    }
  } catch (scErr) {
    console.warn('[YTResolver] SoundCloud fallback failed:', scErr);
  }

  throw new Error(`Could not resolve playable audio stream for video: ${videoId}`);
}

export async function search(query: string): Promise<YTSearchResult[]> {
  const endpoint = 'https://music.youtube.com/youtubei/v1/search';
  const body = {
    context: {
      client: {
        clientName: 'WEB_REMIX',
        clientVersion: '1.20240101.01.00',
        hl: 'en',
        gl: 'US',
      },
    },
    query,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: 'https://music.youtube.com/',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`YouTube search API failed with status: ${response.status}`);
  }

  const data: any = await response.json();
  const results: YTSearchResult[] = [];

  const sectionContents: any[] =
    data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents ||
    [];

  for (const section of sectionContents) {
    const cardTitle = section?.musicCardShelfRenderer?.title?.runs?.[0]?.text;
    const items =
      section?.musicShelfRenderer?.contents ||
      section?.musicCardShelfRenderer?.contents ||
      section?.itemSectionRenderer?.contents ||
      [];

    for (const item of items) {
      const listItem = item?.musicResponsiveListItemRenderer;
      if (!listItem) continue;

      let videoId =
        listItem.playlistItemData?.videoId ||
        listItem.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;

      const flexCols = listItem.flexColumns || [];
      const col0Runs = flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
      if (!videoId && col0Runs[0]?.navigationEndpoint?.watchEndpoint?.videoId) {
        videoId = col0Runs[0].navigationEndpoint.watchEndpoint.videoId;
      }

      if (!videoId) continue;

      const title = col0Runs[0]?.text || 'Unknown Title';
      const col1Runs: any[] = flexCols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
      const meaningfulRuns = col1Runs.filter((r: any) => r?.text && r.text !== ' • ' && r.text !== '•');

      let artist = 'Unknown Artist';
      let album = '';
      let durationStr = '0:00';

      if (meaningfulRuns.length > 0) {
        const lastRun = meaningfulRuns[meaningfulRuns.length - 1]?.text;
        if (/^\d+:\d+(:\d+)?$/.test(lastRun)) {
          durationStr = lastRun;
          meaningfulRuns.pop();
        }

        // Filter out types like Song, Video, Single, EP
        const authorRuns = meaningfulRuns.filter(
          (r: any) => !['Song', 'Video', 'Single', 'Album', 'EP'].includes(r.text)
        );

        if (authorRuns.length > 0) {
          artist = authorRuns[0].text;
          if (authorRuns[1]) album = authorRuns[1].text;
        }
      }

      // If artist was not found or was assigned 'Song' / 'Video' / 'Unknown Artist'
      if (!artist || ['Song', 'Video', 'Unknown Artist'].includes(artist)) {
        if (cardTitle) {
          artist = cardTitle;
        } else {
          // Check play button accessibility label: "Play Save That Shit - Lil Peep"
          const playLabel =
            listItem.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.accessibilityPlayData?.accessibilityData?.label;
          if (playLabel && playLabel.includes(' - ')) {
            const parts = playLabel.replace(/^Play\s+/i, '').split(' - ');
            if (parts[1]) artist = parts[1].trim();
          } else {
            artist = query.trim();
          }
        }
      }

      const thumbs = listItem.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
      const artworkUrl = thumbs.length > 0 ? thumbs[thumbs.length - 1].url : undefined;
      const durationSec = parseDurationToSec(durationStr);

      const { title: finalTitle, artist: finalArtist } = cleanArtistAndTitle(
        title,
        artist || cardTitle || query
      );

      results.push({
        id: videoId,
        title: finalTitle,
        artist: finalArtist,
        album,
        duration: durationStr,
        durationSec,
        source: 'YT',
        artworkUrl,
        sourceId: videoId,
      });
    }
  }

  return results;
}

export interface ArtistAlbum {
  title: string;
  year?: string;
  artworkUrl?: string;
  browseId?: string;
  type?: string;
}

export interface ArtistDetailsResult {
  artist: string;
  avatarUrl?: string;
  bio?: string;
  browseId?: string;
  topTracks: YTSearchResult[];
  albums: ArtistAlbum[];
}

export async function getArtistDetails(artistName: string): Promise<ArtistDetailsResult> {
  const cleanName = artistName.trim();
  let artist = cleanName;
  let avatarUrl: string | undefined;
  let bio: string | undefined;
  let browseId: string | undefined;
  const topTracks: YTSearchResult[] = [];
  const albums: ArtistAlbum[] = [];

  try {
    // 1. Search YouTube Music for artist card and channel browseId
    const endpoint = 'https://music.youtube.com/youtubei/v1/search';
    const body = {
      context: {
        client: {
          clientName: 'WEB_REMIX',
          clientVersion: '1.20240101.01.00',
          hl: 'en',
          gl: 'US',
        },
      },
      query: cleanName,
    };

    const sRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://music.youtube.com/',
      },
      body: JSON.stringify(body),
    });

    if (sRes.ok) {
      const sData: any = await sRes.json();
      const sections =
        sData?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents ||
        [];
      const card = sections.find((s: any) => s.musicCardShelfRenderer)?.musicCardShelfRenderer;
      if (card) {
        artist = card.title?.runs?.[0]?.text || artist;
        browseId =
          card.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
          card.onTap?.navigationEndpoint?.browseEndpoint?.browseId;
        const thumbs = card.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
        if (thumbs.length > 0) {
          avatarUrl = thumbs[thumbs.length - 1].url;
        }

        const cardItems = card.contents || [];
        for (const item of cardItems) {
          const r = item.musicResponsiveListItemRenderer;
          if (!r) continue;
          const vId =
            r.playlistItemData?.videoId ||
            r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;
          if (!vId) continue;
          const title =
            r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text ||
            'Untitled';
          const col1Runs =
            r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
          const durStr = col1Runs[col1Runs.length - 1]?.text || '0:00';
          const artwork =
            r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url;

          topTracks.push({
            id: vId,
            title,
            artist,
            album: `${artist} Essentials`,
            duration: durStr,
            durationSec: parseDurationToSec(durStr),
            source: 'YT',
            artworkUrl: artwork || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
            sourceId: vId,
          });
        }
      }
    }

    // 2. Browse official channel if browseId found
    if (browseId) {
      const bRes = await fetch('https://music.youtube.com/youtubei/v1/browse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://music.youtube.com/',
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB_REMIX',
              clientVersion: '1.20240101.01.00',
              hl: 'en',
              gl: 'US',
            },
          },
          browseId,
        }),
      });

      if (bRes.ok) {
        const bData: any = await bRes.json();
        const header =
          bData.header?.musicImmersiveHeaderRenderer || bData.header?.musicVisualHeaderRenderer;
        if (header?.description?.runs?.[0]?.text) {
          bio = header.description.runs[0].text;
        }
        if (
          !avatarUrl &&
          header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.length > 0
        ) {
          const tbs = header.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails;
          avatarUrl = tbs[tbs.length - 1].url;
        }

        const bSections =
          bData.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents ||
          [];
        for (const s of bSections) {
          // Top songs shelf
          const shelf = s.musicShelfRenderer;
          if (shelf && shelf.contents) {
            for (const item of shelf.contents) {
              const r = item.musicResponsiveListItemRenderer;
              if (!r) continue;
              const vId =
                r.playlistItemData?.videoId ||
                r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;
              if (!vId) continue;
              const title =
                r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text ||
                'Untitled';
              const col1Runs =
                r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
              const durStr = col1Runs[col1Runs.length - 1]?.text || '0:00';
              const albumName = col1Runs.length > 2 ? col1Runs[1]?.text : `${artist} Top Tracks`;
              const artwork =
                r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url;

              if (!topTracks.some((t) => t.id === vId)) {
                topTracks.push({
                  id: vId,
                  title,
                  artist,
                  album: albumName,
                  duration: durStr,
                  durationSec: parseDurationToSec(durStr),
                  source: 'YT',
                  artworkUrl: artwork || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
                  sourceId: vId,
                });
              }
            }
          }

          // Albums carousel
          const carousel = s.musicCarouselShelfRenderer;
          if (carousel && carousel.contents) {
            for (const item of carousel.contents) {
              const r = item.musicTwoRowItemRenderer;
              if (!r) continue;
              const alTitle = r.title?.runs?.[0]?.text;
              if (!alTitle) continue;
              const subtitleRuns =
                r.subtitle?.runs?.map((x: any) => x.text).join('') || '';
              const alBrowseId = r.navigationEndpoint?.browseEndpoint?.browseId;
              const alArtwork =
                r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]
                  ?.url;

              if (!albums.some((a) => a.title.toLowerCase() === alTitle.toLowerCase())) {
                albums.push({
                  title: alTitle,
                  year: subtitleRuns,
                  artworkUrl: alArtwork,
                  browseId: alBrowseId,
                  type: subtitleRuns.toLowerCase().includes('single') ? 'Single' : 'Album',
                });
              }
            }
          }
        }
      }
    }

    // 3. Supplement top tracks if fewer than 20
    if (topTracks.length < 20) {
      const moreTracks = await search(`${cleanName} official audio`);
      for (const mt of moreTracks) {
        if (
          !topTracks.some(
            (t) => t.id === mt.id || t.title.toLowerCase() === mt.title.toLowerCase()
          )
        ) {
          topTracks.push({
            ...mt,
            artist: mt.artist || artist,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[YTResolver] getArtistDetails failed:', err);
  }

  return {
    artist,
    avatarUrl,
    bio,
    browseId,
    topTracks,
    albums,
  };
}

export default { resolve, search, getArtistDetails, parseDurationToSec, formatDuration };
