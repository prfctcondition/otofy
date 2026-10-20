import { usePlayerStore } from '../store/playerStore';
import {
  analyticsDb,
  logPlayEvent,
  updatePlayEventDuration,
  getIsoWeekString,
  getDayString,
  type PlayEvent,
} from '../db/analyticsDb';
import type { Track } from '../types';
import db from '../db/database';

interface ActiveListeningSession {
  trackId: string;
  title: string;
  artist: string;
  artists?: string[];
  album?: string;
  durationSec: number;
  artworkUrl?: string;
  source?: string;
  startedAt: number;
  accumulatedSec: number;
  loggedEventId: number | null;
  isCompleted: boolean;
}

let activeSession: ActiveListeningSession | null = null;
let tickerInterval: NodeJS.Timeout | null = null;
let isTrackerInitialized = false;

async function finalizeActiveSession() {
  if (!activeSession) return;
  if (activeSession.loggedEventId) {
    try {
      await updatePlayEventDuration(
        activeSession.loggedEventId,
        Math.max(1, Math.round(activeSession.accumulatedSec)),
        activeSession.isCompleted
      );
    } catch (err) {
      console.warn('[Analytics] Failed to finalize session:', err);
    }
  }
  activeSession = null;
}

async function checkAndLogSession() {
  if (!activeSession) return;

  const thresholdSec = activeSession.durationSec > 0 && activeSession.durationSec < 30
    ? Math.max(5, Math.round(activeSession.durationSec / 1.25)) // ~80%
    : 30;

  if (activeSession.accumulatedSec >= thresholdSec && !activeSession.loggedEventId) {
    const now = new Date();
    const eventData: Omit<PlayEvent, 'id'> = {
      trackId: activeSession.trackId,
      title: activeSession.title,
      artist: activeSession.artist,
      artists: activeSession.artists,
      album: activeSession.album,
      durationSec: activeSession.durationSec,
      listenedSec: Math.round(activeSession.accumulatedSec),
      playedAt: activeSession.startedAt,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      isoWeek: getIsoWeekString(now),
      dayString: getDayString(now),
      hourOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      artworkUrl: activeSession.artworkUrl,
      source: activeSession.source,
      completed: true,
    };

    try {
      const id = await logPlayEvent(eventData);
      activeSession.loggedEventId = id;
      activeSession.isCompleted = true;
    } catch (err) {
      console.warn('[Analytics] Failed to log play event:', err);
    }
  } else if (activeSession.loggedEventId && Math.round(activeSession.accumulatedSec) % 10 === 0) {
    // Periodic update every 10 seconds
    try {
      await updatePlayEventDuration(
        activeSession.loggedEventId,
        Math.round(activeSession.accumulatedSec),
        activeSession.isCompleted
      );
    } catch {
      // ignore
    }
  }
}

export function initAnalyticsTracker() {
  if (isTrackerInitialized || typeof window === 'undefined') return;
  isTrackerInitialized = true;

  // Run initial seed from existing tracks if empty
  seedInitialStatsFromLibrary().catch((e) => console.warn('[Analytics] Seed error:', e));

  let lastTrackId: string | null = null;
  let lastIsPlaying = false;

  usePlayerStore.subscribe((state) => {
    const currentTrack = state.activeTrack;
    const isPlaying = state.isPlaying;

    const currentTrackId = currentTrack ? (currentTrack.id || currentTrack.title) : null;

    if (currentTrackId !== lastTrackId) {
      // Track changed
      finalizeActiveSession();

      lastTrackId = currentTrackId;

      if (currentTrack && isPlaying) {
        activeSession = {
          trackId: currentTrack.id,
          title: currentTrack.title,
          artist: currentTrack.artist,
          artists: currentTrack.artists,
          album: currentTrack.album,
          durationSec: currentTrack.durationSec || 0,
          artworkUrl: currentTrack.artworkUrl || currentTrack.thumbnail,
          source: currentTrack.source,
          startedAt: Date.now(),
          accumulatedSec: 0,
          loggedEventId: null,
          isCompleted: false,
        };
      }
    } else if (isPlaying && !lastIsPlaying && currentTrack) {
      // Resumed
      if (!activeSession) {
        activeSession = {
          trackId: currentTrack.id,
          title: currentTrack.title,
          artist: currentTrack.artist,
          artists: currentTrack.artists,
          album: currentTrack.album,
          durationSec: currentTrack.durationSec || 0,
          artworkUrl: currentTrack.artworkUrl || currentTrack.thumbnail,
          source: currentTrack.source,
          startedAt: Date.now(),
          accumulatedSec: 0,
          loggedEventId: null,
          isCompleted: false,
        };
      }
    }

    lastIsPlaying = isPlaying;
  });

  // Background 1-second pulse while playing
  if (!tickerInterval) {
    tickerInterval = setInterval(() => {
      const state = usePlayerStore.getState();
      if (state.isPlaying && activeSession) {
        activeSession.accumulatedSec += 1;
        checkAndLogSession();
      }
    }, 1000);
  }

  window.addEventListener('beforeunload', () => {
    finalizeActiveSession();
  });
}

export async function seedInitialStatsFromLibrary() {
  try {
    const count = await analyticsDb.playEvents.count();
    if (count > 0) return; // already has data

    const historyItems = await db.history.orderBy('playedAt').reverse().limit(100).toArray();
    if (!historyItems || historyItems.length === 0) return;

    const trackIds = historyItems.map((h) => h.trackId);
    const dbTracks = await db.tracks.where('id').anyOf(trackIds).toArray();
    const trackMap = new Map(dbTracks.map((t) => [t.id, t]));

    const eventsToInsert: Array<Omit<PlayEvent, 'id'>> = [];

    for (const h of historyItems) {
      const tr = trackMap.get(h.trackId);
      if (!tr) continue;

      const date = new Date(h.playedAt || Date.now());
      eventsToInsert.push({
        trackId: tr.id,
        title: tr.title,
        artist: tr.artist,
        artists: tr.artists,
        album: tr.album,
        durationSec: tr.durationSec || 180,
        listenedSec: tr.durationSec ? Math.max(30, tr.durationSec - 10) : 170,
        playedAt: h.playedAt || Date.now(),
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        isoWeek: getIsoWeekString(date),
        dayString: getDayString(date),
        hourOfDay: date.getHours(),
        dayOfWeek: date.getDay(),
        artworkUrl: tr.artworkUrl || tr.thumbnail,
        source: tr.source,
        completed: true,
      });
    }

    if (eventsToInsert.length > 0) {
      await analyticsDb.playEvents.bulkAdd(eventsToInsert);
    }
  } catch (err) {
    console.warn('[Analytics] Failed to seed from library:', err);
  }
}
