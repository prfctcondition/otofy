import { create } from 'zustand';
import type { SearchResult, SearchSourceFilter } from '../types';
import { cleanArtistAndTitle } from '../utils/trackUtils';

interface SearchState {
  query: string;
  sourceFilter: SearchSourceFilter;
  results: SearchResult[];
  artistCard?: {
    name: string;
    avatarUrl?: string;
    subtitle?: string;
    browseId?: string;
    source?: 'YT' | 'SC';
  };
  isSearching: boolean;
  hasSearched: boolean;
}

interface SearchActions {
  search: (query: string, sourceOverride?: SearchSourceFilter) => Promise<void>;
  setQuery: (query: string) => void;
  setSourceFilter: (sourceFilter: SearchSourceFilter) => void;
  clearResults: () => void;
}

export const useSearchStore = create<SearchState & SearchActions>()((set, get) => ({
  query: '',
  sourceFilter: 'ALL',
  results: [],
  artistCard: undefined,
  isSearching: false,
  hasSearched: false,

  search: async (query, sourceOverride) => {
    if (!query.trim()) {
      set({ results: [], artistCard: undefined, isSearching: false, hasSearched: false });
      return;
    }

    const activeFilter = sourceOverride || get().sourceFilter;
    set({ query, isSearching: true });

    try {
      // 1. If Electron IPC is available
      if (window.electronAPI?.searchMusic) {
        const resp = await window.electronAPI.searchMusic(query, activeFilter);
        if (resp && typeof resp === 'object' && 'results' in resp) {
          const results = (resp.results || []).map((r: any) => {
            const { title, artist } = cleanArtistAndTitle(r.title, r.artist);
            return { ...r, title, artist };
          });
          set({
            results,
            artistCard: resp.artistCard,
            isSearching: false,
            hasSearched: true,
          });
        } else if (Array.isArray(resp)) {
          const results = resp.map((r: any) => {
            const { title, artist } = cleanArtistAndTitle(r.title, r.artist);
            return { ...r, title, artist };
          });
          set({
            results,
            artistCard: undefined,
            isSearching: false,
            hasSearched: true,
          });
        } else {
          set({ results: [], artistCard: undefined, isSearching: false, hasSearched: true });
        }
        return;
      }

      // 2. If running via Vite dev server
      try {
        const res = await fetch(`/api/music/search?q=${encodeURIComponent(query)}&source=${activeFilter}`);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object' && 'results' in data) {
            const results = (data.results || []).map((r: any) => {
              const { title, artist } = cleanArtistAndTitle(r.title, r.artist);
              return { ...r, title, artist };
            });
            set({
              results,
              artistCard: data.artistCard,
              isSearching: false,
              hasSearched: true,
            });
            return;
          } else if (Array.isArray(data) && data.length > 0) {
            const results = data.map((r: any) => {
              const { title, artist } = cleanArtistAndTitle(r.title, r.artist);
              return { ...r, title, artist };
            });
            set({ results, isSearching: false, hasSearched: true });
            return;
          }
        }
      } catch {
        // Fall through to public client-side fallback
      }

      // 3. Client-side fallback to SoundCloud public API v2 (only if ALL or SC)
      if (activeFilter === 'ALL' || activeFilter === 'SC') {
        const clientId = 'y7xP5e50k2cT7Uo3n30zG6jPffV4d00B';
        const scRes = await fetch(
          `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=15`
        );
        if (scRes.ok) {
          const scData = await scRes.json();
          const results: SearchResult[] = (scData.collection || []).map((t: any) => {
            const durSec = Math.round((t.duration || 0) / 1000);
            const mins = Math.floor(durSec / 60);
            const secs = Math.floor(durSec % 60);
            const rawArtist =
              t.publisher_metadata?.artist ||
              t.publisher_metadata?.album_artist ||
              t.user?.username;
            const { title, artist } = cleanArtistAndTitle(t.title || 'Untitled', rawArtist);

            return {
              id: String(t.id),
              title,
              artist,
              album: t.publisher_metadata?.album_title || 'SoundCloud',
              duration: `${mins}:${secs.toString().padStart(2, '0')}`,
              durationSec: durSec,
              source: 'SC' as const,
              sourceLabel: 'SoundCloud',
              sourceId: String(t.id),
              artworkUrl: (t.artwork_url || t.user?.avatar_url || '').replace('-large.', '-t500x500.'),
            };
          });
          set({ results, isSearching: false, hasSearched: true });
          return;
        }
      }

      set({ results: [], isSearching: false, hasSearched: true });
    } catch (err) {
      console.error('[Search] Failed:', err);
      set({ results: [], isSearching: false, hasSearched: true });
    }
  },

  setQuery: (query) => set({ query }),
  setSourceFilter: (sourceFilter) => {
    set({ sourceFilter });
    const currentQuery = get().query;
    if (currentQuery && currentQuery.trim()) {
      get().search(currentQuery, sourceFilter);
    }
  },
  clearResults: () => set({ results: [], artistCard: undefined, hasSearched: false, query: '' }),
}));
