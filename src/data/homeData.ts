export interface QuickAccessItem {
  id: string;
  title: string;
  subtitle?: string;
  color: string;
  icon: 'heart' | 'user' | 'music' | 'car' | 'box' | 'sun' | 'guitar' | 'disc' | 'zap' | 'sparkles' | 'headphones' | 'waves' | 'flame' | 'radio' | 'history';
  gradientFrom: string;
  gradientTo: string;
  playlistId?: string;
}

export interface StationItem {
  id: string;
  title: string;
  artistsSummary: string;
  bgColor: string;
  textColor: string;
  badgeLabel: string;
  badgeBg: string;
  accentGradient: string;
  artistInitials: string;
  styleVariant: 'split' | 'mint' | 'slate' | 'coral' | 'lime' | 'orchid';
  searchQuery: string;
}

export interface MadeForYouItem {
  id: string;
  title: string;
  mixNumber?: string;
  badgeColor: string;
  badgeTextColor: string;
  subtitle: string;
  cardVariant: 'discover' | 'mix';
  bgGradient: string;
}

export const QUICK_ACCESS_ITEMS: QuickAccessItem[] = [
  {
    id: 'qa-liked',
    title: 'Liked Songs',
    subtitle: 'Your personal favorites',
    color: '#4F46E5',
    icon: 'heart',
    gradientFrom: '#6366F1',
    gradientTo: '#9333EA',
    playlistId: 'pl-liked',
  },
  {
    id: 'qa-discover',
    title: 'Discover Weekly',
    subtitle: 'Curated weekly discoveries',
    color: '#09090B',
    icon: 'sparkles',
    gradientFrom: '#18181B',
    gradientTo: '#581C87',
  },
  {
    id: 'qa-history',
    title: 'History',
    subtitle: 'Recently played tracks',
    color: '#0F172A',
    icon: 'history',
    gradientFrom: '#1E293B',
    gradientTo: '#0F172A',
    playlistId: 'pl-history',
  },
  {
    id: 'qa-phonk',
    title: 'Daily Mix 1 • Phonk',
    subtitle: 'DVRST, Kordhell, Hensonn',
    color: '#0891B2',
    icon: 'zap',
    gradientFrom: '#06B6D4',
    gradientTo: '#0E7490',
  },
  {
    id: 'qa-lofi',
    title: 'Daily Mix 2 • Lo-Fi',
    subtitle: 'Kupla, Jinsang, idealism',
    color: '#D97706',
    icon: 'headphones',
    gradientFrom: '#F59E0B',
    gradientTo: '#B45309',
  },
  {
    id: 'qa-synth',
    title: 'Daily Mix 3 • Synthwave',
    subtitle: 'The Midnight, FM-84, Gunship',
    color: '#EA580C',
    icon: 'waves',
    gradientFrom: '#F97316',
    gradientTo: '#C2410C',
  },
  {
    id: 'qa-rap',
    title: 'Daily Mix 4 • Hip-Hop',
    subtitle: 'BONES, Xavier Wulf',
    color: '#DB2777',
    icon: 'flame',
    gradientFrom: '#EC4899',
    gradientTo: '#BE185D',
  },
  {
    id: 'qa-gems',
    title: 'Electronic Gems',
    subtitle: 'HOME, Kavinsky, Mr.Kitty',
    color: '#7C3AED',
    icon: 'disc',
    gradientFrom: '#8B5CF6',
    gradientTo: '#6D28D9',
  },
];

export const RECOMMENDED_STATIONS: StationItem[] = [
  {
    id: 'station-lofi',
    title: 'Lo-Fi Chill',
    artistsSummary: 'With Jinsang, Kupla, idealism, ChilledCow',
    bgColor: '#78350F',
    textColor: '#FFFFFF',
    badgeLabel: 'RADIO',
    badgeBg: '#B45309',
    accentGradient: 'from-amber-600 to-orange-700',
    artistInitials: 'LF',
    styleVariant: 'split',
    searchQuery: 'lofi hip hop chill beats study',
  },
  {
    id: 'station-phonk',
    title: 'Phonk Drift',
    artistsSummary: 'With DVRST, KORDHELL, Hensonn, Pharmacist',
    bgColor: '#0891B2',
    textColor: '#FFFFFF',
    badgeLabel: 'RADIO',
    badgeBg: '#0E7490',
    accentGradient: 'from-cyan-600 to-teal-700',
    artistInitials: 'PK',
    styleVariant: 'mint',
    searchQuery: 'drift phonk dark bass slowed',
  },
  {
    id: 'station-synth',
    title: 'Synthwave 80s',
    artistsSummary: 'With The Midnight, FM-84, Gunship, Timecop1983',
    bgColor: '#0F172A',
    textColor: '#FFFFFF',
    badgeLabel: 'RADIO',
    badgeBg: '#334155',
    accentGradient: 'from-slate-800 to-indigo-950',
    artistInitials: 'SW',
    styleVariant: 'slate',
    searchQuery: 'synthwave retrowave 80s outrun',
  },
  {
    id: 'station-ambient',
    title: 'Ambient Focus',
    artistsSummary: 'With Brian Eno, Marconi Union, Hammock, Stars of the Lid',
    bgColor: '#1E293B',
    textColor: '#FFFFFF',
    badgeLabel: 'RADIO',
    badgeBg: '#334155',
    accentGradient: 'from-slate-700 to-teal-950',
    artistInitials: 'AM',
    styleVariant: 'coral',
    searchQuery: 'ambient spatial relaxation weightless',
  },
  {
    id: 'station-rap',
    title: 'Cloud Rap',
    artistsSummary: 'With BONES, Xavier Wulf, Yung Lean, Suicideboys',
    bgColor: '#1E1B4B',
    textColor: '#FFFFFF',
    badgeLabel: 'RADIO',
    badgeBg: '#312E81',
    accentGradient: 'from-indigo-900 to-violet-950',
    artistInitials: 'CR',
    styleVariant: 'orchid',
    searchQuery: 'cloud rap underground beats',
  },
];

export const MADE_FOR_YOU_ITEMS: MadeForYouItem[] = [
  {
    id: 'mix-1',
    title: 'Daily Mix 1',
    mixNumber: '1',
    badgeColor: '#06B6D4',
    badgeTextColor: '#0F172A',
    subtitle: 'PANDEMXNIUM, Kordhell, DVRST and more.',
    cardVariant: 'mix',
    bgGradient: 'from-slate-900 via-zinc-800 to-stone-900',
  },
  {
    id: 'mix-2',
    title: 'Daily Mix 2',
    mixNumber: '2',
    badgeColor: '#A855F7',
    badgeTextColor: '#FFFFFF',
    subtitle: 'Kavinsky, HOME, Mr.Kitty, Perturbator and more.',
    cardVariant: 'mix',
    bgGradient: 'from-violet-950 via-purple-900 to-indigo-950',
  },
  {
    id: 'mix-3',
    title: 'Daily Mix 3',
    mixNumber: '3',
    badgeColor: '#F59E0B',
    badgeTextColor: '#0F172A',
    subtitle: 'DVRST, Interworld, Pharmacist, Hensonn and more.',
    cardVariant: 'mix',
    bgGradient: 'from-amber-950 via-orange-950 to-neutral-900',
  },
  {
    id: 'mix-4',
    title: 'Daily Mix 4',
    mixNumber: '4',
    badgeColor: '#EC4899',
    badgeTextColor: '#FFFFFF',
    subtitle: 'BONES, Xavier Wulf, Freddie Dredd, Ghostemane and more.',
    cardVariant: 'mix',
    bgGradient: 'from-rose-950 via-pink-950 to-neutral-900',
  },
  {
    id: 'mix-5',
    title: 'Daily Mix 5',
    mixNumber: '5',
    badgeColor: '#0284C7',
    badgeTextColor: '#0F172A',
    subtitle: 'Brian Eno, Marconi Union, Hammock and more.',
    cardVariant: 'mix',
    bgGradient: 'from-slate-950 via-teal-950 to-slate-900',
  },
];
