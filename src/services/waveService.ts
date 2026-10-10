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

  const gatheredTracks: Track[] = [];
  const relatedArtistsMap = new Map<string, { name: string; channelId: string }>();

  // 1. Fetch official artist details (topTracks + official relatedArtists) for each favorite artist in parallel
  const artistDetailsResults = await Promise.allSettled(
    primaryArtists.map(async (artist) => {
      const details = await apiGetArtistDetails(artist);
      if (details && details.topTracks && details.topTracks.length > 0) {
        const cleanTop = details.topTracks.filter((t) => isCleanWaveTrack(t, seedHasForeignScript));
        // Shuffle top 24 tracks and pick up to 12 so refreshes feel dynamic while staying authentic
        const pool = cleanTop.slice(0, 24).sort(() => 0.5 - Math.random());
        return {
          artist,
          tracksToUse: pool.slice(0, 12),
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
        tracksToUse: artistTracks.slice(0, 10),
        relatedArtists: [] as Array<{ name: string; channelId: string }>,
      };
    })
  );

  if (onProgress) onProgress('matching', 55);

  const seedTracks: Track[] = [];
  for (const res of artistDetailsResults) {
    if (res.status === 'fulfilled') {
      if (res.value.tracksToUse.length > 0) {
        gatheredTracks.push(...res.value.tracksToUse);
        seedTracks.push(res.value.tracksToUse[0]);
      }
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

  // 2. Fetch official topTracks from up to 5 official related artists (Fans might also like)
  const discoveredRelated = Array.from(relatedArtistsMap.values())
    .sort(() => 0.5 - Math.random())
    .slice(0, 5);

  if (discoveredRelated.length > 0) {
    const relatedDetailsResults = await Promise.allSettled(
      discoveredRelated.map(async (relArtist) => {
        const details = await apiGetArtistDetails(relArtist.name, relArtist.channelId);
        if (details && Array.isArray(details.topTracks) && details.topTracks.length > 0) {
          return details.topTracks
            .filter((t) => isCleanWaveTrack(t, seedHasForeignScript))
            .slice(0, 12)
            .sort(() => 0.5 - Math.random())
            .slice(0, 5);
        }
        return [];
      })
    );

    for (const relRes of relatedDetailsResults) {
      if (relRes.status === 'fulfilled' && Array.isArray(relRes.value)) {
        gatheredTracks.push(...relRes.value);
      }
    }
  } else if (seedTracks.length > 0) {
    // Fallback if no official relatedArtists were available: use filtered getRelatedTracks
    const sampleSeeds = seedTracks.slice(0, 2);
    const relatedResults = await Promise.allSettled(
      sampleSeeds.map(async (seed) => {
        const cleanId = (seed.sourceId || seed.id).replace(/^(yt-|sc-)/, '');
        return await apiGetRelatedTracks(cleanId, 'YT', seed.artist, seed.title);
      })
    );

    for (const relRes of relatedResults) {
      if (relRes.status === 'fulfilled' && Array.isArray(relRes.value)) {
        for (const rel of relRes.value) {
          if (rel.artistBrowseId && isCleanWaveTrack(rel, seedHasForeignScript)) {
            gatheredTracks.push(rel);
          }
        }
      }
    }
  }

  if (onProgress) onProgress('ready', 95);

  // 3. De-duplicate and interleave across artists so the wave flows naturally
  const uniqueMap = new Map<string, Track>();
  const seenIds = new Set<string>();
  for (const track of gatheredTracks) {
    if (!isCleanWaveTrack(track, seedHasForeignScript)) continue;
    const key = `${track.title.toLowerCase().trim()}___${track.artist.toLowerCase().trim()}`;
    if (!uniqueMap.has(key) && !seenIds.has(track.id)) {
      uniqueMap.set(key, track);
      seenIds.add(track.id);
    }
  }

  const byArtist = new Map<string, Track[]>();
  for (const track of uniqueMap.values()) {
    const artistKey = track.artist.toLowerCase().trim();
    const list = byArtist.get(artistKey) || [];
    list.push(track);
    byArtist.set(artistKey, list);
  }

  // Shuffle each artist's bucket
  for (const [k, list] of byArtist.entries()) {
    byArtist.set(k, list.sort(() => 0.5 - Math.random()));
  }

  // Round-robin interleave across shuffled artist buckets so same artist doesn't play back-to-back
  const interleaved: Track[] = [];
  let hasRemaining = true;
  while (hasRemaining) {
    hasRemaining = false;
    const bucketKeys = Array.from(byArtist.keys()).sort(() => 0.5 - Math.random());
    for (const k of bucketKeys) {
      const list = byArtist.get(k)!;
      if (list.length > 0) {
        interleaved.push(list.shift()!);
        if (list.length > 0) {
          hasRemaining = true;
        }
      }
    }
  }

  const finalTracks: Track[] = interleaved.map((t, idx) => normalizeToTrack(t, idx));

  if (finalTracks.length >= 10) {
    saveCachedWave(artists, finalTracks);
  }

  if (onProgress) onProgress('done', 100);

  return finalTracks;
}

