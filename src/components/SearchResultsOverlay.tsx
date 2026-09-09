import React, { useEffect, useRef } from 'react';
import { Play, Plus, Search, Check, User, ExternalLink, Sparkles } from 'lucide-react';
import { useSearchStore } from '../store/searchStore';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import type { SearchResult, Track } from '../types';

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
  const { results, artistCard, isSearching, hasSearched, sourceFilter, setSourceFilter } = useSearchStore();
  const playTrack = usePlayerStore((state) => state.playTrack);
  const addTrackToPlaylist = useLibraryStore((state) => state.addTrackToPlaylist);
  const selectedPlaylistId = useLibraryStore((state) => state.selectedPlaylistId);
  const [addedIds, setAddedIds] = React.useState<Record<string, boolean>>({});
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

  return (
    <div
      ref={overlayRef}
      className="absolute top-16 left-4 right-4 md:left-64 md:right-64 z-50 max-h-[500px] overflow-y-auto rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.12),inset_0_1.5px_1.5px_#FFFFFF] p-3.5 bg-white/92 backdrop-blur-3xl border border-white/90 text-[#0F172A] animate-in fade-in zoom-in-95 duration-150 select-none"
    >
      {isSearching && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-[#334155]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#0F172A] drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]">
            Searching YouTube Music & SoundCloud...
          </p>
        </div>
      )}

      {!isSearching && hasSearched && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-[#334155]">
          <Search size={32} className="opacity-50 text-[#64748B]" />
          <p className="text-sm font-bold text-[#0F172A] drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]">No ad-free streams found</p>
          <p className="text-xs text-[#475569] drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]">Try searching by song title, artist, or album</p>
        </div>
      )}

      {!isSearching && results.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] font-bold text-[#475569] uppercase tracking-wider border-b border-black/[0.06] mb-1.5">
            <div className="flex items-center gap-2">
              <span className="drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]">Results ({results.length})</span>
              <div className="inline-flex items-center p-0.5 rounded-lg bg-black/[0.05] border border-black/[0.05] text-[10px] font-bold lowercase">
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
                    className={`px-2 py-0.5 rounded-md uppercase font-bold tracking-tight transition-all ${
                      sourceFilter === item.id
                        ? 'bg-[#0F172A] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-violet-700 font-bold drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]">Ad-Free Streams</span>
          </div>

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
                    <span className="font-bold text-sm text-[#0F172A] drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)] truncate">
                      {artistCard.name}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white shadow-xs">
                      <Sparkles size={10} /> Official Artist
                    </span>
                  </div>
                  <span className="text-xs text-[#334155] font-semibold drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)] truncate mt-0.5">
                    {artistCard.subtitle || 'Official YouTube Music Channel & Discography'}
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => handleArtistClick(artistCard.name, e, artistCard.source || 'YT')}
                className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full bg-white/80 hover:bg-white text-violet-700 shadow-xs border border-violet-200/60 flex-shrink-0 transition-all drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]"
              >
                <span>View Discography</span>
                <ExternalLink size={12} />
              </button>
            </div>
          )}

          {results.map((result) => (
            <div
              key={result.id}
              className="group flex items-center justify-between p-2.5 hover:bg-white/65 active:bg-white/85 rounded-xl transition-all cursor-pointer"
              onClick={() => handlePlay(result)}
            >
              <div className="flex items-center gap-3 overflow-hidden min-w-0">
                {/* Artwork with specular highlight */}
                <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-slate-900 border border-white/80 shadow-xs">
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
                    <span className="truncate font-bold text-sm text-[#0F172A] drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]">
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
                    className="truncate text-xs font-semibold text-[#1E293B] drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)] hover:text-violet-700 hover:underline transition-colors mt-0.5"
                    onClick={(e) => handleArtistClick(result.artist, e, result.source)}
                    title={`View ${result.artist} discography`}
                  >
                    {result.artist} {result.album ? `• ${result.album}` : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pl-2 flex-shrink-0">
                <span className="text-xs font-mono font-bold text-[#334155] drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]">
                  {result.duration}
                </span>
                <button
                  onClick={(e) => handleAdd(result, e)}
                  className={`p-2 rounded-full transition-all ${
                    addedIds[result.id]
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'hover:bg-white/80 text-[#334155] hover:text-[#0F172A] drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]'
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
