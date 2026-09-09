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

  const codePrefix = shareCode.substring(0, 4); // "ZEN-"
  const codeBody = shareCode.substring(4);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/92 backdrop-blur-3xl border border-white rounded-3xl w-full max-w-lg flex flex-col p-6 m-4 relative shadow-[0_25px_60px_rgba(0,0,0,0.18),inset_0_1px_2px_#FFFFFF]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl text-white shadow-md">
              <Share2 size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#0F172A] leading-tight">Share Playlist</h2>
              <p className="text-xs text-[#64748B]">Generate a lightweight crosshair share code</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-5 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <h3 className="font-bold text-[#0F172A] text-base mb-0.5">{playlistTitle}</h3>
          <p className="text-xs text-[#64748B]">by {playlistCreator} • {tracks.length} tracks</p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider ml-1">
            Playlist Code
          </p>
          <div className="relative group">
            <div className="w-full p-3.5 pr-14 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-sm break-all select-all flex items-center text-[#0F172A] shadow-xs">
              <span className="text-violet-600 font-bold mr-1">{codePrefix}</span>
              <span>{codeBody}</span>
            </div>
            <button
              onClick={handleCopy}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-white hover:bg-slate-50 text-[#0F172A] border border-slate-200 shadow-sm transition-all active:scale-95 flex items-center gap-1 text-xs font-semibold"
              title="Copy to clipboard"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-600" />
                  <span className="text-emerald-600 font-bold">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full py-3.5 px-4 bg-[#0F172A] hover:bg-black active:scale-[0.99] text-white rounded-xl text-sm font-bold shadow-md transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
