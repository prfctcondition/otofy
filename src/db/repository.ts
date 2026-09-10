import db from './database';
import type { DbTrack, DbPlaylist, DbPlaylistTrack } from './database';
import type { Track, Playlist } from '../types';

import { cleanArtistAndTitle } from '../utils/trackUtils';

function dbTrackToTrack(dt: DbTrack): Track {
  return {
    id: dt.id,
    number: dt.number,
    title: dt.title || 'Untitled',
    artist: dt.artist || 'Unknown Artist',
    artists: dt.artists,
    album: dt.album,
    duration: dt.duration,
    durationSec: dt.durationSec,
    dateAdded: dt.dateAdded,
    source: dt.source as Track['source'],
    sourceLabel: dt.sourceLabel,
    iconName: dt.iconName as Track['iconName'],
    gradientFrom: dt.gradientFrom,
    gradientTo: dt.gradientTo,
    isLiked: dt.isLiked,
    streamUrl: dt.streamUrl,
    artworkUrl: dt.artworkUrl || dt.thumbnail,
    thumbnail: dt.thumbnail || dt.artworkUrl,
    sourceId: dt.sourceId,
    unresolved: dt.unresolved,
    needsMatch: dt.needsMatch,
    alternatives: dt.alternatives,
    originalSpotifyPreview: dt.originalSpotifyPreview,
  };
}

function dbPlaylistToPlaylist(dp: DbPlaylist): Playlist {
  return {
    id: dp.id,
    title: dp.title,
    type: dp.type as Playlist['type'],
    creator: dp.creator || 'You',
    songCount: dp.songCount,
    duration: dp.duration,
    isPinned: dp.isPinned,
    iconName: dp.iconName as Playlist['iconName'],
    gradientFrom: dp.gradientFrom,
    gradientTo: dp.gradientTo,
    isDailyMix: dp.isDailyMix,
    shareCode: dp.shareCode,
    artworkUrl: dp.artworkUrl,
    description: dp.description,
  };
}

export const repo = {
  // Playlists
  async getPlaylists(): Promise<Playlist[]> {
    const all = await db.playlists.orderBy('updatedAt').reverse().toArray();
    return all.map(dbPlaylistToPlaylist);
  },

  async getPlaylist(id: string): Promise<Playlist | undefined> {
    const p = await db.playlists.get(id);
    return p ? dbPlaylistToPlaylist(p) : undefined;
  },

  async createPlaylist(data: Partial<Playlist> & { id: string; title: string }): Promise<Playlist> {
    const dp: DbPlaylist = {
      id: data.id,
      title: data.title,
      type: data.type || 'Playlist',
      creator: data.creator || 'You',
      songCount: data.songCount || 0,
      duration: data.duration || '0m',
      isPinned: data.isPinned ?? false,
      iconName: data.iconName || 'music',
      gradientFrom: data.gradientFrom || '#6366F1',
      gradientTo: data.gradientTo || '#9333EA',
      isDailyMix: data.isDailyMix ?? false,
      shareCode: data.shareCode,
      artworkUrl: data.artworkUrl,
      description: data.description,
      updatedAt: Date.now(),
    };
    await db.playlists.put(dp);
    return dbPlaylistToPlaylist(dp);
  },

  async deletePlaylist(id: string): Promise<void> {
    await db.playlistTracks.where('playlistId').equals(id).delete();
    await db.playlists.delete(id);
  },

  async updatePlaylist(id: string, updates: Partial<DbPlaylist>): Promise<void> {
    await db.playlists.update(id, { ...updates, updatedAt: Date.now() });
  },

  async clearAllPlaylistCache(): Promise<void> {
    await db.playlistTracks.clear();
    await db.dailyMixes.clear();
    await db.playlists.clear();
    await db.settings.delete('dailyMixLastRefresh');
  },

  // Tracks
  async getPlaylistTracks(playlistId: string): Promise<Track[]> {
    const pts = await db.playlistTracks
      .where('playlistId')
      .equals(playlistId)
      .sortBy('position');
    const trackIds = pts.map(pt => pt.trackId);
    const tracks = await db.tracks.where('id').anyOf(trackIds).toArray();
    // Maintain order
    const trackMap = new Map(tracks.map(t => [t.id, t]));
    return trackIds
      .map(id => trackMap.get(id))
      .filter((t): t is DbTrack => t !== undefined)
      .map((t) => {
        const track = dbTrackToTrack(t);
        if (playlistId === 'pl-liked') {
          track.isLiked = true;
        }
        return track;
      });
  },

  async getPlaylistIdsForTrack(trackId: string): Promise<string[]> {
    const pts = await db.playlistTracks.where('trackId').equals(trackId).toArray();
    return pts.map((pt) => pt.playlistId);
  },

  async getAllTracks(): Promise<Track[]> {
    const all = await db.tracks.toArray();
    return all.map(dbTrackToTrack);
  },

  async getTracksByIds(ids: string[]): Promise<Track[]> {
    if (!ids || ids.length === 0) return [];
    const rawList = await db.tracks.bulkGet(ids);
    return rawList
      .filter((t): t is DbTrack => t !== undefined)
      .map(dbTrackToTrack);
  },

  async putTrack(track: Track): Promise<void> {
    const dt: DbTrack = {
      id: track.id,
      number: track.number,
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
      durationSec: track.durationSec,
      dateAdded: track.dateAdded,
      source: track.source,
      sourceLabel: track.sourceLabel,
      iconName: track.iconName,
      gradientFrom: track.gradientFrom,
      gradientTo: track.gradientTo,
      artworkUrl: track.artworkUrl || track.thumbnail,
      thumbnail: track.thumbnail || track.artworkUrl,
      streamUrl: track.streamUrl,
      isLiked: track.isLiked ?? false,
      sourceId: track.sourceId,
      playbackCount: (track as any).playbackCount ?? 0,
      unresolved: track.unresolved,
      needsMatch: track.needsMatch,
      alternatives: track.alternatives,
      originalSpotifyPreview: track.originalSpotifyPreview,
    };
    await db.tracks.put(dt);
  },

  async resolveTrack(oldTrackId: string, chosenAlternative: import('../types').TrackAlternative): Promise<Track | null> {
    const track = await db.tracks.get(oldTrackId);
    if (!track) return null;

    const newTrackId = chosenAlternative.id?.startsWith('yt-')
      ? chosenAlternative.id
      : `yt-${chosenAlternative.sourceId}`;

    const resolvedDbTrack: DbTrack = {
      ...track,
      id: newTrackId,
      title: chosenAlternative.title || track.title,
      artist: chosenAlternative.artist || track.artist,
      artists: chosenAlternative.artists || (chosenAlternative.artist ? [chosenAlternative.artist] : track.artists),
      sourceId: chosenAlternative.sourceId,
      duration: chosenAlternative.duration,
      durationSec: chosenAlternative.durationSec,
      artworkUrl: chosenAlternative.artworkUrl || chosenAlternative.thumbnail || track.artworkUrl,
      thumbnail: chosenAlternative.thumbnail || chosenAlternative.artworkUrl || track.thumbnail,
      source: 'YT',
      sourceLabel: 'YouTube Music',
      unresolved: false,
      needsMatch: false,
    };
    delete (resolvedDbTrack as any).alternatives;

    if (newTrackId !== oldTrackId) {
      await db.tracks.delete(oldTrackId);
      await db.tracks.put(resolvedDbTrack);
      await db.playlistTracks.where('trackId').equals(oldTrackId).modify({ trackId: newTrackId });
    } else {
      await db.tracks.put(resolvedDbTrack);
    }

    try {
      const mixes = await db.dailyMixes.toArray();
      for (const mix of mixes) {
        if (mix.trackIds && mix.trackIds.includes(oldTrackId)) {
          const updatedIds = mix.trackIds.split(',').map((id) => (id === oldTrackId ? newTrackId : id)).join(',');
          await db.dailyMixes.update(mix.id, { trackIds: updatedIds });
        }
      }
    } catch {
      // Non-critical
    }

    return dbTrackToTrack(resolvedDbTrack);
  },

  async addTrackToPlaylist(playlistId: string, trackId: string): Promise<void> {
    const existing = await db.playlistTracks
      .where('playlistId')
      .equals(playlistId)
      .and(pt => pt.trackId === trackId)
      .first();
    if (existing) {
      if (playlistId === 'pl-liked') {
        await db.tracks.update(trackId, { isLiked: true });
      }
      return;
    }
    const count = await db.playlistTracks.where('playlistId').equals(playlistId).count();
    await db.playlistTracks.add({
      playlistId,
      trackId,
      position: count,
      addedAt: Date.now(),
    });
    if (playlistId === 'pl-liked') {
      await db.tracks.update(trackId, { isLiked: true });
    }
    // Update song count
    await db.playlists.update(playlistId, {
      songCount: count + 1,
      updatedAt: Date.now(),
    });
  },

  async addTracksToPlaylist(playlistId: string, trackIds: string[]): Promise<void> {
    const existing = await db.playlistTracks.where('playlistId').equals(playlistId).toArray();
    const existingTrackIds = new Set(existing.map(e => e.trackId));
    let pos = existing.length;
    const toAdd: DbPlaylistTrack[] = [];
    for (const trackId of trackIds) {
      if (!existingTrackIds.has(trackId)) {
        existingTrackIds.add(trackId);
        toAdd.push({
          playlistId,
          trackId,
          position: pos++,
          addedAt: Date.now(),
        });
        if (playlistId === 'pl-liked') {
          await db.tracks.update(trackId, { isLiked: true });
        }
      }
    }
    if (toAdd.length > 0) {
      await db.playlistTracks.bulkAdd(toAdd);
    }
    await db.playlists.update(playlistId, {
      songCount: pos,
      updatedAt: Date.now(),
    });
  },

  async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
    await db.playlistTracks
      .where('playlistId')
      .equals(playlistId)
      .and(pt => pt.trackId === trackId)
      .delete();
    if (playlistId === 'pl-liked') {
      await db.tracks.update(trackId, { isLiked: false });
    }
    const count = await db.playlistTracks.where('playlistId').equals(playlistId).count();
    await db.playlists.update(playlistId, {
      songCount: count,
      updatedAt: Date.now(),
    });
  },

  async toggleLike(trackId: string, trackData?: Track): Promise<boolean> {
    let track = await db.tracks.get(trackId);
    if (!track && trackData) {
      await this.putTrack(trackData);
      track = await db.tracks.get(trackId);
    }
    if (!track) return false;
    const newLiked = !track.isLiked;
    await db.tracks.update(trackId, { isLiked: newLiked });
    if (newLiked) {
      await this.addTrackToPlaylist('pl-liked', trackId);
    } else {
      await this.removeTrackFromPlaylist('pl-liked', trackId);
    }
    return newLiked;
  },

  async getLikedTracks(): Promise<Track[]> {
    const liked = await db.tracks.where('isLiked').equals(1).toArray();
    return liked.map(dbTrackToTrack);
  },

  // Settings
  async getSetting(key: string): Promise<string | undefined> {
    const s = await db.settings.get(key);
    return s?.value;
  },

  async setSetting(key: string, value: string): Promise<void> {
    await db.settings.put({ key, value });
  },
};

export default repo;
