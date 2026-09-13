import { SupportedLanguage } from '../store/settingsStore';

export interface TranslationSchema {
  nav: {
    back: string;
    forward: string;
    home: string;
    searchPlaceholder: string;
    clearSearch: string;
    themeLight: string;
    themeDark: string;
    accountSync: string;
    selectLanguage: string;
    profile: string;
    minimize: string;
    maximize: string;
    restore: string;
    close: string;
  };
  home: {
    nonStopMusic: string;
    recommendedStations: string;
    madeForYou: string;
    showAll: string;
    discoverWeekly: string;
    history: string;
    historySubtitle: string;
    dailyMix: string;
  };
  library: {
    title: string;
    playlists: string;
    artists: string;
    albums: string;
    searchPlaceholder: string;
    sortBy: string;
    recents: string;
    recentlyAdded: string;
    alphabetical: string;
    importCode: string;
    createPlaylist: string;
    collapse: string;
    expand: string;
    downloads: string;
    cachedSongs: string;
    noPlaylists: string;
    tracksCount: string;
    likedSongs: string;
    pinned: string;
    playlistSingle: string;
    artistSingle: string;
    albumSingle: string;
    creatorYou: string;
    creatorSystem: string;
  };
  hero: {
    publicPlaylist: string;
    songsCount: string;
    aboutHoursMinutes: string;
    aboutMinutes: string;
    officialSongs: string;
    monthlyAudience: string;
    releases: string;
    followArtist: string;
    followingArtist: string;
    saveToAlbums: string;
    inAlbums: string;
    saveToPlaylists: string;
    inPlaylists: string;
    customOrder: string;
    albumOrder: string;
    sortTracksBy: string;
    sortTracks: string;
    titleAZ: string;
    withPrefix: string;
    andMore: string;
    historyDescription: string;
  };
  table: {
    trackNumber: string;
    title: string;
    album: string;
    dateAdded: string;
    popularity: string;
    year: string;
    duration: string;
  };
  player: {
    play: string;
    pause: string;
    previous: string;
    next: string;
    shuffleOn: string;
    shuffleOff: string;
    repeatOff: string;
    repeatAll: string;
    repeatOne: string;
    mute: string;
    unmute: string;
    volume: string;
    lyrics: string;
    queue: string;
    equalizer: string;
    fullscreen: string;
    exitFullscreen: string;
    like: string;
    unlike: string;
    downloadMp3: string;
    downloading: string;
    downloaded: string;
    seek: string;
    loadingAudio: string;
  };
  menu: {
    playNow: string;
    playSelection: string;
    startRadio: string;
    saveToLiked: string;
    removeFromLiked: string;
    addToPlaylist: string;
    removeFromPlaylist: string;
    createPlaylistWithTrack: string;
    createPlaylistWithSelection: string;
    downloadMp3: string;
    downloadSelection: string;
    showDownloadedFile: string;
    removeFromDownloads: string;
    pauseDownload: string;
    resumeDownload: string;
    cancelDownload: string;
    downloadQueue: string;
    viewArtist: string;
    openInBrowser: string;
    copyDetails: string;
    copied: string;
    playlistsHeader: string;
    noPlaylistsYet: string;
  };
  profile: {
    settings: string;
    equalizer: string;
    quit: string;
    otofyDesktop: string;
  };
  catalog: {
    title: string;
    subtitle: string;
    filterPlaceholder: string;
    backToHome: string;
    backToAll: string;
    playAll: string;
    shuffle: string;
    saveToLibrary: string;
    saved: string;
    genreTracks: string;
    curatingTracks: string;
    noTracksFound: string;
    playingToast: string;
    queuedToast: string;
    shufflingToast: string;
    randomOrderToast: string;
    savedToastTitle: string;
    savedToastBody: string;
    genres: Record<string, GenreTranslation>;
  };
}

export interface GenreTranslation {
  name: string;
  category: string;
  description: string;
  subgenres: string[];
}

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
}
