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
import repo from '../db/repository';
import { useDownloadStore, IDLE_DOWNLOAD } from '../store/downloadStore';
import { usePlayerStore } from '../store/playerStore';
import { useToastStore } from '../store/toastStore';

interface TrackContextMenuProps {
  track: Track;
  selectedTracks?: Track[];
  x: number;
  y: number;
  playlists: Playlist[];
  currentPlaylistId?: string;
  onClose: () => void;
  onPlay: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => Promise<boolean> | Promise<void> | boolean | void;
  onRemoveFromPlaylist?: (playlistId: string, trackId: string) => void;
  onCreatePlaylistWithTrack: (track: Track) => void;
  onToggleLike: (trackId: string, track?: Track) => void;
  onSelectArtist?: (artist: string, source?: 'YT' | 'SC', browseId?: string) => void;
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
  selectedTracks,
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
  const [copied, setCopied] = useState(false);
  const [containingPlaylistIds, setContainingPlaylistIds] = useState<Set<string>>(new Set());

  const activeTracks = selectedTracks && selectedTracks.length > 1 ? selectedTracks : [track];
  const isMulti = activeTracks.length > 1;

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

  // Load playlists containing the track(s)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (!isMulti) {
          const ids = await repo.getPlaylistIdsForTrack(track.id);
          const set = new Set(ids);
          if (track.isLiked) {
            set.add('pl-liked');
          }
          if (isMounted) {
            setContainingPlaylistIds(set);
          }
        } else {
          // For multi-selection, query IDs for each track and keep ones that contain all
          const trackIds = activeTracks.map((t) => t.id);
          const allPlaylistIdsSets = await Promise.all(
            trackIds.map(async (id) => new Set(await repo.getPlaylistIdsForTrack(id)))
          );
          const common = new Set<string>();
          playlists.forEach((pl) => {
            const allContain = allPlaylistIdsSets.every((s) => s.has(pl.id));
            if (allContain) common.add(pl.id);
          });
          if (activeTracks.every((t) => t.isLiked)) {
            common.add('pl-liked');
          }
          if (isMounted) {
            setContainingPlaylistIds(common);
          }
        }
      } catch (err) {
        console.error('Failed to query containing playlists:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [track.id, track.isLiked, isMulti, activeTracks.length, playlists]);

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

  const handlePlaylistToggle = (playlistId: string) => {
    const pl = playlists.find((p) => p.id === playlistId);
    const plTitle = pl ? pl.title : 'Playlist';
    const isPresent = containingPlaylistIds.has(playlistId);

    if (isMulti) {
      if (isPresent) {
        if (onRemoveFromPlaylist) {
          activeTracks.forEach((t) => onRemoveFromPlaylist(playlistId, t.id));
        }
        setContainingPlaylistIds((prev) => {
          const next = new Set(prev);
          next.delete(playlistId);
          return next;
        });
        useToastStore
          .getState()
          .info('Removed from playlist', `Removed ${activeTracks.length} tracks from "${plTitle}".`);
      } else {
        (async () => {
          let anyAdded = false;
          for (const t of activeTracks) {
            const res = await onAddToPlaylist(playlistId, t);
            if (res !== false) anyAdded = true;
          }
          if (anyAdded) {
            setContainingPlaylistIds((prev) => {
              const next = new Set(prev);
              next.add(playlistId);
              return next;
            });
            useToastStore
              .getState()
              .success('Added to playlist', `Added tracks to "${plTitle}".`);
          }
        })();
      }
    } else {
      if (isPresent) {
        if (playlistId === 'pl-liked') {
          onToggleLike(track.id, track);
        } else if (onRemoveFromPlaylist) {
          onRemoveFromPlaylist(playlistId, track.id);
        }
        setContainingPlaylistIds((prev) => {
          const next = new Set(prev);
          next.delete(playlistId);
          return next;
        });
        useToastStore
          .getState()
          .info('Removed from playlist', `Removed "${track.title}" from "${plTitle}".`);
      } else {
        if (playlistId === 'pl-liked') {
          onToggleLike(track.id, track);
          setContainingPlaylistIds((prev) => {
            const next = new Set(prev);
            next.add(playlistId);
            return next;
          });
        } else {
          (async () => {
            const res = await onAddToPlaylist(playlistId, track);
            if (res !== false) {
              setContainingPlaylistIds((prev) => {
                const next = new Set(prev);
                next.add(playlistId);
                return next;
              });
              useToastStore
                .getState()
                .success('Added to playlist', `Added "${track.title}" to "${plTitle}".`);
            }
          })();
        }
      }
    }
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
      className="fixed z-[9999] w-64 py-1.5 rounded-2xl bg-white/92 dark:bg-black backdrop-blur-3xl border border-white/95 dark:border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.9)] text-[#0F172A] dark:text-white text-xs font-medium select-none native-context-menu"
    >
      {/* Track / Selection Header preview in menu */}
      <div className="px-3 py-2 border-b border-black/[0.06] dark:border-white/10 mb-1">
        <p className="font-bold text-[13px] truncate text-[#0F172A] dark:text-white">
          {isMulti ? `${activeTracks.length} tracks selected` : track.title}
        </p>
        <p className="text-[11px] text-[#64748B] dark:text-white/60 truncate">
          {isMulti ? 'Multiple selection' : track.artist}
        </p>
      </div>

      {/* Play Now / Play Selection */}
      <button
        onClick={() => {
          onPlay(track);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer"
      >
        <Play size={15} className="text-[#0F172A] dark:text-white fill-[#0F172A] dark:fill-white" />
        <span>{isMulti ? `Play selection (${activeTracks.length})` : 'Play now'}</span>
      </button>

      {/* Start Radio (Single track only) */}
      {!isMulti && (
        <button
          onClick={() => {
            usePlayerStore.getState().startTrackRadio(track);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer"
        >
          <Radio size={15} className="text-[#0F172A] dark:text-white" />
          <span>Start Radio</span>
        </button>
      )}

      {/* Like / Unlike */}
      <button
        onClick={() => {
          if (isMulti) {
            activeTracks.forEach((t) => onToggleLike(t.id, t));
            useToastStore
              .getState()
              .info('Liked Songs', `Updated ${activeTracks.length} tracks in Liked Songs.`);
          } else {
            onToggleLike(track.id, track);
          }
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer"
      >
        <Heart
          size={15}
          className={
            !isMulti && track.isLiked
              ? 'text-rose-500 fill-rose-500'
              : 'text-[#64748B] dark:text-white/70'
          }
        />
        <span>
          {isMulti
            ? `Save ${activeTracks.length} tracks to Liked Songs`
            : track.isLiked || isCurrentLikedSongs
            ? 'Remove from Liked Songs'
            : 'Save to Liked Songs'}
        </span>
      </button>

      {/* Remove from custom playlist if inside one */}
      {canRemoveFromCurrent && onRemoveFromPlaylist && (
        <button
          onClick={() => {
            if (isMulti) {
              activeTracks.forEach((t) => onRemoveFromPlaylist(currentPlaylistId!, t.id));
              useToastStore
                .getState()
                .info('Removed', `Removed ${activeTracks.length} tracks from this playlist.`);
            } else {
              onRemoveFromPlaylist(currentPlaylistId!, track.id);
            }
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-rose-500/10 text-rose-500 transition-colors text-left cursor-pointer"
        >
          <Trash2 size={15} />
          <span>{isMulti ? `Remove ${activeTracks.length} tracks from this playlist` : 'Remove from this playlist'}</span>
        </button>
      )}

      <div className="h-px bg-black/[0.06] dark:bg-white/10 my-1" />

      {/* Add to Playlist (with submenu and toggle checkmarks) */}
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
            <span>{isMulti ? `Add ${activeTracks.length} tracks to playlist` : 'Add to playlist'}</span>
          </div>
          <ChevronRight size={14} className="text-[#94A3B8] dark:text-white/40" />
        </button>

        {/* Submenu of playlists with toggle checkmarks */}
        {showPlaylistsSubmenu && (
          <div
            className={`absolute top-0 ${
              coords.left + 256 + 220 > window.innerWidth - 10 ? 'right-full -mr-1' : 'left-full -ml-1'
            } w-52 py-1.5 rounded-2xl bg-white/95 dark:bg-black backdrop-blur-3xl border border-white/95 dark:border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.9)] max-h-56 overflow-y-auto z-50`}
          >
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] dark:text-white/50">
              Playlists
            </div>
            {likedPlaylist && (
              <button
                onClick={() => handlePlaylistToggle('pl-liked')}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer text-rose-500 font-medium"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <Heart size={13} fill="currentColor" />
                  <span className="truncate">Liked Songs</span>
                </div>
                {containingPlaylistIds.has('pl-liked') && (
                  <Check size={14} className="text-[#0F172A] dark:text-white shrink-0" />
                )}
              </button>
            )}
            {userPlaylists.length === 0 && !likedPlaylist ? (
              <div className="px-3 py-2 text-[11px] text-[#94A3B8] dark:text-white/50 italic">
                No playlists yet
              </div>
            ) : (
              userPlaylists.map((pl) => {
                const isTrackInPl = containingPlaylistIds.has(pl.id);
                return (
                  <button
                    key={pl.id}
                    onClick={() => handlePlaylistToggle(pl.id)}
                    className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer text-[#0F172A] dark:text-white"
                  >
                    <span className="truncate pr-2">{pl.title}</span>
                    {isTrackInPl && (
                      <Check size={14} className="text-[#0F172A] dark:text-white shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Create Playlist with this track / selection */}
      <button
        onClick={() => {
          onCreatePlaylistWithTrack(track);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left text-[#0F172A] dark:text-white font-semibold cursor-pointer"
      >
        <FolderPlus size={15} className="text-[#0F172A] dark:text-white" />
        <span>{isMulti ? `Create playlist with ${activeTracks.length} tracks` : 'Create playlist with this track'}</span>
      </button>

      <div className="h-px bg-black/[0.06] dark:bg-white/10 my-1" />

      {/* Download Options */}
      {isMulti ? (
        <button
          onClick={() => {
            activeTracks.forEach((t) => startDownload(t, 'mp3'));
            useToastStore
              .getState()
              .info('Batch Download', `Queued ${activeTracks.length} tracks for download.`);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer"
        >
          <Download size={15} className="text-[#64748B] dark:text-white/70" />
          <span>Download {activeTracks.length} tracks (MP3 320 kbps)</span>
        </button>
      ) : dlStatus.status === 'completed' ? (
        <>
          <button
            onClick={() => {
              openDownloadedFile(track);
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left text-[#0F172A] dark:text-white font-medium cursor-pointer"
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
          <div className="w-full flex items-center justify-between px-3 py-2 text-[#0F172A] dark:text-white font-semibold text-[11px]">
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
          <div className="w-full flex items-center justify-between px-3 py-2 text-[#64748B] dark:text-white/70 font-semibold text-[11px]">
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
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 text-[#0F172A] dark:text-white font-medium transition-colors text-left cursor-pointer"
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

      {/* Go to Artist (Single track only) */}
      {!isMulti &&
        onSelectArtist &&
        track.artist &&
        !['song', 'video', 'ep', 'single', 'unknown', 'various artists'].includes(
          track.artist.toLowerCase().trim()
        ) && (
          <button
            onClick={() => {
              onSelectArtist(track.artist, track.source === 'SC' ? 'SC' : 'YT', track.artistBrowseId);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer"
          >
            <User size={15} className="text-[#64748B] dark:text-white/70" />
            <span>View artist ({track.artist})</span>
          </button>
        )}

      {/* Copy Share Code (Single track only) */}
      {!isMulti && (
        <button
          onClick={handleCopyShare}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer"
        >
          {copied ? (
            <>
              <Check size={15} className="text-[#0F172A] dark:text-white" />
              <span className="text-[#0F172A] dark:text-white font-bold">Copied to clipboard!</span>
            </>
          ) : (
            <>
              <Share2 size={15} className="text-[#64748B] dark:text-white/70" />
              <span>Copy track details</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};
