import { create } from 'zustand';
import type { Track } from '../types';
import audioEngine from '../audio/AudioEngine';
import useToastStore from './toastStore';
import { useSettingsStore } from './settingsStore';

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

const resolveStreamUrl = async (track: Track): Promise<{ url: string; error?: string }> => {
  // If track already has a direct stream URL, use it
  if (track.streamUrl) return { url: toPlayableStreamUrl(track.streamUrl) };

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
        track.artist
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
        set({
          isPlaying: true,
          isBuffering: false,
          playbackError: null,
          duration: audioEngine.duration || track.durationSec || 0,
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
        const errMsg = error || 'Audio stream not found. The track may be restricted by the copyright owner.';
        set({ isPlaying: false, isBuffering: false, playbackError: errMsg });
        useToastStore.getState().error(
          `Failed to play "${track.title}"`,
          errMsg
        );
      }
    } catch (err: any) {
      console.error('[Player] Playback failed:', err);
      const errMsg = err?.message || 'Failed to decode or start audio stream.';
      set({ isPlaying: false, isBuffering: false, playbackError: errMsg });
      useToastStore.getState().error(
        `Playback error: "${track.title}"`,
        errMsg
      );
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
    set({ isAutoplayLoading: true });
    try {
      if (window.electronAPI?.getGenreTracks) {
        const query = activeTrack.artist || activeTrack.title;
        const tracks = await window.electronAPI.getGenreTracks(`${query} radio`);
        if (tracks && tracks.length > 0) {
          const existingIds = new Set(queue.map((t) => t.id));
          const newTracks = tracks.filter((t) => !existingIds.has(t.id));
          if (newTracks.length > 0) {
            set({ queue: [...queue, ...newTracks] });
          }
        }
      }
    } catch (err) {
      console.warn('[Player] Autoplay fetch failed:', err);
    } finally {
      set({ isAutoplayLoading: false });
    }
  },

  nextTrack: async () => {
    const { queue, queueIndex, isShuffle, repeatMode } = get();
    if (queue.length === 0) return;

    if (queueIndex >= queue.length - 1 && useSettingsStore.getState().autoplay) {
      await get().appendAutoplayTracks();
      const updatedQueue = get().queue;
      if (updatedQueue.length > queue.length) {
        await get().jumpToQueueIndex(queueIndex + 1);
        return;
      }
    }

    let nextIdx: number;
    if (isShuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else {
      nextIdx = (queueIndex + 1) % queue.length;
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
      const { isCrossfading, queue, queueIndex, isShuffle } = get();

      const timeRemaining = dur - current;
      if (
        crossfadeEnabled &&
        dur > crossfadeDuration * 2 &&
        timeRemaining <= crossfadeDuration &&
        timeRemaining > 0 &&
        !isCrossfading &&
        queue.length > 0
      ) {
        let nextIdx = isShuffle ? Math.floor(Math.random() * queue.length) : queueIndex + 1;
        if (nextIdx >= queue.length) {
          if (settings.autoplay) {
            get().appendAutoplayTracks();
          }
          nextIdx = 0;
        }

        const nextTrack = queue[nextIdx];
        if (nextTrack && nextIdx !== queueIndex) {
          set({ isCrossfading: true });
          resolveStreamUrl(nextTrack)
            .then(async ({ url }) => {
              if (url) {
                await audioEngine.crossfadeTo(url, crossfadeDuration);
                set({
                  activeTrack: nextTrack,
                  queueIndex: nextIdx,
                  currentTime: 0,
                  duration: nextTrack.durationSec || 0,
                  isPlaying: true,
                  isBuffering: false,
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

    const onError = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      if (target !== audioEngine.activeAudioElement) return;

      const errorCode = target.error?.code;
      let errorMsg = 'Failed to load audio stream.';
      if (errorCode === 4) {
        errorMsg = 'Format not supported or audio stream URL has expired.';
      } else if (errorCode === 2) {
        errorMsg = 'Network error while loading audio stream.';
      } else if (errorCode === 3) {
        errorMsg = 'Audio decoding error.';
      }
      const currentTrack = get().activeTrack;
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
