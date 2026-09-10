import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  Shuffle,
  ArrowDownCircle,
  MoreHorizontal,
  Search,
  ListFilter,
  Sparkles,
  Share2,
  Plus,
  Check,
  FolderPlus,
  Trash2,
  Edit3,
  Heart,
  Radio,
  Music,
  Loader2,
  Download,
} from 'lucide-react';
import { Playlist, Track } from '../types';
import { PlaceholderArtwork } from './PlaceholderArtwork';
import { useLibraryStore } from '../store/libraryStore';
import { useToastStore } from '../store/toastStore';
import { useDownloadStore } from '../store/downloadStore';

interface LiquidHeroHeaderProps {
  playlist: Playlist;
  tracks?: Track[];
  isPlaying: boolean;
  isPlaylistActive?: boolean;
  onPlayToggle: () => void;
  isShuffle: boolean;
  onShuffleToggle: () => void;
  selectedFilter?: string;
  onSelectFilter?: (filter: string) => void;
  isSearchVisible: boolean;
  onToggleSearch: () => void;
  playlistSearchQuery: string;
  onPlaylistSearchChange: (q: string) => void;
  isSavedInLibrary?: boolean;
  onToggleSaveToLibrary?: () => void;
}

export const LiquidHeroHeader: React.FC<LiquidHeroHeaderProps> = ({
  playlist,
  tracks = [],
  isPlaying,
  isPlaylistActive = false,
  onPlayToggle,
  isShuffle,
  onShuffleToggle,
  selectedFilter,
  onSelectFilter,
  isSearchVisible,
  onToggleSearch,
  playlistSearchQuery,
  onPlaylistSearchChange,
  isSavedInLibrary = false,
  onToggleSaveToLibrary,
}) => {
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const isLikedSongs =
    playlist.id === 'pl-liked' ||
    (playlist.title ? playlist.title.toLowerCase().includes('liked') : false);
  const isCurrentlyPlayingThisPlaylist = isPlaylistActive && isPlaying;

  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState(playlist.title || '');

  const isBatchDownloading = useDownloadStore((s) => Boolean(s.batchState?.active));
  const downloadPlaylist = useDownloadStore((s) => s.downloadPlaylist);
  const downloads = useDownloadStore((s) => s.downloads);

  const allDownloaded = useMemo(() => {
    return tracks.length > 0 && tracks.every((t) => downloads[t.id]?.status === 'completed');
  }, [tracks, downloads]);

  useEffect(() => {
    setRenameTitle(playlist.title || '');
  }, [playlist.title]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target as Node)) {
        setIsOptionsMenuOpen(false);
      }
    };
    const handleScroll = () => {
      setIsOptionsMenuOpen(false);
    };
    if (isOptionsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOptionsMenuOpen]);

  const handleCreateNewPlaylistFromThis = async () => {
    const activeTracks =
      tracks && tracks.length > 0
        ? tracks
        : useLibraryStore.getState().currentPlaylistTracks;

    if (!activeTracks || activeTracks.length === 0) {
      useToastStore.getState().warning('Empty Playlist', 'No tracks to save in new playlist.');
      return;
    }
    const newTitle = `${playlist.title} (Custom)`;
    const created = await useLibraryStore.getState().createPlaylistFromTracks(newTitle, activeTracks);
    setIsOptionsMenuOpen(false);
    useToastStore.getState().success(
      'New Playlist Created',
      `Created "${created.title}" with ${activeTracks.length} tracks.`
    );
  };

  const handleRename = async () => {
    const trimmed = renameTitle.trim();
    if (!trimmed) return;
    await useLibraryStore.getState().renamePlaylist(playlist.id, trimmed);
    setIsRenaming(false);
    setIsOptionsMenuOpen(false);
    useToastStore.getState().success('Playlist Renamed', `Renamed to "${trimmed}".`);
  };

  const handleDelete = async () => {
    if (playlist.id === 'pl-liked') {
      useToastStore.getState().warning('Action Not Allowed', 'Liked Songs is a system playlist.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete playlist "${playlist.title}"?`)) {
      await useLibraryStore.getState().deletePlaylist(playlist.id);
      await useLibraryStore.getState().selectPlaylist('pl-liked');
      setIsOptionsMenuOpen(false);
      useToastStore.getState().info('Playlist Deleted', `"${playlist.title}" has been deleted.`);
    }
  };

  const isRadioOrMix =
    playlist.iconName === 'radio' ||
    playlist.id.startsWith('st-') ||
    playlist.id.startsWith('mix-') ||
    playlist.title.toLowerCase().includes('radio') ||
    playlist.title.toLowerCase().includes('mix');

  // Collect top 3 distinct artwork images for the 3-circle collage
  const topTrackArtworks = useMemo(() => {
    const list: { artworkUrl: string; artist: string }[] = [];
    const seenUrls = new Set<string>();

    for (const t of tracks || []) {
      if (t.artworkUrl && !seenUrls.has(t.artworkUrl)) {
        seenUrls.add(t.artworkUrl);
        list.push({ artworkUrl: t.artworkUrl, artist: t.artist });
        if (list.length >= 3) break;
      }
    }
    return list;
  }, [tracks]);

  // Subtitle: Spotify style "With DVRST, Kaito Shoma, Pharmacist and more"
  const artistsSubtitle = useMemo(() => {
    if (playlist.type === 'Artist') {
      return playlist.creator || 'Official Artist';
    }
    const artistSet = new Set<string>();
    for (const t of tracks || []) {
      const a = t.artist?.trim();
      if (
        a &&
        a.toLowerCase() !== 'unknown artist' &&
        a.toLowerCase() !== 'unknown' &&
        a.toLowerCase() !== 'song'
      ) {
        artistSet.add(a);
      }
    }
    const list = Array.from(artistSet);
    if (list.length >= 3) {
      return `With ${list.slice(0, 3).join(', ')} and more`;
    }
    if (list.length > 0) {
      return `With ${list.join(', ')}`;
    }
    return playlist.creator || 'Otofy collection';
  }, [tracks, playlist.creator, playlist.type]);

  // Duration & song count stats
  const { formattedDuration, totalSongCount } = useMemo(() => {
    const trackList = tracks && tracks.length > 0 ? tracks : [];
    const count = trackList.length || playlist.songCount || 0;
    const totalSec = trackList.reduce((sum, t) => sum + (t.durationSec || 0), 0);
    if (totalSec > 0) {
      const hrs = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const formatted = hrs > 0 ? `about ${hrs} hr ${mins} min` : `${mins || 1} min`;
      return { formattedDuration: formatted, totalSongCount: count };
    }
    return {
      formattedDuration: playlist.duration || `${count} songs`,
      totalSongCount: count,
    };
  }, [tracks, playlist.songCount, playlist.duration]);

  // Dynamic Spotify / Liked Songs style square artwork rendering
  const renderCoverArtwork = () => {
    if (isLikedSongs) {
      return (
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-[0_16px_36px_rgba(79,70,229,0.35)] border border-white/30 overflow-hidden group select-none shrink-0">
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Heart size={68} className="text-white fill-white drop-shadow-md group-hover:scale-110 transition-transform duration-300" />
        </div>
      );
    }

    const resolvedArtwork = playlist.artworkUrl || tracks?.[0]?.artworkUrl;

    if (playlist.type === 'Artist') {
      return (
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-full shadow-[0_16px_36px_rgba(0,0,0,0.4)] border-2 border-white/90 dark:border-white/20 overflow-hidden group select-none shrink-0 p-1 bg-white/40 dark:bg-white/10 backdrop-blur-md ring-4 ring-black/5 dark:ring-white/15">
          <PlaceholderArtwork
            icon="user"
            imageUrl={resolvedArtwork}
            gradientFrom={playlist.gradientFrom || '#4338CA'}
            gradientTo={playlist.gradientTo || '#7C3AED'}
            size="100%"
            iconSize={72}
            rounded="rounded-full"
            className="w-full h-full group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      );
    }

    if (resolvedArtwork) {
      return (
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-2xl shadow-[0_16px_36px_rgba(0,0,0,0.3)] border border-white/40 dark:border-white/15 overflow-hidden group select-none shrink-0">
          <PlaceholderArtwork
            icon={playlist.iconName || 'disc'}
            imageUrl={resolvedArtwork}
            gradientFrom={playlist.gradientFrom || '#1E1B4B'}
            gradientTo={playlist.gradientTo || '#0F172A'}
            size="100%"
            iconSize={72}
            rounded="rounded-2xl"
            className="w-full h-full group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      );
    }

    return (
      <div
        className={`relative group shrink-0 shadow-[0_12px_28px_rgba(0,0,0,0.2)] p-1 bg-white/75 dark:bg-white/10 backdrop-blur-md border border-white dark:border-white/15 ${
          playlist.type === 'Artist' ? 'rounded-full' : 'rounded-2xl'
        }`}
      >
        <PlaceholderArtwork
          icon={playlist.iconName}
          imageUrl={playlist.artworkUrl || tracks?.[0]?.artworkUrl}
          gradientFrom={playlist.gradientFrom}
          gradientTo={playlist.gradientTo}
          size={180}
          iconSize={70}
          rounded={playlist.type === 'Artist' ? 'rounded-full' : 'rounded-xl'}
          className={`shadow-md ${playlist.type === 'Artist' ? 'border-2 border-white/90 dark:border-white/20' : ''}`}
        />
      </div>
    );
  };

  const creatorInitial = (playlist.creator?.[0] || 'U').toUpperCase();

  return (
    <div id="liquid-hero-header" className="relative w-full select-none">
      {/* Ambient background glow for banner */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div
          className="absolute -top-20 -left-16 w-[560px] h-[340px] rounded-full opacity-30 dark:opacity-20 blur-3xl"
          style={{
            background: playlist.type === 'Artist'
              ? 'radial-gradient(circle, rgba(124, 58, 237, 0.45) 0%, rgba(99, 102, 241, 0.15) 50%, transparent 75%)'
              : `radial-gradient(circle, ${playlist.gradientFrom || '#6366F1'}44 0%, ${playlist.gradientTo || '#9333EA'}11 60%, transparent 80%)`,
          }}
        />
      </div>

      <div className="relative z-10 bg-white/35 dark:bg-black/60 backdrop-blur-[35px] border-b border-black/[0.05] dark:border-white/10 shadow-[inset_0_1.2px_1.5px_rgba(255,255,255,0.95)] dark:shadow-none px-7 pt-7 pb-5">
        {/* Top Hero Layout: Artwork on Left, Spotify-Style Meta on Right */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 mb-6">
          {renderCoverArtwork()}

          <div className="flex-1 min-w-0">
            {/* Category / Type Badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#0F172A] dark:text-white bg-white/70 dark:bg-white/10 px-2.5 py-0.5 rounded-full border border-white/95 dark:border-white/15 shadow-[inset_0_1px_1px_#FFFFFF,0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none">
                {playlist.type || 'Playlist'}
              </span>
              <span className="text-[#94A3B8] dark:text-white/40">•</span>
              <span className="text-xs text-[#64748B] dark:text-white/80 font-medium flex items-center gap-1">
                <Sparkles size={12} className="text-violet-600 dark:text-violet-400" />
                Hi-Res Master Audio
              </span>
            </div>

            {/* Giant Bold Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#0F172A] dark:text-white leading-tight mb-2 drop-shadow-xs">
              {playlist.title}
            </h1>

            {/* Playlist Description */}
            {(playlist.description || artistsSubtitle) && (
              <p className="text-sm text-[#475569] dark:text-white/85 font-medium leading-relaxed max-w-2xl mb-3">
                {playlist.description || artistsSubtitle}
              </p>
            )}

            {/* Creator & Stats Row */}
            <div className="flex items-center flex-wrap gap-2 text-xs text-[#64748B] dark:text-white/80 font-normal">
              {playlist.type === 'Artist' ? (
                <span className="font-bold text-[#0F172A] dark:text-white">
                  {playlist.creator}
                </span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-[#0F172A] dark:bg-white text-white dark:text-[#0F172A] flex items-center justify-center text-[10px] font-bold shadow-xs">
                    {creatorInitial}
                  </div>
                  <span className="font-bold text-[#0F172A] dark:text-white hover:underline cursor-pointer">
                    {playlist.creator || 'Otofy'}
                  </span>
                </div>
              )}
              {playlist.type !== 'Artist' && (
                <>
                  <span>•</span>
                  <span>Public Playlist</span>
                  <span>•</span>
                  <span className="font-semibold text-[#0F172A] dark:text-white">
                    {totalSongCount} songs, {formattedDuration}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Bar: Spotify Controls */}
        <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
          <div className="flex items-center gap-3">
            {/* Main Play / Pause Button - MATCHED with bottom player */}
            <button
              id="hero-play-button"
              onClick={onPlayToggle}
              className="w-14 h-14 rounded-full bg-[#0F172A] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90 flex items-center justify-center shadow-[0_8px_24px_rgba(15,23,42,0.35)] dark:shadow-[0_8px_24px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 transition-all duration-150 shrink-0 cursor-pointer border border-[#0F172A] dark:border-white"
              title={isCurrentlyPlayingThisPlaylist ? 'Pause' : 'Play'}
              aria-label={isCurrentlyPlayingThisPlaylist ? 'Pause' : 'Play'}
            >
              {isCurrentlyPlayingThisPlaylist ? (
                <Pause size={24} fill="currentColor" />
              ) : (
                <Play size={24} fill="currentColor" />
              )}
            </button>

            {/* Mini Cover Preview Thumbnail next to Play */}
            <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 shadow-xs border border-white/60 dark:border-white/20 hidden sm:flex items-center justify-center bg-slate-900">
              {topTrackArtworks[0]?.artworkUrl || playlist.artworkUrl ? (
                <img
                  src={topTrackArtworks[0]?.artworkUrl || playlist.artworkUrl}
                  alt="Thumb"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Music size={16} className="text-white/80" />
              )}
            </div>

            {/* Shuffle Toggle Button */}
            <button
              id="hero-shuffle-button"
              onClick={onShuffleToggle}
              className={`p-2.5 rounded-full transition-all relative cursor-pointer ${
                isShuffle
                  ? 'text-violet-600 dark:text-white bg-white/90 dark:bg-white/10 border border-white dark:border-white/10 shadow-xs'
                  : 'text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10'
              }`}
              title="Shuffle collection"
              aria-label="Shuffle"
            >
              <Shuffle size={20} />
              {isShuffle && (
                <span className="absolute bottom-1 right-2 w-1.5 h-1.5 rounded-full bg-violet-600 dark:bg-white shadow-[0_0_6px_rgba(139,92,246,0.8)]" />
              )}
            </button>

            {/* Prominent Save to My Playlists Button */}
            {onToggleSaveToLibrary && playlist.id !== 'pl-liked' && (
              <button
                id="hero-save-library-btn"
                onClick={onToggleSaveToLibrary}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer ${
                  isSavedInLibrary
                    ? 'bg-[#0F172A] dark:bg-white text-white dark:text-black shadow-[0_4px_14px_rgba(15,23,42,0.25)] dark:shadow-[0_4px_14px_rgba(255,255,255,0.2)]'
                    : 'bg-white/85 dark:bg-white/[0.08] hover:bg-white dark:hover:bg-white/[0.14] text-[#0F172A] dark:text-white border border-white/95 dark:border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_1.5px_#FFFFFF] dark:shadow-none hover:shadow-md'
                }`}
                title={isSavedInLibrary ? 'In My Playlists (click to remove)' : 'Save to My Playlists'}
                aria-label={isSavedInLibrary ? 'In My Playlists' : 'Save to My Playlists'}
              >
                {isSavedInLibrary ? (
                  <>
                    <Check size={16} strokeWidth={2.5} className="text-white dark:text-black" />
                    <span>In My Playlists</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} strokeWidth={2.5} className="text-violet-600 dark:text-violet-400" />
                    <span>Save to My Playlists</span>
                  </>
                )}
              </button>
            )}

            {/* Download Button */}
            <button
              id="hero-download-button"
              onClick={() => {
                if (tracks.length > 0) {
                  downloadPlaylist(tracks, playlist.title);
                }
              }}
              disabled={isBatchDownloading || allDownloaded || tracks.length === 0}
              className={`p-2.5 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed ${
                allDownloaded
                  ? 'text-emerald-500 hover:bg-emerald-500/10'
                  : isBatchDownloading
                  ? 'text-violet-600 dark:text-violet-400 hover:bg-violet-500/10'
                  : 'text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10'
              }`}
              title={
                allDownloaded
                  ? 'All tracks downloaded'
                  : isBatchDownloading
                  ? 'Downloading playlist tracks...'
                  : 'Download entire playlist'
              }
              aria-label="Download"
            >
              {isBatchDownloading ? (
                <Loader2 size={21} className="animate-spin" />
              ) : allDownloaded ? (
                <Check size={21} strokeWidth={2.5} />
              ) : (
                <ArrowDownCircle size={21} />
              )}
            </button>

            {/* 3-dots dropdown menu */}
            <div className="relative" ref={optionsMenuRef}>
              <button
                id="hero-options-button"
                onClick={() => setIsOptionsMenuOpen((v) => !v)}
                className={`p-2.5 rounded-full transition-colors cursor-pointer ${
                  isOptionsMenuOpen
                    ? 'bg-white dark:bg-white/20 text-[#0F172A] dark:text-white shadow-xs'
                    : 'text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10'
                }`}
                title="More options for collection"
                aria-label="Options"
              >
                <MoreHorizontal size={20} />
              </button>

              {isOptionsMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-64 bg-white/95 dark:bg-[#111116] backdrop-blur-3xl border border-white/95 dark:border-white/10 rounded-2xl shadow-[0_20px_45px_rgba(0,0,0,0.5)] py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {onToggleSaveToLibrary && playlist.id !== 'pl-liked' && (
                    <button
                      onClick={() => {
                        setIsOptionsMenuOpen(false);
                        onToggleSaveToLibrary();
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-semibold text-[#0F172A] dark:text-white hover:bg-slate-100/80 dark:hover:bg-white/10 flex items-center gap-2.5 transition-colors"
                    >
                      {isSavedInLibrary ? (
                        <>
                          <Check size={15} className="text-emerald-600" />
                          <span>Remove from Your Library</span>
                        </>
                      ) : (
                        <>
                          <Plus size={15} className="text-slate-600 dark:text-white/70" />
                          <span>Add to Your Library</span>
                        </>
                      )}
                    </button>
                  )}

                  {playlist.id !== 'pl-liked' && playlist.type === 'Playlist' && (
                    <button
                      onClick={() => {
                        setRenameTitle(playlist.title);
                        setIsRenaming(true);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-semibold text-[#0F172A] dark:text-white hover:bg-slate-100/80 dark:hover:bg-white/10 flex items-center gap-2.5 transition-colors"
                    >
                      <Edit3 size={15} className="text-[#64748B] dark:text-white/70" />
                      <span>Rename playlist</span>
                    </button>
                  )}

                  <button
                    onClick={handleCreateNewPlaylistFromThis}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-[#0F172A] dark:text-white hover:bg-slate-100/80 dark:hover:bg-white/10 flex items-center gap-2.5 transition-colors"
                  >
                    <FolderPlus size={15} className="text-violet-600 dark:text-violet-400" />
                    <span>Create new playlist from this</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsOptionsMenuOpen(false);
                      useLibraryStore.getState().toggleShareModal();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-[#0F172A] dark:text-white hover:bg-slate-100/80 dark:hover:bg-white/10 flex items-center gap-2.5 transition-colors"
                  >
                    <Share2 size={15} className="text-[#64748B] dark:text-white/70" />
                    <span>Share playlist</span>
                  </button>

                  {tracks.length > 0 && (
                    <div className="border-t border-slate-100 dark:border-white/10 my-1 pt-1">
                      <button
                        onClick={() => {
                          setIsOptionsMenuOpen(false);
                          downloadPlaylist(tracks, playlist.title, 'mp3');
                        }}
                        disabled={isBatchDownloading}
                        className="w-full px-3.5 py-2 text-left text-xs font-semibold text-[#0F172A] dark:text-white hover:bg-slate-100/80 dark:hover:bg-white/10 flex items-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Download size={15} className="text-[#64748B] dark:text-white/70" />
                        <span>Download all tracks (MP3 320kbps)</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsOptionsMenuOpen(false);
                          downloadPlaylist(tracks, playlist.title, 'flac');
                        }}
                        disabled={isBatchDownloading}
                        className="w-full px-3.5 py-2 text-left text-xs font-semibold text-[#0F172A] dark:text-white hover:bg-slate-100/80 dark:hover:bg-white/10 flex items-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Download size={15} className="text-[#64748B] dark:text-white/70" />
                        <span>Download all tracks (FLAC)</span>
                      </button>
                    </div>
                  )}

                  {playlist.id !== 'pl-liked' && (
                    <div className="border-t border-slate-100 dark:border-white/10 my-1 pt-1">
                      <button
                        onClick={handleDelete}
                        className="w-full px-3.5 py-2 text-left text-xs font-semibold text-red-600 dark:text-rose-400 hover:bg-red-50 dark:hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors"
                      >
                        <Trash2 size={15} className="text-red-500" />
                        <span>Delete playlist</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Search & Sort Controls */}
          <div className="flex items-center gap-3">
            {isSearchVisible ? (
              <div className="flex items-center bg-white/80 dark:bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/90 dark:border-white/15 shadow-inner text-xs w-52">
                <Search size={14} className="text-[#64748B] dark:text-white/70 mr-2 shrink-0" />
                <input
                  id="playlist-search-input"
                  type="text"
                  value={playlistSearchQuery}
                  onChange={(e) => onPlaylistSearchChange(e.target.value)}
                  placeholder="Search in playlist"
                  className="w-full bg-transparent text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-white/40 focus:outline-none"
                  autoFocus
                />
              </div>
            ) : (
              <button
                id="toggle-playlist-search-btn"
                onClick={onToggleSearch}
                className="p-2 rounded-full text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Search in this playlist"
              >
                <Search size={18} />
              </button>
            )}

            <div
              id="playlist-sort-dropdown"
              className="flex items-center gap-1.5 text-xs font-medium text-[#334155] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white cursor-pointer px-3 py-1.5 rounded-full bg-white/65 dark:bg-white/[0.08] hover:bg-white/85 dark:hover:bg-white/[0.14] border border-white/95 dark:border-white/10 shadow-[inset_0_1px_1.5px_#FFFFFF,0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-none transition-all"
            >
              <span>Date added</span>
              <ListFilter size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* Rename Dialog Modal */}
      {isRenaming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white/95 dark:bg-[#111116] backdrop-blur-2xl border border-white/80 dark:border-white/10 rounded-2xl p-5 w-80 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">Rename playlist</h3>
            <input
              type="text"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/15 rounded-xl focus:outline-none focus:border-violet-500 text-[#0F172A] dark:text-white"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setIsRenaming(false);
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsRenaming(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#64748B] dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white transition-colors shadow-xs"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
