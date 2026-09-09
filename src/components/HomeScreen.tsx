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
import type { DailyMixConfig } from '../types';

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
  const [dynamicMixes, setDynamicMixes] = useState<DailyMixConfig[]>([]);

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
      case 'radio':
        return <Radio size={20} className="text-emerald-200" />;
      case 'disc':
        return <Disc size={20} className="text-purple-200" />;
      case 'music':
      default:
        return <Music size={20} className="text-white/90" />;
    }
  };

  return (
    <div id="home-screen-view" className="flex-1 overflow-y-auto px-6 py-5 pb-20 relative select-none">
      {/* Top Subtle Gloss Sheen */}
      <div className="pointer-events-none absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-white/40 to-transparent z-0" />

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
              <span className="flex-1 px-3 text-[13px] font-bold text-[#0F172A] dark:text-white truncate group-hover:text-violet-950 dark:group-hover:text-violet-300 transition-colors">
                {item.title}
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
                  title={`Play ${item.title}`}
                  aria-label={`Play ${item.title}`}
                >
                  <Play size={14} className="fill-white dark:fill-black translate-x-0.5" />
                </button>
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
              Non-stop music based on your favorite songs and artists.
            </p>
            <h2 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-white">
              Recommended Stations
            </h2>
          </div>
          <button
            id="show-all-stations-btn"
            onClick={onShowAll}
            className="text-xs font-bold text-[#64748B] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white px-3 py-1 rounded-full bg-white/50 dark:bg-white/[0.08] hover:bg-white/80 dark:hover:bg-white/[0.14] border border-white/80 dark:border-white/10 transition-all shadow-xs"
          >
            Show all
          </button>
        </div>

        {/* 6 Stations Horizontal Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {RECOMMENDED_STATIONS.map((station) => (
            <div
              key={station.id}
              id={`station-card-${station.id}`}
              onClick={() => onOpenStation(station)}
              className="group flex flex-col p-3 rounded-2xl bg-white/50 dark:bg-white/[0.04] hover:bg-white/80 dark:hover:bg-white/[0.09] backdrop-blur-xl border border-white/80 dark:border-white/[0.08] hover:border-white dark:hover:border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-none hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)] cursor-pointer transition-all duration-200"
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
                  <span className="text-[10px] font-black tracking-widest text-white/90 bg-black/35 px-1.5 py-0.5 rounded backdrop-blur-xs">
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
                <div className="relative z-10 pt-4">
                  <span className="text-base font-extrabold text-white tracking-tight leading-none block drop-shadow-md">
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
                    title={`Play ${station.title} Radio`}
                  >
                    <Play size={16} className="fill-white dark:fill-black translate-x-0.5" />
                  </button>
                </div>
              </div>

              {/* Station Artists Subtitle */}
              <div className="mt-2.5 px-0.5">
                <p className="text-xs text-[#64748B] dark:text-white/70 group-hover:text-[#475569] dark:group-hover:text-white leading-snug line-clamp-2 transition-colors">
                  {station.artistsSummary}
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
            Made For You
          </h2>
          <button
            id="show-all-made-for-you-btn"
            onClick={onShowAll}
            className="text-xs font-bold text-[#64748B] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white px-3 py-1 rounded-full bg-white/50 dark:bg-white/[0.08] hover:bg-white/80 dark:hover:bg-white/[0.14] border border-white/80 dark:border-white/10 transition-all shadow-xs"
          >
            Show all
          </button>
        </div>

        {/* 6 Made For You Mix Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {displayMixes.map((item) => (
            <div
              key={item.id}
              id={`made-for-you-card-${item.id}`}
              onClick={() => onOpenMix(item)}
              className="group flex flex-col p-3 rounded-2xl bg-white/50 dark:bg-white/[0.04] hover:bg-white/80 dark:hover:bg-white/[0.09] backdrop-blur-xl border border-white/80 dark:border-white/[0.08] hover:border-white dark:hover:border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_1.5px_rgba(255,255,255,0.9)] dark:shadow-none hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)] cursor-pointer transition-all duration-200"
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
                    <div className="relative z-10">
                      <span className="text-[20px] font-black tracking-tight text-white leading-[0.95] block uppercase font-mono">
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
                    <div className="p-2 relative z-10">
                      <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md rounded-lg p-1.5 border border-white/10">
                        <div
                          className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase text-black"
                          style={{ backgroundColor: item.badgeColor }}
                        >
                          Daily Mix
                        </div>
                        <span className="text-xs font-black text-white ml-auto pr-1">
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
                    title={`Play ${item.title}`}
                  >
                    <Play size={16} className="fill-white dark:fill-black translate-x-0.5" />
                  </button>
                </div>
              </div>

              {/* Subtitle / Description */}
              <div className="mt-2.5 px-0.5">
                <p className="text-xs text-[#64748B] dark:text-white/70 group-hover:text-[#475569] dark:group-hover:text-white leading-snug line-clamp-2 transition-colors">
                  {item.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
