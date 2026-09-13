import { useSettingsStore, SupportedLanguage } from '../store/settingsStore';
import { TranslationSchema, LanguageOption } from './types';
import { en } from './locales/en';
import { ru } from './locales/ru';
import { es } from './locales/es';
import { zh } from './locales/zh';
import { fr } from './locales/fr';
import { ja } from './locales/ja';
import { de } from './locales/de';
import { pt } from './locales/pt';

export type { TranslationSchema, LanguageOption } from './types';
export type { SupportedLanguage } from '../store/settingsStore';

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'zh', name: 'Chinese', nativeName: '简体中文' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
];

export const LOCALES: Record<SupportedLanguage, TranslationSchema> = {
  en,
  ru,
  es,
  zh,
  fr,
  ja,
  de,
  pt,
};

export function getTranslation(language: SupportedLanguage): TranslationSchema {
  return LOCALES[language] || en;
}

export function useTranslation() {
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const t = LOCALES[language] || en;

  return {
    t,
    language,
    setLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };
}

export function formatDurationText(totalSec: number, t: TranslationSchema): string {
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (hrs > 0) {
    return t.hero.aboutHoursMinutes.replace('{hours}', String(hrs)).replace('{minutes}', String(mins));
  }
  return t.hero.aboutMinutes.replace('{minutes}', String(mins || 1));
}

export function formatArtistStats(params: {
  tracksCount: number;
  audience?: string;
  releaseCount: number;
  t: TranslationSchema;
}): string {
  const parts: string[] = [
    `${params.tracksCount} ${params.t.hero.officialSongs}`,
    params.t.library.artistSingle,
  ];
  if (params.audience) {
    const audienceStr = params.audience.trim();
    const token = audienceStr.split(' ')[0];
    const cleanAudience = token || audienceStr;
    parts.push(`${cleanAudience} ${params.t.hero.monthlyAudience}`);
  }
  if (params.releaseCount > 0) {
    parts.push(`${params.releaseCount} ${params.t.hero.releases}`);
  }
  return parts.join(' • ');
}
