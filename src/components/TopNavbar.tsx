import React, { useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Search,
  Compass,
  PanelRight,
  PanelRightClose,
  Cloud,
  X,
} from 'lucide-react';
import { ViewportMode } from '../types';
import { useSearchStore } from '../store/searchStore';
import { useLibraryStore } from '../store/libraryStore';

interface TopNavbarProps {
  viewportMode: ViewportMode;
  onToggleViewport: (mode: ViewportMode) => void;
  isRightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  currentView: 'home' | 'playlist';
  onNavigateHome: () => void;
  onNavigateBack: () => void;
  canGoBack: boolean;
  canGoForward?: boolean;
  onNavigateForward?: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  viewportMode,
  onToggleViewport,
  isRightPanelOpen,
  onToggleRightPanel,
  currentView,
  onNavigateHome,
  onNavigateBack,
  canGoBack,
  canGoForward = false,
  onNavigateForward,
  searchQuery,
  onSearchChange,
}) => {
  const searchStore = useSearchStore();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    onSearchChange(query);
    searchStore.setQuery(query);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    searchTimeoutRef.current = setTimeout(() => {
      searchStore.search(query);
    }, 500);
  };

  return (
    <header className="h-14 shrink-0 px-4 flex items-center justify-between gap-3 select-none bg-white/40 backdrop-blur-[35px] border-b border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1.2px_1.5px_rgba(255,255,255,0.95)] z-30">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-[#64748B]">
          <button
            id="nav-back-button"
            onClick={onNavigateBack}
            disabled={!canGoBack}
            className={`p-1.5 rounded-full transition-all duration-150 ${
              canGoBack
                ? 'hover:bg-white/60 hover:text-[#0F172A] cursor-pointer text-[#0F172A]'
                : 'text-[#94A3B8]/40 cursor-not-allowed'
            }`}
            title="Go back"
            aria-label="Back"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            id="nav-forward-button"
            onClick={onNavigateForward}
            disabled={!canGoForward}
            className={`p-1.5 rounded-full transition-all duration-150 ${
              canGoForward
                ? 'hover:bg-white/60 hover:text-[#0F172A] cursor-pointer text-[#0F172A]'
                : 'text-[#94A3B8]/40 cursor-not-allowed'
            }`}
            title="Go forward"
            aria-label="Forward"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <button
          id="nav-home-button"
          onClick={onNavigateHome}
          className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all ${
            currentView === 'home'
              ? 'bg-white text-[#0F172A] border-white shadow-[0_4px_12px_rgba(0,0,0,0.08),inset_0_1px_1.5px_rgba(255,255,255,1)] ring-2 ring-violet-500/20'
              : 'bg-white/65 hover:bg-white/85 text-[#64748B] hover:text-[#0F172A] border-white/95 shadow-[0_2px_8px_rgba(0,0,0,0.05),inset_0_1px_1.5px_rgba(255,255,255,1)]'
          }`}
          title="Home"
          aria-label="Home"
        >
          <Home size={18} />
        </button>
      </div>

      <div className="flex-1 max-w-xl mx-auto flex items-center gap-2">
        <div className="relative flex items-center flex-1 h-10 px-3.5 rounded-full bg-white/60 hover:bg-white/75 focus-within:bg-white/90 backdrop-blur-xl border border-white/90 focus-within:border-[#0F172A]/30 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.95),0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200">
          <Search size={17} className="text-[#64748B] shrink-0 mr-2.5" />
          <input
            id="global-search-input"
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="What do you want to play?"
            className="w-full bg-transparent text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => {
                onSearchChange('');
                searchStore.setQuery('');
                searchStore.clearResults();
              }}
              className="p-1 rounded-full text-[#94A3B8] hover:text-[#0F172A] hover:bg-black/5 transition-colors mr-1 cursor-pointer"
              title="Clear search"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
          <button
            id="browse-categories-button"
            className="p-1 rounded-full text-[#94A3B8] hover:text-[#0F172A] transition-colors"
            title="Browse categories"
            aria-label="Browse"
          >
            <Compass size={16} />
          </button>
        </div>

        {/* Source Filter Selector (MIXED, YT, SC) */}
        <div className="hidden sm:flex items-center p-0.5 rounded-full bg-white/60 backdrop-blur-xl border border-white/90 shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_1.5px_rgba(255,255,255,0.95)] text-[11px] font-bold">
          {(
            [
              { id: 'ALL', label: 'MIXED' },
              { id: 'YT', label: 'YT' },
              { id: 'SC', label: 'SC' },
            ] as const
          ).map((item) => {
            const isActive = searchStore.sourceFilter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => searchStore.setSourceFilter(item.id)}
                className={`px-2.5 py-1 rounded-full transition-all duration-150 ${
                  isActive
                    ? 'bg-[#0F172A] text-white shadow-xs scale-[1.02]'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white/60'
                }`}
                title={`Search ${item.label}`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Account Sync (YouTube / SoundCloud) */}
        <button
          id="account-sync-btn"
          onClick={() => useLibraryStore.getState().toggleSyncModal()}
          className="p-2 rounded-full text-[#64748B] hover:text-indigo-600 hover:bg-black/5 transition-colors"
          title="Account Sync (YouTube Music / SoundCloud)"
          aria-label="Account Sync"
        >
          <Cloud size={18} />
        </button>

        {viewportMode === 'desktop' && (
          <button
            id="toggle-right-sidebar-btn"
            onClick={onToggleRightPanel}
            className={`p-2 rounded-full transition-colors ${
              isRightPanelOpen
                ? 'text-violet-700 bg-white/90 border border-white shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-black/5'
            }`}
            title={isRightPanelOpen ? 'Hide Now Playing panel' : 'Show Now Playing panel'}
            aria-label="Toggle Now Playing"
          >
            {isRightPanelOpen ? <PanelRightClose size={18} /> : <PanelRight size={18} />}
          </button>
        )}

        <div
          id="user-profile-avatar-btn"
          className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 via-indigo-500 to-fuchsia-500 p-0.5 cursor-pointer hover:scale-105 transition-transform shadow-[0_1px_6px_rgba(99,102,241,0.25)]"
          title="Profile (alex.stream)"
        >
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-xs font-bold text-[#0F172A]">
            A
          </div>
        </div>
      </div>
    </header>
  );
};
