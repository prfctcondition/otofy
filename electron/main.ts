import { app, BrowserWindow, ipcMain, globalShortcut, session, Tray, Menu, nativeImage, dialog, shell, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import ytResolver from './services/ytResolver.js';
import scResolver from './services/scResolver.js';
import searchService from './services/searchService.js';
import downloadService, { DownloadFormat, TrackMetadata } from './services/downloadService.js';
import { cleanArtistAndTitle } from './services/trackParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// App persistent configuration (hardware acceleration, close to tray, downloads)
const configPath = path.join(app.getPath('userData'), 'otofy-config.json');

interface AppConfig {
  hardwareAcceleration?: boolean;
  closeToTray?: boolean;
  downloadsPath?: string;
  autoLaunch?: 'no' | 'yes' | 'minimized';
}

function loadAppConfig(): AppConfig {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch {}
  return { hardwareAcceleration: true, closeToTray: false, autoLaunch: 'no' };
}

function saveAppConfig(cfg: Partial<AppConfig>) {
  try {
    const current = loadAppConfig();
    const updated = { ...current, ...cfg };
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf8');
  } catch (err) {
    console.warn('Failed to save otofy-config.json:', err);
  }
}

const initialConfig = loadAppConfig();
let closeToTray = initialConfig.closeToTray ?? false;

// Apply hardware acceleration flag before app is ready
if (initialConfig.hardwareAcceleration === false) {
  app.disableHardwareAcceleration();
}

// Register custom protocol for local audio streaming with Range support & Web Audio API graph
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'atom',
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: true,
      stream: true,
      supportFetchAPI: true,
    },
  },
]);

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

function createTray() {
  if (tray) return;
  try {
    const iconPath = path.join(__dirname, '../public/icon.png');
    let icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = nativeImage.createFromPath(path.join(process.cwd(), 'public/icon.png'));
    }
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    tray.setToolTip('Otofy Music');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Otofy',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Play / Pause',
        click: () => mainWindow?.webContents.send('media-key', 'play-pause'),
      },
      {
        label: 'Next Track',
        click: () => mainWindow?.webContents.send('media-key', 'next'),
      },
      {
        label: 'Previous Track',
        click: () => mainWindow?.webContents.send('media-key', 'prev'),
      },
      { type: 'separator' },
      {
        label: 'Quit Otofy',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.warn('Failed to create system tray:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Otofy',
    icon: path.join(__dirname, '../public/icon.png'),
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    titleBarStyle: 'hidden',
    frame: false,
    backgroundColor: '#000000',
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:state-change', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:state-change', false);
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting && closeToTray) {
      event.preventDefault();
      mainWindow?.hide();
      return;
    }
  });

  const isAutoStart =
    process.argv.includes('--autostart') ||
    process.argv.includes('--hidden') ||
    Boolean(app.getLoginItemSettings?.().wasOpenedAsHidden);

  const shouldStartMinimized = initialConfig.autoLaunch === 'minimized' && isAutoStart;
  if (shouldStartMinimized) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// In-Memory IPC Cache with 1-hour TTL
const IPC_CACHE = new Map<string, { data: any; timestamp: number }>();
const IPC_CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getIpcCache<T>(key: string): T | null {
  const item = IPC_CACHE.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > IPC_CACHE_TTL) {
    IPC_CACHE.delete(key);
    return null;
  }
  return item.data as T;
}

function setIpcCache<T>(key: string, data: T): void {
  if (IPC_CACHE.size > 500) {
    const oldest = IPC_CACHE.keys().next().value;
    if (oldest) IPC_CACHE.delete(oldest);
  }
  IPC_CACHE.set(key, { data, timestamp: Date.now() });
}

ipcMain.handle(
  'music:resolve-stream',
  async (_event, { trackId, source, title, artist }: { trackId: string; source: string; title?: string; artist?: string }) => {
    const normalizedSource = source?.toUpperCase();
    if (normalizedSource === 'YT' || source?.toLowerCase() === 'youtube') {
      return await ytResolver.resolve(trackId, title, artist);
    }
  if (normalizedSource === 'SC' || source?.toLowerCase() === 'soundcloud') {
    return await scResolver.resolve(trackId);
  }
  throw new Error(`Unsupported music source: ${source}`);
});

import innertubeService from './services/innertubeService.js';

ipcMain.handle('music:search', async (_event, { query, source }: { query: string; source?: 'YT' | 'SC' | 'ALL' }) => {
  return await searchService.searchAll(query, source);
});

ipcMain.handle('music:get-artist-details', async (_event, { artistName, source }: { artistName: string; source?: 'YT' | 'SC' }) => {
  const cacheKey = `artist:${artistName.toLowerCase().trim()}:${source || 'ALL'}`;
  const cached = getIpcCache(cacheKey);
  if (cached) return cached;

  if (source === 'SC') {
    const res = await scResolver.getArtistDetails(artistName);
    if (res) setIpcCache(cacheKey, res);
    return res;
  }
  try {
    const ytDetails = await innertubeService.getArtist(artistName);
    if (ytDetails && (ytDetails.topTracks.length > 0 || ytDetails.albums.length > 0)) {
      if (!ytDetails.avatarUrl || ytDetails.albums.length === 0) {
        try {
          const scDetails = await scResolver.getArtistDetails(artistName);
          if (scDetails) {
            if (!ytDetails.avatarUrl && scDetails.avatarUrl) {
              ytDetails.avatarUrl = scDetails.avatarUrl;
            }
            if (ytDetails.albums.length === 0 && scDetails.albums.length > 0) {
              ytDetails.albums = scDetails.albums as any;
            }
          }
        } catch {}
      }
      if (!ytDetails.avatarUrl && ytDetails.topTracks.length > 0) {
        ytDetails.avatarUrl = ytDetails.topTracks[0].artworkUrl;
      }
      setIpcCache(cacheKey, ytDetails);
      return ytDetails;
    }
  } catch (err) {
    console.warn('[main] innertube getArtist failed, falling back to soundcloud:', err);
  }
  const fallback = await scResolver.getArtistDetails(artistName);
  if (fallback) setIpcCache(cacheKey, fallback);
  return fallback;
});

ipcMain.handle('music:get-album', async (_event, { browseId, source }: { browseId: string; source?: 'YT' | 'SC' }) => {
  const cacheKey = `album:${browseId}:${source || 'ALL'}`;
  const cached = getIpcCache(cacheKey);
  if (cached) return cached;

  if (source === 'SC' || /^\d+$/.test(browseId)) {
    const res = await scResolver.getAlbum(browseId);
    if (res) setIpcCache(cacheKey, res);
    return res;
  }
  try {
    const ytAlbum = await innertubeService.getAlbum(browseId);
    if (ytAlbum) {
      setIpcCache(cacheKey, ytAlbum);
      return ytAlbum;
    }
  } catch (e) {
    // fallback
  }
  const fallback = await scResolver.getAlbum(browseId);
  if (fallback) setIpcCache(cacheKey, fallback);
  return fallback;
});

ipcMain.handle('music:get-lyrics', async (_event, { videoId }: { videoId: string }) => {
  const cacheKey = `lyrics:${videoId}`;
  const cached = getIpcCache(cacheKey);
  if (cached) return cached;

  const lyrics = await innertubeService.getLyrics(videoId);
  if (lyrics) setIpcCache(cacheKey, lyrics);
  return lyrics;
});

ipcMain.handle('music:get-genre-tracks', async (_event, { query }: { query: string }) => {
  const cacheKey = `genre:${query.toLowerCase().trim()}`;
  const cached = getIpcCache(cacheKey);
  if (cached) return cached;

  try {
    // 1. Try official YouTube Music playlist curation via InnerTube
    const ytTracks = await innertubeService.getGenreTracks(query);
    if (ytTracks && ytTracks.length >= 35) {
      setIpcCache(cacheKey, ytTracks);
      return ytTracks;
    }

    // 2. Supplement or fallback via SoundCloud full tracks if fewer tracks returned
    try {
      const scTracks = await scResolver.getGenreTracks(query);
      const existingTitles = new Set(ytTracks.map((t) => t.title.toLowerCase()));
      for (const st of scTracks) {
        if (!existingTitles.has(st.title.toLowerCase()) && st.durationSec > 45) {
          ytTracks.push({
            id: `sc-${st.id}`,
            title: st.title,
            artist: st.artist,
            album: st.album || query,
            duration: st.duration,
            durationSec: st.durationSec,
            source: 'SC',
            sourceLabel: 'SoundCloud',
            artworkUrl: st.artworkUrl,
            sourceId: st.sourceId,
          } as any);
          existingTitles.add(st.title.toLowerCase());
          if (ytTracks.length >= 50) break;
        }
      }
    } catch (scErr) {
      console.warn('[main] scResolver getGenreTracks fallback error:', scErr);
    }

    if (ytTracks && ytTracks.length > 0) {
      setIpcCache(cacheKey, ytTracks);
    }
    return ytTracks;
  } catch (err) {
    console.warn('[main] getGenreTracks error:', err);
    return [];
  }
});

ipcMain.handle(
  'music:get-related-tracks',
  async (
    _event,
    {
      trackId,
      source,
      artist,
      title,
    }: { trackId: string; source: 'YT' | 'SC'; artist?: string; title?: string }
  ) => {
    const cacheKey = `related:${source}:${trackId}`;
    const cached = getIpcCache(cacheKey);
    if (cached) return cached;

    try {
      let results: any[] = [];
      if (source === 'SC') {
        results = await scResolver.getRelatedTracks(trackId);
        // Fallback if related returned empty
        if (results.length === 0 && (artist || title)) {
          results = await scResolver.getGenreTracks(artist || title || 'electronic');
        }
      } else {
        results = await innertubeService.getRelatedTracks(trackId);
        // Fallback if related returned empty
        if (results.length === 0 && (artist || title)) {
          results = await innertubeService.getGenreTracks(`${artist || title} radio`);
        }
      }

      if (results && results.length > 0) {
        setIpcCache(cacheKey, results);
      }
      return results;
    } catch (err) {
      console.warn('[main] getRelatedTracks error:', err);
      return [];
    }
  }
);

ipcMain.handle('music:import-remote-playlist', async (_event, { source, url }: { source: string; url: string }) => {
  try {
    if (source === 'SC' || url.includes('soundcloud.com')) {
      const clientId = await scResolver.getClientId();
      const resolveRes = await fetch(
        `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(url)}&client_id=${clientId}`
      );
      if (!resolveRes.ok) throw new Error(`Failed to resolve SoundCloud playlist: ${resolveRes.statusText}`);
      const data: any = await resolveRes.json();
      const tracks = (data.tracks || []).map((t: any) => {
        const durSec = Math.round((t.duration || 0) / 1000);
        const rawArtist =
          t.publisher_metadata?.artist ||
          t.publisher_metadata?.album_artist ||
          t.user?.username ||
          'Unknown Artist';
        const cleaned = cleanArtistAndTitle(t.title || 'Untitled', rawArtist);
        return {
          id: String(t.id),
          title: cleaned.title,
          artist: cleaned.artist,
          album: data.title || '',
          duration: scResolver.formatDuration(durSec),
          durationSec: durSec,
          source: 'SC',
          artworkUrl: (t.artwork_url || t.user?.avatar_url || data.artwork_url || '').replace('-large.', '-t500x500.'),
          sourceId: String(t.id),
        };
      });
      return { title: data.title || 'SoundCloud Playlist', tracks };
    } else {
      // YouTube Playlist
      const listMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
      const playlistId = listMatch ? listMatch[1] : url;
      const response = await fetch('https://music.youtube.com/youtubei/v1/browse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://music.youtube.com/',
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB_REMIX',
              clientVersion: '1.20240101.01.00',
              hl: 'en',
              gl: 'US',
            },
          },
          browseId: playlistId.startsWith('VL') ? playlistId : `VL${playlistId}`,
        }),
      });

      if (!response.ok) throw new Error(`YouTube playlist browse failed: ${response.statusText}`);
      const data: any = await response.json();
      const title =
        data?.header?.musicDetailHeaderRenderer?.title?.runs?.[0]?.text ||
        data?.header?.musicResponsiveHeaderRenderer?.title?.runs?.[0]?.text ||
        'YouTube Playlist';
      const tracks: any[] = [];
      const contents =
        data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicPlaylistShelfRenderer?.contents ||
        [];

      for (const item of contents) {
        const r = item.musicResponsiveListItemRenderer;
        if (!r) continue;
        const videoId =
          r.playlistItemData?.videoId ||
          r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;
        if (!videoId) continue;
        const rawTitle =
          r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || 'Untitled';
        const col1Runs = r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
        const rawArtist = col1Runs[0]?.text || 'Unknown Artist';
        const cleaned = cleanArtistAndTitle(rawTitle, rawArtist);
        const album = col1Runs[2]?.text || title;
        const durationStr = col1Runs[col1Runs.length - 1]?.text || '0:00';
        const artworkUrl = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url;

        tracks.push({
          id: videoId,
          title: cleaned.title,
          artist: cleaned.artist,
          album,
          duration: durationStr,
          durationSec: ytResolver.parseDurationToSec(durationStr),
          source: 'YT',
          artworkUrl,
          sourceId: videoId,
        });
      }
      return { title, tracks };
    }
  } catch (err: any) {
    console.error('Error importing playlist:', err);
    return { title: 'Imported Playlist', tracks: [], error: err.message };
  }
});

ipcMain.handle('auth:login', async (_event, { platform }: { platform: 'youtube' | 'soundcloud' }) => {
  return new Promise((resolve) => {
    const authWin = new BrowserWindow({
      width: 580,
      height: 720,
      parent: mainWindow || undefined,
      modal: true,
      title: platform === 'youtube' ? 'Authorize YouTube Music (Google)' : 'Authorize SoundCloud',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const targetUrl =
      platform === 'youtube'
        ? 'https://accounts.google.com/ServiceLogin?service=youtube'
        : 'https://soundcloud.com/signin';

    authWin.loadURL(targetUrl);

    let loggedIn = false;

    const checkInterval = setInterval(async () => {
      try {
        if (authWin.isDestroyed()) {
          clearInterval(checkInterval);
          return;
        }

        const cookies = await session.defaultSession.cookies.get({});
        if (platform === 'youtube') {
          const hasYtCookie = cookies.some(
            (c) => c.name === 'SAPISID' || c.name === 'SID' || c.name === 'LOGIN_INFO'
          );
          const currentUrl = authWin.webContents.getURL();
          if (
            hasYtCookie &&
            (currentUrl.includes('myaccount.google.com') ||
              currentUrl.includes('youtube.com') ||
              currentUrl.includes('music.youtube.com'))
          ) {
            loggedIn = true;
            clearInterval(checkInterval);
            authWin.close();
            resolve({ success: true, username: 'Google Account' });
          }
        } else {
          const hasScCookie = cookies.some((c) => c.name === 'oauth_token');
          const currentUrl = authWin.webContents.getURL();
          if (
            hasScCookie ||
            (currentUrl.includes('soundcloud.com/') && !currentUrl.includes('/signin'))
          ) {
            loggedIn = true;
            clearInterval(checkInterval);
            authWin.close();
            resolve({ success: true, username: 'SoundCloud User' });
          }
        }
      } catch (err) {
        // continue polling
      }
    }, 1000);

    authWin.on('closed', () => {
      clearInterval(checkInterval);
      if (!loggedIn) {
        resolve({ success: false, error: 'Authorization window closed by user.' });
      }
    });
  });
});

ipcMain.handle('auth:sync-library', async (_event, { platform }: { platform: 'youtube' | 'soundcloud' }) => {
  return { playlists: [] };
});

ipcMain.handle('window:is-maximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

ipcMain.handle('window:control', (_event, action: 'minimize' | 'maximize' | 'close') => {
  if (!mainWindow) return;
  if (action === 'minimize') {
    mainWindow.minimize();
  } else if (action === 'maximize') {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  } else if (action === 'close') {
    if (closeToTray) {
      mainWindow.hide();
    } else {
      mainWindow.close();
    }
  }
});

ipcMain.handle('app:quit', () => {
  isQuitting = true;
  app.quit();
});

ipcMain.handle('app:relaunch', () => {
  isQuitting = true;
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('app:get-config', () => {
  return loadAppConfig();
});

ipcMain.handle('app:set-autolaunch', (_event, mode: 'no' | 'yes' | 'minimized') => {
  saveAppConfig({ autoLaunch: mode });
  const openAtLogin = mode !== 'no';
  const openAsHidden = mode === 'minimized';
  try {
    app.setLoginItemSettings({
      openAtLogin,
      openAsHidden,
      path: process.execPath,
      args: openAsHidden ? ['--autostart', '--hidden', '--minimized'] : openAtLogin ? ['--autostart'] : [],
    });
  } catch (err) {
    console.warn('Failed to set login item settings:', err);
  }
  return true;
});

ipcMain.handle('app:set-close-to-tray', (_event, enabled: boolean) => {
  closeToTray = enabled;
  saveAppConfig({ closeToTray: enabled });
  if (enabled) {
    createTray();
  }
  return true;
});

ipcMain.handle('app:set-hardware-acceleration', (_event, enabled: boolean) => {
  saveAppConfig({ hardwareAcceleration: enabled });
  return true;
});

function getDirectorySize(dirPath: string): number {
  let size = 0;
  try {
    if (!fs.existsSync(dirPath)) return 0;
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        size += getDirectorySize(fullPath);
      } else if (file.isFile()) {
        try {
          size += fs.statSync(fullPath).size;
        } catch {}
      }
    }
  } catch {}
  return size;
}

ipcMain.handle('app:get-cache-size', async () => {
  try {
    const userData = app.getPath('userData');
    const cacheDir = path.join(userData, 'Cache');
    const codeCacheDir = path.join(userData, 'Code Cache');
    const totalBytes = getDirectorySize(cacheDir) + getDirectorySize(codeCacheDir);
    const mb = (totalBytes / (1024 * 1024)).toFixed(1);
    return { bytes: totalBytes, formatted: `${mb} MB` };
  } catch {
    return { bytes: 0, formatted: '0 MB' };
  }
});

ipcMain.handle('app:clear-cache', async () => {
  try {
    await session.defaultSession.clearCache();
    await session.defaultSession.clearStorageData({
      storages: ['cachestorage', 'shadercache', 'serviceworkers'],
    });
    return true;
  } catch (err) {
    console.warn('Failed to clear cache:', err);
    return false;
  }
});

function getDefaultDownloadsPath(): string {
  const cfg = loadAppConfig();
  if (cfg.downloadsPath && fs.existsSync(cfg.downloadsPath)) {
    return cfg.downloadsPath;
  }
  const defaultPath = path.join(app.getPath('userData'), 'Downloads');
  if (!fs.existsSync(defaultPath)) {
    try {
      fs.mkdirSync(defaultPath, { recursive: true });
    } catch {}
  }
  return defaultPath;
}

ipcMain.handle('storage:get-downloads-path', () => {
  return getDefaultDownloadsPath();
});

ipcMain.handle('storage:select-downloads-folder', async () => {
  if (!mainWindow) return null;
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Downloads Folder',
    defaultPath: getDefaultDownloadsPath(),
    properties: ['openDirectory', 'createDirectory'],
  });
  if (!res.canceled && res.filePaths.length > 0) {
    const selected = res.filePaths[0];
    saveAppConfig({ downloadsPath: selected });
    return selected;
  }
  return null;
});

ipcMain.handle('storage:open-folder', async (_event, folderPath?: string) => {
  const target = folderPath || getDefaultDownloadsPath();
  try {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }
    await shell.openPath(target);
    return true;
  } catch (err) {
    console.warn('Failed to open folder:', target, err);
    return false;
  }
});

// Download IPC Handlers
ipcMain.handle(
  'download:track',
  async (event, { track, format }: { track: TrackMetadata; format?: DownloadFormat }) => {
    const downloadsPath = getDefaultDownloadsPath();
    const fmt = format || 'mp3';

    // Start background download without blocking IPC invocation
    downloadService
      .downloadTrack(track, fmt, downloadsPath, (progress, status, error, filePath) => {
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('download:progress', {
            trackId: track.id,
            progress,
            status,
            error,
            filePath,
          });
        }
      })
      .catch((err) => {
        console.warn('[Main] downloadTrack error:', err);
      });

    return { started: true };
  }
);

ipcMain.handle('download:check-status', async (_event, { tracks }: { tracks: TrackMetadata[] }) => {
  const downloadsPath = getDefaultDownloadsPath();
  const results: Record<string, { downloaded: boolean; format?: DownloadFormat; filePath?: string }> = {};

  if (!tracks || !Array.isArray(tracks)) return results;

  for (const track of tracks) {
    results[track.id] = downloadService.checkTrackDownloaded(track, downloadsPath);
  }
  return results;
});

ipcMain.handle(
  'download:show-in-folder',
  async (_event, payload: { filePath?: string; track?: TrackMetadata }) => {
    const downloadsPath = getDefaultDownloadsPath();
    let targetPath = payload?.filePath;

    if (!targetPath && payload?.track) {
      const status = downloadService.checkTrackDownloaded(payload.track, downloadsPath);
      if (status.downloaded && status.filePath) {
        targetPath = status.filePath;
      } else {
        const expectedMp3 = path.join(downloadsPath, downloadService.getExpectedFilename(payload.track, 'mp3'));
        if (fs.existsSync(expectedMp3)) targetPath = expectedMp3;
        const expectedFlac = path.join(downloadsPath, downloadService.getExpectedFilename(payload.track, 'flac'));
        if (fs.existsSync(expectedFlac)) targetPath = expectedFlac;
      }
    }

    if (targetPath && fs.existsSync(targetPath)) {
      shell.showItemInFolder(path.resolve(targetPath));
      return { success: true, filePath: targetPath };
    }

    return { success: false, notFound: true };
  }
);

ipcMain.handle('download:remove-track', async (_event, { track }: { track: TrackMetadata }) => {
  const downloadsPath = getDefaultDownloadsPath();
  return downloadService.removeDownloadedTrack(track, downloadsPath);
});

ipcMain.handle('download:get-tracks', async () => {
  const downloadsPath = getDefaultDownloadsPath();
  return downloadService.getDownloadedTracks(downloadsPath);
});

let cachedUserProfile: { username: string; avatarUrl: string | null } | null = null;

ipcMain.handle('app:get-user-profile', async () => {
  if (cachedUserProfile) return cachedUserProfile;

  const username = process.env.USERNAME || 'Alex';
  const bmpPath = path.join(process.env.LOCALAPPDATA || '', 'Temp.bmp');

  if (fs.existsSync(bmpPath)) {
    try {
      const buf = fs.readFileSync(bmpPath);
      if (buf.length > 1000) {
        cachedUserProfile = {
          username,
          avatarUrl: `data:image/bmp;base64,${buf.toString('base64')}`,
        };
        return cachedUserProfile;
      }
    } catch {}
  }

  try {
    const psCmd = `powershell -NoProfile -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; using System.Text; public class UserPic { [DllImport(\\\"shell32.dll\\\", EntryPoint=\\\"#261\\\", CharSet=CharSet.Unicode)] public static extern void GetUserTilePath(string u, uint f, StringBuilder p, int m); }'; \\$s=New-Object System.Text.StringBuilder 260; [UserPic]::GetUserTilePath(\\$null,[Convert]::ToUInt32(\\\"80000000\\\",16),\\$s,260);"`;
    await new Promise<void>((resolve) => {
      exec(psCmd, { timeout: 3000 }, () => resolve());
    });
    if (fs.existsSync(bmpPath)) {
      const buf = fs.readFileSync(bmpPath);
      if (buf.length > 1000) {
        cachedUserProfile = {
          username,
          avatarUrl: `data:image/bmp;base64,${buf.toString('base64')}`,
        };
        return cachedUserProfile;
      }
    }
  } catch {}

  cachedUserProfile = { username, avatarUrl: null };
  return cachedUserProfile;
});

app.whenReady().then(() => {
  // Enable CORS bypass for Web Audio API audio streaming from CDNs
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Headers': ['*'],
        'Access-Control-Allow-Methods': ['GET, POST, OPTIONS'],
      },
    });
  });

  // Handle local file streaming for downloaded audio via atom:// protocol with Range support
  protocol.handle('atom', async (request) => {
    try {
      let pathname = request.url.replace(/^atom:\/\/(local\/)?/, '');
      pathname = decodeURIComponent(pathname);
      if (process.platform === 'win32' && pathname.startsWith('/')) {
        pathname = pathname.slice(1);
      }
      const fileUrl = pathToFileURL(pathname).toString();
      const res = await net.fetch(fileUrl);
      const headers = new Headers(res.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set('Access-Control-Allow-Headers', '*');
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      });
    } catch (err) {
      console.warn('[Protocol atom] Failed to stream file:', err);
      return new Response('File not found', { status: 404 });
    }
  });

  createWindow();

  if (closeToTray) {
    createTray();
  }

  // Register global shortcuts
  try {
    globalShortcut.register('MediaPlayPause', () => {
      mainWindow?.webContents.send('media-key', 'play-pause');
    });
    globalShortcut.register('MediaNextTrack', () => {
      mainWindow?.webContents.send('media-key', 'next');
    });
    globalShortcut.register('MediaPreviousTrack', () => {
      mainWindow?.webContents.send('media-key', 'prev');
    });
  } catch (err) {
    console.warn('Failed to register global shortcuts:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
