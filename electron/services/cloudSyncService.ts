import type { WebContents } from 'electron';
import authService from './authService.js';
import innertubeService, { getInnertube, parseDurationToSec } from './innertubeService.js';
import scResolver from './scResolver.js';
import { cleanArtistAndTitle } from './trackParser.js';

export interface SyncedPlaylist {
  id: string;
  title: string;
  creator: string;
  artworkUrl?: string;
  iconName: string;
  gradientFrom: string;
  gradientTo: string;
  isSynced?: boolean;
  syncSource?: 'youtube' | 'soundcloud';
  tracks: Array<{
    id: string;
    number: number;
    title: string;
    artist: string;
    album: string;
    duration: string;
    durationSec: number;
    dateAdded: string;
    source: 'YT' | 'SC';
    sourceLabel: string;
    sourceId: string;
    artworkUrl?: string;
    iconName: string;
    gradientFrom: string;
    gradientTo: string;
    isLiked?: boolean;
  }>;
}

export interface SyncProgressPayload {
  platform: 'youtube' | 'soundcloud';
  current: number;
  total: number;
  message: string;
}

class CloudSyncService {
  public async sync(
    platform: 'youtube' | 'soundcloud',
    sender?: WebContents
  ): Promise<{ success: boolean; playlists: SyncedPlaylist[]; error?: string }> {
    if (platform === 'youtube') {
      return await this.syncYouTube(sender);
    } else {
      return await this.syncSoundCloud(sender);
    }
  }

  private emitProgress(sender: WebContents | undefined, data: SyncProgressPayload) {
    if (!sender) return;
    try {
      sender.send('account:sync-progress', data);
    } catch {}
  }

  private async syncYouTube(
    sender?: WebContents
  ): Promise<{ success: boolean; playlists: SyncedPlaylist[]; error?: string }> {
    const cookie = authService.getYoutubeCookie();
    if (!cookie) {
      return { success: false, playlists: [], error: 'YouTube account is not connected.' };
    }

    try {
      this.emitProgress(sender, {
        platform: 'youtube',
        current: 0,
        total: 100,
        message: 'Connecting to YouTube Music library...',
      });

      const yt = await getInnertube();
      const user = authService.getSession().youtube?.username || 'You';
      const resultPlaylists: SyncedPlaylist[] = [];

      // Fetch User Custom Playlists only (no Liked Songs)
      this.emitProgress(sender, {
        platform: 'youtube',
        current: 40,
        total: 100,
        message: 'Fetching user playlists...',
      });

      try {
        const candidatePlaylists: Array<{ id: string; title: string; artworkUrl?: string }> = [];
        const seenIds = new Set<string>();

        // Recursive walker to extract any playlists from YouTube/YTMusic browse responses
        const extractFromResponse = (data: any) => {
          function walk(obj: any) {
            if (!obj || typeof obj !== 'object') return;

            if (obj.musicTwoRowItemRenderer) {
              const item = obj.musicTwoRowItemRenderer;
              const bId =
                item.navigationEndpoint?.browseEndpoint?.browseId ||
                item.onTap?.browseEndpoint?.browseId ||
                item.thumbnailOverlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.playlistId;
              const cleanId = bId ? bId.replace(/^VL/, '') : '';
              if (cleanId && (cleanId.startsWith('PL') || cleanId.startsWith('RDCLAK') || cleanId.startsWith('OLAK'))) {
                const title =
                  item.title?.runs?.[0]?.text ||
                  (typeof item.title === 'string' ? item.title : 'Playlist');
                const thumbs = item.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
                const artworkUrl = thumbs.length > 0 ? thumbs[thumbs.length - 1].url : undefined;
                if (!seenIds.has(cleanId)) {
                  seenIds.add(cleanId);
                  candidatePlaylists.push({ id: cleanId, title, artworkUrl });
                }
              }
            }

            if (obj.gridPlaylistRenderer || obj.playlistRenderer) {
              const pl = obj.gridPlaylistRenderer || obj.playlistRenderer;
              const cleanId = pl.playlistId ? pl.playlistId.replace(/^VL/, '') : '';
              if (cleanId && !seenIds.has(cleanId)) {
                seenIds.add(cleanId);
                const title =
                  pl.title?.runs?.[0]?.text ||
                  pl.title?.simpleText ||
                  (typeof pl.title === 'string' ? pl.title : 'Playlist');
                const thumbs = pl.thumbnail?.thumbnails || [];
                const artworkUrl = thumbs.length > 0 ? thumbs[thumbs.length - 1].url : undefined;
                candidatePlaylists.push({ id: cleanId, title, artworkUrl });
              }
            }

            if (Array.isArray(obj)) {
              for (const el of obj) walk(el);
            } else {
              for (const k of Object.keys(obj)) walk(obj[k]);
            }
          }
          walk(data);
        };

        // Query YouTube Music library landing and liked playlists
        for (const browseId of ['FEmusic_liked_playlists', 'FEmusic_library_landing']) {
          try {
            const res = await yt.actions.execute('/browse', { browseId, client: 'YTMUSIC' });
            if (res?.data) {
              extractFromResponse(res.data);
            }
          } catch (bErr) {
            console.warn(`[CloudSync] Browse ${browseId} error:`, bErr);
          }
        }

        // Fallback: Query standard YouTube library (FElibrary)
        if (candidatePlaylists.length === 0) {
          try {
            const res = await yt.actions.execute('/browse', { browseId: 'FElibrary' });
            if (res?.data) {
              extractFromResponse(res.data);
            }
          } catch (fErr) {
            console.warn('[CloudSync] Browse FElibrary error:', fErr);
          }
        }

        const maxSync = Math.min(candidatePlaylists.length, 15);

        for (let i = 0; i < maxSync; i++) {
          const pl = candidatePlaylists[i];
          const plId = pl.id;
          if (!plId) continue;

          const progressVal = 40 + Math.round(((i + 1) / maxSync) * 55);
          this.emitProgress(sender, {
            platform: 'youtube',
            current: progressVal,
            total: 100,
            message: `Syncing playlist "${pl.title || 'Playlist'}"...`,
          });

          try {
            const tracksData = await innertubeService.getPlaylistTracks(plId);
            if (tracksData && tracksData.tracks.length > 0) {
              const formattedTracks = tracksData.tracks.map((t, idx) => ({
                id: `yt-sync-${plId}-${t.id || idx}`,
                number: idx + 1,
                title: t.title,
                artist: t.artist,
                album: tracksData.title || pl.title || 'Playlist',
                duration: t.duration,
                durationSec: t.durationSec,
                dateAdded: new Date().toISOString(),
                source: 'YT' as const,
                sourceLabel: 'YouTube Music',
                sourceId: t.sourceId || t.id,
                artworkUrl: t.artworkUrl,
                iconName: 'music',
                gradientFrom: '#7C3AED',
                gradientTo: '#4C1D95',
              }));

              resultPlaylists.push({
                id: `pl-yt-${plId}`,
                title: tracksData.title || pl.title || 'YouTube Playlist',
                creator: tracksData.author || user,
                artworkUrl: tracksData.artworkUrl || pl.artworkUrl,
                iconName: 'music',
                gradientFrom: '#7C3AED',
                gradientTo: '#4C1D95',
                isSynced: true,
                syncSource: 'youtube',
                tracks: formattedTracks,
              });
            }
          } catch (itemErr) {
            console.warn(`[CloudSync] Failed to sync playlist ${plId}:`, itemErr);
          }
        }
      } catch (feedErr) {
        console.warn('[CloudSync] Failed to fetch playlists feed:', feedErr);
      }

      this.emitProgress(sender, {
        platform: 'youtube',
        current: 100,
        total: 100,
        message: `Synchronization complete! Imported ${resultPlaylists.length} playlists.`,
      });

      return { success: true, playlists: resultPlaylists };
    } catch (err: any) {
      console.error('[CloudSync] YouTube sync failed:', err);
      return { success: false, playlists: [], error: err?.message || 'Failed to sync YouTube library' };
    }
  }

  private async syncSoundCloud(
    sender?: WebContents
  ): Promise<{ success: boolean; playlists: SyncedPlaylist[]; error?: string }> {
    const token = authService.getSoundcloudToken();
    const cookie = authService.getSoundcloudCookie();
    const user = authService.getSession().soundcloud?.username || 'SoundCloud User';
    const clientId = 'y7xP5e50k2cT7Uo3n30zG6jPffV4d00B';

    try {
      this.emitProgress(sender, {
        platform: 'soundcloud',
        current: 10,
        total: 100,
        message: 'Connecting to SoundCloud...',
      });

      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      };
      if (token) {
        headers['Authorization'] = `OAuth ${token}`;
      }
      if (cookie) {
        headers['Cookie'] = cookie;
      }

      const resultPlaylists: SyncedPlaylist[] = [];

      // Fetch User Custom Playlists only (no Liked Tracks)
      this.emitProgress(sender, {
        platform: 'soundcloud',
        current: 60,
        total: 100,
        message: 'Fetching SoundCloud playlists...',
      });

      try {
        const plRes = await fetch(
          `https://api-v2.soundcloud.com/me/playlists?client_id=${clientId}&limit=20`,
          { headers }
        );

        if (plRes.ok) {
          const plData = await plRes.json();
          const collections: any[] = plData.collection || plData || [];

          for (let i = 0; i < collections.length; i++) {
            const pl = collections[i];
            const rawTracks: any[] = pl.tracks || [];
            const validTracks = rawTracks.filter((t) => t && t.id);

            const tracks = validTracks.map((t: any, idx: number) => {
              const durSec = Math.round((t.duration || 0) / 1000);
              const title = (t.title || 'Untitled').trim();
              const artist = (t.user?.username || 'SoundCloud Artist').trim();
              const rawArt = t.artwork_url || t.user?.avatar_url || pl.artwork_url || '';
              const artworkUrl = rawArt ? rawArt.replace('-large.', '-t500x500.') : undefined;

              return {
                id: `sc-sync-${pl.id}-${t.id || idx}`,
                number: idx + 1,
                title,
                artist,
                album: pl.title || 'Playlist',
                duration: scResolver.formatDuration(durSec),
                durationSec: durSec,
                dateAdded: new Date().toISOString(),
                source: 'SC' as const,
                sourceLabel: 'SoundCloud',
                sourceId: String(t.id),
                artworkUrl,
                iconName: 'radio',
                gradientFrom: '#EA580C',
                gradientTo: '#C2410C',
              };
            });

            if (tracks.length > 0) {
              const plArt = (pl.artwork_url || tracks[0]?.artworkUrl || '').replace('-large.', '-t500x500.');
              resultPlaylists.push({
                id: `pl-sc-${pl.id}`,
                title: pl.title || 'SoundCloud Playlist',
                creator: pl.user?.username || user,
                artworkUrl: plArt || undefined,
                iconName: 'radio',
                gradientFrom: '#EA580C',
                gradientTo: '#C2410C',
                isSynced: true,
                syncSource: 'soundcloud',
                tracks,
              });
            }
          }
        }
      } catch (plErr) {
        console.warn('[CloudSync] SoundCloud playlists fetch error:', plErr);
      }

      this.emitProgress(sender, {
        platform: 'soundcloud',
        current: 100,
        total: 100,
        message: `Synchronization complete! Imported ${resultPlaylists.length} playlists.`,
      });

      return { success: true, playlists: resultPlaylists };
    } catch (err: any) {
      console.error('[CloudSync] SoundCloud sync failed:', err);
      return { success: false, playlists: [], error: err?.message || 'Failed to sync SoundCloud library' };
    }
  }

  public async addTrackToCloudPlaylist(
    platform: 'youtube' | 'soundcloud',
    playlistId: string,
    track: { id: string; sourceId?: string; title?: string; artist?: string; source?: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (platform === 'youtube') {
        const cleanPlId = playlistId.replace(/^pl-yt-/, '').replace(/^VL/, '');
        const rawId = track.sourceId || track.id || '';
        const match = rawId.match(/([a-zA-Z0-9_-]{11})$/);
        const vId = match ? match[1] : rawId.replace(/^yt-/, '');

        if (!vId || vId.length !== 11) {
          return { success: false, error: 'Invalid YouTube video ID' };
        }

        const yt = await getInnertube();
        try {
          const res = await yt.actions.execute('/browse/edit_playlist', {
            playlistId: cleanPlId,
            actions: [
              {
                action: 'ACTION_ADD_VIDEO',
                addedVideoId: vId,
              },
            ],
            client: 'YTMUSIC',
          });
          if (res.status_code === 200) {
            console.log(`[CloudSync] Successfully added video ${vId} to YouTube playlist ${cleanPlId}`);
            return { success: true };
          }
        } catch (ytmErr) {
          console.warn('[CloudSync] YTMUSIC add endpoint error, trying fallback:', ytmErr);
        }

        await yt.playlist.addVideos(cleanPlId, [vId]);
        return { success: true };
      } else if (platform === 'soundcloud') {
        const cleanPlId = playlistId.replace(/^pl-sc-/, '');
        const token = authService.getSoundcloudToken();
        const cookie = authService.getSoundcloudCookie();
        const clientId = 'y7xP5e50k2cT7Uo3n30zG6jPffV4d00B';
        const headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          Referer: 'https://soundcloud.com/',
        };
        if (token) headers['Authorization'] = `OAuth ${token}`;
        if (cookie) headers['Cookie'] = cookie;

        const curRes = await fetch(`https://api-v2.soundcloud.com/playlists/${cleanPlId}?client_id=${clientId}`, { headers });
        if (!curRes.ok) throw new Error(`Failed to load SoundCloud playlist: ${curRes.status}`);
        const curData: any = await curRes.json();
        const existingTrackIds: number[] = (curData.tracks || [])
          .map((t: any) => Number(t.id || t))
          .filter((n: number) => !isNaN(n) && n > 0);

        const rawScId = track.sourceId || track.id || '';
        const numId = Number(rawScId.replace(/^sc-/, ''));
        if (!isNaN(numId) && !existingTrackIds.includes(numId)) {
          existingTrackIds.push(numId);
        }

        const updateRes = await fetch(`https://api-v2.soundcloud.com/playlists/${cleanPlId}?client_id=${clientId}`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ playlist: { tracks: existingTrackIds } }),
        });
        if (!updateRes.ok) throw new Error(`SoundCloud update failed with status ${updateRes.status}`);
        return { success: true };
      }
      return { success: false, error: 'Unsupported cloud platform' };
    } catch (err: any) {
      console.warn(`[CloudSync] addTrackToCloudPlaylist error (${platform}):`, err?.message || err);
      return { success: false, error: err?.message || 'Failed to add track to cloud playlist' };
    }
  }

  public async removeTrackFromCloudPlaylist(
    platform: 'youtube' | 'soundcloud',
    playlistId: string,
    trackId: string,
    sourceId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (platform === 'youtube') {
        const cleanPlId = playlistId.replace(/^pl-yt-/, '').replace(/^VL/, '');
        let vId = sourceId;
        if (!vId) {
          if (trackId.startsWith(`yt-sync-${cleanPlId}-`)) {
            vId = trackId.slice(`yt-sync-${cleanPlId}-`.length);
          } else if (trackId.startsWith('yt-')) {
            vId = trackId.slice(3);
          } else {
            const match = trackId.match(/([a-zA-Z0-9_-]{11})$/);
            vId = match ? match[1] : trackId;
          }
        }

        if (!vId) {
          return { success: false, error: 'Invalid YouTube video ID' };
        }

        const yt = await getInnertube();

        // 1. Locate setVideoId via YouTube Music playlist
        let setVideoId: string | null = null;
        try {
          const pl = await yt.music.getPlaylist(cleanPlId);
          const allItems: any[] = [...((pl.items as any[]) || [])];
          let plPage = pl;
          let pages = 0;
          while (plPage && (plPage as any).has_continuation && pages < 20) {
            try {
              plPage = await (plPage as any).getContinuation();
              if (plPage?.items && Array.isArray(plPage.items)) {
                allItems.push(...plPage.items);
              }
            } catch {
              break;
            }
            pages++;
          }

          const targetItem = allItems.find((it: any) => {
            if (it.id === vId) return true;
            if (it.endpoint?.payload?.videoId === vId) return true;
            return false;
          });

          if (targetItem?.menu?.items) {
            for (const m of targetItem.menu.items) {
              if (m.endpoint?.payload?.actions) {
                for (const act of m.endpoint.payload.actions) {
                  if (act.action === 'ACTION_REMOVE_VIDEO' && act.setVideoId) {
                    setVideoId = act.setVideoId;
                    break;
                  }
                }
              }
              if (setVideoId) break;
            }
          }

          if (!setVideoId && targetItem) {
            function walk(o: any) {
              if (setVideoId || !o || typeof o !== 'object') return;
              if (typeof o.setVideoId === 'string' && o.setVideoId) {
                setVideoId = o.setVideoId;
                return;
              }
              if (Array.isArray(o)) {
                for (const el of o) walk(el);
              } else {
                for (const k of Object.keys(o)) walk(o[k]);
              }
            }
            walk(targetItem);
          }
        } catch (mErr) {
          console.warn('[CloudSync] yt.music.getPlaylist error during removal:', mErr);
        }

        // 2. If setVideoId found, call official YouTube Music edit_playlist endpoint
        if (setVideoId) {
          const removeRes = await yt.actions.execute('/browse/edit_playlist', {
            playlistId: cleanPlId,
            actions: [
              {
                action: 'ACTION_REMOVE_VIDEO',
                setVideoId,
                removedVideoId: vId,
              },
            ],
            client: 'YTMUSIC',
          });
          if (removeRes.status_code === 200) {
            console.log(`[CloudSync] Successfully removed video ${vId} (setVideoId: ${setVideoId}) from YouTube playlist ${cleanPlId}`);
            return { success: true };
          }
        }

        // 3. Fallback: try standard Innertube removeVideos
        try {
          await yt.playlist.removeVideos(cleanPlId, [vId]);
          console.log(`[CloudSync] Removed video ${vId} via fallback removeVideos`);
          return { success: true };
        } catch (fallbackErr: any) {
          console.warn('[CloudSync] Fallback removeVideos failed:', fallbackErr?.message || fallbackErr);
        }

        return { success: false, error: 'Could not find video in remote YouTube playlist to remove' };
      } else if (platform === 'soundcloud') {
        const cleanPlId = playlistId.replace(/^pl-sc-/, '');
        const token = authService.getSoundcloudToken();
        const cookie = authService.getSoundcloudCookie();
        const clientId = 'y7xP5e50k2cT7Uo3n30zG6jPffV4d00B';
        const headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          Referer: 'https://soundcloud.com/',
        };
        if (token) headers['Authorization'] = `OAuth ${token}`;
        if (cookie) headers['Cookie'] = cookie;

        const curRes = await fetch(`https://api-v2.soundcloud.com/playlists/${cleanPlId}?client_id=${clientId}`, { headers });
        if (!curRes.ok) throw new Error(`Failed to load SoundCloud playlist: ${curRes.status}`);
        const curData: any = await curRes.json();
        const rawId = sourceId || trackId;
        const targetNum = Number(rawId.replace(/^sc-/, ''));
        const remainingTrackIds = (curData.tracks || [])
          .map((t: any) => Number(t.id || t))
          .filter((n: number) => !isNaN(n) && n > 0 && n !== targetNum);

        const updateRes = await fetch(`https://api-v2.soundcloud.com/playlists/${cleanPlId}?client_id=${clientId}`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ playlist: { tracks: remainingTrackIds } }),
        });
        if (!updateRes.ok) throw new Error(`SoundCloud update failed with status ${updateRes.status}`);
        return { success: true };
      }
      return { success: false, error: 'Unsupported cloud platform' };
    } catch (err: any) {
      console.warn(`[CloudSync] removeTrackFromCloudPlaylist error (${platform}):`, err?.message || err);
      return { success: false, error: err?.message || 'Failed to remove track from cloud playlist' };
    }
  }
}

export const cloudSyncService = new CloudSyncService();
export default cloudSyncService;
