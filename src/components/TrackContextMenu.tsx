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
} from 'lucide-react';
import { Track, Playlist } from '../types';

interface TrackContextMenuProps {
  track: Track;
  x: number;
  y: number;
  playlists: Playlist[];
  onClose: () => void;
  onPlay: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  onCreatePlaylistWithTrack: (track: Track) => void;
  onToggleLike: (trackId: string, track?: Track) => void;
  onSelectArtist?: (artist: string) => void;
}

export const TrackContextMenu: React.FC<TrackContextMenuProps> = ({
  track,
  x,
  y,
  playlists,
  onClose,
  onPlay,
  onAddToPlaylist,
  onCreatePlaylistWithTrack,
  onToggleLike,
  onSelectArtist,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showPlaylistsSubmenu, setShowPlaylistsSubmenu] = useState(false);
  const [addedPlaylistId, setAddedPlaylistId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Position clamping to prevent overflowing outside the screen
  const [coords, setCoords] = useState({ top: y, left: x });

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const menuWidth = 240;
    const menuHeight = rect.height || 280;
    const dockHeight = 84 + 16; // player bar + margins

    let left = x;
    let top = y;

    if (left + menuWidth > window.innerWidth - 10) {
      left = Math.max(10, window.innerWidth - menuWidth - 10);
    }
    if (top + menuHeight > window.innerHeight - dockHeight) {
      top = Math.max(10, y - menuHeight);
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

    const handleScroll = () => {
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

  const userPlaylists = playlists.filter((p) => p.id !== 'pl-liked');

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
      className="fixed z-50 w-60 py-1.5 rounded-2xl bg-white/92 backdrop-blur-3xl border border-white/95 shadow-[0_15px_40px_rgba(0,0,0,0.18)] text-[#0F172A] text-xs font-medium select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Track Header preview in menu */}
      <div className="px-3 py-2 border-b border-black/[0.06] mb-1">
        <p className="font-bold text-[13px] truncate text-[#0F172A]">{track.title}</p>
        <p className="text-[11px] text-[#64748B] truncate">{track.artist}</p>
      </div>

      {/* Play Now */}
      <button
        onClick={() => {
          onPlay(track);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] transition-colors text-left"
      >
        <Play size={15} className="text-violet-600 fill-violet-600" />
        <span>Play now</span>
      </button>

      {/* Like / Unlike */}
      <button
        onClick={() => {
          onToggleLike(track.id, track);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] transition-colors text-left"
      >
        <Heart
          size={15}
          className={track.isLiked ? 'text-rose-500 fill-rose-500' : 'text-[#64748B]'}
        />
        <span>{track.isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}</span>
      </button>

      <div className="h-px bg-black/[0.06] my-1" />

      {/* Add to Playlist (with submenu) */}
      <div
        className="relative"
        onMouseEnter={() => setShowPlaylistsSubmenu(true)}
        onMouseLeave={() => setShowPlaylistsSubmenu(false)}
      >
        <button
          onClick={() => setShowPlaylistsSubmenu((prev) => !prev)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-black/[0.05] transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <Plus size={15} className="text-[#64748B]" />
            <span>Add to playlist</span>
          </div>
          <ChevronRight size={14} className="text-[#94A3B8]" />
        </button>

        {/* Submenu of user playlists */}
        {showPlaylistsSubmenu && (
          <div
            className={`absolute top-0 ${
              coords.left + 240 + 215 > window.innerWidth - 10 ? 'right-full -mr-1' : 'left-full -ml-1'
            } w-52 py-1.5 rounded-2xl bg-white/95 backdrop-blur-3xl border border-white/95 shadow-[0_15px_40px_rgba(0,0,0,0.18)] max-h-56 overflow-y-auto z-50`}
          >
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Your Playlists
            </div>
            {userPlaylists.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-[#94A3B8] italic">
                No custom playlists yet
              </div>
            ) : (
              userPlaylists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => handlePlaylistSelect(pl.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-black/[0.05] transition-colors text-left"
                >
                  <span className="truncate pr-2">{pl.title}</span>
                  {addedPlaylistId === pl.id && (
                    <Check size={14} className="text-emerald-600 shrink-0" />
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
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] transition-colors text-left text-violet-700 font-semibold"
      >
        <FolderPlus size={15} className="text-violet-600" />
        <span>Create playlist with this track</span>
      </button>

      <div className="h-px bg-black/[0.06] my-1" />

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
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] transition-colors text-left"
          >
            <User size={15} className="text-[#64748B]" />
            <span>View artist ({track.artist})</span>
          </button>
        )}

      {/* Copy Share Code */}
      <button
        onClick={handleCopyShare}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] transition-colors text-left"
      >
        {copied ? (
          <>
            <Check size={15} className="text-emerald-600" />
            <span className="text-emerald-600">Copied to clipboard!</span>
          </>
        ) : (
          <>
            <Share2 size={15} className="text-[#64748B]" />
            <span>Copy track details</span>
          </>
        )}
      </button>
    </div>
  );
};
