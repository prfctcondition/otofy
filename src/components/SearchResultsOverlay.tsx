import React, { useEffect, useRef } from 'react';
import { Play, Plus, Search, Check, User, ExternalLink, Sparkles, ListMusic, Loader2 } from 'lucide-react';
import { useSearchStore } from '../store/searchStore';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import type { SearchResult, SearchPlaylistResult, Track } from '../types';

interface SearchResultsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenArtist?: (artistName: string, source?: 'YT' | 'SC') => void;
}

export const SearchResultsOverlay: React.FC<SearchResultsOverlayProps> = ({
  isOpen,
  onClose,
  onOpenArtist,
}) => {
  const {
    results,
    playlistResults,
    contentType,
    setContentType,
    artistCard,
    isSearching,
    hasSearched,
    sourceFilter,
    setSourceFilter,
  } = useSearchStore();

  const playTrack = usePlayerStore((state) => state.playTrack);
  const addTrackToPlaylist = useLibraryStore((state) => state.addTrackToPlaylist);
  const selectedPlaylistId = useLibraryStore((state) => state.selectedPlaylistId);
  const [addedIds, setAddedIds] = React.useState<Record<string, boolean>>({});
  const [loadingPlaylistId, setLoadingPlaylistId] = React.useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const resultToTrack = (result: SearchResult): Track => {
    return {
      id: `online-${result.source}-${result.sourceId || result.id}`,
      number: 1,
      title: result.title,
      artist: result.artist,
      album: result.album || (result.source === 'YT' ? 'YouTube Music' : 'SoundCloud'),
      duration: result.duration,
      durationSec: result.durationSec,
      dateAdded: 'Today',
      source: result.source,
      sourceLabel: result.sourceLabel,
      sourceId: result.sourceId,
      artworkUrl: result.artworkUrl,
      iconName: 'music',
      gradientFrom: result.source === 'YT' ? '#DC2626' : '#EA580C',
      gradientTo: '#0F172A',
      isLiked: false,
    };
  };

  const handlePlay = (result: SearchResult) => {
    const track = resultToTrack(result);
    playTrack(track, [track]);
    onClose();
  };

  const handleAdd = async (result: SearchResult, e: React.MouseEvent) => {
    e.stopPropagation();
    const track = resultToTrack(result);
    await addTrackToPlaylist(selectedPlaylistId || 'pl-liked', track);
    setAddedIds((prev) => ({ ...prev, [result.id]: true }));
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [result.id]: false }));
    }, 1800);
  };

  const handleArtistClick = (artistName: string, e: React.MouseEvent, source?: 'YT' | 'SC') => {
    e.stopPropagation();
    if (onOpenArtist) {
      onOpenArtist(artistName, source);
      onClose();
    }
  };

  const handlePlaylistClick = async (playlist: SearchPlaylistResult) => {
    setLoadingPlaylistId(playlist.id);
    try {
      let tracks: Track[] = [];
      if (window.electronAPI?.getPlaylistTracks) {
        const resp = await window.electronAPI.getPlaylistTracks({ id: playlist.id, source: playlist.source });
        if (resp && Array.isArray(resp.tracks)) {
          tracks = resp.tracks.map((t: any, i: number) => ({
            id: `online-${playlist.source}-${t.sourceId || t.id}`,
            number: i + 1,
            title: t.title,
            artist: t.artist,
            album: t.album || playlist.title,
            duration: t.duration || '0:00',
            durationSec: t.durationSec || 0,
            dateAdded: 'Today',
            source: playlist.source,
            sourceLabel: playlist.sourceLabel,
            sourceId: t.sourceId || t.id,
            artworkUrl: t.artworkUrl || playlist.artworkUrl,
            iconName: 'music',
            gradientFrom: playlist.source === 'YT' ? '#DC2626' : '#EA580C',
            gradientTo: '#0F172A',
            isLiked: false,
          }));
        }
      }

      useLibraryStore.getState().setCustomPlaylistView(playlist.title, tracks, {
        creator: playlist.creator,
        artworkUrl: playlist.artworkUrl,
        songCount: tracks.length,
        gradientFrom: playlist.source === 'YT' ? '#DC2626' : '#EA580C',
        gradientTo: '#0F172A',
        description: `${playlist.sourceLabel} • ${playlist.creator}`,
      });

      onClose();
    } catch (err) {
      console.error('[Search] Failed to load playlist tracks:', err);
    } finally {
      setLoadingPlaylistId(null);
    }
  };

  const isEmpty =
    !isSearching &&
    hasSearched &&
    ((contentType === 'tracks' && results.length === 0) ||
      (contentType === 'playlists' && playlistResults.length === 0));

  return (
    <div
      ref={overlayRef}
      className="absolute top-16 left-4 right-4 md:left-64 md:right-64 z-50 max-h-[520px] overflow-y-auto rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-3.5 bg-white/95 dark:bg-[#0C0C10]/95 backdrop-blur-3xl border border-white/90 dark:border-white/10 text-[#0F172A] dark:text-white animate-in fade-in zoom-in-95 duration-150 select-none custom-scrollbar"
    >
      {/* Header with Type & Source Filters */}
      <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] font-bold text-[#475569] dark:text-white/70 uppercase tracking-wider border-b border-black/[0.06] dark:border-white/[0.08] mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          {/* Content Type: Tracks vs Playlists */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-black/[0.05] dark:bg-white/10 border border-black/[0.05] dark:border-white/10 text-[10px] font-bold">
            <button
              onClick={() => setContentType('tracks')}
              className={`px-2.5 py-0.5 rounded-md uppercase font-bold tracking-tight transition-all cursor-pointer ${
                contentType === 'tracks'
                  ? 'bg-[#0F172A] dark:bg-white text-white dark:text-black shadow-xs'
                  : 'text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              Tracks
            </button>
            <button
              onClick={() => setContentType('playlists')}
              className={`px-2.5 py-0.5 rounded-md uppercase font-bold tracking-tight transition-all cursor-pointer ${
                contentType === 'playlists'
                  ? 'bg-[#0F172A] dark:bg-white text-white dark:text-black shadow-xs'
                  : 'text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              Playlists
            </button>
          </div>

          {/* Source Filter: MIXED, YT, SC */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-black/[0.05] dark:bg-white/10 border border-black/[0.05] dark:border-white/10 text-[10px] font-bold lowercase">
            {(
              [
                { id: 'ALL', label: 'MIXED' },
                { id: 'YT', label: 'YT' },
                { id: 'SC', label: 'SC' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setSourceFilter(item.id)}
                className={`px-2 py-0.5 rounded-md uppercase font-bold tracking-tight transition-all cursor-pointer ${
                  sourceFilter === item.id
                    ? 'bg-[#0F172A] dark:bg-white text-white dark:text-black shadow-xs'
                    : 'text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <span className="text-violet-700 dark:text-violet-400 font-bold">
          {contentType === 'tracks' ? `Tracks (${results.length})` : `Playlists (${playlistResults.length})`}
        </span>
      </div>

      {isSearching && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-[#334155] dark:text-white/70">
          <div className="w-10 h-10 rounded-full bg-violet-500/10 dark:bg-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400">
            <span className="inline-block w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-white">
            {contentType === 'playlists' ? 'Searching Playlists...' : 'Searching YouTube Music & SoundCloud...'}
          </p>
        </div>
      )}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-[#334155] dark:text-white/70">
          <Search size={32} className="opacity-40 text-[#64748B] dark:text-white/40" />
          <p className="text-sm font-bold text-[#0F172A] dark:text-white">
            {contentType === 'playlists' ? 'No playlists found' : 'No ad-free streams found'}
          </p>
          <p className="text-xs text-[#475569] dark:text-white/60">
            {contentType === 'playlists'
              ? 'Try searching for genres, artists, moods or playlist names'
              : 'Try searching by song title, artist, or album'}
          </p>
        </div>
      )}

      {/* Playlist Grid View */}
      {!isSearching && contentType === 'playlists' && playlistResults.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-1">
          {playlistResults.map((playlist) => {
            const isLoadingThis = loadingPlaylistId === playlist.id;
            return (
              <div
                key={`${playlist.source}-${playlist.id}`}
                onClick={() => !isLoadingThis && handlePlaylistClick(playlist)}
                className="group relative flex flex-col p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-all duration-200 cursor-pointer border border-transparent hover:border-black/5 dark:hover:border-white/10"
              >
                {/* Artwork with source badge and hover play */}
                <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-slate-900 border border-black/5 dark:border-white/10 mb-2 shadow-xs">
                  {playlist.artworkUrl ? (
                    <img
                      src={playlist.artworkUrl}
                      alt={playlist.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-800 text-white">
                      <ListMusic size={32} />
                    </div>
                  )}

                  {/* Source Badge */}
                  <div className="absolute top-1.5 right-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold text-white shadow-xs ${
                        playlist.source === 'YT' ? 'bg-red-600' : 'bg-orange-500'
                      }`}
                    >
                      {playlist.source}
                    </span>
                  </div>

                  {/* Hover Play / Loading Overlay */}
                  <div
                    className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                      isLoadingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg transform transition-transform">
                      {isLoadingThis ? (
                        <Loader2 size={18} className="animate-spin text-black" />
                      ) : (
                        <Play size={18} fill="currentColor" className="ml-0.5" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Playlist Info */}
                <h5 className="text-xs font-bold text-[#0F172A] dark:text-white truncate leading-snug" title={playlist.title}>
                  {playlist.title}
                </h5>
                <p className="text-[11px] text-[#64748B] dark:text-white/60 truncate mt-0.5">
                  {playlist.creator}
                </p>
                {playlist.songCount ? (
                  <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 mt-1">
                    {playlist.songCount} tracks
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Tracks List View */}
      {!isSearching && contentType === 'tracks' && results.length > 0 && (
        <div className="flex flex-col gap-1">
          {/* Official Artist Card Banner */}
          {artistCard && (
            <div
              className="mb-2.5 p-3 rounded-xl bg-gradient-to-r from-violet-600/15 via-indigo-600/10 to-transparent border border-violet-500/25 flex items-center justify-between gap-3 hover:bg-violet-600/20 transition-all cursor-pointer group shadow-xs"
              onClick={(e) => handleArtistClick(artistCard.name, e, artistCard.source || 'YT')}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-violet-900 border-2 border-white/90 shadow-md">
                  {artistCard.avatarUrl ? (
                    <img
                      src={artistCard.avatarUrl}
                      alt={artistCard.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white">
                      <User size={20} />
                    </div>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-[#0F172A] dark:text-white truncate">
                      {artistCard.name}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white shadow-xs">
                      <Sparkles size={10} /> Official Artist
                    </span>
                  </div>
                  <span className="text-xs text-[#334155] dark:text-white/80 font-semibold truncate mt-0.5">
                    {artistCard.subtitle || 'Official YouTube Music Channel & Discography'}
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => handleArtistClick(artistCard.name, e, artistCard.source || 'YT')}
                className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full bg-white/80 dark:bg-white/20 hover:bg-white dark:hover:bg-white/30 text-violet-700 dark:text-violet-300 shadow-xs border border-violet-200/60 dark:border-violet-500/30 flex-shrink-0 transition-all"
              >
                <span>View Discography</span>
                <ExternalLink size={12} />
              </button>
            </div>
          )}

          {results.map((result) => (
            <div
              key={result.id}
              className="group flex items-center justify-between p-2.5 hover:bg-white/65 dark:hover:bg-white/10 active:bg-white/85 dark:active:bg-white/15 rounded-xl transition-all cursor-pointer"
              onClick={() => handlePlay(result)}
            >
              <div className="flex items-center gap-3 overflow-hidden min-w-0">
                {/* Artwork with specular highlight */}
                <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-slate-900 border border-white/80 dark:border-white/10 shadow-xs">
                  {result.artworkUrl ? (
                    <img src={result.artworkUrl} alt={result.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#0F172A] text-white/70">
                      <Play size={18} fill="currentColor" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play size={18} className="text-white fill-white ml-0.5" />
                  </div>
                </div>

                <div className="flex flex-col overflow-hidden min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold text-sm text-[#0F172A] dark:text-white">
                      {result.title}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-black text-white flex-shrink-0 shadow-xs ${
                        result.source === 'YT' ? 'bg-red-600' : 'bg-orange-500'
                      }`}
                    >
                      {result.source}
                    </span>
                  </div>
                  <span
                    className="truncate text-xs font-semibold text-[#1E293B] dark:text-white/80 hover:text-violet-700 dark:hover:text-violet-400 hover:underline transition-colors mt-0.5"
                    onClick={(e) => handleArtistClick(result.artist, e, result.source)}
                    title={`View ${result.artist} discography`}
                  >
                    {result.artist} {result.album ? `• ${result.album}` : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pl-2 flex-shrink-0">
                <span className="text-xs font-mono font-bold text-[#334155] dark:text-white/70">
                  {result.duration}
                </span>
                <button
                  onClick={(e) => handleAdd(result, e)}
                  className={`p-2 rounded-full transition-all cursor-pointer ${
                    addedIds[result.id]
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'hover:bg-white/80 dark:hover:bg-white/15 text-[#334155] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white'
                  }`}
                  title={addedIds[result.id] ? 'Added to playlist!' : 'Add to current playlist'}
                >
                  {addedIds[result.id] ? <Check size={16} /> : <Plus size={16} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchResultsOverlay;
