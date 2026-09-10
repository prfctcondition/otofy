import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  resolveStream: (trackId: string, source: string, title?: string, artist?: string) =>
    ipcRenderer.invoke('music:resolve-stream', { trackId, source, title, artist }),
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
  loginAccount: (platform: 'youtube' | 'soundcloud') =>
    ipcRenderer.invoke('auth:login', { platform }),
  syncAccountLibrary: (platform: 'youtube' | 'soundcloud') =>
    ipcRenderer.invoke('auth:sync-library', { platform }),
  windowControl: (action: 'minimize' | 'maximize' | 'close') =>
    ipcRenderer.invoke('window:control', action),
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
  downloadTrack: (track: any, format?: 'mp3' | 'flac') =>
    ipcRenderer.invoke('download:track', { track, format }),
  checkDownloadStatus: (tracks: any[]) =>
    ipcRenderer.invoke('download:check-status', { tracks }),
  showDownloadedFile: (filePath: string) =>
    ipcRenderer.invoke('download:show-in-folder', { filePath }),
  onDownloadProgress: (
    callback: (data: {
      trackId: string;
      progress: number;
      status: 'downloading' | 'completed' | 'error';
      error?: string;
      filePath?: string;
    }) => void
  ) => {
    const handler = (_event: unknown, data: any) => callback(data);
    ipcRenderer.on('download:progress', handler);
    return () => ipcRenderer.removeListener('download:progress', handler);
  },
});
