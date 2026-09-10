import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, HelpCircle, Play, Pause, Check, Music } from 'lucide-react';
import type { Track, TrackAlternative } from '../types';
import { useLibraryStore } from '../store/libraryStore';
import { usePlayerStore } from '../store/playerStore';
import audioEngine from '../audio/AudioEngine';

interface TrackConflictModalProps {
  isOpen: boolean;
  track: Track | null;
  onClose: () => void;
}

export const TrackConflictModal: React.FC<TrackConflictModalProps> = ({ isOpen, track, onClose }) => {
  const resolveTrack = useLibraryStore((state) => state.resolveTrack);
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const stopPreview = () => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current = null;
    }
    setPlayingPreviewId(null);
  };

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, []);

  if (!isOpen || !track) return null;

  const alternatives: TrackAlternative[] = track.alternatives || [];

  const handleTogglePreview = (id: string, previewUrl?: string, ytSourceId?: string) => {
    // If clicking currently playing preview, pause/stop it
    if (playingPreviewId === id) {
      stopPreview();
      return;
    }

    // Stop existing preview
    stopPreview();

    // ALWAYS pause master player if it is currently playing
    const playerStore = usePlayerStore.getState();
    if (playerStore.isPlaying) {
      audioEngine.pause();
      playerStore.setIsPlaying(false);
    }

    if (previewUrl) {
      const audio = new Audio(previewUrl);
      audio.volume = 0.8;
      audio.onended = () => setPlayingPreviewId(null);
      audio.onerror = () => setPlayingPreviewId(null);
      audio.play().catch(() => setPlayingPreviewId(null));
      audioPreviewRef.current = audio;
      setPlayingPreviewId(id);
    } else if (ytSourceId && window.electronAPI?.resolveStream) {
      setPlayingPreviewId(id);
      window.electronAPI
        .resolveStream(ytSourceId, 'YT', track.title, track.artist)
        .then((info) => {
          if (info?.url) {
            const audio = new Audio(info.url);
            audio.volume = 0.8;
            audio.onended = () => setPlayingPreviewId(null);
            audio.onerror = () => setPlayingPreviewId(null);
            audio.play().catch(() => setPlayingPreviewId(null));
            audioPreviewRef.current = audio;
          } else {
            setPlayingPreviewId(null);
          }
        })
        .catch(() => setPlayingPreviewId(null));
    }
  };

  const handleSelectAlternative = async (alt: TrackAlternative) => {
    stopPreview();
    await resolveTrack(track.id, alt);
    onClose();
  };

  const handleClose = () => {
    stopPreview();
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="bg-white/95 dark:bg-[#0C0C10] backdrop-blur-3xl border border-white/80 dark:border-white/10 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - shrink-0 */}
        <div className="flex items-center justify-between p-6 pb-4 shrink-0 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-2xl shadow-xs">
              <HelpCircle size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0F172A] dark:text-white leading-tight">Resolve Track Match</h2>
              <p className="text-xs text-[#64748B] dark:text-white/60">
                Duration difference exceeded 10 seconds. Pick the best matching candidate.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Original Target Track Banner - shrink-0 */}
        <div className="p-4 px-6 shrink-0 bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5">
          <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 font-bold">
                <Music size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Original Track (Target)
                </div>
                <div className="text-sm font-bold text-[#0F172A] dark:text-white truncate">
                  {track.title}
                </div>
                <div className="text-xs text-[#64748B] dark:text-white/70 truncate">
                  {track.artist} • <span className="font-mono">{track.duration}</span>
                </div>
              </div>
            </div>

            {track.originalSpotifyPreview && (
              <button
                onClick={() => handleTogglePreview('spotify-orig', track.originalSpotifyPreview)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold transition-all cursor-pointer shrink-0"
                title="Listen to 30-sec official Spotify preview"
              >
                {playingPreviewId === 'spotify-orig' ? <Pause size={14} /> : <Play size={14} />}
                <span>Preview</span>
              </button>
            )}
          </div>
        </div>

        {/* Candidates List - flex-1 overflow-y-auto pr-1 min-h-0 */}
        <div className="flex-1 overflow-y-auto px-6 pr-4 py-4 min-h-0 space-y-2">
          <div className="text-xs font-bold text-[#64748B] dark:text-white/60 uppercase tracking-wider px-1 mb-2">
            Found Candidates from YouTube Music
          </div>

          {alternatives.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#64748B] dark:text-white/50 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
              No automatic candidates were found for this track.
            </div>
          ) : (
            alternatives.map((alt, idx) => {
              const diffSec = Math.abs(alt.durationSec - track.durationSec);
              const sign = alt.durationSec >= track.durationSec ? '+' : '-';
              const isPlaying = playingPreviewId === alt.id;

              return (
                <div
                  key={alt.id || idx}
                  className="p-3 rounded-2xl bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={alt.artworkUrl || `https://i.ytimg.com/vi/${alt.sourceId}/hqdefault.jpg`}
                      alt={alt.title}
                      className="w-11 h-11 rounded-xl object-cover shrink-0 bg-slate-100 dark:bg-white/10 shadow-xs"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
                        {alt.title}
                      </div>
                      <div className="text-[11px] text-[#64748B] dark:text-white/70 truncate">
                        {alt.artist}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono font-bold text-[#64748B] dark:text-white/70 bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                          {alt.duration}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            diffSec <= 10
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {sign}{diffSec}s difference
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleTogglePreview(alt.id, undefined, alt.sourceId)}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-[#0F172A] dark:text-white transition-colors cursor-pointer"
                      title={isPlaying ? 'Pause preview' : 'Play preview'}
                    >
                      {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                    <button
                      onClick={() => handleSelectAlternative(alt)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F172A] dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-white/90 text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      <Check size={14} strokeWidth={2.5} />
                      <span>Select</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info - shrink-0 */}
        <div className="p-4 px-6 shrink-0 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-[11px] text-[#64748B] dark:text-white/60 bg-slate-50/50 dark:bg-white/[0.02]">
          <span>Selecting a candidate will link this track and enable playback.</span>
          <button
            onClick={handleClose}
            className="hover:underline text-[#0F172A] dark:text-white font-semibold cursor-pointer"
          >
            Decide Later
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
