import React, { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { useTranslation, SupportedLanguage } from '../i18n';

interface LanguageDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LanguageDropdown: React.FC<LanguageDropdownProps> = ({
  isOpen,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const { language, setLanguage, supportedLanguages, t } = useTranslation();

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

  const handleSelect = (langCode: SupportedLanguage) => {
    setLanguage(langCode);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      id="language-dropdown-menu"
      className="absolute right-0 top-full mt-2 w-52 rounded-2xl bg-white/95 dark:bg-[#111116] backdrop-blur-3xl border border-white/90 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.25)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] py-2 z-50 animate-in fade-in zoom-in-95 duration-150 select-none"
    >
      <div className="px-3.5 py-1.5 border-b border-black/5 dark:border-white/10 mb-1">
        <span className="text-[11px] font-bold text-[#64748B] dark:text-white/50 uppercase tracking-wider">
          {t.nav.selectLanguage}
        </span>
      </div>

      <div className="p-1 space-y-0.5 max-h-72 overflow-y-auto no-scrollbar">
        {supportedLanguages.map((item) => {
          const isActive = item.code === language;
          return (
            <button
              key={item.code}
              id={`lang-option-${item.code}`}
              onClick={() => handleSelect(item.code)}
              className={`w-full px-3 py-2 rounded-xl text-left text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                isActive
                  ? 'bg-black/5 dark:bg-white/15 text-[#0F172A] dark:text-white font-semibold'
                  : 'text-[#64748B] dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs">{item.nativeName}</span>
                <span className="text-[10px] text-[#94A3B8] dark:text-white/40 uppercase">
                  {item.code}
                </span>
              </div>
              {isActive && (
                <Check size={14} className="text-[#0F172A] dark:text-white shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
