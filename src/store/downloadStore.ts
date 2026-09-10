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
}

interface DownloadActions {
  startDownload: (track: Track, format?: 'mp3' | 'flac') => Promise<void>;
  checkStatus: (tracks: Track[]) => Promise<void>;
  openDownloadedFile: (filePath: string) => Promise<void>;
  initListeners: () => () => void;
  getTrackStatus: (trackId: string) => DownloadItemState;
}

export const useDownloadStore = create<DownloadState & DownloadActions>()((set, get) => ({
  downloads: {},
  downloadedIds: [],

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

  openDownloadedFile: async (filePath: string) => {
    if (window.electronAPI?.showDownloadedFile) {
      await window.electronAPI.showDownloadedFile(filePath);
    }
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
