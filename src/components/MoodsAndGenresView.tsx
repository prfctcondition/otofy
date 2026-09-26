import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  Loader2,
  Compass,
  Radio,
  Search,
} from 'lucide-react';
import type { MoodsAndGenresSection, MoodOrGenreItem, Track } from '../types';
import { usePlayerStore } from '../store/playerStore';
import { useToastStore } from '../store/toastStore';
import { useTranslation } from '../i18n';

interface MoodsAndGenresViewProps {
  onBack: () => void;
}

const FALLBACK_SECTIONS: MoodsAndGenresSection[] = [
  {
    title: 'Рекомендации',
    items: [
      { id: 'rec-1', title: 'Хорошее настроение', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'rec-2', title: 'Рок', params: '', browseId: '', stripeColor: '#e24b00' },
      { id: 'rec-3', title: '1980-е', params: '', browseId: '', stripeColor: '#ffc200' },
      { id: 'rec-4', title: 'K-Pop', params: '', browseId: '', stripeColor: '#b47bff' },
      { id: 'rec-5', title: 'В дороге', params: '', browseId: '', stripeColor: '#ffc200' },
      { id: 'rec-6', title: 'Кантри и американа', params: '', browseId: '', stripeColor: '#337dff' },
    ],
  },
  {
    title: 'Настроения и события',
    items: [
      { id: 'mood-1', title: 'В дороге', params: '', browseId: '', stripeColor: '#ffc200' },
      { id: 'mood-2', title: 'Вечеринка', params: '', browseId: '', stripeColor: '#b47bff' },
      { id: 'mood-3', title: 'Грустная', params: '', browseId: '', stripeColor: '#8c8c8c' },
      { id: 'mood-4', title: 'Заряд энергии', params: '', browseId: '', stripeColor: '#ffc200' },
      { id: 'mood-5', title: 'Концентрация', params: '', browseId: '', stripeColor: '#337dff' },
      { id: 'mood-6', title: 'Отдых', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'mood-7', title: 'Романтика', params: '', browseId: '', stripeColor: '#e24b00' },
      { id: 'mood-8', title: 'Сон', params: '', browseId: '', stripeColor: '#337dff' },
      { id: 'mood-9', title: 'Тренировка', params: '', browseId: '', stripeColor: '#ff8500' },
      { id: 'mood-10', title: 'Хорошее настроение', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'mood-11', title: 'Gaming', params: '', browseId: '', stripeColor: '#8c8c8c' },
    ],
  },
  {
    title: 'Жанры',
    items: [
      { id: 'g-1', title: 'Арабская', params: '', browseId: '', stripeColor: '#e24b00' },
      { id: 'g-2', title: 'Африканская', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'g-3', title: 'Блюз', params: '', browseId: '', stripeColor: '#337dff' },
      { id: 'g-4', title: 'Болливуд', params: '', browseId: '', stripeColor: '#b47bff' },
      { id: 'g-5', title: 'Десятилетия', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'g-6', title: 'Джаз', params: '', browseId: '', stripeColor: '#337dff' },
      { id: 'g-7', title: 'Инди и альтернатива', params: '', browseId: '', stripeColor: '#ffc200' },
      { id: 'g-8', title: 'Кантри и американа', params: '', browseId: '', stripeColor: '#337dff' },
      { id: 'g-9', title: 'Классика', params: '', browseId: '', stripeColor: '#ffc200' },
      { id: 'g-10', title: 'Латиноамериканская музыка', params: '', browseId: '', stripeColor: '#ffc200' },
      { id: 'g-11', title: 'Метал', params: '', browseId: '', stripeColor: '#8c8c8c' },
      { id: 'g-12', title: 'Поп', params: '', browseId: '', stripeColor: '#b47bff' },
      { id: 'g-13', title: 'Регги и карибская музыка', params: '', browseId: '', stripeColor: '#ffc200' },
      { id: 'g-14', title: 'Рок', params: '', browseId: '', stripeColor: '#e24b00' },
      { id: 'g-15', title: 'Саундтреки и мюзиклы', params: '', browseId: '', stripeColor: '#337dff' },
      { id: 'g-16', title: 'Танцы и электроника', params: '', browseId: '', stripeColor: '#337dff' },
      { id: 'g-17', title: 'Фолк и акустика', params: '', browseId: '', stripeColor: '#00a513' },
      { id: 'g-18', title: 'Хип-хоп', params: '', browseId: '', stripeColor: '#ff8500' },
      { id: 'g-19', title: 'K-Pop', params: '', browseId: '', stripeColor: '#b47bff' },
      { id: 'g-20', title: 'R&B и соул', params: '', browseId: '', stripeColor: '#b47bff' },
      { id: 'g-21', title: 'Ukrainian pop', params: '', browseId: '', stripeColor: '#ffc200' },
      { id: 'g-22', title: 'Ukrainian rock', params: '', browseId: '', stripeColor: '#e24b00' },
    ],
  },
];

export const MoodsAndGenresView: React.FC<MoodsAndGenresViewProps> = ({ onBack }) => {
  const [sections, setSections] = useState<MoodsAndGenresSection[]>(FALLBACK_SECTIONS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  const playerStore = usePlayerStore();
  const toastStore = useToastStore();
  const { t } = useTranslation();

  useEffect(() => {
    let isMounted = true;
    if (window.electronAPI?.getMoodsAndGenres) {
      window.electronAPI
        .getMoodsAndGenres()
        .then((data) => {
          if (isMounted && Array.isArray(data) && data.length > 0) {
            setSections(data);
          }
        })
        .catch((err) => {
          console.warn('[MoodsAndGenres] Failed to fetch:', err);
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const handlePlayCategory = async (item: MoodOrGenreItem) => {
    setLoadingItemId(item.id);
    try {
      let tracks: Track[] = [];
      if (window.electronAPI?.getGenreTracks) {
        tracks = await window.electronAPI.getGenreTracks(item.title);
      }

      if (tracks && tracks.length > 0) {
        toastStore.success('Станция запущена', `Воспроизведение: «${item.title}» (${tracks.length} треков)`);
        playerStore.playTrack(tracks[0], tracks);
      } else {
        toastStore.error('Ошибка', `Не удалось найти треки для «${item.title}»`);
      }
    } catch (err) {
      toastStore.error('Ошибка', 'Не удалось загрузить станцию');
    } finally {
      setLoadingItemId(null);
    }
  };

  const filteredSections = sections.map((sec) => {
    if (!searchFilter.trim()) return sec;
    const q = searchFilter.toLowerCase().trim();
    return {
      ...sec,
      items: sec.items.filter((item) => item.title.toLowerCase().includes(q)),
    };
  }).filter((sec) => sec.items.length > 0);

  return (
    <div
      id="moods-and-genres-view"
      className="flex-1 overflow-y-auto px-6 py-6 pb-24 relative select-none bg-black text-white"
    >
      <div className="relative z-10 flex flex-col gap-4 mb-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="Назад"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Настроения и жанры
            </h1>
          </div>

          <div className="relative w-64 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Поиск по жанрам..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-full bg-white/[0.08] hover:bg-white/[0.12] focus:bg-white/[0.16] border border-white/10 text-xs text-white placeholder:text-white/40 focus:outline-none transition-all"
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-9">
        {filteredSections.map((sec, secIdx) => (
          <section key={sec.title || secIdx} className="flex flex-col gap-3.5">
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white/95">
              {sec.title}
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
              {sec.items.map((item) => {
                const isLoadingThis = loadingItemId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handlePlayCategory(item)}
                    className="group relative h-12 rounded-xl bg-[#1C1C1E]/90 hover:bg-[#2C2C2E] border border-white/[0.08] hover:border-white/20 transition-all duration-150 cursor-pointer flex items-center px-3 gap-3 overflow-hidden shadow-xs hover:shadow-md"
                  >
                    <div
                      className="w-1.5 h-6 rounded-full shrink-0 shadow-xs transition-transform group-hover:scale-y-110"
                      style={{ backgroundColor: item.stripeColor }}
                    />

                    <span className="text-xs sm:text-sm font-semibold text-white/90 group-hover:text-white truncate flex-1">
                      {item.title}
                    </span>

                    <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isLoadingThis ? (
                        <Loader2 size={16} className="animate-spin text-white" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-transform">
                          <Play size={12} fill="black" className="translate-x-0.5" />
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
