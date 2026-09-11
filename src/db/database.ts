import Dexie, { type Table } from 'dexie';

export interface DbTrack {
  id: string;
  number: number;
  title: string;
  artist: string;
  artists?: string[];
  album: string;
  duration: string;
  durationSec: number;
  dateAdded: string;
  source: string;
  sourceLabel: string;
  iconName: string;
  gradientFrom: string;
  gradientTo: string;
  isLiked: boolean;
  streamUrl?: string;
  artworkUrl?: string;
  thumbnail?: string;
  sourceId?: string;
  playbackCount: number;
  lastPlayedAt?: number;
  unresolved?: boolean;
  needsMatch?: boolean;
  alternatives?: any[];
  originalSpotifyPreview?: string;
}

export interface DbPlaylist {
  id: string;
  title: string;
  type: string;
  creator: string;
  songCount: number;
  duration: string;
  isPinned: boolean;
  iconName: string;
  gradientFrom: string;
  gradientTo: string;
  isDailyMix: boolean;
  shareCode?: string;
  artworkUrl?: string;
  description?: string;
  updatedAt: number;
  createdAt?: number;
  lastOpenedAt?: number;
  lastPlayedAt?: number;
  isSynced?: boolean;
  syncSource?: 'youtube' | 'soundcloud';
  removedTrackIds?: string[];
}

export interface DbPlaylistTrack {
  id?: number;
  playlistId: string;
  trackId: string;
  position: number;
  addedAt: number;
}

export interface DbDailyMix {
  id: string;
  genre: string;
  mixNumber: number;
  title: string;
  subtitle: string;
  lastGeneratedAt: number;
  trackIds: string;
}

export interface DbSetting {
  key: string;
  value: string;
}

export interface DbHistoryItem {
  id?: number;
  trackId: string;
  playedAt: number;
}

export class ZenMusicDB extends Dexie {
  tracks!: Table<DbTrack, string>;
  playlists!: Table<DbPlaylist, string>;
  playlistTracks!: Table<DbPlaylistTrack, number>;
  dailyMixes!: Table<DbDailyMix, string>;
  settings!: Table<DbSetting, string>;
  history!: Table<DbHistoryItem, number>;

  constructor() {
    super('ZenMusicDB');
    this.version(1).stores({
      tracks: 'id, title, artist, album, source, isLiked, lastPlayedAt',
      playlists: 'id, title, type, isPinned, isDailyMix, updatedAt',
      playlistTracks: '++id, playlistId, trackId, position',
      dailyMixes: 'id, genre, lastGeneratedAt',
      settings: 'key',
    });
    this.version(2).stores({
      history: '++id, trackId, playedAt',
    });
  }
}

export const db = new ZenMusicDB();
export default db;
