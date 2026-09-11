import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Clock,
  Heart,
  MoreHorizontal,
  Loader2,
  Download,
  Check,
  HelpCircle,
} from 'lucide-react';
import { Track } from '../types';
import { PlaceholderArtwork } from './PlaceholderArtwork';
import { ArtistLinks } from './ArtistLinks';
import { TrackConflictModal } from './TrackConflictModal';
import { useLibraryStore } from '../store/libraryStore';
import { usePlayerStore } from '../store/playerStore';
import { useDownloadStore, IDLE_DOWNLOAD } from '../store/downloadStore';
import { useContextMenuStore } from '../store/contextMenuStore';

interface DenseTrackTableProps {
  tracks: Track[];
  activeTrackId: string;
  isPlaying: boolean;
  isLoading?: boolean;
  hideTrackNumber?: boolean;
  onTrackSelect: (track: Track, queue: Track[]) => void;
  onPlayToggle: () => void;
  onToggleLike: (trackId: string, track?: Track) => void;
  onSelectArtist?: (artist: string, source?: 'YT' | 'SC') => void;
  onSelectAlbum?: (browseId?: string, albumTitle?: string, artistName?: string, source?: 'YT' | 'SC') => void;
}

interface TrackRowProps {
  track: Track;
  index: number;
  isCurrent: boolean;
  isSelected: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  hideTrackNumber?: boolean;
  onRowClick: (e: React.MouseEvent, track: Track, index: number) => void;
  onDoubleClick: (track: Track) => void;
  onPlayToggle: () => void;
  onToggleLike: (trackId: string, track?: Track) => void;
  onSelectArtist?: (artist: string, source?: 'YT' | 'SC') => void;
  onSelectAlbum?: (browseId?: string, albumTitle?: string, artistName?: string, source?: 'YT' | 'SC') => void;
  onOpenContextMenu: (e: React.MouseEvent, track: Track) => void;
  onOpenConflictModal: (track: Track) => void;
}

const formatDisplayDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  if (
    dateStr.toLowerCase().includes('ago') ||
    dateStr.toLowerCase().includes('yesterday') ||
    dateStr.toLowerCase().includes('today')
  ) {
    return dateStr;
  }
  const timestamp = Date.parse(dateStr);
  if (isNaN(timestamp)) {
    return 'Recently';
  }
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} wk ago`;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

const renderSourceBadge = (source: Track['source']) => {
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide bg-white/70 dark:bg-white/10 text-[#334155] dark:text-white/70 border border-white/90 dark:border-white/10 shadow-[inset_0_1px_1px_#FFFFFF] dark:shadow-none">
      {source === 'Master' ? 'MQA' : source}
    </span>
  );
};

const TrackRow = React.memo<TrackRowProps>(({
  track,
  index,
  isCurrent,
  isSelected,
  isPlaying,
  isBuffering,
  hideTrackNumber,
  onRowClick,
  onDoubleClick,
  onPlayToggle,
  onToggleLike,
  onSelectArtist,
  onSelectAlbum,
  onOpenContextMenu,
  onOpenConflictModal,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const dlStatus = useDownloadStore((s) => s.downloads[track.id] || IDLE_DOWNLOAD);
  const startDownload = useDownloadStore((s) => s.startDownload);
  const openDownloadedFile = useDownloadStore((s) => s.openDownloadedFile);

  return (
    <div
      id={`track-row-${track.id}`}
      onClick={(e) => onRowClick(e, track, index)}
      onDoubleClick={() => onDoubleClick(track)}
      onContextMenu={(e) => onOpenContextMenu(e, track)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group flex items-center flex-nowrap gap-3 px-3 py-2 rounded-xl text-xs transition-all duration-150 relative cursor-pointer border ${
        isSelected
          ? 'bg-black/[0.08] dark:bg-white/[0.14] border-black/20 dark:border-white/20 shadow-xs'
          : 'border-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
      } ${
        isCurrent
          ? 'text-[#0F172A] dark:text-white font-semibold'
          : 'text-[#334155] dark:text-white/80'
      }`}
    >
      {/* 1. Track Number / Play Button Column */}
      <div className="w-8 shrink-0 flex items-center justify-center">
        {isHovered ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isCurrent) {
                onPlayToggle();
              } else {
                onDoubleClick(track);
              }
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#0F172A] dark:text-white hover:scale-110 active:scale-95 transition-transform cursor-pointer"
            title={isCurrent && isPlaying ? 'Pause' : 'Play'}
          >
            {isCurrent && isPlaying ? (
              <Pause size={14} fill="currentColor" />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
          </button>
        ) : isCurrent && isBuffering ? (
          <Loader2 size={14} className="animate-spin text-[#0F172A] dark:text-white" title="Loading audio..." />
        ) : isCurrent && isPlaying ? (
          <div className="flex items-end gap-0.5 h-3.5" title="Playing">
            <span className="w-0.5 bg-[#0F172A] dark:bg-white animate-[bounce_0.8s_infinite] h-full rounded-full" />
            <span className="w-0.5 bg-[#0F172A]/80 dark:bg-white/80 animate-[bounce_0.6s_infinite] h-2/3 rounded-full" />
            <span className="w-0.5 bg-[#0F172A]/90 dark:bg-white/90 animate-[bounce_1.0s_infinite] h-5/6 rounded-full" />
          </div>
        ) : (
          !hideTrackNumber && (
            <span
              className={`text-xs ${
                isCurrent ? 'text-[#0F172A] dark:text-white font-bold' : 'text-[#94A3B8] dark:text-white/70'
              }`}
            >
              {index + 1}
            </span>
          )
        )}
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-3">
        <PlaceholderArtwork
          icon={track.iconName}
          imageUrl={track.artworkUrl}
          source={track.source}
          sourceId={track.sourceId}
          gradientFrom={track.gradientFrom}
          gradientTo={track.gradientTo}
          size={42}
          rounded="rounded-lg"
          className="shrink-0 shadow-sm border border-white/80 dark:border-white/10"
        />
        <div className="flex flex-col min-w-0 flex-1">
          <span
            className={`text-sm truncate ${
              isCurrent ? 'font-bold text-[#0F172A] dark:text-white' : 'font-semibold text-[#0F172A] dark:text-white'
            }`}
          >
            {track.title}
          </span>
          <ArtistLinks
            artist={track.artist}
            artists={track.artists}
            source={track.source === 'SC' ? 'SC' : 'YT'}
            onSelectArtist={onSelectArtist}
            className="text-xs text-[#64748B] dark:text-white/80 truncate"
            artistClassName="cursor-pointer hover:underline hover:text-[#0F172A] dark:hover:text-white transition-colors"
          />
        </div>
      </div>

      <div className="hidden md:flex items-center justify-between gap-2 min-w-0 w-36 lg:w-56 shrink-0">
        <span
          onClick={(e) => {
            e.stopPropagation();
            if (track.album && onSelectAlbum) {
              onSelectAlbum(undefined, track.album, track.artist, track.source === 'SC' ? 'SC' : 'YT');
            }
          }}
          className={`text-xs text-[#64748B] dark:text-white/80 truncate transition-colors ${
            track.album ? 'hover:text-[#0F172A] dark:hover:text-white hover:underline cursor-pointer' : ''
          }`}
          title={track.album ? `View album ${track.album}` : undefined}
        >
          {track.album}
        </span>
        <div className="shrink-0">{renderSourceBadge(track.source)}</div>
      </div>

      <div className="hidden lg:flex items-center text-xs text-[#64748B] dark:text-white/70 min-w-0 w-28 shrink-0 truncate">
        {formatDisplayDate(track.dateAdded)}
      </div>

      <div className="flex items-center justify-end gap-1.5 pr-1 shrink-0 ml-auto whitespace-nowrap">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLike(track.id, track);
          }}
          className={`p-1 rounded-full transition-colors shrink-0 ${
            track.isLiked
              ? 'text-rose-500 hover:text-rose-600'
              : isHovered
              ? 'text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
              : 'opacity-0'
          }`}
          title={track.isLiked ? 'Remove from Liked' : 'Save to Liked Songs'}
        >
          <Heart
            size={15}
            fill={track.isLiked ? 'currentColor' : 'none'}
          />
        </button>

        {/* Unresolved match review button OR Background download button */}
        {track.unresolved || track.needsMatch ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenConflictModal(track);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-600 dark:text-amber-400 transition-colors text-[11px] font-bold cursor-pointer shrink-0 shadow-xs"
            title="Unresolved match: Click to review candidates"
          >
            <HelpCircle size={13} className="shrink-0 animate-pulse text-amber-500" />
            <span>Match?</span>
          </button>
        ) : dlStatus.status === 'downloading' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              useDownloadStore.getState().pauseTrack(track.id);
            }}
            className="group/dl flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/[0.06] dark:bg-white/[0.12] hover:bg-amber-500/20 text-[10px] font-semibold text-[#0F172A] dark:text-white hover:text-amber-500 transition-colors cursor-pointer shrink-0"
            title={`Downloading... ${Math.round(dlStatus.progress)}% (Click to pause)`}
          >
            <Loader2 size={12} className="animate-spin shrink-0 group-hover/dl:hidden" />
            <Pause size={12} className="hidden group-hover/dl:inline shrink-0" />
            <span className="tabular-nums">{Math.round(dlStatus.progress)}%</span>
          </button>
        ) : dlStatus.status === 'queued' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              useDownloadStore.getState().pauseTrack(track.id);
            }}
            className="p-1 rounded-full text-[#64748B] dark:text-white/70 hover:text-amber-500 transition-colors cursor-pointer shrink-0"
            title="Queued in download list (Click to pause)"
          >
            <Clock size={15} className="animate-pulse" />
          </button>
        ) : dlStatus.status === 'paused' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              useDownloadStore.getState().resumeTrack(track.id);
            }}
            className="p-1 rounded-full text-amber-500 hover:text-[#0F172A] dark:hover:text-white transition-colors cursor-pointer shrink-0"
            title="Download paused (Click to resume)"
          >
            <Pause size={15} />
          </button>
        ) : dlStatus.status === 'completed' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openDownloadedFile(track);
            }}
            className="p-1 rounded-full text-[#0F172A] dark:text-white hover:opacity-80 transition-colors cursor-pointer shrink-0"
            title="Downloaded (Click to show in folder)"
          >
            <Check size={15} strokeWidth={2.5} />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              startDownload(track);
            }}
            className={`p-1 rounded-full transition-colors cursor-pointer shrink-0 ${
              dlStatus.status === 'error'
                ? 'text-rose-500 hover:text-rose-400 opacity-100'
                : isHovered
                ? 'text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white opacity-100'
                : 'opacity-0'
            }`}
            title={dlStatus.status === 'error' ? `Download error: ${dlStatus.error}. Click to retry` : 'Download track (MP3 320kbps)'}
          >
            <Download size={15} />
          </button>
        )}

        <span className="text-xs text-[#64748B] dark:text-white/80 w-9 text-right tabular-nums shrink-0">
          {track.duration}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenContextMenu(e, track);
          }}
          className={`p-1 rounded-full text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white transition-colors shrink-0 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
          title="More actions"
        >
          <MoreHorizontal size={15} />
        </button>
      </div>
    </div>
  );
});

export const DenseTrackTable: React.FC<DenseTrackTableProps> = ({
  tracks,
  activeTrackId,
  isPlaying,
  isLoading = false,
  hideTrackNumber = false,
  onTrackSelect,
  onPlayToggle,
  onToggleLike,
  onSelectArtist,
  onSelectAlbum,
}) => {
  const selectedPlaylistId = useLibraryStore((s) => s.selectedPlaylistId);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const checkStatus = useDownloadStore((s) => s.checkStatus);

  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [conflictTrack, setConflictTrack] = useState<Track | null>(null);

  useEffect(() => {
    if (tracks && tracks.length > 0) {
      checkStatus(tracks);
    }
  }, [tracks, checkStatus]);

  const clearSelection = useCallback(() => {
    setSelectedTrackIds(new Set());
    setLastSelectedId(null);
  }, []);

  // Clear selection when navigating to another playlist
  useEffect(() => {
    clearSelection();
  }, [selectedPlaylistId, clearSelection]);

  // Click outside listener to clear row selection when clicking empty space
  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('[id^="track-row-"]') ||
        target?.closest('#track-context-menu') ||
        target?.closest('.track-context-menu')
      ) {
        return;
      }
      clearSelection();
    };
    window.addEventListener('mousedown', handleGlobalMouseDown);
    return () => window.removeEventListener('mousedown', handleGlobalMouseDown);
  }, [clearSelection]);

  // Cmd/Ctrl + A to select all tracks in current table, Escape to clear selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearSelection();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        setSelectedTrackIds(new Set(tracks.map((t) => t.id)));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tracks, clearSelection]);

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest('[id^="track-row-"]') ||
      target?.closest('#track-context-menu') ||
      target?.closest('button') ||
      target?.closest('input')
    ) {
      return;
    }
    clearSelection();
  };

  const handleRowClick = (e: React.MouseEvent, track: Track, index: number) => {
    if (e.metaKey || e.ctrlKey) {
      // Toggle selection
      setSelectedTrackIds((prev) => {
        const next = new Set(prev);
        if (next.has(track.id)) {
          next.delete(track.id);
        } else {
          next.add(track.id);
        }
        return next;
      });
      setLastSelectedId(track.id);
    } else if (e.shiftKey && lastSelectedId) {
      // Range selection
      const lastIndex = tracks.findIndex((t) => t.id === lastSelectedId);
      if (lastIndex !== -1) {
        const start = Math.min(lastIndex, index);
        const end = Math.max(lastIndex, index);
        const next = new Set(selectedTrackIds);
        for (let i = start; i <= end; i++) {
          next.add(tracks[i].id);
        }
        setSelectedTrackIds(next);
      } else {
        setSelectedTrackIds(new Set([track.id]));
        setLastSelectedId(track.id);
      }
    } else {
      // Single selection (does NOT start playback)
      setSelectedTrackIds(new Set([track.id]));
      setLastSelectedId(track.id);
    }
  };

  const handleDoubleClick = (track: Track) => {
    onTrackSelect(track, tracks);
  };

  const handleOpenContextMenu = (e: React.MouseEvent, track: Track) => {
    e.preventDefault();
    e.stopPropagation();
    let x = e.clientX;
    let y = e.clientY;

    const target = e.currentTarget as HTMLElement | null;
    if (target && target.tagName.toLowerCase() === 'button') {
      const rect = target.getBoundingClientRect();
      x = rect.right - 240;
      y = rect.bottom + 6;
    }

    if (selectedTrackIds.has(track.id) && selectedTrackIds.size > 1) {
      // Multi-track context menu
      const selected = tracks.filter((t) => selectedTrackIds.has(t.id));
      useContextMenuStore.getState().openTrackMenu(track, x, y, selectedPlaylistId, selected);
    } else {
      // Single track context menu
      setSelectedTrackIds(new Set([track.id]));
      setLastSelectedId(track.id);
      useContextMenuStore.getState().openTrackMenu(track, x, y, selectedPlaylistId, [track]);
    }
  };

  return (
    <div
      id="dense-track-table"
      onClick={handleContainerClick}
      className="w-full px-6 py-2 select-none"
    >
      <div className="flex items-center flex-nowrap gap-3 px-3 py-2 border-b border-black/[0.05] dark:border-white/[0.08] text-[11px] font-bold text-[#94A3B8] dark:text-white/70 uppercase tracking-wider">
        <div className="w-8 shrink-0 flex items-center justify-center">
          {hideTrackNumber ? '' : '#'}
        </div>
        <div className="flex-1 min-w-0 flex items-center">Title</div>
        <div className="hidden md:flex items-center min-w-0 w-36 lg:w-56 shrink-0">Album</div>
        <div className="hidden lg:flex items-center min-w-0 w-28 shrink-0">Date Added</div>
        <div className="flex items-center justify-end pr-8 shrink-0 ml-auto">
          <Clock size={14} />
        </div>
      </div>

      <div className="space-y-1 mt-1.5">
        {isLoading ? (
          <div className="py-20 px-4 flex flex-col items-center justify-center text-center animate-in fade-in duration-200">
            <div className="w-12 h-12 rounded-2xl bg-black/[0.05] dark:bg-white/10 border border-black/10 dark:border-white/15 flex items-center justify-center text-[#0F172A] dark:text-white mb-3 shadow-xs">
              <Loader2 size={24} className="animate-spin" />
            </div>
            <h4 className="text-sm font-bold text-[#0F172A] dark:text-white mb-0.5">Loading tracks...</h4>
            <p className="text-xs text-[#64748B] dark:text-white/70">Fetching songs and metadata</p>
          </div>
        ) : tracks.length === 0 ? (
          <div className="py-16 px-4 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/40 dark:bg-white/10 border border-white/80 dark:border-white/15 flex items-center justify-center text-[#64748B] dark:text-white/70 mb-3 shadow-xs">
              <Clock size={28} className="opacity-80" />
            </div>
            <h4 className="text-base font-bold text-[#0F172A] dark:text-white mb-1">No songs in this collection</h4>
            <p className="text-xs text-[#64748B] dark:text-white/70 max-w-sm leading-relaxed">
              Use the top search bar to find and add ad-free songs from YouTube Music & SoundCloud, or import an Otofy share code.
            </p>
          </div>
        ) : (
          tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              isCurrent={track.id === activeTrackId}
              isSelected={selectedTrackIds.has(track.id)}
              isPlaying={isPlaying}
              isBuffering={isBuffering}
              hideTrackNumber={hideTrackNumber}
              onRowClick={handleRowClick}
              onDoubleClick={handleDoubleClick}
              onPlayToggle={onPlayToggle}
              onToggleLike={onToggleLike}
              onSelectArtist={onSelectArtist}
              onSelectAlbum={onSelectAlbum}
              onOpenContextMenu={handleOpenContextMenu}
              onOpenConflictModal={setConflictTrack}
            />
          ))
        )}
      </div>

      <TrackConflictModal
        isOpen={Boolean(conflictTrack)}
        track={conflictTrack}
        onClose={() => setConflictTrack(null)}
      />
    </div>
  );
};
