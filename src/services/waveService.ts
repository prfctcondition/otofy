import type { Track } from '../types';

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

export const FALLBACK_WAVE_TRACKS: Track[] = [
  normalizeToTrack({
    id: 'yt-wave-1',
    title: 'Starboy',
    artist: 'The Weeknd',
    album: 'Starboy',
    duration: '3:50',
    durationSec: 230,
    source: 'YT',
    sourceId: '34Na4j8AVgA',
    artworkUrl: 'https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg',
  }, 0),
  normalizeToTrack({
    id: 'yt-wave-2',
    title: 'Numb',
    artist: 'Linkin Park',
    album: 'Meteora',
    duration: '3:07',
    durationSec: 187,
    source: 'YT',
    sourceId: 'kXYiU_JCYtU',
    artworkUrl: 'https://i.ytimg.com/vi/kXYiU_JCYtU/hqdefault.jpg',
  }, 1),
  normalizeToTrack({
    id: 'yt-wave-3',
    title: 'Murder In My Mind',
    artist: 'Kordhell',
    album: 'Murder In My Mind',
    duration: '2:25',
    durationSec: 145,
    source: 'YT',
    sourceId: 'w-sQRS-Um98',
    artworkUrl: 'https://i.ytimg.com/vi/w-sQRS-Um98/hqdefault.jpg',
  }, 2),
  normalizeToTrack({
    id: 'yt-wave-4',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    duration: '3:20',
    durationSec: 200,
    source: 'YT',
    sourceId: '4NRXx6U8ABQ',
    artworkUrl: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg',
  }, 3),
  normalizeToTrack({
    id: 'yt-wave-5',
    title: 'In The End',
    artist: 'Linkin Park',
    album: 'Hybrid Theory',
    duration: '3:36',
    durationSec: 216,
    source: 'YT',
    sourceId: 'eVTXPUF4Oz4',
    artworkUrl: 'https://i.ytimg.com/vi/eVTXPUF4Oz4/hqdefault.jpg',
  }, 4),
  normalizeToTrack({
    id: 'yt-wave-6',
    title: 'Close Eyes',
    artist: 'DVRST',
    album: 'Close Eyes',
    duration: '2:12',
    durationSec: 132,
    source: 'YT',
    sourceId: 'COz9lDCFHjw',
    artworkUrl: 'https://i.ytimg.com/vi/COz9lDCFHjw/hqdefault.jpg',
  }, 5),
];

export async function generateWaveTracks(favoriteArtists: string[]): Promise<Track[]> {
  const artists = (favoriteArtists && favoriteArtists.length > 0)
    ? favoriteArtists
    : ['The Weeknd', 'Linkin Park', 'Kordhell'];

  const shuffledArtists = [...artists].sort(() => 0.5 - Math.random());
  const selectedArtists = shuffledArtists.slice(0, 5);

  const gatheredTracks: Track[] = [];

  for (const artist of selectedArtists) {
    try {
      if (window.electronAPI?.searchMusic) {
        const resp = await window.electronAPI.searchMusic(artist, 'YT');
        const tracks = resp && typeof resp === 'object' && 'results' in resp ? resp.results : [];
        if (Array.isArray(tracks) && tracks.length > 0) {
          const mapped = tracks.slice(0, 4).map((t: any, idx: number) =>
            normalizeToTrack(t, gatheredTracks.length + idx)
          );
          gatheredTracks.push(...mapped);
        }
      }
    } catch (err) {
      console.warn(`[WaveService] Failed to fetch tracks for ${artist}:`, err);
    }
  }

  const uniqueTracks: Track[] = [];
  const seenIds = new Set<string>();

  for (const track of gatheredTracks.sort(() => 0.5 - Math.random())) {
    if (!seenIds.has(track.id)) {
      seenIds.add(track.id);
      uniqueTracks.push({
        ...track,
        number: uniqueTracks.length + 1,
      });
    }
  }

  if (uniqueTracks.length === 0) {
    return FALLBACK_WAVE_TRACKS;
  }

  return uniqueTracks;
}
