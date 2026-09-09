import { create } from 'zustand';
import type { Track } from '../types';
import audioEngine from '../audio/AudioEngine';
import useToastStore from './toastStore';

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
        const errMsg = error || 'Аудиопоток не найден. Трек может быть ограничен или заблокирован правообладателем.';
        set({ isPlaying: false, isBuffering: false, playbackError: errMsg });
        useToastStore.getState().error(
          `Не удалось воспроизвести "${track.title}"`,
          errMsg
        );
      }
    } catch (err: any) {
      console.error('[Player] Playback failed:', err);
      const errMsg = err?.message || 'Не удалось декодировать или запустить аудиопоток.';
      set({ isPlaying: false, isBuffering: false, playbackError: errMsg });
      useToastStore.getState().error(
        `Ошибка воспроизведения "${track.title}"`,
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
        'Ошибка воспроизведения',
        err?.message || 'Браузер заблокировал автовоспроизведение или поток недоступен.'
      );
    }
  },

  nextTrack: async () => {
    const { queue, queueIndex, isShuffle, repeatMode } = get();
    if (queue.length === 0) return;

    let nextIdx: number;
    if (isShuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else {
      nextIdx = queueIndex + 1;
      if (nextIdx >= queue.length) {
        if (repeatMode === 'all') nextIdx = 0;
        else return;
      }
    }

    const next = queue[nextIdx];
    if (next) {
      set({ queueIndex: nextIdx });
      await get().playTrack(next);
    }
  },

  prevTrack: async () => {
    const { queue, queueIndex, currentTime } = get();
    if (queue.length === 0) return;

    if (currentTime > 3) {
      get().seek(0);
      return;
    }

    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) prevIdx = queue.length - 1;

    const prev = queue[prevIdx];
    if (prev) {
      set({ queueIndex: prevIdx });
      await get().playTrack(prev);
    }
  },

  seek: (time) => {
    audioEngine.seek(time);
    set({ currentTime: time });
  },

  setVolume: (volume) => {
    audioEngine.setVolume(volume);
    set({ volume, isMuted: false });
  },

  toggleMute: () => {
    const { isMuted } = get();
    audioEngine.setMuted(!isMuted);
    set({ isMuted: !isMuted });
  },

  toggleShuffle: () => set((s) => ({ isShuffle: !s.isShuffle })),

  cycleRepeat: () =>
    set((s) => ({
      repeatMode: s.repeatMode === 'off' ? 'all' : s.repeatMode === 'all' ? 'one' : 'off',
    })),

  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setIsBuffering: (buffering) => set({ isBuffering: buffering }),

  jumpToQueueIndex: async (index: number) => {
    const { queue } = get();
    if (index >= 0 && index < queue.length) {
      await get().playTrack(queue[index], queue);
    }
  },

  removeFromQueue: (index: number) => {
    const { queue, queueIndex } = get();
    if (index < 0 || index >= queue.length) return;
    const newQueue = [...queue];
    newQueue.splice(index, 1);
    let newIndex = queueIndex;
    if (index < queueIndex) {
      newIndex--;
    } else if (index === queueIndex) {
      newIndex = Math.min(queueIndex, newQueue.length - 1);
    }
    set({ queue: newQueue, queueIndex: Math.max(0, newIndex) });
  },

  clearQueue: () => {
    const { activeTrack } = get();
    set({
      queue: activeTrack ? [activeTrack] : [],
      queueIndex: 0,
    });
  },

  initAudioListeners: () => {
    const el = audioEngine.element;

    const onTimeUpdate = () => {
      const time = el.currentTime;
      set({ currentTime: time });
      audioEngine.updateMediaSessionPosition(time, el.duration || 0);
    };

    const onDurationChange = () => {
      if (isFinite(el.duration) && el.duration > 0) set({ duration: el.duration });
    };

    const onEnded = () => {
      const { repeatMode } = get();
      if (repeatMode === 'one') {
        audioEngine.seek(0);
        audioEngine.play();
      } else {
        get().nextTrack();
      }
    };

    const onPlay = () => set({ isPlaying: true, isBuffering: false });
    const onPause = () => set({ isPlaying: false });
    const onWaiting = () => set({ isBuffering: true });
    const onCanPlay = () => set({ isBuffering: false });

    const onError = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      const errorCode = target.error?.code;
      let errorMsg = 'Не удалось загрузить аудиопоток.';
      if (errorCode === 4) {
        errorMsg = 'Формат не поддерживается или ссылка на поток устарела.';
      } else if (errorCode === 2) {
        errorMsg = 'Сетевая ошибка при загрузке аудиопотока.';
      } else if (errorCode === 3) {
        errorMsg = 'Ошибка декодирования аудио.';
      }
      const currentTrack = get().activeTrack;
      const trackTitle = currentTrack ? `"${currentTrack.title}"` : 'трека';
      set({ isPlaying: false, isBuffering: false, playbackError: errorMsg });
      useToastStore.getState().error(
        `Сбой воспроизведения ${trackTitle}`,
        errorMsg
      );
    };

    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('durationchange', onDurationChange);
    el.addEventListener('ended', onEnded);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('canplay', onCanPlay);
    el.addEventListener('error', onError);

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
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('durationchange', onDurationChange);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('canplay', onCanPlay);
      el.removeEventListener('error', onError);
      removeMediaKeyListener?.();
    };
  },
}));
