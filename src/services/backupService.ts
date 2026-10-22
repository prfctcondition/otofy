import { repo } from '../db/repository';
import { isSystemPlaylist, type Track, type Playlist, type FollowedArtist, type SavedAlbum } from '../types';
import { useLibraryStore } from '../store/libraryStore';

declare const __APP_VERSION__: string | undefined;

export interface BackupTrack {
  title: string;
  artist: string;
  artists?: string[];
  album?: string;
  durationSec: number;
  source: 'YT' | 'SC' | 'LOCAL';
  sourceId: string;
  url: string;
  artworkUrl?: string;
  addedAt?: number | string;
}

export interface BackupPlaylist {
  title: string;
  description?: string;
  creator?: string;
  artworkUrl?: string;
  gradientFrom?: string;
  gradientTo?: string;
  iconName?: string;
  isPinned?: boolean;
  createdAt?: number;
  tracks: BackupTrack[];
}

export interface BackupArtist {
  name: string;
  browseId?: string;
  avatarUrl?: string;
  source?: 'YT' | 'SC';
  followedAt?: number;
}

export interface BackupAlbum {
  title: string;
  artist: string;
  browseId?: string;
  artworkUrl: string;
  year?: string;
  source: 'YT' | 'SC';
  savedAt?: number;
}

export interface OtofyBackupData {
  format: 'otofy-backup';
  version: 1;
  exportedAt: string;
  appVersion: string;
  stats: {
    playlistsCount: number;
    likedTracksCount: number;
    totalTracksCount: number;
    followedArtistsCount?: number;
    savedAlbumsCount?: number;
  };
  likedTracks: BackupTrack[];
  playlists: BackupPlaylist[];
  followedArtists?: BackupArtist[];
  savedAlbums?: BackupAlbum[];
}

export interface ImportSummary {
  playlistsCount: number;
  likedTracksCount: number;
  totalTracksCount: number;
  artistsCount: number;
  albumsCount: number;
}

function trackToBackupTrack(t: Track): BackupTrack {
  const source = (t.source === 'SC' ? 'SC' : t.source === 'LOCAL' ? 'LOCAL' : 'YT') as 'YT' | 'SC' | 'LOCAL';
  const sourceId = t.sourceId || t.id;
  let url = t.streamUrl || '';
  if (source === 'YT') {
    url = `https://music.youtube.com/watch?v=${sourceId}`;
  } else if (source === 'SC') {
    url = t.streamUrl || `https://soundcloud.com/track/${sourceId}`;
  }

  return {
    title: t.title || 'Untitled Track',
    artist: t.artist || 'Unknown Artist',
    artists: t.artists && t.artists.length > 0 ? t.artists : undefined,
    album: t.album && t.album !== 'Unknown Album' ? t.album : undefined,
    durationSec: t.durationSec || 180,
    source,
    sourceId,
    url,
    artworkUrl: t.artworkUrl || t.thumbnail,
    addedAt: t.dateAdded || Date.now(),
  };
}

function backupTrackToTrack(bt: BackupTrack, idx: number, playlistTitle?: string): Track {
  const durSec = bt.durationSec || 180;
  const mins = Math.floor(durSec / 60);
  const secs = Math.floor(durSec % 60);
  const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const trackId = `${bt.source === 'SC' ? 'sc' : 'yt'}-${bt.sourceId}`;

  return {
    id: trackId,
    number: idx + 1,
    title: bt.title || 'Untitled Track',
    artist: bt.artist || 'Unknown Artist',
    artists: bt.artists && bt.artists.length > 0 ? bt.artists : undefined,
    album: bt.album || playlistTitle || 'Otofy Library',
    duration: durationStr,
    durationSec: durSec,
    dateAdded: typeof bt.addedAt === 'number' ? new Date(bt.addedAt).toISOString() : (bt.addedAt || new Date().toISOString()),
    source: bt.source || 'YT',
    sourceLabel: bt.source === 'SC' ? 'SoundCloud' : bt.source === 'LOCAL' ? 'Local' : 'YouTube Music',
    iconName: bt.source === 'SC' ? 'waves' : 'disc',
    gradientFrom: bt.source === 'SC' ? '#FF5500' : '#142347',
    gradientTo: bt.source === 'SC' ? '#FF7700' : '#2A437E',
    sourceId: bt.sourceId,
    artworkUrl: bt.artworkUrl,
    thumbnail: bt.artworkUrl,
    streamUrl: bt.url && bt.url.startsWith('http') ? bt.url : undefined,
  };
}

// Gather and export complete library backup
export async function exportOtofyBackup(): Promise<OtofyBackupData> {
  const allPlaylists = await repo.getPlaylists();
  const userPlaylists = allPlaylists.filter(
    (p) => !isSystemPlaylist(p) && p.id !== 'pl-liked'
  );

  const exportedPlaylists: BackupPlaylist[] = [];
  let totalTracksCount = 0;

  for (const pl of userPlaylists) {
    const tracks = await repo.getPlaylistTracks(pl.id);
    totalTracksCount += tracks.length;
    exportedPlaylists.push({
      title: pl.title,
      description: pl.description,
      creator: pl.creator,
      artworkUrl: pl.artworkUrl,
      gradientFrom: pl.gradientFrom,
      gradientTo: pl.gradientTo,
      iconName: pl.iconName,
      isPinned: pl.isPinned,
      createdAt: pl.createdAt,
      tracks: tracks.map(trackToBackupTrack),
    });
  }

  // Liked tracks
  const likedTracks = await repo.getPlaylistTracks('pl-liked');
  totalTracksCount += likedTracks.length;
  const exportedLikedTracks = likedTracks.map(trackToBackupTrack);

  const followedArtists = useLibraryStore.getState().followedArtists || [];
  const savedAlbums = useLibraryStore.getState().savedAlbums || [];
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.5';

  const backupData: OtofyBackupData = {
    format: 'otofy-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion,
    stats: {
      playlistsCount: exportedPlaylists.length,
      likedTracksCount: exportedLikedTracks.length,
      totalTracksCount,
      followedArtistsCount: followedArtists.length,
      savedAlbumsCount: savedAlbums.length,
    },
    likedTracks: exportedLikedTracks,
    playlists: exportedPlaylists,
    followedArtists: followedArtists.map((a) => ({
      name: a.name,
      browseId: a.browseId,
      avatarUrl: a.avatarUrl,
      source: a.source,
      followedAt: a.followedAt,
    })),
    savedAlbums: savedAlbums.map((alb) => ({
      title: alb.title,
      artist: alb.artist,
      browseId: alb.browseId,
      artworkUrl: alb.artworkUrl,
      year: alb.year,
      source: alb.source,
      savedAt: alb.savedAt,
    })),
  };

  return backupData;
}

// Save backup to .oto file via native Electron or browser download
export async function downloadOtofyBackup(data: OtofyBackupData): Promise<boolean> {
  const json = JSON.stringify(data, null, 2);
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const defaultFilename = `Otofy-Export-${dateStr}.oto`;

  if (window.electronAPI?.saveBackupFile) {
    const savedPath = await window.electronAPI.saveBackupFile(defaultFilename, json);
    return !!savedPath;
  }

  // Browser Blob download fallback
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

// Parse and validate .oto backup content
export function parseOtofyBackupFile(content: string): OtofyBackupData {
  try {
    const data = JSON.parse(content);
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON format.');
    }

    const hasPlaylists = Array.isArray(data.playlists);
    const hasLiked = Array.isArray(data.likedTracks);
    if (!hasPlaylists && !hasLiked) {
      throw new Error('File does not contain valid Otofy playlists or liked tracks.');
    }

    return {
      format: 'otofy-backup',
      version: data.version || 1,
      exportedAt: data.exportedAt || new Date().toISOString(),
      appVersion: data.appVersion || 'unknown',
      stats: {
        playlistsCount: hasPlaylists ? data.playlists.length : 0,
        likedTracksCount: hasLiked ? data.likedTracks.length : 0,
        totalTracksCount: (hasPlaylists ? data.playlists.reduce((acc: number, p: any) => acc + (p.tracks?.length || 0), 0) : 0) + (hasLiked ? data.likedTracks.length : 0),
        followedArtistsCount: Array.isArray(data.followedArtists) ? data.followedArtists.length : 0,
        savedAlbumsCount: Array.isArray(data.savedAlbums) ? data.savedAlbums.length : 0,
      },
      likedTracks: hasLiked ? data.likedTracks : [],
      playlists: hasPlaylists ? data.playlists : [],
      followedArtists: Array.isArray(data.followedArtists) ? data.followedArtists : [],
      savedAlbums: Array.isArray(data.savedAlbums) ? data.savedAlbums : [],
    };
  } catch (err: any) {
    throw new Error(err.message || 'Failed to read .oto file.');
  }
}

// Restore backup into Dexie and library store
export async function importOtofyBackup(
  data: OtofyBackupData,
  onProgress?: (progress: { message: string; percent: number }) => void
): Promise<ImportSummary> {
  let totalTracksCount = 0;
  let likedTracksCount = 0;
  let playlistsCount = 0;

  const totalSteps = (data.likedTracks.length > 0 ? 1 : 0) + data.playlists.length;
  let currentStep = 0;

  // 1. Restore Liked Tracks
  if (data.likedTracks && data.likedTracks.length > 0) {
    onProgress?.({ message: `Restoring ${data.likedTracks.length} liked tracks...`, percent: 10 });
    const tracksToPut: Track[] = [];
    const trackIdsToAdd: string[] = [];

    data.likedTracks.forEach((bt, idx) => {
      const track = backupTrackToTrack(bt, idx, 'Liked Songs');
      track.isLiked = true;
      tracksToPut.push(track);
      trackIdsToAdd.push(track.id);
    });

    await repo.putTracks(tracksToPut);
    for (const tid of trackIdsToAdd) {
      await repo.addTrackToPlaylist('pl-liked', tid);
    }
    likedTracksCount = data.likedTracks.length;
    totalTracksCount += likedTracksCount;
    currentStep++;
  }

  // 2. Restore Playlists
  const existingPlaylists = await repo.getPlaylists();
  for (let pIdx = 0; pIdx < data.playlists.length; pIdx++) {
    const bp = data.playlists[pIdx];
    const progressPercent = Math.round((currentStep + pIdx) / (Math.max(totalSteps, 1) / 80)) + 10;
    onProgress?.({ message: `Restoring playlist "${bp.title}"...`, percent: progressPercent });

    let targetPlaylist = existingPlaylists.find(
      (ep) => ep.title.trim().toLowerCase() === bp.title.trim().toLowerCase()
    );

    if (!targetPlaylist) {
      const newId = `pl-imp-${Date.now()}-${pIdx}-${Math.random().toString(36).slice(2, 6)}`;
      targetPlaylist = await repo.createPlaylist({
        id: newId,
        title: bp.title,
        description: bp.description,
        creator: bp.creator || 'You',
        artworkUrl: bp.artworkUrl,
        gradientFrom: bp.gradientFrom || '#1E293B',
        gradientTo: bp.gradientTo || '#142347',
        iconName: (bp.iconName as any) || 'disc',
        isPinned: bp.isPinned ?? false,
        createdAt: bp.createdAt || Date.now(),
      });
    }

    if (bp.tracks && bp.tracks.length > 0) {
      const pTracks: Track[] = [];
      const pTrackIds: string[] = [];

      bp.tracks.forEach((bt, tIdx) => {
        const track = backupTrackToTrack(bt, tIdx, bp.title);
        pTracks.push(track);
        pTrackIds.push(track.id);
      });

      await repo.putTracks(pTracks);
      for (const tid of pTrackIds) {
        await repo.addTrackToPlaylist(targetPlaylist.id, tid);
      }
      totalTracksCount += bp.tracks.length;
    }

    playlistsCount++;
  }

  // 3. Restore Followed Artists
  let artistsCount = 0;
  if (data.followedArtists && data.followedArtists.length > 0) {
    const currentFollowed = useLibraryStore.getState().followedArtists || [];
    const newFollowed = [...currentFollowed];
    for (const a of data.followedArtists) {
      if (!newFollowed.some((ex) => ex.name.toLowerCase() === a.name.toLowerCase())) {
        newFollowed.push({
          id: `art-${a.browseId || a.name.toLowerCase().replace(/\s+/g, '-')}`,
          name: a.name,
          browseId: a.browseId,
          avatarUrl: a.avatarUrl,
          source: a.source,
          followedAt: a.followedAt || Date.now(),
        });
        artistsCount++;
      }
    }
    useLibraryStore.setState({ followedArtists: newFollowed });
  }

  // 4. Restore Saved Albums
  let albumsCount = 0;
  if (data.savedAlbums && data.savedAlbums.length > 0) {
    const currentAlbums = useLibraryStore.getState().savedAlbums || [];
    const newAlbums = [...currentAlbums];
    for (const alb of data.savedAlbums) {
      if (!newAlbums.some((ex) => ex.title.toLowerCase() === alb.title.toLowerCase())) {
        newAlbums.push({
          id: alb.browseId || `alb-${alb.title.toLowerCase().replace(/\s+/g, '-')}`,
          title: alb.title,
          artist: alb.artist,
          browseId: alb.browseId,
          artworkUrl: alb.artworkUrl,
          year: alb.year,
          source: alb.source,
          savedAt: alb.savedAt || Date.now(),
        });
        albumsCount++;
      }
    }
    useLibraryStore.setState({ savedAlbums: newAlbums });
  }

  // 5. Reload playlists and library in store to reflect changes
  await useLibraryStore.getState().loadLibrary();

  onProgress?.({ message: 'Otofy Import complete!', percent: 100 });

  return {
    playlistsCount,
    likedTracksCount,
    totalTracksCount,
    artistsCount,
    albumsCount,
  };
}
