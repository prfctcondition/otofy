import { app, BrowserWindow, ipcMain, globalShortcut, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import ytResolver from './services/ytResolver.js';
import scResolver from './services/scResolver.js';
import searchService from './services/searchService.js';
import { cleanArtistAndTitle } from './services/trackParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

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
    backgroundColor: '#0B0F19',
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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
  if (source === 'SC') {
    return await scResolver.getArtistDetails(artistName);
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
      return ytDetails;
    }
  } catch (err) {
    console.warn('[main] innertube getArtist failed, falling back to soundcloud:', err);
  }
  return await scResolver.getArtistDetails(artistName);
});

ipcMain.handle('music:get-album', async (_event, { browseId, source }: { browseId: string; source?: 'YT' | 'SC' }) => {
  if (source === 'SC' || /^\d+$/.test(browseId)) {
    return await scResolver.getAlbum(browseId);
  }
  try {
    return await innertubeService.getAlbum(browseId);
  } catch (e) {
    return await scResolver.getAlbum(browseId);
  }
});

ipcMain.handle('music:get-lyrics', async (_event, { videoId }: { videoId: string }) => {
  return await innertubeService.getLyrics(videoId);
});

ipcMain.handle('music:get-genre-tracks', async (_event, { query }: { query: string }) => {
  try {
    // 1. Try official YouTube Music playlist curation via InnerTube
    const ytTracks = await innertubeService.getGenreTracks(query);
    if (ytTracks && ytTracks.length >= 35) {
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

    return ytTracks;
  } catch (err) {
    console.warn('[main] getGenreTracks error:', err);
    return [];
  }
});

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
    mainWindow.close();
  }
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

  createWindow();

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
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
