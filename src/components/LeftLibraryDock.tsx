import React, { useState, useRef, useEffect } from 'react';
import {
  Library,
  Plus,
  ArrowLeft,
  Search,
  ListFilter,
  Pin,
  Download,
  Trash2,
  Check,
  User,
  Disc,
} from 'lucide-react';
import { Playlist, isSystemPlaylist, FollowedArtist, SavedAlbum } from '../types';
import { PlaceholderArtwork } from './PlaceholderArtwork';
import { useLibraryStore } from '../store/libraryStore';
import { useNetworkStore } from '../store/networkStore';
import { usePlayerStore } from '../store/playerStore';
import { useDownloadStore } from '../store/downloadStore';
import { useContextMenuStore } from '../store/contextMenuStore';

interface LeftLibraryDockProps {
  playlists: Playlist[];
  selectedPlaylistId: string;
  onSelectPlaylist: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCreatePlaylist: () => void;
  onImportCode: () => void;
  onSelectArtist?: (artist: string, source?: 'YT' | 'SC') => void;
  onSelectAlbum?: (browseId?: string, albumTitle?: string, artistName?: string, source?: 'YT' | 'SC') => void;
}

type LibraryItem =
  | {
      kind: 'playlist';
      id: string;
      title: string;
      subtitle: string;
      playlist: Playlist;
      isPinned?: boolean;
      dateAdded?: number | string;
      lastOpenedAt?: number | string;
      artworkUrl?: string;
      iconName?: string;
      gradientFrom?: string;
      gradientTo?: string;
    }
  | {
      kind: 'artist';
      id: string;
      title: string;
      subtitle: string;
      artist: FollowedArtist;
      isPinned?: boolean;
      dateAdded?: number | string;
      lastOpenedAt?: number | string;
      avatarUrl?: string;
    }
  | {
      kind: 'album';
      id: string;
      title: string;
      subtitle: string;
      album: SavedAlbum;
      isPinned?: boolean;
      dateAdded?: number | string;
      lastOpenedAt?: number | string;
      artworkUrl?: string;
    };

export const LeftLibraryDock: React.FC<LeftLibraryDockProps> = ({
  playlists,
  selectedPlaylistId,
  onSelectPlaylist,
  isCollapsed,
  onToggleCollapse,
  onCreatePlaylist,
  onImportCode,
  onSelectArtist,
  onSelectAlbum,
}) => {
  const [filterTag, setFilterTag] = useState<'all' | 'playlists' | 'artists' | 'albums'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  const [draggedPlaylistId, setDraggedPlaylistId] = useState<string | null>(null);
  const [dragOverPlaylistId, setDragOverPlaylistId] = useState<string | null>(null);

  const isOnline = useNetworkStore((state) => state.isOnline);
  const cachedTracks = usePlayerStore((state) => state.cachedTracks);
  const deletePlaylist = useLibraryStore((state) => state.deletePlaylist);
  const reorderPlaylists = useLibraryStore((state) => state.reorderPlaylists);
  const downloadedCount = useDownloadStore((state) => state.downloadedIds.length);

  const followedArtists = useLibraryStore((state) => state.followedArtists);
  const savedAlbums = useLibraryStore((state) => state.savedAlbums);
  const librarySortBy = useLibraryStore((state) => state.librarySortBy);
  const setLibrarySortBy = useLibraryStore((state) => state.setLibrarySortBy);
  const recordEntityOpened = useLibraryStore((state) => state.recordEntityOpened);
  const toggleFollowArtist = useLibraryStore((state) => state.toggleFollowArtist);
  const toggleSaveAlbum = useLibraryStore((state) => state.toggleSaveAlbum);

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setIsSortMenuOpen(false);
      }
    };
    if (isSortMenuOpen) {
      document.addEventListener('mousedown', handleDocClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
    };
  }, [isSortMenuOpen]);

  const displayedPlaylists = React.useMemo(() => {
    const list = [...playlists];
    const dlIdx = list.findIndex((p) => p.id === 'pl-downloads');
    if (dlIdx === -1) {
      list.push({
        id: 'pl-downloads',
        title: 'Downloads',
        type: 'Playlist',
        creator: 'System',
        songCount: downloadedCount,
        duration: `${downloadedCount} tracks`,
        isPinned: true,
        iconName: 'download',
        gradientFrom: '#10B981',
        gradientTo: '#059669',
        description: 'Tracks downloaded to your local device for offline listening.',
      });
    } else {
      list[dlIdx] = {
        ...list[dlIdx],
        songCount: downloadedCount,
        duration: `${downloadedCount} tracks`,
      };
    }

    if (!isOnline && !list.some((p) => p.id === 'pl-cached')) {
      list.push({
        id: 'pl-cached',
        title: 'Cached Songs',
        type: 'Playlist',
        creator: 'System',
        songCount: cachedTracks.length,
        duration: `${cachedTracks.length} tracks`,
        isPinned: true,
        iconName: 'music',
        gradientFrom: '#06B6D4',
        gradientTo: '#0284C7',
        description: 'Songs cached during your current session for offline playback.',
      });
    }
    return list;
  }, [playlists, isOnline, cachedTracks.length, downloadedCount]);

  const unifiedItems: LibraryItem[] = React.useMemo(() => {
    const items: LibraryItem[] = [];

    // Playlists (Strictly type === 'Playlist')
    if (filterTag === 'all' || filterTag === 'playlists') {
      displayedPlaylists.forEach((pl) => {
        if (pl.type === 'Playlist') {
          items.push({
            kind: 'playlist',
            id: pl.id,
            title: pl.title,
            subtitle: `${pl.type} · ${pl.creator}`,
            playlist: pl,
            isPinned: Boolean(pl.isPinned),
            dateAdded: pl.createdAt,
            lastOpenedAt: pl.lastOpenedAt,
            artworkUrl: pl.artworkUrl,
            iconName: pl.iconName,
            gradientFrom: pl.gradientFrom,
            gradientTo: pl.gradientTo,
          });
        }
      });
    }

    // Artists
    if (filterTag === 'all' || filterTag === 'artists') {
      followedArtists.forEach((art) => {
        items.push({
          kind: 'artist',
          id: art.id,
          title: art.name,
          subtitle: 'Artist',
          artist: art,
          isPinned: false,
          dateAdded: art.followedAt,
          lastOpenedAt: art.lastOpenedAt,
          avatarUrl: art.avatarUrl,
        });
      });
    }

    // Albums
    if (filterTag === 'all' || filterTag === 'albums') {
      savedAlbums.forEach((alb) => {
        items.push({
          kind: 'album',
          id: alb.id,
          title: alb.title,
          subtitle: `Album · ${alb.artist}`,
          album: alb,
          isPinned: false,
          dateAdded: alb.savedAt,
          lastOpenedAt: alb.lastOpenedAt,
          artworkUrl: alb.artworkUrl,
        });
      });
    }

    // Search query filter
    const query = searchFilter.trim().toLowerCase();
    const filtered = query
      ? items.filter(
          (item) =>
            item.title.toLowerCase().includes(query) ||
            item.subtitle.toLowerCase().includes(query)
        )
      : items;

    // Isolate pinned items completely: pinned items NEVER participate in sorting
    const pinned: LibraryItem[] = [];
    const unpinned: LibraryItem[] = [];

    filtered.forEach((item) => {
      if (item.isPinned) {
        pinned.push(item);
      } else {
        unpinned.push(item);
      }
    });

    // Only unpinned items are sorted by librarySortBy
    unpinned.sort((a, b) => {
      if (librarySortBy === 'alphabetical') {
        return a.title.localeCompare(b.title);
      }
      if (librarySortBy === 'recentlyAdded') {
        const tA = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
        const tB = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
        return tB - tA;
      }
      // 'recents' (strictly user-driven lastOpenedAt descending, fallback to deterministic title alphabetical)
      const tA = typeof a.lastOpenedAt === 'number'
        ? a.lastOpenedAt
        : a.lastOpenedAt
        ? new Date(a.lastOpenedAt).getTime()
        : 0;
      const tB = typeof b.lastOpenedAt === 'number'
        ? b.lastOpenedAt
        : b.lastOpenedAt
        ? new Date(b.lastOpenedAt).getTime()
        : 0;
      if (tA !== tB) {
        return tB - tA;
      }
      return a.title.localeCompare(b.title);
    });

    return [...pinned, ...unpinned];
  }, [displayedPlaylists, followedArtists, savedAlbums, filterTag, searchFilter, librarySortBy]);

  return (
    <>
      <aside
        id="left-library-dock"
        className={`h-full flex flex-col liquid-glass-panel rounded-2xl select-none transition-all duration-300 overflow-hidden relative ${
          isCollapsed ? 'w-[72px] min-w-[72px]' : 'w-[270px] min-w-[270px]'
        }`}
      >
        <div className="pointer-events-none absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-white/70 dark:from-white/[0.05] to-transparent" />

        {/* Header */}
        <div
          className={`flex items-center ${
            isCollapsed ? 'justify-center p-2.5' : 'justify-between p-3.5'
          } border-b border-black/[0.06] dark:border-white/10 relative z-10`}
        >
          <button
            id="toggle-library-collapse-btn"
            onClick={onToggleCollapse}
            className={`flex items-center ${
              isCollapsed ? 'justify-center w-11 h-11 p-0' : 'gap-3'
            } text-[#0F172A] dark:text-white hover:opacity-80 transition-opacity group`}
            title={isCollapsed ? 'Expand library dock' : 'Collapse library dock'}
          >
            <div className="p-1.5 rounded-lg group-hover:bg-white/50 dark:group-hover:bg-white/10 transition-colors flex items-center justify-center">
              <Library size={20} className="text-[#0F172A] dark:text-white group-hover:scale-105 transition-transform" />
            </div>
            {!isCollapsed && (
              <span className="font-bold text-sm tracking-tight text-[#0F172A] dark:text-white">
                Your Library
              </span>
            )}
          </button>

          {!isCollapsed && (
            <div className="flex items-center gap-1 text-[#64748B] dark:text-white/80">
              <button
                id="import-playlist-btn"
                onClick={onImportCode}
                className="p-1.5 rounded-full hover:bg-white/60 dark:hover:bg-white/10 hover:text-[#0F172A] dark:hover:text-white transition-colors"
                title="Import playlist code"
                aria-label="Import code"
              >
                <Download size={17} />
              </button>
              <button
                id="create-playlist-btn"
                onClick={onCreatePlaylist}
                className="p-1.5 rounded-full hover:bg-white/60 dark:hover:bg-white/10 hover:text-[#0F172A] dark:hover:text-white transition-colors"
                title="Create playlist"
                aria-label="Create playlist"
              >
                <Plus size={18} />
              </button>
              <button
                id="collapse-arrow-btn"
                onClick={onToggleCollapse}
                className="p-1.5 rounded-full hover:bg-white/60 dark:hover:bg-white/10 hover:text-[#0F172A] dark:hover:text-white transition-colors"
                title="Collapse Your Library"
                aria-label="Collapse"
              >
                <ArrowLeft size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Filter Pills & Search in Expanded State */}
        {!isCollapsed && (
          <div className="px-3 pt-2.5 pb-1.5 flex flex-col gap-2 relative z-30">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setFilterTag(filterTag === 'playlists' ? 'all' : 'playlists')}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  filterTag === 'playlists'
                    ? 'bg-[#0F172A] dark:bg-white text-white dark:text-black font-bold shadow-[0_4px_14px_rgba(15,23,42,0.25)] border border-[#0F172A] dark:border-white'
                    : 'bg-white/65 dark:bg-white/[0.08] hover:bg-white/85 dark:hover:bg-white/[0.14] text-[#334155] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white border border-white/95 dark:border-white/10 shadow-[inset_0_1px_1.5px_#FFFFFF,0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-none'
                }`}
              >
                Playlists
              </button>
              <button
                onClick={() => setFilterTag(filterTag === 'artists' ? 'all' : 'artists')}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  filterTag === 'artists'
                    ? 'bg-[#0F172A] dark:bg-white text-white dark:text-black font-bold shadow-[0_4px_14px_rgba(15,23,42,0.25)] border border-[#0F172A] dark:border-white'
                    : 'bg-white/65 dark:bg-white/[0.08] hover:bg-white/85 dark:hover:bg-white/[0.14] text-[#334155] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white border border-white/95 dark:border-white/10 shadow-[inset_0_1px_1.5px_#FFFFFF,0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-none'
                }`}
              >
                Artists
              </button>
              <button
                onClick={() => setFilterTag(filterTag === 'albums' ? 'all' : 'albums')}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  filterTag === 'albums'
                    ? 'bg-[#0F172A] dark:bg-white text-white dark:text-black font-bold shadow-[0_4px_14px_rgba(15,23,42,0.25)] border border-[#0F172A] dark:border-white'
                    : 'bg-white/65 dark:bg-white/[0.08] hover:bg-white/85 dark:hover:bg-white/[0.14] text-[#334155] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white border border-white/95 dark:border-white/10 shadow-[inset_0_1px_1.5px_#FFFFFF,0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-none'
                }`}
              >
                Albums
              </button>
            </div>

            <div className="flex items-center justify-between text-[#64748B] dark:text-white/70 text-xs px-1">
              {isSearchActive ? (
                <div className="flex items-center w-full bg-white/70 dark:bg-white/10 px-2 py-1 rounded-md border border-white/90 dark:border-white/15 shadow-[inset_0_1px_1px_rgba(0,0,0,0.04)]">
                  <Search size={13} className="text-[#64748B] dark:text-white/70 mr-1.5 shrink-0" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search in Your Library"
                    className="w-full bg-transparent text-xs text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-white/40 focus:outline-none"
                    autoFocus
                    onBlur={() => {
                      if (!searchFilter) setIsSearchActive(false);
                    }}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setIsSearchActive(true)}
                  className="p-1 rounded-full hover:text-[#0F172A] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="Search in Your Library"
                >
                  <Search size={15} />
                </button>
              )}

              {!isSearchActive && (
                <div className="relative" ref={sortMenuRef}>
                  <button
                    onClick={() => setIsSortMenuOpen((prev) => !prev)}
                    className="flex items-center gap-1 hover:text-[#0F172A] dark:hover:text-white cursor-pointer transition-colors text-[#64748B] dark:text-white/70 text-xs py-1"
                  >
                    <span>
                      {librarySortBy === 'alphabetical'
                        ? 'Alphabetical'
                        : librarySortBy === 'recentlyAdded'
                        ? 'Recently Added'
                        : 'Recents'}
                    </span>
                    <ListFilter size={13} />
                  </button>

                  {isSortMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200/90 dark:border-neutral-700 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/40">
                        Sort by
                      </div>
                      <button
                        onClick={() => {
                          setLibrarySortBy('recents');
                          setIsSortMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                          librarySortBy === 'recents'
                            ? 'text-[#0F172A] dark:text-white font-bold bg-black/[0.04] dark:bg-white/[0.08]'
                            : 'text-slate-600 dark:text-white/70 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                        }`}
                      >
                        <span>Recents</span>
                        {librarySortBy === 'recents' && <Check size={13} className="text-emerald-500" />}
                      </button>
                      <button
                        onClick={() => {
                          setLibrarySortBy('recentlyAdded');
                          setIsSortMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                          librarySortBy === 'recentlyAdded'
                            ? 'text-[#0F172A] dark:text-white font-bold bg-black/[0.04] dark:bg-white/[0.08]'
                            : 'text-slate-600 dark:text-white/70 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                        }`}
                      >
                        <span>Recently Added</span>
                        {librarySortBy === 'recentlyAdded' && <Check size={13} className="text-emerald-500" />}
                      </button>
                      <button
                        onClick={() => {
                          setLibrarySortBy('alphabetical');
                          setIsSortMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                          librarySortBy === 'alphabetical'
                            ? 'text-[#0F172A] dark:text-white font-bold bg-black/[0.04] dark:bg-white/[0.08]'
                            : 'text-slate-600 dark:text-white/70 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                        }`}
                      >
                        <span>Alphabetical</span>
                        {librarySortBy === 'alphabetical' && <Check size={13} className="text-emerald-500" />}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Unified Item Rows */}
        <div
          className={`flex-1 overflow-y-auto ${
            isCollapsed ? 'px-0 py-2.5 flex flex-col items-center gap-2' : 'px-2 py-1.5 space-y-1'
          } relative z-10`}
        >
          {unifiedItems.map((item) => {
            if (item.kind === 'playlist') {
              const pl = item.playlist;
              const isSelected = pl.id === selectedPlaylistId;
              const isDragged = draggedPlaylistId === pl.id;
              const isDragOver = dragOverPlaylistId === pl.id;

              return (
                <div
                  key={`pl-${pl.id}`}
                  id={`playlist-item-${pl.id}`}
                  draggable={!searchFilter.trim() && (filterTag === 'all' || filterTag === 'playlists')}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', pl.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggedPlaylistId(pl.id);
                  }}
                  onDragEnd={() => {
                    setDraggedPlaylistId(null);
                    setDragOverPlaylistId(null);
                  }}
                  onDragOver={(e) => {
                    if (!draggedPlaylistId || draggedPlaylistId === pl.id) return;
                    const sourcePl = displayedPlaylists.find((p) => p.id === draggedPlaylistId);
                    if (!sourcePl || Boolean(sourcePl.isPinned) !== Boolean(pl.isPinned)) {
                      e.dataTransfer.dropEffect = 'none';
                      return;
                    }
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverPlaylistId !== pl.id) {
                      setDragOverPlaylistId(pl.id);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    if (dragOverPlaylistId === pl.id) {
                      setDragOverPlaylistId(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const sourceId = e.dataTransfer.getData('text/plain') || draggedPlaylistId;
                    setDraggedPlaylistId(null);
                    setDragOverPlaylistId(null);
                    if (!sourceId || sourceId === pl.id) return;
                    const sourcePl = displayedPlaylists.find((p) => p.id === sourceId);
                    if (!sourcePl || Boolean(sourcePl.isPinned) !== Boolean(pl.isPinned)) return;
                    reorderPlaylists(sourceId, pl.id);
                  }}
                  onClick={() => {
                    onSelectPlaylist(pl.id);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    useContextMenuStore.getState().openPlaylistMenu(pl, e.clientX, e.clientY);
                  }}
                  className={`group relative flex items-center ${
                    isCollapsed
                      ? 'justify-center w-12 h-12 p-0 mx-auto rounded-xl'
                      : 'gap-3 p-2 rounded-xl w-full'
                  } cursor-pointer transition-all duration-150 ${
                    isDragged ? 'opacity-40 scale-[0.98]' : ''
                  } ${
                    isDragOver
                      ? 'border-t-2 border-[#0F172A] dark:border-white bg-black/[0.04] dark:bg-white/[0.08]'
                      : ''
                  } ${
                    isSelected
                      ? 'bg-white/85 dark:bg-white/15 border border-white dark:border-white/20 shadow-[0_4px_14px_rgba(0,0,0,0.06),inset_0_1px_1.5px_#FFFFFF] dark:shadow-none text-[#0F172A] dark:text-white'
                      : 'hover:bg-white/45 dark:hover:bg-white/[0.07] hover:border hover:border-white/75 dark:hover:border-white/10 text-[#334155] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white border border-transparent'
                  }`}
                  title={`${pl.title} · ${pl.type} (${pl.songCount} songs)`}
                >
                  <PlaceholderArtwork
                    icon={pl.iconName}
                    imageUrl={pl.artworkUrl}
                    gradientFrom={pl.gradientFrom}
                    gradientTo={pl.gradientTo}
                    size={isCollapsed ? 38 : 46}
                    rounded="rounded-lg"
                    className="shadow-sm border border-white/80 dark:border-white/20 shrink-0"
                  />

                  {!isCollapsed && (
                    <>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <span
                          className={`text-sm font-semibold truncate ${
                            isSelected ? 'text-[#0F172A] dark:text-white font-bold' : 'text-[#0F172A] dark:text-white'
                          }`}
                        >
                          {pl.title}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-[#64748B] dark:text-white/70 truncate mt-0.5">
                          {pl.isPinned && (
                            <span className="text-[#0F172A] dark:text-white font-medium flex items-center gap-0.5">
                              <Pin size={10} className="rotate-45" />
                              Pinned ·
                            </span>
                          )}
                          <span>{pl.type}</span>
                          <span>·</span>
                          <span>{pl.creator}</span>
                        </div>
                      </div>

                      {/* Delete button on hover for custom playlists */}
                      {!isSystemPlaylist(pl) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            useContextMenuStore.getState().openConfirmDelete(pl, async () => {
                              await deletePlaylist(pl.id);
                            });
                          }}
                          className="p-1 rounded-md text-[#94A3B8] dark:text-white/60 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white/80 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                          title={`Delete ${pl.title}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}

                      {isSelected && pl.id === 'pl-liked' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#0F172A] dark:bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)] shrink-0 mr-1" />
                      )}
                    </>
                  )}
                </div>
              );
            }

            if (item.kind === 'artist') {
              const art = item.artist;
              return (
                <div
                  key={`art-${art.id}`}
                  onClick={() => {
                    onSelectArtist?.(art.name, art.source);
                    recordEntityOpened(art.name, 'artist').catch(() => {});
                  }}
                  className={`group relative flex items-center ${
                    isCollapsed
                      ? 'justify-center w-12 h-12 p-0 mx-auto rounded-xl'
                      : 'gap-3 p-2 rounded-xl w-full'
                  } cursor-pointer transition-all duration-150 hover:bg-white/45 dark:hover:bg-white/[0.07] hover:border hover:border-white/75 dark:hover:border-white/10 text-[#334155] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white border border-transparent`}
                  title={`${art.name} · Artist`}
                >
                  {art.avatarUrl ? (
                    <img
                      src={art.avatarUrl}
                      alt={art.name}
                      className={`${
                        isCollapsed ? 'w-[38px] h-[38px]' : 'w-[46px] h-[46px]'
                      } rounded-full object-cover shadow-sm border border-white/80 dark:border-white/20 shrink-0`}
                    />
                  ) : (
                    <div
                      className={`${
                        isCollapsed ? 'w-[38px] h-[38px]' : 'w-[46px] h-[46px]'
                      } rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-500 dark:text-white/60 font-semibold shadow-sm border border-white/80 dark:border-white/20 shrink-0`}
                    >
                      <User size={isCollapsed ? 18 : 22} />
                    </div>
                  )}

                  {!isCollapsed && (
                    <>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <span className="text-sm font-semibold truncate text-[#0F172A] dark:text-white">
                          {art.name}
                        </span>
                        <span className="text-xs text-[#64748B] dark:text-white/70 truncate mt-0.5">
                          Artist
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFollowArtist({
                            name: art.name,
                            avatarUrl: art.avatarUrl,
                            source: art.source,
                          });
                        }}
                        className="p-1 rounded-md text-[#94A3B8] dark:text-white/60 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white/80 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        title={`Unfollow ${art.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              );
            }

            if (item.kind === 'album') {
              const alb = item.album;
              return (
                <div
                  key={`alb-${alb.id}`}
                  onClick={() => {
                    onSelectAlbum?.(alb.id, alb.title, alb.artist, alb.source);
                    recordEntityOpened(alb.id, 'album').catch(() => {});
                  }}
                  className={`group relative flex items-center ${
                    isCollapsed
                      ? 'justify-center w-12 h-12 p-0 mx-auto rounded-xl'
                      : 'gap-3 p-2 rounded-xl w-full'
                  } cursor-pointer transition-all duration-150 hover:bg-white/45 dark:hover:bg-white/[0.07] hover:border hover:border-white/75 dark:hover:border-white/10 text-[#334155] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white border border-transparent`}
                  title={`${alb.title} · Album · ${alb.artist}`}
                >
                  {alb.artworkUrl ? (
                    <img
                      src={alb.artworkUrl}
                      alt={alb.title}
                      className={`${
                        isCollapsed ? 'w-[38px] h-[38px]' : 'w-[46px] h-[46px]'
                      } rounded-lg object-cover shadow-sm border border-white/80 dark:border-white/20 shrink-0`}
                    />
                  ) : (
                    <div
                      className={`${
                        isCollapsed ? 'w-[38px] h-[38px]' : 'w-[46px] h-[46px]'
                      } rounded-lg bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-500 dark:text-white/60 font-semibold shadow-sm border border-white/80 dark:border-white/20 shrink-0`}
                    >
                      <Disc size={isCollapsed ? 18 : 22} />
                    </div>
                  )}

                  {!isCollapsed && (
                    <>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <span className="text-sm font-semibold truncate text-[#0F172A] dark:text-white">
                          {alb.title}
                        </span>
                        <span className="text-xs text-[#64748B] dark:text-white/70 truncate mt-0.5">
                          Album · {alb.artist}
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSaveAlbum({
                            id: alb.id,
                            title: alb.title,
                            artist: alb.artist,
                            artworkUrl: alb.artworkUrl,
                            source: alb.source,
                          });
                        }}
                        className="p-1 rounded-md text-[#94A3B8] dark:text-white/60 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white/80 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        title={`Remove ${alb.title} from Saved Albums`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              );
            }

            return null;
          })}
        </div>
      </aside>
    </>
  );
};
