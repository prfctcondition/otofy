import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Play,
  Loader2,
  Search,
} from 'lucide-react';
import type { MoodsAndGenresSection, MoodOrGenreItem } from '../types';
import { usePlayerStore } from '../store/playerStore';
import { useToastStore } from '../store/toastStore';
import { useTranslation } from '../i18n';
import { apiGetGenreTracks } from '../services/musicApiService';

interface MoodsAndGenresViewProps {
  onBack: () => void;
}

const SECTIONS_EN: MoodsAndGenresSection[] = [
  {
    title: 'For you',
    items: [
      { id: 'en-fy-rock', title: 'Rock', params: '', browseId: '', stripeColor: '#e24b00' },
      { id: 'en-fy-feel-good', title: 'Feel good', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'en-fy-african', title: 'African', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'en-fy-folk', title: 'Folk & acoustic', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'en-fy-hip-hop', title: 'Hip-hop', params: '', browseId: '', stripeColor: '#ff8500' },
      { id: 'en-fy-chill', title: 'Chill', params: '', browseId: '', stripeColor: '#337dff' },
    ],
  },
  {
    title: 'Moods & moments',
    items: [
      { id: 'en-mm-chill', title: 'Chill', params: '', browseId: '', stripeColor: '#337dff' },
      { id: 'en-mm-commute', title: 'Commute', params: '', browseId: '', stripeColor: '#ffc200' },
      { id: 'en-mm-energize', title: 'Energize', params: '', browseId: '', stripeColor: '#ffc200' },
      { id: 'en-mm-feel-good', title: 'Feel good', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'en-mm-focus', title: 'Focus', params: '', browseId: '', stripeColor: '#8c8c8c' },
      { id: 'en-mm-gaming', title: 'Gaming', params: '', browseId: '', stripeColor: '#8c8c8c' },
      { id: 'en-mm-party', title: 'Party', params: '', browseId: '', stripeColor: '#b47bff' },
      { id: 'en-mm-romance', title: 'Romance', params: '', browseId: '', stripeColor: '#e24b00' },
      { id: 'en-mm-sad', title: 'Sad', params: '', browseId: '', stripeColor: '#8c8c8c' },
      { id: 'en-mm-sleep', title: 'Sleep', params: '', browseId: '', stripeColor: '#b47bff' },
      { id: 'en-mm-workout', title: 'Workout', params: '', browseId: '', stripeColor: '#ff8500' },
    ],
  },
  {
    title: 'Genres',
    items: [
      { id: 'en-g-african', title: 'African', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'en-g-arabic', title: 'Arabic', params: '', browseId: '', stripeColor: '#e24b00' },
      { id: 'en-g-blues', title: 'Blues', params: '', browseId: '', stripeColor: '#337dff' },
      { id: 'en-g-bollywood', title: 'Bollywood & Indian', params: '', browseId: '', stripeColor: '#b47bff' },
      { id: 'en-g-classical', title: 'Classical', params: '', browseId: '', stripeColor: '#8c8c8c' },
      { id: 'en-g-country', title: 'Country & Americana', params: '', browseId: '', stripeColor: '#337dff' },
      { id: 'en-g-dance', title: 'Dance & electronic', params: '', browseId: '', stripeColor: '#337dff' },
      { id: 'en-g-decades', title: 'Decades', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'en-g-folk', title: 'Folk & acoustic', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'en-g-hip-hop', title: 'Hip-hop', params: '', browseId: '', stripeColor: '#ff8500' },
      { id: 'en-g-indie', title: 'Indie & alternative', params: '', browseId: '', stripeColor: '#8c8c8c' },
      { id: 'en-g-jazz', title: 'Jazz', params: '', browseId: '', stripeColor: '#337dff' },
      { id: 'en-g-kpop', title: 'K-Pop', params: '', browseId: '', stripeColor: '#b47bff' },
      { id: 'en-g-latin', title: 'Latin', params: '', browseId: '', stripeColor: '#ffc200' },
      { id: 'en-g-metal', title: 'Metal', params: '', browseId: '', stripeColor: '#8c8c8c' },
      { id: 'en-g-pop', title: 'Pop', params: '', browseId: '', stripeColor: '#ff70c5' },
      { id: 'en-g-rnb', title: 'R&B & soul', params: '', browseId: '', stripeColor: '#b47bff' },
      { id: 'en-g-reggae', title: 'Reggae & caribbean', params: '', browseId: '', stripeColor: '#ffc200' },
      { id: 'en-g-rock', title: 'Rock', params: '', browseId: '', stripeColor: '#e24b00' },
      { id: 'en-g-soundtracks', title: 'Soundtracks & musicals', params: '', browseId: '', stripeColor: '#337dff' },
    ],
  },
];

const SECTIONS_RU: MoodsAndGenresSection[] = [
  {
    title: 'Для вас',
    items: [
      { id: 'ru-fy-rock', title: 'Рок', params: '', browseId: '', stripeColor: '#e24b00' },
      { id: 'ru-fy-feel-good', title: 'Хорошее настроение', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'ru-fy-african', title: 'Африканская', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'ru-fy-folk', title: 'Фолк и акустика', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'ru-fy-hip-hop', title: 'Хип-хоп', params: '', browseId: '', stripeColor: '#ff8500' },
      { id: 'ru-fy-chill', title: 'Отдых', params: '', browseId: '', stripeColor: '#337dff' },
    ],
  },
  {
    title: 'Настроения и события',
    items: [
      { id: 'ru-mm-chill', title: 'Отдых', params: '', browseId: '', stripeColor: '#337dff' },
      { id: 'ru-mm-commute', title: 'В дороге', params: '', browseId: '', stripeColor: '#ffc200' },
      { id: 'ru-mm-energize', title: 'Заряд энергии', params: '', browseId: '', stripeColor: '#ffc200' },
      { id: 'ru-mm-feel-good', title: 'Хорошее настроение', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'ru-mm-focus', title: 'Концентрация', params: '', browseId: '', stripeColor: '#8c8c8c' },
      { id: 'ru-mm-gaming', title: 'Gaming', params: '', browseId: '', stripeColor: '#8c8c8c' },
      { id: 'ru-mm-party', title: 'Вечеринка', params: '', browseId: '', stripeColor: '#b47bff' },
      { id: 'ru-mm-romance', title: 'Романтика', params: '', browseId: '', stripeColor: '#e24b00' },
      { id: 'ru-mm-sad', title: 'Грустная', params: '', browseId: '', stripeColor: '#8c8c8c' },
      { id: 'ru-mm-sleep', title: 'Сон', params: '', browseId: '', stripeColor: '#b47bff' },
      { id: 'ru-mm-workout', title: 'Тренировка', params: '', browseId: '', stripeColor: '#ff8500' },
    ],
  },
  {
    title: 'Жанры',
    items: [
      { id: 'ru-g-african', title: 'Африканская', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'ru-g-arabic', title: 'Арабская', params: '', browseId: '', stripeColor: '#e24b00' },
      { id: 'ru-g-blues', title: 'Блюз', params: '', browseId: '', stripeColor: '#337dff' },
      { id: 'ru-g-bollywood', title: 'Болливуд', params: '', browseId: '', stripeColor: '#b47bff' },
      { id: 'ru-g-classical', title: 'Классика', params: '', browseId: '', stripeColor: '#8c8c8c' },
      { id: 'ru-g-country', title: 'Кантри и американа', params: '', browseId: '', stripeColor: '#337dff' },
      { id: 'ru-g-dance', title: 'Танцы и электроника', params: '', browseId: '', stripeColor: '#337dff' },
      { id: 'ru-g-decades', title: 'Десятилетия', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'ru-g-folk', title: 'Фолк и акустика', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'ru-g-hip-hop', title: 'Хип-хоп', params: '', browseId: '', stripeColor: '#ff8500' },
      { id: 'ru-g-indie', title: 'Инди и альтернатива', params: '', browseId: '', stripeColor: '#8c8c8c' },
      { id: 'ru-g-jazz', title: 'Джаз', params: '', browseId: '', stripeColor: '#337dff' },
      { id: 'ru-g-kpop', title: 'K-Pop', params: '', browseId: '', stripeColor: '#b47bff' },
      { id: 'ru-g-latin', title: 'Латиноамериканская музыка', params: '', browseId: '', stripeColor: '#ffc200' },
      { id: 'ru-g-metal', title: 'Метал', params: '', browseId: '', stripeColor: '#8c8c8c' },
      { id: 'ru-g-pop', title: 'Поп', params: '', browseId: '', stripeColor: '#ff70c5' },
      { id: 'ru-g-rnb', title: 'R&B и соул', params: '', browseId: '', stripeColor: '#b47bff' },
      { id: 'ru-g-reggae', title: 'Регги и карибская музыка', params: '', browseId: '', stripeColor: '#ffc200' },
      { id: 'ru-g-rock', title: 'Рок', params: '', browseId: '', stripeColor: '#e24b00' },
      { id: 'ru-g-soundtracks', title: 'Саундтреки и мюзиклы', params: '', browseId: '', stripeColor: '#337dff' },
    ],
  },
];

export const MoodsAndGenresView: React.FC<MoodsAndGenresViewProps> = ({ onBack }) => {
  const { t, language } = useTranslation();
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  const playerStore = usePlayerStore();
  const toastStore = useToastStore();

  const sections = useMemo(() => {
    return language === 'ru' ? SECTIONS_RU : SECTIONS_EN;
  }, [language]);

  const handlePlayCategory = async (item: MoodOrGenreItem) => {
    setLoadingItemId(item.id);
    const stationTitle = t.moods?.stationStarted || (language === 'ru' ? 'Станция запущена' : 'Station Started');
    const errorTitle = language === 'ru' ? 'Ошибка' : 'Error';
    const noTracksPrefix = t.moods?.noTracksFound || (language === 'ru' ? 'Не удалось найти треки для' : 'No tracks found for');

    try {
      const tracks = await apiGetGenreTracks(item.title);
      if (tracks && tracks.length > 0) {
        toastStore.success(stationTitle, `${item.title} (${tracks.length})`);
        playerStore.playTrack(tracks[0], tracks);
      } else {
        toastStore.error(errorTitle, `${noTracksPrefix} «${item.title}»`);
      }
    } catch {
      toastStore.error(errorTitle, `${noTracksPrefix} «${item.title}»`);
    } finally {
      setLoadingItemId(null);
    }
  };

  const filteredSections = useMemo(() => {
    if (!searchFilter.trim()) return sections;
    const q = searchFilter.toLowerCase().trim();
    return sections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((item) => item.title.toLowerCase().includes(q)),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [sections, searchFilter]);

  return (
    <div
      id="moods-and-genres-view"
      className="flex-1 overflow-y-auto px-6 py-6 pb-24 relative select-none bg-transparent text-[#142347] dark:text-white"
    >
      <div className="relative z-10 flex flex-col gap-4 mb-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white transition-colors cursor-pointer"
              title={t.moods?.back || t.nav.back}
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#142347] dark:text-white">
              {t.moods?.title || 'Moods & Genres'}
            </h1>
          </div>

          <div className="relative w-64 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
            <input
              type="text"
              placeholder={t.moods?.searchPlaceholder || 'Filter moods & genres...'}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-full bg-black/[0.04] hover:bg-black/[0.07] focus:bg-white dark:bg-white/[0.08] dark:hover:bg-white/[0.12] dark:focus:bg-white/[0.16] border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none transition-all shadow-xs"
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-9">
        {filteredSections.map((sec, secIdx) => (
          <section key={sec.title || secIdx} className="flex flex-col gap-3.5">
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#142347] dark:text-white/95">
              {sec.title}
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
              {sec.items.map((item) => {
                const isLoadingThis = loadingItemId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handlePlayCategory(item)}
                    className="group relative h-12 rounded-xl bg-white/70 hover:bg-white dark:bg-[#1C1C1E]/90 dark:hover:bg-[#2C2C2E] border border-black/[0.06] hover:border-black/15 dark:border-white/[0.08] dark:hover:border-white/20 transition-all duration-150 cursor-pointer flex items-center px-3 gap-3 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md"
                  >
                    <div
                      className="w-1.5 h-6 rounded-full shrink-0 shadow-xs transition-transform group-hover:scale-y-110"
                      style={{ backgroundColor: item.stripeColor }}
                    />

                    <span className="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-slate-950 dark:text-white/90 dark:group-hover:text-white truncate flex-1">
                      {item.title}
                    </span>

                    <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isLoadingThis ? (
                        <Loader2 size={16} className="animate-spin text-[#142347] dark:text-white" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#142347] text-white dark:bg-white dark:text-black flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-transform">
                          <Play size={12} className="fill-white dark:fill-black text-[#142347] dark:text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
