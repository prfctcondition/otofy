import React, { useEffect, useRef, useState } from 'react';
import {
  Pin,
  PinOff,
  Share2,
  Trash2,
  Check,
  Edit3,
} from 'lucide-react';
import { isSystemPlaylist, type Playlist } from '../types';
import { useContextMenuStore } from '../store/contextMenuStore';

interface PlaylistContextMenuProps {
  playlist: Playlist;
  x: number;
  y: number;
  onClose: () => void;
  onPinToggle: (playlist: Playlist) => void;
  onShare: (playlist: Playlist) => void;
  onDelete?: (playlist: Playlist) => void;
}

const getInitialCoords = (clickX: number, clickY: number, menuW = 224, menuH = 220) => {
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
  const [coords, setCoords] = useState(() => getInitialCoords(x, y, 224, 220));

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const menuWidth = 224;
    const menuHeight = rect.height || 220;
    const dockHeight = 90;

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

  const isSystem = isSystemPlaylist(playlist);

  const handleShareClick = () => {
    onShare(playlist);
    setCopied(true);
    setTimeout(() => {
      onClose();
    }, 800);
  };

  const handleEditDetails = () => {
    onClose();
    useContextMenuStore.getState().openEditPlaylist(playlist);
  };

  return (
    <div
      ref={menuRef}
      id="playlist-context-menu"
      style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
      className="fixed z-[9999] w-56 py-1.5 rounded-2xl bg-white/92 dark:bg-[#0C0C10] backdrop-blur-3xl border border-white/95 dark:border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.8)] text-[#0F172A] dark:text-white text-xs font-medium select-none native-context-menu"
    >
      {/* Playlist Header preview */}
      <div className="px-3 py-2 border-b border-black/[0.06] dark:border-white/10 mb-1">
        <p className="font-bold text-[13px] truncate text-[#0F172A] dark:text-white">
          {playlist.title}
        </p>
        <p className="text-[11px] text-[#64748B] dark:text-white/60 truncate">
          {playlist.type} {playlist.songCount ? ` · ${playlist.songCount} songs` : ''}
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

      {/* Edit details (Only for custom user playlists) */}
      {!isSystem && (
        <button
          onClick={handleEditDetails}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.05] dark:hover:bg-white/10 transition-colors text-left cursor-pointer"
        >
          <Edit3 size={15} className="text-[#64748B] dark:text-white/70" />
          <span>Edit details</span>
        </button>
      )}

      {/* Delete option (Only for custom user playlists, strictly forbidden for system playlists) */}
      {!isSystem && onDelete && (
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
