import React, { useState } from 'react';
import {
  Play,
  Pause,
  Clock,
  Heart,
  MoreHorizontal,
  Loader2,
} from 'lucide-react';
import { Track } from '../types';
import { PlaceholderArtwork } from './PlaceholderArtwork';
import { TrackContextMenu } from './TrackContextMenu';
import { useLibraryStore } from '../store/libraryStore';
import { usePlayerStore } from '../store/playerStore';

interface DenseTrackTableProps {
  tracks: Track[];
  activeTrackId: string;
  isPlaying: boolean;
  onTrackSelect: (track: Track, queue: Track[]) => void;
  onPlayToggle: () => void;
  onToggleLike: (trackId: string, track?: Track) => void;
  onSelectArtist?: (artist: string, source?: 'YT' | 'SC') => void;
  onSelectAlbum?: (browseId?: string, albumTitle?: string, artistName?: string, source?: 'YT' | 'SC') => void;
}

export const DenseTrackTable: React.FC<DenseTrackTableProps> = ({
  tracks,
  activeTrackId,
  isPlaying,
  onTrackSelect,
  onPlayToggle,
  onToggleLike,
  onSelectArtist,
  onSelectAlbum,
}) => {
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    track: Track;
    x: number;
    y: number;
  } | null>(null);

  const playlists = useLibraryStore((s) => s.playlists);
  const addTrackToPlaylist = useLibraryStore((s) => s.addTrackToPlaylist);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const selectPlaylist = useLibraryStore((s) => s.selectPlaylist);
  const isBuffering = usePlayerStore((s) => s.isBuffering);

  const handleCreatePlaylistWithTrack = async (trk: Track) => {
    const newPl = await createPlaylist({
      title: `${trk.title} Mix`,
      iconName: 'sparkles',
    });
    await addTrackToPlaylist(newPl.id, trk);
    await selectPlaylist(newPl.id);
  };

  const renderSourceBadge = (source: Track['source']) => {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide bg-white/70 text-[#334155] border border-white/90 shadow-[inset_0_1px_1px_#FFFFFF]">
        {source === 'Master' ? 'MQA' : source}
      </span>
    );
  };

  return (
    <div id="dense-track-table" className="w-full px-6 py-2 select-none">
      <div className="grid grid-cols-12 gap-3 px-3 py-2 border-b border-black/[0.05] text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">
        <div className="col-span-1 flex items-center justify-center">#</div>
        <div className="col-span-5 flex items-center">Title</div>
        <div className="col-span-3 hidden md:flex items-center">Album</div>
        <div className="col-span-2 hidden lg:flex items-center">Date Added</div>
        <div className="col-span-6 md:col-span-3 lg:col-span-1 flex items-center justify-end pr-2">
          <Clock size={14} />
        </div>
      </div>

      <div className="space-y-1 mt-1.5">
        {tracks.length === 0 ? (
          <div className="py-16 px-4 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/40 border border-white/80 flex items-center justify-center text-violet-500 mb-3 shadow-xs">
              <Clock size={28} className="opacity-80" />
            </div>
            <h4 className="text-base font-bold text-[#0F172A] mb-1">No songs in this collection</h4>
            <p className="text-xs text-[#64748B] max-w-sm leading-relaxed">
              Use the top search bar to find and add ad-free songs from YouTube Music & SoundCloud, or import a CS2 share code.
            </p>
          </div>
        ) : (
          tracks.map((track, index) => {
            const isCurrent = track.id === activeTrackId;
            const isHovered = hoveredRowId === track.id;

            return (
              <div
                key={track.id}
                id={`track-row-${track.id}`}
                onMouseEnter={() => setHoveredRowId(track.id)}
                onMouseLeave={() => setHoveredRowId(null)}
                onClick={() => onTrackSelect(track, tracks)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ track, x: e.clientX, y: e.clientY });
                }}
                className={`group relative grid grid-cols-12 gap-3 px-3 py-2 rounded-xl items-center cursor-pointer transition-all duration-150 ${
                  isCurrent
                    ? 'bg-white/90 border border-violet-200/80 shadow-[0_4px_16px_rgba(124,58,237,0.08),inset_0_1px_1.5px_#FFFFFF] text-[#0F172A] ring-1 ring-violet-500/20'
                    : 'hover:bg-white/50 hover:border hover:border-white/80 text-[#334155] border border-transparent'
                }`}
              >
                <div className="col-span-1 flex items-center justify-center text-sm font-medium">
                  {isHovered ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isCurrent) {
                          onPlayToggle();
                        } else {
                          onTrackSelect(track, tracks);
                        }
                      }}
                      className="text-[#0F172A] hover:text-black active:scale-90 transition-all p-1"
                      title={isCurrent && isPlaying ? 'Pause' : 'Play'}
                    >
                      {isCurrent && isBuffering ? (
                        <Loader2 size={14} className="animate-spin text-violet-600" />
                      ) : isCurrent && isPlaying ? (
                        <Pause size={14} fill="currentColor" />
                      ) : (
                        <Play size={14} fill="currentColor" />
                      )}
                    </button>
                  ) : isCurrent && isBuffering ? (
                    <Loader2 size={14} className="animate-spin text-violet-600" title="Loading audio..." />
                  ) : isCurrent && isPlaying ? (
                    <div className="flex items-end gap-0.5 h-3.5" title="Playing">
                      <span className="w-0.5 bg-violet-600 animate-[bounce_0.8s_infinite] h-full rounded-full" />
                      <span className="w-0.5 bg-violet-600/80 animate-[bounce_0.6s_infinite] h-2/3 rounded-full" />
                      <span className="w-0.5 bg-violet-600/90 animate-[bounce_1.0s_infinite] h-5/6 rounded-full" />
                    </div>
                  ) : (
                    <span
                      className={`text-xs ${
                        isCurrent ? 'text-violet-700 font-bold' : 'text-[#94A3B8]'
                      }`}
                    >
                      {track.number || index + 1}
                    </span>
                  )}
                </div>

                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <PlaceholderArtwork
                    icon={track.iconName}
                    imageUrl={track.artworkUrl}
                    source={track.source}
                    sourceId={track.sourceId}
                    gradientFrom={track.gradientFrom}
                    gradientTo={track.gradientTo}
                    size={42}
                    rounded="rounded-lg"
                    className="shrink-0 shadow-sm border border-white/80"
                  />
                  <div className="flex flex-col min-w-0">
                    <span
                      className={`text-sm font-semibold truncate ${
                        isCurrent ? 'text-[#0F172A] font-bold' : 'text-[#0F172A]'
                      }`}
                    >
                      {track.title}
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectArtist?.(track.artist, track.source === 'SC' ? 'SC' : 'YT');
                      }}
                      className="text-xs text-[#64748B] truncate hover:text-violet-700 hover:underline cursor-pointer transition-colors"
                      title={`View ${track.artist}`}
                    >
                      {track.artist}
                    </span>
                  </div>
                </div>

                <div className="col-span-3 hidden md:flex items-center justify-between gap-2 min-w-0">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      if (track.album && onSelectAlbum) {
                        onSelectAlbum(undefined, track.album, track.artist, track.source === 'SC' ? 'SC' : 'YT');
                      }
                    }}
                    className={`text-xs text-[#64748B] truncate transition-colors ${
                      track.album ? 'hover:text-violet-700 hover:underline cursor-pointer' : ''
                    }`}
                    title={track.album ? `View album ${track.album}` : undefined}
                  >
                    {track.album}
                  </span>
                  <div className="shrink-0">{renderSourceBadge(track.source)}</div>
                </div>

                <div className="col-span-2 hidden lg:flex items-center text-xs text-[#64748B]">
                  {track.dateAdded}
                </div>

                <div className="col-span-6 md:col-span-3 lg:col-span-1 flex items-center justify-end gap-2 pr-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLike(track.id, track);
                    }}
                    className={`p-1 rounded-full transition-colors ${
                      track.isLiked
                        ? 'text-rose-500 hover:text-rose-600'
                        : isHovered
                        ? 'text-[#94A3B8] hover:text-[#0F172A]'
                        : 'opacity-0'
                    }`}
                    title={track.isLiked ? 'Remove from Liked' : 'Save to Liked Songs'}
                  >
                    <Heart
                      size={15}
                      fill={track.isLiked ? 'currentColor' : 'none'}
                    />
                  </button>

                  <span className="text-xs text-[#64748B] w-9 text-right tabular-nums">
                    {track.duration}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setContextMenu({ track, x: rect.left - 180, y: rect.bottom + 6 });
                    }}
                    className={`p-1 rounded-full text-[#94A3B8] hover:text-[#0F172A] transition-colors ${
                      isHovered ? 'opacity-100' : 'opacity-0'
                    }`}
                    title="More actions"
                  >
                    <MoreHorizontal size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {contextMenu && (
        <TrackContextMenu
          track={contextMenu.track}
          x={contextMenu.x}
          y={contextMenu.y}
          playlists={playlists}
          onClose={() => setContextMenu(null)}
          onPlay={(t) => onTrackSelect(t, tracks)}
          onAddToPlaylist={(plId, t) => addTrackToPlaylist(plId, t)}
          onCreatePlaylistWithTrack={handleCreatePlaylistWithTrack}
          onToggleLike={onToggleLike}
          onSelectArtist={onSelectArtist}
        />
      )}
    </div>
  );
};
