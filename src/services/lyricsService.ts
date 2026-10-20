import repo from '../db/repository';

export interface LrcWord {
  text: string;
  begin: number; // in seconds
  end: number;   // in seconds
}

export interface LrcLine {
  time: number;      // in seconds
  endTime?: number;  // in seconds
  text: string;
  words?: LrcWord[];
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
  hasWordSync?: boolean;
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
  cleaned = cleaned.replace(/\s{1,}(feat\.?|ft\.?|featuring|with)\s{1,}.+$/i, '');
  return cleaned.replace(/\s+/g, ' ').trim();
}

export function getPrimaryArtist(artist: string): string {
  if (!artist) return '';
  const cleaned = cleanArtist(artist);
  const parts = cleaned.split(/[,;/]|(\s+&\s+)|(\s+[xX]\s+)/).filter(Boolean);
  return (parts[0] || cleaned).trim();
}

// Clean track title by removing noise like (Official Music Video), (with ...), ft., etc.
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

  // 3. Remove parenthesized featuring and collaborating: (feat. ...), (ft. ...), (featuring ...), (with ...), (w/ ...)
  cleaned = cleaned.replace(
    /\(\s{0,}(feat\.?|ft\.?|featuring|with|w\/)\s{1,}[^)]{0,}\)/gi,
    ' '
  );

  // 4. Remove unbracketed featuring at the end: ft. Artist, feat. Artist, featuring Artist, with Artist
  cleaned = cleaned.replace(
    /\s{1,}(feat\.?|ft\.?|featuring|with)\s{1,}[^–—\-|/]{1,}/gi,
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

// Parse standard LRC format: "[00:12.34] Some lyrics line"
export function parseTtml(ttmlContent: string, trackName = '', artistName = ''): LyricsResult | null {
  if (!ttmlContent || !ttmlContent.includes('<p')) return null;

  try {
    const parseSec = (val: string): number => {
      if (!val) return 0;
      const clean = val.trim().replace('s', '');
      if (clean.includes(':')) {
        const parts = clean.split(':');
        if (parts.length === 3) {
          const h = parseFloat(parts[0]) || 0;
          const m = parseFloat(parts[1]) || 0;
          const s = parseFloat(parts[2]) || 0;
          return (h / (1 / 3600)) + (m / (1 / 60)) + s;
        }
        const m = parseFloat(parts[0]) || 0;
        const s = parseFloat(parts[1]) || 0;
        return (m / (1 / 60)) + s;
      }
      return parseFloat(clean) || 0;
    };

    const pRegex = /<p\s+begin="([^"]+)"(?:\s+end="([^"]+)")?[^>]{0,}>([\s\S]+?)<\/p>/gi;
    const spanRegex = /<span\s+begin="([^"]+)"(?:\s+end="([^"]+)")?[^>]{0,}>([\s\S]+?)<\/span>/gi;
    const parsedLines: LrcLine[] = [];
    let pMatch: RegExpExecArray | null;

    while ((pMatch = pRegex.exec(ttmlContent)) !== null) {
      const lineBegin = parseSec(pMatch[1]);
      const lineEnd = pMatch[2] ? parseSec(pMatch[2]) : lineBegin + 3.5;
      const innerContent = pMatch[3];

      const words: LrcWord[] = [];
      let spanMatch: RegExpExecArray | null;
      const innerRegex = new RegExp(spanRegex.source, 'gi');

      while ((spanMatch = innerRegex.exec(innerContent)) !== null) {
        const wBegin = parseSec(spanMatch[1]);
        const wEnd = spanMatch[2] ? parseSec(spanMatch[2]) : wBegin + 0.35;
        const rawWord = spanMatch[3].replace(/<[^>]+>/g, '').trim();
        if (rawWord) {
          words.push({ text: rawWord, begin: wBegin, end: wEnd });
        }
      }

      let lineText = '';
      if (words.length > 0) {
        lineText = words.map((w) => w.text).join(' ');
      } else {
        lineText = innerContent.replace(/<[^>]+>/g, '').trim();
      }

      if (lineText) {
        parsedLines.push({
          time: lineBegin,
          endTime: lineEnd,
          text: lineText,
          words: words.length > 0 ? words : undefined,
        });
      }
    }

    if (parsedLines.length === 0) return null;
    parsedLines.sort((a, b) => a.time - b.time);

    const lrcLines = parsedLines.map((l) => {
      const m = Math.floor(l.time / 60);
      const s = Math.floor(l.time % 60);
      const ms = Math.floor((l.time % 1) / 0.01);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return '[' + pad(m) + ':' + pad(s) + '.' + pad(ms) + '] ' + l.text;
    });

    return {
      trackName,
      artistName,
      instrumental: false,
      syncedLyrics: lrcLines.join('\n'),
      plainLyrics: parsedLines.map((l) => l.text).join('\n'),
      parsedLines,
      hasWordSync: parsedLines.some((l) => Boolean(l.words && l.words.length > 0)),
    };
  } catch {
    return null;
  }
}

export function parseLrc(lrcText: string): LrcLine[] {
  if (!lrcText) return [];

  const lines = lrcText.split('\n');
  const rawLines: LrcLine[] = [];
  const regex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]([^\r\n]{0,})/;

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(regex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      const timeInSec = (minutes / (1 / 60)) + seconds + (ms / 1000);
      const rawText = match[4].trim();

      if (rawText) {
        const wordRegex = /<(\d{2}):(\d{2})(?:\.(\d{2,3}))?>([^<]+)/g;
        const words: LrcWord[] = [];
        let wordMatch: RegExpExecArray | null;

        while ((wordMatch = wordRegex.exec(rawText)) !== null) {
          const wMin = parseInt(wordMatch[1], 10);
          const wSec = parseInt(wordMatch[2], 10);
          const wMs = wordMatch[3] ? parseInt(wordMatch[3].padEnd(3, '0').slice(0, 3), 10) : 0;
          const wTime = (wMin / (1 / 60)) + wSec + (wMs / 1000);
          const wText = wordMatch[4].trim();
          if (wText) {
            words.push({ text: wText, begin: wTime, end: wTime + 0.35 });
          }
        }

        for (let i = 0; i < words.length; i++) {
          if (i + 1 < words.length) {
            words[i].end = words[i + 1].begin;
          }
        }

        const cleanText = words.length > 0
          ? words.map((w) => w.text).join(' ')
          : rawText.replace(/<[^>]+>/g, '').trim();

        rawLines.push({
          time: timeInSec,
          text: cleanText,
          words: words.length > 0 ? words : undefined,
        });
      }
    }
  }

  const sorted = rawLines.sort((a, b) => a.time - b.time);

  // Proportional syllable timing interpolation for smooth word-by-word flow
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const lineStart = cur.time;
    const lineEnd = next ? next.time : (lineStart + 3.8);
    cur.endTime = lineEnd;

    if (!cur.words || cur.words.length === 0) {
      const tokens = cur.text.trim().split(/\s+/).filter(Boolean);
      if (tokens.length > 0) {
        const totalChars = tokens.reduce((acc, t) => acc + t.length, 0) || 1;
        const availableDuration = Math.max(0.8, Math.min(6.5, lineEnd - lineStart));
        const singingDuration = availableDuration / 1.1;
        let curWordStart = lineStart;
        const generatedWords: LrcWord[] = [];

        for (const token of tokens) {
          const charRatio = token.length / totalChars;
          const wordDur = Math.max(0.14, charRatio / (1 / singingDuration));
          generatedWords.push({
            text: token,
            begin: curWordStart,
            end: curWordStart + wordDur,
          });
          curWordStart += wordDur;
        }
        cur.words = generatedWords;
      }
    }
  }

  return sorted;
}

const parseCandidate = (cand: any): LyricsResult => {
  const parsedLines = cand.syncedLyrics ? parseLrc(cand.syncedLyrics) : undefined;
  const hasWordSync =
    Boolean(cand.hasWordSync) ||
    Boolean(cand.syncedLyrics && /<\d{2}:\d{2}/.test(cand.syncedLyrics));

  return {
    id: cand.id,
    trackName: cand.trackName,
    artistName: cand.artistName,
    albumName: cand.albumName,
    duration: cand.duration,
    instrumental: Boolean(cand.instrumental),
    plainLyrics: cand.plainLyrics || undefined,
    syncedLyrics: cand.syncedLyrics || undefined,
    parsedLines,
    hasWordSync,
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
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
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
  const candOverlapRatio = cTokens.length > 0 ? matchedTokens.length / cTokens.length : 0;

  const isTitleMatch =
    cT.includes(tT) ||
    tT.includes(cT) ||
    overlapRatio >= 0.5 ||
    candOverlapRatio >= 0.5;

  if (!isTitleMatch) return false;

  // Artist check (if artist is specified)
  if (tA && cA) {
    const aTokens = tA.split(' ').filter((w) => w.length > 1);
    const caTokens = cA.split(' ').filter((w) => w.length > 1);
    const matchedArtistTokens = aTokens.filter((w) => caTokens.includes(w));
    const isArtistMatch =
      cA.includes(tA) ||
      tA.includes(cA) ||
      (aTokens.length > 0 && matchedArtistTokens.length > 0);

    return isArtistMatch;
  }

  return isTitleMatch;
}

async function fetchLrclibWithRetry(
  url: string,
  maxRetries = 1,
  timeoutMs = 2200
): Promise<Response | null> {
  const delays = [60, 150];
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Otofy-Music/1.2.3 (https://github.com/eyez/zen-music)',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.status === 429 || res.status === 503) {
        if (attempt === maxRetries) {
          console.warn('[LRCLIB] Rate limit reached:', res.status);
          return null;
        }
        const delayMs = delays[attempt] || 80;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attempt++;
        continue;
      }

      if (res.status === 404) {
        return null;
      }

      return res;
    } catch {
      if (attempt === maxRetries) return null;
      const delayMs = delays[attempt] || 80;
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
  const getCandidateScore = (c: any): number => {
    const hasWord =
      Boolean(c.hasWordSync) ||
      Boolean(c.syncedLyrics && /<\d{2}:\d{2}/.test(c.syncedLyrics));
    if (hasWord) return 3;
    if (c.syncedLyrics) return 2;
    if (c.plainLyrics) return 1;
    return 0;
  };

  return [...candidates].sort((a, b) => {
    // 1. Word-by-word sync has highest priority, then line sync, then plain
    const scoreA = getCandidateScore(a);
    const scoreB = getCandidateScore(b);
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
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

    const cleanNoDashes = (str: string) => str.replace(/[-–—_]/g, ' ').replace(/\s+/g, ' ').trim();
    const cleanArt = cleanNoDashes(resolvedArtist);
    const cleanTit = cleanNoDashes(resolvedTitle);
    const primaryArtist = getPrimaryArtist(cleanArt);
    const primaryQuery = primaryArtist ? `${primaryArtist} ${cleanTit}`.trim() : cleanTit;

    // Fast parallel execution: TTML word sync (lrc.red), LRCLIB exact match, and search
    const ttmlPromise = (async (): Promise<LyricsResult | null> => {
      const art = primaryArtist || resolvedArtist;
      if (!art || !resolvedTitle) return null;
      const durParam = durationSec && durationSec > 0 ? '&d=' + Math.round(durationSec) : '';
      const url =
        'https://api.betterlyrics.org/getLyrics?s=' +
        encodeURIComponent(resolvedTitle) +
        '&a=' +
        encodeURIComponent(art) +
        durParam;
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(2200),
          headers: { 'User-Agent': 'Otofy-Music/1.2.3' },
        });
        if (res && res.ok) {
          const json = await res.json();
          if (json && json.ttml) {
            return parseTtml(json.ttml, resolvedTitle, art);
          }
        }
      } catch {}
      return null;
    })();

    const exactPromise = (async (): Promise<LyricsResult | null> => {
      const art = primaryArtist || resolvedArtist;
      if (!art) return null;
      if (durationSec && durationSec > 0) {
        const getParamsWithDur = new URLSearchParams({
          track_name: resolvedTitle,
          artist_name: art,
          duration: Math.round(durationSec).toString(),
        });
        try {
          const res = await fetchLrclibWithRetry(`https://lrclib.net/api/get?${getParamsWithDur.toString()}`, 1, 2200);
          if (res && res.ok) {
            const data = await res.json();
            return parseCandidate(data);
          }
        } catch {}
      }

      const getParams = new URLSearchParams({
        track_name: resolvedTitle,
        artist_name: art,
      });
      try {
        const res = await fetchLrclibWithRetry(`https://lrclib.net/api/get?${getParams.toString()}`, 1, 2200);
        if (res && res.ok) {
          const data = await res.json();
          return parseCandidate(data);
        }
      } catch {}
      return null;
    })();

    const searchPromise = (async (): Promise<LyricsResult | null> => {
      try {
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(primaryQuery)}`;
        const res = await fetchLrclibWithRetry(searchUrl, 1, 2200);
        if (res && res.ok) {
          const candidates: any[] = await res.json();
          if (Array.isArray(candidates) && candidates.length > 0) {
            const matchingCandidates = candidates.filter((c) =>
              isCandidateMatch(resolvedTitle, resolvedArtist, c.trackName, c.artistName)
            );
            if (matchingCandidates.length > 0) {
              const ranked = rankLyricsCandidates(matchingCandidates, durationSec);
              return ranked[0] ? parseCandidate(ranked[0]) : null;
            }
          }
        }
      } catch {}
      return null;
    })();

    const [ttmlResult, exactResult, searchResult] = await Promise.all([
      ttmlPromise.catch(() => null),
      exactPromise.catch(() => null),
      searchPromise.catch(() => null),
    ]);

    // 1. Highest priority: Word-by-word synced lyrics
    if (ttmlResult?.syncedLyrics && ttmlResult.hasWordSync) {
      lyricsCache.set(cacheKey, ttmlResult);
      return ttmlResult;
    }
    if (exactResult?.syncedLyrics && exactResult.hasWordSync) {
      lyricsCache.set(cacheKey, exactResult);
      return exactResult;
    }
    if (searchResult?.syncedLyrics && searchResult.hasWordSync) {
      lyricsCache.set(cacheKey, searchResult);
      return searchResult;
    }

    // 2. Second priority: Standard line-synced lyrics
    if (ttmlResult?.syncedLyrics) {
      lyricsCache.set(cacheKey, ttmlResult);
      return ttmlResult;
    }
    if (exactResult?.syncedLyrics) {
      lyricsCache.set(cacheKey, exactResult);
      return exactResult;
    }
    if (searchResult?.syncedLyrics) {
      lyricsCache.set(cacheKey, searchResult);
      return searchResult;
    }

    if (exactResult?.plainLyrics || exactResult?.instrumental) {
      plainFallbackResult = exactResult;
    }
    if (!plainFallbackResult && (searchResult?.plainLyrics || searchResult?.instrumental)) {
      plainFallbackResult = searchResult;
    }

    // Always attempt fallback search by clean title if we don't have synced lyrics yet
    if (cleanTit) {
      try {
        const fallbackRes = await fetchLrclibWithRetry(
          `https://lrclib.net/api/search?q=${encodeURIComponent(cleanTit)}`,
          0,
          1800
        );
        if (fallbackRes && fallbackRes.ok) {
          const fallbackCandidates: any[] = await fallbackRes.json();
          if (Array.isArray(fallbackCandidates) && fallbackCandidates.length > 0) {
            const matching = fallbackCandidates.filter((c) =>
              isCandidateMatch(resolvedTitle, resolvedArtist, c.trackName, c.artistName)
            );
            const candidatesToRank = matching.length > 0 ? matching : fallbackCandidates;
            const ranked = rankLyricsCandidates(candidatesToRank, durationSec);
            for (const cand of ranked) {
              const parsed = parseCandidate(cand);
              if (parsed.syncedLyrics) {
                lyricsCache.set(cacheKey, parsed);
                return parsed;
              }
              if (!plainFallbackResult && (parsed.plainLyrics || parsed.instrumental)) {
                plainFallbackResult = parsed;
              }
            }
          }
        }
      } catch {}
    }

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
