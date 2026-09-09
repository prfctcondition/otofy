import React from 'react';
import { Home, Search, Library, Play, Pause, Heart } from 'lucide-react';
import { Track } from '../types';
import { PlaceholderArtwork } from './PlaceholderArtwork';

interface MobileBottomNavProps {
  currentTrack: Track;
  isPlaying: boolean;
  onPlayToggle: () => void;
  onToggleLike: () => void;
  activeTab: 'home' | 'search' | 'library';
  onSelectTab: (tab: 'home' | 'search' | 'library') => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTrack,
  isPlaying,
  onPlayToggle,
  onToggleLike,
  activeTab,
  onSelectTab,
}) => {
  return (
    <div id="mobile-nav-root" className="w-full shrink-0 flex flex-col bg-white/80 dark:bg-[#08080C]/95 backdrop-blur-2xl border-t border-white/90 dark:border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),0_-4px_20px_rgba(0,0,0,0.04)] dark:shadow-none select-none z-40">
      {/* Persistent Mini Player bar sitting above bottom tabs */}
      <div className="mx-2 my-1 px-3 py-2 rounded-2xl bg-white/90 dark:bg-white/[0.06] backdrop-blur-xl border border-white dark:border-white/10 flex items-center justify-between gap-3 shadow-[0_4px_16px_rgba(0,0,0,0.05),inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-none">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <PlaceholderArtwork
            icon={currentTrack.iconName}
            gradientFrom={currentTrack.gradientFrom}
            gradientTo={currentTrack.gradientTo}
            size={40}
            rounded="rounded-md"
            className="shrink-0 border border-white/80 dark:border-white/10 shadow-sm"
          />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-[#111827] dark:text-white truncate">
              {currentTrack.title}
            </span>
            <span className="text-[11px] text-[#6B7280] dark:text-white/60 truncate">
              {currentTrack.artist}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onToggleLike}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              currentTrack.isLiked
                ? 'text-rose-500'
                : 'text-[#6B7280] dark:text-white/70 hover:text-[#111827] dark:hover:text-white'
            }`}
          >
            <Heart
              size={17}
              fill={currentTrack.isLiked ? 'currentColor' : 'none'}
            />
          </button>
          <button
            onClick={onPlayToggle}
            className="w-8 h-8 rounded-full bg-[#111827] dark:bg-white text-white dark:text-black flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer"
          >
            {isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" className="ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Bottom Tabs */}
      <div className="flex items-center justify-around py-2 px-6">
        <button
          id="tab-mobile-home"
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'home' ? 'text-[#111827] dark:text-white' : 'text-[#9CA3AF] dark:text-white/40 hover:text-[#111827] dark:hover:text-white'
          }`}
        >
          <Home size={20} />
          <span className="text-[10px] font-semibold">Home</span>
        </button>

        <button
          id="tab-mobile-search"
          onClick={() => onSelectTab('search')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'search' ? 'text-[#111827] dark:text-white' : 'text-[#9CA3AF] dark:text-white/40 hover:text-[#111827] dark:hover:text-white'
          }`}
        >
          <Search size={20} />
          <span className="text-[10px] font-semibold">Search</span>
        </button>

        <button
          id="tab-mobile-library"
          onClick={() => onSelectTab('library')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'library' ? 'text-[#111827] dark:text-white' : 'text-[#9CA3AF] dark:text-white/40 hover:text-[#111827] dark:hover:text-white'
          }`}
        >
          <Library size={20} />
          <span className="text-[10px] font-semibold">Your Library</span>
        </button>
      </div>
    </div>
  );
};
