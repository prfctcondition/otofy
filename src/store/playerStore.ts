import { create } from 'zustand';
import type { Track, SourceType } from '../types';
import audioEngine from '../audio/AudioEngine';
import repo from '../db/repository';
import useToastStore from './toastStore';
import { useSettingsStore } from './settingsStore';
import { useDownloadStore } from './downloadStore';
import { useNetworkStore } from './networkStore';
import { useLibraryStore } from './libraryStore';

interface PlayerState {
  activeTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  isSeeking: boolean;
  isBuffering: boolean;
  playbackError: string | null;
  isCrossfading: boolean;
  isAutoplayLoading: boolean;
  isLoadingAutoplay: boolean;
  cachedTracks: Track[];
  playbackHistory: Track[];
  queueSource?: 'playlist' | 'album' | 'artist' | 'radio' | 'single';
}

interface PlayerActions {
  playTrack: (track: Track, queue?: Track[], source?: 'playlist' | 'album' | 'artist' | 'radio' | 'single') => Promise<void>;
  replayCurrentTrack: () => Promise<void>;
  setActiveTrackOnly: (track: Track) => void;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;
  seek: (time: number) => void;
  setIsSeeking: (seeking: boolean) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsBuffering: (buffering: boolean) => void;
  clearPlaybackError: () => void;
  toggleActiveTrackLike: (isLiked?: boolean) => void;
  jumpToQueueIndex: (index: number) => Promise<void>;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  initAudioListeners: () => () => void;
  appendAutoplayTracks: () => Promise<void>;
  startTrackRadio: (track: Track) => Promise<void>;
  getCachedTracks: () => Track[];
}

export const cleanTrackId = (id: string): string => {
  if (!id) return '';
  if (id.startsWith('wave-') || id.startsWith('track-') || id.startsWith('local-')) {
    return '';
  }
  if (id.startsWith('sc-') || id.startsWith('dm-sc-') || id.includes('-sc-')) {
    const scMatch = id.match(/(\d+)$/);
    if (scMatch) return scMatch[1];
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return id;
  }
  const ytMatch = id.match(/^(?:yt-|dm-yt-\d+-|artist-yt-[^-]+-\d+-|album-yt-\d+-)([a-zA-Z0-9_-]{11})$/);
  if (ytMatch) return ytMatch[1];

  const ytUrlMatch = id.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (ytUrlMatch) return ytUrlMatch[1];

  return id
    .replace(/^dm-(?:yt-|sc-)?\d+-\d+-/, '')
    .replace(/^dm-(?:yt-|sc-)?\d+-/, '')
    .replace(/^artist-(?:yt|sc)-[^-]+-\d+-/, '')
    .replace(/^album-(?:yt|sc)-\d+-/, '')
    .replace(/^(?:sc-|yt-|dm-)/, '');
};

export const parseDurationToSeconds = (dur: string | number | undefined | null): number => {
  if (typeof dur === 'number' && Number.isFinite(dur) && dur > 0) return dur;
  if (!dur || typeof dur !== 'string') return 0;
  const parts = dur.split(':').map((p) => parseFloat(p));
  if (parts.some((p) => isNaN(p))) return 0;
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
};

export const toPlayableStreamUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('/api/music/') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  // In Electron or file:// protocol, local proxy endpoint does not exist and Electron's
  // main process session already attaches CORS bypass headers to all CDN audio requests.
  if (typeof window !== 'undefined' && (Boolean(window.electronAPI) || window.location.protocol.startsWith('file'))) {
    return url;
  }
  // Any googlevideo CDN url lacks CORS headers; proxying through local streaming proxy
  // ensures standard CORS headers, range requests, and eliminates browser format/source errors.
  if (url.includes('googlevideo.com')) {
    return `/api/music/proxy-stream?url=${encodeURIComponent(url)}`;
  }
  return url;
};

let consecutiveErrorsCount = 0;
let hasLoggedCurrentTrackHistory = false;
let currentTrackHistoryId: string | null = null;
let activeTrackPlayDuration = 0;
let lastTimeUpdateTimestamp = 0;
let lastPositionSync = 0;
let lastDiscordSync = 0;
let lastPrevClickTime = 0;
let shufflePlayedIndices: number[] = [];
let plannedNextShuffleIndex: number | null = null;

const getNextShuffleQueueIndex = (queueLen: number, curIdx: number): number => {
  if (queueLen <= 1) return 0;
  let unplayed: number[] = [];
  for (let i = 0; i < queueLen; i++) {
    if (i !== curIdx && !shufflePlayedIndices.includes(i)) {
      unplayed.push(i);
    }
  }

  if (unplayed.length === 0) {
    shufflePlayedIndices = [];
    for (let i = 0; i < queueLen; i++) {
      if (i !== curIdx) {
        unplayed.push(i);
      }
    }
  }

  if (unplayed.length === 0) return 0;
  const randPos = Math.floor(Math.random() / (1 / unplayed.length));
  const chosen = unplayed[randPos];
  shufflePlayedIndices.push(chosen);
  return chosen;
};

const peekNextShuffleQueueIndex = (queueLen: number, curIdx: number): number => {
  if (queueLen <= 1) return 0;
  if (plannedNextShuffleIndex !== null && plannedNextShuffleIndex < queueLen && plannedNextShuffleIndex !== curIdx) {
    return plannedNextShuffleIndex;
  }
  plannedNextShuffleIndex = getNextShuffleQueueIndex(queueLen, curIdx);
  return plannedNextShuffleIndex;
};

const consumeNextShuffleQueueIndex = (queueLen: number, curIdx: number): number => {
  if (plannedNextShuffleIndex !== null && plannedNextShuffleIndex < queueLen && plannedNextShuffleIndex !== curIdx) {
    const next = plannedNextShuffleIndex;
    plannedNextShuffleIndex = null;
    return next;
  }
  plannedNextShuffleIndex = null;
  return getNextShuffleQueueIndex(queueLen, curIdx);
};

const resetShuffleHistory = (startingIndex?: number) => {
  plannedNextShuffleIndex = null;
  shufflePlayedIndices = typeof startingIndex === 'number' && startingIndex >= 0 ? [startingIndex] : [];
};

const resetTrackHistoryState = (newTrackId?: string | null) => {
  hasLoggedCurrentTrackHistory = false;
  currentTrackHistoryId = newTrackId || null;
  activeTrackPlayDuration = 0;
  lastTimeUpdateTimestamp = Date.now();
};

const commitTrackToHistory = async (track: Track | null | undefined) => {
  if (!track || !track.id) return;
  if (hasLoggedCurrentTrackHistory && currentTrackHistoryId === track.id) return;
  hasLoggedCurrentTrackHistory = true;
  currentTrackHistoryId = track.id;
  try {
    await repo.recordTrackHistory(track);
    const libState = useLibraryStore.getState();
    const isHistoryActive = libState.selectedPlaylistId === 'pl-history' || libState.viewingPlaylist?.id === 'pl-history';
    if (isHistoryActive) {
      await libState.refreshHistoryTracks();
    }
  } catch (err) {
    console.warn('[PlayerStore] commitTrackToHistory failed:', err);
  }
};

const syncDiscordPresence = (
  track: Track | null | undefined,
  isPlaying: boolean,
  currentSec: number,
  durationSec: number
) => {
  if (typeof window !== 'undefined' && window.electronAPI?.updateDiscordPresence) {
    if (!track || !isPlaying) {
      window.electronAPI.updateDiscordPresence({ isPlaying: false }).catch(() => {});
    } else {
      const dur =
        (Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0) ||
        track.durationSec ||
        (track.duration ? parseDurationToSeconds(track.duration) : 0) ||
        (usePlayerStore.getState().duration > 0 ? usePlayerStore.getState().duration : 0) ||
        0;

      window.electronAPI.updateDiscordPresence({
        title: track.title,
        artist: track.artist,
        source: track.source,
        durationSec: dur,
        currentSec,
        isPlaying: true,
        artworkUrl: track.artworkUrl || track.thumbnail,
      }).catch(() => {});
    }
  }
};

const getPlaybackFailureCopy = () => {
  const lang = useSettingsStore.getState().language || 'en';
  if (lang === 'ru') {
    return {
      title: 'Не удалось загрузить трек',
      message: 'Проверьте подключение к интернету или попробуйте включить трек чуть позже.',
    };
  }
  return {
    title: 'Could Not Load Track',
    message: 'Please check your internet connection or try playing this track again in a moment.',
  };
};

const notifyBotChallengeOrRepeatedErrors = async () => {
  const { title, message } = getPlaybackFailureCopy();
  useToastStore.getState().addToast({
    type: 'warning',
    title,
    message,
    duration: 6000,
  });
};

const resolveStreamUrl = async (track: Track, excludeIds: string[] = []): Promise<{ url: string; error?: string }> => {
  // 0. Check if track is downloaded locally on disk
  if (!excludeIds.length) {
    const dlState = useDownloadStore.getState().downloads[track.id];
    if (dlState?.status === 'completed' && dlState.filePath) {
      return { url: `atom://local/${encodeURIComponent(dlState.filePath)}` };
    }
    if (window.electronAPI?.checkDownloadStatus) {
      try {
        const statusMap = await window.electronAPI.checkDownloadStatus([track]);
        if (statusMap && statusMap[track.id]?.downloaded && statusMap[track.id]?.filePath) {
          return { url: `atom://local/${encodeURIComponent(statusMap[track.id].filePath!)}` };
        }
      } catch {}
    }
  }

  // 0.1 Check offline mode
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (!isOnline) {
    useToastStore.getState().warning(
      'Offline Mode',
      'You are offline. Only downloaded or cached tracks are available.'
    );
    return { url: '', error: 'You are offline. Only downloaded or cached tracks are available.' };
  }

  // If track already has a direct stream URL and no exclusions requested, check expiration
  if (track.streamUrl && !excludeIds.length) {
    if (track.streamUrl.includes('googlevideo.com')) {
      const match = track.streamUrl.match(/[?&]expire=(\d+)/);
      if (match && Date.now() < parseInt(match[1], 10) * 1000 - 120000) {
        return { url: toPlayableStreamUrl(track.streamUrl) };
      }
      delete track.streamUrl;
    } else if (track.streamUrl.startsWith('atom:') || track.streamUrl.startsWith('blob:')) {
      return { url: track.streamUrl };
    }
  }

  const rawId = (track.sourceId && !track.sourceId.startsWith('wave-') && !track.sourceId.startsWith('track-') && !track.sourceId.startsWith('local-'))
    ? track.sourceId
    : (track.id && !track.id.startsWith('wave-') && !track.id.startsWith('track-') && !track.id.startsWith('local-') ? track.id : '');
  const targetId = cleanTrackId(rawId);
  let lastError = '';

  // 1. Try Electron IPC resolver
  if (window.electronAPI && targetId) {
    try {
      const info = await window.electronAPI.resolveStream(
        targetId,
        track.source,
        track.title,
        track.artist,
        excludeIds,
        track.durationSec
      );
      if (info && info.url) return { url: toPlayableStreamUrl(info.url) };
    } catch (err: any) {
      console.warn('[Player] Stream resolve via Electron IPC failed:', err);
      lastError = err?.message || '';
    }
  }

  // 2. Try Vite dev server music resolver (only in standalone browser dev mode)
  if (!window.electronAPI) {
    try {
      const res = await fetch(
        `/api/music/resolve?id=${encodeURIComponent(targetId)}&source=${encodeURIComponent(track.source)}&title=${encodeURIComponent(track.title || '')}&artist=${encodeURIComponent(track.artist || '')}`
      );
      if (res.ok) {
        const info = await res.json();
        if (info && info.url) return { url: toPlayableStreamUrl(info.url) };
      } else {
        const errData = await res.json().catch(() => null);
        if (errData?.error) lastError = errData.error;
      }
    } catch (err: any) {
      lastError = err?.message || '';
    }
  }

  // 3. For SoundCloud tracks only, direct client-side fallback (no cross-source fallback for YouTube)
  if (track.source === 'SC') {
    try {
      const clientId = 'V7f0p2q7JD4voO1Esqg6bwwtNYcYAtLC';
      const scId = targetId;

      if (scId) {
        const trackRes = await fetch(`https://api-v2.soundcloud.com/tracks/${scId}?client_id=${clientId}`);
        if (trackRes.ok) {
          const trackData = await trackRes.json();
          const trans = trackData?.media?.transcodings?.find((t: any) => t.format?.protocol === 'progressive') ||
                        trackData?.media?.transcodings?.[0];
          if (trans && trans.url) {
            const streamRes = await fetch(`${trans.url}?client_id=${clientId}`);
            if (streamRes.ok) {
              const streamData = await streamRes.json();
              if (streamData?.url) return { url: toPlayableStreamUrl(streamData.url) };
            }
          }
        }
      }
    } catch (e: any) {
      console.warn('[Player] Direct SoundCloud stream resolve failed:', e);
      if (!lastError) lastError = e?.message || '';
    }
  }

  return { url: '', error: lastError };
};

let isRecoveringStream = false;

const attemptStreamFallback = async (
  failedTrack: Track,
  set: any,
  get: any
): Promise<boolean> => {
  if (isRecoveringStream) return false;
  isRecoveringStream = true;
  delete failedTrack.streamUrl;

  console.warn(`[Player] Primary stream failed for "${failedTrack.title}". Attempting automatic alternative fallback...`);
  set({ isBuffering: true, playbackError: null });

  try {
    const rawId = failedTrack.sourceId || failedTrack.id;
    const targetId = cleanTrackId(rawId);
    const { url: altUrl } = await resolveStreamUrl(failedTrack, [targetId]);

    if (altUrl) {
      await audioEngine.loadTrack(altUrl);
      await audioEngine.play();
      consecutiveErrorsCount = 0;
      failedTrack.streamUrl = altUrl;
      set((s: any) => ({
        isPlaying: true,
        isBuffering: false,
        playbackError: null,
        duration: audioEngine.duration || failedTrack.durationSec || 0,
        cachedTracks: s.cachedTracks.map((t: any) => (t.id === failedTrack.id ? { ...t, streamUrl: altUrl } : t)),
      }));
      useToastStore.getState().success(
        'Stream Restored',
        `Connected to alternative official source for "${failedTrack.title}".`
      );
      isRecoveringStream = false;
      return true;
    }
  } catch (err) {
    console.warn('[Player] Alternative stream recovery failed:', err);
  }

  isRecoveringStream = false;
  return false;
};

const STORAGE_KEY_VOLUME = 'otofy_saved_volume';
const STORAGE_KEY_LAST_TRACK = 'otofy_last_active_track';
const STORAGE_KEY_LAST_QUEUE = 'otofy_last_queue';
const STORAGE_KEY_LAST_QUEUE_INDEX = 'otofy_last_queue_index';
const STORAGE_KEY_LAST_QUEUE_SOURCE = 'otofy_last_queue_source';

export const getInitialSavedVolume = (): number => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VOLUME);
      if (saved !== null) {
        const val = parseFloat(saved);
        if (Number.isFinite(val) && val >= 0 && val <= 1) {
          return val;
        }
      }
    } catch {}
  }
  return 0.5; // Safe default (50%), strictly not 1.0
};

const sanitizeTrackForStorage = (t: Track): Track => {
  if (!t || !t.streamUrl || t.streamUrl.startsWith('atom:') || t.streamUrl.startsWith('blob:')) {
    return t;
  }
  const copy = { ...t };
  delete copy.streamUrl;
  return copy;
};

export const getInitialLastActiveTrack = (): Track | null => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LAST_TRACK);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.id && parsed.title) {
          return sanitizeTrackForStorage(parsed as Track);
        }
      }
    } catch {}
  }
  return null;
};

export const getInitialLastQueue = (): Track[] => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LAST_QUEUE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((t: Track) => sanitizeTrackForStorage(t));
        }
      }
    } catch {}
  }
  return [];
};

export const getInitialLastQueueIndex = (): number => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LAST_QUEUE_INDEX);
      if (raw !== null) {
        const parsed = parseInt(raw, 10);
        if (Number.isFinite(parsed) && parsed >= 0) {
          return parsed;
        }
      }
    } catch {}
  }
  return 0;
};

export const getInitialLastQueueSource = (): 'playlist' | 'album' | 'artist' | 'radio' | 'single' | undefined => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LAST_QUEUE_SOURCE);
      if (raw && ['playlist', 'album', 'artist', 'radio', 'single'].includes(raw)) {
        return raw as any;
      }
    } catch {}
  }
  return undefined;
};

const persistLastActiveTrack = (track: Track | null) => {
  if (!track || typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY_LAST_TRACK, JSON.stringify(sanitizeTrackForStorage(track)));
  } catch {}
};

const persistLastQueue = (queue: Track[], queueIndex: number, queueSource?: string) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const cleanQueue = queue.map((t) => sanitizeTrackForStorage(t));
    localStorage.setItem(STORAGE_KEY_LAST_QUEUE, JSON.stringify(cleanQueue));
    localStorage.setItem(STORAGE_KEY_LAST_QUEUE_INDEX, String(queueIndex));
    if (queueSource) {
      localStorage.setItem(STORAGE_KEY_LAST_QUEUE_SOURCE, queueSource);
    }
  } catch {}
};

const persistSavedVolume = (volume: number) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY_VOLUME, String(volume));
  } catch {}
};

const initialSavedTrack = getInitialLastActiveTrack();
const initialSavedVolume = getInitialSavedVolume();
const initialSavedQueue = getInitialLastQueue();
const initialSavedQueueIndex = getInitialLastQueueIndex();
const initialSavedQueueSource = getInitialLastQueueSource();

const resolvedInitialQueue = initialSavedQueue.length > 0 ? initialSavedQueue : (initialSavedTrack ? [initialSavedTrack] : []);
let resolvedInitialIndex = -1;
if (resolvedInitialQueue.length > 0) {
  if (initialSavedTrack) {
    const idx = resolvedInitialQueue.findIndex((t) => t.id === initialSavedTrack.id);
    resolvedInitialIndex = idx >= 0 ? idx : (initialSavedQueueIndex < resolvedInitialQueue.length ? initialSavedQueueIndex : 0);
  } else {
    resolvedInitialIndex = initialSavedQueueIndex < resolvedInitialQueue.length ? initialSavedQueueIndex : 0;
  }
}

const resolvedActiveTrack = initialSavedTrack || (resolvedInitialIndex >= 0 && resolvedInitialIndex < resolvedInitialQueue.length ? resolvedInitialQueue[resolvedInitialIndex] : null);

const initialTrackDuration = resolvedActiveTrack
  ? resolvedActiveTrack.durationSec || parseDurationToSeconds(resolvedActiveTrack.duration) || 0
  : 0;

export const usePlayerStore = create<PlayerState & PlayerActions>()((set, get) => ({
  activeTrack: resolvedActiveTrack,
  queue: resolvedInitialQueue,
  queueIndex: resolvedInitialIndex,
  queueSource: initialSavedQueueSource,
  isPlaying: false,
  currentTime: 0,
  duration: initialTrackDuration,
  volume: initialSavedVolume,
  isMuted: initialSavedVolume === 0,
  isShuffle: false,
  repeatMode: 'off',
  isSeeking: false,
  isBuffering: false,
  playbackError: null,
  isCrossfading: false,
  isAutoplayLoading: false,
  isLoadingAutoplay: false,
  cachedTracks: [],
  playbackHistory: [],
  getCachedTracks: () => get().cachedTracks,

  setIsSeeking: (seeking: boolean) => set({ isSeeking: seeking }),

  clearPlaybackError: () => set({ playbackError: null }),

  toggleActiveTrackLike: (isLiked?: boolean) => {
    const { activeTrack } = get();
    if (activeTrack) {
      const nextState = isLiked !== undefined ? isLiked : !activeTrack.isLiked;
      set({ activeTrack: { ...activeTrack, isLiked: nextState } });
    }
  },

  setActiveTrackOnly: (track: Track) => {
    const fallbackDur = track.durationSec || parseDurationToSeconds(track.duration) || 0;
    persistLastActiveTrack(track);
    persistLastQueue(get().queue, get().queueIndex, get().queueSource);
    set({
      activeTrack: track,
      duration: fallbackDur,
      currentTime: 0,
      playbackError: null,
    });
  },

  replayCurrentTrack: async () => {
    const { activeTrack } = get();
    if (!activeTrack) return;

    resetTrackHistoryState(null);
    lastDiscordSync = 0;
    lastPositionSync = 0;
    set({ currentTime: 0, isPlaying: true, isBuffering: true, playbackError: null });

    await get().playTrack(activeTrack);
  },

  playTrack: async (track, queue, queueSource) => {
    // Stop any existing audio immediately to prevent old track from continuing in background
    try {
      audioEngine.pause();
    } catch {}

    persistLastActiveTrack(track);

    const state = get();
    if (state.activeTrack && state.activeTrack.id !== track.id) {
      const nextHistory = [...state.playbackHistory, state.activeTrack];
      if (nextHistory.length > 100) nextHistory.shift();
      set({ playbackHistory: nextHistory });
    }
    const newQueue = queue || state.queue;
    const resolvedSource = queueSource || (queue ? 'playlist' : state.queueSource || 'single');
    let resolvedIndex = 0;
    if (queue) {
      const idx = queue.findIndex((t) => t.id === track.id);
      resolvedIndex = idx >= 0 ? idx : 0;
      resetShuffleHistory(resolvedIndex);
      set({ queue: newQueue, queueIndex: resolvedIndex, queueSource: resolvedSource });
    } else {
      const idx = state.queue.findIndex((t) => t.id === track.id);
      if (idx >= 0) {
        resolvedIndex = idx;
        set({ queueIndex: idx, queueSource: resolvedSource });
      }
    }
    persistLastQueue(newQueue, resolvedIndex, resolvedSource);

    // Always clear stale or expired remote URLs and reset fallback flags on explicit user track click
    delete (track as any)._fallbackTried;
    if (track.source !== 'LOCAL' && track.streamUrl) {
      if (track.streamUrl.includes('googlevideo.com')) {
        const match = track.streamUrl.match(/[?&]expire=(\d+)/);
        if (!match || Date.now() > parseInt(match[1], 10) * 1000 - 120000) {
          delete track.streamUrl;
        }
      }
    }

    const initialDur = track.durationSec || parseDurationToSeconds(track.duration) || 0;
    set({
      activeTrack: track,
      isBuffering: true,
      playbackError: null,
      currentTime: 0,
      duration: initialDur,
    });

    try {
      const { url, error } = await resolveStreamUrl(track);
      if (url) {
        await audioEngine.loadTrack(url);
        await audioEngine.play();
        consecutiveErrorsCount = 0;
        set((s) => {
          const exists = s.cachedTracks.some((t) => t.id === track.id);
          const audioDur = Number.isFinite(audioEngine.duration) && audioEngine.duration > 0 ? audioEngine.duration : 0;
          const finalDuration = audioDur || track.durationSec || parseDurationToSeconds(track.duration) || s.duration || 0;
          return {
            isPlaying: true,
            isBuffering: false,
            playbackError: null,
            duration: finalDuration,
            cachedTracks: exists
              ? s.cachedTracks.map((t) => (t.id === track.id ? { ...t, streamUrl: url } : t))
              : [...s.cachedTracks, { ...track, streamUrl: url }],
          };
        });

        // Background Prefetch next track in queue for seamless instant 0ms switching
        setTimeout(() => {
          const { queue: currentQueue, queueIndex: curIdx, isShuffle: shuffle } = get();
          if (currentQueue.length > 1) {
            let nextIdx: number;
            if (shuffle) {
              nextIdx = peekNextShuffleQueueIndex(currentQueue.length, curIdx);
            } else {
              nextIdx = curIdx + 1;
              if (nextIdx >= currentQueue.length) nextIdx = 0;
            }
            const nextTrackCandidate = currentQueue[nextIdx];
            if (nextTrackCandidate && !nextTrackCandidate.streamUrl) {
              resolveStreamUrl(nextTrackCandidate)
                .then(({ url: nextUrl }) => {
                  if (nextUrl) {
                    nextTrackCandidate.streamUrl = nextUrl;
                  }
                })
                .catch(() => {});
            }
          }
        }, 1500);
      } else {
        const recovered = await attemptStreamFallback(track, set, get);
        if (!recovered) {
          consecutiveErrorsCount++;
          const currentQueue = get().queue;
          if (consecutiveErrorsCount < 3 && currentQueue.length > 1) {
            console.warn(`[Player] Track "${track.title}" unavailable, advancing to next track...`);
            await get().nextTrack();
            return;
          }

          const { title: errTitle, message: netMsg } = getPlaybackFailureCopy();
          notifyBotChallengeOrRepeatedErrors();
          set({
            isPlaying: false,
            isBuffering: false,
            playbackError: netMsg,
          });
          return;
        }
      }
    } catch (err: any) {
      console.error('[Player] Playback failed:', err);
      const recovered = await attemptStreamFallback(track, set, get);
      if (!recovered) {
        consecutiveErrorsCount++;
        const currentQueue = get().queue;
        if (consecutiveErrorsCount < 3 && currentQueue.length > 1) {
          console.warn(`[Player] Playback failed for "${track.title}", advancing to next track...`);
          await get().nextTrack();
          return;
        }

        const { title: errTitle, message: netMsg } = getPlaybackFailureCopy();
        notifyBotChallengeOrRepeatedErrors();
        set({
          isPlaying: false,
          isBuffering: false,
          playbackError: netMsg,
        });
        return;
      }
    }

    // Reset listening history tracking for new track
    resetTrackHistoryState(track.id);
    lastPositionSync = 0;

    // Immediately record track to history on playback start
    commitTrackToHistory(track);

    // Update media session & SMTC
    audioEngine.setupMediaSession(
      {
        title: track.title,
        artist: track.artist,
        album: track.album || 'Otofy',
        artworkUrl: track.artworkUrl,
      },
      {
        onPlay: () => get().play(),
        onPause: () => get().pause(),
        onNext: () => get().nextTrack(),
        onPrev: () => get().prevTrack(),
        onSeek: (time) => get().seek(time),
      }
    );
    audioEngine.setPlaybackState('playing');

    const finalDur = track.durationSec || parseDurationToSeconds(track.duration) || get().duration || 0;
    syncDiscordPresence(track, true, 0, finalDur);
  },

  play: async () => {
    const { isPlaying, activeTrack, queue, queueSource } = get();
    if (!activeTrack) return;
    if (isPlaying) return;

    try {
      if (audioEngine.element.src && !audioEngine.element.error && audioEngine.element.readyState >= 2) {
        await audioEngine.play();
        set({ isPlaying: true, isBuffering: false });
        audioEngine.setPlaybackState('playing');
        const finalDur = activeTrack.durationSec || parseDurationToSeconds(activeTrack.duration) || get().duration || 0;
        syncDiscordPresence(activeTrack, true, get().currentTime, finalDur);
      } else {
        await get().playTrack(activeTrack, queue.length > 0 ? queue : undefined, queueSource);
      }
    } catch (err: any) {
      try {
        await get().playTrack(activeTrack, queue.length > 0 ? queue : undefined, queueSource);
      } catch (retryErr: any) {
        set({ isPlaying: false, isBuffering: false });
        audioEngine.setPlaybackState('paused');
        useToastStore.getState().error(
          'Playback Error',
          retryErr?.message || 'Browser blocked autoplay or stream is unavailable.'
        );
      }
    }
  },

  pause: () => {
    const { isPlaying, activeTrack } = get();
    if (!isPlaying) return;

    try {
      audioEngine.pause();
      set({ isPlaying: false });
      audioEngine.setPlaybackState('paused');
      if (activeTrack) {
        const finalDur = activeTrack.durationSec || parseDurationToSeconds(activeTrack.duration) || get().duration || 0;
        syncDiscordPresence(activeTrack, false, get().currentTime, finalDur);
      }
    } catch (err: any) {
      console.warn('[Player] Pause error:', err);
    }
  },

  togglePlay: async () => {
    const { isPlaying, activeTrack } = get();
    if (!activeTrack) return;

    if (isPlaying) {
      get().pause();
    } else {
      await get().play();
    }
  },

  appendAutoplayTracks: async () => {
    const { activeTrack, queue, isAutoplayLoading } = get();
    if (!activeTrack || isAutoplayLoading) return;
    if (!useSettingsStore.getState().autoplay) return;

    set({ isAutoplayLoading: true, isLoadingAutoplay: true, isBuffering: true });
    try {
      const source = activeTrack.source === 'SC' ? 'SC' : 'YT';
      const rawId = activeTrack.sourceId || activeTrack.id;
      const cleanId = cleanTrackId(rawId);
      let fetchedTracks: Track[] = [];

      // 1. Electron IPC call for native related / radio tracks
      if (window.electronAPI?.getRelatedTracks) {
        try {
          fetchedTracks = await window.electronAPI.getRelatedTracks(
            cleanId,
            source,
            activeTrack.artist,
            activeTrack.title
          );
        } catch (ipcErr) {
          console.warn('[Player] IPC getRelatedTracks failed:', ipcErr);
        }
      }

      // 2. Dev server fallback
      if (fetchedTracks.length === 0) {
        try {
          const res = await fetch(
            `/api/music/related-tracks?id=${encodeURIComponent(cleanId)}&source=${encodeURIComponent(source)}&artist=${encodeURIComponent(activeTrack.artist || '')}&title=${encodeURIComponent(activeTrack.title || '')}`
          );
          if (res.ok) {
            fetchedTracks = await res.json();
          }
        } catch (fetchErr) {
          console.warn('[Player] Dev server related-tracks failed:', fetchErr);
        }
      }

      // 3. Secondary fallback via genre tracks
      if (fetchedTracks.length === 0 && window.electronAPI?.getGenreTracks) {
        try {
          const query = activeTrack.artist || activeTrack.title;
          fetchedTracks = (await window.electronAPI.getGenreTracks(`${query} radio`)) as any;
        } catch {}
      }

      if (fetchedTracks && fetchedTracks.length > 0) {
        const currentQueue = get().queue;
        const existingIds = new Set<string>();
        const existingKeys = new Set<string>();

        // Build set of existing IDs and title-artist keys
        for (const t of currentQueue) {
          existingIds.add(t.id);
          if (t.sourceId) existingIds.add(t.sourceId);
          existingIds.add(cleanTrackId(t.id));
          existingKeys.add(`${t.title.toLowerCase().trim()} - ${t.artist.toLowerCase().trim()}`);
        }
        if (activeTrack) {
          existingIds.add(activeTrack.id);
          if (activeTrack.sourceId) existingIds.add(activeTrack.sourceId);
          existingIds.add(cleanTrackId(activeTrack.id));
          existingKeys.add(`${activeTrack.title.toLowerCase().trim()} - ${activeTrack.artist.toLowerCase().trim()}`);
        }

        const uniqueNewTracks: Track[] = [];
        for (const t of fetchedTracks) {
          const cid = cleanTrackId(t.id);
          const key = `${t.title.toLowerCase().trim()} - ${t.artist.toLowerCase().trim()}`;
          if (!existingIds.has(t.id) && !existingIds.has(cid) && !existingKeys.has(key)) {
            existingIds.add(t.id);
            existingIds.add(cid);
            existingKeys.add(key);
            uniqueNewTracks.push({
              ...t,
              id: t.source === 'SC' && !t.id.startsWith('sc-') ? `sc-${t.id}` : t.id,
            });
            if (uniqueNewTracks.length >= 20) break;
          }
        }

        if (uniqueNewTracks.length > 0) {
          const nextQueue = [...currentQueue, ...uniqueNewTracks];
          persistLastQueue(nextQueue, get().queueIndex, get().queueSource);
          set({ queue: nextQueue });
        }
      }
    } catch (err) {
      console.warn('[Player] Autoplay fetch failed:', err);
    } finally {
      set({ isAutoplayLoading: false, isLoadingAutoplay: false, isBuffering: false });
    }
  },

  startTrackRadio: async (track: Track) => {
    // 1. Reset queue to just this track, set active track, and play immediately
    set({
      queue: [track],
      queueIndex: 0,
      activeTrack: track,
    });
    await get().playTrack(track, [track]);

    useToastStore.getState().info(
      'Starting Radio',
      `Tuning into radio for "${track.title}"...`
    );

    try {
      const cleanId = cleanTrackId(track.sourceId || track.id);
      const source = (track.source || 'YT') as 'YT' | 'SC';
      let fetchedTracks: any[] = [];

      if (window.electronAPI?.getRelatedTracks) {
        try {
          fetchedTracks = await window.electronAPI.getRelatedTracks(
            cleanId,
            source,
            track.artist,
            track.title
          );
        } catch (ipcErr) {
          console.warn('[Player] IPC getRelatedTracks failed:', ipcErr);
        }
      }

      if (fetchedTracks.length === 0) {
        try {
          const res = await fetch(
            `/api/music/related-tracks?id=${encodeURIComponent(cleanId)}&source=${encodeURIComponent(source)}&artist=${encodeURIComponent(track.artist || '')}&title=${encodeURIComponent(track.title || '')}`
          );
          if (res.ok) {
            fetchedTracks = await res.json();
          }
        } catch (fetchErr) {
          console.warn('[Player] Dev server related-tracks failed:', fetchErr);
        }
      }

      if (fetchedTracks.length === 0 && window.electronAPI?.getGenreTracks) {
        try {
          const query = track.artist || track.title;
          fetchedTracks = (await window.electronAPI.getGenreTracks(`${query} radio`)) as any;
        } catch {}
      }

      if (fetchedTracks && fetchedTracks.length > 0) {
        const radioTracks: Track[] = fetchedTracks.map((t: any, idx: number) => ({
          id: t.id || `radio-${idx}-${Date.now()}`,
          number: idx + 2,
          title: t.title,
          artist: t.artist,
          album: t.album || 'Radio Mix',
          duration: t.duration || '3:30',
          durationSec: t.durationSec || 210,
          dateAdded: new Date().toISOString(),
          source: (t.source || 'YT') as SourceType,
          sourceLabel: t.sourceLabel || (t.source === 'SC' ? 'SoundCloud' : 'YouTube Music'),
          sourceId: t.sourceId || t.id,
          artworkUrl: t.artworkUrl,
          iconName: 'radio',
          gradientFrom: '#8B5CF6',
          gradientTo: '#EC4899',
          isLiked: false,
        }));

        for (const rt of radioTracks) {
          await repo.putTrack(rt).catch(() => {});
        }

        const newQueue = [track, ...radioTracks];
        persistLastQueue(newQueue, 0, 'radio');
        set({ queue: newQueue });

        useToastStore.getState().success(
          'Radio Connected',
          `Added ${radioTracks.length} related tracks to the queue.`
        );
      }
    } catch (err) {
      console.warn('[Player] startTrackRadio error:', err);
    }
  },

  nextTrack: async () => {
    const { queue, queueIndex, isShuffle, repeatMode, activeTrack, playbackHistory, queueSource } = get();
    if (queue.length === 0) return;

    if (activeTrack) {
      const nextHistory = [...playbackHistory, activeTrack];
      if (nextHistory.length > 100) nextHistory.shift();
      set({ playbackHistory: nextHistory });
    }

    const isPlaylistQueue = queueSource === 'playlist' || queueSource === 'album' || queueSource === 'artist';
    const isAtEnd = queueIndex >= queue.length - 1;
    if (isAtEnd) {
      if (repeatMode === 'one') {
        await get().replayCurrentTrack();
        return;
      }

      if (repeatMode === 'off' && useSettingsStore.getState().autoplay && !isPlaylistQueue) {
        await get().appendAutoplayTracks();
        const updatedQueue = get().queue;
        if (updatedQueue.length > queue.length) {
          await get().jumpToQueueIndex(queueIndex + 1);
          return;
        }
        // If autoplay could not load any tracks, stop cleanly at end of playlist
        set({ isPlaying: false });
        audioEngine.pause();
        return;
      }

      if (repeatMode === 'all') {
        const nextIdx = isShuffle ? consumeNextShuffleQueueIndex(queue.length, queueIndex) : 0;
        await get().jumpToQueueIndex(nextIdx);
        return;
      }

      // repeatMode === 'off' or playlist ended: stop playback cleanly at the end!
      set({ isPlaying: false, currentTime: 0 });
      audioEngine.pause();
      return;
    }

    let nextIdx: number;
    if (isShuffle) {
      nextIdx = consumeNextShuffleQueueIndex(queue.length, queueIndex);
    } else {
      nextIdx = queueIndex + 1;
    }
    await get().jumpToQueueIndex(nextIdx);
  },

  prevTrack: async () => {
    const { queue, queueIndex, currentTime, playbackHistory, isShuffle, repeatMode } = get();
    if (queue.length === 0) return;

    const now = Date.now();

    // Standard player behavior (Spotify/Apple Music):
    // If playing past 3s and not double-clicked within 1.5s: restart current track from beginning
    if (currentTime > 3 && now - lastPrevClickTime > 1500) {
      audioEngine.seek(0);
      set({ currentTime: 0 });
      lastPrevClickTime = now;
      return;
    }

    lastPrevClickTime = 0;

    // In Shuffle mode: return through playback history
    if (isShuffle && playbackHistory.length > 0) {
      const nextHistory = [...playbackHistory];
      const previousTrack = nextHistory.pop()!;
      set({ playbackHistory: nextHistory });

      const qIdx = queue.findIndex((t) => t.id === previousTrack.id);
      if (qIdx !== -1) {
        await get().jumpToQueueIndex(qIdx);
      } else {
        await get().playTrack(previousTrack);
      }
      return;
    }

    // In normal (linear) mode: move backward in queue if not at the start
    if (queueIndex > 0) {
      await get().jumpToQueueIndex(queueIndex - 1);
      return;
    }

    // At the beginning of the queue (queueIndex === 0):
    // Only wrap around to end of queue if repeatMode === 'all'
    if (repeatMode === 'all' && queue.length > 1) {
      await get().jumpToQueueIndex(queue.length - 1);
      return;
    }

    // Otherwise, restart the current track from 0:00
    audioEngine.seek(0);
    set({ currentTime: 0 });
  },

  seek: (time: number) => {
    if (!Number.isFinite(time) || time < 0) return;
    audioEngine.seek(time);
    set({ currentTime: time });
    lastPositionSync = time;
    audioEngine.updateMediaSessionPosition(time, get().duration, get().isPlaying);
    syncDiscordPresence(get().activeTrack, get().isPlaying, time, get().duration);
  },

  setVolume: (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    audioEngine.setMuted(false);
    audioEngine.setVolume(clamped);
    persistSavedVolume(clamped);
    set({ volume: clamped, isMuted: clamped === 0 });
  },

  toggleMute: () => {
    const { isMuted, volume } = get();
    if (isMuted) {
      const targetVol = volume > 0.05 ? volume : 0.5;
      audioEngine.setMuted(false);
      audioEngine.setVolume(targetVol);
      persistSavedVolume(targetVol);
      set({ isMuted: false, volume: targetVol });
    } else {
      audioEngine.setMuted(true);
      set({ isMuted: true });
    }
  },

  toggleShuffle: () => {
    const next = !get().isShuffle;
    if (next) {
      resetShuffleHistory(get().queueIndex);
    }
    set({ isShuffle: next });
  },

  cycleRepeat: () => {
    const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
    const next = modes[(modes.indexOf(get().repeatMode) + 1) % modes.length];
    set({ repeatMode: next });
  },

  setCurrentTime: (time: number) => set({ currentTime: time }),
  setDuration: (duration: number) => set({ duration: duration }),
  setIsPlaying: (playing: boolean) => set({ isPlaying: playing }),
  setIsBuffering: (buffering: boolean) => set({ isBuffering: buffering }),

  jumpToQueueIndex: async (index: number) => {
    const { queue, queueSource } = get();
    if (index >= 0 && index < queue.length) {
      persistLastQueue(queue, index, queueSource);
      await get().playTrack(queue[index]);
    }
  },

  removeFromQueue: (index: number) => {
    set((s) => {
      const nextQ = s.queue.filter((_, idx) => idx !== index);
      const nextIdx =
        index < s.queueIndex
          ? s.queueIndex - 1
          : index === s.queueIndex
          ? Math.min(s.queueIndex, nextQ.length - 1)
          : s.queueIndex;
      persistLastQueue(nextQ, nextIdx, s.queueSource);
      return { queue: nextQ, queueIndex: nextIdx };
    });
  },

  clearQueue: () => {
    persistLastQueue([], -1);
    set({ queue: [], queueIndex: -1, activeTrack: null, isPlaying: false });
    audioEngine.pause();
  },

  initAudioListeners: () => {
    const onTimeUpdate = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      if (target !== audioEngine.activeAudioElement) return;

      const current = target.currentTime;
      if (!Number.isFinite(current)) return;
      if (target.seeking || get().isSeeking) return;

      const rawDur = target.duration;
      let dur = get().duration;
      if (Number.isFinite(rawDur) && rawDur > 0) {
        dur = rawDur;
        if (get().duration !== rawDur) {
          set({ currentTime: current, duration: rawDur });
        } else {
          set({ currentTime: current });
        }
      } else {
        const active = get().activeTrack;
        const fallback = active?.durationSec || parseDurationToSeconds(active?.duration) || dur || 0;
        if (fallback > 0 && dur !== fallback) {
          dur = fallback;
          set({ currentTime: current, duration: fallback });
        } else {
          set({ currentTime: current });
        }
      }

      const active = get().activeTrack;

      // Sync SMTC position throttled (~1s interval)
      if (Math.abs(current - lastPositionSync) >= 1) {
        lastPositionSync = current;
        audioEngine.updateMediaSessionPosition(current, dur, get().isPlaying);
      }

      // Sync Discord Presence throttled (~5s interval)
      if (Math.abs(current - lastDiscordSync) >= 5 && get().isPlaying) {
        lastDiscordSync = current;
        syncDiscordPresence(active, true, current, dur);
      }

      // Crossfade Trigger Logic
      const settings = useSettingsStore.getState();
      const crossfadeEnabled = settings.crossfadeEnabled;
      const crossfadeDuration = settings.crossfadeDuration || 3;
      const timeRemaining = dur - current;
      const { isCrossfading, queue, queueIndex, isShuffle, repeatMode, isAutoplayLoading } = get();

      const isPlaylistQueue = get().queueSource === 'playlist' || get().queueSource === 'album' || get().queueSource === 'artist';

      // Proactive Autoplay Prefetch: only when playing single track or radio, NOT user playlists
      if (
        settings.autoplay &&
        !isPlaylistQueue &&
        repeatMode === 'off' &&
        queueIndex >= queue.length - 1 &&
        dur > 20 &&
        timeRemaining <= crossfadeDuration + 12 &&
        !isAutoplayLoading
      ) {
        get().appendAutoplayTracks();
      }

      if (
        crossfadeEnabled &&
        repeatMode !== 'one' &&
        dur > crossfadeDuration + crossfadeDuration &&
        timeRemaining <= crossfadeDuration &&
        timeRemaining > 0 &&
        !isCrossfading &&
        queue.length > 0
      ) {
        let nextIdx: number | null = null;
        if (isShuffle) {
          nextIdx = peekNextShuffleQueueIndex(queue.length, queueIndex);
        } else if (queueIndex < queue.length - 1) {
          nextIdx = queueIndex + 1;
        } else if (repeatMode === 'all') {
          nextIdx = 0;
        } else if (repeatMode === 'off' && settings.autoplay && !isPlaylistQueue) {
          if (queueIndex + 1 < queue.length) {
            nextIdx = queueIndex + 1;
          }
        }

        if (nextIdx !== null && nextIdx !== queueIndex && nextIdx < queue.length) {
          const nextTrack = queue[nextIdx];
          if (nextTrack) {
            set({ isCrossfading: true });
            resolveStreamUrl(nextTrack)
              .then(async ({ url }) => {
                if (url) {
                  const prevTrack = get().activeTrack;
                  if (prevTrack) {
                    commitTrackToHistory(prevTrack);
                    const curHistory = get().playbackHistory;
                    const nextHistory = [...curHistory, prevTrack];
                    if (nextHistory.length > 100) nextHistory.shift();
                    set({ playbackHistory: nextHistory });
                  }

                  await audioEngine.crossfadeTo(url, crossfadeDuration);
                  persistLastActiveTrack(nextTrack);
                  const validNextDur = nextTrack.durationSec || parseDurationToSeconds(nextTrack.duration) || 0;
                  set((s) => {
                    const exists = s.cachedTracks.some((t) => t.id === nextTrack.id);
                    return {
                      activeTrack: nextTrack,
                      queueIndex: nextIdx as number,
                      currentTime: 0,
                      duration: validNextDur,
                      isPlaying: true,
                      isBuffering: false,
                      cachedTracks: exists
                        ? s.cachedTracks.map((t) => (t.id === nextTrack.id ? { ...t, streamUrl: url } : t))
                        : [...s.cachedTracks, { ...nextTrack, streamUrl: url }],
                    };
                  });

                  if (isShuffle) {
                    consumeNextShuffleQueueIndex(queue.length, nextIdx as number);
                  }
                  // Reset history tracking for new track
                  resetTrackHistoryState(nextTrack.id);
                  commitTrackToHistory(nextTrack);
                  lastPositionSync = 0;
                  lastDiscordSync = 0;

                  // Update Media Session & SMTC
                  audioEngine.setupMediaSession(
                    {
                      title: nextTrack.title,
                      artist: nextTrack.artist,
                      album: nextTrack.album || 'Otofy',
                      artworkUrl: nextTrack.artworkUrl,
                    },
                    {
                      onPlay: () => get().play(),
                      onPause: () => get().pause(),
                      onNext: () => get().nextTrack(),
                      onPrev: () => get().prevTrack(),
                      onSeek: (time) => get().seek(time),
                    }
                  );
                  audioEngine.setPlaybackState('playing');

                  // Sync Discord Presence for next track immediately
                  syncDiscordPresence(nextTrack, true, 0, validNextDur);

                  setTimeout(() => {
                    set({ isCrossfading: false });
                  }, crossfadeDuration * 1000);
                } else {
                  set({ isCrossfading: false });
                }
              })
              .catch(() => {
                set({ isCrossfading: false });
              });
          }
        }
      }
    };

    const onDurationChange = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      if (target === audioEngine.activeAudioElement) {
        const rawDur = target.duration;
        if (Number.isFinite(rawDur) && rawDur > 0) {
          set({ duration: rawDur });
        } else {
          const active = get().activeTrack;
          const fallback = active?.durationSec || parseDurationToSeconds(active?.duration) || get().duration || 0;
          if (fallback > 0) {
            set({ duration: fallback });
          }
        }
      }
    };

    const onSeeked = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      if (target === audioEngine.activeAudioElement) {
        if (Number.isFinite(target.currentTime)) {
          set({ currentTime: target.currentTime });
          lastDiscordSync = target.currentTime;
          syncDiscordPresence(get().activeTrack, get().isPlaying, target.currentTime, get().duration);
          audioEngine.updateMediaSessionPosition(target.currentTime, get().duration, get().isPlaying);
        }
      }
    };

    const onEnded = async (e: Event) => {
      const target = e.target as HTMLAudioElement;
      if (target !== audioEngine.activeAudioElement) return;

      const { repeatMode, isCrossfading } = get();
      if (isCrossfading) return; // Handled by crossfade transition

      const active = get().activeTrack;
      if (active) {
        commitTrackToHistory(active);
      }

      if (repeatMode === 'one') {
        await get().replayCurrentTrack();
      } else {
        await get().nextTrack();
      }
    };

    const onPlay = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      if (target === audioEngine.activeAudioElement) {
        consecutiveErrorsCount = 0;
        set({ isPlaying: true, isBuffering: false });
        audioEngine.setPlaybackState('playing');
        lastDiscordSync = target.currentTime;
        syncDiscordPresence(get().activeTrack, true, target.currentTime, get().duration);
        const active = get().activeTrack;
        if (active) {
          commitTrackToHistory(active);
        }
      }
    };

    const onPause = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      if (target === audioEngine.activeAudioElement) {
        set({ isPlaying: false });
        audioEngine.setPlaybackState('paused');
        syncDiscordPresence(get().activeTrack, false, target.currentTime, get().duration);
      }
    };

    const onWaiting = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      if (target === audioEngine.activeAudioElement) {
        set({ isBuffering: true });
      }
    };

    const onCanPlay = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      if (target === audioEngine.activeAudioElement) {
        set({ isBuffering: false });
      }
    };

    const onError = async (e: Event) => {
      const target = e.target as HTMLAudioElement;
      if (target !== audioEngine.activeAudioElement) return;

      const currentTrack = get().activeTrack;
      if (currentTrack) {
        delete currentTrack.streamUrl;
        delete (currentTrack as any)._fallbackTried;
        set((s) => ({
          cachedTracks: s.cachedTracks.map((t) => (t.id === currentTrack.id ? { ...t, streamUrl: undefined } : t)),
        }));
        const recovered = await attemptStreamFallback(currentTrack, set, get);
        if (recovered) return;
      }

      consecutiveErrorsCount++;
      const currentQueue = get().queue;
      if (consecutiveErrorsCount < 3 && currentQueue.length > 1) {
        console.warn(`[Player] Audio error on "${currentTrack?.title}", advancing to next track...`);
        await get().nextTrack();
        return;
      }

      const { title: errTitle, message: netMsg } = getPlaybackFailureCopy();
      notifyBotChallengeOrRepeatedErrors();
      set({
        isPlaying: false,
        isBuffering: false,
        playbackError: netMsg,
      });
    };

    audioEngine.addEventListener('timeupdate', onTimeUpdate);
    audioEngine.addEventListener('durationchange', onDurationChange);
    audioEngine.addEventListener('seeked', onSeeked);
    audioEngine.addEventListener('ended', onEnded);
    audioEngine.addEventListener('play', onPlay);
    audioEngine.addEventListener('pause', onPause);
    audioEngine.addEventListener('waiting', onWaiting);
    audioEngine.addEventListener('canplay', onCanPlay);
    audioEngine.addEventListener('error', onError);

    // Register Electron auth session update listener
    let removeAuthSessionListener: (() => void) | undefined;
    if (window.electronAPI?.onAuthSessionUpdated) {
      removeAuthSessionListener = window.electronAPI.onAuthSessionUpdated((data) => {
        consecutiveErrorsCount = 0;
        set((s) => ({
          cachedTracks: s.cachedTracks.map((t) => {
            const copy = { ...t };
            delete copy.streamUrl;
            return copy;
          }),
          queue: s.queue.map((t) => {
            const copy = { ...t };
            delete copy.streamUrl;
            return copy;
          }),
        }));
        if (data.connected && data.platform === 'youtube') {
          useToastStore.getState().success(
            'Google Session Connected',
            'YouTube session is active. Rate limits lifted!'
          );
        }
      });
    }

    // Register Electron media key and player command listeners
    let removeMediaKeyListener: (() => void) | undefined;
    let removePlayerCommandListener: (() => void) | undefined;
    if (window.electronAPI) {
      if (window.electronAPI.onMediaKey) {
        removeMediaKeyListener = window.electronAPI.onMediaKey((key: string) => {
          switch (key) {
            case 'MediaPlayPause':
            case 'play-pause':
              get().togglePlay();
              break;
            case 'MediaNextTrack':
            case 'next':
              get().nextTrack();
              break;
            case 'MediaPreviousTrack':
            case 'prev':
              get().prevTrack();
              break;
          }
        });
      }
      if (window.electronAPI.onPlayerCommand) {
        removePlayerCommandListener = window.electronAPI.onPlayerCommand((cmd) => {
          switch (cmd) {
            case 'toggle-play':
              get().togglePlay();
              break;
            case 'next':
              get().nextTrack();
              break;
            case 'prev':
              get().prevTrack();
              break;
          }
        });
      }
    }

    return () => {
      audioEngine.removeEventListener('timeupdate', onTimeUpdate);
      audioEngine.removeEventListener('durationchange', onDurationChange);
      audioEngine.removeEventListener('seeked', onSeeked);
      audioEngine.removeEventListener('ended', onEnded);
      audioEngine.removeEventListener('play', onPlay);
      audioEngine.removeEventListener('pause', onPause);
      audioEngine.removeEventListener('waiting', onWaiting);
      audioEngine.removeEventListener('canplay', onCanPlay);
      audioEngine.removeEventListener('error', onError);
      removeMediaKeyListener?.();
      removePlayerCommandListener?.();
      removeAuthSessionListener?.();
    };
  },
}));

// Cold-start preparation: if last active track was restored, setup Media Session and pre-load stream in AudioEngine
if (typeof window !== 'undefined' && initialSavedTrack) {
  setTimeout(async () => {
    try {
      // 1. Setup Media Session metadata in paused state for Windows SMTC
      audioEngine.setupMediaSession(
        {
          title: initialSavedTrack.title,
          artist: initialSavedTrack.artist,
          album: initialSavedTrack.album || 'Otofy',
          artworkUrl: initialSavedTrack.artworkUrl,
        },
        {
          onPlay: () => usePlayerStore.getState().play(),
          onPause: () => usePlayerStore.getState().pause(),
          onNext: () => usePlayerStore.getState().nextTrack(),
          onPrev: () => usePlayerStore.getState().prevTrack(),
          onSeek: (time) => usePlayerStore.getState().seek(time),
        }
      );
      audioEngine.setPlaybackState('paused');
      audioEngine.setVolume(initialSavedVolume);

      // 2. Pre-resolve stream URL in background so clicking Play is instantaneous
      const { url } = await resolveStreamUrl(initialSavedTrack);
      if (url && !usePlayerStore.getState().isPlaying) {
        await audioEngine.loadTrack(url);
      }
    } catch (err) {
      console.warn('[PlayerStore] Cold start preparation failed:', err);
    }
  }, 100);
}
