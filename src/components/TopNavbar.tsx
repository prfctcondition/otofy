import React, { useRef, useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Search,
  PanelRight,
  PanelRightClose,
  Cloud,
  X,
  Minus,
  Square,
  Copy,
  Sun,
  Moon,
} from 'lucide-react';
import { ViewportMode } from '../types';
import { useSearchStore } from '../store/searchStore';
import { useLibraryStore } from '../store/libraryStore';
import { useThemeStore } from '../store/themeStore';
import { UserProfileDropdown } from './UserProfileDropdown';

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
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const { theme, toggleTheme } = useThemeStore();
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('User');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);

  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI);

  useEffect(() => {
    if (isElectron && window.electronAPI?.getUserProfile) {
      window.electronAPI.getUserProfile().then((profile) => {
        if (profile?.avatarUrl) {
          setUserAvatar(profile.avatarUrl);
        }
        if (profile?.username) {
          setUserName(profile.username);
        }
      }).catch(() => {});
    }
  }, [isElectron]);

  useEffect(() => {
    if (isElectron && window.electronAPI?.isMaximized) {
      window.electronAPI.isMaximized().then((max) => setIsMaximized(Boolean(max)));
    }
    if (isElectron && window.electronAPI?.onWindowState) {
      return window.electronAPI.onWindowState((max) => setIsMaximized(max));
    }
  }, [isElectron]);

  const handleMinimize = () => window.electronAPI?.windowControl('minimize');
  const handleMaximize = () => window.electronAPI?.windowControl('maximize');
  const handleClose = () => window.electronAPI?.windowControl('close');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    onSearchChange(query);
    searchStore.setQuery(query);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    searchTimeoutRef.current = setTimeout(() => {
      searchStore.search(query);
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (searchQuery.trim().length > 0) {
        searchStore.search(searchQuery.trim());
      }
    }
  };

  return (
    <header
      className="h-14 shrink-0 px-4 flex items-center justify-between gap-3 select-none bg-white/40 dark:bg-black/80 backdrop-blur-[35px] border-b border-white/80 dark:border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1.2px_1.5px_rgba(255,255,255,0.95)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.8)] z-30"
      style={{ WebkitAppRegion: 'drag' as any }}
    >
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' as any }}>
        <div className="flex items-center gap-1 text-[#64748B] dark:text-white/80">
          <button
            id="nav-back-button"
            onClick={onNavigateBack}
            disabled={!canGoBack}
            className={`p-1.5 rounded-full transition-all duration-150 ${
              canGoBack
                ? 'hover:bg-white/60 dark:hover:bg-white/10 hover:text-[#0F172A] dark:hover:text-white cursor-pointer text-[#0F172A] dark:text-white'
                : 'text-[#94A3B8]/40 dark:text-white/20 cursor-not-allowed'
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
                ? 'hover:bg-white/60 dark:hover:bg-white/10 hover:text-[#0F172A] dark:hover:text-white cursor-pointer text-[#0F172A] dark:text-white'
                : 'text-[#94A3B8]/40 dark:text-white/20 cursor-not-allowed'
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
              ? 'bg-white dark:bg-white/15 text-[#0F172A] dark:text-white border-white dark:border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.08),inset_0_1px_1.5px_rgba(255,255,255,1)] dark:shadow-none ring-2 ring-violet-500/30'
              : 'bg-white/65 dark:bg-white/[0.06] hover:bg-white/85 dark:hover:bg-white/[0.12] text-[#64748B] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white border-white/95 dark:border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.05),inset_0_1px_1.5px_rgba(255,255,255,1)] dark:shadow-none'
          }`}
          title="Home"
          aria-label="Home"
        >
          <Home size={18} />
        </button>
      </div>

      <div className="flex-1 max-w-xl mx-auto flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' as any }}>
        <div className="relative flex items-center flex-1 h-10 px-3.5 rounded-full bg-white/60 dark:bg-white/[0.06] hover:bg-white/75 dark:hover:bg-white/[0.09] focus-within:bg-white/90 dark:focus-within:bg-white/[0.12] backdrop-blur-xl border border-white/90 dark:border-white/10 focus-within:border-[#0F172A]/30 dark:focus-within:border-white/30 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.95),0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none transition-all duration-200">
          <Search size={17} className="text-[#64748B] dark:text-white/70 shrink-0 mr-2.5" />
          <input
            id="global-search-input"
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            placeholder="What do you want to play?"
            className="w-full bg-transparent text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-white/40 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => {
                onSearchChange('');
                searchStore.setQuery('');
                searchStore.clearResults();
              }}
              className="p-1 rounded-full text-[#94A3B8] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors mr-1 cursor-pointer"
              title="Clear search"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' as any }}>
        {/* Theme Switcher Pill (Smooth Dual-Icon Toggle) */}
        <button
          id="theme-toggle-btn"
          onClick={toggleTheme}
          className="relative flex items-center justify-between w-14 h-7 p-0.5 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 border border-black/10 dark:border-white/15 transition-all duration-200 cursor-pointer select-none"
          title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
          aria-label="Toggle Theme"
        >
          {/* Sliding indicator */}
          <div
            className={`absolute top-0.5 bottom-0.5 w-6 h-6 rounded-full bg-white dark:bg-white shadow-[0_1px_3px_rgba(0,0,0,0.15)] transition-transform duration-200 ease-out pointer-events-none ${
              theme === 'dark' ? 'translate-x-7' : 'translate-x-0'
            }`}
          />
          <div className="relative z-10 w-6 h-6 flex items-center justify-center">
            <Sun
              size={13}
              className={`transition-colors duration-200 ${
                theme === 'light' ? 'text-amber-500' : 'text-zinc-400 dark:text-white/40'
              }`}
            />
          </div>
          <div className="relative z-10 w-6 h-6 flex items-center justify-center">
            <Moon
              size={13}
              className={`transition-colors duration-200 ${
                theme === 'dark' ? 'text-black' : 'text-zinc-400'
              }`}
            />
          </div>
        </button>

        {/* Account Sync (YouTube / SoundCloud) */}
        <button
          id="account-sync-btn"
          onClick={() => useLibraryStore.getState().toggleSyncModal()}
          className="p-2 rounded-full text-[#64748B] dark:text-white/80 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          title="Account Sync (YouTube Music / SoundCloud)"
          aria-label="Account Sync"
        >
          <Cloud size={18} />
        </button>

        {viewportMode === 'desktop' && (
          <button
            id="toggle-right-sidebar-btn"
            onClick={onToggleRightPanel}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              isRightPanelOpen
                ? 'text-violet-700 dark:text-violet-300 bg-white/90 dark:bg-white/15 border border-white dark:border-white/20 shadow-sm'
                : 'text-[#64748B] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
            }`}
            title={isRightPanelOpen ? 'Hide Now Playing panel' : 'Show Now Playing panel'}
            aria-label="Toggle Now Playing"
          >
            {isRightPanelOpen ? <PanelRightClose size={18} /> : <PanelRight size={18} />}
          </button>
        )}

        <div className="relative">
          <div
            id="user-profile-avatar-btn"
            onClick={() => setIsProfileMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 via-indigo-500 to-fuchsia-500 p-0.5 cursor-pointer hover:scale-105 transition-transform shadow-[0_1px_6px_rgba(99,102,241,0.25)] shrink-0 overflow-hidden"
            title={`Profile (${userName})`}
          >
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center text-xs font-bold text-[#0F172A] dark:text-white uppercase">
                {userName ? userName.charAt(0) : 'U'}
              </div>
            )}
          </div>

          <UserProfileDropdown
            isOpen={isProfileMenuOpen}
            onClose={() => setIsProfileMenuOpen(false)}
            onOpenSettings={() => useLibraryStore.getState().openSettings()}
            onOpenEqualizer={() => useLibraryStore.getState().toggleEqModal()}
            userName={userName}
            userAvatar={userAvatar}
          />
        </div>

        {/* Windows Desktop Control Buttons */}
        {isElectron && (
          <div className="flex items-center gap-0.5 ml-1.5 pl-1.5 border-l border-black/10 dark:border-white/15">
            <button
              id="window-minimize-btn"
              onClick={handleMinimize}
              className="w-8 h-8 rounded-md flex items-center justify-center text-[#64748B] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 transition-colors"
              title="Minimize"
              aria-label="Minimize"
            >
              <Minus size={15} />
            </button>
            <button
              id="window-maximize-btn"
              onClick={handleMaximize}
              className="w-8 h-8 rounded-md flex items-center justify-center text-[#64748B] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 transition-colors"
              title={isMaximized ? 'Restore' : 'Maximize'}
              aria-label={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? <Copy size={13} /> : <Square size={13} />}
            </button>
            <button
              id="window-close-btn"
              onClick={handleClose}
              className="w-8 h-8 rounded-md flex items-center justify-center text-[#64748B] dark:text-white/80 hover:text-white hover:bg-rose-500 active:bg-rose-600 transition-colors"
              title="Close"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
