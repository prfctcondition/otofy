import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Plus,
  FolderPlus,
  Heart,
  User,
  Share2,
  Check,
  ChevronRight,
  Download,
  Loader2,
  Trash2,
  Pause,
  X,
  Clock,
  Radio,
} from 'lucide-react';
import { Track, Playlist } from '../types';
import { useDownloadStore, IDLE_DOWNLOAD } from '../store/downloadStore';
import { usePlayerStore } from '../store/playerStore';

interface TrackContextMenuProps {
  track: Track;
  x: number;
  y: number;
  playlists: Playlist[];
  currentPlaylistId?: string;
  onClose: () => void;
  onPlay: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  onRemoveFromPlaylist?: (playlistId: string, trackId: string) => void;
  onCreatePlaylistWithTrack: (track: Track) => void;
  onToggleLike: (trackId: string, track?: Track) => void;
  onSelectArtist?: (artist: string) => void;
}

const getInitialCoords = (clickX: number, clickY: number, menuW = 256, menuH = 360) => {
  const dockHeight = 90;
  const padding = 12;
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800;

  let left = clickX;
  let top = clickY;

  if (left + menuW > winW - padding) {
    left = Math.max(padding, winW - menuW - padding);
  }
  if (left < padding) {
    left = padding;
  }

  if (top + menuH > winH - dockHeight) {
    top = Math.max(padding, clickY - menuH);
  }
  if (top < padding) {
    top = padding;
  }

  return { top, left };
};

export const TrackContextMenu: React.FC<TrackContextMenuProps> = ({
  track,
  x,
  y,
  playlists,
  currentPlaylistId,
  onClose,
  onPlay,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onCreatePlaylistWithTrack,
  onToggleLike,
  onSelectArtist,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showPlaylistsSubmenu, setShowPlaylistsSubmenu] = useState(false);
  const [addedPlaylistId, setAddedPlaylistId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Position clamping to prevent overflowing outside the screen (pre-calculated synchronously)
  const [coords, setCoords] = useState(() => getInitialCoords(x, y, 256, 360));

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const menuWidth = 240;
    const menuHeight = rect.height || 280;
    const dockHeight = 84 + 16; // player bar + margins

    let left = x;
    let top = y;

    if (left + menuWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - menuWidth - 12);
    }
    if (left < 12) {
      left = 12;
    }
    if (top + menuHeight > window.innerHeight - dockHeight) {
      top = Math.max(12, y - menuHeight);
    }
    if (top < 12) {
      top = 12;
    }

    setCoords({ top, left });
  }, [x, y]);

  // Click outside, escape, and scroll listener to close
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest?.('#lyrics-panel') ||
          target.closest?.('.lyrics-scroll-container') ||
          menuRef.current?.contains(target))
      ) {
        return;
      }
      onClose();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  const dlStatus = useDownloadStore((s) => s.downloads[track.id] || IDLE_DOWNLOAD);
  const startDownload = useDownloadStore((s) => s.startDownload);
  const openDownloadedFile = useDownloadStore((s) => s.openDownloadedFile);

  const likedPlaylist = playlists.find((p) => p.id === 'pl-liked');
  const userPlaylists = playlists.filter((p) => p.id !== 'pl-liked');

  const isCurrentLikedSongs = currentPlaylistId === 'pl-liked';
  const canRemoveFromCurrent =
    currentPlaylistId &&
    currentPlaylistId !== 'pl-liked' &&
    currentPlaylistId !== 'home' &&
    !currentPlaylistId.startsWith('artist-') &&
    !currentPlaylistId.startsWith('album-') &&
    !currentPlaylistId.startsWith('mix-');

  const handlePlaylistSelect = (playlistId: string) => {
    onAddToPlaylist(playlistId, track);
    setAddedPlaylistId(playlistId);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleCopyShare = () => {
    const shareText = `🎵 ${track.title} - ${track.artist}\nOtofy Stream: ${track.sourceId}`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => {
      onClose();
    }, 800);
  };

  return (
    <div
      ref={menuRef}
      id="track-context-menu"
      style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
      className="fixed z-[9999] w-64 py-1.5 rounded-2xl bg-white/92 dark:bg-[#0C0C10] backdrop-blur-3xl border border-white/95 dark:border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.8)] text-[#0F172A] dark:text-white text-xs font-medium select-none native-context-menu"
    >
      {/* Track Header preview in menu */}
      <div className="px-3 py-2 border-b border-black/[0.06] dark:border-white/10 mb-1">
        <p className="font-bold text-[13px] truncate text-[#0F172A] dark:text-white">{track.title}</p>
        <p className="text-[11px] text-[#64748B] dark:text-white/60 truncate">{track.artist}</p>
      </div>

      {/* Play Now */}
      <button
        onClick={() => {
          onPlay(track);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer"
      >
        <Play size={15} className="text-violet-600 dark:text-violet-400 fill-violet-600 dark:fill-violet-400" />
        <span>Play now</span>
      </button>

      {/* Start Radio */}
      <button
        onClick={() => {
          usePlayerStore.getState().startTrackRadio(track);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer"
      >
        <Radio size={15} className="text-violet-600 dark:text-violet-400" />
        <span>Start Radio</span>
      </button>

      {/* Like / Unlike */}
      <button
        onClick={() => {
          onToggleLike(track.id, track);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer"
      >
        <Heart
          size={15}
          className={track.isLiked ? 'text-rose-500 fill-rose-500' : 'text-[#64748B] dark:text-white/70'}
        />
        <span>{track.isLiked || isCurrentLikedSongs ? 'Remove from Liked Songs' : 'Save to Liked Songs'}</span>
      </button>

      {/* Remove from custom playlist if inside one */}
      {canRemoveFromCurrent && onRemoveFromPlaylist && (
        <button
          onClick={() => {
            onRemoveFromPlaylist(currentPlaylistId!, track.id);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-rose-500/10 text-rose-500 transition-colors text-left cursor-pointer"
        >
          <Trash2 size={15} />
          <span>Remove from this playlist</span>
        </button>
      )}

      <div className="h-px bg-black/[0.06] dark:bg-white/10 my-1" />

      {/* Add to Playlist (with submenu) */}
      <div
        className="relative"
        onMouseEnter={() => setShowPlaylistsSubmenu(true)}
        onMouseLeave={() => setShowPlaylistsSubmenu(false)}
      >
        <button
          onClick={() => setShowPlaylistsSubmenu((prev) => !prev)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Plus size={15} className="text-[#64748B] dark:text-white/70" />
            <span>Add to playlist</span>
          </div>
          <ChevronRight size={14} className="text-[#94A3B8] dark:text-white/40" />
        </button>

        {/* Submenu of playlists */}
        {showPlaylistsSubmenu && (
          <div
            className={`absolute top-0 ${
              coords.left + 256 + 220 > window.innerWidth - 10 ? 'right-full -mr-1' : 'left-full -ml-1'
            } w-52 py-1.5 rounded-2xl bg-white/95 dark:bg-[#0C0C10] backdrop-blur-3xl border border-white/95 dark:border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.8)] max-h-56 overflow-y-auto z-50`}
          >
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] dark:text-white/50">
              Playlists
            </div>
            {likedPlaylist && (
              <button
                onClick={() => handlePlaylistSelect('pl-liked')}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer text-rose-500 font-medium"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <Heart size={13} fill="currentColor" />
                  <span className="truncate">Liked Songs</span>
                </div>
                {(track.isLiked || addedPlaylistId === 'pl-liked') && (
                  <Check size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
              </button>
            )}
            {userPlaylists.length === 0 && !likedPlaylist ? (
              <div className="px-3 py-2 text-[11px] text-[#94A3B8] dark:text-white/50 italic">
                No playlists yet
              </div>
            ) : (
              userPlaylists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => handlePlaylistSelect(pl.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer text-[#0F172A] dark:text-white"
                >
                  <span className="truncate pr-2">{pl.title}</span>
                  {addedPlaylistId === pl.id && (
                    <Check size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Create Playlist with this track */}
      <button
        onClick={() => {
          onCreatePlaylistWithTrack(track);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left text-violet-700 dark:text-violet-400 font-semibold cursor-pointer"
      >
        <FolderPlus size={15} className="text-violet-600 dark:text-violet-400" />
        <span>Create playlist with this track</span>
      </button>

      <div className="h-px bg-black/[0.06] dark:bg-white/10 my-1" />

      {/* Download Options */}
      {dlStatus.status === 'completed' ? (
        <>
          <button
            onClick={() => {
              openDownloadedFile(track);
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left text-emerald-600 dark:text-emerald-400 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Check size={15} />
              <span>Show downloaded file</span>
            </div>
          </button>
          <button
            onClick={() => {
              useDownloadStore.getState().removeDownload(track);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-rose-500/10 text-rose-500 transition-colors text-left cursor-pointer"
          >
            <Trash2 size={15} />
            <span>Remove from downloads</span>
          </button>
        </>
      ) : dlStatus.status === 'downloading' ? (
        <>
          <div className="w-full flex items-center justify-between px-3 py-2 text-violet-600 dark:text-violet-400 font-semibold text-[11px]">
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin shrink-0" />
              <span>Downloading ({Math.round(dlStatus.progress)}%)</span>
            </div>
          </div>
          <button
            onClick={() => {
              useDownloadStore.getState().pauseTrack(track.id);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 text-amber-500 transition-colors text-left cursor-pointer"
          >
            <Pause size={14} />
            <span>Pause download</span>
          </button>
          <button
            onClick={() => {
              useDownloadStore.getState().cancelTrack(track.id);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-rose-500/10 text-rose-500 transition-colors text-left cursor-pointer"
          >
            <X size={14} />
            <span>Cancel download</span>
          </button>
        </>
      ) : dlStatus.status === 'queued' ? (
        <>
          <div className="w-full flex items-center justify-between px-3 py-2 text-violet-500 font-semibold text-[11px]">
            <div className="flex items-center gap-2">
              <Clock size={14} className="animate-pulse shrink-0" />
              <span>In download queue</span>
            </div>
          </div>
          <button
            onClick={() => {
              useDownloadStore.getState().pauseTrack(track.id);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 text-amber-500 transition-colors text-left cursor-pointer"
          >
            <Pause size={14} />
            <span>Pause download</span>
          </button>
          <button
            onClick={() => {
              useDownloadStore.getState().cancelTrack(track.id);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-rose-500/10 text-rose-500 transition-colors text-left cursor-pointer"
          >
            <X size={14} />
            <span>Cancel download</span>
          </button>
        </>
      ) : dlStatus.status === 'paused' ? (
        <>
          <div className="w-full flex items-center justify-between px-3 py-2 text-amber-500 font-semibold text-[11px]">
            <div className="flex items-center gap-2">
              <Pause size={14} className="shrink-0" />
              <span>Download paused</span>
            </div>
          </div>
          <button
            onClick={() => {
              useDownloadStore.getState().resumeTrack(track.id);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 text-emerald-500 transition-colors text-left cursor-pointer"
          >
            <Play size={14} fill="currentColor" />
            <span>Resume download</span>
          </button>
          <button
            onClick={() => {
              useDownloadStore.getState().cancelTrack(track.id);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-rose-500/10 text-rose-500 transition-colors text-left cursor-pointer"
          >
            <X size={14} />
            <span>Cancel download</span>
          </button>
        </>
      ) : (
        <button
          onClick={() => {
            startDownload(track, 'mp3');
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer"
        >
          <Download size={15} className="text-[#64748B] dark:text-white/70" />
          <span>Download MP3 (320 kbps)</span>
        </button>
      )}

      <div className="h-px bg-black/[0.06] dark:bg-white/10 my-1" />

      {/* Go to Artist */}
      {onSelectArtist &&
        track.artist &&
        !['song', 'video', 'ep', 'single', 'unknown', 'various artists'].includes(
          track.artist.toLowerCase().trim()
        ) && (
          <button
            onClick={() => {
              onSelectArtist(track.artist);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer"
          >
            <User size={15} className="text-[#64748B] dark:text-white/70" />
            <span>View artist ({track.artist})</span>
          </button>
        )}

      {/* Copy Share Code */}
      <button
        onClick={handleCopyShare}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer"
      >
        {copied ? (
          <>
            <Check size={15} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-emerald-600 dark:text-emerald-400">Copied to clipboard!</span>
          </>
        ) : (
          <>
            <Share2 size={15} className="text-[#64748B] dark:text-white/70" />
            <span>Copy track details</span>
          </>
        )}
      </button>
    </div>
  );
};
