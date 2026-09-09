import { Innertube, UniversalCache } from 'youtubei.js';
import { cleanArtistAndTitle } from './trackParser.js';

function extractInnertubeArtist(item: any): string {
  if (Array.isArray(item.artists) && item.artists.length > 0) {
    const valid = item.artists
      .map((a: any) => (typeof a === 'string' ? a : a.name))
      .filter((n: string) => n && !['song', 'video', 'episode', 'unknown artist', 'unknown'].includes(n.toLowerCase()));
    if (valid.length > 0) {
      return valid.join(', ');
    }
  }

  if (item.author) {
    const aName = typeof item.author === 'string' ? item.author : item.author.name;
    if (aName && !['song', 'video', 'episode', 'unknown artist', 'unknown'].includes(aName.toLowerCase())) {
      return aName;
    }
  }

  if (Array.isArray(item.authors) && item.authors.length > 0) {
    const valid = item.authors
      .map((a: any) => (typeof a === 'string' ? a : a.name))
      .filter((n: string) => n && !['song', 'video', 'episode', 'unknown artist', 'unknown'].includes(n.toLowerCase()));
    if (valid.length > 0) {
      return valid.join(', ');
    }
  }

  if (Array.isArray(item.subtitle?.runs)) {
    const runs = item.subtitle.runs
      .map((r: any) => r.text)
      .filter(
        (t: string) =>
          t &&
          t !== ' • ' &&
          t !== '•' &&
          !/^\d+:\d+$/.test(t) &&
          !['song', 'video', 'episode', 'unknown artist', 'unknown'].includes(t.toLowerCase())
      );
    if (runs.length > 0) {
      return runs[0];
    }
  }

  // Fallback to channel or uploader if artist isn't directly tagged
  const ch = (typeof item.channel === 'string' ? item.channel : item.channel?.name) ||
             (typeof item.owner === 'string' ? item.owner : item.owner?.name) ||
             (typeof item.author === 'string' ? item.author : item.author?.name) ||
             item.short_byline?.text ||
             item.byline?.text;
  if (ch && typeof ch === 'string' && !['song', 'video', 'episode', 'unknown artist', 'unknown'].includes(ch.toLowerCase())) {
    return ch;
  }

  return '';
}

export interface InnertubeTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  durationSec: number;
  source: 'YT';
  sourceLabel: string;
  artworkUrl?: string;
  sourceId: string;
}

export interface InnertubeAlbum {
  title: string;
  year?: string;
  artworkUrl?: string;
  browseId?: string;
  type?: string;
}

export interface InnertubeArtistDetails {
  artist: string;
  avatarUrl?: string;
  bio?: string;
  browseId?: string;
  subscribers?: string;
  topTracks: InnertubeTrack[];
  albums: InnertubeAlbum[];
  singles: InnertubeAlbum[];
  relatedArtists?: Array<{
    name: string;
    channelId: string;
    avatarUrl?: string;
  }>;
}

export interface InnertubeAlbumDetails {
  title: string;
  artist: string;
  year?: string;
  artworkUrl?: string;
  browseId: string;
  tracks: InnertubeTrack[];
}

let innertubeInstance: Innertube | null = null;
let initPromise: Promise<Innertube> | null = null;

export function parseDurationToSec(durationStr: string): number {
  if (!durationStr) return 0;
  const parts = durationStr.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

export async function getInnertube(): Promise<Innertube> {
  if (innertubeInstance) return innertubeInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const yt = await Innertube.create({
        cache: new UniversalCache(false),
      });
      innertubeInstance = yt;
      return yt;
    } catch (err) {
      console.error('[InnertubeService] Failed to create Innertube instance:', err);
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

export async function search(query: string): Promise<{
  artistCard?: {
    name: string;
    avatarUrl?: string;
    subtitle?: string;
    browseId?: string;
  };
  songs: InnertubeTrack[];
}> {
  const yt = await getInnertube();
  const songs: InnertubeTrack[] = [];
  let artistCard: { name: string; avatarUrl?: string; subtitle?: string; browseId?: string } | undefined;

  // Run song search and artist check in parallel
  const [songRes, artistRes] = await Promise.allSettled([
    yt.music.search(query, { type: 'song' }),
    yt.music.search(query, { type: 'artist' }),
  ]);

  if (songRes.status === 'fulfilled' && songRes.value) {
    const shelf = songRes.value.contents?.[0];
    const items: any[] = shelf && 'contents' in shelf ? (shelf.contents as any[]) : [];

    for (const item of items) {
      const vId = item.id;
      if (!vId) continue;

      const rawTitle = typeof item.title === 'string' ? item.title : item.title?.text || 'Untitled';
      const rawArtist = extractInnertubeArtist(item) || query.trim();
      const { title, artist } = cleanArtistAndTitle(rawTitle, rawArtist);

      const album = item.album?.name || '';
      const durStr = item.duration?.text || '0:00';
      const durSec = parseDurationToSec(durStr);
      const thumbs = item.thumbnails || item.thumbnail || [];
      const artworkUrl =
        Array.isArray(thumbs) && thumbs.length > 0
          ? thumbs[0]?.url
          : undefined;

      songs.push({
        id: vId,
        title,
        artist,
        album,
        duration: durStr,
        durationSec: durSec,
        source: 'YT',
        sourceLabel: 'YouTube Music',
        artworkUrl: artworkUrl || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
        sourceId: vId,
      });
    }
  }

  if (artistRes.status === 'fulfilled' && artistRes.value) {
    const aShelf = artistRes.value.contents?.[0];
    const aItems: any[] = aShelf && 'contents' in aShelf ? (aShelf.contents as any[]) : [];
    if (aItems.length > 0) {
      const firstArtist = aItems[0];
      const thumbs = firstArtist.thumbnails || firstArtist.thumbnail || [];
      const avatarUrl =
        Array.isArray(thumbs) && thumbs.length > 0 ? thumbs[0]?.url : undefined;
      const cleanQ = query.trim().toLowerCase();
      const aName = firstArtist.name?.toLowerCase() || '';

      if (aName.includes(cleanQ) || cleanQ.includes(aName)) {
        artistCard = {
          name: firstArtist.name || query,
          avatarUrl,
          subtitle: firstArtist.subscribers || 'Official YouTube Music Artist',
          browseId: firstArtist.id,
        };
      }
    }
  }

  return { artistCard, songs };
}

/**
 * Universally extract the best thumbnail URL from any Innertube thumbnail structure:
 * - MusicThumbnail with .contents array
 * - Array of Thumbnail objects
 * - Object with .thumbnails or .thumbnail
 * - Direct .url string
 */
export function extractThumbnailUrl(thumbObj: any): string | undefined {
  if (!thumbObj) return undefined;
  if (typeof thumbObj === 'string') return thumbObj;

  // MusicThumbnail with .contents array: [Thumbnail, ...]
  if (thumbObj.contents && Array.isArray(thumbObj.contents) && thumbObj.contents.length > 0) {
    const list = thumbObj.contents;
    const sorted = [...list].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
    return sorted[0]?.url || list[0]?.url;
  }

  // Direct array of Thumbnail objects: [{ url, width, height }, ...]
  if (Array.isArray(thumbObj) && thumbObj.length > 0) {
    const sorted = [...thumbObj].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
    return sorted[0]?.url || thumbObj[0]?.url;
  }

  // Nested property .thumbnails or .thumbnail
  if (thumbObj.thumbnails) {
    const res = extractThumbnailUrl(thumbObj.thumbnails);
    if (res) return res;
  }
  if (thumbObj.thumbnail) {
    const res = extractThumbnailUrl(thumbObj.thumbnail);
    if (res) return res;
  }

  // Direct .url property
  if (typeof thumbObj.url === 'string') return thumbObj.url;

  return undefined;
}

export async function getArtist(artistNameOrId: string): Promise<InnertubeArtistDetails> {
  const yt = await getInnertube();
  let channelId = artistNameOrId.trim();
  let searchItemThumbnail: any = null;

  // 1. If not a UC channel ID, resolve the artist channel ID
  if (!channelId.startsWith('UC')) {
    try {
      // Step A: Search for artist type
      const aSearch = await yt.music.search(channelId, { type: 'artist' });
      const aShelf = aSearch.contents?.[0];
      const aItems: any[] = aShelf && 'contents' in aShelf ? (aShelf.contents as any[]) : [];
      if (aItems.length > 0) {
        searchItemThumbnail = aItems[0].thumbnail || aItems[0].thumbnails;
        if (aItems[0].id?.startsWith('UC')) {
          channelId = aItems[0].id;
        }
      }
    } catch (e) {
      console.warn('[InnertubeService] Artist type search error:', e);
    }

    // Step B: If still not a UC channel ID, try general search for MusicCardShelf (e.g. for Russian transliterations)
    if (!channelId.startsWith('UC')) {
      try {
        const genSearch = await yt.music.search(channelId);
        for (const c of genSearch.contents || []) {
          if (c.type === 'MusicCardShelf') {
            searchItemThumbnail = (c as any).thumbnail || (c as any).thumbnails;
            const bId =
              (c as any).title?.endpoint?.payload?.browseId ||
              (c as any).endpoint?.payload?.browseId ||
              (c as any).header?.endpoint?.payload?.browseId;
            if (bId && typeof bId === 'string' && bId.startsWith('UC')) {
              channelId = bId;
              break;
            }
          }
        }
      } catch (e) {
        console.warn('[InnertubeService] General card search error:', e);
      }
    }

    // Step C: If still not resolved, inspect top song artist
    if (!channelId.startsWith('UC')) {
      try {
        const songSearch = await yt.music.search(channelId, { type: 'song' });
        const sShelf = songSearch.contents?.[0];
        const sItems: any[] = sShelf && 'contents' in sShelf ? (sShelf.contents as any[]) : [];
        for (const s of sItems) {
          const aObj = s.artists?.[0];
          const aId = aObj?.id || aObj?.channel_id;
          if (aId && typeof aId === 'string' && aId.startsWith('UC')) {
            channelId = aId;
            break;
          }
        }
      } catch (e) {
        console.warn('[InnertubeService] Song artist lookup error:', e);
      }
    }
  }

  // 2. Fetch artist page if valid channel ID
  let artistPage: any = null;
  if (channelId.startsWith('UC')) {
    try {
      artistPage = await yt.music.getArtist(channelId);
    } catch (err) {
      console.warn('[InnertubeService] getArtist error for channel:', channelId, err);
    }
  }

  const artistName = artistPage?.header?.title?.text || artistNameOrId;
  const bio = (artistPage?.header as any)?.description?.text;
  const subscribers = (artistPage?.header as any)?.subscribers?.text;

  // Comprehensive extraction of avatar URL with multiple fallbacks
  let avatarUrl: string | undefined =
    extractThumbnailUrl(artistPage?.header?.thumbnail) ||
    extractThumbnailUrl(artistPage?.header?.thumbnails) ||
    extractThumbnailUrl((artistPage?.header as any)?.foregroundThumbnail) ||
    extractThumbnailUrl((artistPage?.header as any)?.straplineThumbnail) ||
    extractThumbnailUrl(searchItemThumbnail);

  // If still not found, try YouTube channel metadata
  if (!avatarUrl && channelId.startsWith('UC')) {
    try {
      const ch = await yt.getChannel(channelId);
      avatarUrl = ch?.metadata?.avatar?.[0]?.url || (ch?.header as any)?.author?.thumbnails?.[0]?.url;
    } catch {}
  }

  const topTracks: InnertubeTrack[] = [];
  const albums: InnertubeAlbum[] = [];
  const singles: InnertubeAlbum[] = [];
  const relatedArtists: Array<{ name: string; channelId: string; avatarUrl?: string }> = [];

  if (artistPage) {
  try {
    if (typeof artistPage.getAllSongs === 'function') {
      let allSongs = await artistPage.getAllSongs();
      const sItems: any[] = [...(allSongs?.contents || [])];
      try {
        let pages = 0;
        while (allSongs && (allSongs as any).has_continuation && pages < 5) {
          allSongs = await (allSongs as any).getContinuation();
          if (allSongs?.contents) {
            sItems.push(...allSongs.contents);
          }
          pages++;
        }
      } catch {}

      for (const item of sItems) {
        const vId = item.id;
        if (!vId) continue;
        const title = typeof item.title === 'string' ? item.title : item.title?.text || 'Untitled';
        const artist = item.artists?.map((a: any) => a.name).join(', ') || artistName;
        const album = item.album?.name || `${artistName} Top Tracks`;
        const durStr = item.duration?.text || '0:00';
        const artwork = extractThumbnailUrl(item.thumbnails) || extractThumbnailUrl(item.thumbnail);

        topTracks.push({
          id: vId,
          title,
          artist,
          album,
          duration: durStr,
          durationSec: parseDurationToSec(durStr),
          source: 'YT',
          sourceLabel: 'YouTube Music',
          artworkUrl: artwork || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
          sourceId: vId,
        });
      }
    }
  } catch (err) {
    console.warn('[InnertubeService] getAllSongs failed, falling back to top songs shelf:', err);
  }

  // 2. Parse sections
  for (const s of (artistPage.sections as any[]) || []) {
    const sTitle = (s.header?.title?.text || s.title?.text || s.type || '').toLowerCase();
    const contents: any[] = s.contents || [];

    // Top songs fallback if getAllSongs didn't populate
    if (topTracks.length === 0 && sTitle.includes('top song')) {
      for (const item of contents) {
        const vId = item.id;
        if (!vId) continue;
        const title = typeof item.title === 'string' ? item.title : item.title?.text || 'Untitled';
        const artist = item.artists?.map((a: any) => a.name).join(', ') || artistName;
        const album = item.album?.name || `${artistName} Top Tracks`;
        const durStr = item.duration?.text || '0:00';
        const artwork = extractThumbnailUrl(item.thumbnails) || extractThumbnailUrl(item.thumbnail);

        topTracks.push({
          id: vId,
          title,
          artist,
          album,
          duration: durStr,
          durationSec: parseDurationToSec(durStr),
          source: 'YT',
          sourceLabel: 'YouTube Music',
          artworkUrl: artwork || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
          sourceId: vId,
        });
      }
    }

    // Albums
    if (sTitle.includes('album') && !sTitle.includes('single')) {
      for (const it of contents) {
        const alTitle = typeof it.title === 'string' ? it.title : it.title?.text;
        if (!alTitle) continue;
        const year = it.year?.text || it.subtitle?.text || '';
        const artwork = extractThumbnailUrl(it.thumbnail) || extractThumbnailUrl(it.thumbnails) || avatarUrl;
        const browseId = it.id || it.endpoint?.payload?.browseId;

        if (!albums.some((a) => a.browseId === browseId)) {
          albums.push({
            title: alTitle,
            year: String(year),
            artworkUrl: artwork,
            browseId,
            type: 'Album',
          });
        }
      }
    }

    // Singles & EPs
    if (sTitle.includes('single')) {
      for (const it of contents) {
        const sglTitle = typeof it.title === 'string' ? it.title : it.title?.text;
        if (!sglTitle) continue;
        const year = it.year?.text || it.subtitle?.text || 'Single';
        const artwork = extractThumbnailUrl(it.thumbnail) || extractThumbnailUrl(it.thumbnails) || avatarUrl;
        const browseId = it.id || it.endpoint?.payload?.browseId;

        if (!singles.some((a) => a.browseId === browseId)) {
          singles.push({
            title: sglTitle,
            year: String(year),
            artworkUrl: artwork,
            browseId,
            type: 'Single',
          });
        }
      }
    }

    // Related artists (Fans might also like)
    if (sTitle.includes('fans') || sTitle.includes('like') || sTitle.includes('similar')) {
      for (const it of contents) {
        const relName = typeof it.title === 'string' ? it.title : it.title?.text || it.name;
        if (!relName) continue;
        const avatar = extractThumbnailUrl(it.thumbnail) || extractThumbnailUrl(it.thumbnails);
        const relId = it.id || it.endpoint?.payload?.browseId;

        if (relId && !relatedArtists.some((r) => r.channelId === relId)) {
          relatedArtists.push({
            name: relName,
            channelId: relId,
            avatarUrl: avatar,
          });
        }
      }
    }
  }
  }

  // 3. Fallback: if topTracks is still empty, search songs directly
  if (topTracks.length === 0) {
    try {
      const sSearch = await yt.music.search(`${artistName} songs`, { type: 'song' });
      const shelf = sSearch.contents?.[0];
      const items: any[] = shelf && 'contents' in shelf ? (shelf.contents as any[]) : [];
      for (const item of items) {
        const vId = item.id;
        if (!vId) continue;
        const title = typeof item.title === 'string' ? item.title : item.title?.text || 'Untitled';
        const artist = item.artists?.map((a: any) => a.name).join(', ') || artistName;
        const album = item.album?.name || `${artistName} Top Tracks`;
        const durStr = item.duration?.text || '0:00';
        const artwork = extractThumbnailUrl(item.thumbnails) || extractThumbnailUrl(item.thumbnail);

        topTracks.push({
          id: vId,
          title,
          artist,
          album,
          duration: durStr,
          durationSec: parseDurationToSec(durStr),
          source: 'YT',
          sourceLabel: 'YouTube Music',
          artworkUrl: artwork || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
          sourceId: vId,
        });
      }
    } catch (e) {
      console.warn('[InnertubeService] Fallback song search error:', e);
    }
  }

  // If avatarUrl still not found, fallback to the first track's artwork
  if (!avatarUrl && topTracks.length > 0 && topTracks[0].artworkUrl) {
    avatarUrl = topTracks[0].artworkUrl;
  }

  return {
    artist: artistName,
    avatarUrl,
    bio,
    browseId: channelId,
    subscribers,
    topTracks,
    albums,
    singles,
    relatedArtists,
  };
}

export async function getAlbum(browseId: string): Promise<InnertubeAlbumDetails> {
  const yt = await getInnertube();
  let albumBrowseId = browseId.trim();

  // If not a standard album browse ID, search for the album first
  if (!albumBrowseId.startsWith('MPREb_') && !albumBrowseId.startsWith('FEmusic_')) {
    try {
      const aSearch = await yt.music.search(albumBrowseId, { type: 'album' });
      const aShelf = aSearch.contents?.[0];
      const aItems: any[] = aShelf && 'contents' in aShelf ? (aShelf.contents as any[]) : [];
      if (aItems.length > 0 && aItems[0].id) {
        albumBrowseId = aItems[0].id;
      }
    } catch (err) {
      console.warn('[InnertubeService] Album search fallback error:', err);
    }
  }

  const albumData = await yt.music.getAlbum(albumBrowseId);

  const title = albumData.header?.title?.text || 'Album';
  const artist = (albumData.header as any)?.artists?.[0]?.name || (albumData.header as any)?.author?.name || 'Unknown Artist';
  const year = (albumData.header as any)?.year?.text;
  const thumbs = (albumData.header as any)?.thumbnails || (albumData.header as any)?.thumbnail;
  let artworkUrl = extractThumbnailUrl(thumbs);

  const tracks: InnertubeTrack[] = [];
  const contents: any[] = (albumData.contents as any[]) || [];

  for (const item of contents) {
    const vId = item.id;
    if (!vId) continue;
    const rawTrackTitle = typeof item.title === 'string' ? item.title : item.title?.text || 'Untitled';
    const rawTrackArtist = extractInnertubeArtist(item) || artist;
    const { title: trackTitle, artist: trackArtist } = cleanArtistAndTitle(rawTrackTitle, rawTrackArtist);
    const durStr = item.duration?.text || '0:00';

    tracks.push({
      id: vId,
      title: trackTitle,
      artist: trackArtist,
      album: title,
      duration: durStr,
      durationSec: parseDurationToSec(durStr),
      source: 'YT',
      sourceLabel: 'YouTube Music',
      artworkUrl: artworkUrl || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
      sourceId: vId,
    });
  }

  if (!artworkUrl && tracks.length > 0 && tracks[0].artworkUrl) {
    artworkUrl = tracks[0].artworkUrl;
  }

  return {
    title,
    artist,
    year,
    artworkUrl,
    browseId,
    tracks,
  };
}

export async function getGenreTracks(query: string): Promise<InnertubeTrack[]> {
  const yt = await getInnertube();
  const tracks: InnertubeTrack[] = [];

  try {
    // Search for a curated playlist matching the genre
    const isChart = query.toLowerCase() === 'chart' || query.toLowerCase() === 'discover';
    const searchQuery = isChart ? 'Top 100 music chart' : `${query} playlist`;
    const plSearch = await yt.music.search(searchQuery, { type: 'playlist' });

    let playlistId: string | undefined;
    const pShelf = plSearch.contents?.[0];
    const pItems: any[] = pShelf && 'contents' in pShelf ? (pShelf.contents as any[]) : [];

    for (const item of pItems) {
      if (item.id) {
        playlistId = item.id;
        break;
      }
    }

    if (playlistId) {
      const cleanPlId = playlistId.startsWith('VL') ? playlistId.substring(2) : playlistId;
      const fullPl = await yt.music.getPlaylist(cleanPlId);
      const items: any[] = (fullPl.items as any[]) || [];

      for (const item of items) {
        const vId = item.id;
        if (!vId) continue;
        const rawTitle = typeof item.title === 'string' ? item.title : item.title?.text || 'Untitled';
        const rawArtist = extractInnertubeArtist(item);
        const { title, artist } = cleanArtistAndTitle(rawTitle, rawArtist || query);
        const album = item.album?.name || query;
        const durStr = item.duration?.text || '0:00';
        const thumbs = item.thumbnails || item.thumbnail || [];
        const artwork = Array.isArray(thumbs) && thumbs.length > 0 ? thumbs[0]?.url : undefined;

        if (!tracks.some((t) => t.id === vId)) {
          tracks.push({
            id: vId,
            title,
            artist,
            album,
            duration: durStr,
            durationSec: parseDurationToSec(durStr),
            source: 'YT',
            sourceLabel: 'YouTube Music',
            artworkUrl: artwork || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
            sourceId: vId,
          });
        }
      }
    }
  } catch (err) {
    console.warn(`[InnertubeService] Failed to load genre playlist for ${query}:`, err);
  }

  // If fewer than 40 tracks, supplement by searching songs directly
  if (tracks.length < 40) {
    try {
      const sSearch = await yt.music.search(`${query} hits`, { type: 'song' });
      const shelf = sSearch.contents?.[0];
      const items: any[] = shelf && 'contents' in shelf ? (shelf.contents as any[]) : [];

      for (const item of items) {
        const vId = item.id;
        if (!vId || tracks.some((t) => t.id === vId)) continue;
        const rawTitle = typeof item.title === 'string' ? item.title : item.title?.text || 'Untitled';
        const rawArtist = extractInnertubeArtist(item);
        const { title, artist } = cleanArtistAndTitle(rawTitle, rawArtist || query);
        const album = item.album?.name || query;
        const durStr = item.duration?.text || '0:00';
        const thumbs = item.thumbnails || item.thumbnail || [];
        const artwork = Array.isArray(thumbs) && thumbs.length > 0 ? thumbs[0]?.url : undefined;

        tracks.push({
          id: vId,
          title,
          artist,
          album,
          duration: durStr,
          durationSec: parseDurationToSec(durStr),
          source: 'YT',
          sourceLabel: 'YouTube Music',
          artworkUrl: artwork || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
          sourceId: vId,
        });
      }
    } catch {}
  }

  return tracks;
}

export async function getLyrics(videoId: string): Promise<string | undefined> {
  try {
    const yt = await getInnertube();
    const lyrics = await yt.music.getLyrics(videoId);
    return lyrics?.description?.text;
  } catch (err) {
    console.warn('[InnertubeService] Lyrics fetch error:', err);
    return undefined;
  }
}

export default {
  getInnertube,
  search,
  getArtist,
  getAlbum,
  getGenreTracks,
  getLyrics,
  parseDurationToSec,
};
