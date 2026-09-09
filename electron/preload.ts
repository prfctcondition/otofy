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
});
