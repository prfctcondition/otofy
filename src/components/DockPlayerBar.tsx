import React, { useState } from 'react';
import {
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
  Heart,
  Mic2,
  ListMusic,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  PanelRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { PlaceholderArtwork } from './PlaceholderArtwork';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import { useEqStore } from '../store/eqStore';

interface DockPlayerBarProps {
  onSelectArtist?: (artist: string) => void;
}

export const DockPlayerBar: React.FC<DockPlayerBarProps> = ({ onSelectArtist }) => {
  const { 
    activeTrack, 
    isPlaying, 
    isBuffering,
    playbackError,
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
    cycleRepeat
  } = usePlayerStore();
  
  const {
    toggleLike,
    toggleEqModal,
    toggleLyricsModal,
    isLyricsModalOpen,
    isQueueOpen,
    toggleQueue,
    isRightPanelOpen,
    toggleRightPanel,
    isFullscreenLyrics,
    toggleFullscreenLyrics,
  } = useLibraryStore();

  if (!activeTrack) {
    return (
      <footer
        id="dock-player-bar"
        className="h-[84px] w-full shrink-0 px-6 flex items-center justify-between gap-4 select-none liquid-glass-panel rounded-2xl relative z-40"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-xl bg-white/50 dark:bg-white/10 border border-white/80 dark:border-white/10 flex items-center justify-center text-violet-600 dark:text-violet-400 shadow-xs">
            <Mic2 size={22} className="opacity-75" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">Otofy</span>
            <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">Choose a song or daily mix to begin listening</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleEqModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/50 dark:bg-[#1E293B] hover:bg-white dark:hover:bg-[#27354A] text-xs font-semibold text-[#334155] dark:text-[#F1F5F9] border border-white/80 dark:border-[#27354A] transition-all shadow-xs cursor-pointer"
            title="Equalizer"
          >
            <SlidersHorizontal size={15} className="text-violet-600 dark:text-violet-400" />
            <span>Equalizer</span>
          </button>
        </div>
      </footer>
    );
  }

  const isLiked = activeTrack.isLiked || false;

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState<number | null>(null);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  const activePercent = isSeeking && seekValue !== null
    ? seekValue
    : duration > 0 ? (currentTime / duration) * 100 : 0;

  const displayCurrentTime = isSeeking && seekValue !== null
    ? (seekValue / 100) * duration
    : currentTime;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSeekValue(parseFloat(e.target.value));
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeekCommit = () => {
    if (seekValue !== null && duration > 0) {
      const targetTime = (seekValue / 100) * duration;
      seek(targetTime);
    }
    setIsSeeking(false);
    setSeekValue(null);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (isMuted && val > 0) {
      toggleMute();
    }
  };

  return (
    <footer
      id="dock-player-bar"
      className="h-[84px] w-full shrink-0 px-4 sm:px-6 grid grid-cols-[minmax(180px,300px)_1fr_minmax(180px,300px)] items-center gap-3 select-none liquid-glass-panel rounded-2xl relative z-40"
    >
      <div className="flex items-center gap-3 min-w-0 justify-self-start">
        <div className="relative group shrink-0 rounded-lg p-0.5 bg-white/70 dark:bg-white/10 border border-white dark:border-white/10 shadow-sm">
          <PlaceholderArtwork
            icon={activeTrack.iconName}
            imageUrl={activeTrack.artworkUrl}
            source={activeTrack.source}
            sourceId={activeTrack.sourceId}
            gradientFrom={activeTrack.gradientFrom}
            gradientTo={activeTrack.gradientTo}
            size={52}
            rounded="rounded-md"
          />
        </div>

        <div className="flex flex-col min-w-0 pr-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="text-sm font-semibold text-[#0F172A] dark:text-white truncate hover:underline cursor-pointer"
              title={activeTrack.title}
            >
              {activeTrack.title}
            </span>
            {playbackError && (
              <span title={`Error: ${playbackError}`} className="shrink-0 text-rose-500">
                <AlertCircle size={14} />
              </span>
            )}
          </div>
          <span
            onClick={() => onSelectArtist?.(activeTrack.artist)}
            className="text-xs text-[#64748B] dark:text-[#A1A1AA] truncate hover:underline hover:text-violet-700 dark:hover:text-violet-400 cursor-pointer mt-0.5"
            title={`View ${activeTrack.artist}`}
          >
            {activeTrack.artist}
          </span>
        </div>

        <button
          id="player-like-btn"
          onClick={() => toggleLike(activeTrack.id, activeTrack)}
          className={`p-1.5 rounded-full transition-all active:scale-125 shrink-0 ${
            isLiked
              ? 'text-rose-500 hover:text-rose-600'
              : 'text-[#64748B] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white'
          }`}
          title={isLiked ? 'Remove from Liked' : 'Save to Liked'}
        >
          <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Center playback controls - strictly centered */}
      <div className="justify-self-center w-full max-w-xl flex flex-col items-center gap-1.5 px-2">
        <div className="flex items-center gap-5">
          <button
            id="player-shuffle-btn"
            onClick={toggleShuffle}
            className={`transition-colors ${
              isShuffle ? 'text-violet-600 dark:text-violet-400 font-bold' : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#A1A1AA] dark:hover:text-white'
            }`}
            title="Shuffle"
          >
            <Shuffle size={16} />
          </button>

          <button
            id="player-prev-btn"
            onClick={prevTrack}
            className="text-[#0F172A] dark:text-white hover:opacity-75 active:scale-95 transition-all"
            title="Previous"
          >
            <SkipBack size={20} fill="currentColor" />
          </button>

          <button
            id="player-play-toggle-btn"
            onClick={togglePlay}
            disabled={isBuffering}
            className="w-10 h-10 rounded-full bg-[#0F172A] text-white hover:bg-black dark:bg-white dark:text-black dark:border dark:border-white dark:hover:bg-white/90 flex items-center justify-center shadow-[0_4px_14px_rgba(15,23,42,0.25),inset_0_1px_1px_rgba(255,255,255,0.4)] dark:shadow-[0_4px_16px_rgba(255,255,255,0.25)] border border-[#0F172A] hover:scale-105 active:scale-95 transition-all disabled:opacity-90"
            title={isBuffering ? 'Loading audio...' : isPlaying ? 'Pause' : 'Play'}
          >
            {isBuffering ? (
              <Loader2 size={18} className="animate-spin text-white dark:text-black" />
            ) : isPlaying ? (
              <Pause size={18} fill="currentColor" className="text-white dark:text-black" />
            ) : (
              <Play size={18} fill="currentColor" className="ml-0.5 text-white dark:text-black" />
            )}
          </button>

          <button
            id="player-next-btn"
            onClick={nextTrack}
            className="text-[#0F172A] dark:text-white hover:opacity-75 active:scale-95 transition-all"
            title="Next"
          >
            <SkipForward size={20} fill="currentColor" />
          </button>

          <button
            id="player-repeat-btn"
            onClick={cycleRepeat}
            className={`transition-colors ${
              repeatMode !== 'off' ? 'text-violet-600 dark:text-violet-400 font-bold' : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
            }`}
            title="Repeat"
          >
            {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>
        </div>

        <div className="w-full flex items-center gap-2.5 text-[11px] text-[#64748B] dark:text-[#A1A1AA] font-mono select-none">
          <span className="w-10 text-right tabular-nums font-medium text-[#475569] dark:text-[#A1A1AA]">{formatTime(displayCurrentTime)}</span>
          <div className="relative flex-1 flex items-center group h-6 cursor-pointer">
            <div className="w-full h-1.5 group-hover:h-2 bg-black/[0.08] dark:bg-white/[0.12] rounded-full overflow-hidden transition-all duration-200 shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.06)]">
              <div
                className="h-full bg-gradient-to-r from-violet-600 via-indigo-600 to-[#0F172A] dark:to-indigo-400 rounded-full"
                style={{ width: `${activePercent}%` }}
              />
            </div>
            <div
              className={`absolute w-3.5 h-3.5 bg-white rounded-full border-2 border-indigo-600 shadow-[0_2px_6px_rgba(79,70,229,0.35)] pointer-events-none transition-opacity duration-150 -translate-x-1/2 ${
                isSeeking ? 'opacity-100 scale-110' : 'opacity-0 group-hover:opacity-100'
              }`}
              style={{ left: `${activePercent}%` }}
            />
            <input
              type="range"
              min="0"
              max="100"
              step="0.05"
              value={activePercent}
              onMouseDown={handleSeekStart}
              onTouchStart={handleSeekStart}
              onChange={handleSeekChange}
              onMouseUp={handleSeekCommit}
              onTouchEnd={handleSeekCommit}
              onKeyUp={handleSeekCommit}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              title="Seek"
            />
          </div>
          <span className="w-10 tabular-nums font-medium text-[#475569] dark:text-[#A1A1AA]">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right side controls */}
      <div className="flex items-center justify-end gap-1.5 sm:gap-2 text-[#64748B] dark:text-[#94A3B8]">
        <button
          id="player-lyrics-btn"
          onClick={toggleLyricsModal}
          className={`p-1.5 rounded-full hover:text-[#0F172A] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 transition-colors shrink-0 ${
            isLyricsModalOpen ? 'text-violet-600 dark:text-violet-400 bg-violet-100/70 dark:bg-violet-950/50 font-bold shadow-xs' : ''
          }`}
          title={isLyricsModalOpen ? 'Hide Lyrics' : 'Show Lyrics'}
        >
          <Mic2 size={16} />
        </button>

        <button
          id="player-eq-btn"
          onClick={toggleEqModal}
          className="p-1.5 rounded-full hover:text-[#0F172A] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 transition-colors shrink-0"
          title="Equalizer"
        >
          <SlidersHorizontal size={16} />
        </button>

        <button
          id="player-queue-btn"
          onClick={toggleQueue}
          className={`p-1.5 rounded-full hover:text-[#0F172A] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 transition-colors shrink-0 ${
            isQueueOpen ? 'text-violet-600 dark:text-violet-400 bg-violet-100/70 dark:bg-violet-950/50 font-bold shadow-xs' : ''
          }`}
          title={isQueueOpen ? 'Close Queue' : 'Open Queue'}
        >
          <ListMusic size={17} />
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            id="player-mute-btn"
            onClick={toggleMute}
            className="hover:text-[#0F172A] dark:hover:text-white transition-colors p-1"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX size={17} />
            ) : volume < 0.5 ? (
              <Volume1 size={17} />
            ) : (
              <Volume2 size={17} />
            )}
          </button>

          <div className="relative w-16 sm:w-20 md:w-24 flex items-center group h-6 cursor-pointer">
            <div className="w-full h-1.5 group-hover:h-2 bg-black/[0.08] dark:bg-white/[0.12] rounded-full overflow-hidden transition-all duration-200 shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.06)]">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-[#0F172A] dark:to-indigo-400 rounded-full transition-colors"
                style={{ width: `${isMuted ? 0 : volume * 100}%` }}
              />
            </div>
            <div
              className="absolute w-3 h-3 bg-white rounded-full border-2 border-indigo-600 shadow-[0_2px_4px_rgba(79,70,229,0.3)] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 -translate-x-1/2"
              style={{ left: `${isMuted ? 0 : volume * 100}%` }}
            />
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
          id="player-fullscreen-btn"
          onClick={toggleFullscreenLyrics}
          className={`p-1.5 rounded-full transition-all ml-1 ${
            isFullscreenLyrics
              ? 'text-violet-600 dark:text-violet-400 bg-violet-100/70 dark:bg-violet-950/50 font-bold shadow-xs'
              : 'hover:text-[#0F172A] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10'
          }`}
          title={isFullscreenLyrics ? 'Exit Full Screen' : 'Full Screen Lyrics'}
        >
          {isFullscreenLyrics ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
    </footer>
  );
};
