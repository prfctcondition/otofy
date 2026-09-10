import type { Track, Playlist } from '../types';
import repo from '../db/repository';

/**
 * Optional account sync service.
 * Imports remote playlists from YouTube Music or SoundCloud
 * into the local Dexie database via Electron IPC.
 */

export async function importYouTubePlaylist(playlistUrl: string): Promise<{
  playlist: Playlist;
  tracks: Track[];
} | null> {
  if (!window.electronAPI) {
    console.warn('[AccountSync] Electron API not available');
    return null;
  }

  try {
    const result = await window.electronAPI.importRemotePlaylist('yt', playlistUrl);
    if (!result || !result.tracks || result.tracks.length === 0) return null;
    const { tracks, title: playlistTitle } = result;

    const playlistId = `yt-import-${Date.now()}`;
    const playlist = await repo.createPlaylist({
      id: playlistId,
      title: playlistTitle || `YouTube Import (${tracks.length} tracks)`,
      type: 'Playlist',
      creator: 'YouTube Music',
      songCount: tracks.length,
      iconName: 'music',
      gradientFrom: '#DC2626',
      gradientTo: '#991B1B',
    });

    // Save tracks and add to playlist
    for (const track of tracks) {
      await repo.putTrack(track);
      await repo.addTrackToPlaylist(playlistId, track.id);
    }

    return { playlist, tracks };
  } catch (err) {
    console.error('[AccountSync] YouTube import failed:', err);
    return null;
  }
}

export async function importSoundCloudPlaylist(playlistUrl: string): Promise<{
  playlist: Playlist;
  tracks: Track[];
} | null> {
  if (!window.electronAPI) {
    console.warn('[AccountSync] Electron API not available');
    return null;
  }

  try {
    const result = await window.electronAPI.importRemotePlaylist('sc', playlistUrl);
    if (!result || !result.tracks || result.tracks.length === 0) return null;
    const { tracks, title: playlistTitle } = result;

    const playlistId = `sc-import-${Date.now()}`;
    const playlist = await repo.createPlaylist({
      id: playlistId,
      title: playlistTitle || `SoundCloud Import (${tracks.length} tracks)`,
      type: 'Playlist',
      creator: 'SoundCloud',
      songCount: tracks.length,
      iconName: 'waves',
      gradientFrom: '#F97316',
      gradientTo: '#C2410C',
      artworkUrl: result.artworkUrl,
    });

    for (const track of tracks) {
      const fixedTrack = {
        ...track,
        artworkUrl: track.artworkUrl || result.artworkUrl,
      };
      await repo.putTrack(fixedTrack);
      await repo.addTrackToPlaylist(playlistId, fixedTrack.id);
    }

    return { playlist, tracks };
  } catch (err) {
    console.error('[AccountSync] SoundCloud import failed:', err);
    return null;
  }
}
