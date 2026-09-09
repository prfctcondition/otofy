import React, { useState } from 'react';
import { Download, X, AlertCircle, CheckCircle2, Music } from 'lucide-react';
import { parseShareCode } from '../services/shareCodeService';
import { useLibraryStore } from '../store/libraryStore';
import type { Track, ShareCodeData } from '../types';

interface ImportPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportPlaylistModal: React.FC<ImportPlaylistModalProps> = ({ isOpen, onClose }) => {
  const [inputCode, setInputCode] = useState('');
  const [parsedData, setParsedData] = useState<ShareCodeData | null>(null);
  const [error, setError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [success, setSuccess] = useState(false);
  const createPlaylist = useLibraryStore((state) => state.createPlaylist);
  const addTrackToPlaylist = useLibraryStore((state) => state.addTrackToPlaylist);
  const selectPlaylist = useLibraryStore((state) => state.selectPlaylist);

  if (!isOpen) return null;

  const handleParse = () => {
    setError('');
    setParsedData(null);
    setSuccess(false);

    const clean = inputCode.trim();
    if (!clean) {
      setError('Please enter a ZEN share code.');
      return;
    }

    try {
      const data = parseShareCode(clean);
      if (data && data.title && Array.isArray(data.tracks)) {
        setParsedData(data);
      } else {
        setError('Invalid or corrupted share code.');
      }
    } catch {
      setError('Failed to parse share code. Make sure it was copied accurately.');
    }
  };

  const handleImport = async () => {
    if (!parsedData) return;
    setIsImporting(true);

    try {
      const newPlaylist = await createPlaylist({
        title: parsedData.title,
        creator: parsedData.creator || 'Imported User',
        gradientFrom: '#4F46E5',
        gradientTo: '#9333EA',
        iconName: 'disc',
      });

      for (let i = 0; i < parsedData.tracks.length; i++) {
        const item = parsedData.tracks[i];
        const durSec = item.durationSec || 180;
        const mins = Math.floor(durSec / 60);
        const secs = Math.floor(durSec % 60);
        const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;

        const track: Track = {
          id: `imp-${Date.now()}-${i}-${item.sourceId || Math.random().toString(36).slice(2, 7)}`,
          number: i + 1,
          title: item.title,
          artist: item.artist,
          album: parsedData.title,
          duration: durationStr,
          durationSec: durSec,
          dateAdded: 'Just now',
          source: item.source,
          sourceLabel: item.source === 'YT' ? 'YouTube Music' : 'SoundCloud',
          sourceId: item.sourceId,
          iconName: 'music',
          gradientFrom: '#1E293B',
          gradientTo: '#0F172A',
          isLiked: false,
          artworkUrl:
            item.source === 'YT'
              ? `https://i.ytimg.com/vi/${item.sourceId}/hqdefault.jpg`
              : undefined,
        };

        await addTrackToPlaylist(newPlaylist.id, track);
      }

      setSuccess(true);
      await selectPlaylist(newPlaylist.id);

      setTimeout(() => {
        onClose();
        setInputCode('');
        setParsedData(null);
        setSuccess(false);
      }, 1200);
    } catch (err) {
      console.error('[Import] Error:', err);
      setError('An error occurred while importing the playlist.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setInputCode('');
    setParsedData(null);
    setError('');
    setSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/92 backdrop-blur-3xl border border-white rounded-3xl w-full max-w-lg flex flex-col p-6 m-4 relative shadow-[0_25px_60px_rgba(0,0,0,0.18),inset_0_1px_2px_#FFFFFF]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl text-white shadow-md">
              <Download size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#0F172A] leading-tight">Import Playlist</h2>
              <p className="text-xs text-[#64748B]">Paste a CS2-style crosshair share code</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5 ml-1">
              Share Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="ZEN-xxxx-xxxx-xxxx-xxxx"
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 rounded-xl focus:outline-none text-sm font-mono text-[#0F172A] placeholder:text-slate-400 shadow-xs transition-all"
              />
              <button
                onClick={handleParse}
                className="px-5 py-3 bg-[#0F172A] hover:bg-black text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
              >
                Inspect
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs font-medium">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {parsedData && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-base text-[#0F172A]">{parsedData.title}</h4>
                  <p className="text-xs text-[#64748B]">
                    Created by {parsedData.creator} • {parsedData.tracks.length} tracks
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 shadow-xs">
                  <Music size={18} />
                </div>
              </div>

              {/* Track preview list */}
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 border-t border-slate-100 pt-2 text-xs">
                {parsedData.tracks.slice(0, 5).map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[#334155] py-0.5">
                    <span className="truncate pr-2">
                      <span className="text-[#94A3B8] font-mono mr-1.5">{idx + 1}.</span>
                      {t.title} – <span className="text-[#64748B]">{t.artist}</span>
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-mono font-bold text-[#64748B] border border-slate-200">
                      {t.source}
                    </span>
                  </div>
                ))}
                {parsedData.tracks.length > 5 && (
                  <div className="text-[11px] text-[#94A3B8] italic pt-1">
                    + {parsedData.tracks.length - 5} more tracks...
                  </div>
                )}
              </div>

              <button
                onClick={handleImport}
                disabled={isImporting}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2"
              >
                {isImporting ? (
                  <span>Importing into library...</span>
                ) : success ? (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Imported Successfully!</span>
                  </>
                ) : (
                  <span>Import Playlist ({parsedData.tracks.length} tracks)</span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
