import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  Shuffle,
  ArrowDownCircle,
  MoreHorizontal,
  Search,
  ListFilter,
  ChevronRight,
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
} from 'lucide-react';
import { Playlist, Track } from '../types';
import { PlaceholderArtwork } from './PlaceholderArtwork';
import { FILTER_PILLS } from '../data/musicData';
import { useLibraryStore } from '../store/libraryStore';
import { useToastStore } from '../store/toastStore';

interface LiquidHeroHeaderProps {
  playlist: Playlist;
  tracks?: Track[];
  isPlaying: boolean;
  isPlaylistActive?: boolean;
  onPlayToggle: () => void;
  isShuffle: boolean;
  onShuffleToggle: () => void;
  selectedFilter: string;
  onSelectFilter: (filter: string) => void;
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
  const pillsContainerRef = useRef<HTMLDivElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const isLikedSongs =
    playlist.id === 'pl-liked' ||
    (playlist.title ? playlist.title.toLowerCase().includes('liked') : false);
  const isCurrentlyPlayingThisPlaylist = isPlaylistActive && isPlaying;

  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState(playlist.title || '');

  useEffect(() => {
    setRenameTitle(playlist.title || '');
  }, [playlist.title]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target as Node)) {
        setIsOptionsMenuOpen(false);
      }
    };
    if (isOptionsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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

  const handleScrollRight = () => {
    if (pillsContainerRef.current) {
      pillsContainerRef.current.scrollBy({ left: 160, behavior: 'smooth' });
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
    return playlist.creator || 'Zen Music collection';
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
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-full shadow-[0_16px_36px_rgba(0,0,0,0.2)] border-2 border-white/90 overflow-hidden group select-none shrink-0 p-1 bg-white/40 backdrop-blur-md">
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
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-2xl shadow-[0_16px_36px_rgba(0,0,0,0.2)] border border-white/40 overflow-hidden group select-none shrink-0">
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
        className={`relative group shrink-0 shadow-[0_12px_28px_rgba(0,0,0,0.12)] p-1 bg-white/75 backdrop-blur-md border border-white ${
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
          className={`shadow-md ${playlist.type === 'Artist' ? 'border-2 border-white/90' : ''}`}
        />
      </div>
    );
  };

  const creatorInitial = (playlist.creator?.[0] || 'U').toUpperCase();

  return (
    <div id="liquid-hero-header" className="relative w-full select-none">
      <div className="relative z-10 bg-white/35 backdrop-blur-[35px] border-b border-black/[0.05] shadow-[inset_0_1.2px_1.5px_rgba(255,255,255,0.95)] px-7 pt-7 pb-5">
        {/* Top Hero Layout: Artwork on Left, Spotify-Style Meta on Right */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 mb-6">
          {renderCoverArtwork()}

          <div className="flex-1 min-w-0">
            {/* Category / Type Badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#0F172A] bg-white/70 px-2.5 py-0.5 rounded-full border border-white/95 shadow-[inset_0_1px_1px_#FFFFFF,0_1px_3px_rgba(0,0,0,0.04)]">
                {playlist.type || 'Playlist'}
              </span>
              <span className="text-[#94A3B8]">•</span>
              <span className="text-xs text-[#64748B] font-medium flex items-center gap-1">
                <Sparkles size={12} className="text-violet-600" />
                Hi-Res Master Audio
              </span>
            </div>

            {/* Giant Bold Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#0F172A] leading-tight mb-2 drop-shadow-xs">
              {playlist.title}
            </h1>

            {/* Playlist Description */}
            {(playlist.description || artistsSubtitle) && (
              <p className="text-sm text-[#475569] font-medium leading-relaxed max-w-2xl mb-3">
                {playlist.description || artistsSubtitle}
              </p>
            )}

            {/* Creator & Stats Row */}
            <div className="flex items-center flex-wrap gap-2 text-xs text-[#64748B] font-normal">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-[#0F172A] text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                  {creatorInitial}
                </div>
                <span className="font-bold text-[#0F172A] hover:underline cursor-pointer">
                  {playlist.creator || 'Zen Music'}
                </span>
              </div>
              <span>•</span>
              <span>Public Playlist</span>
              <span>•</span>
              <span className="font-semibold text-[#0F172A]">
                {totalSongCount} songs, {formattedDuration}
              </span>
            </div>
          </div>
        </div>

        {/* Action Bar: Spotify Controls */}
        <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
          <div className="flex items-center gap-3">
            {/* Big Green Play / Pause Button */}
            <button
              id="hero-play-button"
              onClick={onPlayToggle}
              className="w-14 h-14 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black flex items-center justify-center shadow-[0_8px_24px_rgba(29,185,84,0.35)] hover:scale-105 active:scale-95 transition-all duration-150 shrink-0 cursor-pointer"
              title={isCurrentlyPlayingThisPlaylist ? 'Pause' : 'Play'}
              aria-label={isCurrentlyPlayingThisPlaylist ? 'Pause' : 'Play'}
            >
              {isCurrentlyPlayingThisPlaylist ? (
                <Pause size={24} fill="currentColor" />
              ) : (
                <Play size={24} fill="currentColor" className="ml-1" />
              )}
            </button>

            {/* Mini Cover Preview Thumbnail next to Play */}
            <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 shadow-xs border border-white/60 hidden sm:flex items-center justify-center bg-slate-900">
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
                  ? 'text-[#1DB954] bg-white/90 border border-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white/60'
              }`}
              title="Shuffle collection"
              aria-label="Shuffle"
            >
              <Shuffle size={20} />
              {isShuffle && (
                <span className="absolute bottom-1 right-2 w-1.5 h-1.5 rounded-full bg-[#1DB954] shadow-[0_0_6px_rgba(29,185,84,0.8)]" />
              )}
            </button>

            {/* Prominent Save to My Playlists Button */}
            {onToggleSaveToLibrary && (
              <button
                id="hero-save-library-btn"
                onClick={onToggleSaveToLibrary}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer ${
                  isSavedInLibrary
                    ? 'bg-[#1DB954] hover:bg-[#1ed760] text-black shadow-[0_4px_14px_rgba(29,185,84,0.35)]'
                    : 'bg-white/85 hover:bg-white text-[#0F172A] border border-white/95 shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_1.5px_#FFFFFF] hover:shadow-md'
                }`}
                title={isSavedInLibrary ? 'In My Playlists (click to remove)' : 'Save to My Playlists'}
                aria-label={isSavedInLibrary ? 'In My Playlists' : 'Save to My Playlists'}
              >
                {isSavedInLibrary ? (
                  <>
                    <Check size={16} strokeWidth={2.5} className="text-black" />
                    <span>In My Playlists</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} strokeWidth={2.5} className="text-violet-600" />
                    <span>Save to My Playlists</span>
                  </>
                )}
              </button>
            )}

            {/* Download Button */}
            <button
              id="hero-download-button"
              className="p-2.5 rounded-full text-[#64748B] hover:text-[#0F172A] hover:bg-white/60 transition-colors cursor-pointer"
              title="Download to cache"
              aria-label="Download"
            >
              <ArrowDownCircle size={21} />
            </button>

            {/* Create new playlist from this button */}
            <button
              id="hero-create-copy-button"
              onClick={handleCreateNewPlaylistFromThis}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-white/80 hover:bg-white text-[#0F172A] border border-white/90 shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer"
              title="Create new playlist from this"
            >
              <FolderPlus size={15} className="text-violet-600" />
              <span>Create new playlist from this</span>
            </button>

            {/* 3-dots dropdown menu */}
            <div className="relative" ref={optionsMenuRef}>
              <button
                id="hero-options-button"
                onClick={() => setIsOptionsMenuOpen((v) => !v)}
                className={`p-2.5 rounded-full transition-colors cursor-pointer ${
                  isOptionsMenuOpen
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white/60'
                }`}
                title="More options for collection"
                aria-label="Options"
              >
                <MoreHorizontal size={20} />
              </button>

              {isOptionsMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-64 bg-white/95 backdrop-blur-3xl border border-white/95 rounded-2xl shadow-[0_20px_45px_rgba(0,0,0,0.22)] py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {onToggleSaveToLibrary && (
                    <button
                      onClick={() => {
                        setIsOptionsMenuOpen(false);
                        onToggleSaveToLibrary();
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-semibold text-[#0F172A] hover:bg-slate-100/80 flex items-center gap-2.5 transition-colors"
                    >
                      {isSavedInLibrary ? (
                        <>
                          <Check size={15} className="text-emerald-600" />
                          <span>Remove from Your Library</span>
                        </>
                      ) : (
                        <>
                          <Plus size={15} className="text-slate-600" />
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
                      className="w-full px-3.5 py-2 text-left text-xs font-semibold text-[#0F172A] hover:bg-slate-100/80 flex items-center gap-2.5 transition-colors"
                    >
                      <Edit3 size={15} className="text-[#64748B]" />
                      <span>Rename playlist</span>
                    </button>
                  )}

                  <button
                    onClick={handleCreateNewPlaylistFromThis}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-[#0F172A] hover:bg-slate-100/80 flex items-center gap-2.5 transition-colors"
                  >
                    <FolderPlus size={15} className="text-violet-600" />
                    <span>Create new playlist from this</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsOptionsMenuOpen(false);
                      useLibraryStore.getState().toggleShareModal();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-[#0F172A] hover:bg-slate-100/80 flex items-center gap-2.5 transition-colors"
                  >
                    <Share2 size={15} className="text-[#64748B]" />
                    <span>Share playlist</span>
                  </button>

                  {playlist.id !== 'pl-liked' && (
                    <div className="border-t border-slate-100 my-1 pt-1">
                      <button
                        onClick={handleDelete}
                        className="w-full px-3.5 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
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
              <div className="flex items-center bg-white/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/90 shadow-inner text-xs w-52">
                <Search size={14} className="text-[#64748B] mr-2 shrink-0" />
                <input
                  id="playlist-search-input"
                  type="text"
                  value={playlistSearchQuery}
                  onChange={(e) => onPlaylistSearchChange(e.target.value)}
                  placeholder="Search in playlist"
                  className="w-full bg-transparent text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
                  autoFocus
                />
              </div>
            ) : (
              <button
                id="toggle-playlist-search-btn"
                onClick={onToggleSearch}
                className="p-2 rounded-full text-[#64748B] hover:text-[#0F172A] hover:bg-white/60 transition-colors cursor-pointer"
                title="Search in this playlist"
              >
                <Search size={18} />
              </button>
            )}

            <div
              id="playlist-sort-dropdown"
              className="flex items-center gap-1.5 text-xs font-medium text-[#334155] hover:text-[#0F172A] cursor-pointer px-3 py-1.5 rounded-full bg-white/65 hover:bg-white/85 border border-white/95 shadow-[inset_0_1px_1.5px_#FFFFFF,0_2px_8px_rgba(0,0,0,0.05)] transition-all"
            >
              <span>Date added</span>
              <ListFilter size={14} />
            </div>
          </div>
        </div>

        {/* Filter Pills (All, Phonk, Synthwave, etc.) */}
        {!isLikedSongs && playlist.type !== 'Artist' && (
          <div className="relative flex items-center pt-1">
            <div
              ref={pillsContainerRef}
              className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth pr-10"
            >
              {FILTER_PILLS.map((pill) => {
                const isSelected = selectedFilter === pill;
                return (
                  <button
                    key={pill}
                    onClick={() => onSelectFilter(pill)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'liquid-glass-pill-active font-semibold'
                        : 'liquid-glass-pill text-[#64748B] hover:text-[#0F172A] hover:bg-white/80'
                    }`}
                  >
                    {pill}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleScrollRight}
              className="absolute right-0 top-1 bottom-0 px-2 bg-gradient-to-l from-white/80 via-white/50 to-transparent flex items-center justify-center text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
              title="Scroll filters"
            >
              <div className="w-6 h-6 rounded-full bg-white/80 hover:bg-white border border-white/90 flex items-center justify-center shadow-sm">
                <ChevronRight size={14} />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Rename Dialog Modal */}
      {isRenaming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white/95 backdrop-blur-2xl border border-white/80 rounded-2xl p-5 w-80 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-[#0F172A]">Rename playlist</h3>
            <input
              type="text"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 text-[#0F172A]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setIsRenaming(false);
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsRenaming(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#64748B] hover:bg-slate-100 transition-colors"
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
