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

interface HomeScreenProps {
  onSelectCollection: (title: string, playlistId?: string) => void;
  onPlayCollection?: (title: string, playlistId?: string) => void;
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
  const { t } = useTranslation();
  const settingsStore = useSettingsStore();
  const playerStore = usePlayerStore();
  const libraryStore = useLibraryStore();
  const toastStore = useToastStore();
  const favoriteArtists = settingsStore.favoriteArtists || [];
  const [isWaveLoading, setIsWaveLoading] = useState<boolean>(false);
  const [moodPills, setMoodPills] = useState<MoodOrGenreItem[]>([
    { id: 'm-1', title: 'В дороге', stripeColor: '#ffc200', params: '', browseId: '' },
    { id: 'm-2', title: 'Заряд энергии', stripeColor: '#ffc200', params: '', browseId: '' },
    { id: 'm-3', title: 'Отдых', stripeColor: '#00a513', params: '', browseId: '' },
    { id: 'm-4', title: 'Концентрация', stripeColor: '#337dff', params: '', browseId: '' },
    { id: 'm-5', title: 'Вечеринка', stripeColor: '#b47bff', params: '', browseId: '' },
    { id: 'm-6', title: 'Романтика', stripeColor: '#e24b00', params: '', browseId: '' },
    { id: 'm-7', title: 'Рок', stripeColor: '#e24b00', params: '', browseId: '' },
    { id: 'm-8', title: 'Хип-хоп', stripeColor: '#ff8500', params: '', browseId: '' },
  ]);

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

  useEffect(() => {
    let isMounted = true;
    if (window.electronAPI?.getMoodsAndGenres) {
      window.electronAPI
        .getMoodsAndGenres()
        .then((sections) => {
          if (isMounted && Array.isArray(sections) && sections.length > 0) {
            const allItems: MoodOrGenreItem[] = [];
            for (const s of sections) {
              if (s.items && Array.isArray(s.items)) {
                allItems.push(...s.items);
              }
            }
            if (allItems.length > 0) {
              setMoodPills(allItems.slice(0, 8));
            }
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, []);

  const handleWaveClick = async () => {
    if (favoriteArtists.length === 0) {
      settingsStore.setIsOnboardingModalOpen(true);
      return;
    }
    setIsWaveLoading(true);
    try {
      const tracks = await generateWaveTracks(favoriteArtists);
      if (tracks && tracks.length > 0) {
        libraryStore.setCustomPlaylistView('Моя волна', tracks, {
          creator: 'Otofy',
          description: `Персональный поток музыки на основе: ${favoriteArtists.join(', ')}`,
          iconName: 'waves',
          gradientFrom: '#4C1D95',
          gradientTo: '#0F172A',
        });
        await playerStore.playTrack(tracks[0], tracks);
        toastStore.success('Моя волна запущена', `Воспроизведение персональной волны (${tracks.length} треков)`);
      }
    } catch (e) {
      console.warn('[HomeScreen] My wave failed:', e);
      toastStore.error('Ошибка', 'Не удалось загрузить Мою волну');
    } finally {
      setIsWaveLoading(false);
    }
  };

  const handlePlayMood = async (item: MoodOrGenreItem) => {
    try {
      let tracks: any[] = [];
      if (window.electronAPI?.getGenreTracks) {
        tracks = await window.electronAPI.getGenreTracks(item.title);
      }
      if (tracks && tracks.length > 0) {
        libraryStore.setCustomPlaylistView(item.title, tracks, {
          creator: 'YouTube Music',
          description: `Станция настроения: ${item.title}`,
          iconName: 'radio',
          gradientFrom: '#1E293B',
          gradientTo: '#0F172A',
        });
        await playerStore.playTrack(tracks[0], tracks);
        toastStore.success('Станция запущена', `Воспроизведение: «${item.title}»`);
      }
    } catch {
      toastStore.error('Ошибка', 'Не удалось запустить станцию');
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
    <div id="home-screen-view" className="flex-1 overflow-y-auto px-6 py-5 pb-20 relative select-none">
      {/* Dark theme vertical gradient: deep charcoal/gray to obsidian pitch-black */}
      <div
        className="pointer-events-none absolute inset-0 z-0 dark:block hidden"
        style={{
          background: 'linear-gradient(180deg, #181822 0%, #0d0d14 30%, #060609 65%, #000000 100%)',
        }}
      />

      {/* Top Subtle Gloss Sheen */}
      <div className="pointer-events-none absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-white/40 dark:from-white/[0.04] to-transparent z-0" />

      <section id="my-wave-hero-section" className="relative z-10 mb-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-900/40 via-purple-900/30 to-indigo-950/40 backdrop-blur-xl border border-white/10 p-5 sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col md:flex-row items-start md:items-center justify-between gap-5 group">
          <div className="pointer-events-none absolute -top-16 -left-16 w-56 h-56 rounded-full bg-violet-600/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 right-1/4 w-56 h-56 rounded-full bg-cyan-600/15 blur-3xl" />

          <div className="relative z-10 flex items-center gap-4 min-w-0">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-[0_8px_24px_rgba(124,58,237,0.4)] overflow-hidden">
              <div className="absolute inset-0 bg-white/10 mix-blend-overlay" />
              <Waves size={36} className="text-white drop-shadow-md animate-pulse" />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-white/15 text-white/90 border border-white/10">
                  Персональный поток
                </span>
                {favoriteArtists.length > 0 && (
                  <span className="text-[11px] text-white/50 font-medium">
                    {favoriteArtists.length} любимых артистов
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Моя волна
              </h2>

              <p className="text-xs sm:text-sm text-white/70 max-w-xl truncate mt-0.5">
                {favoriteArtists.length > 0
                  ? `На основе: ${favoriteArtists.slice(0, 4).join(', ')}${favoriteArtists.length > 4 ? ' и других' : ''}`
                  : 'Бесконечный поток музыки, подобранный под ваши предпочтения'}
              </p>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={() => settingsStore.setIsOnboardingModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 hover:border-white/20 text-xs font-semibold text-white/80 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Настроить любимых исполнителей"
            >
              <Sparkles size={14} className="text-violet-300" />
              <span>Настроить</span>
            </button>

            <button
              id="play-my-wave-btn"
              onClick={handleWaveClick}
              disabled={isWaveLoading}
              className="h-11 px-5 rounded-xl bg-white text-black hover:bg-white/90 active:scale-95 transition-all font-bold text-sm flex items-center gap-2 shadow-[0_4px_20px_rgba(255,255,255,0.3)] cursor-pointer shrink-0"
              title="Включить Мою волну"
            >
              {isWaveLoading ? (
                <Loader2 size={18} className="animate-spin text-black" />
              ) : (
                <Play size={18} className="fill-black translate-x-0.5" />
              )}
              <span>Слушать</span>
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
              onClick={() => onSelectCollection(item.title, item.playlistId)}
              className="group relative h-14 rounded-lg bg-white/45 dark:bg-white/[0.05] hover:bg-white/80 dark:hover:bg-white/[0.10] active:bg-white/90 dark:active:bg-white/[0.15] backdrop-blur-xl border border-white/85 dark:border-white/10 hover:border-white dark:hover:border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-none hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)] flex items-center overflow-hidden cursor-pointer transition-all duration-200"
            >
              {/* Left Artwork Thumbnail */}
              <div
                className="w-14 h-14 shrink-0 flex items-center justify-center shadow-inner relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${item.gradientFrom}, ${item.gradientTo})`,
                }}
              >
                {/* Visual texture overlay */}
                <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
                <div className="relative z-10">{renderQuickAccessIcon(item)}</div>
              </div>

              {/* Title label */}
              <span
                className="flex-1 px-3 text-[13px] font-semibold text-[#0F172A] dark:text-white truncate group-hover:text-black dark:group-hover:text-white transition-colors tracking-tight"
                title={getQuickAccessTitle(item)}
              >
                {getQuickAccessTitle(item)}
              </span>

              {/* Smooth Hover Play Action Button - MATCHED with bottom player */}
              <div className="pr-3 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0">
                <button
                  id={`play-qa-${item.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onPlayCollection) {
                      onPlayCollection(item.title, item.playlistId);
                    } else {
                      onSelectCollection(item.title, item.playlistId);
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-[#0F172A] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90 flex items-center justify-center shadow-[0_4px_12px_rgba(15,23,42,0.25)] dark:shadow-[0_4px_12px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-transform"
                  title={`Play ${getQuickAccessTitle(item)}`}
                  aria-label={`Play ${getQuickAccessTitle(item)}`}
                >
                  <Play size={14} className="fill-white dark:fill-black translate-x-0.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="home-moods-section" className="relative z-10 mb-8">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Compass size={18} className="text-white/70" />
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#0F172A] dark:text-white">
              Настроения и жанры
            </h2>
          </div>
          <button
            onClick={onShowAll}
            className="text-xs font-bold text-[#64748B] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white px-3 py-1 rounded-full bg-white/50 dark:bg-white/[0.08] hover:bg-white/80 dark:hover:bg-white/[0.14] border border-white/80 dark:border-white/10 transition-all shadow-xs cursor-pointer"
          >
            Все жанры и настроения
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2.5">
          {moodPills.slice(0, 8).map((pill) => (
            <div
              key={pill.id}
              onClick={() => handlePlayMood(pill)}
              className="group relative h-12 rounded-xl bg-white/45 dark:bg-[#1C1C1E]/80 hover:bg-white/75 dark:hover:bg-[#2C2C2E] border border-white/80 dark:border-white/10 hover:border-white dark:hover:border-white/20 transition-all duration-150 cursor-pointer flex items-center px-3.5 gap-3 overflow-hidden shadow-xs hover:shadow-md"
            >
              <div
                className="w-1.5 h-6 rounded-full shrink-0 shadow-xs transition-transform group-hover:scale-y-110"
                style={{ backgroundColor: pill.stripeColor }}
              />
              <span className="text-xs sm:text-sm font-semibold text-[#0F172A] dark:text-white/90 group-hover:text-black dark:group-hover:text-white truncate flex-1">
                {pill.title}
              </span>
              <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-7 h-7 rounded-full bg-[#0F172A] text-white dark:bg-white dark:text-black flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-transform">
                  <Play size={11} className="fill-white dark:fill-black translate-x-0.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. SECTION: RECOMMENDED STATIONS */}
      <section id="recommended-stations-section" className="relative z-10 mb-9">
        <div className="flex items-end justify-between mb-3.5">
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
            className="text-xs font-bold text-[#64748B] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white px-3 py-1 rounded-full bg-white/50 dark:bg-white/[0.08] hover:bg-white/80 dark:hover:bg-white/[0.14] border border-white/80 dark:border-white/10 transition-all shadow-xs"
          >
            {t.home.showAll}
          </button>
        </div>

        {/* Recommended Stations Responsive Grid */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3.5">
          {RECOMMENDED_STATIONS.map((station) => (
            <div
              key={station.id}
              id={`station-card-${station.id}`}
              onClick={() => onOpenStation(station)}
              className="group flex flex-col p-3 rounded-2xl bg-white/50 dark:bg-white/[0.04] hover:bg-white/80 dark:hover:bg-white/[0.09] backdrop-blur-xl border border-white/80 dark:border-white/[0.08] hover:border-white dark:hover:border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-none hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)] cursor-pointer transition-all duration-200 min-w-0"
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
                <div className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 z-20">
                  <button
                    id={`play-station-btn-${station.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayStation(station);
                    }}
                    className="w-10 h-10 rounded-full bg-[#0F172A] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90 flex items-center justify-center shadow-[0_4px_14px_rgba(15,23,42,0.3)] dark:shadow-[0_4px_16px_rgba(255,255,255,0.25)] hover:scale-105 active:scale-95 transition-transform"
                    title={`${t.player.play} ${station.title}`}
                  >
                    <Play size={16} className="fill-white dark:fill-black translate-x-0.5" />
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
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-white">
            {t.home.madeForYou}
          </h2>
          <button
            id="show-all-made-for-you-btn"
            onClick={onShowAll}
            className="text-xs font-bold text-[#64748B] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white px-3 py-1 rounded-full bg-white/50 dark:bg-white/[0.08] hover:bg-white/80 dark:hover:bg-white/[0.14] border border-white/80 dark:border-white/10 transition-all shadow-xs"
          >
            {t.home.showAll}
          </button>
        </div>

        {/* Made For You Responsive Grid */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3.5">
          {displayMixes.map((item) => (
            <div
              key={item.id}
              id={`made-for-you-card-${item.id}`}
              onClick={() => onOpenMix(item)}
              className="group flex flex-col p-3 rounded-2xl bg-white/50 dark:bg-white/[0.04] hover:bg-white/80 dark:hover:bg-white/[0.09] backdrop-blur-xl border border-white/80 dark:border-white/[0.08] hover:border-white dark:hover:border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-none hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)] cursor-pointer transition-all duration-200 min-w-0"
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
                <div className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 z-20">
                  <button
                    id={`play-mix-btn-${item.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayMix(item);
                    }}
                    className="w-10 h-10 rounded-full bg-[#0F172A] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90 flex items-center justify-center shadow-[0_4px_14px_rgba(15,23,42,0.3)] dark:shadow-[0_4px_16px_rgba(255,255,255,0.25)] hover:scale-105 active:scale-95 transition-transform"
                    title={`${t.player.play} ${item.title}`}
                  >
                    <Play size={16} className="fill-white dark:fill-black translate-x-0.5" />
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
