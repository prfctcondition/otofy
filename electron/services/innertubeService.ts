import { Innertube } from 'youtubei.js';
import { cleanArtistAndTitle } from './trackParser.js';
import authService from './authService.js';

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
  releaseDate?: string;
  releaseYear?: string;
  artistBrowseId?: string;
  artistUrl?: string;
  albumBrowseId?: string;
  externalUrl?: string;
  views?: number;
}

export interface InnertubeAlbum {
  title: string;
  year?: string;
  releaseDate?: string;
  artworkUrl?: string;
  browseId?: string;
  type?: string;
  externalUrl?: string;
}

export interface InnertubeArtistDetails {
  artist: string;
  avatarUrl?: string;
  bio?: string;
  browseId?: string;
  channelId?: string;
  userId?: string;
  externalUrl?: string;
  subscribers?: string;
  hasMore?: boolean;
  totalTracksCount?: number;
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
  releaseDate?: string;
  artworkUrl?: string;
  browseId: string;
  playlistId?: string;
  externalUrl?: string;
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

export function resetInnertubeInstance(): void {
  innertubeInstance = null;
  initPromise = null;
}

export async function getInnertube(): Promise<Innertube> {
  if (innertubeInstance) return innertubeInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const cookie = authService.getYoutubeCookie();
      const yt = await Innertube.create({
        ...(cookie ? { cookie } : {}),
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

export function parseSubscriberCount(str?: string): number {
  if (!str) return 0;
  const s = str.trim().toLowerCase();
  const m = s.match(/([\d.,]+)\s*([kmb])?/i);
  if (!m) return 0;
  let num = parseFloat(m[1].replace(/,/g, ''));
  if (isNaN(num)) return 0;
  const unit = m[2]?.toLowerCase();
  if (unit === 'k') num *= 1_000;
  else if (unit === 'm') num *= 1_000_000;
  else if (unit === 'b') num *= 1_000_000_000;
  return Math.round(num);
}

export function parseViewsToNumber(viewsStr?: string | number): number {
  if (typeof viewsStr === 'number') return viewsStr;
  if (!viewsStr || typeof viewsStr !== 'string') return 0;
  let clean = viewsStr.toLowerCase();
  clean = clean
    .replace(/\b(million|млн)\b/gi, 'm')
    .replace(/\b(billion|млрд)\b/gi, 'b')
    .replace(/\b(thousand|тыс)\b/gi, 'k')
    .replace(/(views?|plays?|streams?|прослушиван\w*|просмотр\w*)/gi, '')
    .replace(/,/g, '')
    .trim();
  const m = clean.match(/^([\d.]+)\s*([kmb])?/i);
  if (!m) {
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : Math.round(num);
  }
  let val = parseFloat(m[1]);
  if (isNaN(val)) return 0;
  const mult = m[2]?.toLowerCase();
  if (mult === 'k') val *= 1_000;
  else if (mult === 'm') val *= 1_000_000;
  else if (mult === 'b') val *= 1_000_000_000;
  return Math.round(val);
}

export function scoreArtist(a: any, query: string, topResultBrowseId?: string): number {
  const cleanQ = query.trim().toLowerCase();
  const name = (a.name || '').trim().toLowerCase();
  const subs = parseSubscriberCount(a.subscribers || a.subtitle?.text);
  let score = 0;

  if (topResultBrowseId && (a.id === topResultBrowseId || a.endpoint?.payload?.browseId === topResultBrowseId)) {
    score += 100_000_000;
  }

  if (name === cleanQ) {
    score += 2_000_000;
  } else if (name.startsWith(cleanQ)) {
    score += 200_000;
  } else if (name.includes(cleanQ)) {
    score += 50_000;
  }

  // Weight by subscriber count so an artist with 316K subscribers dominates one with 290 subscribers
  score += Math.min(subs, 50_000_000);

  return score;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const searchCache = new Map<string, CacheEntry<{ artistCard?: any; songs: InnertubeTrack[] }>>();
const artistCache = new Map<string, CacheEntry<InnertubeArtistDetails>>();
const albumCache = new Map<string, CacheEntry<InnertubeAlbumDetails>>();

export async function search(query: string): Promise<{
  artistCard?: {
    name: string;
    avatarUrl?: string;
    subtitle?: string;
    browseId?: string;
    externalUrl?: string;
  };
  songs: InnertubeTrack[];
}> {
  const cleanQKey = query.trim().toLowerCase();
  const cachedSearch = searchCache.get(cleanQKey);
  if (cachedSearch && Date.now() < cachedSearch.expiresAt) {
    return cachedSearch.data;
  }

  const yt = await getInnertube();
  const songs: InnertubeTrack[] = [];
  let artistCard: { name: string; avatarUrl?: string; subtitle?: string; browseId?: string; externalUrl?: string } | undefined;

  // Run general search (for Top Result / MusicCardShelf), song, video, and artist checks in parallel
  const [genRes, songRes, videoRes, artistRes] = await Promise.allSettled([
    yt.music.search(query),
    yt.music.search(query, { type: 'song' }),
    yt.music.search(query, { type: 'video' }),
    yt.music.search(query, { type: 'artist' }),
  ]);

  let topResultArtist: { name: string; avatarUrl?: string; subtitle?: string; browseId?: string } | undefined;

  if (genRes.status === 'fulfilled' && genRes.value?.contents) {
    const contents = genRes.value.contents as any[];
    const card = contents.find((c: any) => c.type === 'MusicCardShelf');
    if (card) {
      const isArtist =
        card.subtitle?.text?.toLowerCase().includes('artist') ||
        card.title?.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_ARTIST' ||
        card.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_ARTIST';
      const browseId = card.title?.endpoint?.payload?.browseId || card.endpoint?.payload?.browseId;
      if (isArtist && browseId && typeof browseId === 'string' && browseId.startsWith('UC')) {
        topResultArtist = {
          name: card.title?.text || query,
          avatarUrl: extractThumbnailUrl(card.thumbnail || card.thumbnails),
          subtitle: card.subtitle?.text || 'Official Artist',
          browseId,
        };
      }
    }
  }

  // Score and rank all artist search results
  let bestArtistCandidate: any = null;
  if (artistRes.status === 'fulfilled' && artistRes.value) {
    const aShelf = artistRes.value.contents?.[0];
    const aItems: any[] = aShelf && 'contents' in aShelf ? (aShelf.contents as any[]) : [];
    if (aItems.length > 0) {
      const scored = aItems
        .map((item) => ({
          item,
          score: scoreArtist(item, query, topResultArtist?.browseId),
        }))
        .sort((a, b) => b.score - a.score);

      bestArtistCandidate = scored[0]?.item;
    }
  }

  if (topResultArtist && bestArtistCandidate) {
    const topSubs = parseSubscriberCount(topResultArtist.subtitle);
    const candSubs = parseSubscriberCount(bestArtistCandidate.subscribers || bestArtistCandidate.subtitle?.text);
    const candName = (bestArtistCandidate.name || '').toLowerCase().trim();
    const cleanQ = query.trim().toLowerCase();
    // Prefer bestArtistCandidate if exact match and has substantially more subscribers
    if (candName === cleanQ && candSubs > topSubs * 2) {
      const bId = bestArtistCandidate.id || topResultArtist.browseId;
      artistCard = {
        name: bestArtistCandidate.name || query,
        avatarUrl: extractThumbnailUrl(bestArtistCandidate.thumbnails || bestArtistCandidate.thumbnail) || topResultArtist.avatarUrl,
        subtitle: bestArtistCandidate.subscribers || topResultArtist.subtitle || 'Official Artist',
        browseId: bId,
        externalUrl: bId?.startsWith('UC') ? `https://music.youtube.com/channel/${bId}` : undefined,
      };
    } else {
      artistCard = {
        ...topResultArtist,
        externalUrl: topResultArtist.browseId?.startsWith('UC')
          ? `https://music.youtube.com/channel/${topResultArtist.browseId}`
          : undefined,
      };
    }
  } else if (topResultArtist) {
    artistCard = {
      ...topResultArtist,
      externalUrl: topResultArtist.browseId?.startsWith('UC')
        ? `https://music.youtube.com/channel/${topResultArtist.browseId}`
        : undefined,
    };
  } else if (bestArtistCandidate) {
    const cleanQ = query.trim().toLowerCase();
    const candName = (bestArtistCandidate.name || '').toLowerCase().trim();
    if (candName.includes(cleanQ) || cleanQ.includes(candName)) {
      const bId = bestArtistCandidate.id;
      artistCard = {
        name: bestArtistCandidate.name || query,
        avatarUrl: extractThumbnailUrl(bestArtistCandidate.thumbnails || bestArtistCandidate.thumbnail),
        subtitle: bestArtistCandidate.subscribers || 'Official YouTube Music Artist',
        browseId: bId,
        externalUrl: bId?.startsWith('UC') ? `https://music.youtube.com/channel/${bId}` : undefined,
      };
    }
  }

  const seenIds = new Set<string>();

  const processItems = (items: any[], forcedArtist?: string) => {
    for (const item of items) {
      const vId = item.id;
      if (!vId || seenIds.has(vId)) continue;
      seenIds.add(vId);

      const rawTitle = typeof item.title === 'string' ? item.title : item.title?.text || 'Untitled';
      const rawArtist = forcedArtist || extractInnertubeArtist(item) || query.trim();
      const { title, artist } = cleanArtistAndTitle(rawTitle, rawArtist);

      const album = item.album?.name || (forcedArtist ? `${forcedArtist} - Top Tracks` : '');
      const durStr = item.duration?.text || '0:00';
      const durSec = parseDurationToSec(durStr);
      const thumbs = item.thumbnails || item.thumbnail || [];
      const artworkUrl = extractThumbnailUrl(thumbs);

      const rawViews = item.views?.text || item.views || item.view_count?.text || item.view_count;
      const views = parseViewsToNumber(rawViews);

      const rawYear =
        item.year?.text ||
        item.year ||
        item.subtitle?.runs?.find((r: any) => /^(19|20)\d{2}$/.test(r.text))?.text ||
        item.published?.text;
      const releaseYear = rawYear ? String(rawYear).match(/\b(19|20)\d{2}\b/)?.[0] : undefined;
      const releaseDate = rawYear ? String(rawYear) : undefined;
      const primaryArtistBrowseId = item.artists?.[0]?.id || (artistCard?.browseId && (artistCard.name.toLowerCase() === artist.toLowerCase()) ? artistCard.browseId : undefined);
      const artistUrl = primaryArtistBrowseId ? `https://music.youtube.com/channel/${primaryArtistBrowseId}` : undefined;
      const albumBrowseId = item.album?.id || undefined;
      const externalUrl = `https://music.youtube.com/watch?v=${vId}`;

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
        releaseDate,
        releaseYear,
        artistBrowseId: primaryArtistBrowseId,
        artistUrl,
        albumBrowseId,
        externalUrl,
        views: views || undefined,
      });
    }
  };

  const cleanQ = query.trim().toLowerCase();

  // Inspect raw songs and videos to gauge popularity of tracks matching query
  const rawSongItems: any[] = (songRes.status === 'fulfilled' && (songRes.value as any)?.contents?.[0]?.contents) || [];
  const rawVideoItems: any[] = (videoRes.status === 'fulfilled' && (videoRes.value as any)?.contents?.[0]?.contents) || [];

  let maxTrackViews = 0;
  for (const it of [...rawSongItems, ...rawVideoItems]) {
    const rawV = it.views?.text || it.views || it.view_count?.text || it.view_count;
    const vNum = parseViewsToNumber(rawV);
    const itTitle = (typeof it.title === 'string' ? it.title : it.title?.text || '').toLowerCase().trim();
    if (itTitle === cleanQ || itTitle.startsWith(cleanQ) || itTitle.includes(cleanQ)) {
      if (vNum > maxTrackViews) maxTrackViews = vNum;
    }
  }

  const artistSubs = parseSubscriberCount(
    artistCard?.subtitle ||
    topResultArtist?.subtitle ||
    bestArtistCandidate?.subscribers ||
    bestArtistCandidate?.subtitle?.text
  );

  // An artist query is considered overshadowed by a viral track ONLY if the artist is obscure (< 25k subscribers).
  // Established artists (>= 25k subscribers, such as BONES with 316k subs) must NEVER be suppressed!
  const isObscureArtist = artistSubs < 25_000;
  const isViralTrackQuery = isObscureArtist && maxTrackViews >= 1_000_000 && (artistSubs < 10_000 || maxTrackViews > artistSubs * 20);

  if (isViralTrackQuery) {
    artistCard = undefined;
  }

  // Top Tracks vs Artist Page:
  // Load artist's official top hits if confirmed topResultArtist OR verified established artist
  const isArtistQuery = Boolean(
    !isViralTrackQuery &&
    artistCard &&
    artistCard.browseId &&
    (topResultArtist ||
      (artistSubs >= 15_000 && (
        artistCard.name.toLowerCase().trim() === cleanQ ||
        cleanQ === artistCard.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
      )))
  );

  if (isArtistQuery && artistCard?.browseId) {
    try {
      const aDetails = await yt.music.getArtist(artistCard.browseId);
      let officialSongs: any[] = [];
      if (typeof aDetails.getAllSongs === 'function') {
        try {
          const allSongs = await aDetails.getAllSongs();
          officialSongs = allSongs?.contents || [];
        } catch {}
      }
      if (officialSongs.length === 0) {
        const songsSec = (aDetails.sections as any[])?.find(
          (s: any) => s.type === 'MusicShelf' || (s.title?.text && s.title.text.toLowerCase().includes('song'))
        );
        if (songsSec?.contents) {
          officialSongs = songsSec.contents;
        }
      }
      if (officialSongs.length > 0) {
        processItems(officialSongs.slice(0, 15), artistCard.name);
      }
    } catch (err) {
      console.warn('[InnertubeService] Failed to load official artist songs for top results:', err);
    }
  }

  if (songRes.status === 'fulfilled' && songRes.value) {
    const shelf = songRes.value.contents?.[0];
    const items: any[] = shelf && 'contents' in shelf ? (shelf.contents as any[]) : [];
    processItems(items);
  }

  if (videoRes.status === 'fulfilled' && videoRes.value) {
    const shelf = videoRes.value.contents?.[0];
    const items: any[] = shelf && 'contents' in shelf ? (shelf.contents as any[]) : [];
    processItems(items);
  }

  // Automatic Fallback: Did You Mean / Typo correction
  if (songs.length === 0) {
    const sVal = songRes.status === 'fulfilled' ? (songRes.value as any) : null;
    const vVal = videoRes.status === 'fulfilled' ? (videoRes.value as any) : null;
    const rawDidYouMean =
      sVal?.did_you_mean?.text ||
      sVal?.header?.did_you_mean?.text ||
      vVal?.did_you_mean?.text ||
      vVal?.header?.did_you_mean?.text;

    const didYouMeanText = typeof rawDidYouMean === 'string' ? rawDidYouMean.trim() : null;

    if (didYouMeanText && didYouMeanText.toLowerCase() !== query.trim().toLowerCase()) {
      try {
        const corrected = await search(didYouMeanText);
        if (corrected.songs.length > 0) {
          return corrected;
        }
      } catch {}
    }
  }

  // Enhance artistCard avatar with real YouTube channel avatar ONLY if missing
  if (artistCard && !artistCard.avatarUrl) {
    try {
      const realCh = await findRealChannelInfo(yt, artistCard.name || query);
      if (realCh.avatarUrl) {
        artistCard.avatarUrl = realCh.avatarUrl;
      }
    } catch {}
  }

  const searchResult = { artistCard, songs };
  if (searchCache.size > 200) {
    const firstKey = searchCache.keys().next().value;
    if (firstKey) searchCache.delete(firstKey);
  }
  searchCache.set(cleanQKey, { data: searchResult, expiresAt: Date.now() + 5 * 60 * 1000 });

  return searchResult;
}

/**
 * Normalizes and upgrades thumbnail URLs:
 * - Prepends 'https:' to protocol-relative '//...' URLs
 * - Upgrades googleusercontent avatar sizes to ultra high-res (900px)
 * - Upgrades album thumbnail dimensions to high-res (544px)
 */
function cleanAndUpgradeThumbUrl(url: string | undefined): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  let clean = url.trim();
  if (clean.startsWith('//')) {
    clean = `https:${clean}`;
  }
  if (clean.includes('googleusercontent.com') || clean.includes('yt3.ggpht.com')) {
    if (/=s\d+(-c-k-c0x[0-9a-f]+-no-rj)?/.test(clean)) {
      clean = clean.replace(/=s\d+(-c-k-c0x[0-9a-f]+-no-rj)?/, '=s900-c-k-c0x00ffffff-no-rj');
    } else if (/=w\d+-h\d+-[a-z0-9-]+/.test(clean)) {
      clean = clean.replace(/=w\d+-h\d+-[a-z0-9-]+/, '=w544-h544-l90-rj');
    }
  }
  return clean;
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
  if (typeof thumbObj === 'string') return cleanAndUpgradeThumbUrl(thumbObj);

  // MusicThumbnail with .contents array: [Thumbnail, ...]
  if (thumbObj.contents && Array.isArray(thumbObj.contents) && thumbObj.contents.length > 0) {
    const list = thumbObj.contents;
    const sorted = [...list].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
    return cleanAndUpgradeThumbUrl(sorted[0]?.url || list[0]?.url);
  }

  // Direct array of Thumbnail objects: [{ url, width, height }, ...]
  if (Array.isArray(thumbObj) && thumbObj.length > 0) {
    const sorted = [...thumbObj].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
    return cleanAndUpgradeThumbUrl(sorted[0]?.url || thumbObj[0]?.url);
  }

  // Nested property .thumbnails or .thumbnail
  if (thumbObj.thumbnails) {
    const res = extractThumbnailUrl(thumbObj.thumbnails);
    if (res) return cleanAndUpgradeThumbUrl(res);
  }
  if (thumbObj.thumbnail) {
    const res = extractThumbnailUrl(thumbObj.thumbnail);
    if (res) return cleanAndUpgradeThumbUrl(res);
  }

  // Direct .url property
  if (typeof thumbObj.url === 'string') return cleanAndUpgradeThumbUrl(thumbObj.url);

  return undefined;
}

/**
 * Searches YouTube for the artist's real channel
 * and retrieves its high-res avatar and channel ID.
 */
async function findRealChannelInfo(yt: Innertube, artistName: string): Promise<{ avatarUrl?: string; channelId?: string; subscriberCount?: number }> {
  try {
    const chSearch = await yt.search(artistName, { type: 'channel' });
    const cleanN = artistName.toLowerCase().trim();
    const channels: any[] = (chSearch.results || []).map((c: any) => {
      const name = (c.author?.name || c.title?.text || '').trim();
      const subsStr = c.subscribers?.text || c.video_count?.text || '';
      return {
        name,
        id: c.id || c.author?.id || '',
        thumbnails: c.author?.thumbnails || c.thumbnails,
        subscribers: parseSubscriberCount(subsStr),
        subscribersStr: subsStr,
      };
    });

    if (channels.length === 0) return {};

    // Score channels by exact match and subscriber count
    const scored = channels.map((c) => {
      const cn = c.name.toLowerCase();
      let score = 0;
      const isExact = cn === cleanN;
      const isTopic = cn.includes('topic');
      if (isExact) score += 500_000;
      else if (cn.includes(cleanN)) score += 50_000;

      if (isTopic) score -= 10_000;
      score += Math.min(c.subscribers, 10_000_000);
      return { c, score };
    }).sort((a, b) => b.score - a.score);

    const best = scored[0]?.c;
    if (best && best.id) {
      let av: string | undefined;
      try {
        const ch = await yt.getChannel(best.id);
        const url = ch?.metadata?.avatar?.[0]?.url || (ch?.header as any)?.author?.thumbnails?.[0]?.url;
        av = extractThumbnailUrl(url);
      } catch {}
      if (!av) av = extractThumbnailUrl(best.thumbnails);
      return { avatarUrl: av, channelId: best.id, subscriberCount: best.subscribers };
    }
  } catch (err) {
    console.warn('[InnertubeService] findRealChannelInfo error:', err);
  }
  return {};
}

const trackDateCache = new Map<string, { uploadDate?: string; releaseYear?: string }>();

export async function enrichTracksWithUploadDates(
  yt: Innertube,
  tracks: Array<InnertubeTrack>,
  maxToEnrich = 50
): Promise<void> {
  const needsEnrichment = tracks
    .slice(0, maxToEnrich)
    .filter((t) => !t.releaseYear && !t.releaseDate && t.id && !t.id.startsWith('album-') && !t.id.startsWith('artist-'));

  if (needsEnrichment.length === 0) return;

  const toFetch: typeof needsEnrichment = [];
  for (const t of needsEnrichment) {
    const cached = trackDateCache.get(t.id);
    if (cached) {
      if (cached.uploadDate) t.releaseDate = cached.uploadDate;
      if (cached.releaseYear) t.releaseYear = cached.releaseYear;
    } else {
      toFetch.push(t);
    }
  }

  if (toFetch.length === 0) return;

  const chunkSize = 15;
  for (let i = 0; i < toFetch.length; i += chunkSize) {
    const chunk = toFetch.slice(i, i + chunkSize);
    await Promise.allSettled(
      chunk.map(async (t) => {
        try {
          const res = await yt.actions.execute('/player', { videoId: t.id, client: 'WEB' });
          const mf = (res.data as any)?.microformat?.playerMicroformatRenderer;
          const uploadDate = mf?.uploadDate || mf?.publishDate;
          if (uploadDate) {
            t.releaseDate = uploadDate;
            const match = String(uploadDate).match(/\b(19|20)\d{2}\b/);
            const releaseYear = match ? match[0] : undefined;
            t.releaseYear = releaseYear;
            trackDateCache.set(t.id, { uploadDate, releaseYear });
          }
        } catch {}
      })
    );
  }
}

export async function getArtist(artistNameOrId: string): Promise<InnertubeArtistDetails> {
  const cleanQuery = artistNameOrId.trim();
  const cacheKey = cleanQuery.toLowerCase();
  const cachedArtist = artistCache.get(cacheKey);
  if (cachedArtist && Date.now() < cachedArtist.expiresAt) {
    return cachedArtist.data;
  }

  const yt = await getInnertube();
  let channelId = cleanQuery;
  let searchItemThumbnail: any = null;
  let channelAvatarUrl: string | undefined = undefined;
  let resolvedSubscribers: string | undefined = undefined;
  let realCh: { avatarUrl?: string; channelId?: string; subscriberCount?: number } = {};

  // 1. If not a valid UC channel ID, resolve via YouTube Music first!
  if (!channelId.startsWith('UC')) {
    // Step A: Check general search for MusicCardShelf Top Result
    try {
      const genSearch = await yt.music.search(cleanQuery);
      for (const rawC of genSearch.contents || []) {
        const c = rawC as any;
        if (c.type === 'MusicCardShelf') {
          const isArtist =
            c.subtitle?.text?.toLowerCase().includes('artist') ||
            c.title?.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_ARTIST' ||
            c.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_ARTIST';
          const bId = c.title?.endpoint?.payload?.browseId || c.endpoint?.payload?.browseId;
          if (isArtist && bId && typeof bId === 'string' && bId.startsWith('UC')) {
            channelId = bId;
            searchItemThumbnail = c.thumbnail || c.thumbnails;
            if (c.subtitle?.text) resolvedSubscribers = c.subtitle.text;
            break;
          }
        }
      }
    } catch (e) {
      console.warn('[InnertubeService] getArtist MusicCardShelf search error:', e);
    }

    // Step B: Search for music artist type and score candidates
    if (!channelId.startsWith('UC')) {
      try {
        const aSearch = await yt.music.search(cleanQuery, { type: 'artist' });
        const aShelf = aSearch.contents?.[0];
        const aItems: any[] = aShelf && 'contents' in aShelf ? (aShelf.contents as any[]) : [];
        if (aItems.length > 0) {
          const scored = aItems
            .map((item) => ({
              item,
              score: scoreArtist(item, cleanQuery),
            }))
            .sort((a, b) => b.score - a.score);

          const best = scored[0]?.item;
          if (best && best.id?.startsWith('UC')) {
            channelId = best.id;
            searchItemThumbnail = best.thumbnail || best.thumbnails;
            if (best.subscribers) resolvedSubscribers = best.subscribers;
          }
        }
      } catch (e) {
        console.warn('[InnertubeService] Artist type search error:', e);
      }
    }

    // Step C: If still not resolved, inspect top song artist
    if (!channelId.startsWith('UC')) {
      try {
        const songSearch = await yt.music.search(cleanQuery, { type: 'song' });
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

  // 2. Resolve real YouTube channel avatar (without overriding a valid UC channelId from YouTube Music)
  try {
    realCh = await findRealChannelInfo(yt, cleanQuery);
    if (realCh.avatarUrl) {
      channelAvatarUrl = realCh.avatarUrl;
    }
    // Only use YouTube channel ID as absolute last resort if channelId is still not a UC ID
    if (!channelId.startsWith('UC') && realCh.channelId && realCh.channelId.startsWith('UC') && (realCh.subscriberCount || 0) >= 5000) {
      channelId = realCh.channelId;
    }
  } catch {}

  // If channelId is a valid UC channel ID and we still lack an avatar, try getChannel
  if (!channelAvatarUrl && channelId.startsWith('UC')) {
    try {
      const ch = await yt.getChannel(channelId);
      const chAv = ch?.metadata?.avatar?.[0]?.url || (ch?.header as any)?.author?.thumbnails?.[0]?.url;
      if (chAv) {
        const resolved = extractThumbnailUrl(chAv);
        if (resolved) channelAvatarUrl = resolved;
      }
    } catch {}
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
  const subscribers = (artistPage?.header as any)?.subscribers?.text || resolvedSubscribers;

  // Comprehensive extraction of avatar URL with real channel avatar strictly prioritized
  let avatarUrl: string | undefined =
    channelAvatarUrl ||
    extractThumbnailUrl(artistPage?.header?.thumbnail) ||
    extractThumbnailUrl(artistPage?.header?.thumbnails) ||
    extractThumbnailUrl((artistPage?.header as any)?.foregroundThumbnail) ||
    extractThumbnailUrl((artistPage?.header as any)?.straplineThumbnail) ||
    extractThumbnailUrl(searchItemThumbnail);

  const topTracks: InnertubeTrack[] = [];
  const albums: InnertubeAlbum[] = [];
  const singles: InnertubeAlbum[] = [];
  const relatedArtists: Array<{ name: string; channelId: string; avatarUrl?: string }> = [];

  let hasMore = false;
  let totalOfficialCount: number | undefined = undefined;

  if (artistPage) {
    try {
      if (typeof artistPage.getAllSongs === 'function') {
        let allSongs = await artistPage.getAllSongs();
        if (allSongs?.playlist_id) {
          try {
            const pl = await yt.music.getPlaylist(allSongs.playlist_id);
            const text = (pl?.header as any)?.second_subtitle?.text;
            const m = text?.match(/\b(\d[\d,\.]*)\s+songs?/i);
            if (m?.[1]) {
              const parsed = parseInt(m[1].replace(/,/g, ''), 10);
              if (!isNaN(parsed) && parsed > 0) {
                totalOfficialCount = parsed;
              }
            }
          } catch {}
        }
        const sItems: any[] = [...(allSongs?.contents || [])];
        try {
          // Fast initial load: paginate continuations up to 2 pages (approx 50-75 tracks)
          let pages = 0;
          while (allSongs && (allSongs as any).has_continuation && pages < 2) {
            allSongs = await (allSongs as any).getContinuation();
            if (allSongs?.contents) {
              sItems.push(...allSongs.contents);
            }
            pages++;
          }
          if (allSongs && (allSongs as any).has_continuation) {
            hasMore = true;
          }
        } catch {}

        for (const item of sItems) {
          const vId = item.id;
          if (!vId) continue;
          const title = typeof item.title === 'string' ? item.title : item.title?.text || 'Untitled';
          const artist = item.artists?.map((a: any) => a.name).join(', ') || artistName;
          const durStr = item.duration?.text || '0:00';
          const artwork = extractThumbnailUrl(item.thumbnails || item.thumbnail);

          const flexRuns = (item.flex_columns || []).map((fc: any) => ({
            text: fc?.title?.runs?.map((r: any) => r.text).join('') || fc?.title?.text || '',
            browseId: fc?.title?.runs?.[0]?.endpoint?.payload?.browseId,
            pageType: fc?.title?.runs?.[0]?.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType,
          }));
          const viewCol = flexRuns.find((f: any) => /plays|views/i.test(f.text));
          const parsedViews = viewCol ? parseViewsToNumber(viewCol.text) : parseViewsToNumber(item.views?.text || item.views);
          const albumCol = flexRuns.find((f: any) => f.pageType === 'MUSIC_PAGE_TYPE_ALBUM') || flexRuns[3];
          const album = item.album?.name || albumCol?.text || `${artistName} Top Tracks`;
          const albumBrowseId = item.album?.id || albumCol?.browseId || undefined;

          const rawYear =
            item.year?.text ||
            item.year ||
            item.subtitle?.runs?.find((r: any) => /^(19|20)\d{2}$/.test(r.text))?.text ||
            item.published?.text;
          const releaseYear = rawYear ? String(rawYear).match(/\b(19|20)\d{2}\b/)?.[0] : undefined;
          const releaseDate = rawYear ? String(rawYear) : undefined;
          const primaryArtistBrowseId = item.artists?.[0]?.id || (channelId.startsWith('UC') ? channelId : undefined);
          const artistUrl = primaryArtistBrowseId ? `https://music.youtube.com/channel/${primaryArtistBrowseId}` : undefined;
          const externalUrl = `https://music.youtube.com/watch?v=${vId}`;

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
            releaseDate,
            releaseYear,
            artistBrowseId: primaryArtistBrowseId,
            artistUrl,
            albumBrowseId,
            externalUrl,
            views: parsedViews,
          });
        }
      }
    } catch (err) {
      console.warn('[InnertubeService] getAllSongs failed, falling back to top songs shelf:', err);
    }

    // Helper to safely extract section header title from any shelf header
    const getSectionTitle = (s: any): string => {
      if (typeof s.header === 'string') return s.header;
      if (typeof s.title === 'string') return s.title;
      if (s.header?.title?.text) return s.header.title.text;
      if (s.header?.text) return s.header.text;
      if (s.title?.text) return s.title.text;
      return s.type || '';
    };

    // 2. Parse sections (Albums, Singles, Related Artists)
    for (const s of (artistPage.sections as any[]) || []) {
      const sTitle = getSectionTitle(s).toLowerCase();
      const contents: any[] = s.contents || [];

      // Top songs fallback if getAllSongs didn't populate
      if (topTracks.length === 0 && sTitle.includes('top song')) {
        for (const item of contents) {
          const vId = item.id;
          if (!vId) continue;
          const title = typeof item.title === 'string' ? item.title : item.title?.text || 'Untitled';
          const artist = item.artists?.map((a: any) => a.name).join(', ') || artistName;
          const durStr = item.duration?.text || '0:00';
          const artwork = extractThumbnailUrl(item.thumbnails || item.thumbnail);

          const flexRuns = (item.flex_columns || []).map((fc: any) => ({
            text: fc?.title?.runs?.map((r: any) => r.text).join('') || fc?.title?.text || '',
            browseId: fc?.title?.runs?.[0]?.endpoint?.payload?.browseId,
            pageType: fc?.title?.runs?.[0]?.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType,
          }));
          const viewCol = flexRuns.find((f: any) => /plays|views/i.test(f.text));
          const parsedViews = viewCol ? parseViewsToNumber(viewCol.text) : parseViewsToNumber(item.views?.text || item.views);
          const albumCol = flexRuns.find((f: any) => f.pageType === 'MUSIC_PAGE_TYPE_ALBUM') || flexRuns[3];
          const album = item.album?.name || albumCol?.text || `${artistName} Top Tracks`;
          const albumBrowseId = item.album?.id || albumCol?.browseId || undefined;

          const rawYear =
            item.year?.text ||
            item.year ||
            item.subtitle?.runs?.find((r: any) => /^(19|20)\d{2}$/.test(r.text))?.text ||
            item.published?.text;
          const releaseYear = rawYear ? String(rawYear).match(/\b(19|20)\d{2}\b/)?.[0] : undefined;
          const releaseDate = rawYear ? String(rawYear) : undefined;
          const primaryArtistBrowseId = item.artists?.[0]?.id || (channelId.startsWith('UC') ? channelId : undefined);
          const artistUrl = primaryArtistBrowseId ? `https://music.youtube.com/channel/${primaryArtistBrowseId}` : undefined;
          const externalUrl = `https://music.youtube.com/watch?v=${vId}`;

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
            releaseDate,
            releaseYear,
            artistBrowseId: primaryArtistBrowseId,
            artistUrl,
            albumBrowseId,
            externalUrl,
            views: parsedViews,
          });
        }
      }

      // Albums
      if (sTitle.includes('album') && !sTitle.includes('single')) {
        for (const it of contents) {
          const alTitle = typeof it.title === 'string' ? it.title : it.title?.text;
          if (!alTitle) continue;
          const year = it.year?.text || it.subtitle?.text || it.year || '';
          const artwork = extractThumbnailUrl(it.thumbnail || it.thumbnails) || avatarUrl;
          const browseId = it.id || it.endpoint?.payload?.browseId;
          const relYear = String(year).match(/\b(19|20)\d{2}\b/)?.[0] || String(year);

          if (!albums.some((a) => a.browseId === browseId)) {
            albums.push({
              title: alTitle,
              year: relYear,
              releaseDate: String(year) || undefined,
              artworkUrl: artwork,
              browseId,
              type: 'Album',
              externalUrl: browseId ? `https://music.youtube.com/browse/${browseId}` : undefined,
            });
          }
        }
      }

      // Singles & EPs
      if (sTitle.includes('single') || sTitle.includes('ep')) {
        for (const it of contents) {
          const sglTitle = typeof it.title === 'string' ? it.title : it.title?.text;
          if (!sglTitle) continue;
          const year = it.year?.text || it.subtitle?.text || it.year || 'Single';
          const artwork = extractThumbnailUrl(it.thumbnail || it.thumbnails) || avatarUrl;
          const browseId = it.id || it.endpoint?.payload?.browseId;
          const relYear = String(year).match(/\b(19|20)\d{2}\b/)?.[0] || String(year);

          if (!singles.some((a) => a.browseId === browseId)) {
            singles.push({
              title: sglTitle,
              year: relYear,
              releaseDate: String(year) || undefined,
              artworkUrl: artwork,
              browseId,
              type: 'Single',
              externalUrl: browseId ? `https://music.youtube.com/browse/${browseId}` : undefined,
            });
          }
        }
      }

      // Related artists (Fans might also like)
      if (sTitle.includes('fans') || sTitle.includes('like') || sTitle.includes('similar')) {
        for (const it of contents) {
          const relName = typeof it.title === 'string' ? it.title : it.title?.text || it.name;
          if (!relName) continue;
          const avatar = extractThumbnailUrl(it.thumbnail || it.thumbnails);
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

    // Enrich topTracks with release year / release date from matched albums & singles
    for (const t of topTracks) {
      if (!t.releaseYear || !t.releaseDate) {
        const matched = albums.find((a) =>
          (t.albumBrowseId && a.browseId === t.albumBrowseId) ||
          (t.album && a.title.toLowerCase().trim() === t.album.toLowerCase().trim())
        ) || singles.find((s) =>
          (t.albumBrowseId && s.browseId === t.albumBrowseId) ||
          (t.title && s.title.toLowerCase().trim() === t.title.toLowerCase().trim()) ||
          (t.album && s.title.toLowerCase().trim() === t.album.toLowerCase().trim())
        );
        if (matched) {
          if (matched.year) t.releaseYear = matched.year;
          if (matched.releaseDate || matched.year) t.releaseDate = matched.releaseDate || matched.year;
        }
      }
    }
  }

  // 3. Merge full video uploads from the artist's real YouTube channel ONLY if topTracks is small (< 15)
  const realChannelId = realCh.channelId || (channelId.startsWith('UC') ? channelId : undefined);
  if (topTracks.length < 15 && realChannelId) {
    try {
      const ch = await yt.getChannel(realChannelId);
      if (typeof ch.getVideos === 'function') {
        let vPage: any = await ch.getVideos();
        const channelVids: any[] = [...(vPage?.videos || [])];
        let vPages = 0;
        while (vPage && vPage.has_continuation && vPages < 1) {
          try {
            vPage = await vPage.getContinuation();
            if (vPage?.videos) channelVids.push(...vPage.videos);
            vPages++;
          } catch {
            break;
          }
        }

        const existingIds = new Set(topTracks.map((t) => t.id));
        for (const item of channelVids) {
          const vId = item.id || item.content_id || item.video_id;
          if (!vId || existingIds.has(vId)) continue;
          existingIds.add(vId);

          const title =
            item.title?.text ||
            item.metadata?.title?.text ||
            (typeof item.title === 'string' ? item.title : 'Untitled');
          let durStr = item.duration?.text || '0:00';
          if (durStr === '0:00' && item.content_image?.overlays) {
            for (const ov of item.content_image.overlays) {
              if (ov.badges) {
                for (const b of ov.badges) {
                  if (b.text && /^\d+:\d+/.test(b.text)) durStr = b.text;
                }
              }
            }
          }

          const artwork =
            extractThumbnailUrl(item.thumbnails || item.thumbnail || item.content_image?.image) ||
            `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;

          const { title: cleanT, artist: cleanA } = cleanArtistAndTitle(title, artistName);

          const rows = item.metadata?.metadata?.metadata_rows || [];
          const metadataParts = rows.flatMap((r: any) => r.metadata_parts?.map((p: any) => p.text?.text || '') || []);
          const datePart = metadataParts.find((p: string) => /ago|назад|\b(19|20)\d{2}\b/i.test(p)) || item.published?.text;
          let relYear = datePart ? String(datePart).match(/\b(19|20)\d{2}\b/)?.[0] : undefined;
          if (!relYear && datePart) {
            const relMatch = String(datePart).match(/(\d+)\s*(?:years?|yr|лет|года?)\s*(?:ago|назад)?/i);
            if (relMatch) {
              const yearsAgo = parseInt(relMatch[1], 10);
              if (!isNaN(yearsAgo) && yearsAgo > 0 && yearsAgo < 100) {
                relYear = String(new Date().getFullYear() - yearsAgo);
              }
            } else if (/(?:days?|months?|weeks?|hours?|дней|месяц|недел|дня)/i.test(datePart)) {
              relYear = String(new Date().getFullYear());
            }
          }
          const relDate = datePart || undefined;
          const vidViews = parseViewsToNumber(item.view_count?.text || item.short_view_count?.text || item.views?.text);

          topTracks.push({
            id: vId,
            title: cleanT,
            artist: cleanA || artistName,
            album: `${artistName} YouTube Uploads`,
            duration: durStr,
            durationSec: parseDurationToSec(durStr),
            source: 'YT',
            sourceLabel: 'YouTube Music',
            artworkUrl: artwork,
            sourceId: vId,
            releaseDate: relDate,
            releaseYear: relYear,
            artistBrowseId: realChannelId,
            artistUrl: realChannelId ? `https://music.youtube.com/channel/${realChannelId}` : undefined,
            externalUrl: `https://music.youtube.com/watch?v=${vId}`,
            views: vidViews,
          });
        }
      }
    } catch (err) {
      console.warn('[InnertubeService] Failed to load channel videos:', err);
    }
  }

  // 4. Fallback: if topTracks is still empty, search songs directly
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
        const artwork = extractThumbnailUrl(item.thumbnails || item.thumbnail);

        const primaryArtistBrowseId = item.artists?.[0]?.id || (channelId.startsWith('UC') ? channelId : undefined);

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
          artistBrowseId: primaryArtistBrowseId,
          artistUrl: primaryArtistBrowseId ? `https://music.youtube.com/channel/${primaryArtistBrowseId}` : undefined,
          externalUrl: `https://music.youtube.com/watch?v=${vId}`,
        });
      }
    } catch (e) {
      console.warn('[InnertubeService] Fallback song search error:', e);
    }
  }

  // 5. Fallback: If albums and singles are both empty, synthesize releases from track albums
  if (albums.length === 0 && singles.length === 0 && topTracks.length > 0) {
    const seenAlbums = new Set<string>();
    for (const t of topTracks) {
      const albName = t.album?.trim();
      if (albName && !albName.toLowerCase().includes('top track') && !seenAlbums.has(albName.toLowerCase())) {
        seenAlbums.add(albName.toLowerCase());
        albums.push({
          title: albName,
          year: t.releaseYear || '',
          releaseDate: t.releaseDate,
          artworkUrl: t.artworkUrl || avatarUrl,
          browseId: albName,
          type: 'Album',
          externalUrl: t.albumBrowseId ? `https://music.youtube.com/browse/${t.albumBrowseId}` : undefined,
        });
      }
    }
  }

  // Real YouTube channel avatar strictly takes highest priority
  if (channelAvatarUrl) {
    avatarUrl = channelAvatarUrl;
  } else if (!avatarUrl && topTracks.length > 0 && topTracks[0].artworkUrl) {
    avatarUrl = topTracks[0].artworkUrl;
  }

  // Popularity priority: sort topTracks by views descending
  topTracks.sort((a, b) => (b.views || 0) - (a.views || 0));

  const totalTracksCount =
    totalOfficialCount ||
    (hasMore ? Math.max(topTracks.length, 100) : topTracks.length);

  let initialTopTracks = topTracks;
  if (initialTopTracks.length > 50) {
    hasMore = true;
    initialTopTracks = initialTopTracks.slice(0, 50);
  }

  // Parse official upload dates directly from the official artist channel / video microformat
  await enrichTracksWithUploadDates(yt, initialTopTracks, 50);

  const artistBrowseId = channelId.startsWith('UC') ? channelId : (realChannelId || undefined);
  const artistUrl = artistBrowseId ? `https://music.youtube.com/channel/${artistBrowseId}` : undefined;

  const result: InnertubeArtistDetails = {
    artist: artistName,
    avatarUrl,
    bio,
    browseId: channelId,
    channelId: artistBrowseId,
    externalUrl: artistUrl,
    subscribers,
    hasMore,
    totalTracksCount,
    topTracks: initialTopTracks,
    albums,
    singles,
    relatedArtists,
  };

  if (artistCache.size > 200) {
    const firstKey = artistCache.keys().next().value;
    if (firstKey) artistCache.delete(firstKey);
  }
  artistCache.set(cacheKey, { data: result, expiresAt: Date.now() + 10 * 60 * 1000 });
  if (artistBrowseId && artistBrowseId.toLowerCase() !== cacheKey) {
    artistCache.set(artistBrowseId.toLowerCase(), { data: result, expiresAt: Date.now() + 10 * 60 * 1000 });
  }

  return result;
}

export async function getArtistFullTracks(channelIdOrName: string, fallbackArtistName?: string): Promise<InnertubeTrack[]> {
  const yt = await getInnertube();
  let channelId = channelIdOrName.trim();
  if (!channelId.startsWith('UC')) {
    const artistData = await getArtist(channelIdOrName);
    if (artistData.channelId?.startsWith('UC')) {
      channelId = artistData.channelId;
    }
  }

  let artistPage: any = null;
  if (channelId.startsWith('UC')) {
    try {
      artistPage = await yt.music.getArtist(channelId);
    } catch {}
  }

  const artistName = artistPage?.header?.title?.text || fallbackArtistName || channelIdOrName;
  const tracks: InnertubeTrack[] = [];
  const existingIds = new Set<string>();

  if (artistPage && typeof artistPage.getAllSongs === 'function') {
    try {
      let allSongs = await artistPage.getAllSongs();
      const sItems: any[] = [...(allSongs?.contents || [])];
      let pages = 0;
      while (allSongs && (allSongs as any).has_continuation && pages < 150) {
        try {
          allSongs = await (allSongs as any).getContinuation();
          if (allSongs?.contents) {
            sItems.push(...allSongs.contents);
          }
          pages++;
        } catch {
          break;
        }
      }

      for (const item of sItems) {
        const vId = item.id;
        if (!vId || existingIds.has(vId)) continue;
        existingIds.add(vId);

        const title = typeof item.title === 'string' ? item.title : item.title?.text || 'Untitled';
        const artist = item.artists?.map((a: any) => a.name).join(', ') || artistName;
        const durStr = item.duration?.text || '0:00';
        const artwork = extractThumbnailUrl(item.thumbnails || item.thumbnail);

        const flexRuns = (item.flex_columns || []).map((fc: any) => ({
          text: fc?.title?.runs?.map((r: any) => r.text).join('') || fc?.title?.text || '',
          browseId: fc?.title?.runs?.[0]?.endpoint?.payload?.browseId,
          pageType: fc?.title?.runs?.[0]?.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType,
        }));
        const viewCol = flexRuns.find((f: any) => /plays|views/i.test(f.text));
        const parsedViews = viewCol ? parseViewsToNumber(viewCol.text) : parseViewsToNumber(item.views?.text || item.views);
        const albumCol = flexRuns.find((f: any) => f.pageType === 'MUSIC_PAGE_TYPE_ALBUM') || flexRuns[3];
        const album = item.album?.name || albumCol?.text || `${artistName} Top Tracks`;
        const albumBrowseId = item.album?.id || albumCol?.browseId || undefined;

        const rawYear =
          item.year?.text ||
          item.year ||
          item.subtitle?.runs?.find((r: any) => /^(19|20)\d{2}$/.test(r.text))?.text ||
          item.published?.text;
        const releaseYear = rawYear ? String(rawYear).match(/\b(19|20)\d{2}\b/)?.[0] : undefined;
        const releaseDate = rawYear ? String(rawYear) : undefined;
        const primaryArtistBrowseId = item.artists?.[0]?.id || (channelId.startsWith('UC') ? channelId : undefined);
        const artistUrl = primaryArtistBrowseId ? `https://music.youtube.com/channel/${primaryArtistBrowseId}` : undefined;
        const externalUrl = `https://music.youtube.com/watch?v=${vId}`;

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
          releaseDate,
          releaseYear,
          artistBrowseId: primaryArtistBrowseId,
          artistUrl,
          albumBrowseId,
          externalUrl,
          views: parsedViews,
        });
      }
    } catch (err) {
      console.warn('[InnertubeService] getArtistFullTracks getAllSongs failed:', err);
    }
  }

  // 2. Fetch tracks from all artist albums & singles (completely eliminates any 100-track ceiling)
  const albumEntries: Array<{ browseId: string; title: string }> = [];
  for (const s of (artistPage?.sections as any[]) || []) {
    const sTitle = (s.header?.title?.text || s.title?.text || s.header || s.type || '').toLowerCase();
    if (sTitle.includes('album') || sTitle.includes('single') || sTitle.includes('ep')) {
      for (const item of s.contents || []) {
        const bId = item.id || item.endpoint?.payload?.browseId;
        if (bId && !albumEntries.some((a) => a.browseId === bId)) {
          albumEntries.push({
            browseId: bId,
            title: typeof item.title === 'string' ? item.title : item.title?.text || '',
          });
        }
      }
    }
  }

  if (albumEntries.length > 0) {
    const chunkSize = 5;
    for (let i = 0; i < albumEntries.length; i += chunkSize) {
      const chunk = albumEntries.slice(i, i + chunkSize);
      const results = await Promise.allSettled(chunk.map((a) => getAlbum(a.browseId)));
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value?.tracks) {
          for (const t of r.value.tracks) {
            if (t.id && !existingIds.has(t.id)) {
              existingIds.add(t.id);
              tracks.push({
                ...t,
                artistBrowseId: t.artistBrowseId || (channelId.startsWith('UC') ? channelId : undefined),
                artistUrl: t.artistUrl || (channelId.startsWith('UC') ? `https://music.youtube.com/channel/${channelId}` : undefined),
              });
            }
          }
        }
      }
    }
  }

  // 3. Real YouTube channel video uploads
  let targetChannelId = channelId;
  try {
    const rc = await findRealChannelInfo(yt, artistName);
    if (rc.channelId && rc.channelId.startsWith('UC')) {
      targetChannelId = rc.channelId;
    }
  } catch {}

  if (targetChannelId.startsWith('UC')) {
    try {
      const ch = await yt.getChannel(targetChannelId);
      if (typeof ch.getVideos === 'function') {
        let vPage: any = await ch.getVideos();
        const channelVids: any[] = [...(vPage?.videos || [])];
        let vPages = 0;
        while (vPage && vPage.has_continuation && vPages < 60) {
          try {
            vPage = await vPage.getContinuation();
            if (vPage?.videos) channelVids.push(...vPage.videos);
            vPages++;
          } catch {
            break;
          }
        }

        for (const item of channelVids) {
          const vId = item.id || item.content_id || item.video_id;
          if (!vId || existingIds.has(vId)) continue;
          existingIds.add(vId);

          const title =
            item.title?.text ||
            item.metadata?.title?.text ||
            (typeof item.title === 'string' ? item.title : 'Untitled');
          let durStr = item.duration?.text || '0:00';
          if (durStr === '0:00' && item.content_image?.overlays) {
            for (const ov of item.content_image.overlays) {
              if (ov.badges) {
                for (const b of ov.badges) {
                  if (b.text && /^\d+:\d+/.test(b.text)) durStr = b.text;
                }
              }
            }
          }

          const artwork =
            extractThumbnailUrl(item.thumbnails || item.thumbnail || item.content_image?.image) ||
            `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;

          const { title: cleanT, artist: cleanA } = cleanArtistAndTitle(title, artistName);
          const rows = item.metadata?.metadata?.metadata_rows || [];
          const metadataParts = rows.flatMap((r: any) => r.metadata_parts?.map((p: any) => p.text?.text || '') || []);
          const datePart = metadataParts.find((p: string) => /ago|назад|\b(19|20)\d{2}\b/i.test(p)) || item.published?.text;
          let relYear = datePart ? String(datePart).match(/\b(19|20)\d{2}\b/)?.[0] : undefined;
          if (!relYear && datePart) {
            const relMatch = String(datePart).match(/(\d+)\s*(?:years?|yr|лет|года?)\s*(?:ago|назад)?/i);
            if (relMatch) {
              const yearsAgo = parseInt(relMatch[1], 10);
              if (!isNaN(yearsAgo) && yearsAgo > 0 && yearsAgo < 100) {
                relYear = String(new Date().getFullYear() - yearsAgo);
              }
            } else if (/(?:days?|months?|weeks?|hours?|дней|месяц|недел|дня)/i.test(datePart)) {
              relYear = String(new Date().getFullYear());
            }
          }
          const relDate = datePart || undefined;
          const vidViews = parseViewsToNumber(item.view_count?.text || item.short_view_count?.text || item.views?.text);

          tracks.push({
            id: vId,
            title: cleanT,
            artist: cleanA || artistName,
            album: `${artistName} YouTube Uploads`,
            duration: durStr,
            durationSec: parseDurationToSec(durStr),
            source: 'YT',
            sourceLabel: 'YouTube Music',
            artworkUrl: artwork,
            sourceId: vId,
            releaseDate: relDate,
            releaseYear: relYear,
            artistBrowseId: targetChannelId,
            artistUrl: `https://music.youtube.com/channel/${targetChannelId}`,
            externalUrl: `https://music.youtube.com/watch?v=${vId}`,
            views: vidViews,
          });
        }
      }
    } catch {}
  }

  tracks.sort((a, b) => (b.views || 0) - (a.views || 0));
  await enrichTracksWithUploadDates(yt, tracks, 60);
  return tracks;
}

export async function getAlbum(browseId: string): Promise<InnertubeAlbumDetails> {
  const cleanKey = browseId.trim().toLowerCase();
  const cachedAlbum = albumCache.get(cleanKey);
  if (cachedAlbum && Date.now() < cachedAlbum.expiresAt) {
    return cachedAlbum.data;
  }

  const yt = await getInnertube();
  let cleanId = browseId.trim().replace(/^album[-_]/i, '');

  if (cleanId.startsWith('VLOLAK')) {
    cleanId = cleanId.replace(/^VL/, '');
  }

  // Restore MPREb_ casing if it was lowercased by legacy code
  if (cleanId.toLowerCase().startsWith('mpreb_')) {
    cleanId = 'MPREb_' + cleanId.slice(6);
  }

  const cacheAndReturn = (result: InnertubeAlbumDetails): InnertubeAlbumDetails => {
    if (albumCache.size > 200) {
      const firstKey = albumCache.keys().next().value;
      if (firstKey) albumCache.delete(firstKey);
    }
    albumCache.set(cleanKey, { data: result, expiresAt: Date.now() + 10 * 60 * 1000 });
    if (result.browseId && result.browseId.toLowerCase() !== cleanKey) {
      albumCache.set(result.browseId.toLowerCase(), { data: result, expiresAt: Date.now() + 10 * 60 * 1000 });
    }
    return result;
  };

  let albumData: any = null;
  let playlistId: string | undefined = undefined;

  // Handle OLAK playlists directly
  if (cleanId.startsWith('OLAK')) {
    playlistId = cleanId;
    try {
      const pl = await yt.music.getPlaylist(cleanId);
      const firstItemAlbumId = (pl.items?.[0] as any)?.album?.id;
      if (firstItemAlbumId && typeof firstItemAlbumId === 'string' && firstItemAlbumId.startsWith('MPREb_')) {
        try {
          albumData = await yt.music.getAlbum(firstItemAlbumId);
          cleanId = firstItemAlbumId;
        } catch (albumErr) {
          console.warn('[InnertubeService] getAlbum from OLAK item failed:', albumErr);
        }
      }

      if (!albumData && pl.items && pl.items.length > 0) {
        // Build response directly from playlist items
        const plItems: any[] = [...((pl.items as any[]) || [])];
        let plPage = pl;
        let plPages = 0;
        while (plPage && (plPage as any).has_continuation && plPages < 10) {
          try {
            plPage = await (plPage as any).getContinuation();
            if (plPage?.items && Array.isArray(plPage.items)) {
              plItems.push(...plPage.items);
            } else if (plPage?.contents && Array.isArray(plPage.contents)) {
              plItems.push(...plPage.contents);
            }
          } catch {
            break;
          }
          plPages++;
        }

        const rawTitle =
          (pl.header as any)?.title?.text ||
          (typeof (pl.header as any)?.title === 'string' ? (pl.header as any).title : '') ||
          (pl.items?.[0] as any)?.album?.name ||
          '';
        const plTitle = rawTitle && !rawTitle.toLowerCase().startsWith('olak') ? rawTitle : 'Album';
        const plArtist =
          (pl.header as any)?.author?.name ||
          (pl.header as any)?.author?.text ||
          (pl.items?.[0] as any)?.artists?.[0]?.name ||
          (pl.items?.[0] as any)?.author?.name ||
          'Various Artists';
        const plThumb = extractThumbnailUrl((pl.header as any)?.thumbnails || (pl.header as any)?.thumbnail);
        const plTracks: InnertubeTrack[] = [];

        for (const item of plItems) {
          const vId = item.id;
          if (!vId) continue;
          const { title: tTitle, artist: tArtist } = cleanArtistAndTitle(
            typeof item.title === 'string' ? item.title : item.title?.text || 'Untitled',
            extractInnertubeArtist(item) || plArtist
          );
          const durStr = item.duration?.text || '0:00';
          plTracks.push({
            id: vId,
            title: tTitle,
            artist: tArtist,
            album: plTitle,
            duration: durStr,
            durationSec: parseDurationToSec(durStr),
            source: 'YT',
            sourceLabel: 'YouTube Music',
            artworkUrl: extractThumbnailUrl(item.thumbnails || item.thumbnail) || plThumb,
            sourceId: vId,
          });
        }

        return cacheAndReturn({
          title: plTitle,
          artist: plArtist,
          year: (pl.header as any)?.year?.text || (pl.header as any)?.subtitle?.text,
          artworkUrl: plThumb || plTracks[0]?.artworkUrl,
          browseId: cleanId,
          playlistId: cleanId,
          tracks: plTracks,
        });
      }
    } catch (plErr) {
      console.warn('[InnertubeService] Direct yt.music.getPlaylist failed for:', cleanId, plErr);
    }
  }

  // If standard album browse ID, try direct getAlbum
  if (!albumData && (cleanId.startsWith('MPREb_') || cleanId.startsWith('FEmusic_'))) {
    try {
      albumData = await yt.music.getAlbum(cleanId);
    } catch (err) {
      console.warn('[InnertubeService] Direct yt.music.getAlbum failed for:', cleanId, err);
    }
  }

  // If direct getAlbum failed or input was a search query, search for album first
  if (!albumData) {
    try {
      const aSearch = await yt.music.search(cleanId, { type: 'album' });
      const aShelf = aSearch.contents?.[0];
      const aItems: any[] = aShelf && 'contents' in aShelf ? (aShelf.contents as any[]) : [];
      if (aItems.length > 0 && aItems[0].id) {
        const foundId = aItems[0].id;
        try {
          albumData = await yt.music.getAlbum(foundId);
          cleanId = foundId;
        } catch (err) {
          console.warn('[InnertubeService] getAlbum from searched album failed:', foundId, err);
        }
      }
    } catch (err) {
      console.warn('[InnertubeService] Album search fallback error:', err);
    }
  }

  // Fallback: Playlist search
  if (!albumData) {
    try {
      const plSearch = await yt.music.search(cleanId, { type: 'playlist' });
      const pShelf = plSearch.contents?.[0];
      const pItems: any[] = pShelf && 'contents' in pShelf ? (pShelf.contents as any[]) : [];
      if (pItems.length > 0 && pItems[0].id) {
        const cleanPlId = pItems[0].id.replace(/^VL/, '');
        const pl = await yt.music.getPlaylist(cleanPlId);
        const rawTitle =
          (pl.header as any)?.title?.text ||
          (typeof (pl.header as any)?.title === 'string' ? (pl.header as any).title : '') ||
          '';
        let plTitle = rawTitle;
        if (
          !plTitle ||
          plTitle.toLowerCase().startsWith('olak') ||
          plTitle.toLowerCase().startsWith('mpreb_') ||
          plTitle.toLowerCase().startsWith('album-')
        ) {
          plTitle = cleanId.startsWith('MPREb_') || cleanId.startsWith('OLAK') || cleanId.startsWith('album-') ? 'Album' : cleanId;
        }
        const plArtist = (pl.header as any)?.author?.name || (pl.header as any)?.author?.text || 'Various Artists';
        const plThumb = extractThumbnailUrl((pl.header as any)?.thumbnails || (pl.header as any)?.thumbnail);
        const plTracks: InnertubeTrack[] = [];
        const plItems: any[] = [...((pl.items as any[]) || [])];

        let plPage = pl;
        let plPages = 0;
        while (plPage && (plPage as any).has_continuation && plPages < 10) {
          try {
            plPage = await (plPage as any).getContinuation();
            if (plPage?.items && Array.isArray(plPage.items)) {
              plItems.push(...plPage.items);
            } else if (plPage?.contents && Array.isArray(plPage.contents)) {
              plItems.push(...plPage.contents);
            }
          } catch {
            break;
          }
          plPages++;
        }

        for (const item of plItems) {
          const vId = item.id;
          if (!vId) continue;
          const { title: tTitle, artist: tArtist } = cleanArtistAndTitle(
            typeof item.title === 'string' ? item.title : item.title?.text || 'Untitled',
            extractInnertubeArtist(item) || plArtist
          );
          const durStr = item.duration?.text || '0:00';
          plTracks.push({
            id: vId,
            title: tTitle,
            artist: tArtist,
            album: plTitle,
            duration: durStr,
            durationSec: parseDurationToSec(durStr),
            source: 'YT',
            sourceLabel: 'YouTube Music',
            artworkUrl: extractThumbnailUrl(item.thumbnails || item.thumbnail) || plThumb,
            sourceId: vId,
          });
        }
        return cacheAndReturn({
          title: plTitle,
          artist: plArtist,
          artworkUrl: plThumb || plTracks[0]?.artworkUrl,
          browseId: cleanId,
          playlistId: cleanPlId,
          tracks: plTracks,
        });
      }
    } catch {}

    // Song search fallback (only if cleanId is not a raw token)
    if (!cleanId.startsWith('MPREb_') && !cleanId.startsWith('OLAK') && !cleanId.startsWith('album-')) {
      try {
        const sSearch = await yt.music.search(cleanId, { type: 'song' });
        const sShelf = sSearch.contents?.[0];
        const sItems: any[] = sShelf && 'contents' in sShelf ? (sShelf.contents as any[]) : [];
        if (sItems.length > 0) {
          const sTracks: InnertubeTrack[] = [];
          for (const item of sItems.slice(0, 25)) {
            const vId = item.id;
            if (!vId) continue;
            const { title: tTitle, artist: tArtist } = cleanArtistAndTitle(
              typeof item.title === 'string' ? item.title : item.title?.text || 'Untitled',
              extractInnertubeArtist(item) || 'Artist'
            );
            const durStr = item.duration?.text || '0:00';
            sTracks.push({
              id: vId,
              title: tTitle,
              artist: tArtist,
              album: cleanId,
              duration: durStr,
              durationSec: parseDurationToSec(durStr),
              source: 'YT',
              sourceLabel: 'YouTube Music',
              artworkUrl: extractThumbnailUrl(item.thumbnails || item.thumbnail),
              sourceId: vId,
            });
          }
          return cacheAndReturn({
            title: cleanId,
            artist: sTracks[0]?.artist || 'Artist',
            artworkUrl: sTracks[0]?.artworkUrl,
            browseId: cleanId,
            tracks: sTracks,
          });
        }
      } catch {}
    }

    throw new Error(`Album could not be loaded: ${cleanId}`);
  }

  // Process successful albumData
  let title =
    albumData.header?.title?.text ||
    (typeof albumData.header?.title === 'string' ? albumData.header?.title : '') ||
    albumData.title ||
    '';
  if (
    !title ||
    title.toLowerCase() === cleanId.toLowerCase() ||
    title.toLowerCase().startsWith('mpreb_') ||
    title.toLowerCase().startsWith('album-') ||
    title.toLowerCase().startsWith('olak')
  ) {
    title = 'Album';
  }

  const artist =
    albumData.header?.strapline_text_one?.text ||
    (albumData.header as any)?.artists?.[0]?.name ||
    (albumData.header as any)?.author?.name ||
    (albumData.header as any)?.author?.text ||
    'Unknown Artist';
  const year = (albumData.header as any)?.year?.text || (albumData.header as any)?.subtitle?.text;
  const thumbs = (albumData.header as any)?.thumbnails || (albumData.header as any)?.thumbnail;
  let artworkUrl = extractThumbnailUrl(thumbs);

  // Extract playlistId from album.url or album.endpoint
  if (!playlistId && albumData.url) {
    const listMatch = albumData.url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (listMatch) playlistId = listMatch[1];
  }
  if (!playlistId && albumData.endpoint?.payload?.playlistId) {
    playlistId = albumData.endpoint.payload.playlistId;
  }

  const tracks: InnertubeTrack[] = [];
  const contents: any[] = [...((albumData.contents as any[]) || (albumData.items as any[]) || [])];

  // Paginate full album tracklist if album has continuation pages
  try {
    let page = albumData;
    let pages = 0;
    while (page && (page as any).has_continuation && pages < 20) {
      page = await (page as any).getContinuation();
      if (page?.contents && Array.isArray(page.contents)) {
        contents.push(...page.contents);
      } else if (page?.items && Array.isArray(page.items)) {
        contents.push(...page.items);
      }
      pages++;
    }
  } catch (cErr) {
    console.warn('[InnertubeService] getAlbum continuation error:', cErr);
  }

  for (const item of contents) {
    const vId = item.id;
    if (!vId) continue;
    const rawTrackTitle = typeof item.title === 'string' ? item.title : item.title?.text || 'Untitled';
    const rawTrackArtist = extractInnertubeArtist(item) || artist;
    const { title: trackTitle, artist: trackArtist } = cleanArtistAndTitle(rawTrackTitle, rawTrackArtist);
    const durStr = item.duration?.text || '0:00';

    const rawYear = year;
    const relYear = rawYear ? String(rawYear).match(/\b(19|20)\d{2}\b/)?.[0] : undefined;

    tracks.push({
      id: vId,
      title: trackTitle,
      artist: trackArtist,
      album: title,
      duration: durStr,
      durationSec: parseDurationToSec(durStr),
      source: 'YT',
      sourceLabel: 'YouTube Music',
      artworkUrl: artworkUrl || extractThumbnailUrl(item.thumbnails || item.thumbnail) || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
      sourceId: vId,
      releaseDate: rawYear ? String(rawYear) : undefined,
      releaseYear: relYear,
      artistBrowseId: (albumData.header as any)?.artists?.[0]?.id || undefined,
      artistUrl: (albumData.header as any)?.artists?.[0]?.id ? `https://music.youtube.com/channel/${(albumData.header as any).artists[0].id}` : undefined,
      albumBrowseId: cleanId,
      externalUrl: `https://music.youtube.com/watch?v=${vId}`,
    });
  }

  if (!artworkUrl && tracks.length > 0 && tracks[0].artworkUrl) {
    artworkUrl = tracks[0].artworkUrl;
  }

  return cacheAndReturn({
    title,
    artist,
    year: year ? String(year).match(/\b(19|20)\d{2}\b/)?.[0] || String(year) : undefined,
    releaseDate: year ? String(year) : undefined,
    artworkUrl,
    browseId: cleanId,
    playlistId,
    externalUrl: `https://music.youtube.com/browse/${cleanId}`,
    tracks,
  });
}

const CURATION_STOP_WORDS = [
  'type beat',
  'free beat',
  'instrumental prod',
  '1 hour',
  'full album',
  'megamix',
  'continuous mix',
  'hour loop',
  '10 hours',
];

export function isCuratedSongValid(track: { title?: string; artist?: string; durationSec?: number }): boolean {
  if (track.durationSec !== undefined && track.durationSec > 0) {
    if (track.durationSec < 30 || track.durationSec > 600) {
      return false;
    }
  }
  const fullText = `${track.title || ''} ${track.artist || ''}`.toLowerCase();
  for (const sw of CURATION_STOP_WORDS) {
    if (fullText.includes(sw)) {
      return false;
    }
  }
  return true;
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
      const items: any[] = [...((fullPl.items as any[]) || [])];

      let plPage = fullPl;
      let plPages = 0;
      while (plPage && (plPage as any).has_continuation && plPages < 5) {
        try {
          plPage = await (plPage as any).getContinuation();
          if (plPage?.items && Array.isArray(plPage.items)) {
            items.push(...plPage.items);
          } else if (plPage?.contents && Array.isArray(plPage.contents)) {
            items.push(...plPage.contents);
          }
        } catch {
          break;
        }
        plPages++;
      }

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
        const durSec = parseDurationToSec(durStr);

        const candidateTrack: InnertubeTrack = {
          id: vId,
          title,
          artist,
          album,
          duration: durStr,
          durationSec: durSec,
          source: 'YT',
          sourceLabel: 'YouTube Music',
          artworkUrl: artwork || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
          sourceId: vId,
        };

        if (isCuratedSongValid(candidateTrack) && !tracks.some((t) => t.id === vId)) {
          tracks.push(candidateTrack);
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
        const durSec = parseDurationToSec(durStr);

        const candidateTrack: InnertubeTrack = {
          id: vId,
          title,
          artist,
          album,
          duration: durStr,
          durationSec: durSec,
          source: 'YT',
          sourceLabel: 'YouTube Music',
          artworkUrl: artwork || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
          sourceId: vId,
        };

        if (isCuratedSongValid(candidateTrack)) {
          tracks.push(candidateTrack);
        }
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

export async function getRelatedTracks(videoId: string): Promise<InnertubeTrack[]> {
  const yt = await getInnertube();
  const tracks: InnertubeTrack[] = [];
  const cleanId = videoId.replace(/^(?:yt-|dm-yt-)/, '');

  try {
    // Primary: YouTube Music native automix radio (50 tracks)
    const upNext = await yt.music.getUpNext(cleanId, true);
    const contents: any[] = (upNext.contents as any[]) || [];

    for (const item of contents) {
      const vId = item.video_id || item.id;
      if (!vId || vId === cleanId) continue;

      const rawTitle = typeof item.title === 'string' ? item.title : item.title?.text || item.title?.toString() || 'Untitled';
      const rawArtist =
        item.author?.name ||
        (typeof item.author === 'string' ? item.author : item.author?.toString()) ||
        (Array.isArray(item.artists) ? item.artists.map((a: any) => a.name).filter(Boolean).join(', ') : '') ||
        extractInnertubeArtist(item) ||
        'Unknown Artist';

      const { title, artist } = cleanArtistAndTitle(rawTitle, rawArtist);
      const album = item.album?.name || '';
      const durStr =
        item.duration?.text ||
        (item.duration?.seconds
          ? `${Math.floor(item.duration.seconds / 60)}:${String(item.duration.seconds % 60).padStart(2, '0')}`
          : '0:00');
      const durSec = item.duration?.seconds || parseDurationToSec(durStr);

      const thumbs = item.thumbnails || item.thumbnail || [];
      const artwork = extractThumbnailUrl(thumbs) || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;

      if (!tracks.some((t) => t.id === vId)) {
        tracks.push({
          id: vId,
          title,
          artist,
          album,
          duration: durStr,
          durationSec: durSec,
          source: 'YT',
          sourceLabel: 'YouTube Music',
          artworkUrl: artwork,
          sourceId: vId,
        });
      }
    }
  } catch (err) {
    console.warn(`[InnertubeService] Failed to getUpNext radio for ${cleanId}:`, err);
  }

  // Fallback to getRelated if getUpNext returned empty
  if (tracks.length === 0) {
    try {
      const rel = await yt.music.getRelated(cleanId);
      const sections: any[] = (rel as any)?.sections || (rel as any)?.contents || [];
      for (const sec of sections) {
        const items = sec.contents || sec.items || [];
        for (const item of items) {
          const vId = item.id || item.video_id;
          if (!vId || vId === cleanId) continue;
          const rawTitle = item.title?.text || item.title?.toString() || 'Untitled';
          const rawArtist = extractInnertubeArtist(item) || 'Unknown Artist';
          const { title, artist } = cleanArtistAndTitle(rawTitle, rawArtist);
          const durStr = item.duration?.text || '0:00';
          const artwork = extractThumbnailUrl(item.thumbnails || item.thumbnail) || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;
          if (!tracks.some((t) => t.id === vId)) {
            tracks.push({
              id: vId,
              title,
              artist,
              album: item.album?.name || '',
              duration: durStr,
              durationSec: parseDurationToSec(durStr),
              source: 'YT',
              sourceLabel: 'YouTube Music',
              artworkUrl: artwork,
              sourceId: vId,
            });
          }
        }
      }
    } catch (relErr) {
      console.warn(`[InnertubeService] Failed getRelated fallback for ${cleanId}:`, relErr);
    }
  }

  return tracks;
}

export interface SearchPlaylistResult {
  id: string;
  title: string;
  creator: string;
  songCount?: number;
  artworkUrl?: string;
  source: 'YT' | 'SC';
  sourceLabel: string;
}

export async function searchPlaylists(query: string): Promise<SearchPlaylistResult[]> {
  try {
    const yt = await getInnertube();
    const res = await yt.music.search(query, { type: 'playlist' });
    const results: SearchPlaylistResult[] = [];

    const shelves = res.contents || [];
    for (const shelf of shelves) {
      const items: any[] = (shelf as any).contents || [];
      for (const item of items) {
        if (!item.id) continue;
        const cleanId = item.id.replace(/^VL/, '');
        const title = typeof item.title === 'string' ? item.title : item.title?.text || 'Playlist';
        const creator = item.author?.name || (item.authors && item.authors[0]?.name) || 'YouTube Music';
        const artworkUrl = extractThumbnailUrl(item.thumbnails || item.thumbnail);

        let songCount: number | undefined;
        if (item.item_count) {
          songCount = parseInt(item.item_count, 10);
        } else if (item.song_count) {
          songCount = parseInt(item.song_count, 10);
        }

        results.push({
          id: cleanId,
          title,
          creator,
          songCount,
          artworkUrl,
          source: 'YT',
          sourceLabel: 'YouTube Music',
        });
      }
    }

    return results;
  } catch (err) {
    console.warn('[InnertubeService] searchPlaylists error:', err);
    return [];
  }
}

export async function getPlaylistTracks(playlistId: string): Promise<{
  title: string;
  author: string;
  artworkUrl?: string;
  tracks: InnertubeTrack[];
}> {
  const yt = await getInnertube();
  const cleanId = playlistId.replace(/^VL/, '');
  const pl = await yt.music.getPlaylist(cleanId);
  const plTitle = (pl.header as any)?.title?.text || 'Playlist';
  const plArtist = (pl.header as any)?.author?.name || 'YouTube Music';
  const plThumb = extractThumbnailUrl((pl.header as any)?.thumbnails || (pl.header as any)?.thumbnail);
  const tracks: InnertubeTrack[] = [];
  const plItems: any[] = [...((pl.items as any[]) || [])];

  let plPage = pl;
  let plPages = 0;
  while (plPage && (plPage as any).has_continuation && plPages < 20) {
    try {
      await new Promise((res) => setTimeout(res, 200));
      plPage = await (plPage as any).getContinuation();
      if (plPage?.items && Array.isArray(plPage.items)) {
        plItems.push(...plPage.items);
      } else if (plPage?.contents && Array.isArray(plPage.contents)) {
        plItems.push(...plPage.contents);
      }
    } catch {
      break;
    }
    plPages++;
  }

  for (const item of plItems) {
    const vId = item.id;
    if (!vId) continue;
    let rawTitle = typeof item.title === 'string' ? item.title : item.title?.text || '';
    let rawArtist = extractInnertubeArtist(item) || plArtist;
    let durStr = item.duration?.text || '';

    // Handle flex_columns fallback
    if (!rawTitle && item.flex_columns && item.flex_columns[0]) {
      rawTitle = item.flex_columns[0].title?.text || 'Untitled';
    }
    if ((!rawArtist || rawArtist === plArtist) && item.flex_columns && item.flex_columns[1]) {
      const colArtist = item.flex_columns[1].title?.text;
      if (colArtist && !colArtist.includes('views') && !colArtist.includes('plays')) {
        rawArtist = colArtist;
      }
    }
    if (!durStr && item.fixed_columns && item.fixed_columns[0]) {
      durStr = item.fixed_columns[0].title?.text || '0:00';
    }

    const { title: tTitle, artist: tArtist } = cleanArtistAndTitle(rawTitle || 'Untitled', rawArtist || 'Unknown Artist');

    const rawViews =
      item.views?.text ||
      item.views ||
      item.view_count?.text ||
      item.view_count ||
      (item.flex_columns || []).find((fc: any) => /plays|views|streams/i.test(fc?.title?.text || ''))?.title?.text;
    const views = parseViewsToNumber(rawViews);

    const rawYear =
      item.year?.text ||
      item.year ||
      item.subtitle?.runs?.find((r: any) => /^(19|20)\d{2}$/.test(r.text))?.text ||
      item.published?.text;
    const releaseYear = rawYear ? String(rawYear).match(/\b(19|20)\d{2}\b/)?.[0] : undefined;
    const releaseDate = rawYear ? String(rawYear) : undefined;
    const primaryArtistBrowseId = item.artists?.[0]?.id || undefined;
    const artistUrl = primaryArtistBrowseId ? `https://music.youtube.com/channel/${primaryArtistBrowseId}` : undefined;
    const albumBrowseId = item.album?.id || undefined;
    const externalUrl = `https://music.youtube.com/watch?v=${vId}`;

    tracks.push({
      id: vId,
      title: tTitle,
      artist: tArtist,
      album: plTitle,
      duration: durStr || '0:00',
      durationSec: parseDurationToSec(durStr),
      source: 'YT',
      sourceLabel: 'YouTube Music',
      artworkUrl: extractThumbnailUrl(item.thumbnails || item.thumbnail) || plThumb,
      sourceId: vId,
      releaseDate,
      releaseYear,
      artistBrowseId: primaryArtistBrowseId,
      artistUrl,
      albumBrowseId,
      externalUrl,
      views: views || undefined,
    });
  }

  return {
    title: plTitle,
    author: plArtist,
    artworkUrl: plThumb || tracks[0]?.artworkUrl,
    tracks,
  };
}

export async function getTracksPopularity(
  tracks: Array<{ id: string; sourceId?: string; source?: 'YT' | 'SC' }>
): Promise<Record<string, number>> {
  const yt = await getInnertube();
  const result: Record<string, number> = {};
  const ytTracks = tracks.filter((t) => (t.source || 'YT') === 'YT');

  const batchSize = 10;
  for (let i = 0; i < ytTracks.length; i += batchSize) {
    const chunk = ytTracks.slice(i, i + batchSize);
    await Promise.allSettled(
      chunk.map(async (t) => {
        const vId = t.sourceId || t.id;
        if (!vId || !/^[a-zA-Z0-9_-]{11}$/.test(vId)) return;
        try {
          const info = await yt.getBasicInfo(vId);
          const vc = info?.basic_info?.view_count;
          if (typeof vc === 'number' && vc > 0) {
            result[t.id] = vc;
            result[vId] = vc;
          }
        } catch {}
      })
    );
  }

  return result;
}

export default {
  getInnertube,
  resetInnertubeInstance,
  search,
  searchPlaylists,
  getPlaylistTracks,
  getTracksPopularity,
  getArtist,
  getArtistFullTracks,
  enrichTracksWithUploadDates,
  getAlbum,
  getGenreTracks,
  getRelatedTracks,
  getLyrics,
  parseDurationToSec,
};
