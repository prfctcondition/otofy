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
  const isCloud = dp.id.startsWith('pl-yt-') || dp.id.startsWith('pl-sc-');
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
    createdAt: dp.createdAt,
    lastOpenedAt: dp.lastOpenedAt,
    lastPlayedAt: dp.lastPlayedAt,
    isSynced: dp.isSynced ?? isCloud,
    syncSource: dp.syncSource || (dp.id.startsWith('pl-yt-') ? 'youtube' : dp.id.startsWith('pl-sc-') ? 'soundcloud' : undefined),
    removedTrackIds: dp.removedTrackIds || [],
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
    const isCloud = data.id.startsWith('pl-yt-') || data.id.startsWith('pl-sc-');
    const existing = await db.playlists.get(data.id);
    const dp: DbPlaylist = {
      id: data.id,
      title: data.title,
      type: data.type || existing?.type || 'Playlist',
      creator: data.creator || existing?.creator || 'You',
      songCount: data.songCount ?? existing?.songCount ?? 0,
      duration: data.duration || existing?.duration || '0m',
      isPinned: existing ? (existing.isPinned ?? false) : (data.isPinned ?? false),
      iconName: data.iconName || existing?.iconName || 'music',
      gradientFrom: data.gradientFrom || existing?.gradientFrom || '#6366F1',
      gradientTo: data.gradientTo || existing?.gradientTo || '#9333EA',
      isDailyMix: data.isDailyMix ?? existing?.isDailyMix ?? false,
      shareCode: data.shareCode || existing?.shareCode,
      artworkUrl: data.artworkUrl || existing?.artworkUrl,
      description: data.description || existing?.description,
      createdAt: existing?.createdAt ?? (typeof data.createdAt === 'number' ? data.createdAt : Date.now()),
      lastOpenedAt: existing?.lastOpenedAt ?? (typeof data.lastOpenedAt === 'number' ? data.lastOpenedAt : undefined),
      lastPlayedAt: existing?.lastPlayedAt ?? (typeof data.lastPlayedAt === 'number' ? data.lastPlayedAt : undefined),
      updatedAt: existing?.updatedAt ?? Date.now(),
      isSynced: data.isSynced ?? existing?.isSynced ?? isCloud,
      syncSource: data.syncSource || existing?.syncSource || (data.id.startsWith('pl-yt-') ? 'youtube' : data.id.startsWith('pl-sc-') ? 'soundcloud' : undefined),
      removedTrackIds: existing?.removedTrackIds || data.removedTrackIds || [],
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

  async getTrack(id: string): Promise<Track | undefined> {
    const dt = await db.tracks.get(id);
    return dt ? dbTrackToTrack(dt) : undefined;
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

    // If this track was previously tombstoned, untombstone it
    const pl = await db.playlists.get(playlistId);
    let removedTrackIds = pl?.removedTrackIds;
    if (removedTrackIds && removedTrackIds.length > 0) {
      const track = await db.tracks.get(trackId);
      const set = new Set(removedTrackIds);
      set.delete(trackId);
      if (track?.sourceId) set.delete(track.sourceId);
      const match = trackId.match(/([a-zA-Z0-9_-]{11})$/);
      if (match) set.delete(match[1]);
      removedTrackIds = Array.from(set);
    }

    // Update song count (and clear tombstone if needed)
    await db.playlists.update(playlistId, {
      songCount: count + 1,
      updatedAt: Date.now(),
      ...(removedTrackIds !== undefined ? { removedTrackIds } : {}),
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

    // Untombstone any of these tracks
    const pl = await db.playlists.get(playlistId);
    let removedTrackIds = pl?.removedTrackIds;
    if (removedTrackIds && removedTrackIds.length > 0) {
      const set = new Set(removedTrackIds);
      for (const trackId of trackIds) {
        set.delete(trackId);
        const match = trackId.match(/([a-zA-Z0-9_-]{11})$/);
        if (match) set.delete(match[1]);
      }
      removedTrackIds = Array.from(set);
    }

    await db.playlists.update(playlistId, {
      songCount: pos,
      updatedAt: Date.now(),
      ...(removedTrackIds !== undefined ? { removedTrackIds } : {}),
    });
  },

  async reconcilePlaylistTracks(playlistId: string, tracks: Track[]): Promise<boolean> {
    const pl = await db.playlists.get(playlistId);
    const removedSet = new Set(pl?.removedTrackIds || []);
    // Filter out tombstoned tracks so remote sync does not resurrect user deletions
    const validTracks = removedSet.size === 0 ? tracks : tracks.filter((t) => {
      if (removedSet.has(t.id)) return false;
      if (t.sourceId && removedSet.has(t.sourceId)) return false;
      const match = t.id.match(/([a-zA-Z0-9_-]{11})$/);
      if (match && removedSet.has(match[1])) return false;
      return true;
    });

    for (const track of validTracks) {
      await this.putTrack(track);
    }
    const currentPts = await db.playlistTracks.where('playlistId').equals(playlistId).sortBy('position');
    const currentIds = currentPts.map((p) => p.trackId);
    const newIds = validTracks.map((t) => t.id);

    const isSame =
      currentIds.length === newIds.length &&
      currentIds.every((id, idx) => id === newIds[idx]);

    if (!isSame) {
      await db.transaction('rw', db.playlistTracks, db.playlists, async () => {
        await db.playlistTracks.where('playlistId').equals(playlistId).delete();
        const records: DbPlaylistTrack[] = validTracks.map((t, idx) => ({
          playlistId,
          trackId: t.id,
          position: idx,
          addedAt: Date.now(),
        }));
        await db.playlistTracks.bulkAdd(records);
        await db.playlists.where('id').equals(playlistId).modify((p) => {
          p.songCount = validTracks.length;
          p.updatedAt = Date.now();
        });
      });
      return true;
    }
    return false;
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

    // Tombstone this track in the playlist's removedTrackIds so background sync does not resurrect it
    const pl = await db.playlists.get(playlistId);
    let removedTrackIds = pl?.removedTrackIds || [];
    const track = await db.tracks.get(trackId);
    const set = new Set(removedTrackIds);
    set.add(trackId);
    if (track?.sourceId) set.add(track.sourceId);
    const match = trackId.match(/([a-zA-Z0-9_-]{11})$/);
    if (match) set.add(match[1]);
    removedTrackIds = Array.from(set);

    await db.playlists.update(playlistId, {
      songCount: count,
      updatedAt: Date.now(),
      removedTrackIds,
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

  // Followed Artists
  async getFollowedArtists(): Promise<import('../types').FollowedArtist[]> {
    const json = await this.getSetting('followed_artists');
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  },
  async setFollowedArtists(artists: import('../types').FollowedArtist[]): Promise<void> {
    await this.setSetting('followed_artists', JSON.stringify(artists));
  },

  // Saved Albums
  async getSavedAlbums(): Promise<import('../types').SavedAlbum[]> {
    const json = await this.getSetting('saved_albums');
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  },
  async setSavedAlbums(albums: import('../types').SavedAlbum[]): Promise<void> {
    await this.setSetting('saved_albums', JSON.stringify(albums));
  },

  // Confirm match as is
  async dismissTrackConflict(trackId: string): Promise<Track | null> {
    const track = await db.tracks.get(trackId);
    if (!track) return null;
    const updated: DbTrack = {
      ...track,
      unresolved: false,
      needsMatch: false,
    };
    delete (updated as any).alternatives;
    await db.tracks.put(updated);
    return dbTrackToTrack(updated);
  },
};

export default repo;
