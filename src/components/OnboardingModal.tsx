import React, { useState, useMemo, useEffect } from 'react';
import {
  Check,
  Search,
  Waves,
  ArrowRight,
  ArrowLeft,
  X,
  User,
  Loader2,
  Sun,
  Moon,
  Globe,
  Compass,
  Sparkles,
  Music,
} from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useThemeStore } from '../store/themeStore';
import { useToastStore } from '../store/toastStore';
import { useTranslation } from '../i18n';
import { apiSearchArtists, SearchArtistItem } from '../services/musicApiService';
import { invalidateWaveCache, generateWaveTracks } from '../services/waveService';

interface OnboardingArtist {
  name: string;
  genre: string;
  genres: string[];
  avatarUrl?: string;
  gradient: string;
}

type OnboardingStep = 'welcome' | 'guide' | 'artists';

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
  { name: 'Kordhell', genre: 'Phonk', genres: ['phonk', 'electronic'], gradient: 'from-red-600 to-rose-950', avatarUrl: 'https://yt3.googleusercontent.com/7-4MjHxfx_2QHaTmct11HA42FscZIo_HldDrj3tUFeSjKHzT0hP-G6KUv_t7YDavim_mEPQ4uQ=s200-c' },
  { name: 'DVRST', genre: 'Phonk', genres: ['phonk', 'electronic'], gradient: 'from-amber-600 to-red-950', avatarUrl: 'https://yt3.googleusercontent.com/6rrXBMoUBEKwVPKNR4jbo_dafu0L0TQkhbBteyk2IZdLIzzdEz6lxklTOkuSQnNRz__eQQcTZjO53GzB=s200-c' },
  { name: 'Ghostface Playa', genre: 'Phonk', genres: ['phonk'], gradient: 'from-purple-700 to-indigo-950', avatarUrl: 'https://yt3.googleusercontent.com/yRmwlYY7ow3Tl0NFQreDJpUTxZ90nNwzyHrvLaWXClOqIeUfKWeT9_tO4nKhgV0MmBzKlLBPWUU=s200-c' },
  { name: 'Shadxwbxrn', genre: 'Phonk', genres: ['phonk'], gradient: 'from-orange-600 to-neutral-900', avatarUrl: 'https://yt3.googleusercontent.com/BcZMenqET5GTMLyCLXZRwbysy0DNYXY3zvIw1pAM3jiDq-J86djJjmwzYy1IlaT9mi-jD4h2Yw=s200-c' },
  { name: 'INTERWORLD', genre: 'Phonk', genres: ['phonk', 'electronic'], gradient: 'from-cyan-600 to-blue-950', avatarUrl: 'https://yt3.googleusercontent.com/oCvzk0TlYyRPtP_rVg4yPmFKjhOAzF7iOMvGQH9n0bpWv2ZBAlCbjTrml4Z5pXXf1q69lWyauA=s200-c' },

  // Hip-Hop
  { name: 'The Weeknd', genre: 'R&B / Pop', genres: ['pop', 'hiphop'], gradient: 'from-red-700 to-rose-950', avatarUrl: 'https://lh3.googleusercontent.com/U-SAmNOu4TynE818gLCfKsuHZ0U5YNEtO9mrjSI9WCCKERs98LzrCal5kajBBTQNwdcisoB2Bn-pHp4=s200-c' },
  { name: 'Travis Scott', genre: 'Hip-Hop', genres: ['hiphop'], gradient: 'from-amber-700 to-yellow-950', avatarUrl: 'https://yt3.googleusercontent.com/r9k_FpAswxhQnl_cudiaT2ocWFccR6SzEFXgZ9a12iR5eDPSILlIL2EQewyQ-yYSt1JFyH1pqnoBXxs=s200-c' },
  { name: 'Drake', genre: 'Hip-Hop', genres: ['hiphop', 'pop'], gradient: 'from-blue-600 to-indigo-950', avatarUrl: 'https://yt3.googleusercontent.com/MxNjcRJ-uK4Xvx7u90IhEFLQM8x9LIGTA9VCKHq5U4Wn2jOgiWaMtg-qz329SIzqnCyhdCCB3MpdAGs=s200-c' },
  { name: 'Kendrick Lamar', genre: 'Hip-Hop', genres: ['hiphop'], gradient: 'from-emerald-700 to-teal-950', avatarUrl: 'https://yt3.googleusercontent.com/uB8Magh99SvDyT_mcDYeNYxlVZ_F9WN-cJtAFMHw_Q-_N_8y5-uZiay8-EZSKKloNoWxymBzVehSF4PN=s200-c' },
  { name: 'Kanye West', genre: 'Hip-Hop', genres: ['hiphop'], gradient: 'from-neutral-700 to-stone-950', avatarUrl: 'https://lh3.googleusercontent.com/IFlc3sf6sHV3TAZ_5vhyHQiKb9D4AdSlDkiTSgsRiicnzLASXwVr1n22EEg6Vtd2XBlyJslm8xlYiA=s200-c' },
  { name: 'Eminem', genre: 'Hip-Hop', genres: ['hiphop', 'rock'], gradient: 'from-slate-700 to-zinc-950', avatarUrl: 'https://lh3.googleusercontent.com/JFI6JZrS-Lco4UdpqDfHY5Wgwy51VXWxmNdI7bCBU5CDlIpN6WWyisZ7MGlpjbrxEGYMFpsqoR_UwcE=s200-c' },
  { name: 'Post Malone', genre: 'Hip-Hop / Pop', genres: ['hiphop', 'pop', 'rock'], gradient: 'from-yellow-600 to-amber-950', avatarUrl: 'https://lh3.googleusercontent.com/48LfK4z6o-CCEWgHQnQfg0ltcT9tbZSN0qjSh0FSJsJI5GF48j2-pH219ciG1ML-PI80ZGD4Vz6sjg=s200-c' },
  { name: 'Juice WRLD', genre: 'Hip-Hop', genres: ['hiphop'], gradient: 'from-fuchsia-700 to-purple-950', avatarUrl: 'https://yt3.googleusercontent.com/6YKQ7fDb3ISfzNUjpJnXX1FLw9EQ8eK5qHa07VANJtkaGagUtqtHiAOKz2AJ1AoASNacrCeg8pd35ao=s200-c' },
  { name: 'Lil Peep', genre: 'Emo Rap', genres: ['hiphop', 'rock', 'indie'], gradient: 'from-pink-600 to-rose-950', avatarUrl: 'https://yt3.googleusercontent.com/TbvXoTXJz8a2xfkJxZsI0riSyrUSibnVHBFxhHTeJefWY-2-60x0VhUPkO89uF3CGOPLalsTTM-OlEeI=s200-c' },
  { name: 'Miyagi & Эндшпиль', genre: 'Hip-Hop', genres: ['hiphop'], gradient: 'from-amber-700 to-stone-900', avatarUrl: 'https://yt3.googleusercontent.com/wUMilVdi6oF6T4Wgb-tXRmVh11b7bPtXWg3ZbMLS33GicZ6q-4YbuWRUIgsuf47QleZmGfEr9sEw8ShzVQ=s200-c' },
  { name: 'Oxxxymiron', genre: 'Hip-Hop', genres: ['hiphop'], gradient: 'from-sky-700 to-slate-900', avatarUrl: 'https://yt3.googleusercontent.com/VQFSi8rivXGVoh_8IOz3TuyZ_ZEgYHtZTHHLHUTwszOEfbjIdr_0PcJY20Zc5U1pprsv4oae8u-mxxU=s200-c' },
  { name: 'PHARAOH', genre: 'Hip-Hop', genres: ['hiphop'], gradient: 'from-violet-800 to-neutral-950', avatarUrl: 'https://lh3.googleusercontent.com/jZrLc4z8raQg-YEmh7tO9Y8FUTyEnRNvkLLfSs-BsEB5Do2U_qRM1uXvpAixJnizItPZVrOgnVg9C9g=s200-c' },
  { name: 'SALUKI', genre: 'Hip-Hop', genres: ['hiphop', 'electronic'], gradient: 'from-zinc-700 to-neutral-950', avatarUrl: 'https://yt3.googleusercontent.com/iyfGkGXSKiQTIypgBHjls-hluup_Z-OIEWlaj5HJUQfkZKHzYk4CrUGcpbCnKfBAxH9mv_kZzXF8Sw=s200-c' },

  // Rock / Metal
  { name: 'Linkin Park', genre: 'Rock', genres: ['rock', 'metal'], gradient: 'from-blue-700 to-slate-950', avatarUrl: 'https://lh3.googleusercontent.com/uE72emEZFH3TVtCZoIFYKmnf7vsb42RYQxb4X-lonyqPQuS_mLtKpLfBQ5JdHwUijfQo06BtSB7LoQ=s200-c' },
  { name: 'Nirvana', genre: 'Grunge / Rock', genres: ['rock'], gradient: 'from-yellow-600 to-stone-900', avatarUrl: 'https://yt3.googleusercontent.com/yoFwkvvbmM3u7q0VM_HpjCnsaViQx3gWuycm5OsdmRqWBHL4LyIpNQ5kemdcoW7zrGETTutR_5c_xk8=s200-c' },
  { name: 'Rammstein', genre: 'Industrial Metal', genres: ['rock', 'metal'], gradient: 'from-red-800 to-neutral-950', avatarUrl: 'https://lh3.googleusercontent.com/5n-50qHOrMGyff90gyOB-6BXtoBTXQlBojztu06xVhk1_PhdFVF4XB_0wzjrWMiLVA0USgv-san0j0k=s200-c' },
  { name: 'Deftones', genre: 'Alt Rock', genres: ['rock', 'metal'], gradient: 'from-teal-800 to-slate-950', avatarUrl: 'https://lh3.googleusercontent.com/7eRx2PBSECk4sHidGdOV2QHLS6KYEM7o_xWqNhQ-ZbMzUovN0S6mkVVtMVEXlqctZ5q9fOwB7_2Itgg=s200-c' },
  { name: 'Arctic Monkeys', genre: 'Indie Rock', genres: ['rock', 'indie'], gradient: 'from-amber-700 to-neutral-900', avatarUrl: 'https://yt3.googleusercontent.com/kbPRnnOmWPXIb35ygxKvXt2a_745AVUkAUeFMqOUxbKx8T_I0f1JUfK3G43-_xUldK16-KrU2cj43i0=s200-c' },
  { name: 'The Neighbourhood', genre: 'Alt Rock', genres: ['rock', 'indie', 'pop'], gradient: 'from-neutral-600 to-black', avatarUrl: 'https://lh3.googleusercontent.com/J19IDTPTPVFTr0WvJocjskYePdfGuJLJl8wVqKg1cJ3PRMKRg1k-bGjQ6PF9PbgLnw95APtKV0gXIrw=s200-c' },
  { name: 'Король и Шут', genre: 'Punk Rock', genres: ['rock'], gradient: 'from-red-700 to-black', avatarUrl: 'https://yt3.googleusercontent.com/xw3xvEHQEWXX8ccMROkcmOjYcYZvKbo7GHzYStl7VRXehxqE-yXirXpSB1KckLYoTsn9UpH4pnfC1aY=s200-c' },
  { name: 'Кино', genre: 'Post-Punk', genres: ['rock', 'indie'], gradient: 'from-slate-700 to-black', avatarUrl: 'https://yt3.ggpht.com/ytc/AIdro_m7A-puWYGi4-6hzDCgLWIfCyIEg87vsrGOVjJDFuMvUg=s200-c' },
  { name: 'Три дня дождя', genre: 'Rock', genres: ['rock'], gradient: 'from-blue-800 to-slate-950', avatarUrl: 'https://yt3.ggpht.com/ytc/AIdro_mh4kt6VaYTL077ddRxOvNlMSs2ouMUvvLAeWbL76NrFwo=s200-c' },
  { name: 'Bring Me The Horizon', genre: 'Metalcore', genres: ['rock', 'metal'], gradient: 'from-rose-800 to-zinc-950', avatarUrl: 'https://yt3.googleusercontent.com/YgsyFk3KZHvI5cYtcGOcWYwbpu_GJc-IbPeWyF_Xzy2JIDwL1cPefog1szowNlvuIJ-_OkpoyWOYxhg=s200-c' },

  // Electronic / Synthwave
  { name: 'Daft Punk', genre: 'Electronic', genres: ['electronic'], gradient: 'from-yellow-500 to-amber-900', avatarUrl: 'https://lh3.googleusercontent.com/qLhu6Py_4_xoBsoubKQsXlhOQGqU9YU1ZRAbFusF0LlrPkXbbpu7bEh-k_ZtE4JwLgubvucAQqcK1hRk=s200-c' },
  { name: 'The Prodigy', genre: 'Electronic / Breakbeat', genres: ['electronic', 'rock'], gradient: 'from-lime-600 to-emerald-950', avatarUrl: 'https://lh3.googleusercontent.com/T6tDVkRwiyBctIvUpMYd8RWaH2V0BsNkqZnmrxxkY8An2t2_htNtHRZeYDJBopu-p3GC2wq1OvHB9F4=s200-c' },
  { name: 'Fred again..', genre: 'Electronic', genres: ['electronic'], gradient: 'from-sky-600 to-blue-950', avatarUrl: 'https://lh3.googleusercontent.com/A_RYzbdTf179VgAVX6dbbviS9Ff6ryikolaxwOtMFDctcvuo7JWPS_OZtS7N77eS7WNwaWYjOnhNX7g=s200-c' },
  { name: 'Skrillex', genre: 'Electronic', genres: ['electronic', 'hiphop'], gradient: 'from-violet-600 to-purple-950', avatarUrl: 'https://lh3.googleusercontent.com/VV_UrDtHZTdKt-oP2Gcn4D15Oh2kec4yuGRn7F-S7vx7-tit2QfZNys-kL9uyjK0VovAg96LIscl8_FJ=s200-c' },
  { name: 'Gesaffelstein', genre: 'Dark Techno', genres: ['electronic'], gradient: 'from-neutral-700 to-black', avatarUrl: 'https://yt3.googleusercontent.com/O_rI9mhwQw3m0Sq3RqAb4dHHQV05k30zB1KriF9rS0smdQvhj9bcuQAIQClcDAmO3oIq4a91xN1zPUAD=s200-c' },

  // Pop / Indie
  { name: 'Billie Eilish', genre: 'Alt Pop', genres: ['pop', 'indie'], gradient: 'from-emerald-600 to-zinc-950', avatarUrl: 'https://lh3.googleusercontent.com/tQC4rOL6xz6FhmFr0ggQExxyGbYSOsyveXVSnPBh2WjEyIzQ9pMHablLJ-0GlMBrLBlBrbWQGmzrV6KN=s200-c' },
  { name: 'Lana Del Rey', genre: 'Dream Pop', genres: ['pop', 'indie'], gradient: 'from-rose-600 to-stone-900', avatarUrl: 'https://lh3.googleusercontent.com/CN-IGGdHB9FLirmRDoFj8VPwVJGd1N-WUP7uGyw7tOdJuE2MLwF-oe8xnr3ExERS6sCo-iviC-g3TtrL=s200-c' },
  { name: 'Joji', genre: 'Lo-Fi / R&B', genres: ['pop', 'indie', 'lofi'], gradient: 'from-purple-800 to-slate-950', avatarUrl: 'https://lh3.googleusercontent.com/qMz5INk8KDMl9JNUQck7ijuD-o-aJGFT_tw0KPHcxqNUAs5RZD0lkbLkUMhy3p0VFOoKZecEvkbh1BDp=s200-c' },
  { name: 'Gorillaz', genre: 'Alt / Trip-Hop', genres: ['indie', 'rock', 'electronic'], gradient: 'from-teal-600 to-neutral-950', avatarUrl: 'https://lh3.googleusercontent.com/MQ8sTeoDhSNyEItlabM-Bl1kFgCa4r1Rog38K8nokZ8vAIAgoN0omxEk5G6lXBj5azaaUZAvH7xhuRA=s200-c' },
  { name: 'Cigarettes After Sex', genre: 'Dream Pop', genres: ['indie'], gradient: 'from-neutral-700 to-black', avatarUrl: 'https://yt3.googleusercontent.com/ZPa3GuJRbvtOYYgGfslq7XIyzmATk9rncc2RTOFkLh6n4RyYYeGw-_AjqNpOCaC3a02xFHys5EZe97TY=s200-c' },
  { name: 'Tame Impala', genre: 'Psychedelic Pop', genres: ['indie', 'electronic'], gradient: 'from-pink-600 to-indigo-950', avatarUrl: 'https://lh3.googleusercontent.com/onR0ZnuFE6PwBeNwMiaTQHtz5vIbEIV8GJwDj8nEmOHuOvUj0efwFdAtXpfCOnpm-4GBl1IMgmtUNw=s200-c' },
  { name: 'Radiohead', genre: 'Alt Rock', genres: ['rock', 'indie'], gradient: 'from-slate-600 to-zinc-900', avatarUrl: 'https://lh3.googleusercontent.com/G-Vsaq4pw6Bl5Ny4p_wV9obzu_eyZxynQycvCvQru4Wglzfxg4NO9owDKnSlKys_-WRzPEc0O6ydGA=s200-c' },
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
  const { t, language, setLanguage, supportedLanguages } = useTranslation();
  const { theme, setTheme } = useThemeStore();
  const settingsStore = useSettingsStore();

  const [currentStep, setCurrentStep] = useState<OnboardingStep>(
    settingsStore.onboardingCompleted ? 'artists' : 'welcome'
  );

  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<SearchArtistItem[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<string[]>(
    settingsStore.favoriteArtists || []
  );
  const toastStore = useToastStore();
  const [failedAvatars, setFailedAvatars] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(settingsStore.onboardingCompleted ? 'artists' : 'welcome');
    }
  }, [isOpen, settingsStore.onboardingCompleted]);

  const markAvatarFailed = (url: string) => {
    setFailedAvatars((prev) => {
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  };

  const [avatarMap, setAvatarMap] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {
      ...(settingsStore.favoriteArtistAvatars || {}),
    };
    for (const a of CURATED_ARTISTS) {
      if (a.avatarUrl) {
        initial[a.name] = a.avatarUrl;
      }
    }
    return initial;
  });

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
        setAvatarMap((prev) => {
          const updated = { ...prev };
          for (const item of results) {
            const av = item.avatarUrl || item.thumbnailUrl;
            if (av && item.name) {
              updated[item.name] = av;
            }
          }
          return updated;
        });
      } catch (err) {
        console.error('Failed to search artists:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleArtist = (name: string, avatarUrl?: string) => {
    if (avatarUrl) {
      setAvatarMap((prev) => ({ ...prev, [name]: avatarUrl }));
    }
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

  const canSubmit = selectedArtists.length >= 1;

  const handleFinish = () => {
    if (!canSubmit) return;
    invalidateWaveCache();
    const finalAvatars: Record<string, string> = {};
    for (const name of selectedArtists) {
      if (avatarMap[name]) {
        finalAvatars[name] = avatarMap[name];
      }
    }
    settingsStore.setFavoriteArtists(selectedArtists, finalAvatars);
    settingsStore.setOnboardingCompleted(true);

    if (!settingsStore.onboardingCompleted) {
      onClose();
      settingsStore.setIsWaveGeneratingModalOpen(true);
    } else {
      onClose();
      const updatingTitle = t.wave?.updatingTitle || 'Updating My Wave';
      const updatingDesc =
        t.wave?.updatingDesc || 'Generating fresh tracks based on your artists...';
      toastStore.info(updatingTitle, updatingDesc);

      generateWaveTracks(selectedArtists, true)
        .then((tracks) => {
          const updatedTitle = t.wave?.updatedTitle || 'My Wave updated';
          const waveTitle = t.wave?.title || 'My Wave';
          toastStore.success(updatedTitle, `${waveTitle} (${tracks.length})`);
          if (onCompleteWave) {
            onCompleteWave(selectedArtists);
          }
        })
        .catch((err) => {
          console.warn('[OnboardingModal] Background wave update failed:', err);
        });
    }
  };

  const handleSkip = () => {
    settingsStore.setOnboardingCompleted(true);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/85 backdrop-blur-2xl animate-fade-in select-none"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-white/95 dark:bg-[#0B0B10]/95 border border-black/10 dark:border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.18)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden text-slate-900 dark:text-white">
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-black/[0.03] dark:from-white/10 to-transparent pointer-events-none" />

        
        <div className="relative z-10 px-6 sm:px-8 pt-6 pb-4 flex flex-col gap-3 shrink-0 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#0F172A] text-white dark:bg-white dark:text-black flex items-center justify-center shadow-md dark:shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                <Waves size={18} />
              </div>
              <span className="text-xs font-bold tracking-widest uppercase text-slate-500 dark:text-white/50">
                {t.onboarding?.headerBadge || 'Otofy Setup'}
              </span>
            </div>

            
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep('welcome')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  currentStep === 'welcome'
                    ? 'bg-[#0F172A] text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-black/[0.04] text-slate-600 hover:bg-black/[0.08] dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/15'
                }`}
              >
                1. {t.onboarding?.stepAppearance || (language === 'ru' ? 'Язык и тема' : 'Language & Theme')}
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep('guide')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  currentStep === 'guide'
                    ? 'bg-[#0F172A] text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-black/[0.04] text-slate-600 hover:bg-black/[0.08] dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/15'
                }`}
              >
                2. {t.onboarding?.stepGuide || (language === 'ru' ? 'Возможности' : 'Features')}
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep('artists')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  currentStep === 'artists'
                    ? 'bg-[#0F172A] text-white dark:bg-white dark:text-black shadow-xs'
                    : 'bg-black/[0.04] text-slate-600 hover:bg-black/[0.08] dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/15'
                }`}
              >
                3. {t.onboarding?.stepArtists || (language === 'ru' ? 'Артисты' : 'Artists')}
              </button>
            </div>

            <button
              onClick={settingsStore.onboardingCompleted ? onClose : handleSkip}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white transition-colors cursor-pointer"
              title={t.nav.close}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        
        {currentStep === 'welcome' && (
          <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 flex flex-col gap-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0F172A] dark:text-white">
                {t.onboarding?.welcomeTitle || (language === 'ru' ? 'Добро пожаловать в Otofy' : 'Welcome to Otofy')}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-white/60 max-w-xl leading-relaxed">
                {t.onboarding?.welcomeSubtitle ||
                  (language === 'ru'
                    ? 'Настройте язык интерфейса и тему оформления для комфортного прослушивания музыки.'
                    : 'Set your preferred language and appearance theme for an optimal listening experience.')}
              </p>
            </div>

            
            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-bold tracking-wider uppercase text-slate-500 dark:text-white/50 flex items-center gap-1.5">
                <Globe size={13} />
                {t.onboarding?.chooseLanguage || (language === 'ru' ? 'Выберите язык интерфейса' : 'Choose Interface Language')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {supportedLanguages.map((lang) => {
                  const isSelected = language === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setLanguage(lang.code)}
                      className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#0F172A] text-white border-[#0F172A] dark:bg-white dark:text-black dark:border-white shadow-md dark:shadow-[0_0_20px_rgba(255,255,255,0.25)]'
                          : 'bg-black/[0.03] hover:bg-black/[0.06] text-slate-800 border-black/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-white dark:border-white/10'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-sm font-bold truncate leading-tight">
                          {lang.nativeName}
                        </div>
                        <div
                          className={`text-[11px] truncate mt-0.5 ${
                            isSelected ? 'text-white/70 dark:text-black/60' : 'text-slate-400 dark:text-white/40'
                          }`}
                        >
                          {lang.name}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-white/20 dark:bg-black/15 flex items-center justify-center shrink-0">
                          <Check size={12} className={isSelected ? 'text-white dark:text-black' : ''} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            
            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-bold tracking-wider uppercase text-slate-500 dark:text-white/50 flex items-center gap-1.5">
                <Sparkles size={13} />
                {t.onboarding?.chooseTheme || (language === 'ru' ? 'Выберите тему оформления' : 'Choose Appearance Theme')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex flex-col p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                    theme === 'light'
                      ? 'bg-white text-slate-900 border-slate-900 shadow-md ring-2 ring-slate-900/15'
                      : 'bg-black/[0.02] hover:bg-black/[0.05] text-slate-700 border-black/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] dark:text-white/70 dark:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-xs">
                        <Sun size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                          {t.onboarding?.themeLight || (language === 'ru' ? 'Светлая тема' : 'Light Theme')}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-white/50">
                          Crystal Liquid Glass
                        </div>
                      </div>
                    </div>
                    {theme === 'light' && (
                      <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-xs">
                        <Check size={14} />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-white/60 leading-relaxed">
                    {t.onboarding?.themeLightDesc ||
                      (language === 'ru'
                        ? 'Кристальное жидкое стекло с чистым дневным контрастом'
                        : 'Crystal liquid glass with crisp daytime contrast')}
                  </p>
                </button>

                
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex flex-col p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                    theme === 'dark'
                      ? 'bg-[#121218] text-white border-white shadow-xl ring-2 ring-white/20'
                      : 'bg-black/[0.02] hover:bg-black/[0.05] text-slate-700 border-black/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] dark:text-white/70 dark:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-indigo-950 text-indigo-300 border border-indigo-500/20 flex items-center justify-center shadow-xs">
                        <Moon size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                          {t.onboarding?.themeDark || (language === 'ru' ? 'Темная тема' : 'Dark Theme')}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-white/50">
                          Obsidian OLED Black
                        </div>
                      </div>
                    </div>
                    {theme === 'dark' && (
                      <div className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center shadow-xs">
                        <Check size={14} />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-white/60 leading-relaxed">
                    {t.onboarding?.themeDarkDesc ||
                      (language === 'ru'
                        ? 'Глубокий обсидиановый OLED черный с мягким сиянием'
                        : 'Deep obsidian OLED black with gentle neon glow')}
                  </p>
                </button>
              </div>
            </div>
          </div>
        )}

        
        {currentStep === 'guide' && (
          <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 flex flex-col gap-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0F172A] dark:text-white">
                {t.onboarding?.guideTitle || (language === 'ru' ? 'Все возможности Otofy' : 'Everything Otofy has to offer')}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-white/60 max-w-xl leading-relaxed">
                {t.onboarding?.guideSubtitle ||
                  (language === 'ru'
                    ? 'Современный аудиоплеер с неограниченным доступом к музыке и умными рекомендациями.'
                    : 'A modern desktop music player with unrestricted streaming and smart discovery.')}
              </p>
            </div>

            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="flex flex-col p-5 rounded-2xl bg-white/70 dark:bg-white/[0.04] border border-black/10 dark:border-white/10 shadow-sm relative overflow-hidden group hover:border-indigo-500/40 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-xs">
                  <Waves size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                  Personal Stream
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  {t.onboarding?.guideWaveTitle || (language === 'ru' ? 'Персональная «Моя волна»' : 'Personal My Wave')}
                </h3>
                <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed">
                  {t.onboarding?.guideWaveDesc ||
                    (language === 'ru'
                      ? 'Бесконечный индивидуальный поток музыки, который обучается на ваших лайках и любимых артистах.'
                      : 'An endless music stream tuned to your liked tracks and favorite artists in real time.')}
                </p>
              </div>

              
              <div className="flex flex-col p-5 rounded-2xl bg-white/70 dark:bg-white/[0.04] border border-black/10 dark:border-white/10 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-xs">
                  <Compass size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
                  Infinite Library
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  {t.onboarding?.guideCatalogTitle || (language === 'ru' ? 'Каталог YouTube Music' : 'YouTube Music Catalog')}
                </h3>
                <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed">
                  {t.onboarding?.guideCatalogDesc ||
                    (language === 'ru'
                      ? 'Миллионы треков, альбомов, жанровых станций и настроений дня без региональных блокировок.'
                      : 'Millions of tracks, full albums, curated genre stations, and moods without regional locks.')}
                </p>
              </div>

              
              <div className="flex flex-col p-5 rounded-2xl bg-white/70 dark:bg-white/[0.04] border border-black/10 dark:border-white/10 shadow-sm relative overflow-hidden group hover:border-rose-500/40 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 flex items-center justify-center mb-4 shadow-xs">
                  <Sparkles size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1">
                  Premium Experience
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  {t.onboarding?.guideExperienceTitle || (language === 'ru' ? 'Стиль и синхронные тексты' : 'Synced Lyrics & Sleek Design')}
                </h3>
                <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed">
                  {t.onboarding?.guideExperienceDesc ||
                    (language === 'ru'
                      ? 'Караоке-тексты песен в реальном времени, рекомендации внизу плейлистов и дизайн обсидианового стекла.'
                      : 'Karaoke-style synchronized lyrics, suggested tracks at the end of playlists, and obsidian glass aesthetics.')}
                </p>
              </div>
            </div>
          </div>
        )}

        
        {currentStep === 'artists' && (
          <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-4 flex flex-col gap-3 min-h-0">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">
                {t.onboarding?.title || 'Choose 3 or more favorite artists'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-white/60 max-w-2xl leading-relaxed">
                {t.onboarding?.subtitle ||
                  'This immediately activates and calibrates your personal "My Wave" endless station on the Home screen.'}
              </p>
            </div>

            {selectedArtists.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                {selectedArtists.map((artistName) => {
                  const avatar =
                    avatarMap[artistName] || settingsStore.favoriteArtistAvatars?.[artistName];
                  const hasFailed = avatar && failedAvatars.has(avatar);
                  return (
                    <span
                      key={artistName}
                      className="inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-black/[0.05] hover:bg-black/[0.08] dark:bg-white/15 dark:hover:bg-white/20 text-xs font-medium text-slate-900 dark:text-white border border-black/10 dark:border-white/15 transition-colors shrink-0"
                    >
                      <div className="w-5 h-5 rounded-full overflow-hidden bg-black/10 dark:bg-white/20 shrink-0 relative flex items-center justify-center">
                        <User size={11} className="text-slate-500 dark:text-white/70" />
                        {avatar && !hasFailed && (
                          <img
                            src={avatar}
                            alt={artistName}
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full object-cover rounded-full"
                            loading="lazy"
                            onError={() => markAvatarFailed(avatar)}
                          />
                        )}
                      </div>
                      <span className="truncate max-w-[150px]">{artistName}</span>
                      <button
                        type="button"
                        onClick={() => toggleArtist(artistName)}
                        className="text-slate-400 hover:text-slate-700 dark:text-white/60 dark:hover:text-white transition-colors cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <div className="relative w-full">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40"
                />
                <input
                  type="text"
                  placeholder={
                    t.onboarding?.searchPlaceholder || 'Search artists or bands...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-10 pr-10 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none focus:border-slate-400 dark:focus:border-white/30 focus:bg-white dark:focus:bg-white/[0.09] transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white cursor-pointer"
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
                    const isActive = selectedGenre === g.id;
                    return (
                      <button
                        key={g.id}
                        onClick={() => setSelectedGenre(g.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#0F172A] text-white shadow-sm dark:bg-white dark:text-black dark:shadow-[0_2px_10px_rgba(255,255,255,0.3)]'
                            : 'bg-black/[0.04] text-slate-600 hover:bg-black/[0.08] hover:text-slate-900 dark:bg-white/[0.06] dark:text-white/70 dark:hover:bg-white/[0.12] dark:hover:text-white border border-black/5 dark:border-white/5'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            
            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400 dark:text-white/40">
                <Loader2 size={32} className="animate-spin text-slate-600 dark:text-white/60" />
                <span className="text-xs">{t.onboarding?.searching || 'Searching artists...'}</span>
              </div>
            ) : isSearchActive && searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400 dark:text-white/40">
                <User size={36} className="opacity-40" />
                <span className="text-sm">
                  {t.onboarding?.noArtistsFound || 'No artists found.'}
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pb-2">
                {(isSearchActive
                  ? searchResults.map((r) => ({
                      name: r.name,
                      genre: r.subscribers || 'Artist',
                      avatarUrl: r.avatarUrl || r.thumbnailUrl,
                      gradient: getArtistGradient(r.name),
                    }))
                  : filteredCurated
                ).map((artist) => {
                  const isSelected = selectedArtists.includes(artist.name);
                  const avatar =
                    artist.avatarUrl ||
                    avatarMap[artist.name] ||
                    settingsStore.favoriteArtistAvatars?.[artist.name];
                  const hasFailed = avatar && failedAvatars.has(avatar);

                  return (
                    <div
                      key={artist.name}
                      onClick={() => toggleArtist(artist.name, artist.avatarUrl)}
                      className={`group relative flex items-center gap-3 p-2.5 rounded-2xl border cursor-pointer transition-all duration-200 select-none ${
                        isSelected
                          ? 'bg-[#0F172A] border-[#0F172A] dark:bg-white dark:border-white shadow-md dark:shadow-[0_4px_20px_rgba(255,255,255,0.2)]'
                          : 'bg-black/[0.02] hover:bg-black/[0.05] border-black/5 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:border-white/5'
                      }`}
                    >
                      <div className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-black/10 dark:bg-white/10 shadow-xs">
                        <User
                          size={18}
                          className={
                            isSelected ? 'text-white/70 dark:text-black/60' : 'text-slate-400 dark:text-white/40'
                          }
                        />
                        {avatar && !hasFailed && (
                          <img
                            src={avatar}
                            alt={artist.name}
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full object-cover rounded-full"
                            loading="lazy"
                            onError={() => markAvatarFailed(avatar)}
                          />
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 rounded-full bg-black/45 flex items-center justify-center backdrop-blur-[1px]">
                            <Check size={18} className="text-white stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <span
                          className={`text-sm font-semibold truncate block transition-colors ${
                            isSelected
                              ? 'text-white dark:text-black'
                              : 'text-slate-800 group-hover:text-slate-950 dark:text-white/90 dark:group-hover:text-white'
                          }`}
                        >
                          {artist.name}
                        </span>
                        <span
                          className={`text-[11px] truncate block ${
                            isSelected
                              ? 'text-white/70 dark:text-black/60'
                              : 'text-slate-500 dark:text-white/50'
                          }`}
                        >
                          {artist.genre}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        
        <div className="relative z-10 px-6 sm:px-8 py-4 bg-slate-50/90 dark:bg-[#08080C]/90 backdrop-blur-md border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-4 shrink-0">
          
          {currentStep === 'welcome' ? (
            <button
              type="button"
              onClick={() => setCurrentStep('artists')}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white px-3 py-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              {language === 'ru' ? 'Пропустить к артистам' : 'Skip to Artists'}
            </button>
          ) : currentStep === 'guide' ? (
            <button
              type="button"
              onClick={() => setCurrentStep('welcome')}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white px-3 py-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>{t.onboarding?.back || (language === 'ru' ? 'Назад: Язык и тема' : 'Back: Language & Theme')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentStep('guide')}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white px-3 py-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>{t.onboarding?.back || (language === 'ru' ? 'Назад: Возможности' : 'Back: Features')}</span>
            </button>
          )}

          
          {currentStep === 'welcome' ? (
            <button
              type="button"
              onClick={() => setCurrentStep('guide')}
              className="px-6 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 bg-[#0F172A] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90 shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all"
            >
              <span>{t.onboarding?.next || (language === 'ru' ? 'Далее: Возможности' : 'Next: Features')}</span>
              <ArrowRight size={16} />
            </button>
          ) : currentStep === 'guide' ? (
            <button
              type="button"
              onClick={() => setCurrentStep('artists')}
              className="px-6 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 bg-[#0F172A] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90 shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all"
            >
              <span>{t.onboarding?.next || (language === 'ru' ? 'Далее: Выбрать артистов' : 'Next: Choose Artists')}</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-slate-600 dark:text-white/70">
                  {countText}
                </span>
                {canSubmit && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1">
                    <Check size={12} strokeWidth={3} /> {t.onboarding?.readyToLaunch || 'Ready to launch'}
                  </span>
                )}
              </div>

              {canSubmit ? (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="px-6 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 bg-[#0F172A] text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90 shadow-[0_4px_20px_rgba(15,23,42,0.25)] dark:shadow-[0_4px_20px_rgba(255,255,255,0.35)] cursor-pointer hover:scale-105 active:scale-95 transition-all"
                >
                  <span>
                    {settingsStore.onboardingCompleted
                      ? t.wave?.saveChanges || (language === 'ru' ? 'Сохранить изменения' : 'Save changes')
                      : t.onboarding?.finishSetup || (language === 'ru' ? 'Сформировать Мою волну' : 'Generate My Wave')}
                  </span>
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSkip}
                  className="px-5 py-2.5 rounded-full text-sm font-semibold bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-white/90 cursor-pointer transition-colors"
                >
                  {language === 'ru' ? 'Пропустить и слушать' : 'Skip for now'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
