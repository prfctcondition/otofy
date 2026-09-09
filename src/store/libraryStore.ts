import { create } from 'zustand';
import type { Track, Playlist, ArtistDetails } from '../types';
import repo from '../db/repository';
import { usePlayerStore } from './playerStore';
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
    gradientFrom: '#4F46E5',
    gradientTo: '#9333EA',
    description: 'Your personal collection of saved and favorite songs.',
  },
];

export interface NavigationSnapshot {
  currentView: 'home' | 'playlist' | 'search';
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
    current.currentView === newSnapshot.currentView &&
    current.selectedPlaylistId === newSnapshot.selectedPlaylistId &&
    current.viewingPlaylist?.id === newSnapshot.viewingPlaylist?.id &&
    current.viewingPlaylist?.title === newSnapshot.viewingPlaylist?.title
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
  currentView: 'home' | 'playlist' | 'search';
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
  createPlaylist: (data: { title: string; creator?: string; iconName?: string; gradientFrom?: string; gradientTo?: string; description?: string }) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, track: Track) => Promise<void>;
  setCurrentView: (view: 'home' | 'playlist' | 'search') => void;
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
  saveViewingPlaylistToLibrary: () => Promise<void>;
  createPlaylistFromTracks: (title: string, tracks: Track[]) => Promise<Playlist>;
  renamePlaylist: (id: string, newTitle: string) => Promise<void>;
  clearAndRefreshAllCollections: () => Promise<void>;

  // Modal toggles
  toggleEqModal: () => void;
  toggleShareModal: () => void;
  toggleImportModal: () => void;
  toggleCreatePlaylistModal: () => void;
  toggleSyncModal: () => void;
  toggleLyricsModal: () => void;
  toggleQueue: () => void;
  toggleFullscreenLyrics: () => void;
  setFullscreenLyrics: (val: boolean) => void;
}

export const useLibraryStore = create<LibraryState & LibraryActions>()((set, get) => ({
  playlists: DEFAULT_INITIAL_PLAYLISTS,
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
  isLyricsModalOpen: false,
  isQueueOpen: false,
  isFullscreenLyrics: false,

  loadLibrary: async () => {
    try {
      let playlists = await repo.getPlaylists();
      if (playlists.length === 0) {
        await repo.createPlaylist(DEFAULT_INITIAL_PLAYLISTS[0]);
        playlists = await repo.getPlaylists();
      }
      set({ playlists, isDbReady: true });
      await get().refreshPlaylistTracks();
    } catch (err) {
      console.warn('[Library] Failed to load from DB:', err);
      set({ playlists: DEFAULT_INITIAL_PLAYLISTS, currentPlaylistTracks: [], isDbReady: true });
    }
  },

  selectPlaylist: async (id) => {
    const pl = get().playlists.find((p) => p.id === id) || null;
    let tracks: Track[] = [];
    try {
      tracks = await repo.getPlaylistTracks(id);
    } catch {
      tracks = [];
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
      creator: options?.creator || 'Zen Music Mix',
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
      creator: viewingPlaylist.creator || 'Zen Music',
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

  createPlaylistFromTracks: async (title: string, tracks: Track[]) => {
    const newPlaylist = await repo.createPlaylist({
      id: `pl-${Date.now()}`,
      title: title || 'New Playlist',
      type: 'Playlist',
      creator: 'You',
      songCount: tracks.length,
      duration: `${tracks.length} tracks`,
      iconName: 'music',
      gradientFrom: '#6366F1',
      gradientTo: '#9333EA',
    });

    for (const track of tracks) {
      await repo.putTrack(track);
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
      gradientFrom: data.gradientFrom || '#6366F1',
      gradientTo: data.gradientTo || '#9333EA',
    });
    set((s) => ({ playlists: [playlist, ...s.playlists] }));
    return playlist;
  },

  deletePlaylist: async (id) => {
    await repo.deletePlaylist(id);
    set((s) => ({
      playlists: s.playlists.filter((p) => p.id !== id),
      selectedPlaylistId: s.selectedPlaylistId === id ? 'pl-liked' : s.selectedPlaylistId,
      viewingPlaylist: s.viewingPlaylist?.id === id ? null : s.viewingPlaylist,
      currentView: s.selectedPlaylistId === id ? 'home' : s.currentView,
    }));
  },

  addTrackToPlaylist: async (playlistId, track) => {
    await repo.putTrack(track);
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

  setCurrentView: (view) => {
    const state = get();
    if (state.currentView === view && view === 'home') return;
    const snapshot: NavigationSnapshot = {
      currentView: view,
      selectedPlaylistId: state.selectedPlaylistId,
      viewingPlaylist: view === 'home' ? null : state.viewingPlaylist,
      currentPlaylistTracks: view === 'home' ? [] : state.currentPlaylistTracks,
      currentArtistDetails: view === 'home' ? null : state.currentArtistDetails,
    };
    const historyUpdate = pushHistoryEntry(state, snapshot);
    set({
      currentView: view,
      currentArtistDetails: view === 'playlist' ? state.currentArtistDetails : null,
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
  toggleLyricsModal: () => set((s) => ({ isLyricsModalOpen: !s.isLyricsModalOpen })),
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
