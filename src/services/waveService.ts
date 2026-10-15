import type { Track } from '../types';
import { apiSearchMusic, apiGetRelatedTracks, apiGetArtistDetails } from './musicApiService';

export function normalizeToTrack(raw: any, index: number = 0): Track {
  return {
    id: raw.id || `wave-${index}`,
    number: index + 1,
    title: raw.title || 'Unknown Title',
    artist: raw.artist || 'Unknown Artist',
    artists: Array.isArray(raw.artists) && raw.artists.length > 0 ? raw.artists : undefined,
    artistBrowseId: raw.artistBrowseId,
    artistBrowseIds: raw.artistBrowseIds,
    album: raw.album || 'Single',
    albumBrowseId: raw.albumBrowseId,
    duration: raw.duration || '3:00',
    durationSec: raw.durationSec || 180,
    views: raw.views,
    dateAdded: raw.dateAdded || 'Just now',
    source: (raw.source as any) || 'YT',
    sourceLabel: raw.sourceLabel || 'YouTube',
    iconName: 'waves',
    gradientFrom: '#4C1D95',
    gradientTo: '#142347',
    artworkUrl: raw.artworkUrl || '',
    sourceId: raw.sourceId || raw.id,
  };
}

const WAVE_CACHE_KEY = 'otofy_daily_wave_cache_v3';

// Arabic, Devanagari, Bengali, Gurmukhi-Malayalam, Thai, Lao, Myanmar, Khmer scripts
const UNEXPECTED_FOREIGN_SCRIPT_REGEX = /[\u0600-\u06FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0D7F\u0E00-\u0E7F\u0E80-\u0EFF\u1000-\u109F\u1780-\u17FF]/;
const NON_ARTIST_CHANNEL_PATTERN = /(:\s*official\b|\bofficial\s*channel\b|\breaction\b|\btutorial\b|\bkaraoke\b|\bfull\s*episode\b|\bpodcast\b|\bประกอบละคร\b)/i;

function isCleanWaveTrack(track: Track, seedHasForeignScript: boolean): boolean {
  if (!track || !track.title || !track.artist) return false;
  if (NON_ARTIST_CHANNEL_PATTERN.test(track.artist) || NON_ARTIST_CHANNEL_PATTERN.test(track.title)) {
    return false;
  }
  if (!seedHasForeignScript) {
    if (
      UNEXPECTED_FOREIGN_SCRIPT_REGEX.test(track.title) ||
      UNEXPECTED_FOREIGN_SCRIPT_REGEX.test(track.artist)
    ) {
      return false;
    }
  }
  return true;
}

export const WAVE_PLAYLIST_ID = 'view-my-wave';

interface WaveCache {
  date: string;
  artistsKey: string;
  tracks: Track[];
}

export function getCachedWave(favoriteArtists?: string[]): Track[] | null {
  try {
    localStorage.removeItem('otofy_daily_wave_cache_v2');
    const raw = localStorage.getItem(WAVE_CACHE_KEY);
    if (!raw) return null;
    const parsed: WaveCache = JSON.parse(raw);
    if (Array.isArray(parsed.tracks) && parsed.tracks.length > 0) {
      if (favoriteArtists && favoriteArtists.length > 0) {
        const currentArtistsKey = [...favoriteArtists].sort().join('|');
        if (parsed.artistsKey && parsed.artistsKey !== currentArtistsKey) {
          return null;
        }
      }
      return parsed.tracks;
    }
  } catch {}
  return null;
}

export function saveCachedWave(favoriteArtists: string[], tracks: Track[]) {
  try {
    const today = new Date().toDateString();
    const artistsKey = [...favoriteArtists].sort().join('|');
    const cache: WaveCache = {
      date: today,
      artistsKey,
      tracks,
    };
    localStorage.setItem(WAVE_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

export function saveCachedWaveTracks(tracks: Track[]) {
  try {
    const raw = localStorage.getItem(WAVE_CACHE_KEY);
    if (raw) {
      const parsed: WaveCache = JSON.parse(raw);
      parsed.tracks = tracks;
      localStorage.setItem(WAVE_CACHE_KEY, JSON.stringify(parsed));
      return;
    }
    const today = new Date().toDateString();
    const cache: WaveCache = {
      date: today,
      artistsKey: '',
      tracks,
    };
    localStorage.setItem(WAVE_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

export function removeTrackFromCachedWave(trackId: string): Track[] {
  try {
    const raw = localStorage.getItem(WAVE_CACHE_KEY);
    if (!raw) return [];
    const parsed: WaveCache = JSON.parse(raw);
    if (Array.isArray(parsed.tracks)) {
      parsed.tracks = parsed.tracks.filter((t) => t.id !== trackId && t.sourceId !== trackId);
      localStorage.setItem(WAVE_CACHE_KEY, JSON.stringify(parsed));
      return parsed.tracks;
    }
  } catch {}
  return [];
}

export function invalidateWaveCache() {
  try {
    localStorage.removeItem(WAVE_CACHE_KEY);
    localStorage.removeItem('otofy_daily_wave_cache_v2');
  } catch {}
}

export type WaveProgressCallback = (step: 'analyzing' | 'matching' | 'flow' | 'ready' | 'done', percent: number) => void;

export async function generateWaveTracks(
  favoriteArtists: string[],
  forceRefresh = false,
  onProgress?: WaveProgressCallback
): Promise<Track[]> {
  const artists = (favoriteArtists && favoriteArtists.length > 0)
    ? favoriteArtists
    : ['The Weeknd', 'Linkin Park', 'Kordhell'];

  if (!forceRefresh) {
    const cached = getCachedWave(artists);
    if (cached) {
      if (onProgress) {
        onProgress('done', 100);
      }
      return cached;
    }
  }

  if (onProgress) onProgress('analyzing', 20);

  const primaryArtists = [...artists];
  const primaryLowerSet = new Set(primaryArtists.map((a) => a.toLowerCase().trim()));
  const seedHasForeignScript = primaryArtists.some((a) => UNEXPECTED_FOREIGN_SCRIPT_REGEX.test(a));

  const primaryTopHits: Track[] = [];
  const primaryOtherTracks: Track[] = [];
  const relatedTracks: Track[] = [];
  const relatedArtistsMap = new Map<string, { name: string; channelId: string }>();

  // 1. Fetch official artist details (topTracks + official relatedArtists) for each favorite artist
  const artistDetailsResults = await Promise.allSettled(
    primaryArtists.map(async (artist) => {
      const details = await apiGetArtistDetails(artist);
      if (details && details.topTracks && details.topTracks.length > 0) {
        const cleanTop = details.topTracks.filter((t) => isCleanWaveTrack(t, seedHasForeignScript));
        // Guarantee top popular hit songs are never skipped
        const hits = cleanTop.slice(0, 6);
        const others = cleanTop.slice(6, 35).sort(() => 0.5 - Math.random()).slice(0, 14);
        return {
          artist,
          hits,
          others,
          relatedArtists: details.relatedArtists || [],
        };
      }

      // Fallback: search music strictly matching the artist name
      const searchResp = await apiSearchMusic(artist, 'YT');
      const results = (searchResp.results || []).filter((t) => isCleanWaveTrack(t, seedHasForeignScript));
      const artistTracks = results.filter(
        (t) =>
          t.artist.toLowerCase().includes(artist.toLowerCase()) ||
          artist.toLowerCase().includes(t.artist.toLowerCase())
      );
      return {
        artist,
        hits: artistTracks.slice(0, 4),
        others: artistTracks.slice(4, 15),
        relatedArtists: [] as Array<{ name: string; channelId: string }>,
      };
    })
  );

  if (onProgress) onProgress('matching', 55);

  for (const res of artistDetailsResults) {
    if (res.status === 'fulfilled') {
      primaryTopHits.push(...res.value.hits);
      primaryOtherTracks.push(...res.value.others);

      for (const rel of res.value.relatedArtists.slice(0, 3)) {
        const relKey = (rel.name || '').toLowerCase().trim();
        if (
          relKey &&
          rel.channelId &&
          rel.channelId.startsWith('UC') &&
          !primaryLowerSet.has(relKey) &&
          !NON_ARTIST_CHANNEL_PATTERN.test(rel.name) &&
          (seedHasForeignScript || !UNEXPECTED_FOREIGN_SCRIPT_REGEX.test(rel.name))
        ) {
          if (!relatedArtistsMap.has(relKey)) {
            relatedArtistsMap.set(relKey, { name: rel.name, channelId: rel.channelId });
          }
        }
      }
    }
  }

  if (onProgress) onProgress('flow', 80);

  // 2. Fetch official topTracks from only 2-3 official related artists to keep favorite artists dominant (75%+)
  const maxRelatedCount = primaryArtists.length === 1 ? 2 : 3;
  const discoveredRelated = Array.from(relatedArtistsMap.values())
    .sort(() => 0.5 - Math.random())
    .slice(0, maxRelatedCount);

  if (discoveredRelated.length > 0) {
    const relatedDetailsResults = await Promise.allSettled(
      discoveredRelated.map(async (relArtist) => {
        const details = await apiGetArtistDetails(relArtist.name, relArtist.channelId);
        if (details && Array.isArray(details.topTracks) && details.topTracks.length > 0) {
          return details.topTracks
            .filter((t) => isCleanWaveTrack(t, seedHasForeignScript))
            .slice(0, 3);
        }
        return [];
      })
    );

    for (const relRes of relatedDetailsResults) {
      if (relRes.status === 'fulfilled' && Array.isArray(relRes.value)) {
        relatedTracks.push(...relRes.value);
      }
    }
  }

  if (onProgress) onProgress('ready', 95);

  // 3. Assemble wave with high primary artist priority:
  // - Top hits come first
  // - Then interleave remaining primary tracks with related tracks at a 3:1 ratio
  const dedupeKey = (t: Track) => `${t.title.toLowerCase().trim()}___${t.artist.toLowerCase().trim()}`;
  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();

  const filterUnique = (list: Track[]): Track[] => {
    const out: Track[] = [];
    for (const t of list) {
      if (!isCleanWaveTrack(t, seedHasForeignScript)) continue;
      const k = dedupeKey(t);
      if (!seenKeys.has(k) && !seenIds.has(t.id)) {
        seenKeys.add(k);
        seenIds.add(t.id);
        out.push(t);
      }
    }
    return out;
  };

  const shuffledHits = filterUnique(primaryTopHits.sort(() => 0.5 - Math.random()));
  const shuffledPrimaryOthers = filterUnique(primaryOtherTracks.sort(() => 0.5 - Math.random()));
  const shuffledRelated = filterUnique(relatedTracks.sort(() => 0.5 - Math.random()));

  // Blend hits and catalog tracks organically so hits appear naturally throughout the wave
  const primaryFlow: Track[] = [];
  let hIdx = 0;
  let oIdx = 0;
  while (hIdx < shuffledHits.length || oIdx < shuffledPrimaryOthers.length) {
    if (hIdx < shuffledHits.length) {
      primaryFlow.push(shuffledHits[hIdx]);
      hIdx++;
    }
    let oCount = 0;
    while (oCount < 2 && oIdx < shuffledPrimaryOthers.length) {
      primaryFlow.push(shuffledPrimaryOthers[oIdx]);
      oIdx++;
      oCount++;
    }
  }

  // Interleave primary artist tracks and discovery tracks at an organic 3:1 ratio
  const interleaved: Track[] = [];
  let pIdx = 0;
  let rIdx = 0;
  while (pIdx < primaryFlow.length || rIdx < shuffledRelated.length) {
    let pCount = 0;
    while (pCount < 3 && pIdx < primaryFlow.length) {
      interleaved.push(primaryFlow[pIdx]);
      pIdx++;
      pCount++;
    }
    if (rIdx < shuffledRelated.length) {
      interleaved.push(shuffledRelated[rIdx]);
      rIdx++;
    }
  }

  const finalTracks: Track[] = interleaved.map((t, idx) => normalizeToTrack(t, idx));

  if (finalTracks.length >= 8) {
    saveCachedWave(artists, finalTracks);
  }

  if (onProgress) onProgress('done', 100);

  return finalTracks;
}

