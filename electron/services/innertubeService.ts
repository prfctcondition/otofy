import { Innertube } from 'youtubei.js';
import { cleanArtistAndTitle, splitArtists } from './trackParser.js';
import authService from './authService.js';
import { electronFetch } from './networkService.js';

const INVALID_ARTIST_LABELS = new Set([
  'song',
  'video',
  'episode',
  'album',
  'single',
  'ep',
  'podcast',
  'unknown artist',
  'unknown',
  '•',
  '&',
  'и',
  'and',
]);

function isValidArtistLabel(text: string | undefined): boolean {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim();
  if (!clean) return false;
  if (INVALID_ARTIST_LABELS.has(clean.toLowerCase())) return false;
  if (/^\d+:\d+$/.test(clean)) return false;
  if (/^(19|20)\d{2}$/.test(clean)) return false;
  if (/(\bviews?\b|\bplays?\b|\bstreams?\b|\bsubscribers?\b|\bmonthly\b|прослушиван|просмотр|подписчик|слушател)/i.test(clean)) {
    return false;
  }
  return true;
}

export interface StructuredArtistInfo {
  artist: string;
  artists: string[];
  artistBrowseId?: string;
  artistBrowseIds: Record<string, string>;
  isOfficialSong: boolean;
}

export function extractStructuredArtists(
  item: any,
  fallbackArtist?: string,
  fallbackBrowseId?: string
): StructuredArtistInfo {
  const artists: string[] = [];
  const artistBrowseIds: Record<string, string> = {};
  const seenLower = new Set<string>();
  let primaryBrowseId: string | undefined;

  const addArtist = (rawName: string | undefined, browseId?: string) => {
    if (!rawName || typeof rawName !== 'string') return;
    const cleanName = rawName.trim().replace(/\s*-\s*topic$/i, '').trim();
    if (!isValidArtistLabel(cleanName)) return;
    const lower = cleanName.toLowerCase();
    if (!seenLower.has(lower)) {
      seenLower.add(lower);
      artists.push(cleanName);
    }
    if (browseId && typeof browseId === 'string' && browseId.startsWith('UC')) {
      if (!artistBrowseIds[cleanName]) {
        artistBrowseIds[cleanName] = browseId;
      }
      if (!primaryBrowseId) {
        primaryBrowseId = browseId;
      }
    }
  };

  if (Array.isArray(item?.artists)) {
    for (const a of item.artists) {
      const name = typeof a === 'string' ? a : a?.name;
      const bId = a?.channel_id || a?.id || a?.endpoint?.payload?.browseId;
      addArtist(name, bId);
    }
  }

  if (Array.isArray(item?.authors)) {
    for (const a of item.authors) {
      const name = typeof a === 'string' ? a : a?.name;
      const bId = a?.channel_id || a?.id || a?.endpoint?.payload?.browseId;
      addArtist(name, bId);
    }
  }

  // Inspect flex_columns runs for any linked artist entities (UC... browseId)
  if (Array.isArray(item?.flex_columns)) {
    for (let colIdx = 1; colIdx < item.flex_columns.length; colIdx++) {
      const runs = item.flex_columns[colIdx]?.title?.runs;
      if (!Array.isArray(runs)) continue;
      for (const r of runs) {
        const bId =
          r?.endpoint?.payload?.browseId ||
          r?.navigationEndpoint?.browseEndpoint?.browseId;
        const pageType =
          r?.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType ||
          r?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
        if (bId && typeof bId === 'string' && bId.startsWith('UC') && pageType !== 'MUSIC_PAGE_TYPE_ALBUM') {
          addArtist(r.text, bId);
        }
      }
    }
  }

  // Also check subtitle runs for linked artist entities
  if (Array.isArray(item?.subtitle?.runs)) {
    for (const r of item.subtitle.runs) {
      const bId =
        r?.endpoint?.payload?.browseId ||
        r?.navigationEndpoint?.browseEndpoint?.browseId;
      if (bId && typeof bId === 'string' && bId.startsWith('UC')) {
        addArtist(r.text, bId);
      }
    }
  }

  const isOfficialSong =
    artists.length > 0 ||
    item?.item_type === 'song' ||
    Boolean(item?.album?.id || item?.album?.name);

  if (artists.length === 0) {
    const rawFallback = extractInnertubeArtist(item) || fallbackArtist || '';
    const splitList = splitArtists(rawFallback);
    for (const part of splitList) {
      addArtist(part, undefined);
    }
  }

  if (!primaryBrowseId && fallbackBrowseId && fallbackBrowseId.startsWith('UC')) {
    primaryBrowseId = fallbackBrowseId;
    if (artists.length === 1 && !artistBrowseIds[artists[0]]) {
      artistBrowseIds[artists[0]] = fallbackBrowseId;
    }
  }

  if (fallbackArtist && fallbackBrowseId && fallbackBrowseId.startsWith('UC')) {
    const matchArt = artists.find((a) => a.toLowerCase() === fallbackArtist.trim().toLowerCase());
    if (matchArt && !artistBrowseIds[matchArt]) {
      artistBrowseIds[matchArt] = fallbackBrowseId;
    }
  }

  const finalArtistStr = artists.length > 0 ? artists.join(', ') : (fallbackArtist || 'Unknown Artist');

  return {
    artist: finalArtistStr,
    artists: artists.length > 0 ? artists : [finalArtistStr],
    artistBrowseId: primaryBrowseId,
    artistBrowseIds,
    isOfficialSong,
  };
}

function extractInnertubeArtist(item: any): string {
  if (Array.isArray(item.artists) && item.artists.length > 0) {
    const valid = item.artists
      .map((a: any) => (typeof a === 'string' ? a : a.name))
      .filter((n: string) => isValidArtistLabel(n));
    if (valid.length > 0) {
      return valid.join(', ');
    }
  }

  if (item.author) {
    const aName = typeof item.author === 'string' ? item.author : item.author.name;
    if (isValidArtistLabel(aName)) {
      return aName;
    }
  }

  if (Array.isArray(item.authors) && item.authors.length > 0) {
    const valid = item.authors
      .map((a: any) => (typeof a === 'string' ? a : a.name))
      .filter((n: string) => isValidArtistLabel(n));
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
          isValidArtistLabel(t)
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
  if (ch && typeof ch === 'string' && isValidArtistLabel(ch)) {
    return ch;
  }

  return '';
}

export interface InnertubeTrack {
  id: string;
  title: string;
  artist: string;
  artists?: string[];
  artistBrowseIds?: Record<string, string>;
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
  if (innertubeInstance) {
    if (innertubeInstance.session?.context?.client) {
      innertubeInstance.session.context.client.hl = 'en';
      innertubeInstance.session.context.client.gl = 'US';
    }
    return innertubeInstance;
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const cookie = authService.getYoutubeCookie();
      const yt = await Innertube.create({
        lang: 'en',
        location: 'US',
        fetch: electronFetch,
        ...(cookie ? { cookie } : {}),
      });
      if (yt.session?.context?.client) {
        yt.session.context.client.hl = 'en';
        yt.session.context.client.gl = 'US';
      }
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
  if (!str || typeof str !== 'string') return 0;
  let s = str.trim().toLowerCase();
  s = s.replace(/\b(million|млн)\b/gi, 'm').replace(/\b(billion|млрд)\b/gi, 'b').replace(/\b(thousand|тыс)\b/gi, 'k');
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

export interface CanonicalArtistMapping {
  canonicalName: string;
  canonicalChannelId: string;
  officialYouTubeChannelId?: string;
  aliases: string[];
  allowedArtists: string[];
}

export const CANONICAL_ARTIST_MAP: Record<string, CanonicalArtistMapping> = {
  bones: {
    canonicalName: 'BONES',
    canonicalChannelId: 'UC-bXlG2xlMylwcaQigx-XmQ',
    officialYouTubeChannelId: 'UCmOVEae8Tl7XmdjdxLbJHkw',
    aliases: ['bones', 'teamsesh', 'team sesh', 'sesh', 'th@ kid', 'surrenderdorothy', 'oregontrail', 'ricky a go go'],
    allowedArtists: ['bones', 'teamsesh', 'team sesh', 'sesh', 'th@ kid', 'surrenderdorothy', 'oregontrail', 'ricky a go go', 'xavier wulf', 'chris travis', 'eddy baker', 'lyson', 'cat soup', 'drew the architect', 'grayera', 'vegard veslelia', 'greaf', 'curtis heron'],
  },
  teamsesh: {
    canonicalName: 'TeamSESH',
    canonicalChannelId: 'UC-bXlG2xlMylwcaQigx-XmQ',
    officialYouTubeChannelId: 'UCmOVEae8Tl7XmdjdxLbJHkw',
    aliases: ['teamsesh', 'team sesh', 'bones', 'sesh', 'th@ kid', 'surrenderdorothy', 'oregontrail', 'ricky a go go'],
    allowedArtists: ['bones', 'teamsesh', 'team sesh', 'sesh', 'th@ kid', 'surrenderdorothy', 'oregontrail', 'ricky a go go', 'xavier wulf', 'chris travis', 'eddy baker', 'lyson', 'cat soup', 'drew the architect', 'grayera', 'vegard veslelia', 'greaf', 'curtis heron'],
  },
  'team sesh': {
    canonicalName: 'TeamSESH',
    canonicalChannelId: 'UC-bXlG2xlMylwcaQigx-XmQ',
    officialYouTubeChannelId: 'UCmOVEae8Tl7XmdjdxLbJHkw',
    aliases: ['teamsesh', 'team sesh', 'bones', 'sesh', 'th@ kid', 'surrenderdorothy', 'oregontrail', 'ricky a go go'],
    allowedArtists: ['bones', 'teamsesh', 'team sesh', 'sesh', 'th@ kid', 'surrenderdorothy', 'oregontrail', 'ricky a go go', 'xavier wulf', 'chris travis', 'eddy baker', 'lyson', 'cat soup', 'drew the architect', 'grayera', 'vegard veslelia', 'greaf', 'curtis heron'],
  },
  'uc-bxlg2xlmylwcaqigx-xmq': {
    canonicalName: 'BONES',
    canonicalChannelId: 'UC-bXlG2xlMylwcaQigx-XmQ',
    officialYouTubeChannelId: 'UCmOVEae8Tl7XmdjdxLbJHkw',
    aliases: ['bones', 'teamsesh', 'team sesh', 'sesh', 'th@ kid', 'surrenderdorothy', 'oregontrail', 'ricky a go go'],
    allowedArtists: ['bones', 'teamsesh', 'team sesh', 'sesh', 'th@ kid', 'surrenderdorothy', 'oregontrail', 'ricky a go go', 'xavier wulf', 'chris travis', 'eddy baker', 'lyson', 'cat soup', 'drew the architect', 'grayera', 'vegard veslelia', 'greaf', 'curtis heron'],
  },
  'ucmoveae8tl7xmdjdxlbjhkw': {
    canonicalName: 'TeamSESH',
    canonicalChannelId: 'UC-bXlG2xlMylwcaQigx-XmQ',
    officialYouTubeChannelId: 'UCmOVEae8Tl7XmdjdxLbJHkw',
    aliases: ['teamsesh', 'team sesh', 'bones', 'sesh', 'th@ kid', 'surrenderdorothy', 'oregontrail', 'ricky a go go'],
    allowedArtists: ['bones', 'teamsesh', 'team sesh', 'sesh', 'th@ kid', 'surrenderdorothy', 'oregontrail', 'ricky a go go', 'xavier wulf', 'chris travis', 'eddy baker', 'lyson', 'cat soup', 'drew the architect', 'grayera', 'vegard veslelia', 'greaf', 'curtis heron'],
  },
};

export function getCanonicalArtistMapping(query: string): CanonicalArtistMapping | null {
  if (!query || typeof query !== 'string') return null;
  const clean = query.trim().toLowerCase();
  return CANONICAL_ARTIST_MAP[clean] || null;
}

export interface ScoredArtistCandidate {
  id: string;
  name: string;
  avatarUrl?: string;
  subs: number;
  subsStr: string;
  isVerified: boolean;
  totalReleases: number;
  score: number;
  art?: any;
  candidate: any;
  breakdown: {
    engagementScore: number;
    catalogScore: number;
    metadataScore: number;
  };
}

export async function scoreArtistCandidates(
  yt: Innertube,
  query: string,
  rawCandidates: any[]
): Promise<ScoredArtistCandidate[]> {
  if (!rawCandidates || rawCandidates.length === 0) return [];

  const cleanQ = query.trim().toLowerCase();
  const strippedQ = cleanQ.replace(/[^\p{L}\p{N}]/gu, '');

  const seenIds = new Set<string>();
  const topCandidates: any[] = [];
  for (const c of rawCandidates) {
    const id = c.id || c.browseId || c.title?.endpoint?.payload?.browseId || c.endpoint?.payload?.browseId;
    if (!id || typeof id !== 'string' || !id.startsWith('UC') || seenIds.has(id)) continue;
    seenIds.add(id);
    topCandidates.push({
      ...c,
      id,
      name: c.name || c.title?.text || (typeof c.title === 'string' ? c.title : ''),
    });
    if (topCandidates.length >= 4) break;
  }

  if (topCandidates.length === 0) return [];

  const details = await Promise.allSettled(
    topCandidates.map(async (c) => {
      try {
        const artPromise = yt.music.getArtist(c.id);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3500));
        const art = await Promise.race([artPromise, timeoutPromise]);
        return { c, art };
      } catch {
        return { c, art: null };
      }
    })
  );

  const scored: ScoredArtistCandidate[] = details.map((d, index) => {
    const c = topCandidates[index];
    if (d.status !== 'fulfilled' || !d.value) {
      return {
        id: c.id,
        name: c.name || query,
        subs: 0,
        subsStr: '',
        isVerified: false,
        totalReleases: 0,
        score: -999,
        candidate: c,
        breakdown: { engagementScore: 0, catalogScore: 0, metadataScore: 0 },
      };
    }

    const art = d.value.art as any;
    const cName = (c.name || art?.header?.title?.text || '').trim().toLowerCase();
    const strippedCName = cName.replace(/[^\p{L}\p{N}]/gu, '');
    const subsStr =
      c.subscribers ||
      (typeof c.subtitle === 'string' ? c.subtitle : c.subtitle?.text) ||
      art?.header?.subscribers?.text ||
      '';
    const subs = parseSubscriberCount(subsStr);

    let engagementScore = 0;
    if (subs >= 1_000_000) engagementScore += 50;
    else if (subs >= 100_000) engagementScore += 35;
    else if (subs >= 10_000) engagementScore += 20;
    else if (subs >= 5_000) engagementScore += 10;
    else if (subs < 1_000) engagementScore -= 10;

    const hasBadge = Array.isArray(c.badges) && c.badges.some((b: any) => {
      const t = (b.tooltip || b.label || b.text || b.type || '').toLowerCase();
      return t.includes('official') || t.includes('verified') || t.includes('artist');
    });
    const hasSubtitleVerified =
      subsStr.toLowerCase().includes('official') ||
      subsStr.toLowerCase().includes('verified') ||
      subsStr.toLowerCase().includes('artist') ||
      subsStr.toLowerCase().includes('исполнител');
    const isVerified = Boolean(hasBadge || hasSubtitleVerified || c.fromMusicCard);
    if (isVerified) engagementScore += 30;

    let catalogScore = 0;
    let totalReleases = 0;
    let topSongs: any[] = [];
    if (art) {
      const sections: any[] = art.sections || [];
      const albumsSec = sections.find((s: any) => {
        const st = (s.header?.title?.text || s.title?.text || '').toLowerCase();
        return st.includes('album') || st.includes('альбом');
      });
      const singlesSec = sections.find((s: any) => {
        const st = (s.header?.title?.text || s.title?.text || '').toLowerCase();
        return st.includes('single') || st.includes('ep') || st.includes('сингл') || st.includes('выпуск');
      });
      const songsSec = sections.find((s: any) => {
        const st = (s.header?.title?.text || s.title?.text || '').toLowerCase();
        return s.type === 'MusicShelf' || st.includes('song') || st.includes('трек');
      });
      const albumsCount = albumsSec?.contents?.length || 0;
      const singlesCount = singlesSec?.contents?.length || 0;
      totalReleases = albumsCount + singlesCount;
      topSongs = songsSec?.contents || [];

      if (totalReleases >= 10) catalogScore += 30;
      else if (totalReleases >= 3) catalogScore += 15;
      else if (totalReleases <= 2 && topSongs.length === 0) catalogScore -= 20;
    }

    let metadataScore = 0;
    const isExactName = cName === cleanQ || (strippedCName.length > 0 && strippedCName === strippedQ);
    if (isExactName) {
      metadataScore += 35;
    } else if (cName.startsWith(cleanQ) || (strippedQ.length > 2 && strippedCName.startsWith(strippedQ))) {
      metadataScore += 20;
    } else if (cName.includes(cleanQ) || (strippedQ.length > 2 && strippedCName.includes(strippedQ))) {
      metadataScore += 10;
    }

    const contentMatch =
      topSongs.some((s: any) => {
        const title = (s.title?.text || s.title || '').toLowerCase();
        const artists = (s.artists || []).map((a: any) => (a.name || '').toLowerCase()).join(' ');
        return (
          title.includes(cleanQ) ||
          artists.includes(cleanQ) ||
          (strippedQ.length > 2 &&
            (title.replace(/[^\p{L}\p{N}]/gu, '').includes(strippedQ) ||
             artists.replace(/[^\p{L}\p{N}]/gu, '').includes(strippedQ)))
        );
      }) ||
      (art?.sections || []).some((sec: any) => {
        return (sec.contents || []).some((item: any) => {
          const t = (item.title?.text || item.title || '').toLowerCase();
          return (
            t.includes(cleanQ) ||
            (strippedQ.length > 2 && t.replace(/[^\p{L}\p{N}]/gu, '').includes(strippedQ))
          );
        });
      });

    if (contentMatch) {
      metadataScore += 40;
    }

    const totalScore = engagementScore + catalogScore + metadataScore;

    const avatarUrl =
      extractThumbnailUrl(c.thumbnails || c.thumbnail) ||
      extractThumbnailUrl(art?.header?.thumbnail) ||
      extractThumbnailUrl(art?.header?.thumbnails);

    return {
      id: c.id,
      name: art?.header?.title?.text || c.name || query,
      avatarUrl,
      subs,
      subsStr,
      isVerified,
      totalReleases,
      score: totalScore,
      art,
      candidate: c,
      breakdown: { engagementScore, catalogScore, metadataScore },
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}

export async function resolveArtistCandidates(yt: Innertube, query: string): Promise<ScoredArtistCandidate[]> {
  const canonical = getCanonicalArtistMapping(query);
  if (canonical) {
    try {
      const art = await yt.music.getArtist(canonical.canonicalChannelId);
      const subsText = (art?.header as any)?.subscribers?.text || '316K subscribers';
      const subs = parseSubscriberCount(subsText);
      const headerAny = art?.header as any;
      const avatarUrl =
        extractThumbnailUrl(headerAny?.thumbnail) ||
        extractThumbnailUrl(headerAny?.thumbnails) ||
        extractThumbnailUrl(headerAny?.foregroundThumbnail);

      return [
        {
          id: canonical.canonicalChannelId,
          name: query.trim().toLowerCase() === 'teamsesh' ? 'TeamSESH' : canonical.canonicalName,
          avatarUrl,
          subs,
          subsStr: subsText,
          isVerified: true,
          totalReleases: 102,
          score: 100,
          art,
          candidate: { id: canonical.canonicalChannelId, name: canonical.canonicalName },
          breakdown: { engagementScore: 50, catalogScore: 30, metadataScore: 20 },
        },
      ];
    } catch {}
  }

  const [genRes, artistRes] = await Promise.allSettled([
    yt.music.search(query),
    yt.music.search(query, { type: 'artist' }),
  ]);
  const rawCandidates: any[] = [];
  if (genRes.status === 'fulfilled' && genRes.value?.contents) {
    const contents = genRes.value.contents as any[];
    const card = contents.find((c: any) => c.type === 'MusicCardShelf');
    if (card) {
      const isArtist =
        card.subtitle?.text?.toLowerCase().includes('artist') ||
        card.subtitle?.text?.toLowerCase().includes('исполнител') ||
        card.title?.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_ARTIST' ||
        card.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_ARTIST';
      const browseId = card.title?.endpoint?.payload?.browseId || card.endpoint?.payload?.browseId;
      if (isArtist && browseId && typeof browseId === 'string' && browseId.startsWith('UC')) {
        rawCandidates.push({
          id: browseId,
          name: card.title?.text || query,
          subscribers: card.subtitle?.text,
          subtitle: card.subtitle,
          thumbnails: card.thumbnail || card.thumbnails,
          fromMusicCard: true,
        });
      }
    }
  }
  if (artistRes.status === 'fulfilled' && artistRes.value) {
    const aShelf = artistRes.value.contents?.[0];
    const aItems: any[] = aShelf && 'contents' in aShelf ? (aShelf.contents as any[]) : [];
    rawCandidates.push(...aItems);
  }
  return scoreArtistCandidates(yt, query, rawCandidates);
}

export function scoreArtist(a: any, query: string, topResultBrowseId?: string): number {
  const cleanQ = query.trim().toLowerCase();
  const name = (a.name || '').trim().toLowerCase();
  const subs = parseSubscriberCount(a.subscribers || a.subtitle?.text);
  let score = 0;

  if (topResultBrowseId && (a.id === topResultBrowseId || a.endpoint?.payload?.browseId === topResultBrowseId)) {
    score += 50;
  }

  if (subs >= 1_000_000) score += 50;
  else if (subs >= 100_000) score += 35;
  else if (subs >= 10_000) score += 20;
  else if (subs >= 5_000) score += 10;
  else if (subs < 1_000) score -= 10;

  if (name === cleanQ) score += 35;
  else if (name.startsWith(cleanQ)) score += 20;
  else if (name.includes(cleanQ)) score += 10;

  return score;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const searchCache = new Map<string, CacheEntry<{ artistCard?: any; songs: InnertubeTrack[] }>>();
const artistCache = new Map<string, CacheEntry<InnertubeArtistDetails>>();
const albumCache = new Map<string, CacheEntry<InnertubeAlbumDetails>>();

export function mapMusicItemToTrack(
  item: any,
  fallbackArtistName: string = 'Unknown Artist',
  fallbackChannelId?: string,
  fallbackAlbumName?: string,
  fallbackArtworkUrl?: string
): InnertubeTrack | null {
  const vId = item?.id || item?.video_id || item?.playlistItemData?.videoId;
  if (!vId || typeof vId !== 'string') return null;

  const rawTitle =
    (typeof item.title === 'string' ? item.title : item.title?.text) ||
    item.flex_columns?.[0]?.title?.text ||
    item.flex_columns?.[0]?.title?.runs?.map((r: any) => r.text).join('') ||
    'Untitled';

  const meta = extractStructuredArtists(item, fallbackArtistName, fallbackChannelId);

  let title = rawTitle.trim() || 'Untitled';
  let artist = meta.artist;
  let artists = meta.artists;

  if (!meta.isOfficialSong) {
    const cleaned = cleanArtistAndTitle(rawTitle, meta.artist);
    title = cleaned.title;
    artist = cleaned.artist;
    artists = splitArtists(artist);
  }

  const flexRuns = (item.flex_columns || []).map((fc: any) => {
    const runs: any[] = fc?.title?.runs || [];
    const albumRun = runs.find(
      (r: any) =>
        r?.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_ALBUM' ||
        (typeof r?.endpoint?.payload?.browseId === 'string' && r.endpoint.payload.browseId.startsWith('MPREb_'))
    );
    return {
      text: runs.map((r: any) => r.text).join('') || fc?.title?.text || '',
      browseId: albumRun?.endpoint?.payload?.browseId || runs[0]?.endpoint?.payload?.browseId,
      pageType:
        albumRun?.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType ||
        runs[0]?.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType,
      albumText: albumRun?.text,
    };
  });

  const viewCol = flexRuns.find((f: any) => /(\bplays?\b|\bviews?\b|\bstreams?\b|прослушиван|просмотр)/i.test(f.text));
  const parsedViews = viewCol
    ? parseViewsToNumber(viewCol.text)
    : parseViewsToNumber(item.views?.text || item.views || item.view_count?.text || item.view_count);

  if (parsedViews > 0) {
    trackPopularityCache.set(vId, parsedViews);
  }

  const albumCol = flexRuns.find((f: any) => f.pageType === 'MUSIC_PAGE_TYPE_ALBUM' || (f.browseId && f.browseId.startsWith('MPREb_'))) || flexRuns[3];
  const album = item.album?.name || albumCol?.albumText || albumCol?.text || fallbackAlbumName || '';
  const albumBrowseId = item.album?.id || albumCol?.browseId || undefined;

  let durStr = item.duration?.text || '';
  if (!durStr && item.fixed_columns?.[0]?.title) {
    durStr = item.fixed_columns[0].title?.text || item.fixed_columns[0].title?.toString() || '';
  }
  if (!durStr && typeof item.duration?.seconds === 'number' && item.duration.seconds > 0) {
    const mins = Math.floor(item.duration.seconds / 60);
    const secs = item.duration.seconds % 60;
    durStr = `${mins}:${String(secs).padStart(2, '0')}`;
  }
  if (!durStr) durStr = '0:00';

  const durSec = typeof item.duration?.seconds === 'number' && item.duration.seconds > 0
    ? item.duration.seconds
    : parseDurationToSec(durStr);

  const artwork =
    extractThumbnailUrl(item.thumbnails || item.thumbnail) ||
    fallbackArtworkUrl ||
    `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;

  const rawYear =
    item.year?.text ||
    item.year ||
    item.subtitle?.runs?.find((r: any) => /^(19|20)\d{2}$/.test(r.text))?.text ||
    item.published?.text;
  const releaseYear = rawYear ? String(rawYear).match(/\b(19|20)\d{2}\b/)?.[0] : undefined;
  const releaseDate = rawYear ? String(rawYear) : undefined;

  const primaryArtistBrowseId = meta.artistBrowseId || (fallbackChannelId?.startsWith('UC') ? fallbackChannelId : undefined);
  const artistUrl = primaryArtistBrowseId ? `https://music.youtube.com/channel/${primaryArtistBrowseId}` : undefined;
  const externalUrl = `https://music.youtube.com/watch?v=${vId}`;

  return {
    id: vId,
    title,
    artist,
    artists,
    artistBrowseIds: Object.keys(meta.artistBrowseIds).length > 0 ? meta.artistBrowseIds : undefined,
    album,
    duration: durStr,
    durationSec: durSec,
    source: 'YT',
    sourceLabel: 'YouTube Music',
    artworkUrl: artwork,
    sourceId: vId,
    releaseDate,
    releaseYear,
    artistBrowseId: primaryArtistBrowseId,
    artistUrl,
    albumBrowseId,
    externalUrl,
    views: parsedViews || undefined,
  };
}

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

  const [genRes, songRes, videoRes, artistRes] = await Promise.allSettled([
    yt.music.search(query),
    yt.music.search(query, { type: 'song' }),
    yt.music.search(query, { type: 'video' }),
    yt.music.search(query, { type: 'artist' }),
  ]);

  const rawCandidates: any[] = [];

  if (genRes.status === 'fulfilled' && genRes.value?.contents) {
    const contents = genRes.value.contents as any[];
    const card = contents.find((c: any) => c.type === 'MusicCardShelf');
    if (card) {
      const isArtist =
        card.subtitle?.text?.toLowerCase().includes('artist') ||
        card.subtitle?.text?.toLowerCase().includes('исполнител') ||
        card.title?.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_ARTIST' ||
        card.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_ARTIST';
      const browseId = card.title?.endpoint?.payload?.browseId || card.endpoint?.payload?.browseId;
      if (isArtist && browseId && typeof browseId === 'string' && browseId.startsWith('UC')) {
        rawCandidates.push({
          id: browseId,
          name: card.title?.text || query,
          subscribers: card.subtitle?.text,
          subtitle: card.subtitle,
          thumbnails: card.thumbnail || card.thumbnails,
          fromMusicCard: true,
        });
      }
    }
  }

  if (artistRes.status === 'fulfilled' && artistRes.value) {
    const aShelf = artistRes.value.contents?.[0];
    const aItems: any[] = aShelf && 'contents' in aShelf ? (aShelf.contents as any[]) : [];
    rawCandidates.push(...aItems);
  }

  const rawSongItems: any[] = (songRes.status === 'fulfilled' && (songRes.value as any)?.contents?.[0]?.contents) || [];
  const rawVideoItems: any[] = (videoRes.status === 'fulfilled' && (videoRes.value as any)?.contents?.[0]?.contents) || [];
  const cleanQ = query.trim().toLowerCase();

  let maxTrackViews = 0;
  for (const it of [...rawSongItems, ...rawVideoItems]) {
    const rawV = it.views?.text || it.views || it.view_count?.text || it.view_count;
    const vNum = parseViewsToNumber(rawV);
    const itTitle = (typeof it.title === 'string' ? it.title : it.title?.text || '').toLowerCase().trim();
    if (itTitle === cleanQ || itTitle.startsWith(cleanQ) || itTitle.includes(cleanQ)) {
      if (vNum > maxTrackViews) maxTrackViews = vNum;
    }
  }

  const canonical = getCanonicalArtistMapping(query);
  const scoredCandidates = canonical
    ? await resolveArtistCandidates(yt, query)
    : await scoreArtistCandidates(yt, query, rawCandidates);
  const bestCandidate = scoredCandidates[0];

  if (bestCandidate && bestCandidate.score > 0) {
    const isObscure = !bestCandidate.isVerified && bestCandidate.subs < 10_000 && bestCandidate.totalReleases < 3;
    const isGatekeeperSuppressed = isObscure && maxTrackViews >= 100_000;
    const isViralTrackOvershadowed =
      bestCandidate.subs < 25_000 &&
      maxTrackViews >= 1_000_000 &&
      (bestCandidate.subs < 10_000 || maxTrackViews > bestCandidate.subs * 20);

    if (!isGatekeeperSuppressed && !isViralTrackOvershadowed) {
      artistCard = {
        name: bestCandidate.name,
        avatarUrl: bestCandidate.avatarUrl,
        subtitle: bestCandidate.subsStr || (bestCandidate.subs > 0 ? `${bestCandidate.subs.toLocaleString()} subscribers` : 'Official Artist'),
        browseId: bestCandidate.id,
        externalUrl: bestCandidate.id.startsWith('UC') ? `https://music.youtube.com/channel/${bestCandidate.id}` : undefined,
      };
    }
  }

  const seenIds = new Set<string>();

  const processItems = (items: any[], forcedArtist?: string, forcedBrowseId?: string) => {
    for (const item of items) {
      const vId = item?.id || item?.video_id;
      if (!vId || seenIds.has(vId)) continue;
      const mapped = mapMusicItemToTrack(
        item,
        forcedArtist || query.trim(),
        forcedBrowseId || artistCard?.browseId,
        forcedArtist ? `${forcedArtist} - Top Tracks` : ''
      );
      if (mapped) {
        seenIds.add(mapped.id);
        songs.push(mapped);
      }
    }
  };

  const isArtistQuery = Boolean(
    artistCard &&
    artistCard.browseId &&
    (bestCandidate?.isVerified || bestCandidate?.subs >= 15_000 || (bestCandidate?.totalReleases || 0) >= 3)
  );

  if (isArtistQuery && artistCard?.browseId) {
    try {
      const aDetails = bestCandidate?.art || (await yt.music.getArtist(artistCard.browseId));
      let officialSongs: any[] = [];
      if (aDetails?.sections) {
        const songsSec = (aDetails.sections as any[])?.find(
          (s: any) => s.type === 'MusicShelf' || /song|трек/i.test(s.title?.text || s.header?.title?.text || '')
        );
        if (songsSec?.contents) {
          officialSongs.push(...songsSec.contents);
        }
      }
      if (officialSongs.length < 10 && typeof aDetails?.getAllSongs === 'function') {
        try {
          const allSongs = await aDetails.getAllSongs();
          if (allSongs?.contents) {
            officialSongs.push(...allSongs.contents);
          }
        } catch {}
      }
      if (officialSongs.length > 0) {
        processItems(officialSongs.slice(0, 15), artistCard.name, artistCard.browseId);
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

export function extractThumbnailUrl(thumbObj: any): string | undefined {
  if (!thumbObj) return undefined;
  if (typeof thumbObj === 'string') return cleanAndUpgradeThumbUrl(thumbObj);

  if (thumbObj.contents && Array.isArray(thumbObj.contents) && thumbObj.contents.length > 0) {
    const list = thumbObj.contents;
    const sorted = [...list].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
    return cleanAndUpgradeThumbUrl(sorted[0]?.url || list[0]?.url);
  }

  if (Array.isArray(thumbObj) && thumbObj.length > 0) {
    const sorted = [...thumbObj].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
    return cleanAndUpgradeThumbUrl(sorted[0]?.url || thumbObj[0]?.url);
  }

  if (thumbObj.thumbnails) {
    const res = extractThumbnailUrl(thumbObj.thumbnails);
    if (res) return cleanAndUpgradeThumbUrl(res);
  }
  if (thumbObj.thumbnail) {
    const res = extractThumbnailUrl(thumbObj.thumbnail);
    if (res) return cleanAndUpgradeThumbUrl(res);
  }

  if (typeof thumbObj.url === 'string') return cleanAndUpgradeThumbUrl(thumbObj.url);

  return undefined;
}

export function isTrackFromAllowedArtist(
  track: { artist?: string; artists?: any[]; author?: any; channelTitle?: string; title?: string },
  targetArtist: string,
  allowedAliases: string[] = []
): boolean {
  const norm = (s: string) => (s || '').toLowerCase().trim().replace(/[^\p{L}\p{N}]/gu, '');
  const targetNorm = norm(targetArtist);
  if (!targetNorm) return true;
  const allowedNorms = new Set([targetNorm, ...allowedAliases.map(norm)].filter(Boolean));

  const trackArtistNames: string[] = [];
  if (track.artist) {
    trackArtistNames.push(...splitArtists(track.artist));
  }
  if (Array.isArray(track.artists)) {
    for (const a of track.artists) {
      const name = typeof a === 'string' ? a : a?.name;
      if (name) trackArtistNames.push(name.trim());
    }
  }

  for (const name of trackArtistNames) {
    const nNorm = norm(name);
    if (!nNorm) continue;
    for (const aNorm of allowedNorms) {
      if (nNorm === aNorm || (aNorm.length >= 3 && (nNorm.includes(aNorm) || aNorm.includes(nNorm)))) {
        return true;
      }
    }
  }

  const authorName = (typeof track.author === 'string' ? track.author : track.author?.name) || track.channelTitle;
  if (authorName) {
    const authNorm = norm(authorName);
    for (const aNorm of allowedNorms) {
      if (authNorm === aNorm || (aNorm.length >= 3 && (authNorm.includes(aNorm) || aNorm.includes(authNorm)))) {
        return true;
      }
    }
  }

  return false;
}

export async function fetchFullReleasesFromSection(
  yt: Innertube,
  section: any,
  type: 'Album' | 'Single' = 'Album'
): Promise<InnertubeAlbum[]> {
  const releases: InnertubeAlbum[] = [];
  if (!section) return releases;

  const endpoint =
    section.header?.more_content?.endpoint?.payload ||
    section.header?.title?.endpoint?.payload ||
    section.endpoint?.payload ||
    section.bottom_endpoint?.payload;

  if (!endpoint || !endpoint.browseId) {
    for (const it of section.contents || []) {
      const title = typeof it.title === 'string' ? it.title : it.title?.text;
      if (!title) continue;
      const year = it.year?.text || it.subtitle?.text || it.year || '';
      const artwork = extractThumbnailUrl(it.thumbnail || it.thumbnails);
      const browseId = it.id || it.endpoint?.payload?.browseId;
      const relYear = String(year).match(/\b(19|20)\d{2}\b/)?.[0] || String(year);
      releases.push({
        title,
        year: relYear,
        releaseDate: String(year) || undefined,
        artworkUrl: artwork,
        browseId,
        type,
        externalUrl: browseId ? `https://music.youtube.com/browse/${browseId}` : undefined,
      });
    }
    return releases;
  }

  try {
    let browseData: any = await yt.actions.execute('/browse', {
      browseId: endpoint.browseId,
      params: endpoint.params,
      client: 'YTMUSIC',
    });

    let pages = 0;
    while (browseData && pages < 15) {
      const sectionList =
        browseData.data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer ||
        browseData.data?.continuationContents?.sectionListContinuation ||
        browseData.data?.continuationContents?.gridContinuation;

      const contentsList = sectionList?.contents || [];
      const grid =
        sectionList?.items ||
        contentsList[0]?.gridRenderer ||
        contentsList[0]?.musicShelfRenderer;

      const rawItems = grid?.items || grid?.contents || [];

      for (const it of rawItems) {
        const r = it.musicTwoRowItemRenderer || it.musicResponsiveListItemRenderer || it;
        const title = r.title?.runs?.[0]?.text || r.title?.text || (typeof r.title === 'string' ? r.title : '');
        if (!title) continue;

        const subText = r.subtitle?.runs?.map((x: any) => x.text).join('') || r.subtitle?.text || '';
        const relYear = String(subText).match(/\b(19|20)\d{2}\b/)?.[0] || '';
        const browseId =
          r.navigationEndpoint?.browseEndpoint?.browseId ||
          r.onTap?.innertubeCommand?.browseEndpoint?.browseId ||
          r.id;

        const thumbs = r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails || r.thumbnails;
        const artwork = extractThumbnailUrl(thumbs);

        if (browseId && !releases.some((x) => x.browseId === browseId)) {
          releases.push({
            title,
            year: relYear,
            releaseDate: subText || undefined,
            artworkUrl: artwork,
            browseId,
            type,
            externalUrl: browseId ? `https://music.youtube.com/browse/${browseId}` : undefined,
          });
        }
      }

      const contData =
        grid?.continuations?.[0]?.nextContinuationData ||
        sectionList?.continuations?.[0]?.nextContinuationData ||
        browseData.data?.continuationContents?.gridContinuation?.continuations?.[0]?.nextContinuationData;

      const contToken = contData?.continuation;
      if (!contToken) break;

      pages++;
      browseData = await yt.actions.execute('/browse', {
        continuation: contToken,
        client: 'YTMUSIC',
      });
    }
  } catch (err) {
    console.warn('[InnertubeService] Error fetching full releases for section:', err);
  }

  if (releases.length === 0 && Array.isArray(section.contents)) {
    for (const it of section.contents) {
      const title = typeof it.title === 'string' ? it.title : it.title?.text;
      if (!title) continue;
      const year = it.year?.text || it.subtitle?.text || it.year || '';
      const artwork = extractThumbnailUrl(it.thumbnail || it.thumbnails);
      const browseId = it.id || it.endpoint?.payload?.browseId;
      const relYear = String(year).match(/\b(19|20)\d{2}\b/)?.[0] || String(year);
      releases.push({
        title,
        year: relYear,
        releaseDate: String(year) || undefined,
        artworkUrl: artwork,
        browseId,
        type,
        externalUrl: browseId ? `https://music.youtube.com/browse/${browseId}` : undefined,
      });
    }
  }

  releases.sort((a, b) => {
    const yA = parseInt(a.year || '', 10) || 0;
    const yB = parseInt(b.year || '', 10) || 0;
    if (yB !== yA) return yB - yA;
    const dA = a.releaseDate ? Date.parse(a.releaseDate) : 0;
    const dB = b.releaseDate ? Date.parse(b.releaseDate) : 0;
    if (!isNaN(dA) && !isNaN(dB) && dA !== dB) return dB - dA;
    return a.title.localeCompare(b.title);
  });

  return releases;
}

async function findRealChannelInfo(yt: Innertube, artistName: string): Promise<{ avatarUrl?: string; channelId?: string; subscriberCount?: number }> {
  try {
    const chSearch = await yt.search(artistName, { type: 'channel' });
    const cleanN = artistName.toLowerCase().trim();
    const strippedN = cleanN.replace(/[^\p{L}\p{N}]/gu, '');
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

    const scored = channels
      .map((c) => {
        const cn = c.name.toLowerCase().trim();
        const strippedCn = cn.replace(/[^\p{L}\p{N}]/gu, '');

        const isExact = cn === cleanN || (strippedCn.length > 0 && strippedCn === strippedN);
        const isTopic = cn.includes('topic');
        const isPrefix =
          (strippedN.length >= 3 && strippedCn.startsWith(strippedN)) ||
          (strippedCn.length >= 3 && strippedN.startsWith(strippedCn));
        const isSubstring = strippedN.length >= 3 && strippedCn.includes(strippedN);

        if (!isExact && !isPrefix && !isSubstring) {
          return { c, score: -1 };
        }

        let score = 0;
        if (isExact) score += 10_000_000;
        else if (isPrefix) score += 2_000_000;
        else if (isSubstring) score += 500_000;

        if (isTopic) score -= 1_000_000;
        score += Math.min(c.subscribers, 5_000_000);
        return { c, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

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
const trackPopularityCache = new Map<string, number>();

export async function enrichTracksWithUploadDates(
  yt: Innertube,
  tracks: Array<InnertubeTrack>,
  maxToEnrich = 50
): Promise<void> {
  const needsEnrichment = tracks
    .slice(0, maxToEnrich)
    .filter((t) => (!t.releaseYear && !t.releaseDate) || (!t.views && t.id && !t.id.startsWith('album-') && !t.id.startsWith('artist-')));

  if (needsEnrichment.length === 0) return;

  const toFetch: typeof needsEnrichment = [];
  for (const t of needsEnrichment) {
    const cachedDate = trackDateCache.get(t.id);
    if (cachedDate) {
      if (cachedDate.uploadDate && !t.releaseDate) t.releaseDate = cachedDate.uploadDate;
      if (cachedDate.releaseYear && !t.releaseYear) t.releaseYear = cachedDate.releaseYear;
    }
    const cachedPop = trackPopularityCache.get(t.id);
    if (cachedPop && (!t.views || cachedPop > t.views)) {
      t.views = cachedPop;
    }
    if (!cachedDate || (!t.views && !cachedPop)) {
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
            if (!t.releaseDate) t.releaseDate = uploadDate;
            const match = String(uploadDate).match(/\b(19|20)\d{2}\b/);
            const releaseYear = match ? match[0] : undefined;
            if (releaseYear && !t.releaseYear) t.releaseYear = releaseYear;
            trackDateCache.set(t.id, { uploadDate, releaseYear });
          }

          const rawViews = (res.data as any)?.videoDetails?.viewCount || mf?.viewCount;
          const vc = typeof rawViews === 'number' ? rawViews : parseInt(String(rawViews || ''), 10);
          if (!isNaN(vc) && vc > 0) {
            const bestViews = Math.max(t.views || 0, vc);
            t.views = bestViews;
            trackPopularityCache.set(t.id, bestViews);
          }
        } catch {}
      })
    );
  }
}

async function fetchTopSongsPlaylistFromShelf(yt: Innertube, artistPage: any, topSongsShelf: any): Promise<{ items: any[]; hasMore: boolean; totalCount?: number }> {
  const items: any[] = [];
  let hasMore = false;
  let totalCount: number | undefined;

  let playlistShelf: any = null;

  if (typeof artistPage?.getAllSongs === 'function') {
    try {
      playlistShelf = await artistPage.getAllSongs();
    } catch {}
  }

  if (!playlistShelf && topSongsShelf) {
    const ep =
      topSongsShelf.endpoint ||
      topSongsShelf.header?.more_content?.endpoint ||
      topSongsShelf.header?.title?.endpoint ||
      topSongsShelf.bottom_endpoint;
    if (ep && typeof ep.call === 'function') {
      try {
        const page = await ep.call(yt.actions, { client: 'YTMUSIC', parse: true });
        playlistShelf = page?.contents_memo?.get('MusicPlaylistShelf')?.[0] || page?.contents?.item?.()?. contents?.[0];
      } catch {}
    } else if (ep?.payload?.browseId) {
      try {
        const cleanPlId = String(ep.payload.browseId).replace(/^VL/, '');
        const pl = await yt.music.getPlaylist(cleanPlId);
        if (pl?.items) {
          items.push(...(pl.items as any[]));
          hasMore = Boolean((pl as any).has_continuation);
          return { items, hasMore, totalCount };
        }
      } catch {}
    }
  }

  if (playlistShelf) {
    if (playlistShelf.playlist_id) {
      try {
        const pl = await yt.music.getPlaylist(playlistShelf.playlist_id);
        const text = (pl?.header as any)?.second_subtitle?.text;
        const m = text?.match(/\b(\d[\d,\.]*)\s+songs?/i);
        if (m?.[1]) {
          const parsed = parseInt(m[1].replace(/[,.]/g, ''), 10);
          if (!isNaN(parsed) && parsed > 0) {
            totalCount = parsed;
          }
        }
      } catch {}
    }

    if (Array.isArray(playlistShelf.contents)) {
      items.push(...playlistShelf.contents);
    }

    try {
      let current = playlistShelf;
      let pages = 0;
      while (current && current.has_continuation && pages < 2) {
        current = await current.getContinuation();
        if (Array.isArray(current?.contents)) {
          items.push(...current.contents);
        }
        pages++;
      }
      if (current && current.has_continuation) {
        hasMore = true;
      }
    } catch {}
  }

  return { items, hasMore, totalCount };
}

export async function getArtist(artistNameOrId: string, fallbackArtistName?: string): Promise<InnertubeArtistDetails> {
  const cleanQuery = artistNameOrId.trim();
  const cleanFallbackName = fallbackArtistName?.trim();
  const cacheKey = `${cleanQuery.toLowerCase()}::${(cleanFallbackName || '').toLowerCase()}`;
  const cachedArtist = artistCache.get(cacheKey);
  if (cachedArtist && Date.now() < cachedArtist.expiresAt) {
    return cachedArtist.data;
  }

  const yt = await getInnertube();
  const canonical =
    getCanonicalArtistMapping(cleanQuery) ||
    (cleanFallbackName ? getCanonicalArtistMapping(cleanFallbackName) : null);

  let channelId = canonical
    ? canonical.canonicalChannelId
    : (cleanQuery.startsWith('UC') ? cleanQuery : '');

  let searchItemThumbnail: any = null;
  let resolvedSubscribers: string | undefined = undefined;
  let artistPage: any = null;

  // If a UC channelId was passed directly, load it first and verify it matches the requested artist
  if (channelId.startsWith('UC') && !canonical) {
    try {
      const candidatePage = await yt.music.getArtist(channelId);
      const pageTitle = (candidatePage?.header?.title?.text || '').trim();
      const hasShelves = Array.isArray(candidatePage?.sections) && candidatePage.sections.length > 0;

      if (hasShelves) {
        if (cleanFallbackName && !cleanFallbackName.startsWith('UC') && pageTitle) {
          const normPage = pageTitle.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
          const normTarget = cleanFallbackName.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
          const isCompatible =
            !normTarget ||
            !normPage ||
            normPage === normTarget ||
            normPage.includes(normTarget) ||
            normTarget.includes(normPage);
          if (isCompatible) {
            artistPage = candidatePage;
          } else {
            // The passed browseId belonged to a different primary artist on a collab track; resolve by cleanFallbackName instead
            channelId = '';
          }
        } else {
          artistPage = candidatePage;
        }
      } else {
        channelId = '';
      }
    } catch {
      channelId = '';
    }
  }

  const searchName = (!cleanQuery.startsWith('UC') ? cleanQuery : (cleanFallbackName || cleanQuery));

  // Resolve official YouTube Music artist channel via search if needed
  if (!artistPage) {
    try {
      const candidates = await resolveArtistCandidates(yt, searchName);
      const winner = candidates[0];
      if (winner && winner.id.startsWith('UC')) {
        channelId = winner.id;
        searchItemThumbnail = winner.avatarUrl;
        if (winner.subsStr) resolvedSubscribers = winner.subsStr;
        if (winner.art) {
          artistPage = winner.art;
        }
      }
    } catch (e) {
      console.warn('[InnertubeService] resolveArtistCandidates error in getArtist:', e);
    }

    if (!channelId.startsWith('UC')) {
      try {
        const songSearch = await yt.music.search(searchName, { type: 'song' });
        const sShelf = songSearch.contents?.[0];
        const sItems: any[] = sShelf && 'contents' in sShelf ? (sShelf.contents as any[]) : [];
        const normTarget = searchName.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
        for (const s of sItems) {
          const meta = extractStructuredArtists(s);
          for (const [aName, bId] of Object.entries(meta.artistBrowseIds)) {
            const normA = aName.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
            if (bId.startsWith('UC') && (!normTarget || normA === normTarget || normA.includes(normTarget) || normTarget.includes(normA))) {
              channelId = bId;
              break;
            }
          }
          if (channelId.startsWith('UC')) break;
        }
      } catch (e) {
        console.warn('[InnertubeService] Song artist lookup error:', e);
      }
    }

    if (!artistPage && channelId.startsWith('UC')) {
      try {
        artistPage = await yt.music.getArtist(channelId);
      } catch (err) {
        console.warn('[InnertubeService] getArtist error for channel:', channelId, err);
      }
    }
  }

  const artistName = canonical
    ? (searchName.toLowerCase() === 'teamsesh' ? 'TeamSESH' : canonical.canonicalName)
    : (artistPage?.header?.title?.text || cleanFallbackName || artistNameOrId);
  const bio = (artistPage?.header as any)?.description?.text;
  const rawSubscribers = (artistPage?.header as any)?.subscribers?.text || resolvedSubscribers;
  const subscribers = rawSubscribers ? String(rawSubscribers).replace(/^(artist|исполнител\S*)\s*•\s*/i, '').trim() : undefined;

  let avatarUrl: string | undefined =
    extractThumbnailUrl(artistPage?.header?.thumbnail) ||
    extractThumbnailUrl(artistPage?.header?.thumbnails) ||
    extractThumbnailUrl((artistPage?.header as any)?.foregroundThumbnail) ||
    extractThumbnailUrl((artistPage?.header as any)?.straplineThumbnail) ||
    extractThumbnailUrl(searchItemThumbnail);

  // Upgrade avatar with high-res channel avatar if available without overriding channelId
  if (channelId.startsWith('UC')) {
    try {
      const ch = await yt.getChannel(channelId);
      const chAv = ch?.metadata?.avatar?.[0]?.url || (ch?.header as any)?.author?.thumbnails?.[0]?.url;
      const resolved = extractThumbnailUrl(chAv);
      if (resolved) avatarUrl = resolved;
    } catch {}
  }

  const topTracks: InnertubeTrack[] = [];
  const albums: InnertubeAlbum[] = [];
  const singles: InnertubeAlbum[] = [];
  const relatedArtists: Array<{ name: string; channelId: string; avatarUrl?: string }> = [];

  let hasMore = false;
  let totalOfficialCount: number | undefined = undefined;

  const getSectionTitle = (s: any): string => {
    if (typeof s.header === 'string') return s.header;
    if (typeof s.title === 'string') return s.title;
    if (s.header?.title?.text) return s.header.title.text;
    if (s.header?.text) return s.header.text;
    if (s.title?.text) return s.title.text;
    return s.type || '';
  };

  if (artistPage) {
    const sections: any[] = (artistPage.sections as any[]) || [];
    const seenTrackIds = new Set<string>();

    // 1. Official Top Songs Shelf (MusicShelf) + Expanded Top Songs Playlist (MusicPlaylistShelf)
    const musicShelves = sections.filter((s: any) => s.type === 'MusicShelf');
    const topSongsShelf =
      musicShelves.find((s: any) => /top\s*song|топ\s*трек|популярн|song|трек/i.test(getSectionTitle(s))) ||
      musicShelves[0];

    // First, add the inline Top Songs from the artist page (guaranteed top hits in YouTube Music order)
    if (topSongsShelf && Array.isArray(topSongsShelf.contents)) {
      for (const item of topSongsShelf.contents) {
        const mapped = mapMusicItemToTrack(item, artistName, channelId, `${artistName} - Top Tracks`, avatarUrl);
        if (mapped && !seenTrackIds.has(mapped.id)) {
          seenTrackIds.add(mapped.id);
          topTracks.push(mapped);
        }
      }
    }

    // Fetch full Top Songs playlist and Albums/Singles in parallel for fast loading
    const albumSec = sections.find((s: any) => {
      const st = getSectionTitle(s).toLowerCase();
      return (st.includes('album') || st.includes('альбом')) && !st.includes('single') && !st.includes('сингл');
    });
    const singleSec = sections.find((s: any) => {
      const st = getSectionTitle(s).toLowerCase();
      return st.includes('single') || st.includes('ep') || st.includes('сингл') || st.includes('выпуск');
    });

    const [expandedSongs, fullAlbums, fullSingles] = await Promise.all([
      fetchTopSongsPlaylistFromShelf(yt, artistPage, topSongsShelf),
      albumSec ? fetchFullReleasesFromSection(yt, albumSec, 'Album') : Promise.resolve([]),
      singleSec ? fetchFullReleasesFromSection(yt, singleSec, 'Single') : Promise.resolve([]),
    ]);

    if (expandedSongs.totalCount) {
      totalOfficialCount = expandedSongs.totalCount;
    }
    if (expandedSongs.hasMore) {
      hasMore = true;
    }

    for (const item of expandedSongs.items) {
      const mapped = mapMusicItemToTrack(item, artistName, channelId, `${artistName} - Top Tracks`, avatarUrl);
      if (mapped && !seenTrackIds.has(mapped.id)) {
        seenTrackIds.add(mapped.id);
        topTracks.push(mapped);
      }
    }

    for (const fa of fullAlbums) {
      if (!albums.some((a) => a.browseId === fa.browseId)) {
        albums.push(fa);
      }
    }

    for (const fs of fullSingles) {
      if (!singles.some((s) => s.browseId === fs.browseId)) {
        singles.push(fs);
      }
    }

    // If the artist has very few tracks in the Top Songs shelf (< 6) but has official releases, load tracks from their top releases
    if (topTracks.length < 6 && (albums.length > 0 || singles.length > 0)) {
      const topReleases = [...albums.slice(0, 2), ...singles.slice(0, 3)].filter((r) => r.browseId);
      const releaseDetails = await Promise.allSettled(topReleases.map((r) => getAlbum(r.browseId!)));
      for (const rd of releaseDetails) {
        if (rd.status === 'fulfilled' && rd.value?.tracks) {
          for (const t of rd.value.tracks) {
            if (t.id && !seenTrackIds.has(t.id)) {
              seenTrackIds.add(t.id);
              topTracks.push({
                ...t,
                artistBrowseId: t.artistBrowseId || (channelId.startsWith('UC') ? channelId : undefined),
                artistUrl: t.artistUrl || (channelId.startsWith('UC') ? `https://music.youtube.com/channel/${channelId}` : undefined),
              });
            }
          }
        }
      }
    }

    // Parse related artists
    for (const s of sections) {
      const sTitle = getSectionTitle(s).toLowerCase();
      if (sTitle.includes('fans') || sTitle.includes('like') || sTitle.includes('similar') || sTitle.includes('похож') || sTitle.includes('поклонник')) {
        for (const it of s.contents || []) {
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

    // Match topTracks with album/single release years
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

  if (!avatarUrl && topTracks.length > 0 && topTracks[0].artworkUrl) {
    avatarUrl = topTracks[0].artworkUrl;
  }

  // Sort by official YouTube Music play counts descending while keeping shelf rank for tracks with equal/missing views
  const originalRank = new Map<string, number>();
  topTracks.forEach((t, idx) => originalRank.set(t.id, idx));
  topTracks.sort((a, b) => {
    const vA = a.views || 0;
    const vB = b.views || 0;
    if (vB !== vA) return vB - vA;
    return (originalRank.get(a.id) ?? 0) - (originalRank.get(b.id) ?? 0);
  });

  const totalTracksCount =
    totalOfficialCount ||
    (hasMore ? Math.max(topTracks.length, 100) : topTracks.length);

  let initialTopTracks = topTracks;
  if (initialTopTracks.length > 50) {
    hasMore = true;
    initialTopTracks = initialTopTracks.slice(0, 50);
  }

  const artistBrowseId = channelId.startsWith('UC') ? channelId : undefined;
  const artistUrl = artistBrowseId ? `https://music.youtube.com/channel/${artistBrowseId}` : undefined;

  const result: InnertubeArtistDetails = {
    artist: artistName,
    avatarUrl,
    bio,
    browseId: artistBrowseId || channelId,
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
  if (artistBrowseId) {
    artistCache.set(artistBrowseId.toLowerCase(), { data: result, expiresAt: Date.now() + 10 * 60 * 1000 });
  }

  return result;
}

export async function getArtistFullTracks(channelIdOrName: string, fallbackArtistName?: string): Promise<InnertubeTrack[]> {
  const yt = await getInnertube();
  const canonical = getCanonicalArtistMapping(channelIdOrName) || (fallbackArtistName ? getCanonicalArtistMapping(fallbackArtistName) : null);
  let channelId = canonical ? canonical.canonicalChannelId : channelIdOrName.trim();
  if (!channelId.startsWith('UC')) {
    const artistData = await getArtist(channelIdOrName, fallbackArtistName);
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

  const artistName = canonical
    ? (channelIdOrName.trim().toLowerCase() === 'teamsesh' ? 'TeamSESH' : canonical.canonicalName)
    : (artistPage?.header?.title?.text || fallbackArtistName || channelIdOrName);
  const tracks: InnertubeTrack[] = [];
  const existingIds = new Set<string>();

  if (artistPage) {
    const sections: any[] = (artistPage.sections as any[]) || [];
    const musicShelves = sections.filter((s: any) => s.type === 'MusicShelf');
    const topSongsShelf =
      musicShelves.find((s: any) => /top\s*song|топ\s*трек|популярн|song|трек/i.test(s.title?.text || s.header?.title?.text || '')) ||
      musicShelves[0];

    if (topSongsShelf && Array.isArray(topSongsShelf.contents)) {
      for (const item of topSongsShelf.contents) {
        const mapped = mapMusicItemToTrack(item, artistName, channelId, `${artistName} - Top Tracks`);
        if (mapped && !existingIds.has(mapped.id)) {
          existingIds.add(mapped.id);
          tracks.push(mapped);
        }
      }
    }

    try {
      let allSongs: any = null;
      if (typeof artistPage.getAllSongs === 'function') {
        try {
          allSongs = await artistPage.getAllSongs();
        } catch {}
      }
      if (!allSongs && topSongsShelf?.endpoint && typeof topSongsShelf.endpoint.call === 'function') {
        try {
          const page = await topSongsShelf.endpoint.call(yt.actions, { client: 'YTMUSIC', parse: true });
          allSongs = page?.contents_memo?.get('MusicPlaylistShelf')?.[0];
        } catch {}
      }

      if (allSongs) {
        const sItems: any[] = [...(allSongs?.contents || [])];
        let pages = 0;
        while (allSongs && (allSongs as any).has_continuation && pages < 50) {
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
          const mapped = mapMusicItemToTrack(item, artistName, channelId, `${artistName} - Top Tracks`);
          if (mapped && !existingIds.has(mapped.id)) {
            existingIds.add(mapped.id);
            tracks.push(mapped);
          }
        }
      }
    } catch (err) {
      console.warn('[InnertubeService] getArtistFullTracks getAllSongs failed:', err);
    }

    const albumSec = sections.find((s: any) => {
      const st = (s.header?.title?.text || s.title?.text || s.header || s.type || '').toLowerCase();
      return (st.includes('album') || st.includes('альбом')) && !st.includes('single') && !st.includes('сингл');
    });
    const singleSec = sections.find((s: any) => {
      const st = (s.header?.title?.text || s.title?.text || s.header || s.type || '').toLowerCase();
      return st.includes('single') || st.includes('ep') || st.includes('сингл') || st.includes('выпуск');
    });

    const [fullAlbums, fullSingles] = await Promise.all([
      albumSec ? fetchFullReleasesFromSection(yt, albumSec, 'Album') : Promise.resolve([]),
      singleSec ? fetchFullReleasesFromSection(yt, singleSec, 'Single') : Promise.resolve([]),
    ]);
    const allReleases = [...fullAlbums, ...fullSingles];

    if (allReleases.length > 0) {
      const chunkSize = 5;
      for (let i = 0; i < allReleases.length; i += chunkSize) {
        const chunk = allReleases.slice(i, i + chunkSize);
        const results = await Promise.allSettled(chunk.map((a) => getAlbum(a.browseId!)));
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
  }

  const originalRank = new Map<string, number>();
  tracks.forEach((t, idx) => originalRank.set(t.id, idx));
  tracks.sort((a, b) => {
    const vA = a.views || 0;
    const vB = b.views || 0;
    if (vB !== vA) return vB - vA;
    return (originalRank.get(a.id) ?? 0) - (originalRank.get(b.id) ?? 0);
  });

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
        while (plPage && (plPage as any).has_continuation && plPages < 100) {
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
          const mapped = mapMusicItemToTrack(item, plArtist, undefined, plTitle);
          if (mapped) {
            if (!mapped.artworkUrl && plThumb) mapped.artworkUrl = plThumb;
            plTracks.push(mapped);
          }
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
        while (plPage && (plPage as any).has_continuation && plPages < 100) {
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
          const mapped = mapMusicItemToTrack(item, plArtist, undefined, plTitle);
          if (mapped) {
            if (!mapped.artworkUrl && plThumb) mapped.artworkUrl = plThumb;
            plTracks.push(mapped);
          }
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
            const mapped = mapMusicItemToTrack(item, 'Artist', undefined, cleanId);
            if (mapped) sTracks.push(mapped);
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
  const albumArtistBrowseId =
    (albumData.header as any)?.artists?.[0]?.id ||
    (albumData.header as any)?.strapline_text_one?.endpoint?.payload?.browseId ||
    undefined;
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

  const rawYear = year;
  const relYear = rawYear ? String(rawYear).match(/\b(19|20)\d{2}\b/)?.[0] : undefined;

  for (const item of contents) {
    const mapped = mapMusicItemToTrack(item, artist, albumArtistBrowseId, title);
    if (!mapped) continue;
    tracks.push({
      ...mapped,
      album: title,
      artworkUrl: artworkUrl || mapped.artworkUrl || `https://i.ytimg.com/vi/${mapped.id}/hqdefault.jpg`,
      releaseDate: rawYear ? String(rawYear) : mapped.releaseDate,
      releaseYear: relYear || mapped.releaseYear,
      albumBrowseId: cleanId,
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
        const mapped = mapMusicItemToTrack(item, query, undefined, query);
        if (mapped && isCuratedSongValid(mapped) && !tracks.some((t) => t.id === mapped.id)) {
          tracks.push(mapped);
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
        const mapped = mapMusicItemToTrack(item, query, undefined, query);
        if (mapped && isCuratedSongValid(mapped) && !tracks.some((t) => t.id === mapped.id)) {
          tracks.push(mapped);
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

const UNRELATED_SCRIPT_REGEX = /[\p{Script=Thai}\p{Script=Bengali}\p{Script=Devanagari}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}\p{Script=Myanmar}\p{Script=Khmer}\p{Script=Lao}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Tibetan}\p{Script=Gujarati}\p{Script=Gurmukhi}\p{Script=Oriya}]/u;

const NON_ARTIST_CHANNEL_PATTERN = /(:\s*official\b|\bofficial\s*channel\b|\blyrics?\s*channel\b|\b fan\s*channel\b|\breupload\b)/i;

export function hasUnexpectedForeignScript(text: string | undefined, seedReference: string = ''): boolean {
  if (!text) return false;
  if (seedReference && UNRELATED_SCRIPT_REGEX.test(seedReference)) {
    return false;
  }
  return UNRELATED_SCRIPT_REGEX.test(text);
}

export async function getRelatedTracks(videoId: string, seedArtist?: string, seedTitle?: string): Promise<InnertubeTrack[]> {
  const yt = await getInnertube();
  const tracks: InnertubeTrack[] = [];
  const fallbackTracks: InnertubeTrack[] = [];
  const cleanId = videoId.replace(/^(?:yt-|dm-yt-)/, '');
  let seedReference = `${seedArtist || ''} ${seedTitle || ''}`.trim();

  const processRelatedCandidate = (item: any) => {
    const vId = item?.video_id || item?.id;
    if (!vId || vId === cleanId) return;
    const mapped = mapMusicItemToTrack(item);
    if (!mapped) return;
    if (!isCuratedSongValid(mapped)) return;
    if (NON_ARTIST_CHANNEL_PATTERN.test(mapped.artist)) return;
    if (hasUnexpectedForeignScript(`${mapped.title} ${mapped.artist}`, seedReference)) return;

    const hasOfficialArtist = Boolean(mapped.artistBrowseId && mapped.artistBrowseId.startsWith('UC'));
    if (hasOfficialArtist) {
      if (!tracks.some((t) => t.id === mapped.id)) {
        tracks.push(mapped);
      }
    } else if (!fallbackTracks.some((t) => t.id === mapped.id)) {
      fallbackTracks.push(mapped);
    }
  };

  try {
    // Primary: YouTube Music native automix radio (50 tracks)
    const upNext = await yt.music.getUpNext(cleanId, true);
    const contents: any[] = (upNext.contents as any[]) || [];

    if (!seedReference && contents[0]) {
      const seedMapped = mapMusicItemToTrack(contents[0]);
      if (seedMapped) {
        seedReference = `${seedMapped.artist} ${seedMapped.title}`;
      }
    }

    for (const item of contents) {
      processRelatedCandidate(item);
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
          processRelatedCandidate(item);
        }
      }
    } catch (relErr) {
      console.warn(`[InnertubeService] Failed getRelated fallback for ${cleanId}:`, relErr);
    }
  }

  return tracks.length > 0 ? tracks : fallbackTracks;
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

export interface SearchArtistResult {
  name: string;
  avatarUrl?: string;
  subscribers?: string;
  genre?: string;
  browseId?: string;
}

export async function searchArtists(query: string): Promise<SearchArtistResult[]> {
  try {
    const yt = await getInnertube();
    const cleanQ = query.trim();
    if (!cleanQ) return [];

    const res = await yt.music.search(cleanQ, { type: 'artist' });
    const results: SearchArtistResult[] = [];

    const shelves = res.contents || [];
    for (const shelf of shelves) {
      const items: any[] = (shelf as any).contents || [];
      for (const item of items) {
        const name = item.name || (typeof item.title === 'string' ? item.title : item.title?.text);
        if (!name) continue;
        const avatarUrl = extractThumbnailUrl(item.thumbnails || item.thumbnail);
        const subscribers = item.subscribers?.text || item.subtitle?.text || 'Artist';
        const browseId = item.id || item.browseId;

        if (!results.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
          results.push({
            name,
            avatarUrl,
            subscribers,
            genre: 'Artist',
            browseId,
          });
        }
      }
    }

    if (results.length === 0) {
      const genSearch = await yt.music.search(cleanQ);
      if (genSearch?.contents) {
        const contents = genSearch.contents as any[];
        const card = contents.find((c: any) => c.type === 'MusicCardShelf');
        if (card) {
          const cardName = card.title?.text || cleanQ;
          const cardAvatar = extractThumbnailUrl(card.thumbnail || card.thumbnails);
          results.push({
            name: cardName,
            avatarUrl: cardAvatar,
            subscribers: card.subtitle?.text || 'Artist',
            genre: 'Artist',
            browseId: card.title?.endpoint?.payload?.browseId || card.endpoint?.payload?.browseId,
          });
        }
      }
    }

    return results;
  } catch (err) {
    console.warn('[InnertubeService] searchArtists error:', err);
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
  let pl: any = null;
  try {
    pl = await yt.music.getPlaylist(cleanId);
  } catch {
    try {
      pl = await yt.getPlaylist(cleanId);
    } catch (e) {
      throw new Error(`Playlist could not be loaded: ${cleanId}`);
    }
  }

  const plTitle = (pl.header as any)?.title?.text || (typeof pl.header?.title === 'string' ? pl.header.title : '') || 'Playlist';
  const plArtist = (pl.header as any)?.author?.name || (pl.header as any)?.author?.text || 'YouTube Music';
  const plThumb = extractThumbnailUrl((pl.header as any)?.thumbnails || (pl.header as any)?.thumbnail);
  const tracks: InnertubeTrack[] = [];
  const plItems: any[] = [...((pl.items as any[]) || (pl.videos as any[]) || [])];

  let plPage = pl;
  let plPages = 0;
  while (plPage && (plPage as any).has_continuation && plPages < 100) {
    try {
      await new Promise((res) => setTimeout(res, 100));
      plPage = await (plPage as any).getContinuation();
      if (plPage?.items && Array.isArray(plPage.items)) {
        plItems.push(...plPage.items);
      } else if (plPage?.videos && Array.isArray(plPage.videos)) {
        plItems.push(...plPage.videos);
      } else if (plPage?.contents && Array.isArray(plPage.contents)) {
        plItems.push(...plPage.contents);
      }
    } catch {
      break;
    }
    plPages++;
  }

  for (const item of plItems) {
    const mapped = mapMusicItemToTrack(item, plArtist, undefined, plTitle);
    if (!mapped) continue;
    if (!mapped.artworkUrl && plThumb) mapped.artworkUrl = plThumb;
    tracks.push(mapped);
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

  const toFetch: Array<{ id: string; vId: string }> = [];
  for (const t of ytTracks) {
    const vId = t.sourceId || t.id;
    if (!vId || !/^[a-zA-Z0-9_-]{11}$/.test(vId)) continue;
    if (trackPopularityCache.has(vId)) {
      const cached = trackPopularityCache.get(vId)!;
      result[t.id] = cached;
      result[vId] = cached;
    } else {
      toFetch.push({ id: t.id, vId });
    }
  }

  const batchSize = 15;
  for (let i = 0; i < toFetch.length; i += batchSize) {
    const chunk = toFetch.slice(i, i + batchSize);
    await Promise.allSettled(
      chunk.map(async ({ id, vId }) => {
        try {
          // 1. Try /player endpoint directly for instant videoDetails.viewCount
          const res = await yt.actions.execute('/player', { videoId: vId, client: 'WEB' });
          const rawViews = (res.data as any)?.videoDetails?.viewCount || (res.data as any)?.microformat?.playerMicroformatRenderer?.viewCount;
          let vc = typeof rawViews === 'number' ? rawViews : parseInt(String(rawViews || ''), 10);

          // 2. Fallback to getBasicInfo if needed
          if (isNaN(vc) || vc <= 0) {
            const info = await yt.getBasicInfo(vId);
            const basicVc = info?.basic_info?.view_count;
            if (typeof basicVc === 'number' && basicVc > 0) {
              vc = basicVc;
            }
          }

          if (typeof vc === 'number' && vc > 0) {
            trackPopularityCache.set(vId, vc);
            result[id] = vc;
            result[vId] = vc;
          } else {
            trackPopularityCache.set(vId, 1);
            result[id] = 1;
            result[vId] = 1;
          }
        } catch {
          trackPopularityCache.set(vId, 1);
          result[id] = 1;
          result[vId] = 1;
        }
      })
    );
  }

  return result;
}

export interface MoodOrGenreItem {
  id: string;
  title: string;
  params: string;
  browseId: string;
  stripeColor: string;
}

export interface MoodsAndGenresSection {
  title: string;
  items: MoodOrGenreItem[];
}

export async function getMoodsAndGenres(_lang: string = 'en'): Promise<MoodsAndGenresSection[]> {
  const yt = await getInnertube();
  try {
    if (yt.session?.context?.client) {
      yt.session.context.client.hl = 'en';
    }
    const res = await yt.actions.execute('/browse', {
      browseId: 'FEmusic_moods_and_genres',
      client: 'YTMUSIC',
    });

    const data: any = res.data;
    const sections = data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
    if (!sections || !Array.isArray(sections)) {
      return [];
    }

    const result: MoodsAndGenresSection[] = [];

    for (const sec of sections) {
      const secTitle = sec.gridRenderer?.header?.gridHeaderRenderer?.title?.runs?.[0]?.text;
      const rawItems = sec.gridRenderer?.items || [];
      const parsedItems: MoodOrGenreItem[] = [];

      for (const item of rawItems) {
        const btn = item.musicNavigationButtonRenderer;
        if (!btn) continue;
        const title = btn.buttonText?.runs?.[0]?.text;
        const clickCommand = btn.clickCommand || btn.navigationEndpoint;
        const browseEndpoint = clickCommand?.browseEndpoint;
        const browseId = browseEndpoint?.browseId || '';
        const params = browseEndpoint?.params || '';
        const rawColor = btn.solid?.leftStripeColor;
        let stripeColor = '#8B5CF6';
        if (typeof rawColor === 'number' && rawColor > 0) {
          const hex = (rawColor >>> 0).toString(16).padStart(8, '0');
          stripeColor = '#' + hex.slice(2);
        }

        if (title) {
          const lowerTitle = title.toLowerCase();
          if (
            lowerTitle.includes('ukrain') ||
            lowerTitle.includes('украин') ||
            lowerTitle.includes('україн')
          ) {
            continue;
          }
          parsedItems.push({
            id: params || title,
            title,
            params,
            browseId,
            stripeColor,
          });
        }
      }

      if (secTitle && parsedItems.length > 0) {
        result.push({
          title: secTitle,
          items: parsedItems,
        });
      }
    }

    return result;
  } catch (err) {
    console.warn('[InnertubeService] getMoodsAndGenres error:', err);
    return [];
  }
}

export default {
  getInnertube,
  resetInnertubeInstance,
  search,
  searchPlaylists,
  searchArtists,
  getPlaylistTracks,
  getTracksPopularity,
  getArtist,
  getArtistFullTracks,
  enrichTracksWithUploadDates,
  getAlbum,
  getGenreTracks,
  getMoodsAndGenres,
  getRelatedTracks,
  getLyrics,
  parseDurationToSec,
};
