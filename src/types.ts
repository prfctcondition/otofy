export type SourceType = 'YT' | 'SC' | 'FLAC' | 'Master' | 'LOCAL';

export type IconType =
  | 'disc' | 'music' | 'waves' | 'headphones' | 'radio'
  | 'mic' | 'zap' | 'sparkles' | 'flame' | 'heart'
  | 'user' | 'sliders' | 'download';

export interface TrackAlternative {
  id: string;
  title: string;
  artist: string;
  artists?: string[];
  duration: string;
  durationSec: number;
  sourceId: string;
  artworkUrl?: string;
  thumbnail?: string;
}

export interface Track {
  id: string;
  number: number;
  title: string;
  artist: string;
  artists?: string[];
  album: string;
  duration: string;
  durationSec: number;
  dateAdded: string;
  source: SourceType;
  sourceLabel: string;
  iconName: IconType;
  gradientFrom: string;
  gradientTo: string;
  isLiked?: boolean;
  // New fields for streaming
  streamUrl?: string;
  artworkUrl?: string;
  thumbnail?: string;
  sourceId?: string; // YouTube video ID or SoundCloud track ID
  unresolved?: boolean;
  needsMatch?: boolean;
  alternatives?: TrackAlternative[];
  originalSpotifyPreview?: string;
}

export interface Playlist {
  id: string;
  title: string;
  type: 'Playlist' | 'Album' | 'Artist';
  creator: string;
  songCount: number;
  duration: string;
  isPinned?: boolean;
  iconName: IconType;
  gradientFrom: string;
  gradientTo: string;
  isDailyMix?: boolean;
  shareCode?: string;
  updatedAt?: string;
  artworkUrl?: string;
  description?: string;
  createdAt?: number;
  lastOpenedAt?: number;
}

export interface FollowedArtist {
  id: string;
  name: string;
  avatarUrl?: string;
  source?: 'YT' | 'SC';
  followedAt: number;
  lastOpenedAt?: number;
}

export interface SavedAlbum {
  id: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  year?: string;
  source?: 'YT' | 'SC';
  savedAt: number;
  lastOpenedAt?: number;
}

export const isSystemPlaylist = (
  playlist: Playlist | { id: string; title?: string; creator?: string } | null | undefined
): boolean => {
  if (!playlist) return false;
  const id = playlist.id;
  if (id === 'pl-liked' || id === 'pl-downloads' || id === 'pl-cached') return true;
  if (id.startsWith('pl-downloads') || id.startsWith('pl-cached') || id.startsWith('pl-liked')) return true;
  if (playlist.creator === 'System') return true;
  const title = playlist.title?.trim().toLowerCase();
  if (title === 'downloads' || title === 'liked songs' || title === 'cached songs') return true;
  return false;
};

export interface ArtistInfo {
  name: string;
  listeners: string;
  bio: string;
  verified: boolean;
  avatarGradientFrom: string;
  avatarGradientTo: string;
}

export type ViewportMode = 'desktop' | 'mobile';

export interface FlutterDeliverable {
  fileName: string;
  title: string;
  description: string;
  code: string;
}

// New types for the full system

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  durationSec: number;
  source: 'YT' | 'SC';
  sourceLabel: string;
  artworkUrl?: string;
  sourceId: string;
}

export interface ArtistAlbum {
  title: string;
  year?: string;
  artworkUrl?: string;
  browseId?: string;
  type?: string;
  source?: 'YT' | 'SC';
}

export interface ArtistDetails {
  artist: string;
  avatarUrl?: string;
  bio?: string;
  browseId?: string;
  subscribers?: string;
  source?: 'YT' | 'SC';
  topTracks: SearchResult[];
  albums: ArtistAlbum[];
  singles?: ArtistAlbum[];
  relatedArtists?: Array<{
    name: string;
    channelId: string;
    avatarUrl?: string;
  }>;
}

export interface AlbumDetails {
  title: string;
  artist: string;
  year?: string;
  artworkUrl?: string;
  browseId: string;
  tracks: SearchResult[];
}

export interface UnifiedSearchResponse {
  artistCard?: {
    name: string;
    avatarUrl?: string;
    subtitle?: string;
    browseId?: string;
    source?: 'YT' | 'SC';
  };
  results: SearchResult[];
}

export interface StreamInfo {
  url: string;
  format: string;
  duration?: number;
}

export interface EqPreset {
  name: string;
  bands: number[]; // 10 values, -12 to +12
}

export interface ShareCodeData {
  version: number;
  title: string;
  creator: string;
  tracks: Array<{
    title: string;
    artist: string;
    durationSec: number;
    source: 'YT' | 'SC';
    sourceId: string;
  }>;
}

export interface DailyMixConfig {
  id: string;
  genre: string;
  mixNumber: number;
  title: string;
  subtitle: string;
  lastGeneratedAt: number;
  trackIds: string[];
}

export type SearchSourceFilter = 'ALL' | 'YT' | 'SC';

export interface SearchPlaylistResult {
  id: string;
  title: string;
  creator: string;
  songCount?: number;
  artworkUrl?: string;
  source: 'YT' | 'SC';
  sourceLabel: string;
}

export interface BatchDownloadState {
  active: boolean;
  batchId?: string;
  playlistTitle: string;
  total: number;
  completed: number;
  failed: number;
  currentTrackTitle?: string;
  isPaused: boolean;
}

// Electron API bridge type
declare global {
  interface Window {
    electronAPI?: {
      resolveStream: (trackId: string, source: string, title?: string, artist?: string, excludeIds?: string[]) => Promise<StreamInfo>;
      searchMusic: (query: string, source?: SearchSourceFilter) => Promise<UnifiedSearchResponse | SearchResult[]>;
      searchPlaylists?: (query: string, source?: SearchSourceFilter) => Promise<SearchPlaylistResult[]>;
      getPlaylistTracks?: (payload: { id: string; source: 'YT' | 'SC' }) => Promise<{
        title: string;
        author?: string;
        creator?: string;
        artworkUrl?: string;
        tracks: any[];
      }>;
      getArtistDetails?: (artistName: string, source?: 'YT' | 'SC') => Promise<ArtistDetails>;
      getAlbum?: (browseId: string, source?: 'YT' | 'SC') => Promise<AlbumDetails>;
      getLyrics?: (videoId: string) => Promise<string | undefined>;
      getGenreTracks?: (query: string) => Promise<Track[]>;
      getRelatedTracks?: (
        trackId: string,
        source: 'YT' | 'SC',
        artist?: string,
        title?: string
      ) => Promise<Track[]>;
      importRemotePlaylist: (source: string, url: string) => Promise<{ title: string; author?: string; artworkUrl?: string; tracks: Track[]; error?: string }>;
      inspectSpotifyPlaylist?: (url: string) => Promise<{
        id: string;
        title: string;
        creator: string;
        artworkUrl?: string;
        trackCount: number;
        tracks: Array<{
          title: string;
          artist: string;
          durationMs: number;
          durationSec: number;
          previewUrl?: string;
          uri?: string;
        }>;
      }>;
      importAndMatchSpotify?: (payload: { tracks: any[]; playlistTitle: string }) => Promise<Track[]>;
      onSpotifyImportProgress?: (
        callback: (data: {
          current: number;
          total: number;
          matched: number;
          unresolved: number;
          currentTrackTitle: string;
        }) => void
      ) => () => void;
      loginAccount?: (platform: 'youtube' | 'soundcloud') => Promise<{ success: boolean; username?: string; error?: string }>;
      windowControl: (action: 'minimize' | 'maximize' | 'close') => void;
      expandWindowForLyrics?: (targetWidth?: number) => Promise<boolean>;
      isMaximized?: () => Promise<boolean>;
      onWindowState?: (callback: (isMaximized: boolean) => void) => () => void;
      onMediaKey: (callback: (key: string) => void) => () => void;
      getUserProfile?: () => Promise<{ username: string; avatarUrl?: string | null }>;
      quitApp?: () => Promise<void>;
      relaunchApp?: () => Promise<void>;
      getConfig?: () => Promise<{ hardwareAcceleration?: boolean; closeToTray?: boolean; downloadsPath?: string; autoLaunch?: string }>;
      setAutoLaunch?: (mode: 'no' | 'yes' | 'minimized') => Promise<boolean>;
      setCloseToTray?: (enabled: boolean) => Promise<boolean>;
      setHardwareAcceleration?: (enabled: boolean) => Promise<boolean>;
      getCacheSize?: () => Promise<{ bytes: number; formatted: string }>;
      clearCache?: () => Promise<boolean>;
      getDownloadsPath?: () => Promise<string>;
      selectDownloadsFolder?: () => Promise<string | null>;
      openFolder?: (folderPath?: string) => Promise<boolean>;
      downloadTrack?: (
        track: Track,
        format?: 'mp3' | 'flac'
      ) => Promise<{ started: boolean }>;
      downloadBatch?: (payload: {
        tracks: Track[];
        format?: 'mp3' | 'flac';
        playlistTitle?: string;
      }) => Promise<{ started: boolean }>;
      pauseDownload?: (trackId: string) => Promise<{ success: boolean }>;
      resumeDownload?: (trackId: string) => Promise<{ success: boolean }>;
      cancelDownload?: (trackId: string) => Promise<{ success: boolean }>;
      pauseAllDownloads?: () => Promise<{ success: boolean }>;
      resumeAllDownloads?: () => Promise<{ success: boolean }>;
      cancelAllDownloads?: () => Promise<{ success: boolean }>;
      scanLocalFiles?: () => Promise<Track[]>;
      checkDownloadStatus?: (
        tracks: Track[]
      ) => Promise<Record<string, { downloaded: boolean; format?: 'mp3' | 'flac'; filePath?: string }>>;
      showDownloadedFile?: (payload: { filePath?: string; track?: Track }) => Promise<{ success: boolean; filePath?: string; notFound?: boolean }>;
      removeDownloadedTrack?: (track: Track) => Promise<{ removed: boolean; filePath?: string }>;
      getDownloadedTracks?: () => Promise<Track[]>;
      onDownloadProgress?: (
        callback: (data: {
          trackId: string;
          progress: number;
          status: 'idle' | 'queued' | 'downloading' | 'paused' | 'completed' | 'error';
          error?: string;
          filePath?: string;
        }) => void
      ) => () => void;
      onBatchProgress?: (
        callback: (data: BatchDownloadState) => void
      ) => () => void;
    };
  }
}
