import { LiquidWordLine } from './LiquidWordLine';
import { useAudioReactive } from '../audio/useAudioReactive';
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
  RefreshCw,
  Search,
  Check,
  RotateCcw,
} from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import { useToastStore } from '../store/toastStore';
import {
  extractColorsFromImage,
  getFallbackColors,
  type ExtractedColors,
} from '../utils/colorExtractor';
import {
  getTrackLyrics,
  parseLrc,
  searchLyricsCandidates,
  saveCustomLyrics,
  removeCustomLyrics,
  type LyricsResult,
  type LrcLine,
} from '../services/lyricsService';
import { PlaceholderArtwork } from './PlaceholderArtwork';

interface AmbientOrb {
  id: string;
  leftPercent: number;
  topPercent: number;
  sizePx: number;
  color: string;
  opacity: number;
}

interface OrbSet {
  key: string;
  orbs: AmbientOrb[];
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function generateRandomOrbs(trackKey: string, colors: ExtractedColors): AmbientOrb[] {
  const seed = hashString(trackKey);
  const archetype = seed % 5;

  const archetypes = [
    // 0: Deep Center Pulsar + Satellite Lights
    [
      { minX: 30, maxX: 60, minY: 25, maxY: 55, baseSize: 840, baseOpacity: 0.45 },
      { minX: -15, maxX: 20, minY: -10, maxY: 25, baseSize: 580, baseOpacity: 0.36 },
      { minX: 65, maxX: 105, minY: 65, maxY: 100, baseSize: 640, baseOpacity: 0.34 },
      { minX: 75, maxX: 110, minY: 10, maxY: 45, baseSize: 520, baseOpacity: 0.30 },
    ],
    // 1: Diagonal Energy River (Top-Left to Bottom-Right)
    [
      { minX: -20, maxX: 15, minY: -20, maxY: 20, baseSize: 800, baseOpacity: 0.44 },
      { minX: 15, maxX: 45, minY: 25, maxY: 55, baseSize: 680, baseOpacity: 0.38 },
      { minX: 45, maxX: 75, minY: 40, maxY: 75, baseSize: 720, baseOpacity: 0.36 },
      { minX: 70, maxX: 110, minY: 65, maxY: 105, baseSize: 840, baseOpacity: 0.40 },
    ],
    // 2: Counter-Diagonal River (Top-Right to Bottom-Left)
    [
      { minX: 65, maxX: 105, minY: -15, maxY: 25, baseSize: 800, baseOpacity: 0.44 },
      { minX: 45, maxX: 75, minY: 25, maxY: 55, baseSize: 680, baseOpacity: 0.38 },
      { minX: 15, maxX: 45, minY: 45, maxY: 75, baseSize: 720, baseOpacity: 0.36 },
      { minX: -20, maxX: 15, minY: 65, maxY: 105, baseSize: 840, baseOpacity: 0.40 },
    ],
    // 3: Asymmetric Side Bloom (Lateral Wall of Light)
    [
      { minX: -25, maxX: 10, minY: 15, maxY: 65, baseSize: 920, baseOpacity: 0.46 },
      { minX: 25, maxX: 65, minY: -25, maxY: 15, baseSize: 640, baseOpacity: 0.34 },
      { minX: 70, maxX: 105, minY: 55, maxY: 95, baseSize: 600, baseOpacity: 0.32 },
      { minX: 30, maxX: 70, minY: 40, maxY: 75, baseSize: 680, baseOpacity: 0.36 },
    ],
    // 4: Dual Horizon Aurora (Top & Bottom Ambient Glow)
    [
      { minX: -5, maxX: 40, minY: -25, maxY: 15, baseSize: 820, baseOpacity: 0.42 },
      { minX: 55, maxX: 100, minY: -20, maxY: 20, baseSize: 780, baseOpacity: 0.38 },
      { minX: -15, maxX: 30, minY: 70, maxY: 115, baseSize: 760, baseOpacity: 0.36 },
      { minX: 50, maxX: 95, minY: 65, maxY: 110, baseSize: 860, baseOpacity: 0.40 },
    ],
  ];

  const anchors = archetypes[archetype] || archetypes[0];

  const colorPool = [
    colors.primary,
    colors.secondary,
    colors.accent,
    colors.primary,
  ];

  return anchors.map((a, idx) => {
    const subSeed = (seed + (idx / (1 / 17)) + 11) % 100;
    const rndX = (subSeed % 31) / 30;
    const rndY = ((subSeed + 13) % 29) / 28;
    const rndS = ((subSeed + 23) % 23) / 22;
    const diffX = a.maxX - a.minX;
    const diffY = a.maxY - a.minY;
    const left = a.minX + Math.floor(diffX / (1 / Math.max(0.01, rndX)));
    const top = a.minY + Math.floor(diffY / (1 / Math.max(0.01, rndY)));
    const sizeOffset = Math.floor(120 / (1 / Math.max(0.01, rndS)));
    return {
      id: `${trackKey}-${idx}`,
      leftPercent: left,
      topPercent: top,
      sizePx: a.baseSize + sizeOffset - 60,
      color: colorPool[idx] || colors.primary,
      opacity: a.baseOpacity,
    };
  });
}

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
  const [extractedColors, setExtractedColors] = useState<ExtractedColors>(() =>
    getFallbackColors(activeTrack?.gradientFrom, activeTrack?.gradientTo)
  );

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const [currentOrbs, setCurrentOrbs] = useState<OrbSet | null>(null);
  const [prevOrbs, setPrevOrbs] = useState<OrbSet | null>(null);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentTrackIdRef = useRef<string | null>(null);
  const ambientOrbsRef = useRef<HTMLDivElement | null>(null);
  useAudioReactive(ambientOrbsRef, { isEnabled: isFullscreenLyrics });

  useEffect(() => {
    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isFullscreenLyrics) return;
    const trackKey = activeTrack ? `${activeTrack.id || activeTrack.title}` : 'none';

    if (!activeTrack) {
      setCurrentOrbs(null);
      setPrevOrbs(null);
      return;
    }

    if (currentTrackIdRef.current !== trackKey) {
      currentTrackIdRef.current = trackKey;

      setCurrentOrbs((prev) => {
        if (prev) {
          setPrevOrbs(prev);
        }
        return {
          key: `${trackKey}-${Date.now()}`,
          orbs: generateRandomOrbs(trackKey, extractedColors),
        };
      });

      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
      cleanupTimeoutRef.current = setTimeout(() => {
        setPrevOrbs(null);
      }, 1000);
    } else {
      setCurrentOrbs((prev) => {
        if (!prev) return null;
        const colorPool = [
          extractedColors.primary,
          extractedColors.secondary,
          extractedColors.accent,
          extractedColors.primary,
        ];
        return {
          ...prev,
          orbs: prev.orbs.map((orb, i) => ({
            ...orb,
            color: colorPool[i % colorPool.length] || extractedColors.primary,
          })),
        };
      });
    }
  }, [isFullscreenLyrics, activeTrack?.id, activeTrack?.title, extractedColors]);

  // Extract artwork colors whenever fullscreen lyrics is open or active track changes
  useEffect(() => {
    if (!isFullscreenLyrics) return;
    let isMounted = true;
    extractColorsFromImage(
      activeTrack?.artworkUrl,
      activeTrack?.gradientFrom,
      activeTrack?.gradientTo
    ).then((colors) => {
      if (isMounted) {
        setExtractedColors(colors);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [isFullscreenLyrics, activeTrack?.artworkUrl, activeTrack?.gradientFrom, activeTrack?.gradientTo]);

  // Fetch lyrics whenever fullscreen lyrics is open or active track changes
  useEffect(() => {
    if (!isFullscreenLyrics || !activeTrack) return;

    let isMounted = true;
    setIsLoading(true);
    setLyricsData(null);
    setActiveLineIndex(-1);

    getTrackLyrics(
      activeTrack.title,
      activeTrack.artist,
      activeTrack.durationSec,
      activeTrack.sourceId || activeTrack.id,
      activeTrack.id
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

  // Smooth scroll active line into view (centered within lyrics container), never shifting the window
  useEffect(() => {
    if (document.hidden || !document.hasFocus()) return;
    const lineEl = activeLineRef.current;
    const containerEl = scrollContainerRef.current;
    if (lineEl && containerEl) {
      const containerRect = containerEl.getBoundingClientRect();
      const lineRect = lineEl.getBoundingClientRect();
      const relativeTop = lineRect.top - containerRect.top + containerEl.scrollTop;
      const targetScroll = relativeTop - (containerEl.clientHeight / 2) + (lineEl.clientHeight / 2);

      containerEl.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });

      // Pin root window and document body so browser never shifts outer viewport
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
      if (document.documentElement && document.documentElement.scrollTop !== 0) {
        document.documentElement.scrollTop = 0;
      }
      if (document.body && document.body.scrollTop !== 0) {
        document.body.scrollTop = 0;
      }
    }
  }, [activeLineIndex]);

  // Handle ESC key to exit fullscreen lyrics and reset any window offset
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
      window.scrollTo(0, 0);
      if (document.documentElement) {
        document.documentElement.scrollTop = 0;
      }
      if (document.body) {
        document.body.scrollTop = 0;
      }
    };
  }, [isFullscreenLyrics, setFullscreenLyrics]);

  if (!isFullscreenLyrics) return null;

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || secs < 0 || isNaN(secs)) return '0:00';
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : (activeTrack?.durationSec || 0);
  const progressPercent = safeDuration > 0 ? Math.min(100, Math.max(0, (currentTime / safeDuration) / 0.01)) : 0;

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = parseFloat(e.target.value);
    if (Number.isFinite(newProgress) && safeDuration > 0) {
      seek((newProgress / 100) / (1 / safeDuration));
    }
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
      const candidates = await searchLyricsCandidates(customSearch.trim());
      if (candidates.length > 0) {
        const best = candidates[0];
        setLyricsData(best);
        if (activeTrack) {
          await saveCustomLyrics(activeTrack, best);
          useToastStore.getState().success(
            'Lyrics Saved',
            `Saved lyrics for "${activeTrack.title}"`
          );
        }
      } else {
        setLyricsData(null);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
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

  const remainingSec = safeDuration > 0 ? safeDuration - currentTime : 999;
  const isNearEnd = safeDuration > 5 && remainingSec >= 0 && remainingSec <= 3.5;
  const endTrackFactor = isNearEnd ? Math.max(0, Math.min(1, remainingSec / 3.5)) : 1;

  return (
    <div
      id="fullscreen-lyrics-overlay"
      className="fixed inset-0 z-50 flex flex-col bg-[#090D16] text-white select-none animate-in fade-in duration-200 overflow-hidden"
    >
      <div
        ref={ambientOrbsRef}
        className="pointer-events-none absolute inset-0 overflow-hidden z-0 transition-opacity duration-700 ease-out"
        style={{ opacity: endTrackFactor }}
      >
        {prevOrbs && (
          <div
            key={prevOrbs.key}
            className="absolute inset-0 pointer-events-none transition-opacity duration-1000 ease-out opacity-0"
          >
            {prevOrbs.orbs.map((orb, i) => (
              <div
                key={orb.id}
                className={`absolute rounded-full pointer-events-none transform-gpu animate-float-orb-${i % 4}`}
                style={{
                  left: `${orb.leftPercent}%`,
                  top: `${orb.topPercent}%`,
                  width: `${orb.sizePx}px`,
                  height: `${orb.sizePx}px`,
                  background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
                  opacity: orb.opacity,
                }}
              />
            ))}
          </div>
        )}

        {currentOrbs && (
          <div
            key={currentOrbs.key}
            className="absolute inset-0 pointer-events-none transition-opacity duration-1000 ease-out opacity-100"
          >
            {currentOrbs.orbs.map((orb, i) => (
              <div
                key={orb.id}
                className={`absolute rounded-full pointer-events-none transform-gpu animate-float-orb-${i % 4}`}
                style={{
                  left: `${orb.leftPercent}%`,
                  top: `${orb.topPercent}%`,
                  width: `${orb.sizePx}px`,
                  height: `${orb.sizePx}px`,
                  background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
                  opacity: orb.opacity,
                  willChange: 'transform',
                }}
              />
            ))}
          </div>
        )}
      </div>

      <header className="relative z-20 h-20 px-8 flex items-center justify-between border-b border-white/10 bg-black/20 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-base font-semibold tracking-wide text-white/80 select-none">
            Otofy Lyrics
          </span>
          {lyricsData?.isCustom && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[#1C3061] bg-white font-bold text-xs px-2.5 py-0.5 rounded-full shadow-2xs">
              <Check size={11} strokeWidth={2.5} /> Saved
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {lyricsData?.isCustom && (
            <button
              onClick={handleResetCustomLyrics}
              className="p-2.5 rounded-full text-white/70 hover:text-rose-400 hover:bg-white/10 transition-colors"
              title="Reset custom lyrics to automatic search"
              aria-label="Reset lyrics"
            >
              <RotateCcw size={20} />
            </button>
          )}
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

      <main
        ref={scrollContainerRef}
        className="relative z-10 flex-1 overflow-y-auto px-6 sm:px-12 md:px-20 lg:px-32 py-16 select-text overscroll-contain"
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
          <div className="max-w-4xl mx-auto space-y-5 sm:space-y-7 md:space-y-8 py-20">
            {lyricsData.parsedLines.map((line: LrcLine, idx: number) => {
              const isActive = idx === activeLineIndex;
              const isPast = idx < activeLineIndex;

              return (
                <div
                  key={idx}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => seek(line.time)}
                  className={`cursor-pointer transition-all duration-300 rounded-2xl px-4 py-2 origin-left select-text leading-tight ${
                    isActive
                      ? 'text-white font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-shadow-sm'
                      : isPast
                      ? 'text-white/40 hover:text-white/80 font-bold text-xl sm:text-2xl md:text-3xl lg:text-4xl'
                      : 'text-white/35 hover:text-white/80 font-bold text-xl sm:text-2xl md:text-3xl lg:text-4xl'
                  }`}
                  title={`Jump to ${formatTime(line.time)}`}
                >
                  <LiquidWordLine
                    line={line}
                    isActive={isActive}
                    themeMode="dark"
                    hasWordSync={Boolean(lyricsData?.hasWordSync)}
                  />
                </div>
              );
            })}
          </div>
        ) : lyricsData?.plainLyrics ? (
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

      <footer className="relative z-20 h-24 px-8 flex items-center justify-between border-t border-white/10 bg-black/40 backdrop-blur-xl shrink-0 gap-6">
        <div className="flex items-center gap-3.5 w-1/4 min-w-[200px]">
          {activeTrack && (
            <PlaceholderArtwork
              key={activeTrack.id || activeTrack.title}
              icon={activeTrack.iconName}
              imageUrl={activeTrack.artworkUrl}
              source={activeTrack.source}
              sourceId={activeTrack.sourceId}
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

        <div className="flex flex-col items-center gap-2 w-2/4 max-w-xl">
          <div className="flex items-center gap-5">
            <button
              onClick={toggleShuffle}
              className={`relative flex flex-col items-center justify-center p-1 rounded-md transition-all ${
                isShuffle
                  ? 'text-white [filter:drop-shadow(0_0_8px_rgba(255,255,255,0.95))_drop-shadow(0_0_14px_rgba(255,255,255,0.6))] font-bold'
                  : 'text-white/40 hover:text-white'
              }`}
              title={`Shuffle: ${isShuffle ? 'On' : 'Off'}`}
            >
              <Shuffle size={16} />
              {isShuffle && (
                <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-white shadow-[0_0_8px_#ffffff]" />
              )}
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
              className={`relative flex flex-col items-center justify-center p-1 rounded-md transition-all ${
                repeatMode !== 'off'
                  ? 'text-white [filter:drop-shadow(0_0_8px_rgba(255,255,255,0.95))_drop-shadow(0_0_14px_rgba(255,255,255,0.6))] font-bold'
                  : 'text-white/40 hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
              {repeatMode !== 'off' && (
                <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-white shadow-[0_0_8px_#ffffff]" />
              )}
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
            <span className="w-10 tabular-nums">{formatTime(safeDuration)}</span>
          </div>
        </div>

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
                  style={{ width: `${isMuted ? 0 : volume / 0.01}%` }}
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
