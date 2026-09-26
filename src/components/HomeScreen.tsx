import React, { useState, useEffect, useMemo } from 'react';
import {
  Play,
  Heart,
  Radio,
  Sparkles,
  Music,
  User,
  Compass,
  Flame,
  Sun,
  Box,
  Disc,
  Headphones,
  Waves,
  Zap,
  History,
  Loader2,
} from 'lucide-react';
import {
  QUICK_ACCESS_ITEMS,
  RECOMMENDED_STATIONS,
  MADE_FOR_YOU_ITEMS,
  QuickAccessItem,
  StationItem,
  MadeForYouItem,
} from '../data/homeData';
import { getStoredDailyMixes } from '../services/dailyMixService';
import type { DailyMixConfig, MoodOrGenreItem } from '../types';
import { useTranslation } from '../i18n';
import { useSettingsStore } from '../store/settingsStore';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import { useToastStore } from '../store/toastStore';
import { generateWaveTracks } from '../services/waveService';
import { apiGetMoodsAndGenres, apiGetGenreTracks } from '../services/musicApiService';

const MOOD_PILLS_CONFIG: Record<string, string[]> = {
  ru: ['В дороге', 'Заряд энергии', 'Отдых', 'Концентрация', 'Вечеринка', 'Романтика', 'Рок', 'Хип-хоп'],
  en: ['Road Trip', 'Energy Boost', 'Relax & Chill', 'Deep Focus', 'Party Vibes', 'Romance', 'Rock', 'Hip-Hop'],
  de: ['Unterwegs', 'Energieschub', 'Entspannung', 'Fokus', 'Party', 'Romantik', 'Rock', 'Hip-Hop'],
  es: ['Para el camino', 'Energía', 'Relax', 'Concentración', 'Fiesta', 'Romance', 'Rock', 'Hip-hop'],
  fr: ['Sur la route', 'Énergie', 'Détente', 'Concentration', 'Fête', 'Romance', 'Rock', 'Hip-hop'],
  ja: ['ドライブ', 'エナジー', 'リラックス', '集中', 'パーティー', 'ロマンス', 'ロック', 'ヒップホップ'],
  pt: ['Na estrada', 'Energia', 'Relaxar', 'Concentração', 'Festa', 'Romance', 'Rock', 'Hip-hop'],
  zh: ['在路上', '充满活力', '放松', '专注', '派对', '浪漫', '摇滚', '嘻哈'],
};

const STRIPE_COLORS = [
  '#ffc200',
  '#ffc200',
  '#00a513',
  '#337dff',
  '#b47bff',
  '#e24b00',
  '#e24b00',
  '#ff8500',
];

function getCanonicalMoodPills(lang: string): MoodOrGenreItem[] {
  const titles = MOOD_PILLS_CONFIG[lang] || MOOD_PILLS_CONFIG.en;
  return titles.map((title, idx) => ({
    id: `home-mood-${idx}`,
    title,
    stripeColor: STRIPE_COLORS[idx] || '#337dff',
    params: '',
    browseId: '',
  }));
}

interface HomeScreenProps {
  onSelectCollection: (itemOrTitle: QuickAccessItem | string, playlistId?: string) => void;
  onPlayCollection?: (itemOrTitle: QuickAccessItem | string, playlistId?: string) => void;
  onOpenStation: (station: StationItem) => void;
  onPlayStation: (station: StationItem) => void;
  onOpenMix: (mix: MadeForYouItem) => void;
  onPlayMix: (mix: MadeForYouItem) => void;
  onShowAll?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectCollection,
  onPlayCollection,
  onOpenStation,
  onPlayStation,
  onOpenMix,
  onPlayMix,
  onShowAll,
}) => {
  const { t, language } = useTranslation();
  const settingsStore = useSettingsStore();
  const playerStore = usePlayerStore();
  const libraryStore = useLibraryStore();
  const toastStore = useToastStore();
  const favoriteArtists = settingsStore.favoriteArtists || [];
  const [isWaveLoading, setIsWaveLoading] = useState<boolean>(false);
  const moodPills = useMemo(() => getCanonicalMoodPills(language), [language]);

  const [dynamicMixes, setDynamicMixes] = useState<DailyMixConfig[]>([]);

  const getQuickAccessTitle = (item: QuickAccessItem) => {
    if (item.id === 'qa-liked') return t.library.likedSongs;
    if (item.id === 'qa-history') return t.home.history;
    if (item.id === 'qa-discover') return t.home.discoverWeekly;
    if (item.id === 'qa-phonk') return `${t.home.dailyMix} 1 • Phonk`;
    if (item.id === 'qa-lofi') return `${t.home.dailyMix} 2 • Lo-Fi`;
    if (item.id === 'qa-synth') return `${t.home.dailyMix} 3 • Synthwave`;
    if (item.id === 'qa-rap') return `${t.home.dailyMix} 4 • Hip-Hop`;
    return item.title;
  };

  const handleWaveClick = async () => {
    if (favoriteArtists.length === 0) {
      settingsStore.setIsOnboardingModalOpen(true);
      return;
    }
    setIsWaveLoading(true);
    const stationTitle = t.wave?.stationStarted || 'My Wave started';
    const errorTitle = language === 'ru' ? 'Ошибка' : 'Error';
    const waveName = t.wave?.title || 'My Wave';

    try {
      const tracks = await generateWaveTracks(favoriteArtists);
      if (tracks && tracks.length > 0) {
        libraryStore.setCustomPlaylistView(waveName, tracks, {
          creator: 'Otofy',
          description: `${t.wave?.artistsPrefix || 'Based on: '}${favoriteArtists.join(', ')}`,
          iconName: 'waves',
          gradientFrom: '#1E293B',
          gradientTo: '#0F172A',
        });
        await playerStore.playTrack(tracks[0], tracks);
        toastStore.success(stationTitle, `${waveName} (${tracks.length})`);
      }
    } catch (e) {
      console.warn('[HomeScreen] My wave failed:', e);
      toastStore.error(errorTitle, 'Failed to load My Wave');
    } finally {
      setIsWaveLoading(false);
    }
  };

  const handlePlayMood = async (item: MoodOrGenreItem) => {
    const errorTitle = language === 'ru' ? 'Ошибка' : 'Error';
    const stationTitle = t.moods?.stationStarted || 'Station Started';
    const noTracksPrefix = t.moods?.noTracksFound || 'No tracks found for';

    try {
      const tracks = await apiGetGenreTracks(item.title);
      if (tracks && tracks.length > 0) {
        libraryStore.setCustomPlaylistView(item.title, tracks, {
          creator: 'YouTube Music',
          description: `${t.moods?.title || 'Moods & Genres'}: ${item.title}`,
          iconName: 'radio',
          gradientFrom: '#1E293B',
          gradientTo: '#0F172A',
        });
        await playerStore.playTrack(tracks[0], tracks);
        toastStore.success(stationTitle, `${item.title} (${tracks.length})`);
      } else {
        toastStore.error(errorTitle, `${noTracksPrefix} «${item.title}»`);
      }
    } catch {
      toastStore.error(errorTitle, `${noTracksPrefix} «${item.title}»`);
    }
  };

  useEffect(() => {
    let isMounted = true;
    getStoredDailyMixes().then((mixes) => {
      if (isMounted && mixes && mixes.length > 0) {
        setDynamicMixes(mixes);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const displayMixes = useMemo(() => {
    return MADE_FOR_YOU_ITEMS.map((item) => {
      const targetNumber = item.cardVariant === 'discover' ? 0 : parseInt(item.mixNumber || '1', 10);
      const match = dynamicMixes.find((m) => m.mixNumber === targetNumber);
      if (match) {
        return {
          ...item,
          title: match.title || item.title,
          subtitle: match.subtitle || item.subtitle,
        };
      }
      return item;
    });
  }, [dynamicMixes]);

  const renderQuickAccessIcon = (item: QuickAccessItem) => {
    switch (item.icon) {
      case 'heart':
        return <Heart size={20} className="text-white fill-white" />;
      case 'zap':
        return <Zap size={20} className="text-cyan-200 fill-cyan-200" />;
      case 'sparkles':
        return <Sparkles size={20} className="text-fuchsia-200" />;
      case 'headphones':
        return <Headphones size={20} className="text-amber-200" />;
      case 'waves':
        return <Waves size={20} className="text-orange-200" />;
      case 'flame':
        return <Flame size={20} className="text-pink-200 fill-pink-200" />;
      case 'history':
        return <History size={20} className="text-slate-200" />;
      case 'radio':
        return <Radio size={20} className="text-slate-200" />;
      case 'disc':
        return <Disc size={20} className="text-purple-200" />;
      case 'music':
      default:
        return <Music size={20} className="text-white/90" />;
    }
  };

  return (
    <div id="home-screen-view" className="flex-1 overflow-y-auto px-6 py-5 pb-20 relative select-none bg-transparent">
      <section id="my-wave-hero-section" className="relative z-10 mb-8">
        <div className="relative overflow-hidden rounded-2xl bg-white/70 hover:bg-white/80 dark:bg-[#0C0C10]/90 dark:hover:bg-[#111116] backdrop-blur-2xl border border-black/[0.07] dark:border-white/10 p-5 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col md:flex-row items-start md:items-center justify-between gap-5 group transition-all duration-200">
          <div className="pointer-events-none absolute -top-16 -left-16 w-56 h-56 rounded-full bg-black/[0.02] dark:bg-white/[0.03] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 right-1/4 w-56 h-56 rounded-full bg-black/[0.015] dark:bg-white/[0.02] blur-3xl" />

          <div className="relative z-10 flex items-center gap-4 min-w-0 flex-1">
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-2xl bg-[#0F172A] text-white dark:bg-white dark:text-black flex items-center justify-center shadow-md dark:shadow-[0_4px_20px_rgba(255,255,255,0.15)] overflow-hidden transition-transform group-hover:scale-105">
              <Waves size={30} className="animate-pulse" />
            </div>

            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-black/[0.05] text-[#0F172A] border border-black/10 dark:bg-white/10 dark:text-white/90 dark:border-white/10">
                  {t.wave?.badge || 'Personal Stream'}
                </span>
                {favoriteArtists.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-1.5 overflow-hidden py-0.5">
                      {favoriteArtists.slice(0, 3).map((artistName) => {
                        const avatar = settingsStore.favoriteArtistAvatars?.[artistName];
                        if (!avatar) return null;
                        return (
                          <img
                            key={artistName}
                            src={avatar}
                            alt={artistName}
                            referrerPolicy="no-referrer"
                            className="inline-block h-4 w-4 rounded-full ring-1 ring-white dark:ring-black object-cover"
                            loading="lazy"
                          />
                        );
                      })}
                    </div>
                    <span className="text-[11px] text-[#64748B] dark:text-white/50 font-medium truncate">
                      {favoriteArtists.length} {t.wave?.artistsCount || 'favorite artists'}
                    </span>
                  </div>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] dark:text-white tracking-tight flex items-center gap-2 truncate">
                {t.wave?.title || 'My Wave'}
              </h2>

              <p
                className="text-xs sm:text-sm text-[#475569] dark:text-white/65 max-w-xl truncate mt-0.5"
                title={
                  favoriteArtists.length > 0
                    ? `${t.wave?.artistsPrefix || 'Based on: '}${favoriteArtists.join(', ')}`
                    : (t.wave?.subtitle || 'Endless music flow tailored to your personal taste')
                }
              >
                {favoriteArtists.length > 0
                  ? `${t.wave?.artistsPrefix || 'Based on: '}${favoriteArtists.slice(0, 4).join(', ')}${favoriteArtists.length > 4 ? (t.wave?.andOthers || ' and others') : ''}`
                  : (t.wave?.subtitle || 'Endless music flow tailored to your personal taste')}
              </p>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-2.5 w-full md:w-auto justify-end shrink-0">
            <button
              onClick={() => settingsStore.setIsOnboardingModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-black/[0.04] hover:bg-black/[0.08] text-[#0F172A] border border-black/10 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white/90 dark:hover:text-white dark:border-white/10 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title={t.wave?.tune || 'Tune'}
            >
              <Sparkles size={14} className="text-slate-600 dark:text-white/70" />
              <span>{t.wave?.tune || 'Tune'}</span>
            </button>

            <button
              id="play-my-wave-btn"
              onClick={handleWaveClick}
              disabled={isWaveLoading}
              className="h-10 sm:h-11 px-5 rounded-xl bg-[#0F172A] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90 active:scale-95 transition-all font-bold text-sm flex items-center gap-2 shadow-[0_4px_16px_rgba(15,23,42,0.2)] dark:shadow-[0_4px_20px_rgba(255,255,255,0.2)] cursor-pointer shrink-0"
              title={t.wave?.listen || 'Listen'}
            >
              {isWaveLoading ? (
                <Loader2 size={16} className="animate-spin text-white dark:text-black" />
              ) : (
                <Play size={16} className="fill-white text-white dark:fill-black dark:text-black translate-x-0.5" />
              )}
              <span>{t.wave?.listen || 'Listen'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 1. TOP QUICK-ACCESS GRID (8 items: 2 rows x 4 cols on desktop) */}
      <section id="quick-access-section" className="relative z-10 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {QUICK_ACCESS_ITEMS.map((item) => (
            <div
              key={item.id}
              id={`quick-access-${item.id}`}
              onClick={() => onSelectCollection(item, item.playlistId)}
              className="group relative h-14 rounded-lg bg-white/45 dark:bg-white/[0.05] hover:bg-white/80 dark:hover:bg-white/[0.10] active:bg-white/90 dark:active:bg-white/[0.15] backdrop-blur-xl border border-white/85 dark:border-white/10 hover:border-white dark:hover:border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-none hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)] flex items-center overflow-hidden cursor-pointer transition-all duration-200"
            >
              <div
                className="w-14 h-14 shrink-0 flex items-center justify-center shadow-inner relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${item.gradientFrom}, ${item.gradientTo})`,
                }}
              >
                <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
                <div className="relative z-10">{renderQuickAccessIcon(item)}</div>
              </div>

              <span
                className="flex-1 px-3 text-[13px] font-semibold text-[#0F172A] dark:text-white truncate group-hover:text-black dark:group-hover:text-white transition-colors tracking-tight"
                title={getQuickAccessTitle(item)}
              >
                {getQuickAccessTitle(item)}
              </span>

              <div className="pr-3 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 shrink-0">
                <button
                  id={`play-qa-${item.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onPlayCollection) {
                      onPlayCollection(item, item.playlistId);
                    } else {
                      onSelectCollection(item, item.playlistId);
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-[#0F172A] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90 flex items-center justify-center shadow-[0_4px_12px_rgba(15,23,42,0.25)] dark:shadow-[0_4px_12px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                  title={`Play ${getQuickAccessTitle(item)}`}
                  aria-label={`Play ${getQuickAccessTitle(item)}`}
                >
                  <Play size={13} className="fill-white text-white dark:fill-black dark:text-black" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="home-moods-section" className="relative z-10 mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Compass size={18} className="text-slate-800 dark:text-white/70" />
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#0F172A] dark:text-white">
              {t.moods?.title || 'Moods & Genres'}
            </h2>
          </div>
          <button
            onClick={onShowAll}
            className="text-xs font-bold text-[#64748B] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white px-3 py-1 rounded-full bg-white/50 dark:bg-white/[0.08] hover:bg-white/80 dark:hover:bg-white/[0.14] border border-white/80 dark:border-white/10 transition-all shadow-xs cursor-pointer"
          >
            {t.moods?.allMoods || 'All Moods & Genres'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2">
          {moodPills.slice(0, 8).map((pill) => (
            <div
              key={pill.id}
              onClick={() => handlePlayMood(pill)}
              className="group relative h-12 rounded-xl bg-white/60 dark:bg-[#1C1C1E]/80 hover:bg-white/85 dark:hover:bg-[#2C2C2E] border border-white/80 dark:border-white/10 hover:border-white dark:hover:border-white/20 transition-all duration-150 cursor-pointer flex items-center px-3 gap-3 overflow-hidden shadow-xs hover:shadow-md"
            >
              <div
                className="w-1.5 h-6 rounded-full shrink-0 shadow-xs transition-transform group-hover:scale-y-110"
                style={{ backgroundColor: pill.stripeColor }}
              />
              <span className="text-xs sm:text-sm font-semibold text-[#0F172A] dark:text-white/90 group-hover:text-black dark:group-hover:text-white truncate flex-1 min-w-0">
                {pill.title}
              </span>
              <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-7 h-7 rounded-full bg-[#0F172A] text-white dark:bg-white dark:text-black flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-transform">
                  <Play size={11} className="fill-white dark:fill-black" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. SECTION: RECOMMENDED STATIONS */}
      <section id="recommended-stations-section" className="relative z-10 mb-9">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-xs font-semibold text-[#64748B] dark:text-white/70 tracking-wide mb-1">
              {t.home.nonStopMusic}
            </p>
            <h2 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-white">
              {t.home.recommendedStations}
            </h2>
          </div>
          <button
            id="show-all-stations-btn"
            onClick={onShowAll}
            className="text-xs font-bold text-[#64748B] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white px-3 py-1 rounded-full bg-white/50 dark:bg-white/[0.08] hover:bg-white/80 dark:hover:bg-white/[0.14] border border-white/80 dark:border-white/10 transition-all shadow-xs cursor-pointer"
          >
            {t.home.showAll}
          </button>
        </div>

        {/* Recommended Stations Responsive Grid */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {RECOMMENDED_STATIONS.map((station) => (
            <div
              key={station.id}
              id={`station-card-${station.id}`}
              onClick={() => onOpenStation(station)}
              className="group flex flex-col p-3 rounded-2xl bg-white/50 dark:bg-white/[0.06] hover:bg-white/80 dark:hover:bg-white/[0.12] backdrop-blur-xl border border-white/80 dark:border-white/10 hover:border-white dark:hover:border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-none hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)] cursor-pointer transition-all duration-200 min-w-0"
            >
              {/* Authentic Spotify-style Radio Graphic Artwork */}
              <div
                className={`relative aspect-square w-full rounded-xl overflow-hidden shadow-md bg-gradient-to-br ${station.accentGradient} flex flex-col justify-between p-3 select-none`}
              >
                {/* Top Badge: Radio icon & "RADIO" */}
                <div className="flex items-center justify-between z-10">
                  <div className="flex items-center gap-1 opacity-90">
                    <Radio size={13} className="text-white" />
                  </div>
                  <span className="text-[10px] font-black tracking-widest text-white/90 bg-black/35 px-1.5 py-0.5 rounded backdrop-blur-xs shrink-0">
                    {station.badgeLabel}
                  </span>
                </div>

                {/* Center / Split Graphic Texture */}
                <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                  <div className="w-24 h-24 rounded-full border border-white/30 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border border-white/40 flex items-center justify-center text-white/50 text-2xl font-black">
                      {station.artistInitials}
                    </div>
                  </div>
                </div>

                {/* Bottom Bold Station Title */}
                <div className="relative z-10 pt-4 min-w-0">
                  <span className="text-sm sm:text-base font-extrabold text-white tracking-tight leading-none block drop-shadow-md truncate">
                    {station.title}
                  </span>
                </div>

                {/* Hover Floating Play Button - MATCHED with bottom player */}
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
                  <button
                    id={`play-station-btn-${station.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayStation(station);
                    }}
                    className="w-10 h-10 rounded-full bg-[#0F172A] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90 flex items-center justify-center shadow-[0_4px_14px_rgba(15,23,42,0.3)] dark:shadow-[0_4px_16px_rgba(255,255,255,0.25)] hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                    title={`${t.player.play} ${station.title}`}
                  >
                    <Play size={16} className="fill-white dark:fill-black" />
                  </button>
                </div>
              </div>

              {/* Station Artists Subtitle */}
              <div className="mt-2.5 px-0.5 min-w-0">
                <p
                  className="text-xs text-[#64748B] dark:text-white/60 group-hover:text-[#475569] dark:group-hover:text-white/80 leading-snug truncate transition-colors"
                  title={
                    station.artistsSummary.startsWith('With ')
                      ? `${t.hero.withPrefix}${station.artistsSummary.slice(5)}`
                      : station.artistsSummary
                  }
                >
                  {station.artistsSummary.startsWith('With ')
                    ? `${t.hero.withPrefix}${station.artistsSummary.slice(5)}`
                    : station.artistsSummary}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. SECTION: MADE FOR YOU */}
      <section id="made-for-you-section" className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-white">
            {t.home.madeForYou}
          </h2>
          <button
            id="show-all-made-for-you-btn"
            onClick={onShowAll}
            className="text-xs font-bold text-[#64748B] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white px-3 py-1 rounded-full bg-white/50 dark:bg-white/[0.08] hover:bg-white/80 dark:hover:bg-white/[0.14] border border-white/80 dark:border-white/10 transition-all shadow-xs cursor-pointer"
          >
            {t.home.showAll}
          </button>
        </div>

        {/* Made For You Responsive Grid */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {displayMixes.map((item) => (
            <div
              key={item.id}
              id={`made-for-you-card-${item.id}`}
              onClick={() => onOpenMix(item)}
              className="group flex flex-col p-3 rounded-2xl bg-white/50 dark:bg-white/[0.06] hover:bg-white/80 dark:hover:bg-white/[0.12] backdrop-blur-xl border border-white/80 dark:border-white/10 hover:border-white dark:hover:border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-none hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)] cursor-pointer transition-all duration-200 min-w-0"
            >
              {/* Artwork Box */}
              <div
                className={`relative aspect-square w-full rounded-xl overflow-hidden shadow-md bg-gradient-to-br ${item.bgGradient} flex flex-col justify-between select-none`}
              >
                {item.cardVariant === 'discover' ? (
                  /* Discover Weekly Geometric Style */
                  <div className="w-full h-full flex flex-col justify-between p-3 relative overflow-hidden bg-black">
                    {/* Logo icon top */}
                    <div className="flex items-center gap-1.5 z-10">
                      <Sparkles size={14} className="text-cyan-400" />
                    </div>

                    {/* Geometric Gradient Ribbons */}
                    <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-gradient-to-tr from-cyan-400 via-indigo-500 to-fuchsia-500 opacity-80 blur-lg pointer-events-none" />

                    {/* Big Condensed Typography */}
                    <div className="relative z-10 min-w-0">
                      <span className="text-[17px] sm:text-[20px] font-black tracking-tight text-white leading-[0.95] block uppercase font-mono truncate">
                        DISCOVER
                        <br />
                        WEEKLY
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Daily Mix Style with bottom banner & number badge */
                  <div className="w-full h-full flex flex-col justify-between relative overflow-hidden">
                    {/* Visual Art/Photo texture */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />
                    <div className="p-2.5 relative z-10">
                      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                        <Music size={11} className="text-white" />
                      </div>
                    </div>

                    {/* Bottom Pill Banner: "Daily Mix | 01" */}
                    <div className="p-2 relative z-10 min-w-0">
                      <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md rounded-lg p-1.5 border border-white/10 min-w-0 overflow-hidden">
                        <div
                          className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-black uppercase text-black shrink-0"
                          style={{ backgroundColor: item.badgeColor }}
                        >
                          {t.home.dailyMix}
                        </div>
                        <span className="text-xs font-black text-white ml-auto pr-1 shrink-0">
                          {item.mixNumber}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Hover Play Button - MATCHED with bottom player */}
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
                  <button
                    id={`play-mix-btn-${item.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayMix(item);
                    }}
                    className="w-10 h-10 rounded-full bg-[#0F172A] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90 flex items-center justify-center shadow-[0_4px_14px_rgba(15,23,42,0.3)] dark:shadow-[0_4px_16px_rgba(255,255,255,0.25)] hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                    title={`${t.player.play} ${item.title}`}
                  >
                    <Play size={16} className="fill-white dark:fill-black" />
                  </button>
                </div>
              </div>

              {/* Subtitle / Description */}
              <div className="mt-2.5 px-0.5 min-w-0">
                <p
                  className="text-xs text-[#64748B] dark:text-white/60 group-hover:text-[#475569] dark:group-hover:text-white/80 leading-snug truncate transition-colors"
                  title={
                    item.subtitle.includes(' and more.')
                      ? item.subtitle.replace(' and more.', ` ${t.hero.andMore}.`)
                      : item.subtitle
                  }
                >
                  {item.subtitle.includes(' and more.')
                    ? item.subtitle.replace(' and more.', ` ${t.hero.andMore}.`)
                    : item.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
