import React, { useEffect, useRef, useState } from 'react';
import {
  Pin,
  PinOff,
  Share2,
  Trash2,
  Check,
  ListMusic,
} from 'lucide-react';
import type { Playlist } from '../types';

interface PlaylistContextMenuProps {
  playlist: Playlist;
  x: number;
  y: number;
  onClose: () => void;
  onPinToggle: (playlist: Playlist) => void;
  onShare: (playlist: Playlist) => void;
  onDelete?: (playlist: Playlist) => void;
}

export const PlaylistContextMenu: React.FC<PlaylistContextMenuProps> = ({
  playlist,
  x,
  y,
  onClose,
  onPinToggle,
  onShare,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [coords, setCoords] = useState({ top: y, left: x });

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = rect.height || 180;
    const dockHeight = 84 + 16;

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

  const isSystemPlaylist =
    playlist.id === 'pl-liked' ||
    playlist.id === 'pl-downloads' ||
    playlist.id === 'pl-cached';

  const handleShareClick = () => {
    onShare(playlist);
    setCopied(true);
    setTimeout(() => {
      onClose();
    }, 800);
  };

  return (
    <div
      ref={menuRef}
      id="playlist-context-menu"
      style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
      className="fixed z-[9999] w-56 py-1.5 rounded-2xl bg-white/92 dark:bg-[#0C0C10] backdrop-blur-3xl border border-white/95 dark:border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.8)] text-[#0F172A] dark:text-white text-xs font-medium select-none animate-in fade-in duration-75 ease-out"
    >
      {/* Playlist Header preview */}
      <div className="px-3 py-2 border-b border-black/[0.06] dark:border-white/10 mb-1">
        <p className="font-bold text-[13px] truncate text-[#0F172A] dark:text-white">
          {playlist.title}
        </p>
        <p className="text-[11px] text-[#64748B] dark:text-white/60 truncate">
          {playlist.type} {playlist.songCount ? `• ${playlist.songCount} songs` : ''}
        </p>
      </div>

      {/* Pin / Unpin */}
      <button
        onClick={() => {
          onPinToggle(playlist);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer"
      >
        {playlist.isPinned ? (
          <>
            <PinOff size={15} className="text-[#64748B] dark:text-white/70" />
            <span>Unpin from library</span>
          </>
        ) : (
          <>
            <Pin size={15} className="text-[#64748B] dark:text-white/70 rotate-45" />
            <span>Pin to library</span>
          </>
        )}
      </button>

      {/* Share / Copy code */}
      <button
        onClick={handleShareClick}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer"
      >
        {copied ? (
          <>
            <Check size={15} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-emerald-600 dark:text-emerald-400">Code copied!</span>
          </>
        ) : (
          <>
            <Share2 size={15} className="text-[#64748B] dark:text-white/70" />
            <span>Share (Copy code)</span>
          </>
        )}
      </button>

      {/* Delete option (Only for custom user playlists) */}
      {!isSystemPlaylist && onDelete && (
        <>
          <div className="h-px bg-black/[0.06] dark:bg-white/10 my-1" />
          <button
            onClick={() => {
              onDelete(playlist);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-rose-500/10 text-rose-500 transition-colors text-left cursor-pointer"
          >
            <Trash2 size={15} />
            <span>Delete playlist</span>
          </button>
        </>
      )}
    </div>
  );
};
