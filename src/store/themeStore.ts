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
    document.body.style.backgroundColor = '#0B0F19';
    document.body.style.color = '#F1F5F9';
  } else {
    root.classList.remove('dark');
    document.body.style.backgroundColor = '#E2E8F0';
    document.body.style.color = '#0F172A';
  }
};

const initialTheme: ThemeMode = (typeof localStorage !== 'undefined' && (localStorage.getItem(STORAGE_KEY) as ThemeMode)) || 'dark';
applyThemeToDocument(initialTheme);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,

  toggleTheme: () => {
    set((state) => {
      const nextTheme: ThemeMode = state.theme === 'dark' ? 'light' : 'dark';
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, nextTheme);
      }
      applyThemeToDocument(nextTheme);
      return { theme: nextTheme };
    });
  },

  setTheme: (theme: ThemeMode) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, theme);
    }
    applyThemeToDocument(theme);
    set({ theme });
  },
}));
