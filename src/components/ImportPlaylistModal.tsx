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
      setError('Please enter an Otofy share code.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/95 dark:bg-[#0C0C10] backdrop-blur-3xl border border-white/80 dark:border-white/10 rounded-3xl w-full max-w-lg flex flex-col p-6 m-4 relative shadow-[0_25px_60px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl text-white shadow-md">
              <Download size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white leading-tight">Import Playlist</h2>
              <p className="text-xs text-[#64748B] dark:text-white/60">Paste an Otofy playlist share code</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#64748B] dark:text-white/60 uppercase tracking-wider mb-1.5 ml-1">
              Playlist Share Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="Paste code here (e.g. OTO-xxxx-xxxx)"
                className="flex-1 px-4 py-3 bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-white/[0.1] focus:border-emerald-500 rounded-xl focus:outline-none text-xs font-mono text-[#0F172A] dark:text-white placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-white/40 shadow-xs transition-all"
                autoFocus
              />
              <button
                onClick={handleParse}
                className="px-5 py-3 bg-[#0F172A] dark:bg-white dark:text-black hover:bg-black dark:hover:bg-white/90 text-white rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer"
              >
                Inspect
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3 rounded-xl text-xs font-medium">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {parsedData && (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-[#0F172A] dark:text-white text-sm">{parsedData.title}</h4>
                  <p className="text-xs text-[#64748B] dark:text-white/60">
                    by {parsedData.creator} • {parsedData.tracks.length} tracks
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                  Ready to import
                </span>
              </div>

              {/* Tracks preview list */}
              <div className="max-h-32 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.06] text-xs pr-1">
                {parsedData.tracks.slice(0, 10).map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[#334155] dark:text-white/80 py-0.5">
                    <span className="truncate max-w-[280px]">
                      <span className="text-[#94A3B8] dark:text-white/50 font-mono mr-1.5">{idx + 1}.</span>
                      {t.title} – <span className="text-[#64748B] dark:text-white/60">{t.artist}</span>
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono font-bold text-[#64748B] dark:text-white/80 border border-slate-200 dark:border-white/10">
                      {t.duration || '0:00'}
                    </span>
                  </div>
                ))}
                {parsedData.tracks.length > 10 && (
                  <div className="text-[11px] text-[#94A3B8] dark:text-white/50 italic pt-1">
                    ...and {parsedData.tracks.length - 10} more tracks
                  </div>
                )}
              </div>

              <button
                onClick={handleImport}
                disabled={isImporting}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
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
