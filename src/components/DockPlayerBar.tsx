import React, { useState, useEffect, useRef } from 'react';
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
  Download,
  Check,
} from 'lucide-react';
import { PlaceholderArtwork } from './PlaceholderArtwork';
import { ArtistLinks } from './ArtistLinks';
import { usePlayerStore, parseDurationToSeconds } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import { useEqStore } from '../store/eqStore';
import { useDownloadStore, IDLE_DOWNLOAD } from '../store/downloadStore';
import { useContextMenuStore } from '../store/contextMenuStore';

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
    setIsSeeking: storeSetIsSeeking,
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

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState<number | null>(null);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const volumeSliderRef = useRef<HTMLDivElement>(null);

  const dlStatus = useDownloadStore((s) =>
    activeTrack ? s.downloads[activeTrack.id] || IDLE_DOWNLOAD : IDLE_DOWNLOAD
  );
  const startDownload = useDownloadStore((s) => s.startDownload);
  const openDownloadedFile = useDownloadStore((s) => s.openDownloadedFile);
  const checkStatus = useDownloadStore((s) => s.checkStatus);

  useEffect(() => {
    if (activeTrack) {
      checkStatus([activeTrack]);
    }
  }, [activeTrack?.id, checkStatus]);

  if (!activeTrack) {
    return (
      <footer
        id="dock-player-bar"
        className="h-[84px] w-full shrink-0 px-6 flex items-center justify-between gap-4 select-none liquid-glass-panel rounded-2xl relative z-40"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-xl bg-white/50 dark:bg-white/10 border border-white/80 dark:border-white/10 flex items-center justify-center text-[#0F172A] dark:text-white shadow-xs">
            <Mic2 size={22} className="opacity-75" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-[#0F172A] dark:text-white">Otofy</span>
            <span className="text-xs text-[#64748B] dark:text-white/70">Choose a song or daily mix to begin listening</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleEqModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/50 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 text-xs font-semibold text-[#334155] dark:text-white border border-white/80 dark:border-white/15 transition-all shadow-xs cursor-pointer"
            title="Equalizer"
          >
            <SlidersHorizontal size={15} className="text-[#0F172A] dark:text-white" />
            <span>Equalizer</span>
          </button>
        </div>
      </footer>
    );
  }

  const isLiked = activeTrack.isLiked || false;

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || secs < 0 || isNaN(secs)) return '0:00';
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  const safeDuration = Number.isFinite(duration) && duration > 0
    ? duration
    : (activeTrack.durationSec || (activeTrack.duration ? parseDurationToSeconds(activeTrack.duration) : 0) || 0);

  const activePercent = isSeeking && seekValue !== null
    ? seekValue
    : safeDuration > 0 ? Math.min(100, Math.max(0, (currentTime / safeDuration) * 100)) : 0;

  const displayCurrentTime = isSeeking && seekValue !== null
    ? (seekValue / 100) * safeDuration
    : currentTime;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSeekValue(parseFloat(e.target.value));
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
    storeSetIsSeeking(true);
  };

  const handleSeekCommit = () => {
    if (seekValue !== null && safeDuration > 0) {
      const targetTime = (seekValue / 100) * safeDuration;
      if (Number.isFinite(targetTime)) {
        seek(targetTime);
      }
    }
    setIsSeeking(false);
    storeSetIsSeeking(false);
    setSeekValue(null);
  };

  const updateVolumeFromPointer = (clientX: number) => {
    if (!volumeSliderRef.current) return;
    const rect = volumeSliderRef.current.getBoundingClientRect();
    const rawX = clientX - rect.left;
    const percentage = Math.min(Math.max(rawX / rect.width, 0), 1);
    setVolume(percentage);
  };

  const handleVolumePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingVolume(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateVolumeFromPointer(e.clientX);
  };

  const handleVolumePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingVolume) return;
    updateVolumeFromPointer(e.clientX);
  };

  const handleVolumePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingVolume(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <footer
      id="dock-player-bar"
      className="h-[84px] w-full shrink-0 px-3 sm:px-6 grid grid-cols-[minmax(0,280px)_1fr_minmax(0,280px)] items-center gap-2 sm:gap-4 select-none liquid-glass-panel rounded-2xl relative z-40 overflow-hidden"
    >
      <div
        onContextMenu={(e) => {
          e.preventDefault();
          useContextMenuStore.getState().openTrackMenu(activeTrack, e.clientX, e.clientY);
        }}
        className="flex items-center gap-2 sm:gap-3 min-w-0 w-full max-w-full overflow-hidden cursor-context-menu"
      >
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

        <div className="flex-1 min-w-0 pr-1 overflow-hidden flex flex-col justify-center">
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
          <ArtistLinks
            artist={activeTrack.artist}
            artists={activeTrack.artists}
            source={activeTrack.source === 'SC' ? 'SC' : 'YT'}
            onSelectArtist={onSelectArtist ? (art) => onSelectArtist(art) : undefined}
            className="text-xs text-[#64748B] dark:text-white/80 truncate mt-0.5 inline-block max-w-[200px] sm:max-w-[280px]"
            artistClassName="cursor-pointer hover:underline hover:text-[#0F172A] dark:hover:text-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            id="player-like-btn"
            onClick={() => toggleLike(activeTrack.id, activeTrack)}
            className={`p-1.5 rounded-full transition-all active:scale-125 shrink-0 ${
              isLiked
                ? 'text-rose-500 hover:text-rose-600'
                : 'text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white'
            }`}
            title={isLiked ? 'Remove from Liked' : 'Save to Liked'}
          >
            <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
          </button>

          {/* Background download button */}
          {dlStatus.status === 'downloading' ? (
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/[0.06] dark:bg-white/[0.12] text-[11px] font-semibold text-[#0F172A] dark:text-white shrink-0"
              title={`Downloading... ${Math.round(dlStatus.progress)}%`}
            >
              <Loader2 size={13} className="animate-spin shrink-0" />
              <span className="tabular-nums">{Math.round(dlStatus.progress)}%</span>
            </div>
          ) : dlStatus.status === 'completed' ? (
            <button
              id="player-download-btn"
              onClick={() => openDownloadedFile(activeTrack)}
              className="p-1.5 rounded-full text-[#0F172A] dark:text-white hover:opacity-80 transition-all active:scale-125 shrink-0"
              title="Downloaded (Click to show in folder)"
            >
              <Check size={18} strokeWidth={2.5} />
            </button>
          ) : (
            <button
              id="player-download-btn"
              onClick={() => startDownload(activeTrack)}
              className={`p-1.5 rounded-full transition-all active:scale-125 shrink-0 ${
                dlStatus.status === 'error'
                  ? 'text-rose-500 hover:text-rose-400'
                  : 'text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white'
              }`}
              title={dlStatus.status === 'error' ? `Download error: ${dlStatus.error}. Click to retry` : 'Download track (MP3 320kbps)'}
            >
              <Download size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Center playback controls - strictly centered */}
      <div className="justify-self-center w-full max-w-md lg:max-w-xl flex flex-col items-center gap-1 sm:gap-1.5 px-2 min-w-0">
        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          <button
            id="player-shuffle-btn"
            onClick={toggleShuffle}
            className={`relative flex flex-col items-center justify-center p-1 rounded-md transition-all ${
              isShuffle
                ? 'text-[#0F172A] [filter:drop-shadow(0_1px_3px_rgba(15,23,42,0.3))] dark:text-white dark:[filter:drop-shadow(0_0_8px_rgba(255,255,255,0.95))_drop-shadow(0_0_14px_rgba(255,255,255,0.6))] font-bold'
                : 'text-[#94A3B8] hover:text-[#0F172A] dark:text-white/40 dark:hover:text-white/80'
            }`}
            title={`Shuffle: ${isShuffle ? 'On' : 'Off'}`}
          >
            <Shuffle size={16} />
            {isShuffle && (
              <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-[#0F172A] dark:bg-white dark:shadow-[0_0_8px_#ffffff]" />
            )}
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
            className={`relative flex flex-col items-center justify-center p-1 rounded-md transition-all ${
              repeatMode !== 'off'
                ? 'text-[#0F172A] [filter:drop-shadow(0_1px_3px_rgba(15,23,42,0.3))] dark:text-white dark:[filter:drop-shadow(0_0_8px_rgba(255,255,255,0.95))_drop-shadow(0_0_14px_rgba(255,255,255,0.6))] font-bold'
                : 'text-[#94A3B8] hover:text-[#0F172A] dark:text-white/40 dark:hover:text-white/80'
            }`}
            title={`Repeat: ${repeatMode}`}
          >
            {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
            {repeatMode !== 'off' && (
              <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-[#0F172A] dark:bg-white dark:shadow-[0_0_8px_#ffffff]" />
            )}
          </button>
        </div>

        <div className="w-full flex items-center gap-2.5 text-[11px] text-[#64748B] dark:text-white/80 font-mono select-none">
          <span className="w-10 text-right tabular-nums font-medium text-[#475569] dark:text-white/80">{formatTime(displayCurrentTime)}</span>
          <div className="relative flex-1 flex items-center group h-6 cursor-pointer">
            <div className="w-full h-1.5 group-hover:h-2 bg-black/[0.08] dark:bg-white/[0.12] rounded-full overflow-hidden transition-all duration-200 shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.06)]">
              <div
                className="h-full bg-[#0F172A] dark:bg-white rounded-full transition-colors"
                style={{ width: `${activePercent}%` }}
              />
            </div>
            <div
              className={`absolute top-1/2 w-3 h-3 bg-white rounded-full border border-black/20 dark:border-black/40 shadow-[0_1px_4px_rgba(0,0,0,0.3)] pointer-events-none transition-opacity duration-150 ${
                isSeeking ? 'opacity-100 scale-110' : 'opacity-0 group-hover:opacity-100'
              }`}
              style={{
                left: `${activePercent}%`,
                transform: 'translate(-50%, -50%)',
              }}
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
          <span className="w-10 tabular-nums font-medium text-[#475569] dark:text-white/80">{formatTime(safeDuration)}</span>
        </div>
      </div>

      {/* Right side controls */}
      <div className="flex items-center justify-end gap-1 sm:gap-2 text-[#64748B] dark:text-white/70 min-w-0">
        <button
          id="player-lyrics-btn"
          onClick={toggleLyricsModal}
          className={`p-1.5 rounded-full hover:text-[#0F172A] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 transition-colors shrink-0 ${
            isLyricsModalOpen ? 'text-[#0F172A] dark:text-white bg-black/[0.08] dark:bg-white/[0.18] font-bold shadow-xs' : ''
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
            isQueueOpen ? 'text-[#0F172A] dark:text-white bg-black/[0.08] dark:bg-white/[0.18] font-bold shadow-xs' : ''
          }`}
          title={isQueueOpen ? 'Close Queue' : 'Open Queue'}
        >
          <ListMusic size={17} />
        </button>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
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

          <div
            ref={volumeSliderRef}
            onPointerDown={handleVolumePointerDown}
            onPointerMove={handleVolumePointerMove}
            onPointerUp={handleVolumePointerUp}
            onPointerCancel={handleVolumePointerUp}
            className="relative w-14 sm:w-20 md:w-24 flex items-center group h-6 cursor-pointer shrink-0 touch-none select-none"
            title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
          >
            <div className="w-full h-1.5 group-hover:h-2 bg-black/[0.08] dark:bg-white/[0.12] rounded-full overflow-hidden transition-all duration-200 shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.06)]">
              <div
                className="h-full bg-[#0F172A] dark:bg-white rounded-full transition-colors"
                style={{ width: `${isMuted ? 0 : volume * 100}%` }}
              />
            </div>
            <div
              className={`absolute top-1/2 w-3 h-3 bg-white rounded-full border border-black/20 dark:border-black/40 shadow-[0_1px_4px_rgba(0,0,0,0.3)] pointer-events-none transition-opacity duration-150 ${
                isDraggingVolume ? 'opacity-100 scale-110' : 'opacity-0 group-hover:opacity-100'
              }`}
              style={{
                left: `${isMuted ? 0 : volume * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          </div>
        </div>

        <button
          id="player-fullscreen-btn"
          onClick={toggleFullscreenLyrics}
          className={`p-1.5 rounded-full transition-all ml-1 ${
            isFullscreenLyrics
              ? 'text-[#0F172A] dark:text-white bg-black/[0.08] dark:bg-white/[0.18] font-bold shadow-xs'
              : 'hover:text-[#0F172A] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10'
          }`}
          title={isFullscreenLyrics ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreenLyrics ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
    </footer>
  );
};
