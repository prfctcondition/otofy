import { create } from 'zustand';
import type { Track, Playlist } from '../types';

export interface TrackMenuState {
  track: Track;
  x: number;
  y: number;
  currentPlaylistId?: string;
}

export interface PlaylistMenuState {
  playlist: Playlist;
  x: number;
  y: number;
}

export interface ConfirmDeleteState {
  playlist: Playlist;
  onConfirm?: () => void | Promise<void>;
}

interface ContextMenuStore {
  trackMenu: TrackMenuState | null;
  playlistMenu: PlaylistMenuState | null;
  confirmDelete: ConfirmDeleteState | null;

  openTrackMenu: (track: Track, x: number, y: number, currentPlaylistId?: string) => void;
  closeTrackMenu: () => void;

  openPlaylistMenu: (playlist: Playlist, x: number, y: number) => void;
  closePlaylistMenu: () => void;

  openConfirmDelete: (playlist: Playlist, onConfirm?: () => void | Promise<void>) => void;
  closeConfirmDelete: () => void;

  closeAll: () => void;
}

export const useContextMenuStore = create<ContextMenuStore>((set) => ({
  trackMenu: null,
  playlistMenu: null,
  confirmDelete: null,

  openTrackMenu: (track, x, y, currentPlaylistId) => {
    set({
      trackMenu: { track, x, y, currentPlaylistId },
      playlistMenu: null,
    });
  },

  closeTrackMenu: () => {
    set({ trackMenu: null });
  },

  openPlaylistMenu: (playlist, x, y) => {
    set({
      playlistMenu: { playlist, x, y },
      trackMenu: null,
    });
  },

  closePlaylistMenu: () => {
    set({ playlistMenu: null });
  },

  openConfirmDelete: (playlist, onConfirm) => {
    set({
      confirmDelete: { playlist, onConfirm },
      trackMenu: null,
      playlistMenu: null,
    });
  },

  closeConfirmDelete: () => {
    set({ confirmDelete: null });
  },

  closeAll: () => {
    set({
      trackMenu: null,
      playlistMenu: null,
    });
  },
}));
