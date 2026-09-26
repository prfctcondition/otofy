import React, { useState, useMemo, useEffect } from 'react';
import {
  Check,
  Search,
  Waves,
  ArrowRight,
  X,
  User,
  Loader2,
} from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useTranslation } from '../i18n';
import { apiSearchArtists, SearchArtistItem } from '../services/musicApiService';
import { invalidateWaveCache } from '../services/waveService';

interface OnboardingArtist {
  name: string;
  genre: string;
  genres: string[];
  avatarUrl?: string;
  gradient: string;
}

const GRADIENT_PALETTE = [
  'from-red-600 to-rose-950',
  'from-amber-600 to-red-950',
  'from-purple-700 to-indigo-950',
  'from-orange-600 to-neutral-900',
  'from-cyan-600 to-blue-950',
  'from-blue-600 to-indigo-950',
  'from-emerald-700 to-teal-950',
  'from-fuchsia-700 to-purple-950',
  'from-pink-600 to-rose-950',
  'from-violet-800 to-neutral-950',
];

function getArtistGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i = i + 1) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash = hash | 0;
  }
  const idx = Math.abs(hash) % GRADIENT_PALETTE.length;
  return GRADIENT_PALETTE[idx];
}

const CURATED_ARTISTS: OnboardingArtist[] = [
  // Phonk
  { name: 'Kordhell', genre: 'Phonk', genres: ['phonk', 'electronic'], gradient: 'from-red-600 to-rose-950' },
  { name: 'DVRST', genre: 'Phonk', genres: ['phonk', 'electronic'], gradient: 'from-amber-600 to-red-950' },
  { name: 'Ghostface Playa', genre: 'Phonk', genres: ['phonk'], gradient: 'from-purple-700 to-indigo-950' },
  { name: 'Shadxwbxrn', genre: 'Phonk', genres: ['phonk'], gradient: 'from-orange-600 to-neutral-900' },
  { name: 'INTERWORLD', genre: 'Phonk', genres: ['phonk', 'electronic'], gradient: 'from-cyan-600 to-blue-950' },

  // Hip-Hop
  { name: 'The Weeknd', genre: 'R&B / Pop', genres: ['pop', 'hiphop'], gradient: 'from-red-700 to-rose-950' },
  { name: 'Travis Scott', genre: 'Hip-Hop', genres: ['hiphop'], gradient: 'from-amber-700 to-yellow-950' },
  { name: 'Drake', genre: 'Hip-Hop', genres: ['hiphop', 'pop'], gradient: 'from-blue-600 to-indigo-950' },
  { name: 'Kendrick Lamar', genre: 'Hip-Hop', genres: ['hiphop'], gradient: 'from-emerald-700 to-teal-950' },
  { name: 'Kanye West', genre: 'Hip-Hop', genres: ['hiphop'], gradient: 'from-neutral-700 to-stone-950' },
  { name: 'Eminem', genre: 'Hip-Hop', genres: ['hiphop', 'rock'], gradient: 'from-slate-700 to-zinc-950' },
  { name: 'Post Malone', genre: 'Hip-Hop / Pop', genres: ['hiphop', 'pop', 'rock'], gradient: 'from-yellow-600 to-amber-950' },
  { name: 'Juice WRLD', genre: 'Hip-Hop', genres: ['hiphop'], gradient: 'from-fuchsia-700 to-purple-950' },
  { name: 'Lil Peep', genre: 'Emo Rap', genres: ['hiphop', 'rock', 'indie'], gradient: 'from-pink-600 to-rose-950' },
  { name: 'Miyagi & Эндшпиль', genre: 'Hip-Hop', genres: ['hiphop'], gradient: 'from-amber-700 to-stone-900' },
  { name: 'Oxxxymiron', genre: 'Hip-Hop', genres: ['hiphop'], gradient: 'from-sky-700 to-slate-900' },
  { name: 'PHARAOH', genre: 'Hip-Hop', genres: ['hiphop'], gradient: 'from-violet-800 to-neutral-950' },
  { name: 'SALUKI', genre: 'Hip-Hop', genres: ['hiphop', 'electronic'], gradient: 'from-zinc-700 to-neutral-950' },

  // Rock / Metal
  { name: 'Linkin Park', genre: 'Rock', genres: ['rock', 'metal'], gradient: 'from-blue-700 to-slate-950' },
  { name: 'Nirvana', genre: 'Grunge / Rock', genres: ['rock'], gradient: 'from-yellow-600 to-stone-900' },
  { name: 'Rammstein', genre: 'Industrial Metal', genres: ['rock', 'metal'], gradient: 'from-red-800 to-neutral-950' },
  { name: 'Deftones', genre: 'Alt Rock', genres: ['rock', 'metal'], gradient: 'from-teal-800 to-slate-950' },
  { name: 'Arctic Monkeys', genre: 'Indie Rock', genres: ['rock', 'indie'], gradient: 'from-amber-700 to-neutral-900' },
  { name: 'The Neighbourhood', genre: 'Alt Rock', genres: ['rock', 'indie', 'pop'], gradient: 'from-neutral-600 to-black' },
  { name: 'Король и Шут', genre: 'Punk Rock', genres: ['rock'], gradient: 'from-red-700 to-black' },
  { name: 'Кино', genre: 'Post-Punk', genres: ['rock', 'indie'], gradient: 'from-slate-700 to-black' },
  { name: 'Три дня дождя', genre: 'Rock', genres: ['rock'], gradient: 'from-blue-800 to-slate-950' },
  { name: 'Bring Me The Horizon', genre: 'Metalcore', genres: ['rock', 'metal'], gradient: 'from-rose-800 to-zinc-950' },

  // Electronic / Synthwave
  { name: 'Daft Punk', genre: 'Electronic', genres: ['electronic'], gradient: 'from-yellow-500 to-amber-900' },
  { name: 'The Prodigy', genre: 'Electronic / Breakbeat', genres: ['electronic', 'rock'], gradient: 'from-lime-600 to-emerald-950' },
  { name: 'Fred again..', genre: 'Electronic', genres: ['electronic'], gradient: 'from-sky-600 to-blue-950' },
  { name: 'Skrillex', genre: 'Electronic', genres: ['electronic', 'hiphop'], gradient: 'from-violet-600 to-purple-950' },
  { name: 'Gesaffelstein', genre: 'Dark Techno', genres: ['electronic'], gradient: 'from-neutral-700 to-black' },

  // Pop / Indie
  { name: 'Billie Eilish', genre: 'Alt Pop', genres: ['pop', 'indie'], gradient: 'from-emerald-600 to-zinc-950' },
  { name: 'Lana Del Rey', genre: 'Dream Pop', genres: ['pop', 'indie'], gradient: 'from-rose-600 to-stone-900' },
  { name: 'Joji', genre: 'Lo-Fi / R&B', genres: ['pop', 'indie', 'lofi'], gradient: 'from-purple-800 to-slate-950' },
  { name: 'Gorillaz', genre: 'Alt / Trip-Hop', genres: ['indie', 'rock', 'electronic'], gradient: 'from-teal-600 to-neutral-950' },
  { name: 'Cigarettes After Sex', genre: 'Dream Pop', genres: ['indie'], gradient: 'from-neutral-700 to-black' },
  { name: 'Tame Impala', genre: 'Psychedelic Pop', genres: ['indie', 'electronic'], gradient: 'from-pink-600 to-indigo-950' },
  { name: 'Radiohead', genre: 'Alt Rock', genres: ['rock', 'indie'], gradient: 'from-slate-600 to-zinc-900' },
];

const GENRE_FILTERS = [
  { id: 'all', labelRu: 'Все', labelEn: 'All' },
  { id: 'hiphop', labelRu: 'Хип-хоп', labelEn: 'Hip-Hop' },
  { id: 'phonk', labelRu: 'Фонк', labelEn: 'Phonk' },
  { id: 'rock', labelRu: 'Рок', labelEn: 'Rock' },
  { id: 'electronic', labelRu: 'Электроника', labelEn: 'Electronic' },
  { id: 'pop', labelRu: 'Поп', labelEn: 'Pop' },
  { id: 'indie', labelRu: 'Инди', labelEn: 'Indie' },
  { id: 'metal', labelRu: 'Метал', labelEn: 'Metal' },
];

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleteWave?: (selectedArtists: string[]) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onCompleteWave,
}) => {
  const { t, language } = useTranslation();
  const settingsStore = useSettingsStore();
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<SearchArtistItem[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<string[]>(
    settingsStore.favoriteArtists || []
  );

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await apiSearchArtists(trimmed);
        setSearchResults(results);
      } catch (err) {
        console.error('Failed to search artists:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleArtist = (name: string) => {
    setSelectedArtists((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  };

  const filteredCurated = useMemo(() => {
    let list = CURATED_ARTISTS;
    if (selectedGenre !== 'all') {
      list = list.filter((a) => a.genres.includes(selectedGenre));
    }
    return list;
  }, [selectedGenre]);

  const canSubmit = selectedArtists.length >= 3;

  const handleFinish = () => {
    if (!canSubmit) return;
    invalidateWaveCache();
    settingsStore.setFavoriteArtists(selectedArtists);
    settingsStore.setOnboardingCompleted(true);
    if (onCompleteWave) {
      onCompleteWave(selectedArtists);
    }
    onClose();
  };

  if (!isOpen) return null;

  const isSearchActive = searchQuery.trim().length > 0;
  const countText = (t.onboarding?.selectedCount || 'Selected: {count} of 3 minimum').replace(
    '{count}',
    String(selectedArtists.length)
  );

  return (
    <div
      id="onboarding-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl animate-fade-in select-none"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-[#0B0B10]/95 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden text-white">
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

        <div className="relative z-10 px-8 pt-8 pb-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                <Waves size={18} />
              </div>
              <span className="text-xs font-bold tracking-widest uppercase text-white/50">
                {t.onboarding?.headerBadge || 'Otofy Personalization'}
              </span>
            </div>
            {settingsStore.onboardingCompleted && (
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                title={t.nav.close}
              >
                <X size={20} />
              </button>
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {t.onboarding?.title || 'Choose 3 or more favorite artists'}
          </h2>
          <p className="text-sm text-white/60 max-w-2xl leading-relaxed">
            {t.onboarding?.subtitle ||
              'This immediately activates and calibrates your personal "My Wave" endless station on the Home screen.'}
          </p>

          {selectedArtists.length > 0 && (
            <div className="mt-1 flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
              {selectedArtists.map((artistName) => (
                <span
                  key={artistName}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 hover:bg-white/20 text-xs font-medium text-white border border-white/15 transition-colors shrink-0"
                >
                  <span className="truncate max-w-[160px]">{artistName}</span>
                  <button
                    type="button"
                    onClick={() => toggleArtist(artistName)}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40"
              />
              <input
                type="text"
                placeholder={
                  t.onboarding?.searchPlaceholder ||
                  'Search any artist or band worldwide...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-10 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 focus:bg-white/[0.09] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {!isSearchActive && (
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                {GENRE_FILTERS.map((g) => {
                  const label =
                    g.id === 'all'
                      ? t.onboarding?.allGenres || (language === 'ru' ? g.labelRu : g.labelEn)
                      : language === 'ru'
                      ? g.labelRu
                      : g.labelEn;
                  return (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGenre(g.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
                        selectedGenre === g.id
                          ? 'bg-white text-black shadow-[0_2px_10px_rgba(255,255,255,0.3)]'
                          : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white border border-white/5'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto px-8 py-4 scrollbar-thin scrollbar-thumb-white/10 min-h-[300px]">
          {isSearchActive ? (
            isSearching ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-white/60">
                <Loader2 size={28} className="animate-spin text-white/70" />
                <span className="text-sm font-medium">
                  {t.onboarding?.searching || 'Searching artists...'}
                </span>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {searchResults.map((artist) => {
                  const isSelected = selectedArtists.includes(artist.name);
                  const gradient = getArtistGradient(artist.name);
                  const avatar = artist.avatarUrl || artist.thumbnailUrl;
                  return (
                    <div
                      key={artist.id || artist.name}
                      onClick={() => toggleArtist(artist.name)}
                      className={`group relative p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center gap-3 select-none ${
                        isSelected
                          ? 'bg-white/[0.16] border-white/40 shadow-[0_4px_20px_rgba(255,255,255,0.1)] scale-[1.02]'
                          : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/5 hover:border-white/15'
                      }`}
                    >
                      <div
                        className={`w-11 h-11 rounded-full shrink-0 flex items-center justify-center font-bold text-sm bg-gradient-to-br ${gradient} shadow-md relative overflow-hidden`}
                      >
                        {avatar ? (
                          <img
                            src={avatar}
                            alt={artist.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User size={18} className="text-white/80" />
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                            <Check size={18} className="text-white stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <span
                          className={`text-sm font-semibold truncate block transition-colors ${
                            isSelected ? 'text-white' : 'text-white/90 group-hover:text-white'
                          }`}
                        >
                          {artist.name}
                        </span>
                        <span className="text-[11px] text-white/50 truncate block">
                          {artist.subscribers || artist.genre || 'Artist'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-20 text-center text-white/50 text-sm">
                {t.onboarding?.noArtistsFound ||
                  'No artists found. Try another search query.'}
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredCurated.map((artist) => {
                const isSelected = selectedArtists.includes(artist.name);
                return (
                  <div
                    key={artist.name}
                    onClick={() => toggleArtist(artist.name)}
                    className={`group relative p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center gap-3 select-none ${
                      isSelected
                        ? 'bg-white/[0.16] border-white/40 shadow-[0_4px_20px_rgba(255,255,255,0.1)] scale-[1.02]'
                        : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-full shrink-0 flex items-center justify-center font-bold text-sm bg-gradient-to-br ${artist.gradient} shadow-md relative`}
                    >
                      <User size={18} className="text-white/80" />
                      {isSelected && (
                        <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                          <Check size={18} className="text-white stroke-[3]" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <span
                        className={`text-sm font-semibold truncate block transition-colors ${
                          isSelected ? 'text-white' : 'text-white/90 group-hover:text-white'
                        }`}
                      >
                        {artist.name}
                      </span>
                      <span className="text-[11px] text-white/50 truncate block">
                        {artist.genre}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="relative z-10 px-8 py-5 bg-[#08080C] border-t border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/70">
              {countText}
            </span>
            {canSubmit && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1">
                <Check size={12} strokeWidth={3} /> {t.onboarding?.readyToLaunch || 'Ready to launch'}
              </span>
            )}
          </div>

          <button
            onClick={handleFinish}
            disabled={!canSubmit}
            className={`px-6 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${
              canSubmit
                ? 'bg-white text-black hover:bg-white/90 shadow-[0_4px_20px_rgba(255,255,255,0.35)] cursor-pointer hover:scale-105 active:scale-95'
                : 'bg-white/10 text-white/30 cursor-not-allowed border border-white/5'
            }`}
          >
            <span>{t.onboarding?.startListening || 'Start Listening'}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
