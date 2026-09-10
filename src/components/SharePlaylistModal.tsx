import React, { useState, useEffect } from 'react';
import { Share2, X, Copy, Check } from 'lucide-react';
import { generateShareCode } from '../services/shareCodeService';
import { Track } from '../types';

interface SharePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlistTitle: string;
  playlistCreator: string;
  tracks: Track[];
}

export const SharePlaylistModal: React.FC<SharePlaylistModalProps> = ({
  isOpen,
  onClose,
  playlistTitle,
  playlistCreator,
  tracks,
}) => {
  const [shareCode, setShareCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const code = generateShareCode(playlistTitle, playlistCreator, tracks);
      setShareCode(code);
    }
  }, [isOpen, playlistTitle, playlistCreator, tracks]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codePrefix = shareCode.substring(0, 4); // "OTO-"
  const codeBody = shareCode.substring(4);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/95 dark:bg-[#0C0C10] backdrop-blur-3xl border border-white/80 dark:border-white/10 rounded-3xl w-full max-w-lg flex flex-col p-6 m-4 relative shadow-[0_25px_60px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#0F172A] dark:bg-white rounded-2xl text-white dark:text-black shadow-md">
              <Share2 size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white leading-tight">Share Playlist</h2>
              <p className="text-xs text-[#64748B] dark:text-white/60">Generate a compact share code</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-5 p-4 rounded-2xl bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 shadow-xs">
          <h3 className="font-bold text-[#0F172A] dark:text-white text-base mb-0.5">{playlistTitle}</h3>
          <p className="text-xs text-[#64748B] dark:text-white/60">by {playlistCreator} • {tracks.length} tracks</p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between ml-1">
            <p className="text-xs font-bold text-[#64748B] dark:text-white/60 uppercase tracking-wider">
              Playlist Code
            </p>
            <button
              onClick={handleCopy}
              className="p-1.5 px-3 rounded-xl bg-[#0F172A] hover:bg-black dark:bg-white dark:hover:bg-white/90 text-white dark:text-black shadow-sm transition-all active:scale-95 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title="Copy to clipboard"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-white" />
                  <span className="font-bold">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
          <div className="w-full max-h-36 overflow-y-auto p-3.5 bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 rounded-2xl font-mono text-xs break-all select-all text-[#0F172A] dark:text-white shadow-inner">
            <span className="text-[#0F172A] dark:text-white font-bold mr-0.5">{codePrefix}</span>
            <span>{codeBody}</span>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full py-3.5 px-4 bg-[#0F172A] dark:bg-white dark:text-black hover:bg-black dark:hover:bg-white/90 active:scale-[0.99] text-white rounded-xl text-sm font-bold shadow-md transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
