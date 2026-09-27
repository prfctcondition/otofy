import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Plus,
  Check,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Music,
  Loader2,
} from 'lucide-react';
import type { Track, Playlist } from '../types';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import { useSettingsStore } from '../store/settingsStore';
import { useToastStore } from '../store/toastStore';
import { useTranslation } from '../i18n';
import { db } from '../db/database';
import { apiGetRelatedTracks, apiGetGenreTracks } from '../services/musicApiService';

interface SuggestedTracksSectionProps {
  playlist: Playlist;
  tracks: Track[];
}

export const SuggestedTracksSection: React.FC<SuggestedTracksSectionProps> = ({
  playlist,
  tracks,
}) => {
  const [suggestedTracks, setSuggestedTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [addedTrackIds, setAddedTrackIds] = useState<Set<string>>(new Set());
  const [anchorTrackName, setAnchorTrackName] = useState<string>('');

  const { t, language } = useTranslation();
  const playerStore = usePlayerStore();
  const libraryStore = useLibraryStore();
  const settingsStore = useSettingsStore();
  const toastStore = useToastStore();

  const activeTrack = playerStore.activeTrack;
  const isPlaying = playerStore.isPlaying;

  const loadSuggestions = useCallback(async () => {
    if (!tracks || tracks.length === 0) {
      setSuggestedTracks([]);
      return;
    }

    setIsLoading(true);

    try {
      // 1. Identify Anchor Track: check listening history for the most played or most recent track in this playlist
      const historyItems = await db.history.orderBy('playedAt').reverse().limit(300).toArray().catch(() => []);

      let anchorTrack: Track | undefined;
      for (const h of historyItems) {
        const match = tracks.find((t) => t.id === h.trackId || (t.sourceId && t.sourceId === h.trackId));
        if (match) {
          anchorTrack = match;
          break;
        }
      }

      if (!anchorTrack) {
        // Fallback: pick the first track
        anchorTrack = tracks[0];
      }

      setAnchorTrackName(anchorTrack.title);

      // 2. Compute Playlist DNA: frequency of artists
      const artistCounts = new Map<string, number>();
      for (const t of tracks) {
        if (t.artist) {
          const a = t.artist.trim();
          artistCounts.set(a, (artistCounts.get(a) || 0) + 1);
        }
      }
      const sortedArtists = Array.from(artistCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map((e) => e[0]);
      const topArtists = sortedArtists.slice(0, 3);

      const existingIds = new Set(tracks.map((t) => t.id));
      const existingTitles = new Set(
        tracks.map((t) => `${t.title.toLowerCase().trim()}___${t.artist.toLowerCase().trim()}`)
      );

      const candidates: Track[] = [];

      // 3. Vector A: Fetch related / radio tracks for the Anchor Track
      if (anchorTrack.id) {
        try {
          const rawId = anchorTrack.sourceId || anchorTrack.id;
          const cleanId = rawId.replace(/^(yt-|sc-|dm-yt-\d+-|dm-sc-\d+-|dm-)/, '');
          const related = await apiGetRelatedTracks(
            cleanId,
            anchorTrack.source === 'SC' ? 'SC' : 'YT',
            anchorTrack.artist,
            anchorTrack.title
          );
          if (Array.isArray(related)) {
            candidates.push(...related);
          }
        } catch (err) {
          console.warn('[Suggestions] Vector A related tracks failed:', err);
        }
      }

      // 4. Vector B: Supplement with top genre tracks if fewer than 25 candidates
      if (candidates.length < 25) {
        const seedQuery = topArtists[0] || anchorTrack.artist || 'music';
        try {
          const genreTracks = await apiGetGenreTracks(`${seedQuery} radio`);
          if (Array.isArray(genreTracks)) {
            candidates.push(...genreTracks);
          }
        } catch (err) {
          console.warn('[Suggestions] Vector B genre tracks failed:', err);
        }
      }

      // 5. Scoring and Deduplication
      const favoriteArtistsSet = new Set(
        (settingsStore.favoriteArtists || []).map((a) => a.toLowerCase().trim())
      );
      const topArtistsSet = new Set(topArtists.map((a) => a.toLowerCase().trim()));

      const scoredCandidates: Array<{ track: Track; score: number }> = [];
      const seenCandidateIds = new Set<string>();

      for (const cand of candidates) {
        if (!cand || !cand.id || !cand.title) continue;
        if (existingIds.has(cand.id)) continue;

        const candKey = `${cand.title.toLowerCase().trim()}___${cand.artist.toLowerCase().trim()}`;
        if (existingTitles.has(candKey)) continue;
        if (seenCandidateIds.has(cand.id) || seenCandidateIds.has(candKey)) continue;
        seenCandidateIds.add(cand.id);
        seenCandidateIds.add(candKey);

        let score = 10;
        const candArtist = (cand.artist || '').toLowerCase().trim();

        // Bonus for relation to Anchor Track artist
        if (candArtist === anchorTrack.artist.toLowerCase().trim()) {
          score += 40;
        }

        // Bonus if artist belongs to Playlist DNA
        if (topArtistsSet.has(candArtist)) {
          score += 30;
        }

        // Bonus if artist is in user's favorite artists
        if (favoriteArtistsSet.has(candArtist)) {
          score += 25;
        }

        // Bonus if user has listened to this artist before
        if (historyItems.some((h) => h.artist?.toLowerCase().trim() === candArtist)) {
          score += 20;
        }

        scoredCandidates.push({ track: cand, score });
      }

      // Sort by highest relevance score
      scoredCandidates.sort((a, b) => b.score - a.score);

      // Apply diversity limiter: max 2 tracks per artist in suggestions
      const finalSuggestions: Track[] = [];
      const artistTrackCount = new Map<string, number>();

      for (const item of scoredCandidates) {
        const a = item.track.artist.toLowerCase().trim();
        const currentCount = artistTrackCount.get(a) || 0;
        if (currentCount < 2) {
          finalSuggestions.push(item.track);
          artistTrackCount.set(a, currentCount + 1);
        }
        if (finalSuggestions.length >= 20) break;
      }

      setSuggestedTracks(finalSuggestions);
    } catch (err) {
      console.warn('[Suggestions] Load failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tracks, settingsStore.favoriteArtists]);

  useEffect(() => {
    loadSuggestions();
  }, [playlist.id, loadSuggestions]);

  const handleAddTrack = async (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    if (addedTrackIds.has(track.id)) return;
    const addedText = t.suggested?.added || 'Added to playlist';
    const errorText = language === 'ru' ? 'Ошибка' : 'Error';

    try {
      await libraryStore.addTrackToPlaylist(playlist.id, track);
      setAddedTrackIds((prev) => new Set(prev).add(track.id));
      toastStore.success(addedText, `«${track.title}» -> «${playlist.title}»`);
    } catch (err) {
      toastStore.error(errorText, 'Failed to add track to playlist');
    }
  };

  const handlePlaySuggestedTrack = (track: Track) => {
    playerStore.playTrack(track, [track, ...suggestedTracks]);
  };

  const visibleTracks = useMemo(() => {
    return isExpanded ? suggestedTracks.slice(0, 20) : suggestedTracks.slice(0, 5);
  }, [suggestedTracks, isExpanded]);

  if (tracks.length === 0 || (!isLoading && suggestedTracks.length === 0)) {
    return null;
  }

  const subtitleText = anchorTrackName
    ? (t.suggested?.basedOn || "Based on '{name}' and this playlist style").replace('{name}', anchorTrackName)
    : (t.suggested?.defaultSubtitle || 'Similar tracks tailored to your listening taste');

  return (
    <section
      id="playlist-suggested-tracks-section"
      className="mt-8 pt-6 px-6 border-t border-black/[0.06] dark:border-white/[0.08] select-none w-full max-w-full overflow-hidden"
    >
      <div className="flex items-center justify-between mb-4 gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={18} className="text-slate-800 dark:text-white shrink-0" />
            <h3 className="text-base sm:text-lg font-bold text-[#142347] dark:text-white tracking-tight truncate">
              {t.suggested?.title || 'Recommended Tracks'}
            </h3>
          </div>
          <p
            className="text-xs text-[#64748B] dark:text-white/60 mt-0.5 truncate"
            title={subtitleText}
          >
            {subtitleText}
          </p>
        </div>

        <button
          onClick={loadSuggestions}
          disabled={isLoading}
          className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#64748B] dark:text-white/60 hover:text-[#142347] dark:hover:text-white transition-all cursor-pointer shrink-0"
          title={t.suggested?.refresh || 'Refresh recommendations'}
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {isLoading && suggestedTracks.length === 0 && (
        <div className="flex items-center justify-center py-8 text-white/50 text-sm gap-2">
          <Loader2 size={16} className="animate-spin" />
          <span>{t.suggested?.findingTracks || 'Finding similar tracks...'}</span>
        </div>
      )}

      <div className="flex flex-col gap-1 w-full min-w-0">
        {visibleTracks.map((track) => {
          const isCurrentActive = activeTrack?.id === track.id;
          const isCurrentlyPlaying = isCurrentActive && isPlaying;
          const isAdded = addedTrackIds.has(track.id);

          return (
            <div
              key={track.id}
              onClick={() => handlePlaySuggestedTrack(track)}
              className={`group flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-150 cursor-pointer min-w-0 ${
                isCurrentActive
                  ? 'bg-black/[0.06] dark:bg-white/[0.12]'
                  : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-black/10 dark:bg-white/10 flex items-center justify-center">
                  {track.artworkUrl ? (
                    <img
                      src={track.artworkUrl}
                      alt={track.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Music size={16} className="text-white/40" />
                  )}

                  <div
                    className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                      isCurrentActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {isCurrentlyPlaying ? (
                      <Pause size={14} className="text-white fill-white" />
                    ) : (
                      <Play size={14} className="text-white fill-white translate-x-0.5" />
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex-1 pr-2">
                  <span
                    className={`text-sm font-semibold truncate block ${
                      isCurrentActive
                        ? 'text-black dark:text-white font-bold'
                        : 'text-[#142347] dark:text-white'
                    }`}
                    title={track.title}
                  >
                    {track.title}
                  </span>
                  <span
                    className="text-xs text-[#64748B] dark:text-white/60 truncate block"
                    title={track.artist}
                  >
                    {track.artist}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 ml-3">
                <span className="text-xs text-[#94A3B8] dark:text-white/40 tabular-nums">
                  {track.duration || '0:00'}
                </span>

                <button
                  onClick={(e) => handleAddTrack(e, track)}
                  className={`p-1.5 rounded-full border transition-all ${
                    isAdded
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-black/5 hover:bg-black/10 text-slate-800 border-black/10 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white dark:border-white/10 active:scale-95'
                  }`}
                  title={
                    isAdded
                      ? t.suggested?.added || 'Added to playlist'
                      : t.suggested?.addToPlaylist || 'Add to playlist'
                  }
                  aria-label="Add track to playlist"
                >
                  {isAdded ? (
                    <Check size={14} strokeWidth={2.5} />
                  ) : (
                    <Plus size={14} strokeWidth={2.5} />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {suggestedTracks.length > 5 && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-white/80 border border-black/5 dark:border-white/10 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <span>
              {isExpanded
                ? t.suggested?.hide || 'Hide'
                : `${t.suggested?.showMore || 'Show more'} (+${suggestedTracks.length - 5})`}
            </span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      )}
    </section>
  );
};
