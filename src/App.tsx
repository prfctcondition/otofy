import React, { useEffect, useMemo, useRef } from 'react';
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

import { EqualizerModal } from './components/EqualizerModal';
import { QueueModal } from './components/QueueModal';
import { SharePlaylistModal } from './components/SharePlaylistModal';
import { ImportPlaylistModal } from './components/ImportPlaylistModal';
import { CreatePlaylistModal } from './components/CreatePlaylistModal';
import { AccountSyncModal } from './components/AccountSyncModal';
import { LyricsModal } from './components/LyricsModal';
import { LyricsPanel } from './components/LyricsPanel';
import { FullscreenLyricsModal } from './components/FullscreenLyricsModal';
import { SearchResultsOverlay } from './components/SearchResultsOverlay';
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
  const [activeQueuePlaylistId, setActiveQueuePlaylistId] = React.useState<string | null>(null);

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
    };

    initApp();
    const cleanupAudio = playerStore.initAudioListeners();
    const cleanupDl = useDownloadStore.getState().initListeners();
    const cleanupNet = useNetworkStore.getState().initNetworkListeners();
    return () => {
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

  const isCurrentPlaylistActive = useMemo(() => {
    if (!activeTrack || filteredTracks.length === 0) return false;
    return activeQueuePlaylistId === currentPlaylist.id;
  }, [activeTrack, filteredTracks, activeQueuePlaylistId, currentPlaylist.id]);

  const handleTogglePlaylistPlay = () => {
    if (isCurrentPlaylistActive) {
      playerStore.togglePlay();
    } else if (filteredTracks.length > 0) {
      setActiveQueuePlaylistId(currentPlaylist.id);
      playerStore.playTrack(filteredTracks[0], filteredTracks);
    }
  };

  const handleTogglePlaylistShuffle = () => {
    playerStore.toggleShuffle();
    if (filteredTracks.length > 0) {
      setActiveQueuePlaylistId(currentPlaylist.id);
      const randomIdx = Math.floor(Math.random() * filteredTracks.length);
      playerStore.playTrack(filteredTracks[randomIdx], filteredTracks);
    }
  };

  const handleSelectTrack = (track: Track, queue: Track[]) => {
    setActiveQueuePlaylistId(currentPlaylist.id);
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

    if (playlistId && playlists.some((p) => p.id === playlistId)) {
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

  const handleOpenStation = async (station: StationItem) => {
    libraryStore.setSelectedFilter('All');
    // Instant optimistic navigation
    libraryStore.setCustomPlaylistView(`${station.title} Radio`, [], {
      creator: 'Otofy',
      description: station.artistsSummary,
      iconName: 'radio',
      gradientFrom: '#047857',
      gradientTo: '#064E3B',
    });
    libraryStore.setIsLoadingTracks(true);
    try {
      const stationTracks = await getStationTracks(station);
      libraryStore.setCustomPlaylistView(`${station.title} Radio`, stationTracks, {
        creator: 'Otofy',
        description: station.artistsSummary,
        iconName: 'radio',
        gradientFrom: '#047857',
        gradientTo: '#064E3B',
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
          gradientFrom: '#047857',
          gradientTo: '#064E3B',
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

  const handleOpenArtistView = async (artistName: string, source?: 'YT' | 'SC') => {
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
          const details = await window.electronAPI.getArtistDetails(cleanName, source);
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
                dateAdded: new Date().toISOString(),
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
          const res = await fetch(`/api/music/artist-details?artistName=${encodeURIComponent(cleanName)}&source=${source || 'YT'}`);
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
                  dateAdded: new Date().toISOString(),
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
              dateAdded: new Date().toISOString(),
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
    const targetId = browseId || (albumTitle && artistName ? `${artistName} ${albumTitle}` : albumTitle);
    if (!targetId) return;
    const albumViewId = `album-${targetId.toLowerCase().replace(/\s+/g, '-')}`;

    // Instant optimistic navigation
    libraryStore.setCustomPlaylistView(albumTitle || 'Album', [], {
      id: albumViewId,
      type: 'Album',
      creator: artistName || 'Artist',
      iconName: 'disc',
      description: 'Loading album tracks...',
    });
    libraryStore.setIsLoadingTracks(true);

    try {
      if (window.electronAPI?.getAlbum) {
        const albumData = await window.electronAPI.getAlbum(targetId, source);
        if (albumData && albumData.tracks && albumData.tracks.length > 0) {
          const title = albumData.title || albumTitle || 'Album';
          const artist = albumData.artist || artistName || 'Unknown Artist';
          const albumArt = albumData.artworkUrl || albumData.tracks[0]?.artworkUrl;
          const albumTracks: Track[] = albumData.tracks.map((r, idx) => ({
            id: `album-${(r.source || source || 'YT').toLowerCase()}-${idx}-${r.id || r.sourceId}`,
            number: idx + 1,
            title: r.title,
            artist: r.artist || artist,
            album: title,
            duration: r.duration,
            durationSec: r.durationSec,
            dateAdded: albumData.year && !isNaN(Date.parse(albumData.year)) ? new Date(albumData.year).toISOString() : new Date().toISOString(),
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

          libraryStore.setCustomPlaylistView(title, albumTracks, {
            id: albumViewId,
            type: 'Album',
            creator: `${artist}${albumData.year ? ` • ${albumData.year}` : ''}`,
            iconName: 'disc',
            artworkUrl: albumArt || albumTracks[0]?.artworkUrl,
          });
        }
      } else {
        // Web API fallback for development outside Electron
        try {
          const res = await fetch(`/api/music/album?browseId=${encodeURIComponent(targetId)}&source=${source || 'YT'}`);
          if (res.ok) {
            const albumData = await res.json();
            if (albumData && albumData.tracks && albumData.tracks.length > 0) {
              const title = albumData.title || albumTitle || 'Album';
              const artist = albumData.artist || artistName || 'Unknown Artist';
              const albumArt = albumData.artworkUrl || albumData.tracks[0]?.artworkUrl;
              const albumTracks: Track[] = albumData.tracks.map((r: any, idx: number) => ({
                id: `album-${(r.source || source || 'YT').toLowerCase()}-${idx}-${r.id || r.sourceId}`,
                number: idx + 1,
                title: r.title,
                artist: r.artist || artist,
                album: title,
                duration: r.duration,
                durationSec: r.durationSec,
                dateAdded: albumData.year && !isNaN(Date.parse(albumData.year)) ? new Date(albumData.year).toISOString() : new Date().toISOString(),
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

              libraryStore.setCustomPlaylistView(title, albumTracks, {
                id: albumViewId,
                type: 'Album',
                creator: `${artist}${albumData.year ? ` • ${albumData.year}` : ''}`,
                iconName: 'disc',
                artworkUrl: albumArt || albumTracks[0]?.artworkUrl,
              });
            }
          }
        } catch (webErr) {
          console.warn('[App] Web API getAlbum error:', webErr);
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
            />

            {/* Center Canvas */}
            <main
              id="center-canvas"
              className="flex-1 min-w-0 h-full flex flex-col liquid-glass-panel rounded-2xl overflow-hidden relative"
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
                    />
                  </div>

                  <div className="flex-1 pb-16 relative z-10">
                    <DenseTrackTable
                      tracks={filteredTracks}
                      activeTrackId={activeTrack?.id || ''}
                      isPlaying={isPlaying}
                      isLoading={libraryStore.isLoadingTracks}
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

            {/* Lyrics Panel (open by default on the right side) */}
            {isLyricsModalOpen && (
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
                  />
                </div>
                <div className="pb-6">
                  <DenseTrackTable
                    tracks={filteredTracks}
                    activeTrackId={activeTrack?.id || ''}
                    isPlaying={isPlaying}
                    isLoading={libraryStore.isLoadingTracks}
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
        <CreatePlaylistModal isOpen={isCreatePlaylistModalOpen} onClose={libraryStore.toggleCreatePlaylistModal} />
      )}
      {isSyncModalOpen && <AccountSyncModal isOpen={isSyncModalOpen} onClose={libraryStore.toggleSyncModal} />}
      {viewportMode === 'mobile' && isLyricsModalOpen && (
        <LyricsModal isOpen={isLyricsModalOpen} onClose={libraryStore.toggleLyricsModal} />
      )}
      {isFullscreenLyrics && <FullscreenLyricsModal />}

      {/* Floating Notifications / Error Toasts */}
      <ToastContainer />
    </div>
  );
}
