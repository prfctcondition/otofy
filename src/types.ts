export type SourceType = 'YT' | 'SC' | 'FLAC' | 'Master' | 'LOCAL';

export type IconType =
  | 'disc' | 'music' | 'waves' | 'headphones' | 'radio'
  | 'mic' | 'zap' | 'sparkles' | 'flame' | 'heart'
  | 'user' | 'sliders' | 'download' | 'history';

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
  // Canonical identifiers & external references
  releaseDate?: string;
  releaseYear?: string;
  browseId?: string;
  artistBrowseId?: string;
  artistUrl?: string;
  albumBrowseId?: string;
  albumUrl?: string;
  externalUrl?: string;
  views?: number;
  playbackCount?: number;
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
  playlistId?: string;
  createdAt?: number;
  lastOpenedAt?: number;
  lastPlayedAt?: number;
  isSynced?: boolean;
  syncSource?: 'youtube' | 'soundcloud';
  removedTrackIds?: string[];
  externalUrl?: string;
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
  id: string;              // browseId or playlistId (OLAK...)
  playlistId?: string;     // Real playlist ID for playback
  title: string;           // Real album title (NEVER id!)
  artist: string;          // Artist name
  artworkUrl: string;      // Artwork URL
  year?: string;
  totalTracks?: number;
  source: 'YT' | 'SC';
  savedAt: number;
  lastOpenedAt?: number;
  tracks?: Track[];        // Tracklist snapshot for instant offline/reboot loading
  externalUrl?: string;
}

export const isSystemPlaylist = (
  playlist: Playlist | { id: string; title?: string; creator?: string } | null | undefined
): boolean => {
  if (!playlist) return false;
  const id = playlist.id;
  if (id === 'pl-liked' || id === 'pl-downloads' || id === 'pl-cached' || id === 'pl-history') return true;
  if (id.startsWith('pl-downloads') || id.startsWith('pl-cached') || id.startsWith('pl-liked') || id.startsWith('pl-history')) return true;
  if (playlist.creator === 'System') return true;
  const title = playlist.title?.trim().toLowerCase();
  if (title === 'downloads' || title === 'liked songs' || title === 'cached songs' || title === 'listening history' || title === 'history') return true;
  return false;
};

export const isUserPlaylist = (
  playlist: Playlist | { id: string; type?: string; creator?: string; isDailyMix?: boolean } | null | undefined
): boolean => {
  if (!playlist) return false;
  if (playlist.type && playlist.type !== 'Playlist') return false;
  if (playlist.isDailyMix) return false;
  const id = playlist.id || '';
  if (
    id.startsWith('artist-') ||
    id.startsWith('album-') ||
    id.startsWith('mix-') ||
    id.startsWith('radio-') ||
    id.startsWith('pl-downloads') ||
    id.startsWith('pl-cached') ||
    id.startsWith('pl-history')
  ) {
    return false;
  }
  return true;
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
  releaseDate?: string;
  releaseYear?: string;
  artistBrowseId?: string;
  artistUrl?: string;
  albumBrowseId?: string;
  externalUrl?: string;
  views?: number;
  playbackCount?: number;
}

export interface ArtistAlbum {
  title: string;
  year?: string;
  releaseDate?: string;
  artworkUrl?: string;
  browseId?: string;
  type?: string;
  source?: 'YT' | 'SC';
  externalUrl?: string;
}

export interface ArtistDetails {
  artist: string;
  avatarUrl?: string;
  bio?: string;
  browseId?: string;
  channelId?: string;
  userId?: string;
  externalUrl?: string;
  subscribers?: string;
  source?: 'YT' | 'SC';
  hasMore?: boolean;
  totalTracksCount?: number;
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
  releaseDate?: string;
  artworkUrl?: string;
  browseId: string;
  playlistId?: string;
  externalUrl?: string;
  source?: 'YT' | 'SC';
  tracks: SearchResult[];
}

export interface UnifiedSearchResponse {
  artistCard?: {
    name: string;
    avatarUrl?: string;
    subtitle?: string;
    browseId?: string;
    externalUrl?: string;
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

export interface UpdateCheckResult {
  hasUpdate: boolean;
  canAutoInstall: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl?: string;
  downloadUrl?: string;
  fileName?: string;
  fileSize?: number;
  releaseNotes?: string;
  error?: string;
}

export interface UpdateDownloadProgress {
  percent: number;
  transferred: number;
  total: number;
}

export interface CloudSyncProgress {
  platform: 'youtube' | 'soundcloud';
  current: number;
  total: number;
  message: string;
}

export interface AccountStatus {
  youtube: { connected: boolean; username?: string };
  soundcloud: { connected: boolean; username?: string };
}

// Electron API bridge type
declare global {
  const __APP_VERSION__: string;
  interface Window {
    electronAPI?: {
      resolveStream: (trackId: string, source: string, title?: string, artist?: string, excludeIds?: string[], durationSec?: number) => Promise<StreamInfo>;
      searchMusic: (query: string, source?: SearchSourceFilter) => Promise<UnifiedSearchResponse | SearchResult[]>;
      updateDiscordPresence?: (payload: any) => Promise<boolean>;
      clearDiscordPresence?: () => Promise<boolean>;
      searchPlaylists?: (query: string, source?: SearchSourceFilter) => Promise<SearchPlaylistResult[]>;
      getPlaylistTracks?: (payload: { id: string; source: 'YT' | 'SC' }) => Promise<{
        title: string;
        author?: string;
        creator?: string;
        artworkUrl?: string;
        tracks: any[];
      }>;
      getArtistDetails?: (artistName: string, source?: 'YT' | 'SC', browseId?: string) => Promise<ArtistDetails>;
      getArtistFullTracks?: (channelId: string, artistName?: string) => Promise<SearchResult[]>;
      getAlbum?: (browseId: string, source?: 'YT' | 'SC') => Promise<AlbumDetails>;
      getLyrics?: (videoId: string) => Promise<string | undefined>;
      analyzeTracksPopularity?: (tracks: Array<{ id: string; sourceId?: string; source?: 'YT' | 'SC' }>) => Promise<Record<string, number>>;
      openExternal?: (url: string) => Promise<boolean>;
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
      logoutAccount?: (platform: 'youtube' | 'soundcloud') => Promise<{ success: boolean }>;
      getAccountStatus?: () => Promise<AccountStatus>;
      syncAccountLibrary?: (platform: 'youtube' | 'soundcloud') => Promise<{ success: boolean; playlists: any[]; error?: string }>;
      syncCloudLibrary?: (platform: 'youtube' | 'soundcloud') => Promise<{ success: boolean; playlists: any[]; error?: string }>;
      cloudAddTrackToPlaylist?: (payload: {
        platform: 'youtube' | 'soundcloud';
        playlistId: string;
        track: { id: string; sourceId?: string; title?: string; artist?: string; source?: string };
      }) => Promise<{ success: boolean; error?: string }>;
      cloudRemoveTrackFromPlaylist?: (payload: {
        platform: 'youtube' | 'soundcloud';
        playlistId: string;
        trackId: string;
        sourceId?: string;
      }) => Promise<{ success: boolean; error?: string }>;
      onCloudSyncProgress?: (callback: (data: CloudSyncProgress) => void) => () => void;
      onAuthSessionUpdated?: (callback: (data: { platform: 'youtube' | 'soundcloud'; connected: boolean }) => void) => () => void;
      getAppVersion?: () => Promise<string>;
      checkForUpdates?: () => Promise<UpdateCheckResult>;
      downloadAndInstallUpdate?: () => Promise<{ success: boolean; error?: string }>;
      cancelUpdateDownload?: () => Promise<{ success: boolean }>;
      onUpdateDownloadProgress?: (callback: (data: UpdateDownloadProgress) => void) => () => void;
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
