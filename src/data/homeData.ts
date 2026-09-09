export interface QuickAccessItem {
  id: string;
  title: string;
  subtitle?: string;
  color: string;
  icon: 'heart' | 'user' | 'music' | 'car' | 'box' | 'sun' | 'guitar' | 'disc' | 'zap' | 'sparkles' | 'headphones' | 'waves' | 'flame' | 'radio';
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
  styleVariant: 'split' | 'mint' | 'emerald' | 'coral' | 'lime' | 'orchid';
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
    id: 'qa-ambient',
    title: 'Daily Mix 5 • Ambient',
    subtitle: 'Brian Eno, Hammock',
    color: '#16A34A',
    icon: 'radio',
    gradientFrom: '#22C55E',
    gradientTo: '#15803D',
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
    styleVariant: 'emerald',
    searchQuery: 'synthwave retrowave 80s outrun',
  },
  {
    id: 'station-ambient',
    title: 'Ambient Focus',
    artistsSummary: 'With Brian Eno, Marconi Union, Hammock, Stars of the Lid',
    bgColor: '#14532D',
    textColor: '#FFFFFF',
    badgeLabel: 'RADIO',
    badgeBg: '#166534',
    accentGradient: 'from-emerald-700 to-teal-900',
    artistInitials: 'AM',
    styleVariant: 'coral',
    searchQuery: 'ambient spatial relaxation weightless',
  },
  {
    id: 'station-rap',
    title: 'Cloud Rap',
    artistsSummary: 'With BONES, Xavier Wulf, Yung Lean, Suicideboys',
    bgColor: '#4C1D95',
    textColor: '#FFFFFF',
    badgeLabel: 'RADIO',
    badgeBg: '#5B21B6',
    accentGradient: 'from-purple-700 to-fuchsia-900',
    artistInitials: 'CR',
    styleVariant: 'orchid',
    searchQuery: 'cloud rap underground lofi',
  },
  {
    id: 'station-electro',
    title: 'Dark Wave',
    artistsSummary: 'With Kavinsky, Daft Punk, Justice, Mr.Kitty',
    bgColor: '#831843',
    textColor: '#FFFFFF',
    badgeLabel: 'RADIO',
    badgeBg: '#9D174D',
    accentGradient: 'from-pink-700 to-rose-950',
    artistInitials: 'DW',
    styleVariant: 'lime',
    searchQuery: 'darkwave electronic dark bass',
  },
];

export const MADE_FOR_YOU_ITEMS: MadeForYouItem[] = [
  {
    id: 'mix-discover',
    title: 'Discover Weekly',
    badgeColor: '#000000',
    badgeTextColor: '#FFFFFF',
    subtitle: 'Your weekly mixtape of fresh underground gems and discoveries.',
    cardVariant: 'discover',
    bgGradient: 'from-zinc-950 via-purple-950 to-pink-900',
  },
  {
    id: 'mix-1',
    title: 'Daily Mix 1',
    mixNumber: '1',
    badgeColor: '#06B6D4',
    badgeTextColor: '#0F172A',
    subtitle: 'DVRST, Kordhell, Hensonn, Pharmacist and more.',
    cardVariant: 'mix',
    bgGradient: 'from-slate-900 via-zinc-800 to-stone-900',
  },
  {
    id: 'mix-2',
    title: 'Daily Mix 2',
    mixNumber: '2',
    badgeColor: '#EAB308',
    badgeTextColor: '#0F172A',
    subtitle: 'Jinsang, Kupla, idealism, ChilledCow and more.',
    cardVariant: 'mix',
    bgGradient: 'from-neutral-900 via-stone-800 to-amber-950',
  },
  {
    id: 'mix-3',
    title: 'Daily Mix 3',
    mixNumber: '3',
    badgeColor: '#F97316',
    badgeTextColor: '#0F172A',
    subtitle: 'The Midnight, FM-84, Gunship, Timecop1983 and more.',
    cardVariant: 'mix',
    bgGradient: 'from-cyan-900 via-blue-800 to-teal-950',
  },
  {
    id: 'mix-4',
    title: 'Daily Mix 4',
    mixNumber: '4',
    badgeColor: '#EC4899',
    badgeTextColor: '#0F172A',
    subtitle: 'BONES, Xavier Wulf, Yung Lean and more.',
    cardVariant: 'mix',
    bgGradient: 'from-zinc-900 via-purple-900 to-neutral-950',
  },
  {
    id: 'mix-5',
    title: 'Daily Mix 5',
    mixNumber: '5',
    badgeColor: '#84CC16',
    badgeTextColor: '#0F172A',
    subtitle: 'Brian Eno, Marconi Union, Hammock and more.',
    cardVariant: 'mix',
    bgGradient: 'from-emerald-950 via-teal-900 to-slate-900',
  },
];
