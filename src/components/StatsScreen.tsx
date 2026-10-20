import React, { useEffect } from 'react';
import {
  ArrowLeft,
  Clock,
  Music,
  User,
  Activity,
  Play,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { useStatsStore, type StatsTimeRange } from '../store/statsStore';
import { useLibraryStore } from '../store/libraryStore';
import { usePlayerStore } from '../store/playerStore';
import { useTranslation } from '../i18n';
import { PlaceholderArtwork } from './PlaceholderArtwork';
import type { Track } from '../types';

export const StatsScreen: React.FC = () => {
  const { t, language } = useTranslation();
  const {
    timeRange,
    stats,
    isLoading,
    setTimeRange,
    loadStats,
  } = useStatsStore();

  const navigateBack = useLibraryStore((s) => s.navigateBack);
  const followedArtists = useLibraryStore((s) => s.followedArtists);
  const playTrack = usePlayerStore((s) => s.playTrack);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const s = t.stats || {
    title: language === 'ru' ? 'Статистика' : 'Listening Stats',
    subtitle: language === 'ru' ? 'История прослушиваний, любимые артисты и ритм дня' : 'Your personal listening history, top artists, and music habits',
    thisWeek: language === 'ru' ? 'Эта неделя' : 'This Week',
    thisMonth: language === 'ru' ? 'Этот месяц' : 'This Month',
    thisYear: '2026',
    allTime: language === 'ru' ? 'Всё время' : 'All Time',
    musicTime: language === 'ru' ? 'Время в музыке' : 'Listening Time',
    musicTimeDesc: language === 'ru' ? 'Всего за выбранный период' : 'Total time in selected period',
    tracksPlayed: language === 'ru' ? 'Прослушано треков' : 'Tracks Played',
    uniqueSongs: language === 'ru' ? 'уникальных песен' : 'unique songs',
    topArtist: language === 'ru' ? 'Топ артист' : 'Top Artist',
    plays: language === 'ru' ? 'прослушиваний' : 'plays',
    peakRhythm: language === 'ru' ? 'Пик активности' : 'Peak Rhythm',
    topTracks: language === 'ru' ? 'Топ треков' : 'Top Tracks',
    topTracksDesc: language === 'ru' ? 'Самые частые треки за период' : 'Most played this period',
    topArtists: language === 'ru' ? 'Топ артистов' : 'Top Artists',
    topArtistsDesc: language === 'ru' ? 'По времени и числу треков' : 'By plays and listening time',
    hourlyRhythm: language === 'ru' ? '24-часовой биоритм' : '24-Hour Rhythm',
    peakHourPrefix: language === 'ru' ? 'Пик:' : 'Peak:',
    dailyActivity: language === 'ru' ? 'Активность по дням' : 'Day-of-Week Activity',
    favoriteDayPrefix: language === 'ru' ? 'Любимый день:' : 'Top day:',
    nightOwl: language === 'ru' ? 'Ночной меломан' : 'Night Owl',
    eveningVibe: language === 'ru' ? 'Вечерний вайб' : 'Evening Vibe',
    dayListener: language === 'ru' ? 'Дневной слушатель' : 'Daytime Flow',
    morningListener: language === 'ru' ? 'Утренний слушатель' : 'Early Bird',
    noDataTitle: language === 'ru' ? 'Пока мало данных' : 'No listening data yet',
    noDataDesc: language === 'ru' ? 'Слушай треки более 30 секунд, и здесь появится твоя статистика.' : 'Listen to songs for more than 30 seconds to start building your stats.',
    playsSingle: language === 'ru' ? 'раз' : 'play',
    playsMultiple: language === 'ru' ? 'раз' : 'plays',
    hours: language === 'ru' ? 'ч' : 'hr',
    minutes: language === 'ru' ? 'мин' : 'min',
  };

  const formatHoursMinutes = (totalSec: number): string => {
    if (!totalSec || totalSec <= 0) return `0 ${s.minutes}`;
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    if (hrs > 0) {
      return `${hrs} ${s.hours} ${mins} ${s.minutes}`;
    }
    return `${Math.max(1, mins)} ${s.minutes}`;
  };

  const getRangeLabel = (range: StatsTimeRange): string => {
    if (range === 'week') return s.thisWeek;
    if (range === 'month') return s.thisMonth;
    if (range === 'year') return s.thisYear;
    return s.allTime;
  };

  const getDayLabel = (idx: number): string => {
    const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysRu = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return language === 'ru' ? daysRu[idx] : daysEn[idx];
  };

  const getVibeLabel = (hour: number): string => {
    if (hour >= 22 || hour < 5) return s.nightOwl;
    if (hour >= 18) return s.eveningVibe;
    if (hour >= 12) return s.dayListener;
    return s.morningListener;
  };

  const getArtistAvatar = (artistName: string, fallbackUrl?: string): string | undefined => {
    if (!artistName) return fallbackUrl;
    const clean = artistName.trim().toLowerCase();
    const followed = followedArtists.find((a) => a.name.toLowerCase() === clean);
    return followed?.avatarUrl || fallbackUrl;
  };

  const handlePlayTopTrack = (tItem: { trackId: string; title: string; artist: string; artworkUrl?: string }) => {
    const minimalTrack: Track = {
      id: tItem.trackId || `stat-${Date.now()}`,
      number: 1,
      title: tItem.title,
      artist: tItem.artist,
      duration: '3:00',
      durationSec: 180,
      source: 'YT',
      sourceLabel: 'YouTube',
      iconName: 'music',
      isLiked: false,
      playbackCount: 1,
      artworkUrl: tItem.artworkUrl,
      thumbnail: tItem.artworkUrl,
    };
    playTrack(minimalTrack, [minimalTrack]);
  };

  const maxHourValue = stats ? Math.max(1, ...stats.hourlyDistribution) : 1;
  const maxDayValue = stats ? Math.max(1, ...stats.dayOfWeekDistribution) : 1;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 lg:px-10 py-6 sm:py-8 select-none">
      <div className="max-w-6xl mx-auto space-y-6 mb-8">
        <div className="flex items-center gap-3.5">
          <button
            onClick={navigateBack}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/[0.06] dark:border-white/10 transition-colors cursor-pointer"
            title={language === 'ru' ? 'Назад' : 'Back'}
          >
            <ArrowLeft size={18} className="text-slate-900 dark:text-white" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {s.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-white/60 font-medium mt-0.5">
              {s.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1 border-t border-black/[0.05] dark:border-white/10">
          <div className="inline-flex items-center p-1 rounded-xl bg-black/[0.05] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/10">
            {(['week', 'month', 'year', 'all'] as StatsTimeRange[]).map((r) => {
              const active = timeRange === r;
              return (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-[#1C3061] text-white shadow-sm dark:bg-white dark:text-black dark:shadow-[0_0_12px_rgba(255,255,255,0.25)]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-black/5 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/10'
                  }`}
                >
                  {getRangeLabel(r)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="max-w-6xl mx-auto h-72 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-white/40">
          <div className="w-7 h-7 rounded-full border-2 border-slate-900 dark:border-white border-t-transparent animate-spin" />
        </div>
      ) : !stats || stats.totalPlays === 0 ? (
        <div className="max-w-6xl mx-auto py-20 text-center rounded-2xl border border-black/[0.06] dark:border-white/10 bg-white/50 dark:bg-white/[0.02] backdrop-blur-xl p-8">
          <div className="w-14 h-14 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-slate-700 dark:text-white/70 flex items-center justify-center mx-auto mb-4">
            <Activity size={26} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{s.noDataTitle}</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-white/50 max-w-md mx-auto mt-1.5">
            {s.noDataDesc}
          </p>
        </div>
      ) : (
        <div className="stats-cq-container max-w-6xl mx-auto space-y-6 pb-16">
          <div className="stats-cq-metrics">
            <div className="p-4 sm:p-5 rounded-2xl bg-white/70 dark:bg-[#0C0C10]/80 backdrop-blur-xl border border-black/[0.06] dark:border-white/10 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">
                    {s.musicTime}
                  </span>
                  <Clock size={15} className="text-[#1C3061] dark:text-white/60 shrink-0" />
                </div>
                <div className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                  {formatHoursMinutes(stats.totalListenedSec)}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-white/40 mt-1 truncate" title={s.musicTimeDesc}>
                {s.musicTimeDesc}
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white/70 dark:bg-[#0C0C10]/80 backdrop-blur-xl border border-black/[0.06] dark:border-white/10 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">
                    {s.tracksPlayed}
                  </span>
                  <Music size={15} className="text-[#1C3061] dark:text-white/60 shrink-0" />
                </div>
                <div className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                  {stats.totalPlays}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-white/40 mt-1 truncate">
                {stats.uniqueTracksCount} {s.uniqueSongs}
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white/70 dark:bg-[#0C0C10]/80 backdrop-blur-xl border border-black/[0.06] dark:border-white/10 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">
                    {s.topArtist}
                  </span>
                  <User size={15} className="text-[#1C3061] dark:text-white/60 shrink-0" />
                </div>
                <div
                  className="text-base sm:text-lg md:text-xl font-black text-slate-900 dark:text-white truncate"
                  title={stats.topArtists[0]?.artist || '—'}
                >
                  {stats.topArtists[0]?.artist || '—'}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-white/40 mt-1 truncate">
                {stats.topArtists[0] ? `${stats.topArtists[0].playCount} ${s.plays}` : `0 ${s.plays}`}
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white/70 dark:bg-[#0C0C10]/80 backdrop-blur-xl border border-black/[0.06] dark:border-white/10 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">
                    {s.peakRhythm}
                  </span>
                  <Activity size={15} className="text-[#1C3061] dark:text-white/60 shrink-0" />
                </div>
                <div className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                  {stats.peakHour}:00
                </div>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-white/40 mt-1 truncate">
                {getVibeLabel(stats.peakHour)}
              </p>
            </div>
          </div>

          <div className="stats-cq-split">
            <div className="p-5 sm:p-6 rounded-2xl bg-white/70 dark:bg-[#0C0C10]/80 backdrop-blur-xl border border-black/[0.06] dark:border-white/10 shadow-xs flex flex-col">
              <div className="mb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp size={16} className="text-[#1C3061] dark:text-white" />
                  <span>{s.topTracks}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
                  {s.topTracksDesc}
                </p>
              </div>

              <div className="space-y-2 flex-1">
                {stats.topTracks.slice(0, 5).map((track, idx) => (
                  <div
                    key={track.trackId || idx}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition-colors group cursor-pointer"
                    onClick={() => handlePlayTopTrack(track)}
                  >
                    <span className="w-5 text-center font-bold text-xs text-slate-400 dark:text-white/40 shrink-0">
                      {idx + 1}
                    </span>

                    <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 shadow-2xs">
                      <PlaceholderArtwork
                        imageUrl={track.artworkUrl}
                        size={40}
                        rounded="rounded-lg"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                        <Play size={15} fill="white" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3
                        className="text-sm font-semibold text-slate-900 dark:text-white truncate"
                        title={track.title}
                      >
                        {track.title}
                      </h3>
                      <p
                        className="text-xs text-slate-500 dark:text-white/50 truncate mt-0.5"
                        title={track.artist}
                      >
                        {track.artist}
                      </p>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white block whitespace-nowrap">
                        {track.playCount} {track.playCount === 1 ? s.playsSingle : s.playsMultiple}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-white/40 block whitespace-nowrap">
                        {formatHoursMinutes(track.totalSec)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-white/70 dark:bg-[#0C0C10]/80 backdrop-blur-xl border border-black/[0.06] dark:border-white/10 shadow-xs flex flex-col">
              <div className="mb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <User size={16} className="text-[#1C3061] dark:text-white" />
                  <span>{s.topArtists}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
                  {s.topArtistsDesc}
                </p>
              </div>

              <div className="space-y-2 flex-1">
                {stats.topArtists.slice(0, 5).map((artist, idx) => {
                  const avatar = getArtistAvatar(artist.artist, artist.avatarUrl);
                  return (
                    <div
                      key={artist.artist || idx}
                      className="flex items-center gap-3 p-2 rounded-xl"
                    >
                      <span className="w-5 text-center font-bold text-xs text-slate-400 dark:text-white/40 shrink-0">
                        {idx + 1}
                      </span>

                      <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border border-black/[0.08] dark:border-white/10">
                        {avatar ? (
                          <img
                            src={avatar}
                            alt={artist.artist}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 flex items-center justify-center font-bold text-sm">
                            {artist.artist.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3
                          className="text-sm font-semibold text-slate-900 dark:text-white truncate"
                          title={artist.artist}
                        >
                          {artist.artist}
                        </h3>
                        <p
                          className="text-[11px] text-slate-400 dark:text-white/40 truncate mt-0.5"
                          title={artist.sampleTracks?.join(', ') || ''}
                        >
                          {artist.sampleTracks && artist.sampleTracks.length > 0
                            ? artist.sampleTracks.slice(0, 2).join(', ')
                            : `${artist.playCount} ${s.plays}`}
                        </p>
                      </div>

                      <div className="text-right shrink-0 pl-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block whitespace-nowrap">
                          {formatHoursMinutes(artist.totalSec)}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-white/40 block whitespace-nowrap">
                          {artist.playCount} {s.plays}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="stats-cq-split">
            <div className="p-5 sm:p-6 rounded-2xl bg-white/70 dark:bg-[#0C0C10]/80 backdrop-blur-xl border border-black/[0.06] dark:border-white/10 shadow-xs">
              <div className="mb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity size={16} className="text-[#1C3061] dark:text-white" />
                  <span>{s.hourlyRhythm}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
                  {s.peakHourPrefix} {stats.peakHour}:00 ({getVibeLabel(stats.peakHour)})
                </p>
              </div>

              <div className="h-28 flex items-end gap-1 sm:gap-1.5 pt-4">
                {stats.hourlyDistribution.map((val, hour) => {
                  const heightPercent = maxHourValue > 0 ? Math.max(8, Math.round((val / maxHourValue) / 0.01)) : 8;
                  const isPeak = hour === stats.peakHour && val > 0;
                  return (
                    <div
                      key={hour}
                      className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end"
                    >
                      <div
                        className={`w-full rounded-t-sm transition-all duration-200 ${
                          isPeak
                            ? 'bg-[#1C3061] dark:bg-white shadow-xs dark:shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                            : val > 0
                            ? 'bg-[#1C3061]/40 hover:bg-[#1C3061]/70 dark:bg-white/20 dark:hover:bg-white/40'
                            : 'bg-black/[0.04] dark:bg-white/[0.04]'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                      <span className="text-[9px] text-slate-400 dark:text-white/30 font-mono hidden sm:block">
                        {hour % 6 === 0 ? hour : ''}
                      </span>
                      <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-900 dark:bg-zinc-800 text-white text-[10px] px-1.5 py-0.5 rounded-sm whitespace-nowrap z-20 shadow-md">
                        {hour}:00 — {val} {val === 1 ? s.playsSingle : s.playsMultiple}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] font-medium text-slate-400 dark:text-white/30 mt-2 px-1">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:00</span>
              </div>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-white/70 dark:bg-[#0C0C10]/80 backdrop-blur-xl border border-black/[0.06] dark:border-white/10 shadow-xs">
              <div className="mb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar size={16} className="text-[#1C3061] dark:text-white" />
                  <span>{s.dailyActivity}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
                  {s.favoriteDayPrefix} {getDayLabel(stats.peakDay)}
                </p>
              </div>

              <div className="space-y-2 pt-1">
                {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
                  const val = stats.dayOfWeekDistribution[dayIdx] || 0;
                  const widthPercent = maxDayValue > 0 ? Math.max(6, Math.round((val / maxDayValue) / 0.01)) : 6;
                  const isTopDay = dayIdx === stats.peakDay && val > 0;
                  return (
                    <div key={dayIdx} className="flex items-center gap-3">
                      <span className={`w-6 text-xs font-bold ${isTopDay ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-white/50'}`}>
                        {getDayLabel(dayIdx)}
                      </span>
                      <div className="flex-1 h-2.5 rounded-full bg-black/[0.05] dark:bg-white/[0.06] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isTopDay
                              ? 'bg-[#1C3061] dark:bg-white dark:shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                              : 'bg-[#1C3061]/35 dark:bg-white/20'
                          }`}
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 dark:text-white/40 w-8 text-right">
                        {val}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
