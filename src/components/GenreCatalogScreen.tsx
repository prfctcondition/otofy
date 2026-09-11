import React, { useState } from 'react';
import {
  Flame,
  Coffee,
  Zap,
  Mic,
  Waves,
  Guitar,
  Activity,
  Cpu,
  Disc,
  Sparkles,
  BookOpen,
  Skull,
  Gamepad2,
  Sunset,
  Feather,
  Sun,
  Play,
  ArrowLeft,
  Shuffle,
  Search,
  Music,
  BookmarkPlus,
  Check,
  Loader2,
} from 'lucide-react';
import type { Track } from '../types';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import { useToastStore } from '../store/toastStore';
import { PlaceholderArtwork } from './PlaceholderArtwork';

export interface GenreDef {
  id: string;
  name: string;
  category: string;
  tagline: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  gradient: string;
  cardGradient: string;
  accentColor: string;
  subgenres: string[];
  searchQueries: string[];
}

export const GENRE_CATALOG: GenreDef[] = [
  {
    id: 'phonk',
    name: 'Phonk & Drift',
    category: 'Bass & Drift',
    tagline: 'Aggressive 808 bass, cowbells & Memphis tapes',
    description: 'Atmospheric and heavy phonk: from classic underground Memphis tapes to high-octane drift beats and brazilian phonk.',
    icon: Flame,
    gradient: 'from-rose-600 via-red-600 to-amber-700',
    cardGradient: 'from-rose-700 to-red-950',
    accentColor: '#E11D48',
    subgenres: ['Drift Phonk', 'Memphis Rap', 'Brazilian Phonk', 'Wave Phonk'],
    searchQueries: ['drift phonk', 'brazilian phonk mix', 'kordhell phonk', 'phonk underground'],
  },
  {
    id: 'lofi',
    name: 'Lo-Fi Chill & Beats',
    category: 'Focus & Study',
    tagline: 'Mellow vinyl beats to study, code and unwind',
    description: 'Warm analog vinyl crackle, lush jazz chords, and downtempo rhythms curated for deep work, study, and late-night coding.',
    icon: Coffee,
    gradient: 'from-amber-500 via-orange-500 to-stone-700',
    cardGradient: 'from-amber-600 to-orange-950',
    accentColor: '#F59E0B',
    subgenres: ['Study Beats', 'Chillhop', 'Late Night Beats', 'Coffee Lo-Fi'],
    searchQueries: ['lofi hip hop chill beats', 'lofi study relaxing', 'chillhop cafe mix'],
  },
  {
    id: 'synthwave',
    name: 'Synthwave & Retrowave',
    category: 'Retro Electro',
    tagline: 'Neon 80s analog nostalgia & driving arpeggios',
    description: 'Neon sunsets, 80s arcade nostalgia, analog synthesizers, and driving outrun arpeggios.',
    icon: Zap,
    gradient: 'from-fuchsia-600 via-purple-600 to-indigo-800',
    cardGradient: 'from-fuchsia-700 to-purple-950',
    accentColor: '#C026D3',
    subgenres: ['Outrun', 'Darksynth', 'Dreamwave', 'Cyber Synth'],
    searchQueries: ['synthwave retrowave 80s', 'the midnight synthwave', 'kavinsky outrun nightcall'],
  },
  {
    id: 'hiphop',
    name: 'Underground Hip-Hop',
    category: 'Boom Bap & Rap',
    tagline: 'Boom bap drums, raw lyricism & street soul',
    description: 'Raw street lyricism, gritty vinyl chops, crisp boom bap drums, and soulful conscious rap.',
    icon: Mic,
    gradient: 'from-orange-600 via-amber-600 to-yellow-800',
    cardGradient: 'from-orange-700 to-amber-950',
    accentColor: '#EA580C',
    subgenres: ['Boom Bap', '90s East Coast', 'Jazz Rap', 'Conscious Hip-Hop'],
    searchQueries: ['underground hip hop classics', '90s boom bap hip hop', 'raw lyrical rap'],
  },
  {
    id: 'ambient',
    name: 'Ambient Flow & Space',
    category: 'Mind & Space',
    tagline: 'Endless horizons, generative soundscapes & deep focus',
    description: 'Infinite sonic horizons, ethereal space drones, binaural focus frequencies, and generative meditative soundscapes.',
    icon: Waves,
    gradient: 'from-teal-600 via-cyan-700 to-slate-900',
    cardGradient: 'from-teal-800 to-slate-950',
    accentColor: '#14B8A6',
    subgenres: ['Space Ambient', 'Drone Flow', 'Sleep Soundscapes', 'Binaural Focus'],
    searchQueries: ['ambient space focus music', 'drone ambient soundscapes', 'brian eno style ambient'],
  },
  {
    id: 'indierock',
    name: 'Indie Rock & Alt',
    category: 'Indie & Alt',
    tagline: 'Jangle guitars, sincere vibes & garage attitude',
    description: 'Authentic guitar chords, bedroom pop melodies, melancholic shoegaze textures, and raw indie spirit.',
    icon: Guitar,
    gradient: 'from-slate-700 via-zinc-800 to-stone-900',
    cardGradient: 'from-slate-800 to-zinc-950',
    accentColor: '#64748B',
    subgenres: ['Indie Pop', 'Shoegaze', 'Midwest Emo', 'Post-Punk'],
    searchQueries: ['indie rock essentials', 'shoegaze dream pop', 'modern alternative indie rock'],
  },
  {
    id: 'edm',
    name: 'Electronic & EDM',
    category: 'Electronic & Dance',
    tagline: 'Massive festival drops, euphoria & peak energy',
    description: 'Massive festival drops, melodic progressive house, euphoric builds, and peak-energy dance anthems.',
    icon: Activity,
    gradient: 'from-cyan-500 via-blue-600 to-indigo-800',
    cardGradient: 'from-cyan-700 to-blue-950',
    accentColor: '#06B6D4',
    subgenres: ['Future Bass', 'Progressive House', 'Drum & Bass', 'Tech House'],
    searchQueries: ['edm festival hits', 'future bass melodic', 'electronic dance hits mix'],
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk & Midtempo',
    category: 'Dark Electro',
    tagline: 'High tech, low life, glitch beats & industrial bass',
    description: 'Dystopian futurism: distorted industrial bass, glitch electronics, and dark midtempo beats for neon megacities.',
    icon: Cpu,
    gradient: 'from-violet-600 via-indigo-700 to-zinc-900',
    cardGradient: 'from-violet-800 to-zinc-950',
    accentColor: '#8B5CF6',
    subgenres: ['Industrial Electro', 'Dark Midtempo', 'EBM', 'Glitch Tech'],
    searchQueries: ['cyberpunk 2077 electronic music', 'dark midtempo electro', 'industrial bass darksynth'],
  },
  {
    id: 'jazz',
    name: 'Jazz & Soul Classics',
    category: 'Jazz & Soul',
    tagline: 'Warm Rhodes, brass improvisation & velvet vocals',
    description: 'Timeless cool jazz, warm Rhodes keys, velvet saxophone solos, and modern neo-soul grooves.',
    icon: Disc,
    gradient: 'from-yellow-600 via-amber-600 to-stone-800',
    cardGradient: 'from-yellow-700 to-stone-950',
    accentColor: '#CA8A04',
    subgenres: ['Cool Jazz', 'Neo-Soul', 'Bossa Nova', 'Midnight Jazz'],
    searchQueries: ['smooth jazz cafe', 'cool jazz timeless classics', 'neo soul r&b vibes'],
  },
  {
    id: 'pop',
    name: 'Pop Hits & Charts',
    category: 'Global Hits',
    tagline: 'Catchy melodies, global anthems & trending sound',
    description: 'The biggest global chart-toppers, infectious hooks, sparkling vocal production, and trending viral hits.',
    icon: Sparkles,
    gradient: 'from-pink-500 via-rose-500 to-purple-700',
    cardGradient: 'from-pink-600 to-rose-950',
    accentColor: '#EC4899',
    subgenres: ['Global Top', 'Electropop', 'Dance Pop', 'Viral Hits'],
    searchQueries: ['top global pop hits 2025', 'viral pop songs', 'today top billboard hits'],
  },
  {
    id: 'classical',
    name: 'Cinematic & Classical',
    category: 'Cinematic & Piano',
    tagline: 'Epic orchestral heights & intimate solo piano',
    description: 'Majestic orchestral scores, emotive solo piano, Hans Zimmer cinematic power, and modern symphonic masterworks.',
    icon: BookOpen,
    gradient: 'from-indigo-600 via-slate-700 to-blue-900',
    cardGradient: 'from-indigo-700 to-slate-950',
    accentColor: '#4F46E5',
    subgenres: ['Modern Classical', 'Film Score', 'Solo Piano', 'Epic Orchestral'],
    searchQueries: ['cinematic epic orchestral music', 'modern classical piano solo', 'hans zimmer soundtrack epic'],
  },
  {
    id: 'metal',
    name: 'Metal & Hard Rock',
    category: 'Metal & Rock',
    tagline: 'Distorted guitars, relentless power & crushing drums',
    description: 'Heavy distortion, blistering riffs, crushing breakdowns, double-kick drums, and pure adrenaline.',
    icon: Skull,
    gradient: 'from-stone-700 via-zinc-800 to-black',
    cardGradient: 'from-stone-800 to-black',
    accentColor: '#78716C',
    subgenres: ['Heavy Metal', 'Metalcore', 'Alternative Metal', 'Thrash'],
    searchQueries: ['heavy metal classics', 'modern metalcore bangers', 'hard rock guitar anthems'],
  },
  {
    id: 'gaming',
    name: 'Gaming & Chiptune',
    category: 'Gaming & OST',
    tagline: 'Boss battles, 8-bit nostalgia & high-octane hype',
    description: 'High-octane game soundtracks, retro 8-bit chiptunes, epic boss battle anthems, and speedrun beats.',
    icon: Gamepad2,
    gradient: 'from-purple-600 via-fuchsia-600 to-blue-900',
    cardGradient: 'from-purple-700 to-indigo-950',
    accentColor: '#A855F7',
    subgenres: ['Video Game OST', 'Chiptune 8-Bit', 'Speedrun Beats', 'Epic Boss Fight'],
    searchQueries: ['gaming music playlist high energy', 'epic gaming mix best', 'chiptune 8bit retro game music'],
  },
  {
    id: 'deephouse',
    name: 'Deep House & Sunset',
    category: 'House & Lounge',
    tagline: 'Warm bass grooves & hypnotic 4/4 beats',
    description: 'Warm hypnotic basslines, rolling four-on-the-floor rhythms, and sophisticated sunset lounge aesthetics.',
    icon: Sunset,
    gradient: 'from-blue-600 via-indigo-600 to-violet-900',
    cardGradient: 'from-blue-700 to-indigo-950',
    accentColor: '#3B82F6',
    subgenres: ['Vocal Deep House', 'Sunset Lounge', 'Melodic Techno', 'Organic House'],
    searchQueries: ['deep house vocal lounge', 'sunset deep house mix', 'ibiza club lounge chill'],
  },
  {
    id: 'acoustic',
    name: 'Acoustic & Folk',
    category: 'Acoustic & Folk',
    tagline: 'Intimate guitars, warm wooden tones & storytelling',
    description: 'Intimate fingerstyle acoustic guitar, heartfelt indie folk storytelling, and warm campfire harmonies.',
    icon: Feather,
    gradient: 'from-amber-600 via-yellow-700 to-stone-800',
    cardGradient: 'from-amber-700 to-stone-950',
    accentColor: '#D97706',
    subgenres: ['Indie Folk', 'Acoustic Guitar', 'Singer-Songwriter', 'Campfire Acoustic'],
    searchQueries: ['acoustic folk songs relaxing', 'acoustic guitar morning coffee', 'indie folk session'],
  },
  {
    id: 'latin',
    name: 'Latin & Reggaeton',
    category: 'Latin & Urbano',
    tagline: 'Dembow bounce, tropical fire & irresistible dance rhythm',
    description: 'Irresistible dembow bounce, tropical heat, urbano anthems, and sensual Latin dance rhythms.',
    icon: Sun,
    gradient: 'from-red-500 via-orange-500 to-yellow-600',
    cardGradient: 'from-red-600 to-yellow-950',
    accentColor: '#EF4444',
    subgenres: ['Reggaeton Urbano', 'Latin Pop', 'Bachata Modern', 'Tropical Fiesta'],
    searchQueries: ['reggaeton hits latino urbano', 'latin pop dance party', 'latin summer fiesta'],
  },
];

interface GenreCatalogScreenProps {
  onBack: () => void;
  onSelectGenre?: (genre: GenreDef) => void;
}

// In-memory cache for genre tracks so switching between genres is instantaneous
const genreTracksCache = new Map<string, Track[]>();

export const GenreCatalogScreen: React.FC<GenreCatalogScreenProps> = ({ onBack }) => {
  const [selectedGenre, setSelectedGenre] = useState<GenreDef | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [genreTracks, setGenreTracks] = useState<Track[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const playerStore = usePlayerStore();
  const libraryStore = useLibraryStore();
  const toastStore = useToastStore();

  const filteredGenres = GENRE_CATALOG.filter((genre) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase().trim();
    return (
      genre.name.toLowerCase().includes(q) ||
      genre.category.toLowerCase().includes(q) ||
      genre.description.toLowerCase().includes(q) ||
      genre.subgenres.some((s) => s.toLowerCase().includes(q))
    );
  });

  const loadTracksForGenre = async (genre: GenreDef) => {
    // Check in-memory cache first for 0ms load
    if (genreTracksCache.has(genre.id)) {
      setGenreTracks(genreTracksCache.get(genre.id)!);
      setIsLoadingTracks(false);
      setIsSaved(false);
      return;
    }

    setIsLoadingTracks(true);
    setGenreTracks([]);
    setIsSaved(false);

    try {
      const primaryQuery = genre.searchQueries[0];
      let results: any[] = [];

      if (window.electronAPI?.searchMusic) {
        const res = await window.electronAPI.searchMusic(primaryQuery);
        results = Array.isArray(res) ? res : res?.results || [];
      } else {
        const resp = await fetch(`/api/music/search?q=${encodeURIComponent(primaryQuery)}`);
        if (resp.ok) results = await resp.json();
      }

      const mapped: Track[] = (results || []).slice(0, 30).map((r, idx) => ({
        id: `genre-${genre.id}-${idx}-${r.id || r.sourceId || idx}`,
        number: idx + 1,
        title: r.title || `Track ${idx + 1}`,
        artist: r.artist || genre.name,
        album: r.album || `${genre.name} Station`,
        duration: r.duration || '3:30',
        durationSec: r.durationSec || 210,
        dateAdded: 'Otofy Curated',
        source: r.source || 'YT',
        sourceLabel: r.sourceLabel || 'YouTube Music',
        sourceId: r.sourceId || r.id,
        artworkUrl: r.artworkUrl,
        iconName: 'music' as const,
        gradientFrom: genre.accentColor,
        gradientTo: '#000000',
        isLiked: false,
      }));

      genreTracksCache.set(genre.id, mapped);
      setGenreTracks(mapped);
    } catch (err) {
      console.warn('[GenreCatalog] Error fetching tracks:', err);
    } finally {
      setIsLoadingTracks(false);
    }
  };

  const handleOpenGenre = (genre: GenreDef) => {
    setSelectedGenre(genre);
    loadTracksForGenre(genre);
  };

  const handlePlayAll = () => {
    if (genreTracks.length === 0) return;
    playerStore.playTrack(genreTracks[0], genreTracks);
    toastStore.info(`Playing ${selectedGenre?.name || 'Genre'}`, `Queued ${genreTracks.length} curated tracks.`);
  };

  const handleShufflePlay = () => {
    if (genreTracks.length === 0) return;
    const shuffled = [...genreTracks].sort(() => Math.random() - 0.5);
    playerStore.playTrack(shuffled[0], shuffled);
    toastStore.info(`Shuffling ${selectedGenre?.name || 'Genre'}`, `Playing in random order.`);
  };

  const handlePlayTrack = (track: Track) => {
    playerStore.playTrack(track, genreTracks);
  };

  const handleQuickPlayGenre = async (genre: GenreDef, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (genreTracksCache.has(genre.id)) {
        const cached = genreTracksCache.get(genre.id)!;
        if (cached.length > 0) {
          playerStore.playTrack(cached[0], cached);
          toastStore.success(`Playing ${genre.name}`, `Loaded ${cached.length} tracks.`);
          return;
        }
      }

      const primaryQuery = genre.searchQueries[0];
      let results: any[] = [];
      if (window.electronAPI?.searchMusic) {
        const res = await window.electronAPI.searchMusic(primaryQuery);
        results = Array.isArray(res) ? res : res?.results || [];
      } else {
        const resp = await fetch(`/api/music/search?q=${encodeURIComponent(primaryQuery)}`);
        if (resp.ok) results = await resp.json();
      }

      if (results && results.length > 0) {
        const mapped: Track[] = results.slice(0, 30).map((r, idx) => ({
          id: `genre-${genre.id}-${idx}-${r.id || r.sourceId || idx}`,
          number: idx + 1,
          title: r.title,
          artist: r.artist || genre.name,
          album: r.album || `${genre.name} Station`,
          duration: r.duration || '3:30',
          durationSec: r.durationSec || 210,
          dateAdded: 'Otofy Curated',
          source: r.source || 'YT',
          sourceLabel: r.sourceLabel || 'YouTube Music',
          sourceId: r.sourceId || r.id,
          artworkUrl: r.artworkUrl,
          iconName: 'music' as const,
          gradientFrom: genre.accentColor,
          gradientTo: '#000000',
          isLiked: false,
        }));
        genreTracksCache.set(genre.id, mapped);
        playerStore.playTrack(mapped[0], mapped);
        toastStore.success(`Playing ${genre.name}`, `Loaded ${mapped.length} tracks.`);
      }
    } catch (err) {
      console.warn('[GenreCatalog] quick play failed:', err);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!selectedGenre || genreTracks.length === 0) return;
    try {
      await libraryStore.createPlaylistFromTracks(`${selectedGenre.name} Station`, genreTracks);
      setIsSaved(true);
      toastStore.success('Saved to Library', `"${selectedGenre.name} Station" has been saved.`);
    } catch (err) {
      console.warn('[GenreCatalog] save playlist error:', err);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto flex flex-col p-5 sm:p-7 relative z-10">
      {/* View 1: Main 16-card Grid */}
      {!selectedGenre ? (
        <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-16">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <button
                  onClick={onBack}
                  className="p-2 rounded-xl bg-white/60 dark:bg-white/[0.08] hover:bg-white/90 dark:hover:bg-white/[0.14] border border-white/80 dark:border-white/10 text-[#0F172A] dark:text-white transition-all shadow-xs flex items-center justify-center"
                  title="Back to Home"
                >
                  <ArrowLeft size={18} />
                </button>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0F172A] dark:text-white">
                  Genre & Mood Catalog
                </h1>
              </div>
              <p className="text-xs sm:text-sm font-medium text-[#64748B] dark:text-white/80">
                16 curated musical realms with dynamic radio stations and auto-mixes
              </p>
            </div>

            {/* Quick Search */}
            <div className="relative w-full sm:w-72">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-white/40 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Filter genres..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl bg-white/70 dark:bg-white/[0.06] border border-white/80 dark:border-white/10 text-[#0F172A] dark:text-white placeholder-[#94A3B8] dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 transition-all shadow-xs"
              />
            </div>
          </div>

          {/* 16-Card Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {filteredGenres.map((genre) => {
              const IconComp = genre.icon;
              return (
                <div
                  key={genre.id}
                  onClick={() => handleOpenGenre(genre)}
                  className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white/50 dark:bg-white/[0.04] hover:bg-white/80 dark:hover:bg-white/[0.09] backdrop-blur-xl border border-white/80 dark:border-white/[0.08] hover:border-white dark:hover:border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_1.5px_rgba(255,255,255,0.8)] dark:shadow-none hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)] cursor-pointer transition-all duration-200 overflow-hidden min-h-[170px]"
                >
                  {/* Decorative Gradient Background Glow */}
                  <div
                    className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${genre.cardGradient} opacity-20 group-hover:opacity-40 blur-xl transition-all duration-300 pointer-events-none`}
                  />

                  {/* Top Bar: Icon & Pill */}
                  <div className="flex items-start justify-between z-10">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${genre.gradient} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}
                    >
                      <IconComp size={20} />
                    </div>

                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 text-[#475569] dark:text-white/80">
                      {genre.category}
                    </span>
                  </div>

                  {/* Title and Tagline */}
                  <div className="z-10 mt-3">
                    <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {genre.name}
                    </h3>
                    <p className="text-xs text-[#64748B] dark:text-white/70 line-clamp-2 mt-1 leading-snug">
                      {genre.description}
                    </p>
                  </div>

                  {/* Subgenres tags */}
                  <div className="z-10 flex flex-wrap gap-1 mt-2.5">
                    {genre.subgenres.slice(0, 2).map((sg) => (
                      <span
                        key={sg}
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[#64748B] dark:text-white/70"
                      >
                        {sg}
                      </span>
                    ))}
                  </div>

                  {/* Quick Play Floating Button on Hover - MATCHED with bottom player */}
                  <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 z-20">
                    <button
                      onClick={(e) => handleQuickPlayGenre(genre, e)}
                      className="w-10 h-10 rounded-full bg-[#0F172A] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90 flex items-center justify-center shadow-[0_4px_14px_rgba(15,23,42,0.3)] dark:shadow-[0_4px_16px_rgba(255,255,255,0.25)] hover:scale-105 active:scale-95 transition-transform"
                      title={`Play ${genre.name}`}
                    >
                      <Play size={16} className="fill-white dark:fill-black translate-x-0.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* View 2: Detailed Genre View with dynamically generated tracks */
        <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-16">
          {/* Back button */}
          <div>
            <button
              onClick={() => setSelectedGenre(null)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/60 dark:bg-white/[0.08] hover:bg-white/90 dark:hover:bg-white/[0.14] border border-white/80 dark:border-white/10 text-xs font-bold text-[#0F172A] dark:text-white transition-all shadow-xs"
            >
              <ArrowLeft size={14} />
              Back to all genres
            </button>
          </div>

          {/* Hero Genre Banner */}
          <div
            className={`relative rounded-3xl overflow-hidden p-6 sm:p-8 bg-gradient-to-br ${selectedGenre.gradient} text-white shadow-xl flex flex-col justify-between`}
          >
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md">
                    {React.createElement(selectedGenre.icon, { size: 24, className: 'text-white' })}
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-white/80 bg-black/25 px-2.5 py-1 rounded-full backdrop-blur-xs">
                    {selectedGenre.category}
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight drop-shadow-md">
                  {selectedGenre.name}
                </h1>
                <p className="mt-2 text-sm sm:text-base text-white/90 leading-relaxed max-w-xl">
                  {selectedGenre.description}
                </p>

                {/* Subgenres pills */}
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {selectedGenre.subgenres.map((sg) => (
                    <span
                      key={sg}
                      className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30"
                    >
                      {sg}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons - MATCHED with bottom player */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={handlePlayAll}
                  disabled={isLoadingTracks || genreTracks.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0F172A] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90 font-extrabold hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50 text-sm"
                >
                  <Play size={17} className="fill-white dark:fill-black" />
                  Play All
                </button>

                <button
                  onClick={handleShufflePlay}
                  disabled={isLoadingTracks || genreTracks.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/20 hover:bg-white/30 border border-white/30 text-white font-bold backdrop-blur-md transition-all active:scale-95 disabled:opacity-50 text-sm"
                  title="Shuffle and play"
                >
                  <Shuffle size={16} />
                  Shuffle
                </button>

                <button
                  onClick={handleSaveToLibrary}
                  disabled={isLoadingTracks || genreTracks.length === 0 || isSaved}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/20 hover:bg-white/30 border border-white/30 text-white font-bold backdrop-blur-md transition-all active:scale-95 disabled:opacity-75 text-sm"
                  title="Save collection to your library"
                >
                  {isSaved ? (
                    <>
                      <Check size={16} className="text-white" />
                      Saved
                    </>
                  ) : (
                    <>
                      <BookmarkPlus size={16} />
                      Save to Library
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Tracks List */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
                Genre Tracks ({genreTracks.length})
              </h2>
              {isLoadingTracks && (
                <div className="flex items-center gap-2 text-xs text-[#64748B] dark:text-white/80">
                  <Loader2 size={14} className="animate-spin text-indigo-400" />
                  Curating the best tracks...
                </div>
              )}
            </div>

            {isLoadingTracks ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#64748B] dark:text-white/80">
                <Loader2 size={32} className="animate-spin text-indigo-500" />
                <p className="text-sm font-medium">Curating the best tracks for this genre...</p>
              </div>
            ) : genreTracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#64748B] dark:text-white/80">
                <Music size={36} className="mb-2 opacity-50" />
                <p className="text-sm">No tracks found for this genre</p>
              </div>
            ) : (
              <div className="flex flex-col rounded-2xl bg-white/50 dark:bg-white/[0.04] border border-white/80 dark:border-white/[0.08] backdrop-blur-xl overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                {genreTracks.map((track, idx) => {
                  const isCurrent = playerStore.activeTrack?.id === track.id;
                  return (
                    <div
                      key={track.id}
                      onClick={() => handlePlayTrack(track)}
                      className={`group flex items-center justify-between p-3 sm:px-4 cursor-pointer transition-colors ${
                        isCurrent
                          ? 'bg-indigo-500/10 dark:bg-indigo-500/20'
                          : 'hover:bg-white/60 dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 text-center text-xs font-mono font-bold text-[#94A3B8] dark:text-white/70 group-hover:hidden">
                          {idx + 1}
                        </span>
                        <button
                          className="w-6 h-6 hidden group-hover:flex items-center justify-center text-indigo-600 dark:text-indigo-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayTrack(track);
                          }}
                        >
                          <Play size={14} className="fill-current" />
                        </button>

                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 shadow-xs">
                          <PlaceholderArtwork
                            icon={track.iconName}
                            imageUrl={track.artworkUrl}
                            source={track.source}
                            sourceId={track.sourceId}
                            size={40}
                          />
                        </div>

                        <div className="min-w-0">
                          <p
                            className={`text-xs sm:text-sm font-bold truncate leading-tight ${
                              isCurrent
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : 'text-[#0F172A] dark:text-white'
                            }`}
                          >
                            {track.title}
                          </p>
                          <p className="text-[11px] sm:text-xs text-[#64748B] dark:text-white/80 truncate leading-tight mt-0.5">
                            {track.artist}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono text-[#64748B] dark:text-white/80 shrink-0">
                        <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] bg-black/5 dark:bg-white/5 font-sans">
                          {track.sourceLabel || 'YT'}
                        </span>
                        <span>{track.duration}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
