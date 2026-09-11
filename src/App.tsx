import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ViewportMode, Track, Playlist, ArtistDetails, SourceType } from './types';
import { TopNavbar } from './components/TopNavbar';
import { LeftLibraryDock } from './components/LeftLibraryDock';
import { LiquidHeroHeader } from './components/LiquidHeroHeader';
import { DenseTrackTable } from './components/DenseTrackTable';
import { ArtistDiscographySection } from './components/ArtistDiscographySection';
import { DockPlayerBar } from './components/DockPlayerBar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { HomeScreen } from './components/HomeScreen';
import { GenreCatalogScreen } from './components/GenreCatalogScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { StationItem, MadeForYouItem } from './data/homeData';

import { usePlayerStore } from './store/playerStore';
import { useLibraryStore } from './store/libraryStore';
import { useSearchStore } from './store/searchStore';
import { useSettingsStore } from './store/settingsStore';
import { useDownloadStore } from './store/downloadStore';
import { useNetworkStore } from './store/networkStore';
import { useContextMenuStore } from './store/contextMenuStore';
import { useToastStore } from './store/toastStore';

import { TrackContextMenu } from './components/TrackContextMenu';
import { PlaylistContextMenu } from './components/PlaylistContextMenu';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal';
import { generateShareCode } from './services/shareCodeService';
import { EqualizerModal } from './components/EqualizerModal';
import { QueueModal } from './components/QueueModal';
import { SharePlaylistModal } from './components/SharePlaylistModal';
import { ImportPlaylistModal } from './components/ImportPlaylistModal';
import { CreatePlaylistModal } from './components/CreatePlaylistModal';
import { EditPlaylistModal } from './components/EditPlaylistModal';
import { AccountSyncModal } from './components/AccountSyncModal';
import { LyricsModal } from './components/LyricsModal';
import { LyricsPanel } from './components/LyricsPanel';
import { FullscreenLyricsModal } from './components/FullscreenLyricsModal';
import { UpdateAvailableModal } from './components/UpdateAvailableModal';
import { SearchResultsOverlay } from './components/SearchResultsOverlay';
import { BatchDownloadBanner } from './components/BatchDownloadBanner';
import { ToastContainer } from './components/ToastContainer';
import { seedDatabaseIfEmpty } from './db/seeds';
import repo from './db/repository';
import {
  getStoredDailyMixes,
  getDailyMixTracks,
  getStationTracks,
  shouldRefreshMixes,
  generateDailyMixes,
  computeMixMeta,
} from './services/dailyMixService';

export default function App() {
  const libraryStore = useLibraryStore();
  const playerStore = usePlayerStore();
  const searchStore = useSearchStore();

  const {
    playlists,
    selectedPlaylistId,
    currentPlaylistTracks,
    currentView,
    viewportMode,
    isSidebarCollapsed,
    isRightPanelOpen,
    selectedFilter,
    globalSearch,
    playlistSearch,
    isPlaylistSearchVisible,
    mobileActiveTab,
    isEqModalOpen,
    isShareModalOpen,
    isImportModalOpen,
    isCreatePlaylistModalOpen,
    isSyncModalOpen,
    isLyricsModalOpen,
    isQueueOpen,
    isFullscreenLyrics,
  } = libraryStore;

  const { activeTrack, isPlaying, isShuffle } = playerStore;
  const [activeQueuePlaylistId, setActiveQueuePlaylistId] = useState<string | null>(null);

  const [windowWidth, setWindowWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    let prevWidth = window.innerWidth;
    const handleResize = () => {
      const width = window.innerWidth;
      setWindowWidth(width);
      if (width < 1100 && prevWidth >= 1100 && libraryStore.isLyricsModalOpen) {
        libraryStore.setIsLyricsModalOpen(false);
      }
      prevWidth = width;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [libraryStore.isLyricsModalOpen]);

  const isCompactLayout = windowWidth < 1100;

  const trackMenu = useContextMenuStore((s) => s.trackMenu);
  const playlistMenu = useContextMenuStore((s) => s.playlistMenu);
  const confirmDelete = useContextMenuStore((s) => s.confirmDelete);
  const editingPlaylist = useContextMenuStore((s) => s.editingPlaylist);
  const closeTrackMenu = useContextMenuStore((s) => s.closeTrackMenu);
  const closePlaylistMenu = useContextMenuStore((s) => s.closePlaylistMenu);
  const closeConfirmDelete = useContextMenuStore((s) => s.closeConfirmDelete);
  const closeEditPlaylist = useContextMenuStore((s) => s.closeEditPlaylist);

  const mainScrollRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
    if (mobileScrollRef.current) {
      mobileScrollRef.current.scrollTop = 0;
    }
  }, [currentView, selectedPlaylistId, libraryStore.viewingPlaylist?.id, mobileActiveTab]);

  useEffect(() => {
    const initApp = async () => {
      // One-time cache reset to clear outdated playlist metadata and build fresh collections
      const cacheCleaned = await repo.getSetting('cache_cleaned_v5');
      if (!cacheCleaned) {
        await repo.clearAllPlaylistCache();
        await repo.setSetting('cache_cleaned_v5', 'true');
      }

      await seedDatabaseIfEmpty();
      await libraryStore.loadLibrary();
      await useSettingsStore.getState().initFromSystem();

      // Check / Generate 24-hour Daily Dynamic Mixes
      try {
        let mixes = await getStoredDailyMixes();
        if (mixes.length === 0 || (await shouldRefreshMixes())) {
          mixes = await generateDailyMixes();
        }
        // Mixes are refreshed/loaded without auto-selecting any track on startup
      } catch (err) {
        console.warn('[App] Daily mixes init error:', err);
      }

      // Initial scan and load of downloaded/local files
      try {
        await useDownloadStore.getState().loadDownloadedTracks();
      } catch (dlErr) {
        console.warn('[App] Initial download scan error:', dlErr);
      }
    };

    initApp();
    const cleanupAudio = playerStore.initAudioListeners();
    const cleanupDl = useDownloadStore.getState().initListeners();
    const cleanupNet = useNetworkStore.getState().initNetworkListeners();

    // Silent background check for updates on startup (modal is strictly shown only if hasUpdate is true)
    const updateTimer = setTimeout(async () => {
      try {
        if (window.electronAPI?.checkForUpdates) {
          const res = await window.electronAPI.checkForUpdates();
          if (res && res.hasUpdate) {
            useLibraryStore.getState().openUpdateModal(res);
          }
        }
      } catch {
        // Silent: no notifications or errors on cold start
      }
    }, 3000);

    return () => {
      clearTimeout(updateTimer);
      cleanupAudio?.();
      cleanupDl?.();
      cleanupNet?.();
    };
  }, []);

  const currentPlaylist = useMemo(() => {
    if (libraryStore.viewingPlaylist && libraryStore.viewingPlaylist.id === selectedPlaylistId) {
      return libraryStore.viewingPlaylist;
    }
    return (
      playlists.find((pl) => pl.id === selectedPlaylistId) ||
      libraryStore.viewingPlaylist ||
      playlists[0] ||
      ({} as Playlist)
    );
  }, [playlists, selectedPlaylistId, libraryStore.viewingPlaylist]);

  const isCurrentPlaylistInLibrary = useMemo(() => {
    return playlists.some(
      (p) =>
        p.id === currentPlaylist.id ||
        (p.title && currentPlaylist.title && p.title.toLowerCase() === currentPlaylist.title.toLowerCase())
    );
  }, [playlists, currentPlaylist]);

  const inspectionTrack = activeTrack || currentPlaylistTracks[0];

  const currentTrackIndex = useMemo(() => {
    if (!activeTrack) return -1;
    return currentPlaylistTracks.findIndex((t) => t.id === activeTrack.id);
  }, [currentPlaylistTracks, activeTrack]);

  const nextTrack = useMemo(() => {
    if (currentPlaylistTracks.length === 0 || currentTrackIndex === -1) return undefined;
    const nextIdx = (currentTrackIndex + 1) % currentPlaylistTracks.length;
    return currentPlaylistTracks[nextIdx];
  }, [currentPlaylistTracks, currentTrackIndex]);

  const filteredTracks = useMemo(() => {
    return currentPlaylistTracks.filter((track) => {
      // In-playlist search (within table header)
      if (isPlaylistSearchVisible && playlistSearch.trim()) {
        const query = playlistSearch.toLowerCase();
        const matchPlaylist =
          track.title.toLowerCase().includes(query) ||
          track.artist.toLowerCase().includes(query) ||
          track.album.toLowerCase().includes(query);
        if (!matchPlaylist) return false;
      }

      return true;
    });
  }, [currentPlaylistTracks, playlistSearch, isPlaylistSearchVisible]);

  const tracklistSortBy = useLibraryStore((s) => s.tracklistSortBy);
  const tracklistSortOrder = useLibraryStore((s) => s.tracklistSortOrder);

  const sortedTracks = useMemo(() => {
    const list = [...filteredTracks];
    list.sort((a, b) => {
      let cmp = 0;
      if (tracklistSortBy === 'title') {
        cmp = (a.title || '').localeCompare(b.title || '');
      } else if (tracklistSortBy === 'artist') {
        cmp = (a.artist || '').localeCompare(b.artist || '');
      } else if (tracklistSortBy === 'duration') {
        cmp = (a.durationSec || 0) - (b.durationSec || 0);
      } else {
        // dateAdded
        const timeA = a.dateAdded && !isNaN(Date.parse(a.dateAdded)) ? Date.parse(a.dateAdded) : 0;
        const timeB = b.dateAdded && !isNaN(Date.parse(b.dateAdded)) ? Date.parse(b.dateAdded) : 0;
        if (timeA !== timeB) {
          cmp = timeA - timeB;
        } else {
          cmp = (a.number || 0) - (b.number || 0);
        }
      }
      return tracklistSortOrder === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [filteredTracks, tracklistSortBy, tracklistSortOrder]);

  const isCurrentPlaylistActive = useMemo(() => {
    if (!activeTrack || sortedTracks.length === 0) return false;
    return activeQueuePlaylistId === currentPlaylist.id;
  }, [activeTrack, sortedTracks, activeQueuePlaylistId, currentPlaylist.id]);

  const recordCurrentEntityPlayed = () => {
    if (!currentPlaylist) return;
    if (currentPlaylist.type === 'Artist') {
      const art = libraryStore.followedArtists.find(
        (a) => a.name.toLowerCase() === currentPlaylist.title.toLowerCase() || a.id === currentPlaylist.id
      );
      if (art) {
        libraryStore.recordEntityPlayed(art.id, 'artist');
      }
    } else if (currentPlaylist.type === 'Album') {
      const cleanPlId = currentPlaylist.id.replace(/^album[-_]/i, '').trim();
      const alb = libraryStore.savedAlbums.find(
        (a) =>
          a.id === currentPlaylist.id ||
          a.id === cleanPlId ||
          (a.playlistId && a.playlistId === cleanPlId) ||
          a.title.toLowerCase() === currentPlaylist.title.toLowerCase()
      );
      if (alb) {
        libraryStore.recordEntityPlayed(alb.id, 'album');
      }
    } else {
      libraryStore.recordEntityPlayed(currentPlaylist.id, 'playlist');
    }
  };

  const handleTogglePlaylistPlay = () => {
    if (isCurrentPlaylistActive) {
      playerStore.togglePlay();
    } else if (sortedTracks.length > 0) {
      setActiveQueuePlaylistId(currentPlaylist.id);
      recordCurrentEntityPlayed();
      playerStore.playTrack(sortedTracks[0], sortedTracks);
    }
  };

  const handleTogglePlaylistShuffle = () => {
    playerStore.toggleShuffle();
    if (sortedTracks.length > 0) {
      setActiveQueuePlaylistId(currentPlaylist.id);
      recordCurrentEntityPlayed();
      const randomIdx = Math.floor(Math.random() * sortedTracks.length);
      playerStore.playTrack(sortedTracks[randomIdx], sortedTracks);
    }
  };

  const handleSelectTrack = (track: Track, queue: Track[]) => {
    setActiveQueuePlaylistId(currentPlaylist.id);
    recordCurrentEntityPlayed();
    playerStore.playTrack(track, queue);
  };

  const handleNextTrack = () => {
    playerStore.nextTrack();
  };

  const handlePreviousTrack = () => {
    playerStore.prevTrack();
  };

  const handleNavigateHome = () => {
    libraryStore.setCurrentView('home');
    libraryStore.setMobileActiveTab('home');
  };

  const handleNavigateBack = () => {
    libraryStore.setCurrentView(currentView === 'home' ? 'playlist' : 'home');
  };

  const handleSelectCollection = async (title: string, playlistId?: string) => {
    searchStore.clearResults();
    libraryStore.setSelectedFilter('All');

    if (playlistId === 'pl-history' || title.toLowerCase() === 'history') {
      await libraryStore.selectPlaylist('pl-history');
      return;
    }

    if (playlistId && (playlistId.startsWith('pl-') || playlists.some((p) => p.id === playlistId))) {
      await libraryStore.selectPlaylist(playlistId);
      return;
    }

    const mixes = await getStoredDailyMixes();
    const tLower = title.toLowerCase();
    const matchMix =
      mixes.find((m) => {
        const mTitle = m.title.toLowerCase();
        const mGenre = m.genre.toLowerCase();
        return (
          mTitle.includes(tLower) ||
          tLower.includes(mTitle) ||
          mGenre.includes(tLower) ||
          tLower.includes(mGenre)
        );
      }) ||
      (tLower.includes('phonk') ? mixes.find((m) => m.mixNumber === 1) : undefined) ||
      (tLower.includes('lo-fi') || tLower.includes('chill') ? mixes.find((m) => m.mixNumber === 2) : undefined) ||
      (tLower.includes('synth') || tLower.includes('80s') ? mixes.find((m) => m.mixNumber === 3) : undefined) ||
      (tLower.includes('cloud') || tLower.includes('underground') ? mixes.find((m) => m.mixNumber === 4) : undefined) ||
      (tLower.includes('ambient') ? mixes.find((m) => m.mixNumber === 5) : undefined) ||
      (tLower.includes('discover') ? mixes.find((m) => m.mixNumber === 0) : undefined) ||
      mixes[0];

    if (matchMix) {
      const mixTracks = await getDailyMixTracks(matchMix);
      const meta = computeMixMeta(mixTracks, matchMix.mixNumber, matchMix.genre);
      libraryStore.setCustomPlaylistView(meta.title, mixTracks, {
        creator: 'Otofy',
        description: meta.subtitle,
        iconName: 'sparkles',
      });
    } else {
      await libraryStore.selectPlaylist('pl-liked');
    }
  };

  // Spacebar Play/Pause shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable ||
            target.getAttribute('role') === 'textbox')
        ) {
          return;
        }
        e.preventDefault();
        playerStore.togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Global mouse button navigation: Mouse 4 (Back) & Mouse 5 (Forward)
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // e.button === 3 -> Mouse 4 (Back)
      if (e.button === 3) {
        e.preventDefault();
        e.stopPropagation();
        libraryStore.navigateBack();
      }
      // e.button === 4 -> Mouse 5 (Forward)
      else if (e.button === 4) {
        e.preventDefault();
        e.stopPropagation();
        libraryStore.navigateForward();
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [libraryStore.navigateBack, libraryStore.navigateForward]);

  const handleOpenStation = async (station: StationItem) => {
    libraryStore.setSelectedFilter('All');
    // Instant optimistic navigation
    libraryStore.setCustomPlaylistView(`${station.title} Radio`, [], {
      creator: 'Otofy',
      description: station.artistsSummary,
      iconName: 'radio',
      gradientFrom: '#1E293B',
      gradientTo: '#0F172A',
    });
    libraryStore.setIsLoadingTracks(true);
    try {
      const stationTracks = await getStationTracks(station);
      libraryStore.setCustomPlaylistView(`${station.title} Radio`, stationTracks, {
        creator: 'Otofy',
        description: station.artistsSummary,
        iconName: 'radio',
        gradientFrom: '#1E293B',
        gradientTo: '#0F172A',
      });
    } catch (e) {
      console.warn('[App] Open station error:', e);
    } finally {
      libraryStore.setIsLoadingTracks(false);
    }
  };

  const handlePlayStation = async (station: StationItem) => {
    libraryStore.setSelectedFilter('All');
    try {
      const stationTracks = await getStationTracks(station);
      if (stationTracks.length > 0) {
        libraryStore.setCustomPlaylistView(`${station.title} Radio`, stationTracks, {
          creator: 'Otofy',
          description: station.artistsSummary,
          iconName: 'radio',
          gradientFrom: '#1E293B',
          gradientTo: '#0F172A',
        });
        setActiveQueuePlaylistId(useLibraryStore.getState().selectedPlaylistId);
        await playerStore.playTrack(stationTracks[0], stationTracks);
      }
    } catch (e) {
      console.warn('[App] Play station error:', e);
    }
  };

  const handleOpenMix = async (mix: MadeForYouItem) => {
    libraryStore.setSelectedFilter('All');
    // Instant optimistic navigation
    libraryStore.setCustomPlaylistView(mix.title, [], {
      creator: 'Otofy',
      description: mix.subtitle,
      iconName: 'sparkles',
      gradientFrom: '#1E1B4B',
      gradientTo: '#09090B',
    });
    libraryStore.setIsLoadingTracks(true);
    try {
      const mixes = await getStoredDailyMixes();
      const targetNumber = mix.cardVariant === 'discover' ? 0 : parseInt(mix.mixNumber || '1', 10);
      const match = mixes.find((m) => m.mixNumber === targetNumber) || mixes[0];
      if (match) {
        const mixTracks = await getDailyMixTracks(match);
        const meta = computeMixMeta(mixTracks, match.mixNumber, match.genre);
        libraryStore.setCustomPlaylistView(meta.title, mixTracks, {
          creator: 'Otofy',
          description: meta.subtitle,
          iconName: 'sparkles',
          gradientFrom: '#1E1B4B',
          gradientTo: '#09090B',
        });
      }
    } catch (e) {
      console.warn('[App] Open mix error:', e);
    } finally {
      libraryStore.setIsLoadingTracks(false);
    }
  };

  const handlePlayMix = async (mix: MadeForYouItem) => {
    libraryStore.setSelectedFilter('All');
    try {
      const mixes = await getStoredDailyMixes();
      const targetNumber = mix.cardVariant === 'discover' ? 0 : parseInt(mix.mixNumber || '1', 10);
      const match = mixes.find((m) => m.mixNumber === targetNumber) || mixes[0];
      if (match) {
        const mixTracks = await getDailyMixTracks(match);
        if (mixTracks.length > 0) {
          const meta = computeMixMeta(mixTracks, match.mixNumber, match.genre);
          libraryStore.setCustomPlaylistView(meta.title, mixTracks, {
            creator: 'Otofy',
            description: meta.subtitle,
            iconName: 'sparkles',
            gradientFrom: '#1E1B4B',
            gradientTo: '#09090B',
          });
          setActiveQueuePlaylistId(useLibraryStore.getState().selectedPlaylistId);
          await playerStore.playTrack(mixTracks[0], mixTracks);
        }
      }
    } catch (e) {
      console.warn('[App] Play mix error:', e);
    }
  };

  const handlePlayCollection = async (title: string, playlistId?: string) => {
    await handleSelectCollection(title, playlistId);
    const freshTracks = useLibraryStore.getState().currentPlaylistTracks;
    const freshId = useLibraryStore.getState().selectedPlaylistId;
    if (freshTracks.length > 0) {
      setActiveQueuePlaylistId(freshId);
      await playerStore.playTrack(freshTracks[0], freshTracks);
    }
  };

  const handleOpenArtistView = async (artistName: string, source?: 'YT' | 'SC', browseId?: string) => {
    if (!artistName || artistName.trim().length === 0) return;
    const cleanName = artistName.trim();
    const artistViewId = `artist-${cleanName.toLowerCase().replace(/\s+/g, '-')}`;

    // Instant optimistic navigation
    libraryStore.setCustomPlaylistView(cleanName, [], {
      id: artistViewId,
      type: 'Artist',
      creator: cleanName,
      description: `${cleanName} Discography`,
      iconName: 'user',
    });
    libraryStore.setIsLoadingTracks(true);

    try {
      let artistTracks: Track[] = [];
      let artistSubtitle = `${cleanName} Discography`;
      let detailsResult: ArtistDetails | null = null;

      // 1. Fetch Official Artist Channel details (Top Songs + Albums) via Innertube / SoundCloud
      if (window.electronAPI?.getArtistDetails) {
        try {
          const details = await window.electronAPI.getArtistDetails(cleanName, source, browseId);
          if (details) {
            if (!details.avatarUrl && details.topTracks && details.topTracks.length > 0) {
              details.avatarUrl = details.topTracks[0].artworkUrl;
            }
            detailsResult = details;
            libraryStore.setCurrentArtistDetails(details);

            if (details.topTracks && details.topTracks.length > 0) {
              const releaseCount = (details.albums?.length || 0) + (details.singles?.length || 0);
              artistSubtitle = `${details.topTracks.length} Official Songs${details.subscribers ? ` • ${details.subscribers}` : ''}${releaseCount > 0 ? ` • ${releaseCount} Releases` : ''}`;

              const mappedTracks: Track[] = details.topTracks.map((r, idx) => ({
                id: `artist-${(r.source || source || 'YT').toLowerCase()}-${cleanName.replace(/\s+/g, '-').toLowerCase()}-${idx}-${r.id || r.sourceId}`,
                number: idx + 1,
                title: r.title,
                artist: r.artist || cleanName,
                album: r.album || `${cleanName} - Top Tracks`,
                duration: r.duration,
                durationSec: r.durationSec,
                dateAdded: r.releaseDate && !isNaN(Date.parse(r.releaseDate)) ? new Date(r.releaseDate).toISOString() : (r.releaseDate || ''),
                releaseDate: r.releaseDate,
                releaseYear: r.releaseYear,
                artistBrowseId: r.artistBrowseId || details.browseId || browseId,
                artistUrl: r.artistUrl || details.externalUrl,
                albumBrowseId: r.albumBrowseId,
                externalUrl: r.externalUrl,
                source: (r.source || source || 'YT') as SourceType,
                sourceLabel: r.sourceLabel || (r.source === 'SC' ? 'SoundCloud' : 'YouTube Music'),
                sourceId: r.sourceId,
                artworkUrl: r.artworkUrl || details.avatarUrl,
                iconName: 'user' as const,
                gradientFrom: '#4338CA',
                gradientTo: '#7C3AED',
                isLiked: false,
              }));

              artistTracks.push(...mappedTracks);
              for (const t of mappedTracks) {
                await repo.putTrack(t);
              }
            }
          }
        } catch (err) {
          console.warn('[App] getArtistDetails error:', err);
        }
      } else {
        // Web API fallback for development outside Electron
        try {
          const res = await fetch(`/api/music/artist-details?artistName=${encodeURIComponent(cleanName)}&source=${source || 'YT'}${browseId ? `&browseId=${encodeURIComponent(browseId)}` : ''}`);
          if (res.ok) {
            const details = await res.json();
            if (details) {
              if (!details.avatarUrl && details.topTracks && details.topTracks.length > 0) {
                details.avatarUrl = details.topTracks[0].artworkUrl;
              }
              detailsResult = details;
              libraryStore.setCurrentArtistDetails(details);
              if (details.topTracks && details.topTracks.length > 0) {
                const releaseCount = (details.albums?.length || 0) + (details.singles?.length || 0);
                artistSubtitle = `${details.topTracks.length} Official Songs${details.subscribers ? ` • ${details.subscribers}` : ''}${releaseCount > 0 ? ` • ${releaseCount} Releases` : ''}`;

                const mappedTracks: Track[] = details.topTracks.map((r: any, idx: number) => ({
                  id: `artist-${(r.source || source || 'YT').toLowerCase()}-${cleanName.replace(/\s+/g, '-').toLowerCase()}-${idx}-${r.id || r.sourceId}`,
                  number: idx + 1,
                  title: r.title,
                  artist: r.artist || cleanName,
                  album: r.album || `${cleanName} - Top Tracks`,
                  duration: r.duration,
                  durationSec: r.durationSec,
                  dateAdded: r.releaseDate && !isNaN(Date.parse(r.releaseDate)) ? new Date(r.releaseDate).toISOString() : (r.releaseDate || ''),
                  releaseDate: r.releaseDate,
                  releaseYear: r.releaseYear,
                  artistBrowseId: r.artistBrowseId || details.browseId || browseId,
                  artistUrl: r.artistUrl || details.externalUrl,
                  albumBrowseId: r.albumBrowseId,
                  externalUrl: r.externalUrl,
                  source: (r.source || source || 'YT') as SourceType,
                  sourceLabel: r.sourceLabel || (r.source === 'SC' ? 'SoundCloud' : 'YouTube Music'),
                  sourceId: r.sourceId,
                  artworkUrl: r.artworkUrl || details.avatarUrl,
                  iconName: 'user' as const,
                  gradientFrom: '#4338CA',
                  gradientTo: '#7C3AED',
                  isLiked: false,
                }));

                artistTracks.push(...mappedTracks);
                for (const t of mappedTracks) {
                  await repo.putTrack(t);
                }
              }
            }
          }
        } catch (webErr) {
          console.warn('[App] Web API getArtistDetails error:', webErr);
        }
      }

      // 2. Search locally in DB if needed
      if (artistTracks.length === 0) {
        try {
          const allDbTracks = await repo.getAllTracks();
          const localMatches = allDbTracks.filter((t) =>
            t.artist.toLowerCase().includes(cleanName.toLowerCase())
          );
          artistTracks.push(...localMatches);
        } catch (err) {
          console.warn('[App] Local artist search error:', err);
        }
      }

      // 3. Search online via searchMusic if needed
      if (artistTracks.length === 0) {
        try {
          let searchResults: any[] = [];
          if (window.electronAPI?.searchMusic) {
            const searchResp = await window.electronAPI.searchMusic(`${cleanName} top songs`);
            searchResults = Array.isArray(searchResp) ? searchResp : searchResp?.results || [];
          } else {
            const res = await fetch(`/api/music/search?q=${encodeURIComponent(`${cleanName} top songs`)}`);
            if (res.ok) searchResults = await res.json();
          }

          if (searchResults.length > 0) {
            const mappedOnline: Track[] = searchResults.slice(0, 25).map((r, idx) => ({
              id: `artist-${cleanName.replace(/\s+/g, '-').toLowerCase()}-${idx}-${r.id || r.sourceId}`,
              number: artistTracks.length + idx + 1,
              title: r.title,
              artist: r.artist || cleanName,
              album: r.album || `${cleanName} - Top Tracks`,
              duration: r.duration,
              durationSec: r.durationSec,
              dateAdded: r.releaseDate && !isNaN(Date.parse(r.releaseDate)) ? new Date(r.releaseDate).toISOString() : (r.releaseDate || ''),
              releaseDate: r.releaseDate,
              releaseYear: r.releaseYear,
              artistBrowseId: r.artistBrowseId || browseId,
              artistUrl: r.artistUrl,
              albumBrowseId: r.albumBrowseId,
              externalUrl: r.externalUrl,
              source: r.source,
              sourceLabel: r.sourceLabel,
              sourceId: r.sourceId,
              artworkUrl: r.artworkUrl,
              iconName: 'user' as const,
              gradientFrom: '#4338CA',
              gradientTo: '#7C3AED',
              isLiked: false,
            }));

            const existingTitles = new Set(artistTracks.map((t) => t.title.toLowerCase()));
            for (const ot of mappedOnline) {
              if (!existingTitles.has(ot.title.toLowerCase())) {
                artistTracks.push(ot);
                existingTitles.add(ot.title.toLowerCase());
                await repo.putTrack(ot);
              }
            }
          }
        } catch (err) {
          console.warn('[App] Online artist search error:', err);
        }
      }

      artistTracks = artistTracks.map((t, idx) => ({ ...t, number: idx + 1 }));

      libraryStore.setCustomPlaylistView(cleanName, artistTracks, {
        id: artistViewId,
        type: 'Artist',
        creator: artistSubtitle,
        iconName: 'user',
        gradientFrom: '#4338CA',
        gradientTo: '#6D28D9',
        artworkUrl: detailsResult?.avatarUrl || artistTracks[0]?.artworkUrl,
        externalUrl: detailsResult?.externalUrl,
      });
    } catch (e) {
      console.warn('[App] handleOpenArtistView error:', e);
    } finally {
      libraryStore.setIsLoadingTracks(false);
    }
  };

  const handleOpenAlbumView = async (
    browseId?: string,
    albumTitle?: string,
    artistName?: string,
    source?: 'YT' | 'SC'
  ) => {
    const cleanBrowseId = browseId ? browseId.replace(/^album[-_]/i, '').trim() : undefined;
    const cleanTitle = albumTitle?.trim().toLowerCase();
    const cleanArtist = artistName?.trim().toLowerCase();

    // Check if album is already saved in library
    const savedAlbum = libraryStore.savedAlbums.find((a) => {
      const savedCleanId = a.id.replace(/^album[-_]/i, '').trim();
      if (cleanBrowseId && (savedCleanId === cleanBrowseId || a.id === browseId || (a.playlistId && a.playlistId === cleanBrowseId))) {
        return true;
      }
      if (cleanTitle && a.title.toLowerCase().trim() === cleanTitle) {
        if (!cleanArtist || !a.artist) return true;
        return a.artist.toLowerCase().trim() === cleanArtist;
      }
      return false;
    });

    // Prefer browseId / playlistId, or search query. DO NOT lowercase Base64 IDs!
    const effectiveBrowseId = cleanBrowseId || (savedAlbum?.id && !savedAlbum.id.toLowerCase().startsWith('album-') ? savedAlbum.id : savedAlbum?.playlistId);
    const targetId = effectiveBrowseId || (albumTitle && artistName ? `${artistName} ${albumTitle}` : albumTitle);
    if (!targetId) return;

    // NEVER lowercase YouTube browse tokens (MPREb_ / OLAK)
    const albumViewId = effectiveBrowseId ? `album-${effectiveBrowseId}` : `album-${targetId.replace(/\s+/g, '-')}`;

    // Instant optimistic navigation: If we have savedAlbum with cached tracks snapshot, render IMMEDIATELY!
    const hasCachedTracks = Boolean(savedAlbum?.tracks && savedAlbum.tracks.length > 0);
    const initialTitle = (savedAlbum?.title && !savedAlbum.title.toLowerCase().startsWith('mpreb_') && !savedAlbum.title.toLowerCase().startsWith('album-'))
      ? savedAlbum.title
      : (albumTitle || 'Album');
    const initialArtist = savedAlbum?.artist || artistName || 'Artist';
    const initialCover = savedAlbum?.artworkUrl || (hasCachedTracks ? savedAlbum!.tracks![0]?.artworkUrl : undefined);

    if (hasCachedTracks && savedAlbum?.tracks) {
      libraryStore.setCustomPlaylistView(initialTitle, savedAlbum.tracks, {
        id: albumViewId,
        type: 'Album',
        creator: `${initialArtist}${savedAlbum.year ? ` • ${savedAlbum.year}` : ''}`,
        iconName: 'disc',
        artworkUrl: initialCover,
        playlistId: savedAlbum.playlistId,
      });
      libraryStore.setIsLoadingTracks(false);
    } else {
      libraryStore.setCustomPlaylistView(initialTitle, [], {
        id: albumViewId,
        type: 'Album',
        creator: initialArtist,
        iconName: 'disc',
        artworkUrl: initialCover,
        description: 'Loading album tracks...',
        playlistId: savedAlbum?.playlistId,
      });
      libraryStore.setIsLoadingTracks(true);
    }

    try {
      let albumData: any = null;
      if (window.electronAPI?.getAlbum) {
        albumData = await window.electronAPI.getAlbum(targetId, source);
      } else {
        // Web API fallback for development outside Electron
        try {
          const res = await fetch(`/api/music/album?browseId=${encodeURIComponent(targetId)}&source=${source || 'YT'}`);
          if (res.ok) {
            albumData = await res.json();
          }
        } catch (webErr) {
          console.warn('[App] Web API getAlbum error:', webErr);
        }
      }

      if (albumData && albumData.tracks && albumData.tracks.length > 0) {
        // Sanitize title: NEVER allow raw ID or invalid token to replace album title
        let resolvedTitle = albumData.title?.trim();
        if (
          !resolvedTitle ||
          resolvedTitle.toLowerCase() === targetId.toLowerCase() ||
          resolvedTitle.toLowerCase().startsWith('mpreb_') ||
          resolvedTitle.toLowerCase().startsWith('album-') ||
          resolvedTitle.toLowerCase().startsWith('olak')
        ) {
          resolvedTitle = initialTitle !== 'Album' ? initialTitle : (albumTitle || 'Album');
        }

        const resolvedArtist = albumData.artist || initialArtist;
        const albumArt = albumData.artworkUrl || albumData.tracks[0]?.artworkUrl || initialCover;
        const albumTracks: Track[] = albumData.tracks.map((r: any, idx: number) => ({
          id: `album-${(r.source || source || 'YT').toLowerCase()}-${idx}-${r.id || r.sourceId}`,
          number: idx + 1,
          title: r.title,
          artist: r.artist || resolvedArtist,
          album: resolvedTitle,
          duration: r.duration,
          durationSec: r.durationSec,
          dateAdded: (r.releaseDate && !isNaN(Date.parse(r.releaseDate)))
            ? new Date(r.releaseDate).toISOString()
            : (albumData.year && !isNaN(Date.parse(albumData.year)))
            ? new Date(albumData.year).toISOString()
            : (r.releaseDate || albumData.year || ''),
          releaseDate: r.releaseDate || albumData.releaseDate || (albumData.year ? String(albumData.year) : undefined),
          releaseYear: r.releaseYear || (albumData.year ? String(albumData.year).match(/\b(19|20)\d{2}\b/)?.[0] : undefined),
          artistBrowseId: r.artistBrowseId,
          artistUrl: r.artistUrl,
          albumBrowseId: cleanBrowseId || r.albumBrowseId,
          albumUrl: albumData.externalUrl,
          externalUrl: r.externalUrl,
          source: (r.source || source || 'YT') as SourceType,
          sourceLabel: r.sourceLabel || (r.source === 'SC' ? 'SoundCloud' : 'YouTube Music'),
          sourceId: r.sourceId,
          artworkUrl: r.artworkUrl || albumArt,
          iconName: 'disc',
          gradientFrom: '#3B82F6',
          gradientTo: '#1E1B4B',
          isLiked: false,
        }));

        for (const t of albumTracks) {
          await repo.putTrack(t);
        }

        libraryStore.setCustomPlaylistView(resolvedTitle, albumTracks, {
          id: albumViewId,
          type: 'Album',
          creator: `${resolvedArtist}${albumData.year ? ` • ${albumData.year}` : ''}`,
          iconName: 'disc',
          artworkUrl: albumArt || albumTracks[0]?.artworkUrl,
          playlistId: albumData.playlistId || savedAlbum?.playlistId,
          externalUrl: albumData.externalUrl,
        });

        // If album was already saved or is in savedAlbums, update its cached snapshot!
        const existingSaved = libraryStore.savedAlbums.find((a) => {
          const savedCleanId = a.id.replace(/^album[-_]/i, '').trim();
          if (cleanBrowseId && (savedCleanId === cleanBrowseId || a.id === browseId || (a.playlistId && a.playlistId === cleanBrowseId))) {
            return true;
          }
          if (resolvedTitle && a.title.toLowerCase().trim() === resolvedTitle.toLowerCase().trim()) {
            return true;
          }
          return false;
        });

        if (existingSaved) {
          const updatedAlbums = libraryStore.savedAlbums.map((a) => {
            if (a.id === existingSaved.id) {
              return {
                ...a,
                id: effectiveBrowseId || a.id,
                playlistId: albumData.playlistId || a.playlistId,
                title: resolvedTitle,
                artist: resolvedArtist,
                artworkUrl: albumArt || a.artworkUrl || '',
                year: albumData.year || a.year,
                totalTracks: albumTracks.length,
                tracks: albumTracks,
              };
            }
            return a;
          });
          await repo.setSavedAlbums(updatedAlbums);
          useLibraryStore.setState({ savedAlbums: updatedAlbums });
        }
      }
    } catch (err) {
      console.error('[App] handleOpenAlbumView error:', err);
    } finally {
      libraryStore.setIsLoadingTracks(false);
    }
  };

  return (
    <div className="relative flex flex-col h-screen w-screen overflow-hidden bg-[#E2E8F0] dark:bg-[#000000] text-[#0F172A] dark:text-white font-sans antialiased select-none">
      {/* Background Ambient Lighting (Static, 0% GPU load) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div
          className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full pointer-events-none opacity-80 dark:opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.28) 0%, rgba(56, 189, 248, 0.10) 50%, transparent 70%)',
          }}
        />
        <div
          className="absolute top-1/4 left-1/3 w-[520px] h-[500px] rounded-full pointer-events-none opacity-70 dark:opacity-15"
          style={{
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.22) 0%, rgba(129, 140, 248, 0.08) 50%, transparent 70%)',
          }}
        />
        <div
          className="absolute -bottom-28 -right-20 w-[560px] h-[560px] rounded-full pointer-events-none opacity-80 dark:opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(232, 121, 249, 0.25) 0%, rgba(192, 132, 252, 0.08) 50%, transparent 70%)',
          }}
        />
      </div>

      {/* Top Navbar */}
      <TopNavbar
        viewportMode={viewportMode}
        onToggleViewport={libraryStore.setViewportMode}
        isRightPanelOpen={isLyricsModalOpen}
        onToggleRightPanel={libraryStore.toggleLyricsModal}
        searchQuery={globalSearch}
        onSearchChange={libraryStore.setGlobalSearch}
        currentView={currentView}
        onNavigateHome={handleNavigateHome}
        onNavigateBack={libraryStore.navigateBack}
        canGoBack={libraryStore.historyIndex > 0}
        canGoForward={libraryStore.historyIndex < libraryStore.history.length - 1}
        onNavigateForward={libraryStore.navigateForward}
      />

      {/* Search Dropdown Overlay */}
      <SearchResultsOverlay
        isOpen={globalSearch.trim().length > 1 && searchStore.hasSearched}
        onClose={() => searchStore.clearResults()}
        onOpenArtist={handleOpenArtistView}
      />

      {/* Main Area */}
      <div className="relative z-10 flex-1 flex overflow-hidden p-3 gap-3">
        {viewportMode === 'desktop' ? (
          <>
            {/* Left Library Dock */}
            <LeftLibraryDock
              playlists={playlists}
              selectedPlaylistId={selectedPlaylistId}
              onSelectPlaylist={(id) => libraryStore.selectPlaylist(id)}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={libraryStore.toggleSidebar}
              onCreatePlaylist={libraryStore.toggleCreatePlaylistModal}
              onImportCode={libraryStore.toggleImportModal}
              onSelectArtist={handleOpenArtistView}
              onSelectAlbum={handleOpenAlbumView}
            />

            {/* Center Canvas */}
            <main
              id="center-canvas"
              className="flex-1 min-w-[360px] sm:min-w-[480px] h-full flex flex-col liquid-glass-panel rounded-2xl overflow-hidden relative"
            >
              <div className="pointer-events-none absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-white/[0.50] dark:from-black/40 via-white/[0.10] dark:via-black/10 to-transparent z-10" />

              {currentView === 'home' ? (
                <HomeScreen
                  onSelectCollection={handleSelectCollection}
                  onPlayCollection={handlePlayCollection}
                  onOpenStation={handleOpenStation}
                  onPlayStation={handlePlayStation}
                  onOpenMix={handleOpenMix}
                  onPlayMix={handlePlayMix}
                  onShowAll={libraryStore.openCatalog}
                />
              ) : currentView === 'catalog' ? (
                <GenreCatalogScreen
                  onBack={() => libraryStore.setCurrentView('home')}
                />
              ) : currentView === 'settings' ? (
                <SettingsScreen />
              ) : (
                <div
                  ref={mainScrollRef}
                  key={selectedPlaylistId || currentPlaylist.id}
                  className="flex-1 overflow-y-auto flex flex-col"
                >
                  <div className="relative z-30">
                    <LiquidHeroHeader
                      playlist={currentPlaylist}
                      tracks={currentPlaylistTracks}
                      isPlaying={isPlaying}
                      isPlaylistActive={isCurrentPlaylistActive}
                      onPlayToggle={handleTogglePlaylistPlay}
                      isShuffle={isShuffle}
                      onShuffleToggle={handleTogglePlaylistShuffle}
                      selectedFilter={selectedFilter}
                      onSelectFilter={libraryStore.setSelectedFilter}
                      isSearchVisible={isPlaylistSearchVisible}
                      onToggleSearch={libraryStore.togglePlaylistSearch}
                      playlistSearchQuery={playlistSearch}
                      onPlaylistSearchChange={libraryStore.setPlaylistSearch}
                      isSavedInLibrary={isCurrentPlaylistInLibrary}
                      onToggleSaveToLibrary={libraryStore.saveViewingPlaylistToLibrary}
                      onSelectArtist={handleOpenArtistView}
                    />
                  </div>

                  <div className="flex-1 pb-16 relative z-10">
                    <DenseTrackTable
                      tracks={sortedTracks}
                      activeTrackId={activeTrack?.id || ''}
                      isPlaying={isPlaying}
                      isLoading={libraryStore.isLoadingTracks}
                      hideTrackNumber={currentPlaylist.type === 'Artist'}
                      onTrackSelect={handleSelectTrack}
                      onPlayToggle={playerStore.togglePlay}
                      onToggleLike={libraryStore.toggleLike}
                      onSelectArtist={handleOpenArtistView}
                      onSelectAlbum={handleOpenAlbumView}
                    />

                    {/* Artist Discography, Singles, and Related Artists */}
                    {currentPlaylist.type === 'Artist' && libraryStore.currentArtistDetails && (
                      <ArtistDiscographySection
                        details={libraryStore.currentArtistDetails}
                        onSelectAlbum={handleOpenAlbumView}
                        onSelectArtist={handleOpenArtistView}
                      />
                    )}
                  </div>
                </div>
              )}
            </main>

            {/* Lyrics Panel: inline sidebar when >= 1100px */}
            {isLyricsModalOpen && !isCompactLayout && (
              <LyricsPanel onClose={libraryStore.toggleLyricsModal} />
            )}
          </>
        ) : (
          /* Mobile Viewport */
          <div className="w-full max-w-md mx-auto h-full flex flex-col liquid-glass-panel rounded-3xl overflow-hidden shadow-2xl relative">
            {currentView === 'catalog' ? (
              <GenreCatalogScreen
                onBack={() => libraryStore.setCurrentView('home')}
              />
            ) : currentView === 'settings' ? (
              <SettingsScreen />
            ) : mobileActiveTab === 'home' ? (
              <HomeScreen
                onSelectCollection={handleSelectCollection}
                onPlayCollection={handlePlayCollection}
                onOpenStation={handleOpenStation}
                onPlayStation={handlePlayStation}
                onOpenMix={handleOpenMix}
                onPlayMix={handlePlayMix}
                onShowAll={libraryStore.openCatalog}
              />
            ) : (
              <div
                ref={mobileScrollRef}
                key={selectedPlaylistId || currentPlaylist.id}
                className="flex-1 overflow-y-auto"
              >
                <div className="relative z-30">
                  <LiquidHeroHeader
                    playlist={currentPlaylist}
                    tracks={currentPlaylistTracks}
                    isPlaying={isPlaying}
                    isPlaylistActive={isCurrentPlaylistActive}
                    onPlayToggle={handleTogglePlaylistPlay}
                    isShuffle={isShuffle}
                    onShuffleToggle={handleTogglePlaylistShuffle}
                    selectedFilter={selectedFilter}
                    onSelectFilter={libraryStore.setSelectedFilter}
                    isSearchVisible={isPlaylistSearchVisible}
                    onToggleSearch={libraryStore.togglePlaylistSearch}
                    playlistSearchQuery={playlistSearch}
                    onPlaylistSearchChange={libraryStore.setPlaylistSearch}
                    isSavedInLibrary={isCurrentPlaylistInLibrary}
                    onToggleSaveToLibrary={libraryStore.saveViewingPlaylistToLibrary}
                    onSelectArtist={handleOpenArtistView}
                  />
                </div>
                <div className="pb-6">
                  <DenseTrackTable
                    tracks={sortedTracks}
                    activeTrackId={activeTrack?.id || ''}
                    isPlaying={isPlaying}
                    isLoading={libraryStore.isLoadingTracks}
                    hideTrackNumber={currentPlaylist.type === 'Artist'}
                    onTrackSelect={handleSelectTrack}
                    onPlayToggle={playerStore.togglePlay}
                    onToggleLike={libraryStore.toggleLike}
                    onSelectArtist={handleOpenArtistView}
                    onSelectAlbum={handleOpenAlbumView}
                  />

                  {currentPlaylist.type === 'Artist' && libraryStore.currentArtistDetails && (
                    <ArtistDiscographySection
                      details={libraryStore.currentArtistDetails}
                      onSelectAlbum={handleOpenAlbumView}
                      onSelectArtist={handleOpenArtistView}
                    />
                  )}
                </div>
              </div>
            )}

            <MobileBottomNav
              currentTrack={activeTrack || ({} as Track)}
              isPlaying={isPlaying}
              onPlayToggle={playerStore.togglePlay}
              onToggleLike={() => activeTrack && libraryStore.toggleLike(activeTrack.id, activeTrack)}
              activeTab={mobileActiveTab}
              onSelectTab={(tab) => {
                libraryStore.setMobileActiveTab(tab);
                if (tab === 'home') libraryStore.setCurrentView('home');
                else if (tab === 'library') libraryStore.setCurrentView('playlist');
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom Floating Player Bar */}
      {viewportMode === 'desktop' && (
        <div className="relative z-20 px-3 pb-3">
          <DockPlayerBar onSelectArtist={handleOpenArtistView} />
        </div>
      )}

      {/* Modals (conditionally mounted for maximum performance) */}
      {isEqModalOpen && <EqualizerModal isOpen={isEqModalOpen} onClose={libraryStore.toggleEqModal} />}
      {isQueueOpen && <QueueModal isOpen={isQueueOpen} onClose={libraryStore.toggleQueue} />}
      {isShareModalOpen && (
        <SharePlaylistModal
          isOpen={isShareModalOpen}
          onClose={libraryStore.toggleShareModal}
          playlistTitle={currentPlaylist?.title || 'Playlist'}
          playlistCreator={currentPlaylist?.creator || 'You'}
          tracks={filteredTracks}
        />
      )}
      {isImportModalOpen && <ImportPlaylistModal isOpen={isImportModalOpen} onClose={libraryStore.toggleImportModal} />}
      {isCreatePlaylistModalOpen && (
        <CreatePlaylistModal isOpen={isCreatePlaylistModalOpen} onClose={libraryStore.closeCreatePlaylistModal} />
      )}
      {editingPlaylist && (
        <EditPlaylistModal
          playlist={editingPlaylist}
          isOpen={Boolean(editingPlaylist)}
          onClose={closeEditPlaylist}
        />
      )}
      {isSyncModalOpen && <AccountSyncModal isOpen={isSyncModalOpen} onClose={libraryStore.toggleSyncModal} />}
      {viewportMode === 'mobile' && isLyricsModalOpen && (
        <LyricsModal isOpen={isLyricsModalOpen} onClose={libraryStore.toggleLyricsModal} />
      )}
      {isFullscreenLyrics && <FullscreenLyricsModal />}
      {libraryStore.isUpdateModalOpen && libraryStore.updateInfo && (
        <UpdateAvailableModal
          isOpen={libraryStore.isUpdateModalOpen}
          updateInfo={libraryStore.updateInfo}
          onClose={libraryStore.closeUpdateModal}
        />
      )}

      {/* Batch Download Floating Banner */}
      <BatchDownloadBanner />

      {/* Global Track Context Menu */}
      {trackMenu && (
        <TrackContextMenu
          track={trackMenu.track}
          selectedTracks={trackMenu.selectedTracks}
          x={trackMenu.x}
          y={trackMenu.y}
          playlists={playlists}
          currentPlaylistId={trackMenu.currentPlaylistId || selectedPlaylistId}
          onClose={closeTrackMenu}
          onPlay={(t) => {
            const queue =
              trackMenu.selectedTracks && trackMenu.selectedTracks.length > 1
                ? trackMenu.selectedTracks
                : filteredTracks.length > 0
                ? filteredTracks
                : [t];
            handleSelectTrack(t, queue);
          }}
          onAddToPlaylist={(plId, t) => libraryStore.addTrackToPlaylist(plId, t)}
          onRemoveFromPlaylist={(plId, trkId) => libraryStore.removeTrackFromPlaylist(plId, trkId)}
          onCreatePlaylistWithTrack={(t) => {
            const tracksToSave =
              trackMenu.selectedTracks && trackMenu.selectedTracks.length > 1
                ? trackMenu.selectedTracks
                : [t];
            const title =
              trackMenu.selectedTracks && trackMenu.selectedTracks.length > 1
                ? `${t.title} & more`
                : t.title;
            libraryStore.createPlaylistFromTracks(title, tracksToSave);
          }}
          onToggleLike={(id, t) => libraryStore.toggleLike(id, t)}
          onSelectArtist={(a) => handleOpenArtistView(a)}
        />
      )}

      {/* Global Playlist Context Menu */}
      {playlistMenu && (
        <PlaylistContextMenu
          playlist={playlistMenu.playlist}
          x={playlistMenu.x}
          y={playlistMenu.y}
          onClose={closePlaylistMenu}
          onPinToggle={(pl) => libraryStore.togglePinPlaylist(pl.id)}
          onShare={async (pl) => {
            try {
              const trks = await repo.getPlaylistTracks(pl.id);
              const code = generateShareCode(pl.title, pl.creator, trks);
              await navigator.clipboard.writeText(code);
              useToastStore.getState().success('Share Code Copied', `Code for "${pl.title}" copied to clipboard.`);
            } catch {
              useToastStore.getState().error('Share Failed', 'Could not generate share code.');
            }
          }}
          onDelete={(pl) => {
            useContextMenuStore.getState().openConfirmDelete(pl, async () => {
              await libraryStore.deletePlaylist(pl.id);
              if (selectedPlaylistId === pl.id) {
                await libraryStore.selectPlaylist('pl-liked');
              }
              useToastStore.getState().info('Playlist Deleted', `"${pl.title}" has been deleted.`);
            });
          }}
        />
      )}

      {/* Custom Liquid Glass Delete Confirmation Modal */}
      {confirmDelete && (
        <ConfirmDeleteModal
          isOpen={Boolean(confirmDelete)}
          playlist={confirmDelete.playlist}
          onConfirm={async () => {
            if (confirmDelete.onConfirm) {
              await confirmDelete.onConfirm();
            }
            closeConfirmDelete();
          }}
          onCancel={closeConfirmDelete}
        />
      )}

      {/* Floating Notifications / Error Toasts */}
      <ToastContainer />
    </div>
  );
}
