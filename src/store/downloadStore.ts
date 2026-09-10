import { create } from 'zustand';
import type { Track } from '../types';
import useToastStore from './toastStore';

export type DownloadStatus = 'idle' | 'downloading' | 'completed' | 'error';

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
  isBatchDownloading: boolean;
  batchProgress: { current: number; total: number };
}

interface DownloadActions {
  startDownload: (track: Track, format?: 'mp3' | 'flac') => Promise<void>;
  checkStatus: (tracks: Track[]) => Promise<void>;
  openDownloadedFile: (track: Track) => Promise<void>;
  removeDownload: (track: Track) => Promise<void>;
  downloadPlaylist: (tracks: Track[], format?: 'mp3' | 'flac') => Promise<void>;
  loadDownloadedTracks: () => Promise<Track[]>;
  initListeners: () => () => void;
  getTrackStatus: (trackId: string) => DownloadItemState;
}

export const useDownloadStore = create<DownloadState & DownloadActions>()((set, get) => ({
  downloads: {},
  downloadedIds: [],
  isBatchDownloading: false,
  batchProgress: { current: 0, total: 0 },

  getTrackStatus: (trackId: string): DownloadItemState => {
    return get().downloads[trackId] || IDLE_DOWNLOAD;
  },

  startDownload: async (track: Track, format: 'mp3' | 'flac' = 'mp3') => {
    if (!window.electronAPI?.downloadTrack) {
      useToastStore.getState().error('Download Unavailable', 'Downloads are only supported in the desktop app.');
      return;
    }

    const current = get().downloads[track.id];
    if (current && current.status === 'downloading') {
      return;
    }

    // Set optimistic downloading state
    set((s) => ({
      downloads: {
        ...s.downloads,
        [track.id]: {
          status: 'downloading',
          progress: 5,
          format,
        },
      },
    }));

    useToastStore.getState().info('Starting Download', `Downloading "${track.title}" in ${format.toUpperCase()} format...`);

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
          if (!newDownloads[id] || newDownloads[id].status !== 'downloading') {
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

  downloadPlaylist: async (tracks: Track[], format: 'mp3' | 'flac' = 'mp3') => {
    if (!tracks || tracks.length === 0) return;
    if (get().isBatchDownloading) {
      useToastStore.getState().info('Download in Progress', 'A batch download is already running.');
      return;
    }

    set({ isBatchDownloading: true, batchProgress: { current: 0, total: tracks.length } });
    useToastStore.getState().info('Downloading Playlist', `Starting sequential download for ${tracks.length} tracks...`);

    let completedCount = 0;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      set({ batchProgress: { current: i + 1, total: tracks.length } });

      // Skip if already downloaded
      const isAlreadyDownloaded = get().downloadedIds.includes(track.id);
      if (!isAlreadyDownloaded) {
        try {
          await get().startDownload(track, format);
          await new Promise((r) => setTimeout(r, 600));
        } catch (err) {
          console.warn(`[DownloadStore] Failed to download "${track.title}":`, err);
        }
      }
      completedCount++;
    }

    set({ isBatchDownloading: false });
    useToastStore.getState().success('Playlist Download Complete', `Processed ${completedCount} tracks.`);
  },

  loadDownloadedTracks: async (): Promise<Track[]> => {
    if (!window.electronAPI?.getDownloadedTracks) return [];
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
    return [];
  },

  initListeners: () => {
    if (!window.electronAPI?.onDownloadProgress) return () => {};

    const cleanup = window.electronAPI.onDownloadProgress((data) => {
      const { trackId, progress, status, error, filePath } = data;
      set((s) => {
        const next = { ...s.downloads };
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

      if (status === 'completed') {
        useToastStore.getState().success('Download Complete', 'Track downloaded successfully to your Downloads folder.');
      } else if (status === 'error') {
        useToastStore.getState().error('Download Error', error || 'Failed to download track.');
      }
    });

    return cleanup;
  },
}));

export default useDownloadStore;
