import React, { useEffect, useState, useRef } from 'react';
import { Mic2, X, Music, Search, Sparkles, RefreshCw, Check, ArrowLeft } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import {
  getTrackLyrics,
  parseLrc,
  extractArtistAndTitle,
  searchLyricsCandidates,
  type LyricsResult,
  type LrcLine,
} from '../services/lyricsService';
import { PlaceholderArtwork } from './PlaceholderArtwork';

interface LyricsPanelProps {
  onClose: () => void;
}

export const LyricsPanel: React.FC<LyricsPanelProps> = ({ onClose }) => {
  const activeTrack = usePlayerStore((s) => s.activeTrack);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const seek = usePlayerStore((s) => s.seek);

  const [lyricsData, setLyricsData] = useState<LyricsResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [customSearch, setCustomSearch] = useState<string>('');
  const [candidates, setCandidates] = useState<LyricsResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [activeLineIndex, setActiveLineIndex] = useState<number>(-1);

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeTrack) {
      setLyricsData(null);
      setCustomSearch('');
      setCandidates([]);
      setIsSearching(false);
      return;
    }

    const { title: cleanT, artist: cleanA } = extractArtistAndTitle(
      activeTrack.title,
      activeTrack.artist
    );
    const defaultSearch = cleanA ? `${cleanT} ${cleanA}` : cleanT;
    setCustomSearch(defaultSearch);
    setCandidates([]);
    setIsSearching(false);

    let isMounted = true;
    setIsLoading(true);
    setLyricsData(null);
    setActiveLineIndex(-1);

    getTrackLyrics(
      activeTrack.title,
      activeTrack.artist,
      activeTrack.durationSec,
      activeTrack.sourceId || activeTrack.id
    ).then((data) => {
      if (!isMounted) return;
      setLyricsData(data);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [activeTrack?.id, activeTrack?.title, activeTrack?.artist]);

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
      const results = await searchLyricsCandidates(customSearch.trim());
      if (results.length === 1) {
        setLyricsData(results[0]);
        setCandidates([]);
        setIsSearching(false);
      } else {
        setCandidates(results);
        setIsSearching(true);
      }
    } catch {
      setCandidates([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCandidate = (cand: LyricsResult) => {
    setLyricsData(cand);
    setCandidates([]);
    setIsSearching(false);
  };

  return (
    <aside
      id="lyrics-panel"
      className="w-[320px] min-w-[320px] h-full flex flex-col liquid-glass-panel dark:bg-[#08080C]/90 dark:border-white/10 rounded-2xl select-none overflow-hidden relative shadow-lg"
    >
      {/* Top Gloss Reflection */}
      <div className="pointer-events-none absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-white/70 dark:from-white/5 to-transparent" />

      {/* Header */}
      <div className="p-3.5 flex items-center justify-between border-b border-black/[0.05] dark:border-white/10 relative z-10 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          {activeTrack ? (
            <PlaceholderArtwork
              icon={activeTrack.iconName}
              imageUrl={activeTrack.artworkUrl}
              gradientFrom={activeTrack.gradientFrom}
              gradientTo={activeTrack.gradientTo}
              size={32}
              rounded="rounded-lg"
              className="shadow-xs border border-white dark:border-white/10 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/10 text-[#0F172A] dark:text-white flex items-center justify-center shrink-0">
              <Mic2 size={16} />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-[#0F172A] dark:text-white truncate flex items-center gap-1.5">
              <span>Lyrics</span>
              {lyricsData?.syncedLyrics && !isSearching && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-black/5 dark:bg-white/10 text-[#0F172A] dark:text-white flex items-center gap-0.5">
                  <Sparkles size={9} /> Synced
                </span>
              )}
            </h3>
            <p className="text-[11px] text-[#64748B] dark:text-white/60 truncate">
              {activeTrack?.title || 'No active track'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsSearching((prev) => !prev)}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isSearching
                ? 'bg-[#0F172A] dark:bg-white text-white dark:text-black shadow-xs'
                : 'text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10'
            }`}
            title={isSearching ? 'Back to lyrics' : 'Search alternative lyrics'}
            aria-label="Search lyrics"
          >
            {isSearching ? <ArrowLeft size={16} /> : <Search size={16} />}
          </button>
          <button
            id="close-lyrics-panel-btn"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Close lyrics"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Manual Search Bar if isSearching or lyrics not found */}
      {isSearching && (
        <div className="p-3 border-b border-black/[0.05] dark:border-white/10 bg-white/50 dark:bg-white/[0.04] backdrop-blur-md relative z-10 shrink-0">
          <form onSubmit={handleManualSearch} className="flex gap-1.5">
            <input
              type="text"
              value={customSearch}
              onChange={(e) => setCustomSearch(e.target.value)}
              placeholder="Track or artist..."
              className="flex-1 px-2.5 py-1.5 bg-white dark:bg-white/[0.08] border border-slate-200 dark:border-white/15 rounded-lg text-xs text-[#0F172A] dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none focus:border-black/30 dark:focus:border-white/40 shadow-2xs"
              autoFocus
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-3 py-1.5 bg-[#0F172A] hover:bg-black dark:bg-white/15 dark:hover:bg-white/25 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
            </button>
          </form>
        </div>
      )}

      {/* Lyrics Scrollable Content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 relative z-10 select-text"
      >
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-[#64748B] dark:text-white/60 py-16">
            <RefreshCw size={22} className="animate-spin text-[#0F172A] dark:text-white" />
            <p className="text-xs font-semibold">Searching lyrics...</p>
          </div>
        ) : isSearching && candidates.length > 0 ? (
          /* Candidates selection list */
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-[#64748B] dark:text-white/60 uppercase tracking-wider px-1">
              Select lyrics candidate:
            </p>
            {candidates.map((cand, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectCandidate(cand)}
                className="w-full text-left p-2.5 rounded-xl bg-white/60 dark:bg-white/[0.04] hover:bg-black/5 dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 transition-all flex items-center justify-between gap-2 shadow-2xs group cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate group-hover:text-black dark:group-hover:text-white">
                    {cand.trackName}
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-white/60 truncate">{cand.artistName}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {cand.syncedLyrics ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#0F172A] dark:text-white">
                      Synced
                    </span>
                  ) : (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70">
                      Plain
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : !activeTrack ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[#64748B] dark:text-white/60 py-16">
            <Mic2 size={32} className="text-slate-300 dark:text-white/20 mb-2" />
            <p className="text-xs font-semibold text-[#0F172A] dark:text-white">Play a track to view lyrics</p>
          </div>
        ) : lyricsData?.instrumental ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[#64748B] dark:text-white/60 gap-2 py-16">
            <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/10 text-[#0F172A] dark:text-white flex items-center justify-center shadow-inner">
              <Music size={22} />
            </div>
            <h4 className="text-base font-bold text-[#0F172A] dark:text-white">♪ Instrumental ♪</h4>
            <p className="text-xs text-[#64748B] dark:text-white/60">No vocal lyrics in this track.</p>
          </div>
        ) : lyricsData?.parsedLines && lyricsData.parsedLines.length > 0 ? (
          /* Live Karaoke Highlighting */
          <div className="space-y-3 py-4">
            {lyricsData.parsedLines.map((line: LrcLine, idx: number) => {
              const isActive = idx === activeLineIndex;
              const isPast = idx < activeLineIndex;

              return (
                <div
                  key={idx}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => seek(line.time)}
                  className={`cursor-pointer transition-all duration-200 rounded-xl px-3 py-1.5 ${
                    isActive
                      ? 'bg-black/[0.08] dark:bg-white/[0.14] border-l-4 border-[#0F172A] dark:border-white text-[#0F172A] dark:text-white font-extrabold text-base scale-[1.01] shadow-2xs'
                      : isPast
                      ? 'text-[#64748B] dark:text-white/60 font-medium text-xs hover:text-[#0F172A] dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/10'
                      : 'text-[#94A3B8] dark:text-white/40 font-medium text-xs hover:text-[#0F172A] dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/10'
                  }`}
                >
                  <span>{line.text}</span>
                </div>
              );
            })}
          </div>
        ) : lyricsData?.plainLyrics ? (
          /* Plain Lyrics */
          <div className="space-y-2 py-3">
            {lyricsData.plainLyrics.split('\n').map((line, idx) => (
              <p key={idx} className="text-[#0F172A] dark:text-white font-medium text-xs leading-relaxed">
                {line || <br />}
              </p>
            ))}
          </div>
        ) : (
          /* Not Found */
          <div className="h-full flex flex-col items-center justify-center text-center py-10 px-2">
            <Mic2 size={32} className="text-slate-300 dark:text-white/20 mb-2" />
            <h4 className="text-xs font-bold text-[#0F172A] dark:text-white mb-1">No lyrics found</h4>
            <p className="text-[11px] text-[#64748B] dark:text-white/60 mb-3">
              Search by another title or artist keyword:
            </p>

            <form onSubmit={handleManualSearch} className="flex gap-1.5 w-full">
              <input
                type="text"
                value={customSearch}
                onChange={(e) => setCustomSearch(e.target.value)}
                placeholder="Song or artist..."
                className="flex-1 px-2.5 py-1.5 bg-white dark:bg-white/[0.08] border border-slate-200 dark:border-white/15 rounded-lg text-xs text-[#0F172A] dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none focus:border-black/30 dark:focus:border-white/40 shadow-2xs"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#0F172A] hover:bg-black dark:bg-white/15 dark:hover:bg-white/25 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <Search size={12} />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2.5 border-t border-black/[0.05] dark:border-white/10 flex items-center justify-between text-[10px] text-[#94A3B8] dark:text-white/40 bg-white/40 dark:bg-transparent relative z-10 shrink-0">
        <span>Powered by LRCLIB</span>
        <span>Click line to seek</span>
      </div>
    </aside>
  );
};
