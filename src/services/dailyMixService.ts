import type { Track, DailyMixConfig } from '../types';
import type { StationItem } from '../data/homeData';
import repo from '../db/repository';
import db from '../db/database';
import { cleanArtistAndTitle } from '../utils/trackUtils';

export interface GenrePreset {
  genre: string;
  title: string;
  mixNumber: number;
  subtitle: string;
  badgeColor: string;
  badgeTextColor: string;
  cardVariant: 'discover' | 'mix';
  bgGradient: string;
  searchQueries: string[];
  fallbackTracks: Array<{
    title: string;
    artist: string;
    album: string;
    duration: string;
    durationSec: number;
    source: 'YT' | 'SC';
    sourceId: string;
    artworkUrl: string;
  }>;
}

export const GENRE_PRESETS: GenrePreset[] = [
  {
    genre: 'Discover',
    title: 'DISCOVER WEEKLY',
    mixNumber: 0,
    subtitle: 'Hidden gems & fresh discoveries across YouTube & SoundCloud.',
    badgeColor: '#000000',
    badgeTextColor: '#FFFFFF',
    cardVariant: 'discover',
    bgGradient: 'from-zinc-950 via-purple-950 to-pink-900',
    searchQueries: ['chill synthwave trending music', 'electronic downtempo gems'],
    fallbackTracks: [
      {
        title: 'Resonance',
        artist: 'HOME',
        album: 'Odyssey',
        duration: '3:32',
        durationSec: 212,
        source: 'YT',
        sourceId: '8GW6sLrK40k',
        artworkUrl: 'https://i.ytimg.com/vi/8GW6sLrK40k/hqdefault.jpg',
      },
      {
        title: 'Nightcall',
        artist: 'Kavinsky',
        album: 'Outrun',
        duration: '4:19',
        durationSec: 259,
        source: 'YT',
        sourceId: 'MV_3Dpw-BRY',
        artworkUrl: 'https://i.ytimg.com/vi/MV_3Dpw-BRY/hqdefault.jpg',
      },
      {
        title: 'Weightless',
        artist: 'Marconi Union',
        album: 'Weightless (Ambient Transmissions Vol. 2)',
        duration: '8:05',
        durationSec: 485,
        source: 'YT',
        sourceId: 'UfcAVejslrU',
        artworkUrl: 'https://i.ytimg.com/vi/UfcAVejslrU/hqdefault.jpg',
      },
      {
        title: 'After Dark',
        artist: 'Mr.Kitty',
        album: 'Time',
        duration: '4:18',
        durationSec: 258,
        source: 'YT',
        sourceId: 'sVx1mJDeUj8',
        artworkUrl: 'https://i.ytimg.com/vi/sVx1mJDeUj8/hqdefault.jpg',
      },
    ],
  },
  {
    genre: 'Phonk & Dark Bass',
    title: 'Daily Mix 1',
    mixNumber: 1,
    subtitle: 'PANDEMXNIUM, Kordhell, DVRST, Hensonn and more.',
    badgeColor: '#06B6D4',
    badgeTextColor: '#0F172A',
    cardVariant: 'mix',
    bgGradient: 'from-slate-900 via-zinc-800 to-stone-900',
    searchQueries: ['drift phonk dark bass slowed', 'kordhell phonk live'],
    fallbackTracks: [
      {
        title: 'Murder In My Mind',
        artist: 'KORDHELL',
        album: 'Murder In My Mind',
        duration: '2:25',
        durationSec: 145,
        source: 'YT',
        sourceId: 'w-sQRS-TF9k',
        artworkUrl: 'https://i.ytimg.com/vi/w-sQRS-TF9k/hqdefault.jpg',
      },
      {
        title: 'Close Eyes',
        artist: 'DVRST',
        album: 'Close Eyes',
        duration: '2:12',
        durationSec: 132,
        source: 'YT',
        sourceId: 'ao4RCon2S44',
        artworkUrl: 'https://i.ytimg.com/vi/ao4RCon2S44/hqdefault.jpg',
      },
      {
        title: 'Sahara',
        artist: 'Hensonn',
        album: 'Sahara',
        duration: '2:51',
        durationSec: 171,
        source: 'YT',
        sourceId: 'TfZo4bA1C6A',
        artworkUrl: 'https://i.ytimg.com/vi/TfZo4bA1C6A/hqdefault.jpg',
      },
    ],
  },
  {
    genre: 'Lo-Fi Chill & Beats',
    title: 'Daily Mix 2',
    mixNumber: 2,
    subtitle: 'ChilledCow, Kupla, idealism, Jinsang and more.',
    badgeColor: '#EAB308',
    badgeTextColor: '#0F172A',
    cardVariant: 'mix',
    bgGradient: 'from-neutral-900 via-stone-800 to-amber-950',
    searchQueries: ['lofi hip hop chill beats study', 'kupla lofi beats'],
    fallbackTracks: [
      {
        title: 'Affection',
        artist: 'Jinsang',
        album: 'Life',
        duration: '2:10',
        durationSec: 130,
        source: 'YT',
        sourceId: 'vIxZM8d4Lw4',
        artworkUrl: 'https://i.ytimg.com/vi/vIxZM8d4Lw4/hqdefault.jpg',
      },
      {
        title: 'Controlla',
        artist: 'idealism',
        album: 'Rainy Evening',
        duration: '2:34',
        durationSec: 154,
        source: 'YT',
        sourceId: 'N_Q76J1c-7k',
        artworkUrl: 'https://i.ytimg.com/vi/N_Q76J1c-7k/hqdefault.jpg',
      },
      {
        title: 'Roots',
        artist: 'Kupla',
        album: 'Kingdom in Blue',
        duration: '3:05',
        durationSec: 185,
        source: 'YT',
        sourceId: 'c1u2yT8W4P8',
        artworkUrl: 'https://i.ytimg.com/vi/c1u2yT8W4P8/hqdefault.jpg',
      },
    ],
  },
  {
    genre: 'Synthwave & Retrowave',
    title: 'Daily Mix 3',
    mixNumber: 3,
    subtitle: 'The Midnight, Gunship, Timecop1983, FM-84 and more.',
    badgeColor: '#F97316',
    badgeTextColor: '#0F172A',
    cardVariant: 'mix',
    bgGradient: 'from-cyan-900 via-blue-800 to-teal-950',
    searchQueries: ['the midnight synthwave retrowave', 'synthwave 80s outrun'],
    fallbackTracks: [
      {
        title: 'Sunset',
        artist: 'The Midnight',
        album: 'Endless Summer',
        duration: '5:26',
        durationSec: 326,
        source: 'YT',
        sourceId: 'c_K7V7Pz4P8',
        artworkUrl: 'https://i.ytimg.com/vi/rN1f_1F46i4/hqdefault.jpg',
      },
      {
        title: 'Running in the Night',
        artist: 'FM-84, Ollie Wride',
        album: 'Atlas',
        duration: '4:30',
        durationSec: 270,
        source: 'YT',
        sourceId: 'Y2bX0sFh1e0',
        artworkUrl: 'https://i.ytimg.com/vi/Y2bX0sFh1e0/hqdefault.jpg',
      },
      {
        title: 'Tech Noir',
        artist: 'GUNSHIP',
        album: 'GUNSHIP',
        duration: '4:57',
        durationSec: 297,
        source: 'YT',
        sourceId: '-nC5T8SJfy8',
        artworkUrl: 'https://i.ytimg.com/vi/-nC5T8SJfy8/hqdefault.jpg',
      },
    ],
  },
  {
    genre: 'Underground Hip-Hop',
    title: 'Daily Mix 4',
    mixNumber: 4,
    subtitle: 'BONES, Xavier Wulf, Suicideboys, Yung Lean and more.',
    badgeColor: '#EC4899',
    badgeTextColor: '#0F172A',
    cardVariant: 'mix',
    bgGradient: 'from-zinc-900 via-purple-900 to-neutral-950',
    searchQueries: ['bones underground rap sesh', 'cloud rap lofi hip hop'],
    fallbackTracks: [
      {
        title: 'HDMI',
        artist: 'BONES',
        album: 'Rotten',
        duration: '2:15',
        durationSec: 135,
        source: 'YT',
        sourceId: 'N_n_6pD4m04',
        artworkUrl: 'https://i.ytimg.com/vi/N_n_6pD4m04/hqdefault.jpg',
      },
      {
        title: 'Thunder Man',
        artist: 'Xavier Wulf',
        album: 'Blood Shore Season 2',
        duration: '2:40',
        durationSec: 160,
        source: 'YT',
        sourceId: '1p2_5C8M6p4',
        artworkUrl: 'https://i.ytimg.com/vi/1p2_5C8M6p4/hqdefault.jpg',
      },
    ],
  },
  {
    genre: 'Ambient & Spatial Flow',
    title: 'Daily Mix 5',
    mixNumber: 5,
    subtitle: 'Brian Eno, Stars of the Lid, Hammock, Tim Hecker and more.',
    badgeColor: '#84CC16',
    badgeTextColor: '#0F172A',
    cardVariant: 'mix',
    bgGradient: 'from-emerald-950 via-teal-900 to-slate-900',
    searchQueries: ['ambient deep sleep meditation music', 'ambient spatial relaxation'],
    fallbackTracks: [
      {
        title: 'An Ending (Ascent)',
        artist: 'Brian Eno',
        album: 'Apollo: Atmospheres and Soundtracks',
        duration: '4:24',
        durationSec: 264,
        source: 'YT',
        sourceId: 'It4WxQ6dnn0',
        artworkUrl: 'https://i.ytimg.com/vi/It4WxQ6dnn0/hqdefault.jpg',
      },
      {
        title: 'Silencia',
        artist: 'Hammock',
        album: 'Silencia',
        duration: '4:45',
        durationSec: 285,
        source: 'YT',
        sourceId: 'O1yG3Z2f-5s',
        artworkUrl: 'https://i.ytimg.com/vi/O1yG3Z2f-5s/hqdefault.jpg',
      },
    ],
  },
];

const GENRE_QUERIES: Record<number, string> = {
  0: 'chart',
  1: 'phonk',
  2: 'lofi chill',
  3: 'synthwave',
  4: 'underground hip hop',
  5: 'ambient chill',
};

export async function fetchGenreTracks(query: string): Promise<Track[]> {
  // 1. If Electron IPC is available
  if (window.electronAPI?.getGenreTracks) {
    try {
      const tracks = await window.electronAPI.getGenreTracks(query);
      if (tracks && tracks.length >= 20) {
        return tracks.map((t: any) => {
          const { title, artist } = cleanArtistAndTitle(t.title, t.artist);
          return { ...t, title, artist };
        });
      }
    } catch (e) {
      console.warn('[DailyMix] getGenreTracks error:', e);
    }
  }

  // 2. Direct web API fetch fallback
  try {
    const res = await fetch(`/api/music/genre-tracks?query=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data: any = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((t: any, idx: number) => {
          const { title, artist } = cleanArtistAndTitle(t.title || 'Untitled', t.artist);
          return {
            id: `dm-${idx}-${t.id || t.sourceId}`,
            number: idx + 1,
            title,
            artist,
            album: t.album || query,
            duration: t.duration || '0:00',
            durationSec: t.durationSec || 0,
            dateAdded: 'Today',
            source: (t.source || 'YT') as 'YT' | 'SC',
            sourceLabel: t.sourceLabel || 'YouTube Music',
            artworkUrl: t.artworkUrl,
            sourceId: t.sourceId || t.id,
            iconName: 'sparkles' as const,
            gradientFrom: '#1E1B4B',
            gradientTo: '#09090B',
            isLiked: false,
          };
        });
      }
    }
  } catch (err) {
    console.warn('[DailyMix] Web API genre tracks fetch error:', err);
  }

  // 3. Fallback to searchMusic if available
  if (window.electronAPI?.searchMusic) {
    try {
      const resp = await window.electronAPI.searchMusic(query);
      const list = Array.isArray(resp) ? resp : resp?.results || [];
      if (list.length > 0) {
        return list.map((r, idx) => {
          const { title, artist } = cleanArtistAndTitle(r.title, r.artist);
          return {
            id: `dm-yt-${idx}-${r.id || r.sourceId}`,
            number: idx + 1,
            title,
            artist,
            album: r.album || query,
            duration: r.duration,
            durationSec: r.durationSec,
            dateAdded: 'Today',
            source: r.source,
            sourceLabel: r.sourceLabel,
            sourceId: r.sourceId,
            artworkUrl: r.artworkUrl,
            iconName: 'sparkles' as const,
            gradientFrom: '#1E1B4B',
            gradientTo: '#09090B',
            isLiked: false,
          };
        });
      }
    } catch {}
  }

  return [];
}

const MIX_REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

export async function shouldRefreshMixes(): Promise<boolean> {
  const lastRefresh = await repo.getSetting('dailyMixLastRefresh');
  if (!lastRefresh) return true;
  return Date.now() - parseInt(lastRefresh, 10) > MIX_REFRESH_INTERVAL;
}

/**
 * Dynamically computes a Mix title and subtitle based on actual tracks and top artists.
 */
export function computeMixMeta(
  tracks: Track[],
  mixNumber: number,
  fallbackGenre: string
): { title: string; subtitle: string } {
  const artistCounts = new Map<string, number>();
  for (const t of tracks) {
    const art = t.artist?.trim();
    if (
      art &&
      art.toLowerCase() !== 'unknown artist' &&
      art.toLowerCase() !== 'unknown' &&
      art.toLowerCase() !== 'song'
    ) {
      artistCounts.set(art, (artistCounts.get(art) || 0) + 1);
    }
  }

  const sortedArtists = Array.from(artistCounts.entries()).sort((a, b) => b[1] - a[1]);
  const topArtists = sortedArtists.slice(0, 3).map(([name]) => name);

  if (mixNumber === 0) {
    return {
      title: 'Discover Weekly',
      subtitle:
        topArtists.length > 0
          ? `${topArtists.join(', ')} and more fresh discoveries.`
          : 'Hidden gems & fresh discoveries across YouTube & SoundCloud.',
    };
  }

  let title = `Daily Mix ${mixNumber}`;
  let subtitle = `${fallbackGenre} mix`;

  if (topArtists.length >= 2) {
    title = `${topArtists[0]} & ${topArtists[1]} Mix`;
    subtitle = `${topArtists.join(', ')} and more.`;
  } else if (topArtists.length === 1) {
    title = `${topArtists[0]} Mix`;
    subtitle = `${topArtists[0]} and similar artists.`;
  } else if (fallbackGenre) {
    title = `${fallbackGenre} Mix`;
    subtitle = `Best of ${fallbackGenre}.`;
  }

  return { title, subtitle };
}

export async function generateDailyMixes(): Promise<DailyMixConfig[]> {
  const mixes: DailyMixConfig[] = [];

  for (let i = 0; i < GENRE_PRESETS.length; i++) {
    const preset = GENRE_PRESETS[i];
    const mixId = `mix-${preset.mixNumber}`;
    const query = GENRE_QUERIES[preset.mixNumber] || preset.genre;

    let mixTracks = await fetchGenreTracks(query);

    // If fewer than 40 tracks, supplement with preset fallback tracks
    if (mixTracks.length < 40) {
      const fbTracks = preset.fallbackTracks.map((fb, idx) => ({
        id: `dm-${preset.mixNumber}-${idx}-${fb.sourceId}`,
        number: mixTracks.length + idx + 1,
        title: fb.title,
        artist: fb.artist,
        album: fb.album,
        duration: fb.duration,
        durationSec: fb.durationSec,
        dateAdded: 'Today',
        source: fb.source,
        sourceLabel: fb.source === 'YT' ? 'YouTube Music' : 'SoundCloud',
        sourceId: fb.sourceId,
        artworkUrl: fb.artworkUrl,
        iconName: 'music' as const,
        gradientFrom: '#334155',
        gradientTo: '#0F172A',
        isLiked: false,
      }));
      const existingTitles = new Set(mixTracks.map((t) => t.title.toLowerCase()));
      for (const fb of fbTracks) {
        if (!existingTitles.has(fb.title.toLowerCase())) {
          mixTracks.push(fb);
        }
      }
    }

    mixTracks = mixTracks.map((t, idx) => ({ ...t, number: idx + 1 }));

    // Save tracks to DB so they can be played directly
    for (const t of mixTracks) {
      await repo.putTrack(t);
    }

    const { title: dynamicTitle, subtitle: dynamicSubtitle } = computeMixMeta(
      mixTracks,
      preset.mixNumber,
      preset.genre
    );

    const config: DailyMixConfig = {
      id: mixId,
      genre: preset.genre,
      mixNumber: preset.mixNumber,
      title: dynamicTitle,
      subtitle: dynamicSubtitle,
      lastGeneratedAt: Date.now(),
      trackIds: mixTracks.map((t) => t.id),
    };

    // Save mix to DB
    await db.dailyMixes.put({
      id: config.id,
      genre: config.genre,
      mixNumber: config.mixNumber,
      title: config.title,
      subtitle: config.subtitle,
      lastGeneratedAt: config.lastGeneratedAt,
      trackIds: JSON.stringify(config.trackIds),
    });

    mixes.push(config);
  }

  await repo.setSetting('dailyMixLastRefresh', Date.now().toString());
  return mixes;
}

export async function getDailyMixTracks(mixConfig: DailyMixConfig): Promise<Track[]> {
  const allTracks = await repo.getAllTracks();
  const trackMap = new Map(allTracks.map((t) => [t.id, t]));
  let tracks = (mixConfig.trackIds || [])
    .map((id) => trackMap.get(id))
    .filter((t): t is Track => t !== undefined);

  // If fewer than 40 tracks were retrieved, fetch fresh full set of 40-50 tracks
  if (tracks.length < 40) {
    const query = GENRE_QUERIES[mixConfig.mixNumber] || mixConfig.genre || 'chart';
    const freshTracks = await fetchGenreTracks(query);
    if (freshTracks.length > 0) {
      for (const t of freshTracks) {
        await repo.putTrack(t);
      }
      tracks = freshTracks;
      try {
        await db.dailyMixes.update(mixConfig.id, {
          trackIds: JSON.stringify(tracks.map((t) => t.id)),
          lastGeneratedAt: Date.now(),
        });
      } catch {}
    }
  }

  // Renumber tracks nicely
  return tracks.map((t, idx) => ({ ...t, number: idx + 1 }));
}

export async function getStationTracks(station: StationItem): Promise<Track[]> {
  const query = station.searchQuery || `${station.title} music`;
  let stationTracks = await fetchGenreTracks(query);

  if (stationTracks.length < 40) {
    const more = await fetchGenreTracks(station.title);
    const existingTitles = new Set(stationTracks.map((t) => t.title.toLowerCase()));
    for (const m of more) {
      if (!existingTitles.has(m.title.toLowerCase())) {
        stationTracks.push(m);
      }
    }
  }

  stationTracks = stationTracks.map((t, idx) => ({
    ...t,
    id: `st-${station.id}-${idx}-${t.id}`,
    number: idx + 1,
    album: `${station.title} Radio`,
    iconName: 'radio' as const,
    gradientFrom: '#047857',
    gradientTo: '#064E3B',
  }));

  for (const t of stationTracks) {
    await repo.putTrack(t);
  }

  return stationTracks;
}

export async function getStoredDailyMixes(): Promise<DailyMixConfig[]> {
  try {
    const rawMixes = await db.dailyMixes.toArray();
    if (rawMixes.length === 0) {
      return await generateDailyMixes();
    }
    const allTracks = await repo.getAllTracks();
    const trackMap = new Map(allTracks.map((t) => [t.id, t]));

    const parsed = rawMixes.map((r) => {
      const trackIds = typeof r.trackIds === 'string' ? JSON.parse(r.trackIds) : r.trackIds;
      const tracks = (trackIds || []).map((id: string) => trackMap.get(id)).filter((t): t is Track => !!t);
      const meta = computeMixMeta(tracks, r.mixNumber, r.genre);

      return {
        id: r.id,
        genre: r.genre,
        mixNumber: r.mixNumber,
        title: meta.title || r.title,
        subtitle: meta.subtitle || r.subtitle,
        lastGeneratedAt: r.lastGeneratedAt,
        trackIds,
      };
    });
    // If any mix has fewer than 40 tracks, regenerate them so user gets 40+ tracks
    if (parsed.some((m) => !m.trackIds || m.trackIds.length < 40)) {
      return await generateDailyMixes();
    }
    return parsed;
  } catch {
    return await generateDailyMixes();
  }
}
