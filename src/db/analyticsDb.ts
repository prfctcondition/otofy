import Dexie, { type Table } from 'dexie';

export interface PlayEvent {
  id?: number;
  trackId: string;
  title: string;
  artist: string;
  artists?: string[];
  album?: string;
  durationSec: number;
  listenedSec: number;
  playedAt: number;
  year: number;
  month: number;
  isoWeek: string;
  dayString: string;
  hourOfDay: number;
  dayOfWeek: number;
  artworkUrl?: string;
  source?: string;
  completed: boolean;
}

export interface AggregatedTrackStat {
  trackId: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  playCount: number;
  totalSec: number;
}

export interface AggregatedArtistStat {
  artist: string;
  avatarUrl?: string;
  playCount: number;
  totalSec: number;
  sampleTracks: string[];
}

export interface AggregatedStats {
  totalListenedSec: number;
  totalPlays: number;
  uniqueTracksCount: number;
  uniqueArtistsCount: number;
  topTracks: AggregatedTrackStat[];
  topArtists: AggregatedArtistStat[];
  hourlyDistribution: number[];
  dayOfWeekDistribution: number[];
  peakHour: number;
  peakDay: number;
}

export function getIsoWeekString(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getDayString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export class OtofyAnalyticsDB extends Dexie {
  playEvents!: Table<PlayEvent, number>;

  constructor() {
    super('OtofyAnalyticsDB');
    this.version(1).stores({
      playEvents: '++id, trackId, artist, playedAt, dayString, isoWeek, year, month',
    });
  }
}

export const analyticsDb = new OtofyAnalyticsDB();

export async function logPlayEvent(data: Omit<PlayEvent, 'id'>): Promise<number> {
  return await analyticsDb.playEvents.add(data);
}

export async function updatePlayEventDuration(id: number, listenedSec: number, completed: boolean = false): Promise<void> {
  await analyticsDb.playEvents.update(id, { listenedSec, completed });
}

export async function getEventsByTimeRange(range: 'week' | 'month' | 'year' | 'all'): Promise<PlayEvent[]> {
  const now = new Date();
  if (range === 'all') {
    return await analyticsDb.playEvents.orderBy('playedAt').reverse().toArray();
  }

  if (range === 'week') {
    const currentWeek = getIsoWeekString(now);
    return await analyticsDb.playEvents.where('isoWeek').equals(currentWeek).toArray();
  }

  if (range === 'month') {
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const events = await analyticsDb.playEvents.where('year').equals(currentYear).toArray();
    return events.filter((e) => e.month === currentMonth);
  }

  if (range === 'year') {
    const currentYear = now.getFullYear();
    return await analyticsDb.playEvents.where('year').equals(currentYear).toArray();
  }

  return await analyticsDb.playEvents.orderBy('playedAt').reverse().toArray();
}

export function calculateAggregatedStats(events: PlayEvent[]): AggregatedStats {
  const trackMap = new Map<string, AggregatedTrackStat>();
  const artistMap = new Map<string, { artist: string; avatarUrl?: string; playCount: number; totalSec: number; sampleTracks: Set<string> }>();
  const hourly = new Array(24).fill(0);
  const days = new Array(7).fill(0);

  let totalListenedSec = 0;

  for (const e of events) {
    totalListenedSec += e.listenedSec || 0;

    // Track aggregation
    const trackKey = `${e.trackId || ''}_${(e.title || '').toLowerCase()}`;
    const existingTrack = trackMap.get(trackKey);
    if (existingTrack) {
      existingTrack.playCount += 1;
      existingTrack.totalSec += e.listenedSec || 0;
      if (!existingTrack.artworkUrl && e.artworkUrl) {
        existingTrack.artworkUrl = e.artworkUrl;
      }
    } else {
      trackMap.set(trackKey, {
        trackId: e.trackId,
        title: e.title || 'Unknown Title',
        artist: e.artist || 'Unknown Artist',
        artworkUrl: e.artworkUrl,
        playCount: 1,
        totalSec: e.listenedSec || 0,
      });
    }

    // Artist aggregation
    const artistName = (e.artist || 'Unknown Artist').trim();
    const existingArtist = artistMap.get(artistName.toLowerCase());
    if (existingArtist) {
      existingArtist.playCount += 1;
      existingArtist.totalSec += e.listenedSec || 0;
      if (!existingArtist.avatarUrl && e.artworkUrl) {
        existingArtist.avatarUrl = e.artworkUrl;
      }
      if (e.title && existingArtist.sampleTracks.size < 5) {
        existingArtist.sampleTracks.add(e.title);
      }
    } else {
      const sampleSet = new Set<string>();
      if (e.title) sampleSet.add(e.title);
      artistMap.set(artistName.toLowerCase(), {
        artist: artistName,
        avatarUrl: e.artworkUrl,
        playCount: 1,
        totalSec: e.listenedSec || 0,
        sampleTracks: sampleSet,
      });
    }

    // Hourly
    if (typeof e.hourOfDay === 'number' && e.hourOfDay >= 0 && e.hourOfDay < 24) {
      hourly[e.hourOfDay] += 1;
    }

    // Day of week
    if (typeof e.dayOfWeek === 'number' && e.dayOfWeek >= 0 && e.dayOfWeek < 7) {
      days[e.dayOfWeek] += 1;
    }
  }

  const topTracks = Array.from(trackMap.values())
    .sort((a, b) => b.playCount - a.playCount || b.totalSec - a.totalSec)
    .slice(0, 10);

  const topArtists: AggregatedArtistStat[] = Array.from(artistMap.values())
    .sort((a, b) => b.playCount - a.playCount || b.totalSec - a.totalSec)
    .slice(0, 10)
    .map((item) => ({
      artist: item.artist,
      avatarUrl: item.avatarUrl,
      playCount: item.playCount,
      totalSec: item.totalSec,
      sampleTracks: Array.from(item.sampleTracks),
    }));

  let peakHour = 20;
  let maxHourCount = -1;
  hourly.forEach((count, h) => {
    if (count > maxHourCount) {
      maxHourCount = count;
      peakHour = h;
    }
  });

  let peakDay = 5;
  let maxDayCount = -1;
  days.forEach((count, d) => {
    if (count > maxDayCount) {
      maxDayCount = count;
      peakDay = d;
    }
  });

  return {
    totalListenedSec,
    totalPlays: events.length,
    uniqueTracksCount: trackMap.size,
    uniqueArtistsCount: artistMap.size,
    topTracks,
    topArtists,
    hourlyDistribution: hourly,
    dayOfWeekDistribution: days,
    peakHour,
    peakDay,
  };
}
