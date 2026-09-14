export interface LrcLine {
  time: number; // in seconds
  text: string;
}

export interface LyricsResult {
  id?: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  instrumental: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
  parsedLines?: LrcLine[];
}

// In-memory cache for fast repeated lookups
const lyricsCache = new Map<string, LyricsResult | null>();

// Clean track artist by removing noise like Topic, VEVO, Official, etc.
export function cleanArtist(artist: string): string {
  if (!artist) return '';
  let cleaned = artist.trim();
  cleaned = cleaned.replace(/\s{0,}[-–—]?\s{0,}Topic$/i, '');
  cleaned = cleaned.replace(/[-_\s]{0,}VEVO$/i, '');
  cleaned = cleaned.replace(/\s{0,}[-–—]?\s{0,}Official(\s{1,}Channel)?$/i, '');
  cleaned = cleaned.replace(/\s{1,}(feat\.?|ft\.?|featuring)\s{1,}.+$/i, '');
  return cleaned.replace(/\s+/g, ' ').trim();
}

// Clean track title by removing noise like (Official Music Video), [4K Upgrade], ft., etc.
export function cleanTitle(title: string): string {
  if (!title) return '';
  let cleaned = title;

  // 1. Remove bracketed noise: [4K Upgrade], [Official Video], [HD], etc.
  cleaned = cleaned.replace(/\[[^\]]{0,}\]/g, ' ');

  // 2. Remove parenthesized video and audio noise
  cleaned = cleaned.replace(
    /\(\s{0,}(official(\s{1,}music)?\s{1,}video|official\s{1,}audio|music\s{1,}video|audio|lyrics?(\s{1,}video)?|visualizer|clip(\s{1,}official)?|4k(\s{1,}upgrade)?|hd|hq|uhd|remaster(ed)?|prod\.[^)]{0,})\s{0,}\)/gi,
    ' '
  );

  // 3. Remove parenthesized featuring: (feat. ...), (ft. ...), (featuring ...)
  cleaned = cleaned.replace(
    /\(\s{0,}(feat\.?|ft\.?|featuring)\s{1,}[^)]{0,}\)/gi,
    ' '
  );

  // 4. Remove unbracketed featuring at the end: ft. Artist, feat. Artist, featuring Artist
  cleaned = cleaned.replace(
    /\s{1,}(feat\.?|ft\.?|featuring)\s{1,}[^–—\-|/]{1,}/gi,
    ' '
  );

  // 5. Remove trailing noise phrases: 4K Upgrade, Official Music Video, Official Video, Official Audio
  cleaned = cleaned.replace(
    /\s{0,}[-–—|/]?\s{0,}(4k\s{1,}upgrade|official\s{1,}music\s{1,}video|official\s{1,}video|official\s{1,}audio|music\s{1,}video|video\s{1,}clip)\s{0,}$/gi,
    ''
  );

  // 6. Remove Topic and Vevo suffixes from title if present
  cleaned = cleaned.replace(/\s{0,}[-–—|/]?\s{0,}(Topic|Vevo)\b/gi, '');

  return cleaned.replace(/\s+/g, ' ').trim();
}

// Smart extraction of artist and title, handling "Artist - Title" strings
// and filtering out placeholder artist names like "Song" or "Video".
export function extractArtistAndTitle(
  rawTitle: string,
  rawArtist: string
): { title: string; artist: string } {
  let artist = cleanArtist(rawArtist || '');
  let title = cleanTitle(rawTitle || '');

  const invalidArtists = [
    'song',
    'video',
    'single',
    'ep',
    'album',
    'unknown',
    'various artists',
    'track',
    'audio',
    'undefined',
    'null',
    'topic',
    'vevo',
  ];

  if (invalidArtists.includes(artist.toLowerCase())) {
    artist = '';
  }

  // If title has "Artist - Song Title", split them
  const separators = [' - ', ' – ', ' — '];
  for (const sep of separators) {
    if (title.includes(sep)) {
      const parts = title.split(sep);
      if (parts.length >= 2) {
        if (!artist) {
          artist = cleanArtist(parts[0]);
        }
        title = cleanTitle(parts.slice(1).join(sep));
        break;
      }
    }
  }

  // If artist is known and title starts with "Artist - ", strip it
  if (artist) {
    const lowerArtist = artist.toLowerCase();
    for (const sep of separators) {
      const prefix = `${lowerArtist}${sep.toLowerCase()}`;
      if (title.toLowerCase().startsWith(prefix)) {
        title = title.slice(prefix.length).trim();
        break;
      }
    }
  }

  return { title: cleanTitle(title), artist: cleanArtist(artist) };
}

/**
 * Parse standard LRC format: "[00:12.34] Some lyrics line"
 */
export function parseLrc(lrcText: string): LrcLine[] {
  if (!lrcText) return [];

  const lines = lrcText.split('\n');
  const result: LrcLine[] = [];
  const regex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/;

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(regex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      const timeInSec = minutes * 60 + seconds + ms / 1000;
      const text = match[4].trim();

      if (text) {
        result.push({ time: timeInSec, text });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

const parseCandidate = (cand: any): LyricsResult => {
  return {
    id: cand.id,
    trackName: cand.trackName,
    artistName: cand.artistName,
    albumName: cand.albumName,
    duration: cand.duration,
    instrumental: !!cand.instrumental,
    plainLyrics: cand.plainLyrics || undefined,
    syncedLyrics: cand.syncedLyrics || undefined,
    parsedLines: cand.syncedLyrics ? parseLrc(cand.syncedLyrics) : undefined,
  };
};

export function isCandidateMatch(
  targetTitle: string,
  targetArtist: string,
  candTitle: string,
  candArtist: string
): boolean {
  const norm = (s: string) =>
    (s || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const tT = norm(cleanTitle(targetTitle));
  const tA = norm(cleanArtist(targetArtist));
  const cT = norm(cleanTitle(candTitle));
  const cA = norm(cleanArtist(candArtist));

  if (!tT || !cT) return false;

  // Title similarity
  const tTokens = tT.split(' ').filter((w) => w.length > 1);
  const cTokens = cT.split(' ').filter((w) => w.length > 1);
  const matchedTokens = tTokens.filter((w) => cTokens.includes(w));
  const overlapRatio = tTokens.length > 0 ? matchedTokens.length / tTokens.length : 0;

  const isTitleMatch = cT.includes(tT) || tT.includes(cT) || overlapRatio >= 0.6;

  // Artist check (if artist is specified)
  if (tA && cA) {
    const aTokens = tA.split(' ').filter((w) => w.length > 1);
    const caTokens = cA.split(' ').filter((w) => w.length > 1);
    const matchedArtistTokens = aTokens.filter((w) => caTokens.includes(w));
    const isArtistMatch =
      cA.includes(tA) ||
      tA.includes(cA) ||
      (aTokens.length > 0 && matchedArtistTokens.length > 0);

    return isTitleMatch && isArtistMatch;
  }

  return isTitleMatch;
}

export async function searchLyricsCandidates(query: string): Promise<LyricsResult[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const candidates: any[] = await res.json();
      if (Array.isArray(candidates)) {
        return candidates
          .filter((c) => c && (c.syncedLyrics || c.plainLyrics || c.instrumental))
          .map(parseCandidate);
      }
    }
  } catch {}
  return [];
}

// Fetch lyrics from LRCLIB API with smart fallback search and YouTube Music fallback
export async function getTrackLyrics(
  title: string,
  artist: string,
  durationSec?: number,
  sourceId?: string
): Promise<LyricsResult | null> {
  const { title: resolvedTitle, artist: resolvedArtist } = extractArtistAndTitle(title, artist);
  const cacheKey = `${resolvedTitle.toLowerCase()}___${resolvedArtist.toLowerCase()}`;

  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey) || null;
  }

  try {
    // 1. Try exact match endpoint on LRCLIB if we have artist
    if (resolvedArtist) {
      if (durationSec && durationSec > 0) {
        const getParamsWithDur = new URLSearchParams({
          track_name: resolvedTitle,
          artist_name: resolvedArtist,
          duration: Math.round(durationSec).toString(),
        });
        try {
          const res = await fetch(`https://lrclib.net/api/get?${getParamsWithDur.toString()}`);
          if (res.ok) {
            const data = await res.json();
            const result = parseCandidate(data);
            lyricsCache.set(cacheKey, result);
            return result;
          }
        } catch {}
      }

      // Fallback exact match without duration constraint
      const getParams = new URLSearchParams({
        track_name: resolvedTitle,
        artist_name: resolvedArtist,
      });

      try {
        const res = await fetch(`https://lrclib.net/api/get?${getParams.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const result = parseCandidate(data);
          lyricsCache.set(cacheKey, result);
          return result;
        }
      } catch {}
    }

    // 2. Search LRCLIB with "Title Artist"
    const searchQueries = [
      `${resolvedTitle} ${resolvedArtist}`.trim(),
      resolvedTitle,
      cleanTitle(title),
    ].filter((q, idx, arr) => q.length > 0 && arr.indexOf(q) === idx);

    for (const query of searchQueries) {
      try {
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
        const res = await fetch(searchUrl);
        if (res.ok) {
          const candidates: any[] = await res.json();
          if (Array.isArray(candidates) && candidates.length > 0) {
            // Filter candidates to ensure they actually match the requested song
            const matchingCandidates = candidates.filter((c) =>
              isCandidateMatch(resolvedTitle, resolvedArtist, c.trackName, c.artistName)
            );

            if (matchingCandidates.length > 0) {
              const best =
                matchingCandidates.find((c) => c.syncedLyrics) ||
                matchingCandidates.find((c) => c.plainLyrics) ||
                matchingCandidates[0];

              if (best && (best.syncedLyrics || best.plainLyrics || best.instrumental)) {
                const result = parseCandidate(best);
                lyricsCache.set(cacheKey, result);
                return result;
              }
            }
          }
        }
      } catch {}
    }

    // 3. Fallback: YouTube Music Lyrics if videoId / sourceId exists
    const cleanId = sourceId?.replace(/^(yt-|sc-|dm-yt-\d+-|dm-sc-\d+-|dm-)/, '');
    if (cleanId) {
      let ytLyricsText: string | undefined;

      if (window.electronAPI?.getLyrics) {
        try {
          ytLyricsText = await window.electronAPI.getLyrics(cleanId);
        } catch {}
      } else {
        try {
          const res = await fetch(`/api/music/lyrics?videoId=${encodeURIComponent(cleanId)}`);
          if (res.ok) {
            const data = await res.json();
            ytLyricsText = data.lyrics;
          }
        } catch {}
      }

      if (ytLyricsText && ytLyricsText.trim()) {
        const result: LyricsResult = {
          trackName: resolvedTitle,
          artistName: resolvedArtist,
          instrumental: false,
          plainLyrics: ytLyricsText.trim(),
        };
        lyricsCache.set(cacheKey, result);
        return result;
      }
    }

    lyricsCache.set(cacheKey, null);
    return null;
  } catch (err) {
    console.warn('[Lyrics] Fetch failed:', err);
    return null;
  }
}
