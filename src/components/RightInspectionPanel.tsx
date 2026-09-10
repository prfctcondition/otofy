import React, { useState } from 'react';
import {
  X,
  Heart,
  Plus,
  Play,
  Sparkles,
  Mic2,
} from 'lucide-react';
import { Track } from '../types';
import { PlaceholderArtwork } from './PlaceholderArtwork';
import { MOCK_ARTIST_INFO } from '../data/musicData';
import { useLibraryStore } from '../store/libraryStore';

interface RightInspectionPanelProps {
  track: Track;
  nextTrack?: Track;
  onClose: () => void;
  onToggleLike: (trackId: string) => void;
  onPlayNextTrack?: (track: Track) => void;
  onSelectArtist?: (artist: string) => void;
}

export const RightInspectionPanel: React.FC<RightInspectionPanelProps> = ({
  track,
  nextTrack,
  onClose,
  onToggleLike,
  onPlayNextTrack,
  onSelectArtist,
}) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const toggleLyricsModal = useLibraryStore((s) => s.toggleLyricsModal);

  const artistData =
    MOCK_ARTIST_INFO[track.artist] || MOCK_ARTIST_INFO.default;

  return (
    <aside
      id="right-inspection-panel"
      className="w-[300px] min-w-[300px] h-full flex flex-col liquid-glass-panel rounded-2xl select-none overflow-hidden relative"
    >
      {/* Top Gloss Reflection */}
      <div className="pointer-events-none absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-white/70 dark:from-white/[0.05] to-transparent" />

      {/* Panel Header */}
      <div className="p-3.5 flex items-center justify-between border-b border-black/[0.05] dark:border-white/10 relative z-10">
        <span
          className="text-xs font-bold text-[#0F172A] dark:text-white truncate uppercase tracking-wider pr-2 flex items-center gap-1.5"
          title={track.title}
        >
          <Sparkles size={12} className="text-[#0F172A] dark:text-white" />
          {track.title}
        </span>
        <button
          id="close-right-panel-btn"
          onClick={onClose}
          className="p-1 rounded-full text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/10 transition-colors shrink-0"
          title="Close panel"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10">
        {/* Large Crisp Artwork Cover on Glossy Card */}
        <div className="relative group shadow-[0_8px_24px_rgba(0,0,0,0.08)] rounded-2xl p-1 bg-white/70 dark:bg-white/[0.05] backdrop-blur-md border border-white dark:border-white/10">
          <PlaceholderArtwork
            icon={track.iconName}
            imageUrl={track.artworkUrl}
            source={track.source}
            sourceId={track.sourceId}
            gradientFrom={track.gradientFrom}
            gradientTo={track.gradientTo}
            size={262}
            iconSize={110}
            rounded="rounded-xl"
            className="w-full aspect-square shadow-sm"
          />
          {/* Specular Sheen */}
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-tr from-white/40 via-transparent to-black/10 dark:to-transparent" />
        </div>

        {/* Track Title, Artist, & Quick Actions */}
        <div className="flex items-start justify-between gap-2 pt-1">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-[#0F172A] dark:text-white truncate leading-tight">
              {track.title}
            </h2>
            <p
              onClick={() => onSelectArtist?.(track.artist)}
              className="text-xs text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white hover:underline cursor-pointer truncate mt-0.5 font-normal transition-colors"
              title={`View ${track.artist}`}
            >
              {track.artist}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onToggleLike(track.id)}
              className={`p-1.5 rounded-full transition-colors ${
                track.isLiked
                  ? 'text-rose-500 hover:text-rose-600'
                  : 'text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white'
              }`}
              title={track.isLiked ? 'Liked' : 'Like'}
            >
              <Heart
                size={18}
                fill={track.isLiked ? 'currentColor' : 'none'}
              />
            </button>
            <button
              onClick={() => toggleLyricsModal()}
              className="p-1.5 rounded-full text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Lyrics & Karaoke"
            >
              <Mic2 size={18} />
            </button>
            <button
              className="p-1.5 rounded-full text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white transition-colors"
              title="Add to playlist"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* "About the Artist" Card in Frosted Glass */}
        <div className="rounded-xl bg-white/50 dark:bg-white/[0.04] backdrop-blur-xl border border-white/80 dark:border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_1.5px_#FFFFFF] dark:shadow-none overflow-hidden">
          {/* Artist Banner */}
          <div
            className="h-20 w-full relative flex items-end p-3 bg-gradient-to-tr from-black/[0.05] via-transparent to-transparent dark:from-white/[0.06] dark:via-transparent dark:to-transparent"
          >
            <span className="relative z-10 text-[11px] font-bold text-[#94A3B8] dark:text-white/60 uppercase tracking-wider">
              About the artist
            </span>
          </div>

          <div className="p-3.5 pt-2">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div>
                <span
                  onClick={() => onSelectArtist?.(artistData.name)}
                  className="text-sm font-bold text-[#0F172A] dark:text-white hover:text-[#0F172A] dark:hover:text-white hover:underline cursor-pointer block transition-colors"
                  title={`View ${artistData.name}`}
                >
                  {artistData.name}
                </span>
                <span className="text-xs text-[#64748B] dark:text-white/70 font-normal">
                  {artistData.listeners}
                </span>
              </div>
              <button
                onClick={() => setIsFollowing(!isFollowing)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  isFollowing
                    ? 'bg-[#0F172A] dark:bg-white text-white dark:text-black border-[#0F172A] dark:border-white shadow-[0_4px_14px_rgba(15,23,42,0.25)]'
                    : 'bg-white/65 dark:bg-white/[0.08] text-[#0F172A] dark:text-white border-white/95 dark:border-white/15 hover:bg-white dark:hover:bg-white/20 shadow-[inset_0_1px_1.5px_#FFFFFF,0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-none'
                }`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>

            <p className="text-xs text-[#64748B] dark:text-white/80 leading-relaxed">
              {artistData.bio}
            </p>
          </div>
        </div>

        {/* Next in Queue Preview Card */}
        {nextTrack && (
          <div className="rounded-xl bg-white/50 dark:bg-white/[0.04] backdrop-blur-xl border border-white/80 dark:border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.03),inset_0_1px_1.5px_#FFFFFF] dark:shadow-none p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[#94A3B8] dark:text-white/60 uppercase tracking-wider">
                Next in queue
              </span>
              <span className="text-[11px] text-[#0F172A] dark:text-white font-semibold cursor-pointer hover:underline">
                Open queue
              </span>
            </div>

            <div
              onClick={() => onPlayNextTrack?.(nextTrack)}
              className="group flex items-center gap-3 p-1.5 rounded-lg hover:bg-white/65 dark:hover:bg-white/[0.08] cursor-pointer transition-colors"
            >
              <PlaceholderArtwork
                icon={nextTrack.iconName}
                imageUrl={nextTrack.artworkUrl}
                gradientFrom={nextTrack.gradientFrom}
                gradientTo={nextTrack.gradientTo}
                size={38}
                rounded="rounded-md"
                className="shrink-0 border border-white/80 dark:border-white/20 shadow-sm"
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-[#0F172A] dark:text-white truncate block">
                  {nextTrack.title}
                </span>
                <span className="text-[11px] text-[#64748B] dark:text-white/70 truncate block">
                  {nextTrack.artist}
                </span>
              </div>
              <div className="w-6 h-6 rounded-full bg-[#0F172A] dark:bg-white text-white dark:text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shrink-0 shadow-md">
                <Play size={10} fill="currentColor" className="ml-0.5" />
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
