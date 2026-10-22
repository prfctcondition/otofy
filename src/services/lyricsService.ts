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
  cleaned = cleaned.replace(/\s{1,}(feat\.?|ft\.?|featuring)\s{1,}.+$/i, '');
  return cleaned.replace(/\s+/g, ' ').trim();
}

// Clean track title by removing noise like (Official Music Video), ft., etc.
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

  // 6. Remove trailing remaster, live, mix, and edition phrases
  cleaned = cleaned.replace(/\s{0,}[-–—|/]?\s{0,}(\d{4}\s+)?remaster(ed)?(\s+(version|edition|mix))?\s{0,}$/gi, '');
  cleaned = cleaned.replace(/\s{0,}[-–—|/]?\s{0,}(radio\s+edit|club\s+mix|extended\s+mix|acoustic\s+version|deluxe\s+edition)\s{0,}$/gi, '');
  cleaned = cleaned.replace(/\s{0,}[-–—|/]?\s{0,}live(\s+at\s+[^–—|/]+)?\s{0,}$/gi, '');

  // 7. Remove Topic and Vevo suffixes from title if present
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

  // If title has "Artist - Song Title" or "Song Title - Remaster", handle intelligently
  const separators = [' - ', ' – ', ' — '];
  for (const sep of separators) {
    if (title.includes(sep)) {
      const parts = title.split(sep);
      if (parts.length >= 2) {
        if (!artist) {
          artist = cleanArtist(parts[0]);
          title = cleanTitle(parts.slice(1).join(sep));
          break;
        } else {
          const p0 = cleanArtist(parts[0]).toLowerCase();
          const art = artist.toLowerCase();
          if (p0 === art || art.includes(p0) || p0.includes(art)) {
            title = cleanTitle(parts.slice(1).join(sep));
          } else {
            // Artist is already known and p0 is not artist: parts[0] is the song title!
            title = cleanTitle(parts[0]);
          }
          break;
        }
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
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[i + 1];
    sorted[i].endTime = next ? next.time : sorted[i].time + 3.8;
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

const cyrToLatMap: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};

function transliterate(str: string): string {
  return (str || '').toLowerCase().split('').map((ch) => cyrToLatMap[ch] || ch).join('');
}

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

  const tTTrans = transliterate(tT);
  const cTTrans = transliterate(cT);

  const tTokens = tTTrans.split(' ').filter((w) => w.length > 1);
  const cTokens = cTTrans.split(' ').filter((w) => w.length > 1);
  const matchedTokens = tTokens.filter((w) => cTokens.includes(w));
  const overlapRatio = tTokens.length > 0 ? matchedTokens.length / tTokens.length : 0;
  const candOverlapRatio = cTokens.length > 0 ? matchedTokens.length / cTokens.length : 0;

  const isTitleMatch =
    cT.includes(tT) ||
    tT.includes(cT) ||
    cTTrans.includes(tTTrans) ||
    tTTrans.includes(cTTrans) ||
    overlapRatio >= 0.5 ||
    candOverlapRatio >= 0.5;

  if (!isTitleMatch) return false;

  if (tA && cA) {
    const tATrans = transliterate(tA);
    const cATrans = transliterate(cA);

    const aTokens = tATrans.split(' ').filter((w) => w.length > 1);
    const caTokens = cATrans.split(' ').filter((w) => w.length > 1);
    const matchedArtistTokens = aTokens.filter((w) => caTokens.includes(w));
    const isArtistMatch =
      cA.includes(tA) ||
      tA.includes(cA) ||
      cATrans.includes(tATrans) ||
      tATrans.includes(cATrans) ||
      (aTokens.length > 0 && matchedArtistTokens.length > 0);

    return isArtistMatch;
  }

  return isTitleMatch;
}

async function fetchLrclibWithRetry(
  url: string,
  maxRetries = 1,
  timeoutMs = 2400
): Promise<Response | null> {
  const delays = [60, 150];
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Otofy-Music/1.2.5 (https://github.com/eyez/zen-music)',
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
    const scoreA = getCandidateScore(a);
    const scoreB = getCandidateScore(b);
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }

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

// Fetch word-by-word synced lyrics from the official free lrc.red service
export async function fetchLrcRedLyrics(
  title: string,
  artist: string,
  durationSec?: number
): Promise<LyricsResult | null> {
  if (!title) return null;
  const cleanT = cleanTitle(title);
  const cleanA = cleanArtist(artist);
  const matchUrl = `https://lrc.red/match.json?title=${encodeURIComponent(cleanT)}&artist=${encodeURIComponent(cleanA)}`;

  try {
    let matchingHits: any[] = [];

    // 1. Try exact match.json first
    try {
      const res = await fetch(matchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(2400),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.hits)) {
          matchingHits = data.hits.filter((h: any) =>
            isCandidateMatch(cleanT, cleanA, h.title || '', h.artist || '')
          );
        }
      }
    } catch {}

    // 2. If match.json returned nothing, try search.json with Artist Title query
    if (matchingHits.length === 0) {
      try {
        const query = cleanA ? `${cleanA} ${cleanT}`.trim() : cleanT;
        const searchUrl = `https://lrc.red/search.json?q=${encodeURIComponent(query)}`;
        const res = await fetch(searchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal: AbortSignal.timeout(2400),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.hits)) {
            matchingHits = data.hits.filter((h: any) =>
              isCandidateMatch(cleanT, cleanA, h.title || '', h.artist || '')
            );
          }
        }
      } catch {}
    }

    if (matchingHits.length === 0) return null;

    let bestHit = matchingHits[0];
    if (durationSec && durationSec > 0) {
      bestHit = matchingHits.reduce((prev: any, cur: any) => {
        if (!prev.duration) return cur;
        if (!cur.duration) return prev;
        const diffP = Math.abs(prev.duration - durationSec);
        const diffC = Math.abs(cur.duration - durationSec);
        return diffC < diffP ? cur : prev;
      }, bestHit);
    }

    if (!bestHit || !bestHit.isrc) return null;

    const songUrl = `https://lrc.red/s/${encodeURIComponent(bestHit.isrc)}.song.json`;
    const songRes = await fetch(songUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(2800),
    });
    if (!songRes.ok) return null;
    const songData = await songRes.json();
    if (!songData || !songData.lyrics || !Array.isArray(songData.lyrics.lines)) return null;

    const rawLines = songData.lyrics.lines;
    const isWordSync = songData.lyrics.sync === 'word';
    const parsedLines: LrcLine[] = [];

    for (const line of rawLines) {
      if (typeof line.begin !== 'number' || !line.text) continue;
      const lineWords: LrcWord[] = [];

      if (isWordSync && Array.isArray(line.words)) {
        for (const group of line.words) {
          if (Array.isArray(group)) {
            const syllables = group.filter((s: any) => s && typeof s.text === 'string' && typeof s.begin === 'number');
            if (syllables.length === 0) continue;
            const fullWordText = syllables.map((s: any) => s.text).join('').trim();
            if (!fullWordText) continue;
            const wBegin = syllables[0].begin;
            const lastSyl = syllables[syllables.length - 1];
            const wEnd = typeof lastSyl.end === 'number' ? lastSyl.end : (typeof syllables[0].end === 'number' ? syllables[0].end : wBegin + 0.35);
            lineWords.push({
              text: fullWordText,
              begin: wBegin,
              end: Math.max(wBegin + 0.05, wEnd),
            });
          } else if (group && group.text && typeof group.begin === 'number') {
            const wBegin = group.begin;
            const wEnd = typeof group.end === 'number' ? group.end : wBegin + 0.35;
            lineWords.push({
              text: group.text.trim(),
              begin: wBegin,
              end: Math.max(wBegin + 0.05, wEnd),
            });
          }
        }
      }

      parsedLines.push({
        time: line.begin,
        endTime: typeof line.end === 'number' ? line.end : line.begin + 3.5,
        text: line.text.trim(),
        words: lineWords.length > 0 ? lineWords : undefined,
      });
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
      trackName: songData.title || bestHit.title || cleanT,
      artistName: songData.artist || bestHit.artist || cleanA,
      duration: songData.duration || bestHit.duration,
      instrumental: false,
      syncedLyrics: lrcLines.join('\n'),
      plainLyrics: parsedLines.map((l) => l.text).join('\n'),
      parsedLines,
      hasWordSync: isWordSync,
    };
  } catch {
    return null;
  }
}

// Fetch lyrics using lrc.red word sync, LRCLIB multi-tier search, and YouTube Music fallback
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

    // Fast parallel execution: lrc.red word sync and LRCLIB exact match
    const lrcRedPromise = fetchLrcRedLyrics(resolvedTitle, resolvedArtist, durationSec);

    const lrclibExactPromise = (async (): Promise<LyricsResult | null> => {
      if (!resolvedArtist) return null;
      if (durationSec && durationSec > 0) {
        const getParamsWithDur = new URLSearchParams({
          track_name: resolvedTitle,
          artist_name: resolvedArtist,
          duration: Math.round(durationSec).toString(),
        });
        try {
          const res = await fetchLrclibWithRetry(`https://lrclib.net/api/get?${getParamsWithDur.toString()}`, 1, 2400);
          if (res && res.ok) {
            const data = await res.json();
            return parseCandidate(data);
          }
        } catch {}
      }

      const getParams = new URLSearchParams({
        track_name: resolvedTitle,
        artist_name: resolvedArtist,
      });
      try {
        const res = await fetchLrclibWithRetry(`https://lrclib.net/api/get?${getParams.toString()}`, 1, 2400);
        if (res && res.ok) {
          const data = await res.json();
          return parseCandidate(data);
        }
      } catch {}
      return null;
    })();

    const [lrcRedResult, lrclibExactResult] = await Promise.all([
      lrcRedPromise.catch(() => null),
      lrclibExactPromise.catch(() => null),
    ]);

    // Priority 1: Genuine word-by-word synced lyrics from lrc.red
    if (lrcRedResult?.hasWordSync && lrcRedResult.syncedLyrics) {
      lyricsCache.set(cacheKey, lrcRedResult);
      return lrcRedResult;
    }

    // Priority 2: LRCLIB exact match synced lyrics
    if (lrclibExactResult?.syncedLyrics) {
      lyricsCache.set(cacheKey, lrclibExactResult);
      return lrclibExactResult;
    }

    // Priority 3: Line-synced lyrics from lrc.red
    if (lrcRedResult?.syncedLyrics) {
      lyricsCache.set(cacheKey, lrcRedResult);
      return lrcRedResult;
    }

    if (lrclibExactResult?.plainLyrics || lrclibExactResult?.instrumental) {
      plainFallbackResult = lrclibExactResult;
    }

    // Priority 4: LRCLIB Multi-Query Search Loop
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
        const res = await fetchLrclibWithRetry(searchUrl, 1, 2400);
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

    if (plainFallbackResult) {
      lyricsCache.set(cacheKey, plainFallbackResult);
      return plainFallbackResult;
    }

    // Priority 5: Fallback: YouTube Music Lyrics if videoId / sourceId exists
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
