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

export async function generateWaveTracks(favoriteArtists: string[], forceRefresh = false): Promise<Track[]> {
  const artists = (favoriteArtists && favoriteArtists.length > 0)
    ? favoriteArtists
    : ['The Weeknd', 'Linkin Park', 'Kordhell'];

  if (!forceRefresh) {
    const cached = getCachedWave(artists);
    if (cached) {
      return cached;
    }
  }

  const primaryArtists = [...artists];
  const gatheredTracks: Track[] = [];
  const similarArtistNames = new Set<string>();

  // 1. Fetch tracks for each favorite artist
  for (const artist of primaryArtists) {
    try {
      const searchResp = await apiSearchMusic(artist, 'YT');
      if (searchResp.results && searchResp.results.length > 0) {
        const artistTracks = searchResp.results.filter(
          (t) =>
            t.artist.toLowerCase().includes(artist.toLowerCase()) ||
            artist.toLowerCase().includes(t.artist.toLowerCase())
        );
        const tracksToUse =
          artistTracks.length >= 4 ? artistTracks.slice(0, 14) : searchResp.results.slice(0, 12);
        gatheredTracks.push(...tracksToUse);

        // Discover similar artists from related tracks
        if (tracksToUse.length > 0) {
          const sampleTrack = tracksToUse[0];
          const cleanId = (sampleTrack.sourceId || sampleTrack.id).replace(/^(yt-|sc-)/, '');
          const related = await apiGetRelatedTracks(cleanId, 'YT', sampleTrack.artist, sampleTrack.title);
          for (const rel of related.slice(0, 8)) {
            if (rel.artist && !primaryArtists.some((a) => a.toLowerCase() === rel.artist.toLowerCase())) {
              similarArtistNames.add(rel.artist);
              gatheredTracks.push(rel);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[WaveService] Failed to fetch tracks for ${artist}:`, err);
    }
  }

  // 2. Fetch tracks from up to 3 discovered similar artists
  const discoveredArtists = Array.from(similarArtistNames).slice(0, 3);
  for (const simArtist of discoveredArtists) {
    try {
      const simResp = await apiSearchMusic(simArtist, 'YT');
      if (simResp.results && simResp.results.length > 0) {
        gatheredTracks.push(...simResp.results.slice(0, 6));
      }
    } catch {}
  }

  // 3. De-duplicate and randomize
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

  return finalTracks;
}
