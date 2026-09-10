import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Play,
  Pause,
  Clock,
  Heart,
  MoreHorizontal,
  Loader2,
  Download,
  Check,
} from 'lucide-react';
import { Track } from '../types';
import { PlaceholderArtwork } from './PlaceholderArtwork';
import { TrackContextMenu } from './TrackContextMenu';
import { useLibraryStore } from '../store/libraryStore';
import { usePlayerStore } from '../store/playerStore';
import { useDownloadStore, IDLE_DOWNLOAD } from '../store/downloadStore';

interface DenseTrackTableProps {
  tracks: Track[];
  activeTrackId: string;
  isPlaying: boolean;
  isLoading?: boolean;
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
  isPlaying: boolean;
  isBuffering: boolean;
  onTrackSelect: (track: Track) => void;
  onPlayToggle: () => void;
  onToggleLike: (trackId: string, track?: Track) => void;
  onSelectArtist?: (artist: string, source?: 'YT' | 'SC') => void;
  onSelectAlbum?: (browseId?: string, albumTitle?: string, artistName?: string, source?: 'YT' | 'SC') => void;
  onOpenContextMenu: (e: React.MouseEvent, track: Track) => void;
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
  isPlaying,
  isBuffering,
  onTrackSelect,
  onPlayToggle,
  onToggleLike,
  onSelectArtist,
  onSelectAlbum,
  onOpenContextMenu,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const dlStatus = useDownloadStore((s) => s.downloads[track.id] || IDLE_DOWNLOAD);
  const startDownload = useDownloadStore((s) => s.startDownload);
  const openDownloadedFile = useDownloadStore((s) => s.openDownloadedFile);

  return (
    <div
      id={`track-row-${track.id}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onTrackSelect(track)}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenContextMenu(e, track);
      }}
      className={`group relative grid grid-cols-[40px_1fr_135px] md:grid-cols-[40px_minmax(180px,1fr)_minmax(120px,200px)_140px] lg:grid-cols-[40px_minmax(180px,4fr)_minmax(120px,3fr)_minmax(90px,2fr)_140px] gap-3 px-3 py-2 rounded-xl items-center cursor-pointer transition-all duration-150 ${
        isCurrent
          ? 'bg-white/90 dark:bg-white/15 border border-violet-200/80 dark:border-white/20 shadow-[0_4px_16px_rgba(124,58,237,0.08),inset_0_1px_1.5px_#FFFFFF] dark:shadow-none text-[#0F172A] dark:text-white ring-1 ring-violet-500/20'
          : 'hover:bg-white/50 dark:hover:bg-white/[0.06] hover:border hover:border-white/80 dark:hover:border-white/10 text-[#334155] dark:text-white/80 border border-transparent'
      }`}
    >
      <div className="flex items-center justify-center text-sm font-medium">
        {isHovered ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isCurrent) {
                onPlayToggle();
              } else {
                onTrackSelect(track);
              }
            }}
            className="text-[#0F172A] dark:text-white hover:text-black dark:hover:text-violet-300 active:scale-90 transition-all p-1"
            title={isCurrent && isPlaying ? 'Pause' : 'Play'}
          >
            {isCurrent && isBuffering ? (
              <Loader2 size={14} className="animate-spin text-violet-600 dark:text-violet-400" />
            ) : isCurrent && isPlaying ? (
              <Pause size={14} fill="currentColor" />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
          </button>
        ) : isCurrent && isBuffering ? (
          <Loader2 size={14} className="animate-spin text-violet-600 dark:text-violet-400" title="Loading audio..." />
        ) : isCurrent && isPlaying ? (
          <div className="flex items-end gap-0.5 h-3.5" title="Playing">
            <span className="w-0.5 bg-violet-600 dark:bg-violet-400 animate-[bounce_0.8s_infinite] h-full rounded-full" />
            <span className="w-0.5 bg-violet-600/80 dark:bg-violet-400/80 animate-[bounce_0.6s_infinite] h-2/3 rounded-full" />
            <span className="w-0.5 bg-violet-600/90 dark:bg-violet-400/90 animate-[bounce_1.0s_infinite] h-5/6 rounded-full" />
          </div>
        ) : (
          <span
            className={`text-xs ${
              isCurrent ? 'text-violet-700 dark:text-violet-400 font-bold' : 'text-[#94A3B8] dark:text-white/70'
            }`}
          >
            {track.number || index + 1}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 min-w-0">
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
        <div className="flex flex-col min-w-0">
          <span
            className={`text-sm font-semibold truncate ${
              isCurrent ? 'text-[#0F172A] dark:text-white font-bold' : 'text-[#0F172A] dark:text-white'
            }`}
          >
            {track.title}
          </span>
          <span
            onClick={(e) => {
              e.stopPropagation();
              onSelectArtist?.(track.artist, track.source === 'SC' ? 'SC' : 'YT');
            }}
            className="text-xs text-[#64748B] dark:text-white/80 truncate hover:text-violet-700 dark:hover:text-white hover:underline cursor-pointer transition-colors"
            title={`View ${track.artist}`}
          >
            {track.artist}
          </span>
        </div>
      </div>

      <div className="hidden md:flex items-center justify-between gap-2 min-w-0">
        <span
          onClick={(e) => {
            e.stopPropagation();
            if (track.album && onSelectAlbum) {
              onSelectAlbum(undefined, track.album, track.artist, track.source === 'SC' ? 'SC' : 'YT');
            }
          }}
          className={`text-xs text-[#64748B] dark:text-white/80 truncate transition-colors ${
            track.album ? 'hover:text-violet-700 dark:hover:text-white hover:underline cursor-pointer' : ''
          }`}
          title={track.album ? `View album ${track.album}` : undefined}
        >
          {track.album}
        </span>
        <div className="shrink-0">{renderSourceBadge(track.source)}</div>
      </div>

      <div className="hidden lg:flex items-center text-xs text-[#64748B] dark:text-white/70 min-w-0 truncate">
        {formatDisplayDate(track.dateAdded)}
      </div>

      <div className="flex items-center justify-end gap-1.5 pr-1 min-w-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLike(track.id, track);
          }}
          className={`p-1 rounded-full transition-colors ${
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

        {/* Background download button */}
        {dlStatus.status === 'downloading' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              useDownloadStore.getState().pauseTrack(track.id);
            }}
            className="group/dl flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-500/10 hover:bg-amber-500/20 text-[10px] font-semibold text-violet-600 dark:text-violet-400 hover:text-amber-500 transition-colors cursor-pointer"
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
            className="p-1 rounded-full text-violet-500 hover:text-amber-500 transition-colors cursor-pointer"
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
            className="p-1 rounded-full text-amber-500 hover:text-emerald-500 transition-colors cursor-pointer"
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
            className="p-1 rounded-full text-emerald-500 hover:text-emerald-400 transition-colors cursor-pointer"
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
            className={`p-1 rounded-full transition-colors cursor-pointer ${
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
          className={`p-1 rounded-full text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white transition-colors ${
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
  onTrackSelect,
  onPlayToggle,
  onToggleLike,
  onSelectArtist,
  onSelectAlbum,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    track: Track;
    x: number;
    y: number;
  } | null>(null);

  const playlists = useLibraryStore((s) => s.playlists);
  const selectedPlaylistId = useLibraryStore((s) => s.selectedPlaylistId);
  const addTrackToPlaylist = useLibraryStore((s) => s.addTrackToPlaylist);
  const removeTrackFromPlaylist = useLibraryStore((s) => s.removeTrackFromPlaylist);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const selectPlaylist = useLibraryStore((s) => s.selectPlaylist);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const checkStatus = useDownloadStore((s) => s.checkStatus);

  useEffect(() => {
    if (tracks && tracks.length > 0) {
      checkStatus(tracks);
    }
  }, [tracks, checkStatus]);

  const handleCreatePlaylistWithTrack = async (trk: Track) => {
    const newPl = await createPlaylist({
      title: `${trk.title} Mix`,
      iconName: 'sparkles',
    });
    await addTrackToPlaylist(newPl.id, trk);
    await selectPlaylist(newPl.id);
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

    setContextMenu({ track, x, y });
  };

  return (
    <div id="dense-track-table" className="w-full px-6 py-2 select-none">
      <div className="grid grid-cols-[40px_1fr_135px] md:grid-cols-[40px_minmax(180px,1fr)_minmax(120px,200px)_140px] lg:grid-cols-[40px_minmax(180px,4fr)_minmax(120px,3fr)_minmax(90px,2fr)_140px] gap-3 px-3 py-2 border-b border-black/[0.05] dark:border-white/[0.08] text-[11px] font-bold text-[#94A3B8] dark:text-white/70 uppercase tracking-wider">
        <div className="flex items-center justify-center">#</div>
        <div className="flex items-center">Title</div>
        <div className="hidden md:flex items-center">Album</div>
        <div className="hidden lg:flex items-center">Date Added</div>
        <div className="flex items-center justify-end pr-2">
          <Clock size={14} />
        </div>
      </div>

      <div className="space-y-1 mt-1.5">
        {isLoading ? (
          <div className="py-20 px-4 flex flex-col items-center justify-center text-center animate-in fade-in duration-200">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 dark:bg-white/10 border border-violet-500/20 dark:border-white/15 flex items-center justify-center text-violet-600 dark:text-violet-400 mb-3 shadow-xs">
              <Loader2 size={24} className="animate-spin" />
            </div>
            <h4 className="text-sm font-bold text-[#0F172A] dark:text-white mb-0.5">Loading tracks...</h4>
            <p className="text-xs text-[#64748B] dark:text-white/70">Fetching songs and metadata</p>
          </div>
        ) : tracks.length === 0 ? (
          <div className="py-16 px-4 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/40 dark:bg-white/10 border border-white/80 dark:border-white/15 flex items-center justify-center text-violet-500 mb-3 shadow-xs">
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
              isPlaying={isPlaying}
              isBuffering={isBuffering}
              onTrackSelect={(t) => onTrackSelect(t, tracks)}
              onPlayToggle={onPlayToggle}
              onToggleLike={onToggleLike}
              onSelectArtist={onSelectArtist}
              onSelectAlbum={onSelectAlbum}
              onOpenContextMenu={handleOpenContextMenu}
            />
          ))
        )}
      </div>

      {contextMenu &&
        createPortal(
          <TrackContextMenu
            track={contextMenu.track}
            x={contextMenu.x}
            y={contextMenu.y}
            playlists={playlists}
            currentPlaylistId={selectedPlaylistId}
            onClose={() => setContextMenu(null)}
            onPlay={(t) => onTrackSelect(t, tracks)}
            onAddToPlaylist={(plId, t) => addTrackToPlaylist(plId, t)}
            onRemoveFromPlaylist={(plId, trkId) => removeTrackFromPlaylist(plId, trkId)}
            onCreatePlaylistWithTrack={handleCreatePlaylistWithTrack}
            onToggleLike={onToggleLike}
            onSelectArtist={onSelectArtist}
          />,
          document.body
        )}
    </div>
  );
};
