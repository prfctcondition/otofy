import repo from '../db/repository';

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
  isCustom?: boolean;
}

// In-memory cache for fast repeated lookups
const lyricsCache = new Map<string, LyricsResult | null>();

export function getCustomLyricsKey(title: string, artist: string): string {
  const { title: cleanT, artist: cleanA } = extractArtistAndTitle(title, artist);
  return `${cleanT.toLowerCase().trim()}___${cleanA.toLowerCase().trim()}`;
}

export function getSavedCustomLyricsSync(title: string, artist: string, trackId?: string): LyricsResult | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const key = getCustomLyricsKey(title, artist);
  try {
    const raw =
      localStorage.getItem(`otofy_custom_lyrics_${key}`) ||
      (trackId ? localStorage.getItem(`otofy_custom_lyrics_id_${trackId}`) : null);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.syncedLyrics || parsed.plainLyrics || parsed.instrumental)) {
        if (!parsed.parsedLines && parsed.syncedLyrics) {
          parsed.parsedLines = parseLrc(parsed.syncedLyrics);
        }
        parsed.isCustom = true;
        return parsed as LyricsResult;
      }
    }
  } catch {}
  return null;
}

export async function getSavedCustomLyrics(title: string, artist: string, trackId?: string): Promise<LyricsResult | null> {
  const syncHit = getSavedCustomLyricsSync(title, artist, trackId);
  if (syncHit) return syncHit;

  const key = getCustomLyricsKey(title, artist);
  try {
    const dbRaw = await repo.getSetting(`custom_lyrics_${key}`);
    if (dbRaw) {
      const parsed = JSON.parse(dbRaw);
      if (parsed && (parsed.syncedLyrics || parsed.plainLyrics || parsed.instrumental)) {
        if (!parsed.parsedLines && parsed.syncedLyrics) {
          parsed.parsedLines = parseLrc(parsed.syncedLyrics);
        }
        parsed.isCustom = true;
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(`otofy_custom_lyrics_${key}`, dbRaw);
          if (trackId) {
            localStorage.setItem(`otofy_custom_lyrics_id_${trackId}`, dbRaw);
          }
        }
        return parsed as LyricsResult;
      }
    }
  } catch {}
  return null;
}

export async function saveCustomLyrics(
  track: { title: string; artist: string; id?: string; sourceId?: string },
  lyrics: LyricsResult
): Promise<void> {
  const key = getCustomLyricsKey(track.title, track.artist);
  const toSave: LyricsResult = {
    ...lyrics,
    isCustom: true,
    trackName: track.title,
    artistName: track.artist,
  };
  if (!toSave.parsedLines && toSave.syncedLyrics) {
    toSave.parsedLines = parseLrc(toSave.syncedLyrics);
  }

  lyricsCache.set(key, toSave);
  const serialized = JSON.stringify(toSave);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(`otofy_custom_lyrics_${key}`, serialized);
      const targetId = track.sourceId || track.id;
      if (targetId) {
        localStorage.setItem(`otofy_custom_lyrics_id_${targetId}`, serialized);
      }
    } catch {}
  }

  try {
    await repo.setSetting(`custom_lyrics_${key}`, serialized);
  } catch {}
}

export async function removeCustomLyrics(
  track: { title: string; artist: string; id?: string; sourceId?: string }
): Promise<void> {
  const key = getCustomLyricsKey(track.title, track.artist);
  lyricsCache.delete(key);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.removeItem(`otofy_custom_lyrics_${key}`);
      const targetId = track.sourceId || track.id;
      if (targetId) {
        localStorage.removeItem(`otofy_custom_lyrics_id_${targetId}`);
      }
    } catch {}
  }

  try {
    await repo.setSetting(`custom_lyrics_${key}`, '');
  } catch {}
}

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

async function fetchLrclibWithRetry(url: string, maxRetries = 3): Promise<Response | null> {
  const delays = [500, 1200, 2500];
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Otofy-Music/1.1.9 (https://github.com/eyez/zen-music)',
        },
      });

      if (res.status === 429 || res.status === 503) {
        if (attempt === maxRetries) {
          console.warn('[LRCLIB] Rate limit exceeded after retries:', res.status);
          return null;
        }
        const retryHeader = res.headers.get('Retry-After');
        let delayMs = delays[attempt] || 2000;
        if (retryHeader) {
          const parsedSec = parseFloat(retryHeader);
          if (!isNaN(parsedSec) && parsedSec > 0) {
            delayMs = Math.round(parsedSec / 0.001);
          }
        }
        const jitter = Math.floor(Math.random() / 0.005);
        await new Promise((resolve) => setTimeout(resolve, delayMs + jitter));
        attempt++;
        continue;
      }

      if (res.status === 404) {
        return null;
      }

      return res;
    } catch (err) {
      if (attempt === maxRetries) return null;
      const delayMs = delays[attempt] || 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      attempt++;
    }
  }
  return null;
}

export async function searchLyricsCandidates(query: string): Promise<LyricsResult[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetchLrclibWithRetry(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`);
    if (res && res.ok) {
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

function rankLyricsCandidates(candidates: any[], durationSec?: number): any[] {
  return [...candidates].sort((a, b) => {
    // 1. Synced lyrics have highest priority
    const hasSyncA = Boolean(a.syncedLyrics);
    const hasSyncB = Boolean(b.syncedLyrics);
    if (hasSyncA !== hasSyncB) {
      return hasSyncA ? -1 : 1;
    }

    // 2. Select closest duration match
    if (durationSec && durationSec > 0) {
      const durA = typeof a.duration === 'number' && a.duration > 0 ? a.duration : 0;
      const durB = typeof b.duration === 'number' && b.duration > 0 ? b.duration : 0;
      if (durA > 0 && durB > 0) {
        const diffA = Math.abs(durA - durationSec);
        const diffB = Math.abs(durB - durationSec);
        if (Math.abs(diffA - diffB) > 1.5) {
          return diffA - diffB;
        }
      }
    }

    // 3. Plain lyrics over instrumental
    const hasPlainA = Boolean(a.plainLyrics);
    const hasPlainB = Boolean(b.plainLyrics);
    if (hasPlainA !== hasPlainB) {
      return hasPlainA ? -1 : 1;
    }

    return 0;
  });
}

// Fetch lyrics from LRCLIB API with smart fallback search and YouTube Music fallback
export async function getTrackLyrics(
  title: string,
  artist: string,
  durationSec?: number,
  sourceId?: string,
  trackId?: string
): Promise<LyricsResult | null> {
  // 0. Check custom / user-saved lyrics first
  const custom = await getSavedCustomLyrics(title, artist, trackId || sourceId);
  if (custom) {
    const key = getCustomLyricsKey(title, artist);
    lyricsCache.set(key, custom);
    return custom;
  }

  const { title: resolvedTitle, artist: resolvedArtist } = extractArtistAndTitle(title, artist);
  const cacheKey = `${resolvedTitle.toLowerCase()}___${resolvedArtist.toLowerCase()}`;

  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey) || null;
  }

  try {
    let plainFallbackResult: LyricsResult | null = null;

    // 1. Try exact match endpoint on LRCLIB if we have artist
    if (resolvedArtist) {
      if (durationSec && durationSec > 0) {
        const getParamsWithDur = new URLSearchParams({
          track_name: resolvedTitle,
          artist_name: resolvedArtist,
          duration: Math.round(durationSec).toString(),
        });
        try {
          const res = await fetchLrclibWithRetry(`https://lrclib.net/api/get?${getParamsWithDur.toString()}`);
          if (res && res.ok) {
            const data = await res.json();
            const result = parseCandidate(data);
            if (result.syncedLyrics) {
              lyricsCache.set(cacheKey, result);
              return result;
            }
            if (result.plainLyrics) {
              plainFallbackResult = result;
            }
          }
        } catch {}
      }

      // Fallback exact match without duration constraint
      if (!plainFallbackResult) {
        const getParams = new URLSearchParams({
          track_name: resolvedTitle,
          artist_name: resolvedArtist,
        });

        try {
          const res = await fetchLrclibWithRetry(`https://lrclib.net/api/get?${getParams.toString()}`);
          if (res && res.ok) {
            const data = await res.json();
            const result = parseCandidate(data);
            if (result.syncedLyrics) {
              lyricsCache.set(cacheKey, result);
              return result;
            }
            if (result.plainLyrics) {
              plainFallbackResult = result;
            }
          }
        } catch {}
      }
    }

    // 2. Search LRCLIB: Format query strictly as: Artist Track (without hyphens or dashes)
    const cleanNoDashes = (str: string) => str.replace(/[-–—_]/g, ' ').replace(/\s+/g, ' ').trim();
    const cleanArt = cleanNoDashes(resolvedArtist);
    const cleanTit = cleanNoDashes(resolvedTitle);
    const cleanFull = cleanNoDashes(title);

    const searchQueries = [
      cleanArt ? `${cleanArt} ${cleanTit}`.trim() : cleanTit,
      cleanTit,
      cleanFull,
    ].filter((q, idx, arr) => q.length > 0 && arr.indexOf(q) === idx);

    for (const query of searchQueries) {
      try {
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
        const res = await fetchLrclibWithRetry(searchUrl);
        if (res && res.ok) {
          const candidates: any[] = await res.json();
          if (Array.isArray(candidates) && candidates.length > 0) {
            const matchingCandidates = candidates.filter((c) =>
              isCandidateMatch(resolvedTitle, resolvedArtist, c.trackName, c.artistName)
            );

            if (matchingCandidates.length > 0) {
              const ranked = rankLyricsCandidates(matchingCandidates, durationSec);
              const best = ranked[0];

              if (best && best.syncedLyrics) {
                const result = parseCandidate(best);
                lyricsCache.set(cacheKey, result);
                return result;
              }

              if (!plainFallbackResult && best && (best.plainLyrics || best.instrumental)) {
                plainFallbackResult = parseCandidate(best);
              }
            }
          }
        }
      } catch {}
    }

    // If we found a plain text match during search or exact match, use it now
    if (plainFallbackResult) {
      lyricsCache.set(cacheKey, plainFallbackResult);
      return plainFallbackResult;
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
          if (res && res.ok) {
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
