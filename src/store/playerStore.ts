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
}

interface PlayerActions {
  playTrack: (track: Track, queue?: Track[]) => Promise<void>;
  setActiveTrackOnly: (track: Track) => void;
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
  if (id.startsWith('sc-') || id.startsWith('dm-sc-') || id.includes('-sc-')) {
    const scMatch = id.match(/(\d+)$/);
    if (scMatch) return scMatch[1];
  }
  const ytMatch = id.match(/([a-zA-Z0-9_-]{11})$/);
  if (ytMatch) return ytMatch[1];

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
    if (useLibraryStore.getState().selectedPlaylistId === 'pl-history') {
      await useLibraryStore.getState().refreshHistoryTracks();
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

const notifyBotChallengeOrRepeatedErrors = async () => {
  let isGoogleConnected = false;
  if (window.electronAPI?.getAccountStatus) {
    try {
      const status = await window.electronAPI.getAccountStatus();
      isGoogleConnected = Boolean(status?.youtube?.connected);
    } catch {}
  }

  if (isGoogleConnected) {
    useToastStore.getState().addToast({
      type: 'warning',
      title: 'Audio Stream Throttled',
      message: 'YouTube restricted the current audio stream. Automatically searching for an official alternative...',
      duration: 5000,
    });
    return;
  }

  useToastStore.getState().addToast({
    type: 'warning',
    title: 'Playback Difficulties Detected',
    message:
      'YouTube may have temporarily rate-limited requests from your IP. You can wait a moment or connect your Google account in Settings to lift network limits.',
    duration: 12000,
    action: {
      label: 'Connect Account',
      onClick: () => {
        if (!useLibraryStore.getState().isSyncModalOpen) {
          useLibraryStore.getState().toggleSyncModal();
        }
      },
    },
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

  const rawId = track.sourceId || track.id;
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
      const clientId = 'y7xP5e50k2cT7Uo3n30zG6jPffV4d00B';
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

export const getInitialLastActiveTrack = (): Track | null => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LAST_TRACK);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.id && parsed.title) {
          return parsed as Track;
        }
      }
    } catch {}
  }
  return null;
};

const persistLastActiveTrack = (track: Track | null) => {
  if (!track || typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY_LAST_TRACK, JSON.stringify(track));
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
const initialTrackDuration = initialSavedTrack
  ? initialSavedTrack.durationSec || parseDurationToSeconds(initialSavedTrack.duration) || 0
  : 0;

export const usePlayerStore = create<PlayerState & PlayerActions>()((set, get) => ({
  activeTrack: initialSavedTrack,
  queue: initialSavedTrack ? [initialSavedTrack] : [],
  queueIndex: initialSavedTrack ? 0 : -1,
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
    set({
      activeTrack: track,
      duration: fallbackDur,
      currentTime: 0,
      playbackError: null,
    });
  },

  playTrack: async (track, queue) => {
    // Stop any existing audio immediately to prevent old track from continuing in background
    try {
      audioEngine.pause();
    } catch {}

    persistLastActiveTrack(track);

    const state = get();
    const newQueue = queue || state.queue;
    if (queue) {
      const idx = queue.findIndex((t) => t.id === track.id);
      set({ queue: newQueue, queueIndex: idx >= 0 ? idx : 0 });
    } else {
      const idx = state.queue.findIndex((t) => t.id === track.id);
      if (idx >= 0) set({ queueIndex: idx });
    }

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
              nextIdx = Math.floor(Math.random() * currentQueue.length);
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
          const isBot = Boolean(
            error?.includes('YOUTUBE_BOT_CHALLENGE') ||
            error?.includes('Sign in to confirm') ||
            (error && /bot/i.test(error))
          );

          if (isBot || consecutiveErrorsCount >= 2) {
            notifyBotChallengeOrRepeatedErrors();
            set({
              isPlaying: false,
              isBuffering: false,
              playbackError: 'YouTube requires sign-in or frequent request limit reached.',
            });
          } else {
            const errMsg = error || 'Audio stream not found. The track may be restricted in your region.';
            set({ isPlaying: false, isBuffering: false, playbackError: errMsg });
            useToastStore.getState().error(
              `Failed to play "${track.title}"`,
              errMsg
            );
          }
        }
      }
    } catch (err: any) {
      console.error('[Player] Playback failed:', err);
      const recovered = await attemptStreamFallback(track, set, get);
      if (!recovered) {
        consecutiveErrorsCount++;
        const isBot = Boolean(
          err?.message?.includes('YOUTUBE_BOT_CHALLENGE') ||
          err?.message?.includes('Sign in to confirm') ||
          (err?.message && /bot/i.test(err.message))
        );

        if (isBot || consecutiveErrorsCount >= 2) {
          notifyBotChallengeOrRepeatedErrors();
          set({
            isPlaying: false,
            isBuffering: false,
            playbackError: 'YouTube requires sign-in or frequent request limit reached.',
          });
        } else {
          const errMsg = err?.message || 'Audio stream unavailable in your region.';
          set({ isPlaying: false, isBuffering: false, playbackError: errMsg });
          useToastStore.getState().error(
            `Playback error: "${track.title}"`,
            errMsg
          );
        }
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
        onPlay: () => get().togglePlay(),
        onPause: () => get().togglePlay(),
        onNext: () => get().nextTrack(),
        onPrev: () => get().prevTrack(),
        onSeek: (time) => get().seek(time),
      }
    );
    audioEngine.setPlaybackState('playing');

    const finalDur = track.durationSec || parseDurationToSeconds(track.duration) || get().duration || 0;
    syncDiscordPresence(track, true, 0, finalDur);
  },

  togglePlay: async () => {
    const { isPlaying, activeTrack } = get();
    if (!activeTrack) return;

    try {
      if (audioEngine.element.src) {
        await audioEngine.togglePlay();
        const nextPlaying = !isPlaying;
        set({ isPlaying: nextPlaying });
        audioEngine.setPlaybackState(nextPlaying ? 'playing' : 'paused');
      } else {
        // First play for the active track
        await get().playTrack(activeTrack);
      }
    } catch (err: any) {
      set({ isPlaying: false, isBuffering: false });
      audioEngine.setPlaybackState('paused');
      useToastStore.getState().error(
        'Playback Error',
        err?.message || 'Browser blocked autoplay or stream is unavailable.'
      );
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
          set({ queue: [...currentQueue, ...uniqueNewTracks] });
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
    const { queue, queueIndex, isShuffle, repeatMode, activeTrack, playbackHistory } = get();
    if (queue.length === 0) return;

    if (activeTrack) {
      const nextHistory = [...playbackHistory, activeTrack];
      if (nextHistory.length > 100) nextHistory.shift();
      set({ playbackHistory: nextHistory });
    }

    const isAtEnd = queueIndex >= queue.length - 1;
    if (isAtEnd) {
      if (repeatMode === 'one') {
        audioEngine.seek(0);
        await audioEngine.play();
        return;
      }

      if (repeatMode === 'off' && useSettingsStore.getState().autoplay) {
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
        const nextIdx = isShuffle ? Math.floor(Math.random() * queue.length) : 0;
        await get().jumpToQueueIndex(nextIdx);
        return;
      }

      // repeatMode === 'off' and autoplay disabled: stop playback cleanly at the end!
      set({ isPlaying: false, currentTime: 0 });
      audioEngine.pause();
      return;
    }

    let nextIdx: number;
    if (isShuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else {
      nextIdx = queueIndex + 1;
    }
    await get().jumpToQueueIndex(nextIdx);
  },

  prevTrack: async () => {
    const { queue, queueIndex, currentTime, playbackHistory } = get();
    if (queue.length === 0) return;

    const now = Date.now();

    // Case 1 (Seek past 10s without double-click): restart current track
    if (currentTime > 10 && now - lastPrevClickTime > 2000) {
      audioEngine.seek(0);
      set({ currentTime: 0 });
      lastPrevClickTime = now;
      return;
    }

    // Case 2 (Within first 10s OR double-click within 2s):
    lastPrevClickTime = 0;

    if (playbackHistory.length > 0) {
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

    const prevIdx = queueIndex === 0 ? queue.length - 1 : queueIndex - 1;
    await get().jumpToQueueIndex(prevIdx);
  },

  seek: (time: number) => {
    if (!Number.isFinite(time) || time < 0) return;
    audioEngine.seek(time);
    set({ currentTime: time });
    lastPositionSync = time;
    audioEngine.updateMediaSessionPosition(time, get().duration);
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
    set((s) => ({ isShuffle: !s.isShuffle }));
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
    const { queue } = get();
    if (index >= 0 && index < queue.length) {
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
      return { queue: nextQ, queueIndex: nextIdx };
    });
  },

  clearQueue: () => {
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
        audioEngine.updateMediaSessionPosition(current, dur);
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

      // Proactive Autoplay Prefetch: If playing the last track with autoplay ON and repeat OFF,
      // begin loading recommendations ~15s before track ends so crossfade already has the track ready!
      if (
        settings.autoplay &&
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
        dur > crossfadeDuration * 2 &&
        timeRemaining <= crossfadeDuration &&
        timeRemaining > 0 &&
        !isCrossfading &&
        queue.length > 0
      ) {
        let nextIdx: number | null = null;
        if (isShuffle) {
          nextIdx = Math.floor(Math.random() * queue.length);
        } else if (queueIndex < queue.length - 1) {
          nextIdx = queueIndex + 1;
        } else if (repeatMode === 'all') {
          nextIdx = 0;
        } else if (repeatMode === 'off' && settings.autoplay) {
          // If queue was extended by prefetch, transition into next track
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
                      onPlay: () => get().togglePlay(),
                      onPause: () => get().togglePlay(),
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
        }
      }
    };

    const onEnded = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      if (target !== audioEngine.activeAudioElement) return;

      const { repeatMode, isCrossfading } = get();
      if (isCrossfading) return; // Handled by crossfade transition

      const active = get().activeTrack;
      if (active) {
        commitTrackToHistory(active);
      }

      if (repeatMode === 'one') {
        resetTrackHistoryState(active?.id);
        audioEngine.seek(0);
        audioEngine.play();
        commitTrackToHistory(active);
        lastDiscordSync = 0;
        syncDiscordPresence(get().activeTrack, true, 0, get().duration);
      } else {
        get().nextTrack();
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
      if (consecutiveErrorsCount >= 2) {
        notifyBotChallengeOrRepeatedErrors();
        set({
          isPlaying: false,
          isBuffering: false,
          playbackError: 'YouTube requires sign-in or frequent request limit reached.',
        });
        return;
      }

      const errorCode = target.error?.code;
      let errorMsg = 'Failed to load audio stream.';
      if (errorCode === 4) {
        errorMsg = 'Format not supported or audio stream URL has expired.';
      } else if (errorCode === 2) {
        errorMsg = 'Network error while loading audio stream.';
      } else if (errorCode === 3) {
        errorMsg = 'Audio decoding error.';
      }
      const trackTitle = currentTrack ? `"${currentTrack.title}"` : 'track';
      set({ isPlaying: false, isBuffering: false, playbackError: errorMsg });
      useToastStore.getState().error(
        `Playback failure: ${trackTitle}`,
        errorMsg
      );
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

    // Register Electron media key listener
    let removeMediaKeyListener: (() => void) | undefined;
    if (window.electronAPI) {
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
          onPlay: () => usePlayerStore.getState().togglePlay(),
          onPause: () => usePlayerStore.getState().togglePlay(),
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
