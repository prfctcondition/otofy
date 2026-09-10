import React, { useState } from 'react';
import {
  Library,
  Plus,
  ArrowLeft,
  Search,
  ListFilter,
  Pin,
  Download,
  Cloud,
  Trash2,
} from 'lucide-react';
import { Playlist, isSystemPlaylist } from '../types';
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
}

export const LeftLibraryDock: React.FC<LeftLibraryDockProps> = ({
  playlists,
  selectedPlaylistId,
  onSelectPlaylist,
  isCollapsed,
  onToggleCollapse,
  onCreatePlaylist,
  onImportCode,
}) => {
  const [filterTag, setFilterTag] = useState<'all' | 'playlists' | 'artists' | 'albums'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  const [draggedPlaylistId, setDraggedPlaylistId] = useState<string | null>(null);
  const [dragOverPlaylistId, setDragOverPlaylistId] = useState<string | null>(null);

  const isOnline = useNetworkStore((state) => state.isOnline);
  const cachedTracks = usePlayerStore((state) => state.cachedTracks);
  const deletePlaylist = useLibraryStore((state) => state.deletePlaylist);
  const reorderPlaylists = useLibraryStore((state) => state.reorderPlaylists);
  const downloadedCount = useDownloadStore((state) => state.downloadedIds.length);

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
  }, [playlists, isOnline, cachedTracks.length]);

  const filteredPlaylists = React.useMemo(() => {
    return displayedPlaylists
      .filter((pl) => {
        if (filterTag === 'playlists' && pl.type !== 'Playlist') return false;
        if (filterTag === 'albums' && pl.type !== 'Album') return false;
        if (searchFilter.trim()) {
          return (
            pl.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
            pl.creator.toLowerCase().includes(searchFilter.toLowerCase())
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });
  }, [displayedPlaylists, filterTag, searchFilter]);

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
                id="account-sync-dock-btn"
                onClick={() => useLibraryStore.getState().toggleSyncModal()}
                className="p-1.5 rounded-full hover:bg-white/60 dark:hover:bg-white/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                title="Account Sync (YouTube Music / SoundCloud)"
                aria-label="Sync playlists"
              >
                <Cloud size={17} />
              </button>
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
          <div className="px-3 pt-2.5 pb-1.5 flex flex-col gap-2 relative z-10">
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
                <div className="flex items-center gap-1 hover:text-[#0F172A] dark:hover:text-white cursor-pointer transition-colors text-[#64748B] dark:text-white/70">
                  <span>Recents</span>
                  <ListFilter size={13} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Playlist Rows */}
        <div
          className={`flex-1 overflow-y-auto ${
            isCollapsed ? 'px-0 py-2.5 flex flex-col items-center gap-2' : 'px-2 py-1.5 space-y-1'
          } relative z-10`}
        >
          {filteredPlaylists.map((pl) => {
            const isSelected = pl.id === selectedPlaylistId;
            const isDragged = draggedPlaylistId === pl.id;
            const isDragOver = dragOverPlaylistId === pl.id;

            return (
              <div
                key={pl.id}
                id={`playlist-item-${pl.id}`}
                draggable={!searchFilter.trim()}
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
                onClick={() => onSelectPlaylist(pl.id)}
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
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-sm font-semibold truncate ${
                            isSelected ? 'text-[#0F172A] dark:text-white font-bold' : 'text-[#0F172A] dark:text-white'
                          }`}
                        >
                          {pl.title}
                        </span>
                      </div>
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

                    {/* Delete button on hover for custom playlists (strictly hidden for system playlists) */}
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
          })}
        </div>
      </aside>
    </>
  );
};
