import { create } from 'zustand';
import type { Track } from '../types';
import audioEngine from '../audio/AudioEngine';
import useToastStore from './toastStore';
import { useSettingsStore } from './settingsStore';
import { useDownloadStore } from './downloadStore';
import { useNetworkStore } from './networkStore';

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
  isBuffering: boolean;
  playbackError: string | null;
  isCrossfading: boolean;
  isAutoplayLoading: boolean;
  isLoadingAutoplay: boolean;
  cachedTracks: Track[];
}

interface PlayerActions {
  playTrack: (track: Track, queue?: Track[]) => Promise<void>;
  setActiveTrackOnly: (track: Track) => void;
  togglePlay: () => Promise<void>;
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;
  seek: (time: number) => void;
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
  getCachedTracks: () => Track[];
}

export const cleanTrackId = (id: string): string => {
  if (!id) return '';
  if (id.startsWith('sc-') || id.startsWith('dm-sc-') || id.includes('-sc-')) {
    const scMatch = id.match(/(\d+)$/);
    if (scMatch) return scMatch[1];
  }
  return id
    .replace(/^dm-(?:yt-|sc-)?\d+-\d+-/, '')
    .replace(/^dm-(?:yt-|sc-)?\d+-/, '')
    .replace(/^artist-(?:yt|sc)-[^-]+-\d+-/, '')
    .replace(/^album-(?:yt|sc)-\d+-/, '')
    .replace(/^(?:sc-|yt-|dm-)/, '');
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

  // If track already has a direct stream URL and no exclusions requested, use it
  if (track.streamUrl && !excludeIds.length) return { url: toPlayableStreamUrl(track.streamUrl) };

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
        excludeIds
      );
      if (info && info.url) return { url: toPlayableStreamUrl(info.url) };
    } catch (err: any) {
      console.warn('[Player] Stream resolve via Electron IPC failed:', err);
      lastError = err?.message || '';
    }
  }

  // 2. Try Vite dev server music resolver
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

  // 3. Client-side fallback to SoundCloud public API v2
  try {
    const clientId = 'y7xP5e50k2cT7Uo3n30zG6jPffV4d00B';
    let scId = targetId;

    // If it is a YouTube track, search SoundCloud for the song title
    if (track.source === 'YT') {
      const query = `${track.title} ${track.artist}`.trim();
      const scSearchRes = await fetch(
        `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=3`
      );
      if (scSearchRes.ok) {
        const scSearchData = await scSearchRes.json();
        if (scSearchData.collection && scSearchData.collection.length > 0) {
          scId = String(scSearchData.collection[0].id);
        }
      }
    }

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

    // Secondary fallback search by title & artist on SoundCloud
    const query = `${track.title} ${track.artist}`.trim();
    const scFallback = await fetch(
      `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=3`
    );
    if (scFallback.ok) {
      const data = await scFallback.json();
      if (data.collection && data.collection.length > 0) {
        const best = data.collection[0];
        const trans = best?.media?.transcodings?.find((t: any) => t.format?.protocol === 'progressive') ||
                      best?.media?.transcodings?.[0];
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
    console.warn('[Player] Direct stream resolve failed:', e);
    if (!lastError) lastError = e?.message || '';
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
  if ((failedTrack as any)._fallbackTried) return false;
  (failedTrack as any)._fallbackTried = true;
  isRecoveringStream = true;

  console.warn(`[Player] Primary stream failed for "${failedTrack.title}". Attempting automatic alternative fallback...`);
  set({ isBuffering: true, playbackError: null });

  useToastStore.getState().info(
    'Switching Stream',
    `Primary stream unavailable in your region. Finding alternative source for "${failedTrack.title}"...`
  );

  try {
    const rawId = failedTrack.sourceId || failedTrack.id;
    const targetId = cleanTrackId(rawId);
    const { url: altUrl } = await resolveStreamUrl(failedTrack, [targetId]);

    if (altUrl) {
      await audioEngine.loadTrack(altUrl);
      await audioEngine.play();
      set((s: any) => ({
        isPlaying: true,
        isBuffering: false,
        playbackError: null,
        duration: audioEngine.duration || failedTrack.durationSec || 0,
        cachedTracks: s.cachedTracks.map((t: any) => (t.id === failedTrack.id ? { ...t, streamUrl: altUrl } : t)),
      }));
      useToastStore.getState().success(
        'Stream Restored',
        `Connected to alternative source for "${failedTrack.title}".`
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

export const usePlayerStore = create<PlayerState & PlayerActions>()((set, get) => ({
  activeTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.78,
  isMuted: false,
  isShuffle: false,
  repeatMode: 'off',
  isBuffering: false,
  playbackError: null,
  isCrossfading: false,
  isAutoplayLoading: false,
  isLoadingAutoplay: false,
  cachedTracks: [],
  getCachedTracks: () => get().cachedTracks,

  clearPlaybackError: () => set({ playbackError: null }),

  toggleActiveTrackLike: (isLiked?: boolean) => {
    const { activeTrack } = get();
    if (activeTrack) {
      const nextState = isLiked !== undefined ? isLiked : !activeTrack.isLiked;
      set({ activeTrack: { ...activeTrack, isLiked: nextState } });
    }
  },

  setActiveTrackOnly: (track: Track) => {
    set({
      activeTrack: track,
      duration: track.durationSec || 0,
      currentTime: 0,
      playbackError: null,
    });
  },

  playTrack: async (track, queue) => {
    // Stop any existing audio immediately to prevent old track from continuing in background
    try {
      audioEngine.pause();
    } catch {}

    const state = get();
    const newQueue = queue || state.queue;
    if (queue) {
      const idx = queue.findIndex((t) => t.id === track.id);
      set({ queue: newQueue, queueIndex: idx >= 0 ? idx : 0 });
    } else {
      const idx = state.queue.findIndex((t) => t.id === track.id);
      if (idx >= 0) set({ queueIndex: idx });
    }

    set({
      activeTrack: track,
      isBuffering: true,
      playbackError: null,
      currentTime: 0,
      duration: track.durationSec || 0,
    });

    try {
      const { url, error } = await resolveStreamUrl(track);
      if (url) {
        await audioEngine.loadTrack(url);
        await audioEngine.play();
        set((s) => {
          const exists = s.cachedTracks.some((t) => t.id === track.id);
          return {
            isPlaying: true,
            isBuffering: false,
            playbackError: null,
            duration: audioEngine.duration || track.durationSec || 0,
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
          const errMsg = error || 'Audio stream not found. The track may be restricted in your region.';
          set({ isPlaying: false, isBuffering: false, playbackError: errMsg });
          useToastStore.getState().error(
            `Failed to play "${track.title}"`,
            errMsg
          );
        }
      }
    } catch (err: any) {
      console.error('[Player] Playback failed:', err);
      const recovered = await attemptStreamFallback(track, set, get);
      if (!recovered) {
        const errMsg = 'Audio stream unavailable in your region due to copyright restrictions.';
        set({ isPlaying: false, isBuffering: false, playbackError: errMsg });
        useToastStore.getState().error(
          `Playback error: "${track.title}"`,
          errMsg
        );
      }
    }

    // Update media session
    audioEngine.setupMediaSession(
      {
        title: track.title,
        artist: track.artist,
        album: track.album,
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
  },

  togglePlay: async () => {
    const { isPlaying, activeTrack } = get();
    if (!activeTrack) return;

    try {
      if (audioEngine.element.src) {
        await audioEngine.togglePlay();
        set({ isPlaying: !isPlaying });
      } else {
        // First play for the active track
        await get().playTrack(activeTrack);
      }
    } catch (err: any) {
      set({ isPlaying: false, isBuffering: false });
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

  nextTrack: async () => {
    const { queue, queueIndex, isShuffle, repeatMode } = get();
    if (queue.length === 0) return;

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
    const { queue, queueIndex } = get();
    if (queue.length === 0) return;

    const prevIdx = queueIndex === 0 ? queue.length - 1 : queueIndex - 1;
    await get().jumpToQueueIndex(prevIdx);
  },

  seek: (time: number) => {
    audioEngine.seek(time);
    set({ currentTime: time });
  },

  setVolume: (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    audioEngine.setVolume(clamped);
    set({ volume: clamped, isMuted: clamped === 0 });
  },

  toggleMute: () => {
    const { isMuted, volume } = get();
    if (isMuted) {
      const targetVol = volume > 0.05 ? volume : 0.5;
      audioEngine.setVolume(targetVol);
      set({ isMuted: false, volume: targetVol });
    } else {
      audioEngine.setVolume(0);
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
      const dur = target.duration || get().duration || 0;
      set({ currentTime: current });

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
                  await audioEngine.crossfadeTo(url, crossfadeDuration);
                  set((s) => {
                    const exists = s.cachedTracks.some((t) => t.id === nextTrack.id);
                    return {
                      activeTrack: nextTrack,
                      queueIndex: nextIdx as number,
                      currentTime: 0,
                      duration: nextTrack.durationSec || 0,
                      isPlaying: true,
                      isBuffering: false,
                      cachedTracks: exists
                        ? s.cachedTracks.map((t) => (t.id === nextTrack.id ? { ...t, streamUrl: url } : t))
                        : [...s.cachedTracks, { ...nextTrack, streamUrl: url }],
                    };
                  });
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
        set({ duration: target.duration || 0 });
      }
    };

    const onEnded = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      if (target !== audioEngine.activeAudioElement) return;

      const { repeatMode, isCrossfading } = get();
      if (isCrossfading) return; // Handled by crossfade transition

      if (repeatMode === 'one') {
        audioEngine.seek(0);
        audioEngine.play();
      } else {
        get().nextTrack();
      }
    };

    const onPlay = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      if (target === audioEngine.activeAudioElement) {
        set({ isPlaying: true, isBuffering: false });
      }
    };

    const onPause = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      if (target === audioEngine.activeAudioElement) {
        set({ isPlaying: false });
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
        const recovered = await attemptStreamFallback(currentTrack, set, get);
        if (recovered) return;
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
    audioEngine.addEventListener('ended', onEnded);
    audioEngine.addEventListener('play', onPlay);
    audioEngine.addEventListener('pause', onPause);
    audioEngine.addEventListener('waiting', onWaiting);
    audioEngine.addEventListener('canplay', onCanPlay);
    audioEngine.addEventListener('error', onError);

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
      audioEngine.removeEventListener('ended', onEnded);
      audioEngine.removeEventListener('play', onPlay);
      audioEngine.removeEventListener('pause', onPause);
      audioEngine.removeEventListener('waiting', onWaiting);
      audioEngine.removeEventListener('canplay', onCanPlay);
      audioEngine.removeEventListener('error', onError);
      removeMediaKeyListener?.();
    };
  },
}));
