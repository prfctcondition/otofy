import type { Track } from '../types';
import { apiSearchMusic, apiGetRelatedTracks } from './musicApiService';

export function normalizeToTrack(raw: any, index: number = 0): Track {
  return {
    id: raw.id || `wave-${index}`,
    number: index + 1,
    title: raw.title || 'Unknown Title',
    artist: raw.artist || 'Unknown Artist',
    album: raw.album || 'Single',
    duration: raw.duration || '3:00',
    durationSec: raw.durationSec || 180,
    dateAdded: raw.dateAdded || 'Just now',
    source: (raw.source as any) || 'YT',
    sourceLabel: raw.sourceLabel || 'YouTube',
    iconName: 'waves',
    gradientFrom: '#4C1D95',
    gradientTo: '#0F172A',
    artworkUrl: raw.artworkUrl || '',
    sourceId: raw.sourceId || raw.id,
  };
}

const WAVE_CACHE_KEY = 'otofy_daily_wave_cache_v2';

interface WaveCache {
  date: string;
  artistsKey: string;
  tracks: Track[];
}

export function getCachedWave(favoriteArtists: string[]): Track[] | null {
  try {
    const raw = localStorage.getItem(WAVE_CACHE_KEY);
    if (!raw) return null;
    const parsed: WaveCache = JSON.parse(raw);
    const today = new Date().toDateString();
    const currentArtistsKey = [...favoriteArtists].sort().join('|');

    if (
      parsed.date === today &&
      parsed.artistsKey === currentArtistsKey &&
      Array.isArray(parsed.tracks) &&
      parsed.tracks.length >= 10
    ) {
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

export function invalidateWaveCache() {
  try {
    localStorage.removeItem(WAVE_CACHE_KEY);
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
  const gatheredTracks: Track[] = [];
  const similarArtistNames = new Set<string>();

  // 1. Fetch tracks for each favorite artist in parallel
  const artistResults = await Promise.allSettled(
    primaryArtists.map(async (artist) => {
      const searchResp = await apiSearchMusic(artist, 'YT');
      const results = searchResp.results || [];
      const artistTracks = results.filter(
        (t) =>
          t.artist.toLowerCase().includes(artist.toLowerCase()) ||
          artist.toLowerCase().includes(t.artist.toLowerCase())
      );
      const tracksToUse =
        artistTracks.length >= 4 ? artistTracks.slice(0, 14) : results.slice(0, 12);
      return { artist, tracksToUse };
    })
  );

  if (onProgress) onProgress('matching', 55);

  const seedTracks: Track[] = [];
  for (const res of artistResults) {
    if (res.status === 'fulfilled' && res.value.tracksToUse.length > 0) {
      gatheredTracks.push(...res.value.tracksToUse);
      seedTracks.push(res.value.tracksToUse[0]);
    }
  }

  // 2. Fetch related / radio tracks in parallel for seeds to discover similar artists
  const sampleSeeds = seedTracks.slice(0, 3);
  if (sampleSeeds.length > 0) {
    const relatedResults = await Promise.allSettled(
      sampleSeeds.map(async (seed) => {
        const cleanId = (seed.sourceId || seed.id).replace(/^(yt-|sc-)/, '');
        return await apiGetRelatedTracks(cleanId, 'YT', seed.artist, seed.title);
      })
    );

    for (const relRes of relatedResults) {
      if (relRes.status === 'fulfilled' && Array.isArray(relRes.value)) {
        for (const rel of relRes.value.slice(0, 8)) {
          if (rel.artist && !primaryArtists.some((a) => a.toLowerCase() === rel.artist.toLowerCase())) {
            similarArtistNames.add(rel.artist);
            gatheredTracks.push(rel);
          }
        }
      }
    }
  }

  if (onProgress) onProgress('flow', 80);

  // 3. Fetch tracks from up to 2 discovered similar artists in parallel if needed
  const discoveredArtists = Array.from(similarArtistNames).slice(0, 2);
  if (discoveredArtists.length > 0) {
    const simResults = await Promise.allSettled(
      discoveredArtists.map(async (simArtist) => {
        const simResp = await apiSearchMusic(simArtist, 'YT');
        return simResp.results ? simResp.results.slice(0, 6) : [];
      })
    );
    for (const sRes of simResults) {
      if (sRes.status === 'fulfilled' && Array.isArray(sRes.value)) {
        gatheredTracks.push(...sRes.value);
      }
    }
  }

  if (onProgress) onProgress('ready', 95);

  // 4. De-duplicate and randomize
  const uniqueMap = new Map<string, Track>();
  for (const track of gatheredTracks) {
    const key = `${track.title.toLowerCase().trim()}___${track.artist.toLowerCase().trim()}`;
    if (!uniqueMap.has(key) && !uniqueMap.has(track.id)) {
      uniqueMap.set(key, track);
      uniqueMap.set(track.id, track);
    }
  }

  const uniqueList = Array.from(new Set(Array.from(uniqueMap.values())));

  const finalTracks: Track[] = uniqueList
    .sort(() => 0.5 - Math.random())
    .map((t, idx) => normalizeToTrack(t, idx));

  if (finalTracks.length >= 10) {
    saveCachedWave(artists, finalTracks);
  }

  if (onProgress) onProgress('done', 100);

  return finalTracks;
}
