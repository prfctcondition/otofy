import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  Minimize2,
  Mic2,
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Volume1,
  Sparkles,
  RefreshCw,
  Search,
} from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import { getTrackLyrics, parseLrc, type LyricsResult, type LrcLine } from '../services/lyricsService';
import { PlaceholderArtwork } from './PlaceholderArtwork';

export const FullscreenLyricsModal: React.FC = () => {
  const isFullscreenLyrics = useLibraryStore((s) => s.isFullscreenLyrics);
  const toggleFullscreenLyrics = useLibraryStore((s) => s.toggleFullscreenLyrics);
  const setFullscreenLyrics = useLibraryStore((s) => s.setFullscreenLyrics);

  const {
    activeTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
  } = usePlayerStore();

  const [lyricsData, setLyricsData] = useState<LyricsResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeLineIndex, setActiveLineIndex] = useState<number>(-1);
  const [customSearch, setCustomSearch] = useState<string>('');
  const [isSearchingManual, setIsSearchingManual] = useState<boolean>(false);

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Fetch lyrics whenever fullscreen lyrics is open or active track changes
  useEffect(() => {
    if (!isFullscreenLyrics || !activeTrack) return;

    let isMounted = true;
    setIsLoading(true);
    setLyricsData(null);
    setActiveLineIndex(-1);
    setIsSearchingManual(false);

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
  }, [isFullscreenLyrics, activeTrack?.id, activeTrack?.title]);

  // Compute active lyric line based on current playback time
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

  // Smooth scroll active line into view (centered)
  useEffect(() => {
    if (activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex]);

  // Handle ESC key to exit fullscreen lyrics
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreenLyrics) {
        setFullscreenLyrics(false);
      }
    };

    if (isFullscreenLyrics) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreenLyrics, setFullscreenLyrics]);

  if (!isFullscreenLyrics) return null;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = parseFloat(e.target.value);
    seek((newProgress / 100) * duration);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (isMuted && val > 0) {
      toggleMute();
    }
  };

  const handleManualSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customSearch.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(customSearch.trim())}`);
      if (res.ok) {
        const candidates = await res.json();
        if (Array.isArray(candidates) && candidates.length > 0) {
          const best =
            candidates.find((c: any) => c.syncedLyrics) ||
            candidates.find((c: any) => c.plainLyrics) ||
            candidates[0];
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
          setIsSearchingManual(false);
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

  const bgFrom = activeTrack?.gradientFrom || '#1E1B4B';
  const bgTo = activeTrack?.gradientTo || '#0F172A';

  return (
    <div
      id="fullscreen-lyrics-overlay"
      className="fixed inset-0 z-50 flex flex-col bg-[#090D16] text-white select-none animate-in fade-in duration-200 overflow-hidden"
    >
      {/* Dynamic Ambient Fluid Lights Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div
          className="absolute -top-40 -left-20 w-[700px] h-[700px] rounded-full opacity-40 blur-[130px] transition-all duration-700 pointer-events-none"
          style={{ background: bgFrom }}
        />
        <div
          className="absolute -bottom-40 -right-20 w-[800px] h-[800px] rounded-full opacity-35 blur-[150px] transition-all duration-700 pointer-events-none"
          style={{ background: bgTo }}
        />
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-[160px] pointer-events-none"
          style={{ background: bgFrom }}
        />
      </div>

      {/* Top Bar Header */}
      <header className="relative z-20 h-20 px-8 flex items-center justify-between border-b border-white/10 bg-black/20 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          {activeTrack && (
            <PlaceholderArtwork
              icon={activeTrack.iconName}
              imageUrl={activeTrack.artworkUrl}
              gradientFrom={activeTrack.gradientFrom}
              gradientTo={activeTrack.gradientTo}
              size={52}
              rounded="rounded-xl"
              className="shadow-md border border-white/20 shrink-0"
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white truncate drop-shadow-sm">
                {activeTrack?.title || 'No active track'}
              </h2>
              {activeTrack?.sourceLabel && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/15">
                  {activeTrack.sourceLabel}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-white/60 truncate flex items-center gap-2 mt-0.5">
              <span>{activeTrack?.artist || 'Unknown Artist'}</span>
              {lyricsData?.syncedLyrics && (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-xs">
                  <Sparkles size={12} /> Synced Lyrics
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsSearchingManual((v) => !v)}
            className="p-2.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Search different lyrics"
            aria-label="Search"
          >
            <Search size={20} />
          </button>
          <button
            id="close-fullscreen-lyrics-btn"
            onClick={toggleFullscreenLyrics}
            className="p-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5"
            title="Exit Full Screen (Esc)"
            aria-label="Exit Full Screen"
          >
            <Minimize2 size={20} />
            <span className="hidden sm:inline text-xs font-semibold uppercase tracking-wider text-white/60">
              Esc
            </span>
          </button>
        </div>
      </header>

      {/* Manual Search Dropdown Bar (if toggled) */}
      {isSearchingManual && (
        <div className="relative z-20 px-8 py-3 bg-black/40 border-b border-white/10 backdrop-blur-xl shrink-0 flex items-center justify-center">
          <form onSubmit={handleManualSearch} className="flex gap-2 w-full max-w-xl">
            <input
              type="text"
              value={customSearch}
              onChange={(e) => setCustomSearch(e.target.value)}
              placeholder="Search lyrics by song title or artist..."
              className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/60 focus:bg-white/15"
              autoFocus
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 bg-white text-black font-bold rounded-xl text-sm hover:bg-white/90 transition-all flex items-center gap-2"
            >
              {isLoading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
              <span>Search</span>
            </button>
          </form>
        </div>
      )}

      {/* Main Lyrics Container */}
      <main
        ref={scrollContainerRef}
        className="relative z-10 flex-1 overflow-y-auto px-6 sm:px-12 md:px-20 lg:px-32 py-16 scroll-smooth select-text"
      >
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-white/60 py-24">
            <RefreshCw size={36} className="animate-spin text-white/80" />
            <p className="text-sm font-semibold tracking-wide">Loading lyrics...</p>
          </div>
        ) : !activeTrack ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-white/60 py-24">
            <Mic2 size={48} className="opacity-40 mb-3" />
            <p className="text-lg font-bold text-white">Play a song to view full-screen lyrics</p>
          </div>
        ) : lyricsData?.instrumental ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-white/80 py-24 gap-3">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              <Music size={36} className="text-white" />
            </div>
            <h3 className="text-3xl font-black text-white mt-2">♪ Instrumental ♪</h3>
            <p className="text-sm text-white/60 max-w-sm">
              This track doesn't contain vocals. Lean back and enjoy the melody!
            </p>
          </div>
        ) : lyricsData?.parsedLines && lyricsData.parsedLines.length > 0 ? (
          /* Spotify-Style Karaoke Typography */
          <div className="max-w-4xl mx-auto space-y-5 sm:space-y-7 md:space-y-8 py-20">
            {lyricsData.parsedLines.map((line: LrcLine, idx: number) => {
              const isActive = idx === activeLineIndex;
              const isPast = idx < activeLineIndex;

              return (
                <div
                  key={idx}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => seek(line.time)}
                  className={`cursor-pointer transition-all duration-300 rounded-2xl px-4 py-2 origin-left select-text ${
                    isActive
                      ? 'text-white font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-tight scale-[1.03] drop-shadow-[0_4px_24px_rgba(255,255,255,0.4)]'
                      : isPast
                      ? 'text-white/40 hover:text-white/80 font-bold text-xl sm:text-2xl md:text-3xl lg:text-4xl leading-tight hover:scale-[1.01]'
                      : 'text-white/35 hover:text-white/80 font-bold text-xl sm:text-2xl md:text-3xl lg:text-4xl leading-tight hover:scale-[1.01]'
                  }`}
                  title={`Jump to ${formatTime(line.time)}`}
                >
                  <span>{line.text}</span>
                </div>
              );
            })}
          </div>
        ) : lyricsData?.plainLyrics ? (
          /* Plain Lyrics (Unsynced) */
          <div className="max-w-3xl mx-auto space-y-4 py-16 text-center sm:text-left">
            {lyricsData.plainLyrics.split('\n').map((line, idx) => (
              <p
                key={idx}
                className="text-xl sm:text-2xl md:text-3xl font-bold text-white/80 leading-relaxed hover:text-white transition-colors"
              >
                {line || <br />}
              </p>
            ))}
          </div>
        ) : (
          /* Lyrics Not Found */
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-24">
            <Mic2 size={48} className="opacity-30 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No lyrics found for this song</h3>
            <p className="text-sm text-white/60 mb-6">
              Search by another title or artist keyword to find matching lyrics:
            </p>

            <form onSubmit={handleManualSearch} className="flex gap-2 w-full">
              <input
                type="text"
                value={customSearch}
                onChange={(e) => setCustomSearch(e.target.value)}
                placeholder="Song or artist name..."
                className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/60"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-white text-black font-bold rounded-xl text-sm hover:bg-white/90 transition-all flex items-center gap-1.5"
              >
                <Search size={14} />
                <span>Search</span>
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Bottom Floating Playback Bar */}
      <footer className="relative z-20 h-24 px-8 flex items-center justify-between border-t border-white/10 bg-black/40 backdrop-blur-xl shrink-0 gap-6">
        {/* Track info on left */}
        <div className="flex items-center gap-3.5 w-1/4 min-w-[200px]">
          {activeTrack && (
            <PlaceholderArtwork
              icon={activeTrack.iconName}
              imageUrl={activeTrack.artworkUrl}
              gradientFrom={activeTrack.gradientFrom}
              gradientTo={activeTrack.gradientTo}
              size={48}
              rounded="rounded-lg"
              className="shadow-sm border border-white/20 shrink-0"
            />
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-white truncate">{activeTrack?.title}</span>
            <span className="text-xs text-white/60 truncate">{activeTrack?.artist}</span>
          </div>
        </div>

        {/* Center player controls + timeline */}
        <div className="flex flex-col items-center gap-2 w-2/4 max-w-xl">
          <div className="flex items-center gap-5">
            <button
              onClick={toggleShuffle}
              className={`transition-colors ${
                isShuffle ? 'text-emerald-400 font-bold' : 'text-white/60 hover:text-white'
              }`}
              title="Shuffle"
            >
              <Shuffle size={16} />
            </button>

            <button
              onClick={prevTrack}
              className="text-white hover:opacity-80 active:scale-95 transition-all"
              title="Previous"
            >
              <SkipBack size={20} fill="currentColor" />
            </button>

            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-white text-black hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg transition-all"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>

            <button
              onClick={nextTrack}
              className="text-white hover:opacity-80 active:scale-95 transition-all"
              title="Next"
            >
              <SkipForward size={20} fill="currentColor" />
            </button>

            <button
              onClick={cycleRepeat}
              className={`transition-colors ${
                repeatMode !== 'off' ? 'text-emerald-400 font-bold' : 'text-white/60 hover:text-white'
              }`}
              title="Repeat"
            >
              {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
            </button>
          </div>

          <div className="w-full flex items-center gap-3 text-xs text-white/50 font-mono">
            <span className="w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
            <div className="relative flex-1 flex items-center group h-6 cursor-pointer">
              <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden group-hover:h-1.5 transition-all">
                <div
                  className="h-full bg-white rounded-full transition-[width] duration-75"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={progressPercent}
                onChange={handleScrub}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                title="Seek"
              />
            </div>
            <span className="w-10 tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume & Exit Fullscreen on right */}
        <div className="flex items-center justify-end gap-3 w-1/4 min-w-[200px] text-white/70">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="hover:text-white transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX size={18} />
              ) : volume < 0.5 ? (
                <Volume1 size={18} />
              ) : (
                <Volume2 size={18} />
              )}
            </button>
            <div className="relative w-24 flex items-center group h-6 cursor-pointer">
              <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden group-hover:h-1.5 transition-all">
                <div
                  className="h-full bg-white rounded-full transition-colors"
                  style={{ width: `${isMuted ? 0 : volume * 100}%` }}
                />
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                title="Volume"
              />
            </div>
          </div>

          <button
            onClick={toggleFullscreenLyrics}
            className="p-2 rounded-full hover:text-white hover:bg-white/10 transition-colors ml-2"
            title="Exit Full Screen (Esc)"
          >
            <Minimize2 size={18} />
          </button>
        </div>
      </footer>
    </div>
  );
};
