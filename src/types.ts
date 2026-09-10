export type SourceType = 'YT' | 'SC' | 'FLAC' | 'Master';

export type IconType =
  | 'disc' | 'music' | 'waves' | 'headphones' | 'radio'
  | 'mic' | 'zap' | 'sparkles' | 'flame' | 'heart'
  | 'user' | 'sliders';

export interface Track {
  id: string;
  number: number;
  title: string;
  artist: string;
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
  sourceId?: string; // YouTube video ID or SoundCloud track ID
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
}

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

// Electron API bridge type
declare global {
  interface Window {
    electronAPI?: {
      resolveStream: (trackId: string, source: string, title?: string, artist?: string) => Promise<StreamInfo>;
      searchMusic: (query: string, source?: SearchSourceFilter) => Promise<UnifiedSearchResponse | SearchResult[]>;
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
      importRemotePlaylist: (source: string, url: string) => Promise<{ title: string; tracks: Track[] }>;
      loginAccount?: (platform: 'youtube' | 'soundcloud') => Promise<{ success: boolean; username?: string; error?: string }>;
      windowControl: (action: 'minimize' | 'maximize' | 'close') => void;
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
    };
  }
}
