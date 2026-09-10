import React from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import type { Playlist } from '../types';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  playlist: Playlist | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  playlist,
  onConfirm,
  onCancel,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen || !playlist) return null;

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white/90 dark:bg-[#0C0C10] backdrop-blur-3xl border border-white/95 dark:border-white/10 rounded-3xl w-full max-w-sm p-6 m-4 shadow-[0_20px_50px_rgba(0,0,0,0.18),inset_0_1px_2px_#FFFFFF] dark:shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-center flex flex-col items-center"
      >
        <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 shadow-xs">
          <Trash2 size={24} />
        </div>

        <h3 className="text-lg font-bold text-[#0F172A] dark:text-white mb-1">Delete Playlist?</h3>
        <p className="text-xs text-[#64748B] dark:text-white/60 leading-relaxed mb-6">
          Are you sure you want to delete <span className="font-semibold text-[#0F172A] dark:text-white">"{playlist.title}"</span>? This will permanently remove it from your library.
        </p>

        <div className="grid grid-cols-2 gap-3 w-full">
          <button
            onClick={onCancel}
            className="py-2.5 px-4 rounded-xl text-xs font-bold text-[#334155] dark:text-white bg-white dark:bg-white/10 hover:bg-slate-50 dark:hover:bg-white/20 border border-slate-200 dark:border-white/15 shadow-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 shadow-md transition-all cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
