import { LiquidWordLine } from './LiquidWordLine';
import React, { useEffect, useState, useRef } from 'react';
import { Mic2, X, Music, Search, Sparkles, RefreshCw, Check, ArrowLeft, Pencil, RotateCcw } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useToastStore } from '../store/toastStore';
import {
  getTrackLyrics,
  parseLrc,
  extractArtistAndTitle,
  searchLyricsCandidates,
  saveCustomLyrics,
  removeCustomLyrics,
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
  const [isPastingCustom, setIsPastingCustom] = useState<boolean>(false);
  const [pastedText, setPastedText] = useState<string>('');
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
    if (document.hidden || !document.hasFocus()) return;
    const container = scrollContainerRef.current;
    const activeEl = activeLineRef.current;
    if (container && activeEl) {
      const containerRect = container.getBoundingClientRect();
      const lineRect = activeEl.getBoundingClientRect();
      const relativeTop = lineRect.top - containerRect.top + container.scrollTop;
      const targetScrollTop = relativeTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2);
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
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
        const best = results[0];
        setLyricsData(best);
        setCandidates([]);
        setIsSearching(false);
        setIsPastingCustom(false);
        if (activeTrack) {
          await saveCustomLyrics(activeTrack, best);
          useToastStore.getState().success(
            'Lyrics Saved',
            `Saved lyrics for "${activeTrack.title}"`
          );
        }
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

  const handleSelectCandidate = async (cand: LyricsResult) => {
    setLyricsData(cand);
    setCandidates([]);
    setIsSearching(false);
    setIsPastingCustom(false);
    if (activeTrack) {
      await saveCustomLyrics(activeTrack, cand);
      useToastStore.getState().success(
        'Lyrics Saved',
        `Saved selected lyrics for "${activeTrack.title}"`
      );
    }
  };

  const handleSavePastedLyrics = async () => {
    if (!pastedText.trim() || !activeTrack) return;
    const text = pastedText.trim();
    const hasTimestamps = /\[\d{2}:\d{2}/.test(text);
    const parsed = hasTimestamps ? parseLrc(text) : undefined;
    const newResult: LyricsResult = {
      trackName: activeTrack.title,
      artistName: activeTrack.artist,
      instrumental: false,
      syncedLyrics: hasTimestamps ? text : undefined,
      plainLyrics: !hasTimestamps ? text : undefined,
      parsedLines: parsed,
      isCustom: true,
    };
    setLyricsData(newResult);
    setIsPastingCustom(false);
    setPastedText('');
    setIsSearching(false);
    await saveCustomLyrics(activeTrack, newResult);
    useToastStore.getState().success(
      'Lyrics Saved',
      `Saved custom lyrics for "${activeTrack.title}"`
    );
  };

  const handleResetCustomLyrics = async () => {
    if (!activeTrack) return;
    await removeCustomLyrics(activeTrack);
    useToastStore.getState().info(
      'Lyrics Reset',
      `Restored automatic lyrics lookup for "${activeTrack.title}"`
    );
    setIsLoading(true);
    setLyricsData(null);
    getTrackLyrics(
      activeTrack.title,
      activeTrack.artist,
      activeTrack.durationSec,
      activeTrack.sourceId || activeTrack.id,
      activeTrack.id
    ).then((data) => {
      setLyricsData(data);
      setIsLoading(false);
    });
  };

  return (
    <aside
      id="lyrics-panel"
      className="w-[336px] min-w-[336px] h-full flex flex-col liquid-glass-panel dark:bg-[#08080C]/90 dark:border-white/10 rounded-2xl select-none overflow-hidden relative shadow-lg"
    >
      {/* Top Gloss Reflection */}
      <div className="pointer-events-none absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-white/70 dark:from-white/5 to-transparent" />

      {/* Header */}
      <div className="px-3.5 py-3 flex items-center justify-between border-b border-black/[0.05] dark:border-white/10 relative z-10 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
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
            <div className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/10 text-[#142347] dark:text-white flex items-center justify-center shrink-0">
              <Mic2 size={16} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#142347] dark:text-white shrink-0">Otofy Lyrics</span>
              {lyricsData?.isCustom && !isSearching && (
                <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#1C3061] text-white dark:bg-white dark:text-[#1C3061] flex items-center gap-0.5 shadow-2xs">
                  <Check size={9} strokeWidth={2.5} /> Saved
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#64748B] dark:text-white/60 truncate">
              {activeTrack?.title || 'No active track'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {lyricsData?.isCustom && (
            <button
              onClick={handleResetCustomLyrics}
              className="p-1.5 rounded-full text-[#64748B] dark:text-white/70 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-white/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Reset custom lyrics to automatic search"
              aria-label="Reset lyrics"
            >
              <RotateCcw size={15} />
            </button>
          )}
          <button
            onClick={() => {
              setIsSearching((prev) => !prev);
              setIsPastingCustom(false);
            }}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isSearching
                ? 'bg-[#1C3061] dark:bg-white text-white dark:text-black shadow-xs'
                : 'text-[#64748B] dark:text-white/70 hover:text-[#142347] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10'
            }`}
            title={isSearching ? 'Back to lyrics' : 'Search alternative lyrics'}
            aria-label="Search lyrics"
          >
            {isSearching ? <ArrowLeft size={16} /> : <Search size={16} />}
          </button>
          <button
            id="close-lyrics-panel-btn"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#64748B] dark:text-white/70 hover:text-[#142347] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Close lyrics"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Manual Search Bar if isSearching or lyrics not found */}
      {isSearching && (
        <div className="p-3 border-b border-black/[0.05] dark:border-white/10 bg-white/50 dark:bg-white/[0.04] backdrop-blur-md relative z-10 shrink-0 space-y-2">
          {!isPastingCustom ? (
            <>
              <form onSubmit={handleManualSearch} className="flex gap-1.5">
                <input
                  type="text"
                  value={customSearch}
                  onChange={(e) => setCustomSearch(e.target.value)}
                  placeholder="Track or artist..."
                  className="flex-1 px-2.5 py-1.5 bg-white dark:bg-white/[0.08] border border-slate-200 dark:border-white/15 rounded-lg text-xs text-[#142347] dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none focus:border-black/30 dark:focus:border-white/40 shadow-2xs"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-[#142347] hover:bg-[#101b38] dark:bg-white/15 dark:hover:bg-white/25 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                </button>
              </form>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsPastingCustom(true)}
                  className="text-[11px] font-medium text-[#142347] dark:text-white/80 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Pencil size={11} />
                  <span>Paste lyrics manually</span>
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#142347] dark:text-white">
                <span>Paste lyrics (plain text or synced LRC):</span>
                <button
                  type="button"
                  onClick={() => setIsPastingCustom(false)}
                  className="text-[11px] text-[#64748B] dark:text-white/60 hover:text-black dark:hover:text-white"
                >
                  Cancel
                </button>
              </div>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste lyrics here... Lines with [00:12.34] timestamps will be synchronized automatically."
                className="w-full h-28 p-2 text-xs bg-white dark:bg-white/[0.08] border border-slate-200 dark:border-white/15 rounded-lg text-[#142347] dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none resize-none font-mono"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSavePastedLyrics}
                disabled={!pastedText.trim()}
                className="w-full py-1.5 bg-[#1C3061] hover:bg-[#142347] dark:bg-white dark:text-[#1C3061] dark:hover:bg-white/90 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all"
              >
                <Check size={13} />
                <span>Save lyrics</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lyrics Scrollable Content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 relative z-10 select-text"
      >
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-[#64748B] dark:text-white/60 py-16">
            <RefreshCw size={22} className="animate-spin text-[#142347] dark:text-white" />
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
                  <p className="text-xs font-bold text-[#142347] dark:text-white truncate group-hover:text-black dark:group-hover:text-white">
                    {cand.trackName}
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-white/60 truncate">{cand.artistName}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {cand.syncedLyrics ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#142347] dark:text-white">
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
            <p className="text-xs font-semibold text-[#142347] dark:text-white">Play a track to view lyrics</p>
          </div>
        ) : lyricsData?.instrumental ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[#64748B] dark:text-white/60 gap-2 py-16">
            <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/10 text-[#142347] dark:text-white flex items-center justify-center shadow-inner">
              <Music size={22} />
            </div>
            <h4 className="text-base font-bold text-[#142347] dark:text-white">♪ Instrumental ♪</h4>
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
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '0 36px' }}
                  className={`cursor-pointer transition-[background-color,border-color,opacity] duration-200 rounded-xl px-3 py-1.5 text-xs font-bold ${
                    isActive
                      ? 'bg-black/[0.08] dark:bg-white/[0.14] border-l-4 border-[#142347] dark:border-white text-[#142347] dark:text-white shadow-2xs'
                      : isPast
                      ? 'text-[#64748B] dark:text-white/60 hover:text-[#142347] dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/10'
                      : 'text-[#94A3B8] dark:text-white/40 hover:text-[#142347] dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/10'
                  }`}
                >
                  <LiquidWordLine
                    line={line}
                    isActive={isActive}
                    themeMode={typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                    hasWordSync={Boolean(lyricsData?.hasWordSync)}
                  />
                </div>
              );
            })}
          </div>
        ) : lyricsData?.plainLyrics ? (
          /* Plain Lyrics */
          <div className="space-y-2 py-3">
            {lyricsData.plainLyrics.split('\n').map((line, idx) => (
              <p key={idx} className="text-[#142347] dark:text-white font-medium text-xs leading-relaxed">
                {line || <br />}
              </p>
            ))}
          </div>
        ) : isSearching ? (
          /* When searching is active, the search form is already pinned at the top */
          <div className="h-full flex flex-col items-center justify-center text-center py-10 px-4 space-y-2">
            <Mic2 size={32} className="text-slate-300 dark:text-white/20 mb-1" />
            <h4 className="text-xs font-bold text-[#142347] dark:text-white">
              {customSearch.trim() ? 'No lyrics candidates found' : 'Search lyrics above'}
            </h4>
            <p className="text-[11px] text-[#64748B] dark:text-white/60 max-w-xs leading-relaxed">
              {customSearch.trim()
                ? `No candidates found for "${customSearch.trim()}". Try different keywords or paste lyrics manually above.`
                : 'Enter a song title or artist in the search bar above to look up lyrics.'}
            </p>
          </div>
        ) : (
          /* Not Found on default playback */
          <div className="h-full flex flex-col items-center justify-center text-center py-10 px-4 space-y-3">
            <Mic2 size={32} className="text-slate-300 dark:text-white/20 mb-1" />
            <h4 className="text-xs font-bold text-[#142347] dark:text-white">No lyrics found</h4>
            <p className="text-[11px] text-[#64748B] dark:text-white/60 max-w-xs leading-relaxed">
              Lyrics could not be found automatically. You can search alternative lyrics or paste your own.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsSearching(true);
                  setIsPastingCustom(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#1C3061] hover:bg-[#142347] dark:bg-white dark:text-[#1C3061] dark:hover:bg-white/90 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Search size={12} />
                <span>Search lyrics</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSearching(true);
                  setIsPastingCustom(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-xs font-semibold text-[#142347] dark:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Pencil size={12} />
                <span>Paste manually</span>
              </button>
            </div>
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
