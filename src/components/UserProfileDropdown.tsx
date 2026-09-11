import React, { useEffect, useRef } from 'react';
import { Settings, Sliders, LogOut, ShieldCheck } from 'lucide-react';

interface UserProfileDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenEqualizer?: () => void;
  userName: string;
  userAvatar: string | null;
}

export const UserProfileDropdown: React.FC<UserProfileDropdownProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  onOpenEqualizer,
  userName,
  userAvatar,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleQuit = () => {
    onClose();
    if (window.electronAPI?.quitApp) {
      window.electronAPI.quitApp();
    } else {
      window.close();
    }
  };

  return (
    <div
      ref={menuRef}
      id="user-profile-dropdown"
      className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white/95 dark:bg-[#111116] backdrop-blur-3xl border border-white/90 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] py-2 z-50 animate-in fade-in zoom-in-95 duration-150 select-none"
    >
      {/* User Header Profile Card */}
      <div className="px-4 py-3 border-b border-black/5 dark:border-white/10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-neutral-300 via-neutral-100 to-neutral-400 dark:from-neutral-700 dark:via-neutral-400 dark:to-neutral-600 p-0.5 shrink-0 overflow-hidden shadow-sm">
          {userAvatar ? (
            <img src={userAvatar} alt={userName} className="w-full h-full rounded-full object-cover" />
          ) : (
            <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center text-sm font-bold text-[#0F172A] dark:text-white uppercase">
              {userName ? userName.charAt(0) : 'U'}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
            {userName || 'Local User'}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <ShieldCheck size={11} className="text-[#0F172A] dark:text-white shrink-0" />
            <span className="text-[10px] text-[#64748B] dark:text-white/60 font-medium truncate">
              Otofy Desktop
            </span>
          </div>
        </div>
      </div>

      {/* Menu Actions */}
      <div className="p-1 space-y-0.5">
        <button
          id="profile-menu-settings-btn"
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
          className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-[#0F172A] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2.5 transition-colors cursor-pointer"
        >
          <Settings size={15} className="text-[#64748B] dark:text-white/70" />
          <span>Settings</span>
        </button>

        {onOpenEqualizer && (
          <button
            id="profile-menu-equalizer-btn"
            onClick={() => {
              onClose();
              onOpenEqualizer();
            }}
            className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-[#0F172A] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <Sliders size={15} className="text-[#64748B] dark:text-white/70" />
            <span>Equalizer</span>
          </button>
        )}
      </div>

      <div className="border-t border-black/5 dark:border-white/10 my-1" />

      {/* Quit Action */}
      <div className="p-1">
        <button
          id="profile-menu-quit-btn"
          onClick={handleQuit}
          className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-red-600 dark:text-rose-400 hover:bg-red-50 dark:hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors cursor-pointer"
        >
          <LogOut size={15} className="text-red-500 dark:text-rose-400" />
          <span>Quit Otofy</span>
        </button>
      </div>
    </div>
  );
};
