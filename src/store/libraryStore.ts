import { create } from 'zustand';
import {
  isSystemPlaylist,
  type Track,
  type Playlist,
  type ArtistDetails,
  type FollowedArtist,
  type SavedAlbum,
} from '../types';
import repo from '../db/repository';
import { usePlayerStore, cleanTrackId } from './playerStore';
import { useDownloadStore } from './downloadStore';
import { useToastStore } from './toastStore';

export const DEFAULT_INITIAL_PLAYLISTS: Playlist[] = [
  {
    id: 'pl-liked',
    title: 'Liked Songs',
    type: 'Playlist',
    creator: 'You',
    songCount: 0,
    duration: '0m',
    isPinned: true,
    iconName: 'heart',
    gradientFrom: '#2C303B',
    gradientTo: '#13151A',
    description: 'Your personal collection of saved and favorite songs.',
  },
  {
    id: 'pl-downloads',
    title: 'Downloads',
    type: 'Playlist',
    creator: 'System',
    songCount: 0,
    duration: '0m',
    isPinned: true,
    iconName: 'download',
    gradientFrom: '#10B981',
    gradientTo: '#059669',
    description: 'Tracks downloaded to your local device for offline listening.',
  },
];

export interface NavigationSnapshot {
  currentView: 'home' | 'playlist' | 'search' | 'catalog' | 'settings';
  selectedPlaylistId: string;
  viewingPlaylist: Playlist | null;
  currentPlaylistTracks: Track[];
  currentArtistDetails: ArtistDetails | null;
}

const pushHistoryEntry = (
  state: LibraryState,
  newSnapshot: NavigationSnapshot
): { history: NavigationSnapshot[]; historyIndex: number } => {
  const current = state.history[state.historyIndex];
  if (
    current &&
    (current.selectedPlaylistId === newSnapshot.selectedPlaylistId ||
      (current.viewingPlaylist?.id && current.viewingPlaylist.id === newSnapshot.viewingPlaylist?.id) ||
      (current.currentView === newSnapshot.currentView &&
        current.viewingPlaylist?.title &&
        newSnapshot.viewingPlaylist?.title &&
        current.viewingPlaylist.title.toLowerCase() === newSnapshot.viewingPlaylist.title.toLowerCase()))
  ) {
    const updated = [...state.history];
    updated[state.historyIndex] = newSnapshot;
    return { history: updated, historyIndex: state.historyIndex };
  }

  const nextHistory = [...state.history.slice(0, state.historyIndex + 1), newSnapshot];
  return {
    history: nextHistory,
    historyIndex: nextHistory.length - 1,
  };
};

interface LibraryState {
  playlists: Playlist[];
  selectedPlaylistId: string;
  currentPlaylistTracks: Track[];
  viewingPlaylist: Playlist | null;
  currentView: 'home' | 'playlist' | 'search' | 'catalog' | 'settings';
  viewportMode: 'desktop' | 'mobile';
  isSidebarCollapsed: boolean;
  isRightPanelOpen: boolean;
  selectedFilter: string;
  globalSearch: string;
  playlistSearch: string;
  isPlaylistSearchVisible: boolean;
  mobileActiveTab: 'home' | 'search' | 'library';
  isDbReady: boolean;
  currentArtistDetails: ArtistDetails | null;
  isLoadingTracks: boolean;

  // Followed artists & Saved albums
  followedArtists: FollowedArtist[];
  savedAlbums: SavedAlbum[];

  // Tracklist Sorting
  tracklistSortBy: 'dateAdded' | 'title' | 'artist' | 'duration';
  tracklistSortOrder: 'asc' | 'desc';

  // Library Sidebar Sorting
  librarySortBy: 'recents' | 'recentlyAdded' | 'alphabetical';

  // Navigation History
  history: NavigationSnapshot[];
  historyIndex: number;

  // Modal states
  isEqModalOpen: boolean;
  isShareModalOpen: boolean;
  isImportModalOpen: boolean;
  isCreatePlaylistModalOpen: boolean;
  isSyncModalOpen: boolean;
  isLyricsModalOpen: boolean;
  isQueueOpen: boolean;
  isFullscreenLyrics: boolean;
}

interface LibraryActions {
  loadLibrary: () => Promise<void>;
  selectPlaylist: (id: string) => Promise<void>;
  toggleLike: (trackId: string, trackData?: Track) => Promise<void>;
  createPlaylist: (data: { title: string; creator?: string; iconName?: string; gradientFrom?: string; gradientTo?: string; description?: string; artworkUrl?: string }) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, track: Track) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  resolveTrack: (trackId: string, alternative: import('../types').TrackAlternative) => Promise<void>;
  keepCurrentTrackMatch: (trackId: string) => Promise<void>;
  updatePlaylistTracks: (playlistId: string, updatedTracks: Track[]) => Promise<void>;
  setCurrentView: (view: 'home' | 'playlist' | 'search' | 'catalog' | 'settings') => void;
  openCatalog: () => void;
  openSettings: () => void;
  navigateBack: () => void;
  navigateForward: () => void;
  setViewportMode: (mode: 'desktop' | 'mobile') => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setSelectedFilter: (filter: string) => void;
  setGlobalSearch: (query: string) => void;
  setPlaylistSearch: (query: string) => void;
  togglePlaylistSearch: () => void;
  setMobileActiveTab: (tab: 'home' | 'search' | 'library') => void;
  refreshPlaylistTracks: () => Promise<void>;
  setCustomPlaylistView: (title: string, tracks: Track[], options?: Partial<Playlist>) => void;
  setCurrentArtistDetails: (details: ArtistDetails | null) => void;
  setIsLoadingTracks: (loading: boolean) => void;
  saveViewingPlaylistToLibrary: () => Promise<void>;
  toggleFollowArtist: (artist: { name: string; avatarUrl?: string; source?: 'YT' | 'SC' }) => Promise<boolean>;
  isArtistFollowed: (name: string) => boolean;
  toggleSaveAlbum: (album: { id: string; title: string; artist: string; artworkUrl?: string; year?: string; source?: 'YT' | 'SC' }) => Promise<boolean>;
  isAlbumSaved: (id: string, title?: string) => boolean;
  recordEntityPlayed: (id: string, type: 'playlist' | 'artist' | 'album') => Promise<void>;
  recordEntityOpened: (id: string, type: 'playlist' | 'artist' | 'album') => Promise<void>;
  setTracklistSort: (sortBy: 'dateAdded' | 'title' | 'artist' | 'duration', order?: 'asc' | 'desc') => void;
  setLibrarySortBy: (sortBy: 'recents' | 'recentlyAdded' | 'alphabetical') => void;
  createPlaylistFromTracks: (title: string, tracks: Track[]) => Promise<Playlist>;
  renamePlaylist: (id: string, newTitle: string) => Promise<void>;
  updatePlaylistDetails: (
    id: string,
    updates: {
      title?: string;
      description?: string;
      gradientFrom?: string;
      gradientTo?: string;
      artworkUrl?: string | null;
    }
  ) => Promise<void>;
  togglePinPlaylist: (id: string) => Promise<void>;
  reorderPlaylists: (sourceId: string, targetId: string) => Promise<void>;
  clearAndRefreshAllCollections: () => Promise<void>;

  // Modal toggles
  toggleEqModal: () => void;
  toggleShareModal: () => void;
  toggleImportModal: () => void;
  toggleCreatePlaylistModal: () => void;
  toggleSyncModal: () => void;
  toggleLyricsModal: () => void;
  setIsLyricsModalOpen: (val: boolean) => void;
  toggleQueue: () => void;
  toggleFullscreenLyrics: () => void;
  setFullscreenLyrics: (val: boolean) => void;
}

export const useLibraryStore = create<LibraryState & LibraryActions>()((set, get) => ({
  playlists: DEFAULT_INITIAL_PLAYLISTS,
  followedArtists: [],
  savedAlbums: [],
  selectedPlaylistId: 'pl-liked',
  currentPlaylistTracks: [],
  viewingPlaylist: null,
  currentView: 'home',
  viewportMode: 'desktop',
  isSidebarCollapsed: false,
  isRightPanelOpen: false,
  selectedFilter: 'All',
  globalSearch: '',
  playlistSearch: '',
  isPlaylistSearchVisible: false,
  mobileActiveTab: 'home',
  isDbReady: false,
  currentArtistDetails: null,
  isLoadingTracks: false,
  setIsLoadingTracks: (isLoadingTracks) => set({ isLoadingTracks }),

  // Tracklist & Library sorting
  tracklistSortBy: 'dateAdded',
  tracklistSortOrder: 'desc',
  librarySortBy: 'recents',

  history: [
    {
      currentView: 'home',
      selectedPlaylistId: 'pl-liked',
      viewingPlaylist: null,
      currentPlaylistTracks: [],
      currentArtistDetails: null,
    },
  ],
  historyIndex: 0,

  isEqModalOpen: false,
  isShareModalOpen: false,
  isImportModalOpen: false,
  isCreatePlaylistModalOpen: false,
  isSyncModalOpen: false,
  isLyricsModalOpen: true,
  isQueueOpen: false,
  isFullscreenLyrics: false,

  loadLibrary: async () => {
    try {
      let playlists = await repo.getPlaylists();
      const followedArtists = await repo.getFollowedArtists();
      const savedAlbums = await repo.getSavedAlbums();

      if (playlists.length === 0) {
        await repo.createPlaylist(DEFAULT_INITIAL_PLAYLISTS[0]);
        await repo.createPlaylist(DEFAULT_INITIAL_PLAYLISTS[1]);
        playlists = await repo.getPlaylists();
      } else {
        const hasDownloads = playlists.some((p) => p.id === 'pl-downloads');
        if (!hasDownloads) {
          await repo.createPlaylist(DEFAULT_INITIAL_PLAYLISTS[1]);
          playlists = await repo.getPlaylists();
        }
      }

      // Migrate legacy Artist/Album entries in db.playlists into followedArtists / savedAlbums
      let migratedAny = false;
      const cleanPlaylists: Playlist[] = [];
      for (const pl of playlists) {
        if (pl.type === 'Artist') {
          migratedAny = true;
          if (!followedArtists.some((a) => a.name.toLowerCase() === pl.title.toLowerCase())) {
            followedArtists.push({
              id: pl.id,
              name: pl.title,
              avatarUrl: pl.artworkUrl,
              followedAt: typeof pl.createdAt === 'number' ? pl.createdAt : Date.now(),
              lastOpenedAt: typeof pl.lastOpenedAt === 'number' ? pl.lastOpenedAt : undefined,
            });
          }
          await repo.deletePlaylist(pl.id);
        } else if (pl.type === 'Album') {
          migratedAny = true;
          if (!savedAlbums.some((a) => a.id === pl.id || a.title.toLowerCase() === pl.title.toLowerCase())) {
            savedAlbums.push({
              id: pl.id,
              title: pl.title,
              artist: pl.creator || 'Unknown Artist',
              artworkUrl: pl.artworkUrl,
              savedAt: typeof pl.createdAt === 'number' ? pl.createdAt : Date.now(),
              lastOpenedAt: typeof pl.lastOpenedAt === 'number' ? pl.lastOpenedAt : undefined,
            });
          }
          await repo.deletePlaylist(pl.id);
        } else {
          cleanPlaylists.push(pl);
        }
      }
      if (migratedAny) {
        playlists = cleanPlaylists;
        await repo.setFollowedArtists(followedArtists);
        await repo.setSavedAlbums(savedAlbums);
      }


      const likedPl = playlists.find((p) => p.id === 'pl-liked');
      if (likedPl && (likedPl.gradientFrom === '#4F46E5' || likedPl.gradientTo === '#9333EA')) {
        await repo.updatePlaylist('pl-liked', { gradientFrom: '#2C303B', gradientTo: '#13151A' });
        likedPl.gradientFrom = '#2C303B';
        likedPl.gradientTo = '#13151A';
      }

      // Restore custom playlist order if saved
      const savedOrderJson = await repo.getSetting('playlist_order');
      if (savedOrderJson) {
        try {
          const order: string[] = JSON.parse(savedOrderJson);
          playlists.sort((a, b) => {
            const idxA = order.indexOf(a.id);
            const idxB = order.indexOf(b.id);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return 0;
          });
        } catch {}
      }

      // Ensure pinned items are always at top
      playlists.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });

      set({ playlists, followedArtists, savedAlbums, isDbReady: true });
      await get().refreshPlaylistTracks();
    } catch (err) {
      console.warn('[Library] Failed to load from DB:', err);
      set({ playlists: DEFAULT_INITIAL_PLAYLISTS, followedArtists: [], savedAlbums: [], currentPlaylistTracks: [], isDbReady: true });
    }
  },

  selectPlaylist: async (id) => {
    let pl = get().playlists.find((p) => p.id === id) || null;
    let tracks: Track[] = [];

    if (id === 'pl-downloads') {
      tracks = await useDownloadStore.getState().loadDownloadedTracks();
      if (!pl) {
        pl = DEFAULT_INITIAL_PLAYLISTS.find((p) => p.id === 'pl-downloads') || null;
      }
      if (pl) {
        pl = { ...pl, songCount: tracks.length };
      }
    } else if (id === 'pl-cached') {
      tracks = usePlayerStore.getState().getCachedTracks();
      pl = {
        id: 'pl-cached',
        title: 'Cached Songs',
        type: 'Playlist',
        creator: 'System',
        songCount: tracks.length,
        duration: `${tracks.length} tracks`,
        isPinned: true,
        iconName: 'music',
        gradientFrom: '#06B6D4',
        gradientTo: '#0284C7',
        description: 'Songs cached during your current session for offline playback.',
      };
    } else {
      try {
        tracks = await repo.getPlaylistTracks(id);
      } catch {
        tracks = [];
      }
    }

    const state = get();
    const snapshot: NavigationSnapshot = {
      currentView: 'playlist',
      selectedPlaylistId: id,
      viewingPlaylist: pl,
      currentPlaylistTracks: tracks,
      currentArtistDetails: null,
    };
    const historyUpdate = pushHistoryEntry(state, snapshot);

    set({
      selectedPlaylistId: id,
      viewingPlaylist: pl,
      currentPlaylistTracks: tracks,
      currentView: 'playlist',
      currentArtistDetails: null,
      ...historyUpdate,
    });
  },

  setCustomPlaylistView: (title: string, tracks: Track[], options?: Partial<Playlist>) => {
    const customId = options?.id || `view-${Date.now()}`;
    const customPlaylist: Playlist = {
      id: customId,
      title,
      type: options?.type || 'Playlist',
      creator: options?.creator || 'Otofy Mix',
      songCount: tracks.length,
      duration: options?.duration || `${tracks.length} tracks`,
      iconName: options?.iconName || 'music',
      gradientFrom: options?.gradientFrom || '#3B82F6',
      gradientTo: options?.gradientTo || '#8B5CF6',
      artworkUrl: options?.artworkUrl,
      description: options?.description,
    };

    const state = get();
    const currentArtistDetails = options?.type === 'Artist' ? state.currentArtistDetails : null;
    const snapshot: NavigationSnapshot = {
      currentView: 'playlist',
      selectedPlaylistId: customId,
      viewingPlaylist: customPlaylist,
      currentPlaylistTracks: tracks,
      currentArtistDetails,
    };
    const historyUpdate = pushHistoryEntry(state, snapshot);

    // ONLY set viewing state; do NOT insert into playlists (sidebar)
    set({
      viewingPlaylist: customPlaylist,
      selectedPlaylistId: customId,
      currentPlaylistTracks: tracks,
      currentView: 'playlist',
      currentArtistDetails,
      ...historyUpdate,
    });
  },

  setCurrentArtistDetails: (details) => set({ currentArtistDetails: details }),

  saveViewingPlaylistToLibrary: async () => {
    const { viewingPlaylist, currentPlaylistTracks, playlists } = get();
    if (!viewingPlaylist) return;

    // Decouple Artist & Album saves
    if (viewingPlaylist.type === 'Artist') {
      await get().toggleFollowArtist({
        name: viewingPlaylist.title,
        avatarUrl: viewingPlaylist.artworkUrl,
      });
      return;
    }

    if (viewingPlaylist.type === 'Album') {
      await get().toggleSaveAlbum({
        id: viewingPlaylist.id,
        title: viewingPlaylist.title,
        artist: viewingPlaylist.creator?.split('•')[0]?.trim() || viewingPlaylist.creator || 'Artist',
        artworkUrl: viewingPlaylist.artworkUrl,
      });
      return;
    }

    const existing = playlists.find(
      (p) =>
        p.id === viewingPlaylist.id ||
        (p.title && viewingPlaylist.title && p.title.toLowerCase().trim() === viewingPlaylist.title.toLowerCase().trim())
    );

    if (existing) {
      if (existing.id !== 'pl-liked') {
        await repo.deletePlaylist(existing.id);
        const updated = await repo.getPlaylists();
        set({ playlists: updated });
        useToastStore.getState().info('Playlist Removed', `"${viewingPlaylist.title}" was removed from your library.`);
      }
      return;
    }

    const saved = await repo.createPlaylist({
      id: `pl-${Date.now()}`,
      title: viewingPlaylist.title,
      type: 'Playlist',
      creator: viewingPlaylist.creator || 'Otofy',
      songCount: currentPlaylistTracks.length,
      duration: viewingPlaylist.duration || `${currentPlaylistTracks.length} tracks`,
      iconName: viewingPlaylist.iconName || 'music',
      gradientFrom: viewingPlaylist.gradientFrom || '#6366F1',
      gradientTo: viewingPlaylist.gradientTo || '#9333EA',
      artworkUrl: viewingPlaylist.artworkUrl || currentPlaylistTracks[0]?.artworkUrl,
      description: viewingPlaylist.description,
    });

    for (const track of currentPlaylistTracks) {
      await repo.putTrack(track);
    }
    await repo.addTracksToPlaylist(saved.id, currentPlaylistTracks.map((t) => t.id));

    const updated = await repo.getPlaylists();
    set({
      playlists: updated,
      selectedPlaylistId: saved.id,
      viewingPlaylist: saved,
    });
    useToastStore.getState().success('Saved to Library', `"${saved.title}" was added to your library.`);
  },

  toggleFollowArtist: async (artist) => {
    const cleanName = artist.name.trim();
    const id = cleanName.toLowerCase().replace(/\s+/g, '-');
    const existing = get().followedArtists;
    const isFollowed = existing.some((a) => a.id === id || a.name.toLowerCase() === cleanName.toLowerCase());
    let nextArtists: FollowedArtist[];
    if (isFollowed) {
      nextArtists = existing.filter((a) => a.id !== id && a.name.toLowerCase() !== cleanName.toLowerCase());
      useToastStore.getState().info('Unfollowed', `Removed "${cleanName}" from your followed artists.`);
    } else {
      const newArtist: FollowedArtist = {
        id,
        name: cleanName,
        avatarUrl: artist.avatarUrl,
        source: artist.source || 'YT',
        followedAt: Date.now(),
        lastOpenedAt: Date.now(),
      };
      nextArtists = [newArtist, ...existing];
      useToastStore.getState().success('Following', `"${cleanName}" added to your followed artists.`);
    }
    await repo.setFollowedArtists(nextArtists);
    set({ followedArtists: nextArtists });
    return !isFollowed;
  },

  isArtistFollowed: (name) => {
    const clean = name.trim().toLowerCase();
    return get().followedArtists.some((a) => a.name.toLowerCase() === clean || a.id === clean.replace(/\s+/g, '-'));
  },

  toggleSaveAlbum: async (album) => {
    const cleanTitle = album.title.trim();
    const existing = get().savedAlbums;
    const isSaved = existing.some((a) => a.id === album.id || (a.title.toLowerCase() === cleanTitle.toLowerCase() && a.artist.toLowerCase() === album.artist.toLowerCase()));
    let nextAlbums: SavedAlbum[];
    if (isSaved) {
      nextAlbums = existing.filter((a) => a.id !== album.id && !(a.title.toLowerCase() === cleanTitle.toLowerCase() && a.artist.toLowerCase() === album.artist.toLowerCase()));
      useToastStore.getState().info('Album Removed', `"${cleanTitle}" was removed from your albums.`);
    } else {
      const newAlbum: SavedAlbum = {
        id: album.id,
        title: cleanTitle,
        artist: album.artist.trim(),
        artworkUrl: album.artworkUrl,
        year: album.year,
        source: album.source || 'YT',
        savedAt: Date.now(),
        lastOpenedAt: Date.now(),
      };
      nextAlbums = [newAlbum, ...existing];
      useToastStore.getState().success('Album Saved', `"${cleanTitle}" was saved to your albums.`);
    }
    await repo.setSavedAlbums(nextAlbums);
    set({ savedAlbums: nextAlbums });
    return !isSaved;
  },

  isAlbumSaved: (id, title) => {
    const albums = get().savedAlbums;
    if (albums.some((a) => a.id === id)) return true;
    if (title) {
      const cleanTitle = title.trim().toLowerCase();
      return albums.some((a) => a.title.toLowerCase() === cleanTitle);
    }
    return false;
  },

  recordEntityPlayed: async (id, type) => {
    const now = Date.now();
    if (type === 'playlist') {
      const pl = get().playlists.find((p) => p.id === id);
      // Pinned playlists are completely static and never participate in recents shifting
      if (pl && !pl.isPinned) {
        const playlists = get().playlists.map((p) => (p.id === id ? { ...p, lastOpenedAt: now } : p));
        set({ playlists });
        await repo.updatePlaylist(id, { lastOpenedAt: now } as any);
      }
    } else if (type === 'artist') {
      const followedArtists = get().followedArtists.map((a) =>
        a.id === id || a.name.toLowerCase() === id.toLowerCase() ? { ...a, lastOpenedAt: now } : a
      );
      set({ followedArtists });
      await repo.setFollowedArtists(followedArtists);
    } else if (type === 'album') {
      const savedAlbums = get().savedAlbums.map((a) => (a.id === id ? { ...a, lastOpenedAt: now } : a));
      set({ savedAlbums });
      await repo.setSavedAlbums(savedAlbums);
    }
  },

  recordEntityOpened: async (id, type) => {
    return get().recordEntityPlayed(id, type);
  },

  setTracklistSort: (sortBy, order) => {
    const currentSort = get().tracklistSortBy;
    const currentOrder = get().tracklistSortOrder;
    const nextOrder = order || (currentSort === sortBy ? (currentOrder === 'asc' ? 'desc' : 'asc') : (sortBy === 'dateAdded' ? 'desc' : 'asc'));
    set({ tracklistSortBy: sortBy, tracklistSortOrder: nextOrder });
  },

  setLibrarySortBy: (sortBy) => {
    set({ librarySortBy: sortBy });
  },

  keepCurrentTrackMatch: async (trackId: string) => {
    const updated = await repo.dismissTrackConflict(trackId);
    if (!updated) return;

    const currentTracks = get().currentPlaylistTracks;
    const nextTracks = currentTracks.map((t) => (t.id === trackId ? { ...t, unresolved: false, needsMatch: false, alternatives: [] } : t));
    
    // Also update current active track if playing
    const playerStore = usePlayerStore.getState();
    if (playerStore.activeTrack?.id === trackId) {
      playerStore.setActiveTrackOnly({ ...playerStore.activeTrack, unresolved: false, needsMatch: false, alternatives: [] });
    }

    set({ currentPlaylistTracks: nextTracks });
    const viewingPlId = get().selectedPlaylistId;
    if (viewingPlId) {
      await get().updatePlaylistTracks(viewingPlId, nextTracks);
    }
    useToastStore.getState().info('Match Confirmed', `Track confirmed with current audio stream.`);
  },

  createPlaylistFromTracks: async (title: string, tracks: Track[]) => {
    const newPlaylist = await repo.createPlaylist({
      id: `pl-${Date.now()}`,
      title: title || 'New Playlist',
      type: 'Playlist',
      creator: 'You',
      songCount: tracks.length,
      duration: `${tracks.length} tracks`,
      iconName: 'music',
      gradientFrom: '#334155',
      gradientTo: '#0F172A',
    });

    for (const track of tracks) {
      const dateAdded = track.dateAdded && !isNaN(Date.parse(track.dateAdded)) ? track.dateAdded : new Date().toISOString();
      await repo.putTrack({ ...track, dateAdded });
      await repo.addTrackToPlaylist(newPlaylist.id, track.id);
    }

    const updated = await repo.getPlaylists();
    const state = get();
    const snapshot: NavigationSnapshot = {
      currentView: 'playlist',
      selectedPlaylistId: newPlaylist.id,
      viewingPlaylist: newPlaylist,
      currentPlaylistTracks: tracks,
      currentArtistDetails: null,
    };
    const historyUpdate = pushHistoryEntry(state, snapshot);

    set({
      playlists: updated,
      selectedPlaylistId: newPlaylist.id,
      viewingPlaylist: newPlaylist,
      currentPlaylistTracks: tracks,
      currentView: 'playlist',
      ...historyUpdate,
    });
    return newPlaylist;
  },

  renamePlaylist: async (id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    await repo.updatePlaylist(id, { title: trimmed });
    const updated = await repo.getPlaylists();
    const currentVP = get().viewingPlaylist;
    set({
      playlists: updated,
      viewingPlaylist: currentVP && currentVP.id === id ? { ...currentVP, title: trimmed } : currentVP,
    });
  },

  updatePlaylistDetails: async (id, updates) => {
    if (isSystemPlaylist({ id })) return;
    await repo.updatePlaylist(id, updates);
    const updated = await repo.getPlaylists();
    const currentVP = get().viewingPlaylist;
    set({
      playlists: updated,
      viewingPlaylist:
        currentVP && currentVP.id === id ? { ...currentVP, ...updates } : currentVP,
    });
    useToastStore.getState().success('Playlist Updated', 'Details saved successfully.');
  },

  togglePinPlaylist: async (id: string) => {
    const pl = get().playlists.find((p) => p.id === id);
    if (!pl) return;
    const nextPinned = !pl.isPinned;
    await repo.updatePlaylist(id, { isPinned: nextPinned });
    const updated = await repo.getPlaylists();
    const currentVP = get().viewingPlaylist;
    set({
      playlists: updated,
      viewingPlaylist: currentVP && currentVP.id === id ? { ...currentVP, isPinned: nextPinned } : currentVP,
    });
    useToastStore.getState().info(
      nextPinned ? 'Playlist Pinned' : 'Playlist Unpinned',
      nextPinned ? `"${pl.title}" pinned to your library.` : `"${pl.title}" unpinned.`
    );
  },

  reorderPlaylists: async (sourceId: string, targetId: string) => {
    const { playlists } = get();
    const sourceIndex = playlists.findIndex((p) => p.id === sourceId);
    const targetIndex = playlists.findIndex((p) => p.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;

    const source = playlists[sourceIndex];
    const target = playlists[targetIndex];

    // Pinned Isolation: Pinned playlists can only reorder within the pinned section;
    // regular playlists only within the regular section. Cross-boundary dragging is strictly disallowed.
    if (Boolean(source.isPinned) !== Boolean(target.isPinned)) {
      return;
    }

    const nextPlaylists = [...playlists];
    nextPlaylists.splice(sourceIndex, 1);
    nextPlaylists.splice(targetIndex, 0, source);

    set({ playlists: nextPlaylists });
    try {
      await repo.setSetting('playlist_order', JSON.stringify(nextPlaylists.map((p) => p.id)));
    } catch (err) {
      console.error('[Library] Failed to persist playlist order:', err);
    }
  },

  toggleLike: async (trackId, trackData) => {
    try {
      const newLiked = await repo.toggleLike(trackId, trackData);
      set((s) => ({
        currentPlaylistTracks: s.currentPlaylistTracks.map((t) =>
          t.id === trackId ? { ...t, isLiked: newLiked } : t
        ),
      }));

      // Sync active track if currently playing
      const playerStore = usePlayerStore.getState();
      if (
        playerStore.activeTrack &&
        (playerStore.activeTrack.id === trackId || playerStore.activeTrack.sourceId === trackId)
      ) {
        playerStore.toggleActiveTrackLike(newLiked);
      }

      const likedTracks = await repo.getPlaylistTracks('pl-liked');
      set((s) => ({
        playlists: s.playlists.map((p) =>
          p.id === 'pl-liked' ? { ...p, songCount: likedTracks.length } : p
        ),
      }));

      if (get().selectedPlaylistId === 'pl-liked') {
        await get().refreshPlaylistTracks();
      }
    } catch {
      set((s) => ({
        currentPlaylistTracks: s.currentPlaylistTracks.map((t) =>
          t.id === trackId ? { ...t, isLiked: !t.isLiked } : t
        ),
      }));
    }
  },

  createPlaylist: async (data) => {
    const id = `pl-${Date.now()}`;
    const playlist = await repo.createPlaylist({
      id,
      title: data.title,
      creator: data.creator || 'You',
      iconName: (data.iconName || 'music') as any,
      gradientFrom: data.gradientFrom || '#334155',
      gradientTo: data.gradientTo || '#0F172A',
      artworkUrl: data.artworkUrl,
      description: data.description,
    });
    set((s) => ({ playlists: [playlist, ...s.playlists] }));
    return playlist;
  },

  deletePlaylist: async (id) => {
    if (isSystemPlaylist({ id })) return;
    await repo.deletePlaylist(id);
    set((s) => ({
      playlists: s.playlists.filter((p) => p.id !== id),
      selectedPlaylistId: s.selectedPlaylistId === id ? 'pl-liked' : s.selectedPlaylistId,
      viewingPlaylist: s.viewingPlaylist?.id === id ? null : s.viewingPlaylist,
      currentView: s.selectedPlaylistId === id ? 'home' : s.currentView,
    }));
  },

  addTrackToPlaylist: async (playlistId, track) => {
    const dateAdded = track.dateAdded && !isNaN(Date.parse(track.dateAdded)) ? track.dateAdded : new Date().toISOString();
    const trackWithDate = { ...track, dateAdded };

    // If adding to Liked Songs
    if (playlistId === 'pl-liked') {
      const currentLiked = await repo.getPlaylistTracks('pl-liked');
      const targetId = track.id;
      const targetClean = cleanTrackId(track.sourceId || track.id);
      const exists = currentLiked.some(
        (t) =>
          t.id === targetId ||
          (t.sourceId && (t.sourceId === track.sourceId || t.sourceId === targetId)) ||
          cleanTrackId(t.sourceId || t.id) === targetClean
      );
      if (exists) {
        // Track is already in Liked Songs -> no-op to prevent duplicate
        return;
      }

      await repo.putTrack({ ...trackWithDate, isLiked: true });
      await repo.addTrackToPlaylist('pl-liked', track.id);

      set((s) => ({
        currentPlaylistTracks: s.currentPlaylistTracks.map((t) =>
          t.id === track.id ? { ...t, isLiked: true } : t
        ),
      }));

      const playerStore = usePlayerStore.getState();
      if (
        playerStore.activeTrack &&
        (playerStore.activeTrack.id === track.id || playerStore.activeTrack.sourceId === track.id)
      ) {
        playerStore.toggleActiveTrackLike(true);
      }

      if (get().selectedPlaylistId === 'pl-liked') {
        await get().refreshPlaylistTracks();
      }

      const count = await repo.getPlaylistTracks('pl-liked').then((ts) => ts.length);
      set((s) => ({
        playlists: s.playlists.map((p) =>
          p.id === 'pl-liked' ? { ...p, songCount: count } : p
        ),
      }));
      return;
    }

    // Normal playlist add
    await repo.putTrack(trackWithDate);
    await repo.addTrackToPlaylist(playlistId, track.id);
    if (get().selectedPlaylistId === playlistId) {
      await get().refreshPlaylistTracks();
    }
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === playlistId ? { ...p, songCount: p.songCount + 1 } : p
      ),
    }));
  },

  removeTrackFromPlaylist: async (playlistId, trackId) => {
    await repo.removeTrackFromPlaylist(playlistId, trackId);
    if (playlistId === 'pl-liked') {
      // Sync Liked Songs removal
      set((s) => ({
        currentPlaylistTracks: s.currentPlaylistTracks.filter((t) => t.id !== trackId),
      }));
      const playerStore = usePlayerStore.getState();
      if (
        playerStore.activeTrack &&
        (playerStore.activeTrack.id === trackId || playerStore.activeTrack.sourceId === trackId)
      ) {
        playerStore.toggleActiveTrackLike(false);
      }
    } else {
      if (get().selectedPlaylistId === playlistId) {
        await get().refreshPlaylistTracks();
      }
    }
    const count = await repo.getPlaylistTracks(playlistId).then((ts) => ts.length);
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === playlistId ? { ...p, songCount: count } : p
      ),
    }));
  },

  resolveTrack: async (trackId, chosenAlternative) => {
    const updated = await repo.resolveTrack(trackId, chosenAlternative);
    if (updated) {
      set((s) => {
        const nextCurrentTracks = s.currentPlaylistTracks.map((t) =>
          t.id === trackId ? updated : t
        );
        const nextViewingPlaylist = s.viewingPlaylist
          ? { ...s.viewingPlaylist }
          : null;
        const nextHistory = s.history.map((entry) => ({
          ...entry,
          currentPlaylistTracks: entry.currentPlaylistTracks?.map((t) =>
            t.id === trackId ? updated : t
          ),
          viewingPlaylist: entry.viewingPlaylist ? { ...entry.viewingPlaylist } : null,
        }));
        return {
          currentPlaylistTracks: [...nextCurrentTracks],
          viewingPlaylist: nextViewingPlaylist,
          history: nextHistory,
        };
      });

      // Synchronize playerStore if activeTrack or queue contains this track
      const ps = usePlayerStore.getState();
      if (ps.activeTrack?.id === trackId) {
        usePlayerStore.setState({
          activeTrack: updated,
          queue: ps.queue.map((t) => (t.id === trackId ? updated : t)),
        });
      } else if (ps.queue.some((t) => t.id === trackId)) {
        usePlayerStore.setState({
          queue: ps.queue.map((t) => (t.id === trackId ? updated : t)),
        });
      }

      useToastStore.getState().success('Track Resolved', `Matched to "${updated.title}".`);
    }
  },

  updatePlaylistTracks: async (playlistId, updatedTracks) => {
    set((s) => ({
      currentPlaylistTracks: [...updatedTracks],
      history: s.history.map((entry) =>
        entry.selectedPlaylistId === playlistId || entry.viewingPlaylist?.id === playlistId
          ? { ...entry, currentPlaylistTracks: [...updatedTracks] }
          : entry
      ),
    }));
    for (const t of updatedTracks) {
      await repo.putTrack(t);
    }
  },

  setCurrentView: (view) => {
    const state = get();
    if (state.currentView === view && (view === 'home' || view === 'catalog')) return;
    const isSpecialView = view === 'home' || view === 'catalog';
    const snapshot: NavigationSnapshot = {
      currentView: view,
      selectedPlaylistId: state.selectedPlaylistId,
      viewingPlaylist: isSpecialView ? null : state.viewingPlaylist,
      currentPlaylistTracks: isSpecialView ? [] : state.currentPlaylistTracks,
      currentArtistDetails: isSpecialView ? null : state.currentArtistDetails,
    };
    const historyUpdate = pushHistoryEntry(state, snapshot);
    set({
      currentView: view,
      viewingPlaylist: isSpecialView ? null : state.viewingPlaylist,
      currentPlaylistTracks: isSpecialView ? [] : state.currentPlaylistTracks,
      currentArtistDetails: view === 'playlist' ? state.currentArtistDetails : null,
      ...historyUpdate,
    });
  },

  openCatalog: () => {
    const state = get();
    if (state.currentView === 'catalog') return;
    const snapshot: NavigationSnapshot = {
      currentView: 'catalog',
      selectedPlaylistId: state.selectedPlaylistId,
      viewingPlaylist: null,
      currentPlaylistTracks: [],
      currentArtistDetails: null,
    };
    const historyUpdate = pushHistoryEntry(state, snapshot);
    set({
      currentView: 'catalog',
      viewingPlaylist: null,
      currentPlaylistTracks: [],
      currentArtistDetails: null,
      ...historyUpdate,
    });
  },

  openSettings: () => {
    const state = get();
    if (state.currentView === 'settings') return;
    const snapshot: NavigationSnapshot = {
      currentView: 'settings',
      selectedPlaylistId: state.selectedPlaylistId,
      viewingPlaylist: null,
      currentPlaylistTracks: [],
      currentArtistDetails: null,
    };
    const historyUpdate = pushHistoryEntry(state, snapshot);
    set({
      currentView: 'settings',
      viewingPlaylist: null,
      currentPlaylistTracks: [],
      currentArtistDetails: null,
      ...historyUpdate,
    });
  },

  navigateBack: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      const target = history[nextIdx];
      set({
        historyIndex: nextIdx,
        currentView: target.currentView,
        selectedPlaylistId: target.selectedPlaylistId,
        viewingPlaylist: target.viewingPlaylist,
        currentPlaylistTracks: target.currentPlaylistTracks,
        currentArtistDetails: target.currentArtistDetails,
      });
    }
  },

  navigateForward: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      const target = history[nextIdx];
      set({
        historyIndex: nextIdx,
        currentView: target.currentView,
        selectedPlaylistId: target.selectedPlaylistId,
        viewingPlaylist: target.viewingPlaylist,
        currentPlaylistTracks: target.currentPlaylistTracks,
        currentArtistDetails: target.currentArtistDetails,
      });
    }
  },
  setViewportMode: (mode) => set({ viewportMode: mode }),
  toggleSidebar: () => set((s) => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),
  toggleRightPanel: () => set((s) => ({ isRightPanelOpen: !s.isRightPanelOpen })),
  setSelectedFilter: (filter) => set({ selectedFilter: filter }),
  setGlobalSearch: (query) => set({ globalSearch: query }),
  setPlaylistSearch: (query) => set({ playlistSearch: query }),
  togglePlaylistSearch: () => set((s) => ({ isPlaylistSearchVisible: !s.isPlaylistSearchVisible })),
  setMobileActiveTab: (tab) => set({ mobileActiveTab: tab }),

  refreshPlaylistTracks: async () => {
    const { selectedPlaylistId } = get();
    if (selectedPlaylistId === 'pl-downloads') {
      const tracks = await useDownloadStore.getState().loadDownloadedTracks();
      set({ currentPlaylistTracks: tracks });
      return;
    }
    if (selectedPlaylistId === 'pl-cached') {
      const tracks = usePlayerStore.getState().getCachedTracks();
      set({ currentPlaylistTracks: tracks });
      return;
    }
    try {
      const tracks = await repo.getPlaylistTracks(selectedPlaylistId);
      set({ currentPlaylistTracks: tracks });
    } catch {
      set({ currentPlaylistTracks: [] });
    }
  },

  toggleEqModal: () => set((s) => ({ isEqModalOpen: !s.isEqModalOpen })),
  toggleShareModal: () => set((s) => ({ isShareModalOpen: !s.isShareModalOpen })),
  toggleImportModal: () => set((s) => ({ isImportModalOpen: !s.isImportModalOpen })),
  toggleCreatePlaylistModal: () => set((s) => ({ isCreatePlaylistModalOpen: !s.isCreatePlaylistModalOpen })),
  toggleSyncModal: () => set((s) => ({ isSyncModalOpen: !s.isSyncModalOpen })),
  toggleLyricsModal: () =>
    set((s) => {
      if (!s.isLyricsModalOpen && typeof window !== 'undefined' && window.innerWidth < 1100 && s.viewportMode !== 'mobile') {
        window.electronAPI?.expandWindowForLyrics?.(1150);
        return { isLyricsModalOpen: true };
      }
      return { isLyricsModalOpen: !s.isLyricsModalOpen };
    }),
  setIsLyricsModalOpen: (val: boolean) => set({ isLyricsModalOpen: val }),
  toggleQueue: () => set((s) => ({ isQueueOpen: !s.isQueueOpen })),
  toggleFullscreenLyrics: () => set((s) => ({ isFullscreenLyrics: !s.isFullscreenLyrics })),
  setFullscreenLyrics: (val: boolean) => set({ isFullscreenLyrics: val }),

  clearAndRefreshAllCollections: async () => {
    try {
      await repo.clearAllPlaylistCache();
      const defaultPl = await repo.createPlaylist(DEFAULT_INITIAL_PLAYLISTS[0]);
      set({
        playlists: [defaultPl],
        selectedPlaylistId: defaultPl.id,
        currentPlaylistTracks: [],
        viewingPlaylist: defaultPl,
      });
      useToastStore.getState().success('Cache Cleared', 'Playlist cache cleared and collections refreshed.');
    } catch (e) {
      console.error('[Library] clearAndRefreshAllCollections error:', e);
    }
  },
}));
