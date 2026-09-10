import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  resolveStream: (trackId: string, source: string, title?: string, artist?: string, excludeIds?: string[], durationSec?: number) =>
    ipcRenderer.invoke('music:resolve-stream', { trackId, source, title, artist, excludeIds, durationSec }),
  searchMusic: (query: string, source?: 'YT' | 'SC' | 'ALL') =>
    ipcRenderer.invoke('music:search', { query, source }),
  getArtistDetails: (artistName: string, source?: 'YT' | 'SC') =>
    ipcRenderer.invoke('music:get-artist-details', { artistName, source }),
  getAlbum: (browseId: string, source?: 'YT' | 'SC') =>
    ipcRenderer.invoke('music:get-album', { browseId, source }),
  getLyrics: (videoId: string) =>
    ipcRenderer.invoke('music:get-lyrics', { videoId }),
  getGenreTracks: (query: string) =>
    ipcRenderer.invoke('music:get-genre-tracks', { query }),
  getRelatedTracks: (trackId: string, source: 'YT' | 'SC', artist?: string, title?: string) =>
    ipcRenderer.invoke('music:get-related-tracks', { trackId, source, artist, title }),
  importRemotePlaylist: (source: string, url: string) =>
    ipcRenderer.invoke('music:import-remote-playlist', { source, url }),
  inspectSpotifyPlaylist: (url: string) =>
    ipcRenderer.invoke('spotify:inspect-playlist', { url }),
  importAndMatchSpotify: (payload: { tracks: any[]; playlistTitle: string }) =>
    ipcRenderer.invoke('spotify:import-and-match', payload),
  onSpotifyImportProgress: (
    callback: (data: {
      current: number;
      total: number;
      matched: number;
      unresolved: number;
      currentTrackTitle: string;
    }) => void
  ) => {
    const handler = (_event: unknown, data: any) => callback(data);
    ipcRenderer.on('spotify:import-progress', handler);
    return () => ipcRenderer.removeListener('spotify:import-progress', handler);
  },
  loginAccount: (platform: 'youtube' | 'soundcloud') =>
    ipcRenderer.invoke('auth:login', { platform }),
  logoutAccount: (platform: 'youtube' | 'soundcloud') =>
    ipcRenderer.invoke('auth:logout', { platform }),
  getAccountStatus: () =>
    ipcRenderer.invoke('auth:get-status'),
  syncAccountLibrary: (platform: 'youtube' | 'soundcloud') =>
    ipcRenderer.invoke('auth:sync-library', { platform }),
  syncCloudLibrary: (platform: 'youtube' | 'soundcloud') =>
    ipcRenderer.invoke('auth:sync-library', { platform }),
  cloudAddTrackToPlaylist: (payload: {
    platform: 'youtube' | 'soundcloud';
    playlistId: string;
    track: { id: string; sourceId?: string; title?: string; artist?: string; source?: string };
  }) => ipcRenderer.invoke('cloud:add-track-to-playlist', payload),
  cloudRemoveTrackFromPlaylist: (payload: {
    platform: 'youtube' | 'soundcloud';
    playlistId: string;
    trackId: string;
    sourceId?: string;
  }) => ipcRenderer.invoke('cloud:remove-track-from-playlist', payload),
  onCloudSyncProgress: (
    callback: (data: {
      platform: 'youtube' | 'soundcloud';
      current: number;
      total: number;
      message: string;
    }) => void
  ) => {
    const handler = (_event: unknown, data: any) => callback(data);
    ipcRenderer.on('account:sync-progress', handler);
    return () => ipcRenderer.removeListener('account:sync-progress', handler);
  },
  onAuthSessionUpdated: (
    callback: (data: { platform: 'youtube' | 'soundcloud'; connected: boolean }) => void
  ) => {
    const handler = (_event: unknown, data: any) => callback(data);
    ipcRenderer.on('auth:session-updated', handler);
    return () => ipcRenderer.removeListener('auth:session-updated', handler);
  },
  checkForUpdates: () =>
    ipcRenderer.invoke('updater:check-for-updates'),
  downloadAndInstallUpdate: () =>
    ipcRenderer.invoke('updater:download-and-install'),
  cancelUpdateDownload: () =>
    ipcRenderer.invoke('updater:cancel-download'),
  onUpdateDownloadProgress: (
    callback: (data: {
      percent: number;
      transferred: number;
      total: number;
    }) => void
  ) => {
    const handler = (_event: unknown, data: any) => callback(data);
    ipcRenderer.on('updater:download-progress', handler);
    return () => ipcRenderer.removeListener('updater:download-progress', handler);
  },
  windowControl: (action: 'minimize' | 'maximize' | 'close') =>
    ipcRenderer.invoke('window:control', action),
  expandWindowForLyrics: (targetWidth?: number) =>
    ipcRenderer.invoke('window:expand-for-lyrics', { targetWidth }),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onWindowState: (callback: (isMaximized: boolean) => void) => {
    const handler = (_event: unknown, isMax: boolean) => callback(isMax);
    ipcRenderer.on('window:state-change', handler);
    return () => ipcRenderer.removeListener('window:state-change', handler);
  },
  onMediaKey: (callback: (key: string) => void) => {
    const handler = (_event: unknown, key: string) => callback(key);
    ipcRenderer.on('media-key', handler);
    return () => ipcRenderer.removeListener('media-key', handler);
  },
  getUserProfile: () => ipcRenderer.invoke('app:get-user-profile'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  relaunchApp: () => ipcRenderer.invoke('app:relaunch'),
  getConfig: () => ipcRenderer.invoke('app:get-config'),
  setAutoLaunch: (mode: 'no' | 'yes' | 'minimized') => ipcRenderer.invoke('app:set-autolaunch', mode),
  setCloseToTray: (enabled: boolean) => ipcRenderer.invoke('app:set-close-to-tray', enabled),
  setHardwareAcceleration: (enabled: boolean) => ipcRenderer.invoke('app:set-hardware-acceleration', enabled),
  getCacheSize: () => ipcRenderer.invoke('app:get-cache-size'),
  clearCache: () => ipcRenderer.invoke('app:clear-cache'),
  getDownloadsPath: () => ipcRenderer.invoke('storage:get-downloads-path'),
  selectDownloadsFolder: () => ipcRenderer.invoke('storage:select-downloads-folder'),
  openFolder: (folderPath?: string) => ipcRenderer.invoke('storage:open-folder', folderPath),
  searchPlaylists: (query: string, source?: 'YT' | 'SC' | 'ALL') =>
    ipcRenderer.invoke('music:search-playlists', { query, source }),
  getPlaylistTracks: (payload: { id: string; source: 'YT' | 'SC' }) =>
    ipcRenderer.invoke('music:get-playlist-tracks', payload),
  downloadTrack: (track: any, format?: 'mp3' | 'flac') =>
    ipcRenderer.invoke('download:track', { track, format }),
  downloadBatch: (payload: { tracks: any[]; format?: 'mp3' | 'flac'; playlistTitle?: string }) =>
    ipcRenderer.invoke('download:batch', payload),
  pauseDownload: (trackId: string) =>
    ipcRenderer.invoke('download:pause-track', { trackId }),
  resumeDownload: (trackId: string) =>
    ipcRenderer.invoke('download:resume-track', { trackId }),
  cancelDownload: (trackId: string) =>
    ipcRenderer.invoke('download:cancel-track', { trackId }),
  pauseAllDownloads: () =>
    ipcRenderer.invoke('download:pause-all'),
  resumeAllDownloads: () =>
    ipcRenderer.invoke('download:resume-all'),
  cancelAllDownloads: () =>
    ipcRenderer.invoke('download:cancel-all'),
  scanLocalFiles: () =>
    ipcRenderer.invoke('download:scan-local-files'),
  checkDownloadStatus: (tracks: any[]) =>
    ipcRenderer.invoke('download:check-status', { tracks }),
  showDownloadedFile: (payload: { filePath?: string; track?: any }) =>
    ipcRenderer.invoke('download:show-in-folder', payload),
  removeDownloadedTrack: (track: any) =>
    ipcRenderer.invoke('download:remove-track', { track }),
  getDownloadedTracks: () =>
    ipcRenderer.invoke('download:get-tracks'),
  onDownloadProgress: (
    callback: (data: {
      trackId: string;
      progress: number;
      status: 'idle' | 'queued' | 'downloading' | 'paused' | 'completed' | 'error';
      error?: string;
      filePath?: string;
    }) => void
  ) => {
    const handler = (_event: unknown, data: any) => callback(data);
    ipcRenderer.on('download:progress', handler);
    return () => ipcRenderer.removeListener('download:progress', handler);
  },
  onBatchProgress: (
    callback: (data: {
      active: boolean;
      batchId?: string;
      playlistTitle: string;
      total: number;
      completed: number;
      failed: number;
      currentTrackTitle?: string;
      isPaused: boolean;
    }) => void
  ) => {
    const handler = (_event: unknown, data: any) => callback(data);
    ipcRenderer.on('download:batch-progress', handler);
    return () => ipcRenderer.removeListener('download:batch-progress', handler);
  },
});
