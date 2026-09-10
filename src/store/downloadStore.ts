import { create } from 'zustand';
import type { Track, BatchDownloadState } from '../types';
import useToastStore from './toastStore';

export type DownloadStatus = 'idle' | 'queued' | 'downloading' | 'paused' | 'completed' | 'error';

export interface DownloadItemState {
  status: DownloadStatus;
  progress: number;
  format?: 'mp3' | 'flac';
  error?: string;
  filePath?: string;
}

export const IDLE_DOWNLOAD: DownloadItemState = {
  status: 'idle',
  progress: 0,
};

interface DownloadState {
  downloads: Record<string, DownloadItemState>;
  downloadedIds: string[];
  batchState: BatchDownloadState | null;
}

interface DownloadActions {
  startDownload: (track: Track, format?: 'mp3' | 'flac') => Promise<void>;
  pauseTrack: (trackId: string) => Promise<void>;
  resumeTrack: (trackId: string) => Promise<void>;
  cancelTrack: (trackId: string) => Promise<void>;
  pauseAll: () => Promise<void>;
  resumeAll: () => Promise<void>;
  cancelAll: () => Promise<void>;
  dismissBatch: () => void;
  checkStatus: (tracks: Track[]) => Promise<void>;
  openDownloadedFile: (track: Track) => Promise<void>;
  removeDownload: (track: Track) => Promise<void>;
  downloadPlaylist: (tracks: Track[], playlistTitle?: string, format?: 'mp3' | 'flac') => Promise<void>;
  scanLocalFiles: () => Promise<Track[]>;
  loadDownloadedTracks: () => Promise<Track[]>;
  initListeners: () => () => void;
  getTrackStatus: (trackId: string) => DownloadItemState;
}

export const useDownloadStore = create<DownloadState & DownloadActions>()((set, get) => ({
  downloads: {},
  downloadedIds: [],
  batchState: null,

  getTrackStatus: (trackId: string): DownloadItemState => {
    return get().downloads[trackId] || IDLE_DOWNLOAD;
  },

  startDownload: async (track: Track, format: 'mp3' | 'flac' = 'mp3') => {
    if (!window.electronAPI?.downloadTrack) {
      useToastStore.getState().error('Download Unavailable', 'Downloads are only supported in the desktop app.');
      return;
    }

    const current = get().downloads[track.id];
    if (current && (current.status === 'downloading' || current.status === 'queued')) {
      return;
    }

    // Set optimistic queued state
    set((s) => ({
      downloads: {
        ...s.downloads,
        [track.id]: {
          status: 'queued',
          progress: 0,
          format,
        },
      },
    }));

    if (!get().batchState?.active) {
      useToastStore.getState().info('Download Queued', `Added "${track.title}" to download queue.`);
    }

    try {
      await window.electronAPI.downloadTrack(track, format);
    } catch (err: any) {
      set((s) => ({
        downloads: {
          ...s.downloads,
          [track.id]: {
            status: 'error',
            progress: 0,
            error: err?.message || 'Failed to start download',
          },
        },
      }));
      useToastStore.getState().error('Download Failed', `Could not download "${track.title}": ${err?.message || ''}`);
    }
  },

  pauseTrack: async (trackId: string) => {
    if (!window.electronAPI?.pauseDownload) return;
    try {
      await window.electronAPI.pauseDownload(trackId);
      set((s) => ({
        downloads: {
          ...s.downloads,
          [trackId]: {
            ...s.downloads[trackId],
            status: 'paused',
          },
        },
      }));
    } catch (err: any) {
      console.warn('[DownloadStore] pauseTrack error:', err);
    }
  },

  resumeTrack: async (trackId: string) => {
    if (!window.electronAPI?.resumeDownload) return;
    try {
      await window.electronAPI.resumeDownload(trackId);
      set((s) => ({
        downloads: {
          ...s.downloads,
          [trackId]: {
            ...s.downloads[trackId],
            status: 'queued',
          },
        },
      }));
    } catch (err: any) {
      console.warn('[DownloadStore] resumeTrack error:', err);
    }
  },

  cancelTrack: async (trackId: string) => {
    if (!window.electronAPI?.cancelDownload) return;
    try {
      await window.electronAPI.cancelDownload(trackId);
      set((s) => {
        const next = { ...s.downloads };
        delete next[trackId];
        return {
          downloads: next,
          downloadedIds: s.downloadedIds.filter((id) => id !== trackId),
        };
      });
    } catch (err: any) {
      console.warn('[DownloadStore] cancelTrack error:', err);
    }
  },

  pauseAll: async () => {
    if (!window.electronAPI?.pauseAllDownloads) return;
    try {
      await window.electronAPI.pauseAllDownloads();
      set((s) => {
        const next = { ...s.downloads };
        for (const [id, item] of Object.entries(next)) {
          if (item.status === 'downloading' || item.status === 'queued') {
            next[id] = { ...item, status: 'paused' };
          }
        }
        return {
          downloads: next,
          batchState: s.batchState ? { ...s.batchState, isPaused: true } : null,
        };
      });
    } catch (err) {
      console.warn('[DownloadStore] pauseAll error:', err);
    }
  },

  resumeAll: async () => {
    if (!window.electronAPI?.resumeAllDownloads) return;
    try {
      await window.electronAPI.resumeAllDownloads();
      set((s) => {
        const next = { ...s.downloads };
        for (const [id, item] of Object.entries(next)) {
          if (item.status === 'paused') {
            next[id] = { ...item, status: 'queued' };
          }
        }
        return {
          downloads: next,
          batchState: s.batchState ? { ...s.batchState, isPaused: false } : null,
        };
      });
    } catch (err) {
      console.warn('[DownloadStore] resumeAll error:', err);
    }
  },

  cancelAll: async () => {
    if (!window.electronAPI?.cancelAllDownloads) return;
    try {
      await window.electronAPI.cancelAllDownloads();
      set((s) => {
        const next = { ...s.downloads };
        for (const [id, item] of Object.entries(next)) {
          if (item.status === 'downloading' || item.status === 'queued' || item.status === 'paused') {
            delete next[id];
          }
        }
        return {
          downloads: next,
          batchState: null,
        };
      });
      useToastStore.getState().info('Downloads Cancelled', 'All active and queued downloads were cancelled.');
    } catch (err) {
      console.warn('[DownloadStore] cancelAll error:', err);
    }
  },

  dismissBatch: () => {
    set({ batchState: null });
  },

  checkStatus: async (tracks: Track[]) => {
    if (!window.electronAPI?.checkDownloadStatus || !tracks || tracks.length === 0) return;
    try {
      const results = await window.electronAPI.checkDownloadStatus(tracks);
      if (!results) return;

      const newDownloads = { ...get().downloads };
      const completedSet = new Set(get().downloadedIds);

      for (const [id, res] of Object.entries(results)) {
        if (res.downloaded) {
          completedSet.add(id);
          // Only update if not currently active
          const current = newDownloads[id];
          if (!current || (current.status !== 'downloading' && current.status !== 'queued')) {
            newDownloads[id] = {
              status: 'completed',
              progress: 100,
              format: res.format,
              filePath: res.filePath,
            };
          }
        }
      }

      set({
        downloads: newDownloads,
        downloadedIds: Array.from(completedSet),
      });
    } catch (err) {
      console.warn('[DownloadStore] checkStatus error:', err);
    }
  },

  openDownloadedFile: async (track: Track) => {
    if (!window.electronAPI?.showDownloadedFile) return;
    const current = get().downloads[track.id];
    const res = await window.electronAPI.showDownloadedFile({
      filePath: current?.filePath,
      track,
    });
    if (res?.notFound) {
      set((s) => {
        const next = { ...s.downloads };
        delete next[track.id];
        return {
          downloads: next,
          downloadedIds: s.downloadedIds.filter((id) => id !== track.id),
        };
      });
      useToastStore.getState().warning('File Missing', 'This file was moved or deleted from your Downloads folder.');
    }
  },

  removeDownload: async (track: Track) => {
    if (!window.electronAPI?.removeDownloadedTrack) return;
    try {
      await window.electronAPI.removeDownloadedTrack(track);
      set((s) => {
        const next = { ...s.downloads };
        delete next[track.id];
        return {
          downloads: next,
          downloadedIds: s.downloadedIds.filter((id) => id !== track.id),
        };
      });
      useToastStore.getState().info('Download Removed', `"${track.title}" deleted from your device.`);
    } catch (err: any) {
      useToastStore.getState().error('Error', err?.message || 'Failed to remove downloaded track');
    }
  },

  downloadPlaylist: async (tracks: Track[], playlistTitle = 'Playlist', format: 'mp3' | 'flac' = 'mp3') => {
    if (!tracks || tracks.length === 0) return;

    if (window.electronAPI?.downloadBatch) {
      // Set initial state
      set({
        batchState: {
          active: true,
          playlistTitle,
          total: tracks.length,
          completed: 0,
          failed: 0,
          isPaused: false,
        },
      });

      // Optimistically queue all uncompleted tracks
      const currentDownloads = { ...get().downloads };
      for (const t of tracks) {
        if (!get().downloadedIds.includes(t.id)) {
          currentDownloads[t.id] = {
            status: 'queued',
            progress: 0,
            format,
          };
        }
      }
      set({ downloads: currentDownloads });

      useToastStore.getState().info('Downloading Playlist', `Queueing ${tracks.length} tracks for "${playlistTitle}"...`);
      await window.electronAPI.downloadBatch({ tracks, format, playlistTitle });
      return;
    }

    // Fallback if desktop batch API not available
    let completedCount = 0;
    for (const track of tracks) {
      if (!get().downloadedIds.includes(track.id)) {
        try {
          await get().startDownload(track, format);
          await new Promise((r) => setTimeout(r, 600));
        } catch (err) {
          console.warn(`[DownloadStore] Failed to download "${track.title}":`, err);
        }
      }
      completedCount++;
    }
    useToastStore.getState().success('Playlist Download Complete', `Processed ${completedCount} tracks.`);
  },

  scanLocalFiles: async (): Promise<Track[]> => {
    if (!window.electronAPI?.scanLocalFiles) return [];
    try {
      const list = await window.electronAPI.scanLocalFiles();
      if (Array.isArray(list)) {
        const newDownloads = { ...get().downloads };
        const idList: string[] = [];
        for (const t of list) {
          idList.push(t.id);
          newDownloads[t.id] = {
            status: 'completed',
            progress: 100,
            filePath: (t as any).filePath || t.sourceId,
          };
        }
        set({
          downloads: newDownloads,
          downloadedIds: idList,
        });
        return list;
      }
    } catch (err) {
      console.warn('[DownloadStore] scanLocalFiles error:', err);
    }
    return [];
  },

  loadDownloadedTracks: async (): Promise<Track[]> => {
    // Prefer scanLocalFiles to reconcile both downloads index and external files
    if (window.electronAPI?.scanLocalFiles) {
      return get().scanLocalFiles();
    }
    if (window.electronAPI?.getDownloadedTracks) {
      try {
        const list = await window.electronAPI.getDownloadedTracks();
        if (Array.isArray(list)) {
          const newDownloads = { ...get().downloads };
          const idList = list.map((t) => t.id);
          for (const t of list) {
            newDownloads[t.id] = {
              status: 'completed',
              progress: 100,
            };
          }
          set({
            downloads: newDownloads,
            downloadedIds: idList,
          });
          return list;
        }
      } catch (err) {
        console.warn('[DownloadStore] loadDownloadedTracks error:', err);
      }
    }
    return [];
  },

  initListeners: () => {
    const unsubs: Array<() => void> = [];

    if (window.electronAPI?.onDownloadProgress) {
      const unsubProgress = window.electronAPI.onDownloadProgress((data) => {
        const { trackId, progress, status, error, filePath } = data;
        set((s) => {
          const next = { ...s.downloads };

          if (status === 'idle') {
            delete next[trackId];
            return {
              downloads: next,
              downloadedIds: s.downloadedIds.filter((id) => id !== trackId),
            };
          }

          next[trackId] = {
            status,
            progress,
            error,
            filePath,
            format: next[trackId]?.format || 'mp3',
          };

          let nextCompleted = s.downloadedIds;
          if (status === 'completed' && !nextCompleted.includes(trackId)) {
            nextCompleted = [...nextCompleted, trackId];
          }

          return {
            downloads: next,
            downloadedIds: nextCompleted,
          };
        });

        // Only show individual toasts if NOT currently in batch download mode
        const isBatch = get().batchState?.active;
        if (!isBatch) {
          if (status === 'completed') {
            useToastStore.getState().success('Download Complete', 'Track downloaded successfully to your Downloads folder.');
          } else if (status === 'error') {
            useToastStore.getState().error('Download Error', error || 'Failed to download track.');
          }
        }
      });
      unsubs.push(unsubProgress);
    }

    if (window.electronAPI?.onBatchProgress) {
      const unsubBatch = window.electronAPI.onBatchProgress((batchData) => {
        const prevBatch = get().batchState;
        set({ batchState: batchData });

        if (prevBatch?.active && !batchData.active) {
          useToastStore.getState().success(
            'Playlist Download Complete',
            `Successfully downloaded ${batchData.completed} tracks of "${batchData.playlistTitle}".`
          );
        }
      });
      unsubs.push(unsubBatch);
    }

    return () => {
      unsubs.forEach((fn) => fn());
    };
  },
}));

export default useDownloadStore;
