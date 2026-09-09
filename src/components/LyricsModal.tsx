import React, { useEffect, useState, useRef } from 'react';
import { Mic2, X, Music, Search, Sparkles, RefreshCw } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { getTrackLyrics, parseLrc, type LyricsResult, type LrcLine } from '../services/lyricsService';
import { PlaceholderArtwork } from './PlaceholderArtwork';

interface LyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LyricsModal: React.FC<LyricsModalProps> = ({ isOpen, onClose }) => {
  const activeTrack = usePlayerStore((s) => s.activeTrack);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const seek = usePlayerStore((s) => s.seek);

  const [lyricsData, setLyricsData] = useState<LyricsResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [customSearch, setCustomSearch] = useState<string>('');
  const [activeLineIndex, setActiveLineIndex] = useState<number>(-1);

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Fetch lyrics when active track changes or modal opens
  useEffect(() => {
    if (!isOpen || !activeTrack) return;

    let isMounted = true;
    setIsLoading(true);
    setLyricsData(null);
    setActiveLineIndex(-1);

    getTrackLyrics(activeTrack.title, activeTrack.artist, activeTrack.durationSec).then((data) => {
      if (!isMounted) return;
      setLyricsData(data);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeTrack?.id]);

  // Compute active lyric line based on currentTime
  useEffect(() => {
    if (!lyricsData?.parsedLines || lyricsData.parsedLines.length === 0) return;

    const lines = lyricsData.parsedLines;
    let currentIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      if (currentTime >= lines[i].time) {
        currentIdx = i;
      } else {
        break;
      }
    }

    if (currentIdx !== activeLineIndex) {
      setActiveLineIndex(currentIdx);
    }
  }, [currentTime, lyricsData, activeLineIndex]);

  // Smooth scroll to active line
  useEffect(() => {
    if (activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex]);

  const handleManualSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customSearch.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(customSearch.trim())}`);
      if (res.ok) {
        const candidates = await res.json();
        if (Array.isArray(candidates) && candidates.length > 0) {
          const best = candidates.find((c: any) => c.syncedLyrics) || candidates.find((c: any) => c.plainLyrics) || candidates[0];
          const lines = best.syncedLyrics ? parseLrc(best.syncedLyrics) : undefined;
          setLyricsData({
            trackName: best.trackName,
            artistName: best.artistName,
            duration: best.duration,
            instrumental: !!best.instrumental,
            plainLyrics: best.plainLyrics,
            syncedLyrics: best.syncedLyrics,
            parsedLines: lines,
          });
        } else {
          setLyricsData(null);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <div
        id="lyrics-modal-container"
        className="bg-white/94 backdrop-blur-3xl border border-white rounded-3xl w-full max-w-2xl h-[82vh] flex flex-col p-6 m-4 relative shadow-[0_25px_60px_rgba(0,0,0,0.18),inset_0_1px_2px_#FFFFFF] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {activeTrack && (
              <PlaceholderArtwork
                icon={activeTrack.iconName}
                imageUrl={activeTrack.artworkUrl}
                gradientFrom={activeTrack.gradientFrom}
                gradientTo={activeTrack.gradientTo}
                size={48}
                rounded="rounded-xl"
                className="shadow-sm border border-slate-200 shrink-0"
              />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#0F172A] truncate">
                  {activeTrack?.title || 'No track selected'}
                </h3>
                {activeTrack?.sourceLabel && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-[#64748B] border border-slate-200">
                    {activeTrack.sourceLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#64748B] truncate">
                {activeTrack?.artist || 'Unknown Artist'}
                {lyricsData?.syncedLyrics && (
                  <span className="ml-2 inline-flex items-center gap-1 text-violet-600 font-semibold">
                    <Sparkles size={11} /> Synchronized
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 rounded-full transition-colors shrink-0"
            title="Close lyrics"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto py-6 px-4 space-y-3 relative select-text"
        >
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-[#64748B]">
              <RefreshCw size={24} className="animate-spin text-violet-600" />
              <p className="text-xs font-semibold">Fetching lyrics from LRCLIB...</p>
            </div>
          ) : !activeTrack ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-[#64748B]">
              <Mic2 size={36} className="text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-[#0F172A]">Play a track to view lyrics</p>
            </div>
          ) : lyricsData?.instrumental ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-[#64748B] gap-2">
              <div className="w-14 h-14 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shadow-inner">
                <Music size={26} />
              </div>
              <h4 className="text-lg font-bold text-[#0F172A]">♪ Instrumental ♪</h4>
              <p className="text-xs text-[#64748B]">This song has no vocal lyrics. Enjoy the music!</p>
            </div>
          ) : lyricsData?.parsedLines && lyricsData.parsedLines.length > 0 ? (
            /* Synchronized Karaoke Lyrics */
            <div className="space-y-4 py-8">
              {lyricsData.parsedLines.map((line: LrcLine, idx: number) => {
                const isActive = idx === activeLineIndex;
                const isPast = idx < activeLineIndex;

                return (
                  <div
                    key={idx}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => seek(line.time)}
                    className={`cursor-pointer transition-all duration-200 rounded-xl px-4 py-2 ${
                      isActive
                        ? 'bg-gradient-to-r from-violet-500/15 via-purple-500/10 to-transparent border-l-4 border-violet-600 text-violet-950 font-black text-xl scale-[1.01] shadow-xs'
                        : isPast
                        ? 'text-[#64748B] font-medium text-base hover:text-[#0F172A] hover:bg-slate-100/60'
                        : 'text-[#94A3B8] font-medium text-base hover:text-[#0F172A] hover:bg-slate-100/60'
                    }`}
                  >
                    <span>{line.text}</span>
                  </div>
                );
              })}
            </div>
          ) : lyricsData?.plainLyrics ? (
            /* Plain Text Lyrics */
            <div className="space-y-3 py-4 max-w-lg mx-auto">
              {lyricsData.plainLyrics.split('\n').map((line, idx) => (
                <p key={idx} className="text-[#0F172A] font-medium text-base leading-relaxed">
                  {line || <br />}
                </p>
              ))}
            </div>
          ) : (
            /* Not Found + Manual Search */
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto py-8">
              <Mic2 size={36} className="text-slate-300 mb-3" />
              <h4 className="text-base font-bold text-[#0F172A] mb-1">No lyrics found</h4>
              <p className="text-xs text-[#64748B] mb-5">
                We couldn't automatically find lyrics for "{activeTrack.title}". Try searching with a different keyword:
              </p>

              <form onSubmit={handleManualSearch} className="flex gap-2 w-full">
                <input
                  type="text"
                  value={customSearch}
                  onChange={(e) => setCustomSearch(e.target.value)}
                  placeholder="Song name or artist..."
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-violet-500 focus:bg-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0F172A] hover:bg-black text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Search size={13} />
                  <span>Search</span>
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer info note */}
        <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-[#94A3B8] shrink-0">
          <span>Synced lyrics powered by LRCLIB API</span>
          <span>Click any line to jump to that moment</span>
        </div>
      </div>
    </div>
  );
};
