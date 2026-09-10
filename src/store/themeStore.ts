import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light';

interface ThemeState {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const STORAGE_KEY = 'otofy-theme';

const applyThemeToDocument = (theme: ThemeMode) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    document.body.style.backgroundColor = '#000000';
    document.body.style.color = '#FFFFFF';
  } else {
    root.classList.remove('dark');
    document.body.style.backgroundColor = '#E2E8F0';
    document.body.style.color = '#0F172A';
  }
};

const initialTheme: ThemeMode = (typeof localStorage !== 'undefined' && (localStorage.getItem(STORAGE_KEY) as ThemeMode)) || 'light';
applyThemeToDocument(initialTheme);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,

  toggleTheme: () => {
    const performToggle = () => {
      set((state) => {
        const nextTheme: ThemeMode = state.theme === 'dark' ? 'light' : 'dark';
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, nextTheme);
        }
        applyThemeToDocument(nextTheme);
        return { theme: nextTheme };
      });
    };

    // Modern seamless view transition if browser/Electron supports it
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      (document as any).startViewTransition(() => {
        performToggle();
      });
    } else {
      performToggle();
    }
  },

  setTheme: (theme: ThemeMode) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, theme);
    }
    applyThemeToDocument(theme);
    set({ theme });
  },
}));

