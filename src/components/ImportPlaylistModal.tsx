import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  X,
  AlertCircle,
  CheckCircle2,
  Music,
  Share2,
  Youtube,
  Cloud,
  Loader2,
  Sparkles,
  HelpCircle,
  ExternalLink,
  FolderArchive,
  FileUp,
} from 'lucide-react';
import { parseShareCode } from '../services/shareCodeService';
import { parseOtofyBackupFile, importOtofyBackup, type OtofyBackupData } from '../services/backupService';
import { useLibraryStore } from '../store/libraryStore';
import { useToastStore } from '../store/toastStore';
import { filterUniqueTracks } from '../utils/trackUtils';
import type { Track, ShareCodeData } from '../types';

interface ImportPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportSourceTab = 'oto' | 'spotify' | 'yt' | 'sc' | 'otofy';

interface RemotePlaylistPreview {
  title: string;
  author?: string;
  artworkUrl?: string;
  tracks: Track[];
}

interface SpotifyInspectionData {
  id: string;
  title: string;
  creator: string;
  artworkUrl?: string;
  trackCount: number;
  tracks: Array<{
    title: string;
    artist: string;
    durationMs: number;
    durationSec: number;
    previewUrl?: string;
    uri?: string;
  }>;
}

export const ImportPlaylistModal: React.FC<ImportPlaylistModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<ImportSourceTab>('spotify');
  const [inputValue, setInputValue] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [directImportProgress, setDirectImportProgress] = useState<{
    current: number;
    total: number;
    currentTrackTitle: string;
  }>({
    current: 0,
    total: 0,
    currentTrackTitle: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Tab-specific parsed preview data
  const [otofyData, setOtofyData] = useState<ShareCodeData | null>(null);
  const [remoteData, setRemoteData] = useState<RemotePlaylistPreview | null>(null);
  const [spotifyData, setSpotifyData] = useState<SpotifyInspectionData | null>(null);
  const [otoData, setOtoData] = useState<OtofyBackupData | null>(null);
  const [otoFileName, setOtoFileName] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [otoProgress, setOtoProgress] = useState<{ message: string; percent: number }>({
    message: '',
    percent: 0,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Spotify Matching Engine Progress
  const [isMatching, setIsMatching] = useState(false);
  const [matchProgress, setMatchProgress] = useState<{
    current: number;
    total: number;
    matched: number;
    unresolved: number;
    currentTrackTitle: string;
  }>({
    current: 0,
    total: 0,
    matched: 0,
    unresolved: 0,
    currentTrackTitle: '',
  });

  const createPlaylist = useLibraryStore((state) => state.createPlaylist);
  const addTrackToPlaylist = useLibraryStore((state) => state.addTrackToPlaylist);
  const selectPlaylist = useLibraryStore((state) => state.selectPlaylist);
  const initialTab = useLibraryStore((state) => state.importModalInitialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Reset inputs when switching tabs
  const handleTabChange = (tab: ImportSourceTab) => {
    setActiveTab(tab);
    setInputValue('');
    setError('');
    setSuccess(false);
    setOtofyData(null);
    setRemoteData(null);
    setSpotifyData(null);
    setOtoData(null);
    setOtoFileName('');
    setIsDragOver(false);
    setOtoProgress({ message: '', percent: 0 });
    setIsMatching(false);
    setIsImporting(false);
    setDirectImportProgress({ current: 0, total: 0, currentTrackTitle: '' });
  };

  const handleClose = () => {
    setInputValue('');
    setError('');
    setSuccess(false);
    setOtofyData(null);
    setRemoteData(null);
    setSpotifyData(null);
    setOtoData(null);
    setOtoFileName('');
    setIsDragOver(false);
    setOtoProgress({ message: '', percent: 0 });
    setIsMatching(false);
    setIsImporting(false);
    setDirectImportProgress({ current: 0, total: 0, currentTrackTitle: '' });
    onClose();
  };

  const processOtoContent = (text: string, filename: string) => {
    try {
      const parsed = parseOtofyBackupFile(text);
      setOtoData(parsed);
      setOtoFileName(filename);
      setError('');
    } catch (err: any) {
      setOtoData(null);
      setOtoFileName('');
      setError(err.message || 'Invalid .oto export file.');
    }
  };

  const handleSelectOtoFile = async () => {
    setError('');
    if (window.electronAPI?.openBackupFile) {
      try {
        const res = await window.electronAPI.openBackupFile();
        if (res && res.content) {
          processOtoContent(res.content, res.filename);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to open .oto file.');
      }
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processOtoContent(text, file.name);
    };
    reader.onerror = () => {
      setError('Failed to read file from disk.');
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleDropOtoFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processOtoContent(text, file.name);
    };
    reader.onerror = () => {
      setError('Failed to read dropped file.');
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleImportOto = async () => {
    if (!otoData) return;
    setIsImporting(true);
    setError('');
    try {
      const summary = await importOtofyBackup(otoData, (p) => {
        setOtoProgress(p);
      });
      setSuccess(true);
      setSuccessMessage(
        `Restored ${summary.playlistsCount} playlists and ${summary.likedTracksCount} liked tracks!`
      );
      useToastStore.getState().success(
        'Otofy Import Complete',
        `Restored ${summary.playlistsCount} playlists and ${summary.likedTracksCount} liked tracks`
      );
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      console.error('Failed to import .oto file:', err);
      setError(err.message || 'Failed to import .oto file.');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  // Inspect source link or code
  const handleInspect = async () => {
    setError('');
    setSuccess(false);
    setOtofyData(null);
    setRemoteData(null);
    setSpotifyData(null);

    const clean = inputValue.trim();
    if (!clean) {
      setError(
        activeTab === 'otofy'
          ? 'Please enter an Otofy share code (e.g. OTO-xxxx-xxxx).'
          : 'Please enter a valid playlist URL.'
      );
      return;
    }

    setIsInspecting(true);

    try {
      if (activeTab === 'otofy') {
        const data = parseShareCode(clean);
        if (data && data.title && Array.isArray(data.tracks) && data.tracks.length > 0) {
          setOtofyData(data);
        } else {
          setError('Invalid or corrupted Otofy share code.');
        }
      } else if (activeTab === 'yt') {
        let res: any = null;
        if (window.electronAPI?.importRemotePlaylist) {
          res = await window.electronAPI.importRemotePlaylist('YT', clean);
        } else {
          const f = await fetch(`/api/music/import-remote?source=YT&url=${encodeURIComponent(clean)}`);
          if (!f.ok) {
            const ej = await f.json().catch(() => ({}));
            throw new Error(ej.error || 'Failed to inspect YouTube Music playlist.');
          }
          res = await f.json();
        }

        if (res.error || !res.tracks || res.tracks.length === 0) {
          throw new Error(res.error || 'No tracks found in YouTube Music playlist.');
        }
        setRemoteData({
          title: res.title || 'YouTube Music Playlist',
          author: res.author || 'YouTube Music',
          artworkUrl: res.artworkUrl,
          tracks: res.tracks,
        });
      } else if (activeTab === 'sc') {
        let res: any = null;
        if (window.electronAPI?.importRemotePlaylist) {
          res = await window.electronAPI.importRemotePlaylist('SC', clean);
        } else {
          const f = await fetch(`/api/music/import-remote?source=SC&url=${encodeURIComponent(clean)}`);
          if (!f.ok) {
            const ej = await f.json().catch(() => ({}));
            throw new Error(ej.error || 'Failed to inspect SoundCloud playlist.');
          }
          res = await f.json();
        }

        if (res.error || !res.tracks || res.tracks.length === 0) {
          throw new Error(res.error || 'No tracks found in SoundCloud playlist/set.');
        }
        setRemoteData({
          title: res.title || 'SoundCloud Playlist',
          author: res.author || 'SoundCloud',
          artworkUrl: res.artworkUrl,
          tracks: res.tracks,
        });
      } else if (activeTab === 'spotify') {
        let spDetails: any = null;
        if (window.electronAPI?.inspectSpotifyPlaylist) {
          spDetails = await window.electronAPI.inspectSpotifyPlaylist(clean);
        } else {
          const f = await fetch(`/api/spotify/inspect?url=${encodeURIComponent(clean)}`);
          if (!f.ok) {
            const ej = await f.json().catch(() => ({}));
            throw new Error(ej.error || 'Failed to inspect Spotify playlist.');
          }
          spDetails = await f.json();
        }

        if (!spDetails || !spDetails.tracks || spDetails.tracks.length === 0) {
          throw new Error('Spotify playlist contains no playable tracks or is private.');
        }
        setSpotifyData(spDetails);
      }
    } catch (err: any) {
      console.error('[ImportModal] Inspection error:', err);
      setError(err?.message || 'Failed to inspect playlist. Please verify the link.');
    } finally {
      setIsInspecting(false);
    }
  };

  // Import for Otofy Code, YouTube Music, or SoundCloud
  const handleDirectImport = async () => {
    setIsImporting(true);
    setError('');

    try {
      if (activeTab === 'otofy' && otofyData) {
        const uniqueOtofyTracks = filterUniqueTracks(otofyData.tracks);
        const total = uniqueOtofyTracks.length;
        setDirectImportProgress({ current: 0, total, currentTrackTitle: 'Creating playlist...' });

        const newPl = await createPlaylist({
          title: otofyData.title,
          creator: otofyData.creator || 'Otofy User',
          artworkUrl: otofyData.artworkUrl,
          gradientFrom: '#1E293B',
          gradientTo: '#142347',
          iconName: 'disc',
        });

        for (let i = 0; i < total; i++) {
          const item = uniqueOtofyTracks[i];
          setDirectImportProgress({
            current: i + 1,
            total,
            currentTrackTitle: `${item.artist} - ${item.title}`,
          });

          const durSec = item.durationSec || 180;
          const mins = Math.floor(durSec / 60);
          const secs = Math.floor(durSec % 60);
          const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;

          const track: Track = {
            id: `imp-${Date.now()}-${i}-${item.sourceId || Math.random().toString(36).slice(2, 7)}`,
            number: i + 1,
            title: item.title,
            artist: item.artist,
            album: otofyData.title,
            duration: durationStr,
            durationSec: durSec,
            dateAdded: new Date().toISOString(),
            source: item.source,
            sourceLabel: item.source === 'YT' ? 'YouTube Music' : 'SoundCloud',
            sourceId: item.sourceId,
            iconName: 'music',
            gradientFrom: '#1E293B',
            gradientTo: '#142347',
            isLiked: false,
            artworkUrl:
              item.source === 'YT' && item.sourceId
                ? `https://i.ytimg.com/vi/${item.sourceId}/hqdefault.jpg`
                : undefined,
          };
          await addTrackToPlaylist(newPl.id, track);
        }

        setSuccess(true);
        setSuccessMessage(`Imported ${total} tracks successfully!`);
        await selectPlaylist(newPl.id);
        setTimeout(handleClose, 1200);
      } else if ((activeTab === 'yt' || activeTab === 'sc') && remoteData) {
        const uniqueRemoteTracks = filterUniqueTracks<Track>(remoteData.tracks);
        const total = uniqueRemoteTracks.length;
        setDirectImportProgress({ current: 0, total, currentTrackTitle: 'Creating playlist...' });

        const newPl = await createPlaylist({
          title: remoteData.title,
          creator: remoteData.author || (activeTab === 'yt' ? 'YouTube Music' : 'SoundCloud'),
          artworkUrl: remoteData.artworkUrl,
          gradientFrom: activeTab === 'yt' ? '#DC2626' : '#EA580C',
          gradientTo: '#142347',
          iconName: activeTab === 'yt' ? 'music' : 'waves',
        });

        for (let i = 0; i < total; i++) {
          const t = uniqueRemoteTracks[i];
          setDirectImportProgress({
            current: i + 1,
            total,
            currentTrackTitle: `${t.artist} - ${t.title}`,
          });

          const track: Track = {
            ...t,
            id: t.id || `imp-${Date.now()}-${i}`,
            number: i + 1,
            album: remoteData.title,
            dateAdded: new Date().toISOString(),
            iconName: 'music',
            gradientFrom: '#1E293B',
            gradientTo: '#142347',
            artworkUrl: t.artworkUrl || remoteData.artworkUrl,
          };
          await addTrackToPlaylist(newPl.id, track);
        }

        setSuccess(true);
        setSuccessMessage(`Imported ${total} tracks successfully!`);
        await selectPlaylist(newPl.id);
        setTimeout(handleClose, 1200);
      }
    } catch (err: any) {
      console.error('[ImportModal] Import error:', err);
      setError('An error occurred during import.');
    } finally {
      setIsImporting(false);
    }
  };

  // Spotify Matching Engine & Import
  const handleSpotifyMatchAndImport = async () => {
    if (!spotifyData) return;

    setIsMatching(true);
    setError('');
    setMatchProgress({
      current: 0,
      total: spotifyData.tracks.length,
      matched: 0,
      unresolved: 0,
      currentTrackTitle: 'Initializing YouTube Music matcher...',
    });

    let unsubscribe: (() => void) | undefined;
    if (window.electronAPI?.onSpotifyImportProgress) {
      unsubscribe = window.electronAPI.onSpotifyImportProgress((prog) => {
        setMatchProgress(prog);
      });
    }

    try {
      let matchedTracks: any[] = [];
      if (window.electronAPI?.importAndMatchSpotify) {
        matchedTracks = await window.electronAPI.importAndMatchSpotify({
          tracks: spotifyData.tracks,
          playlistTitle: spotifyData.title,
        });
      } else {
        const res = await fetch('/api/spotify/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tracks: spotifyData.tracks,
            playlistTitle: spotifyData.title,
          }),
        });
        if (!res.ok) {
          const ej = await res.json().catch(() => ({}));
          throw new Error(ej.error || 'Failed to match Spotify tracks.');
        }
        matchedTracks = await res.json();
      }

      // Create new playlist in user library
      const newPl = await createPlaylist({
        title: spotifyData.title,
        creator: spotifyData.creator || 'Spotify',
        artworkUrl: spotifyData.artworkUrl,
        gradientFrom: '#059669',
        gradientTo: '#064E3B',
        iconName: 'sparkles',
      });

      const uniqueMatched = filterUniqueTracks(matchedTracks);

      // Add matched tracks into playlist
      for (const track of uniqueMatched) {
        await addTrackToPlaylist(newPl.id, track);
      }

      setSuccess(true);
      const unresolvedCount = uniqueMatched.filter((t) => t.unresolved).length;
      const matchedCount = uniqueMatched.length - unresolvedCount;

      setSuccessMessage(
        `Imported ${uniqueMatched.length} tracks (${matchedCount} matched, ${unresolvedCount} need review)`
      );

      if (unresolvedCount > 0) {
        useToastStore
          .getState()
          .info(
            'Unresolved Tracks',
            `${unresolvedCount} track(s) have potential duration differences. Click the amber "Match?" badge in the playlist to review.`
          );
      } else {
        useToastStore
          .getState()
          .success('Spotify Import Complete', `All ${matchedTracks.length} tracks matched and saved.`);
      }

      await selectPlaylist(newPl.id);
      setTimeout(handleClose, 1400);
    } catch (err: any) {
      console.error('[ImportModal] Spotify match error:', err);
      setError(err?.message || 'Failed to match Spotify tracks on YouTube Music.');
      setIsMatching(false);
    } finally {
      if (unsubscribe) unsubscribe();
    }
  };

  const progressPercent =
    matchProgress.total > 0 ? Math.round((matchProgress.current / matchProgress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/95 dark:bg-[#0C0C10] backdrop-blur-3xl border border-white/80 dark:border-white/10 rounded-3xl w-full max-w-2xl flex flex-col p-6 m-4 relative shadow-[0_25px_60px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#142347] dark:bg-white text-white dark:text-black rounded-2xl shadow-md">
              <Download size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#142347] dark:text-white leading-tight">Otofy Import</h2>
              <p className="text-xs text-[#64748B] dark:text-white/60">
                Import playlists from Spotify, YouTube Music, SoundCloud, .oto exports & share codes
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-[#64748B] dark:text-white/70 hover:text-[#142347] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-100/90 dark:bg-white/[0.06] rounded-2xl mb-5 border border-slate-200/80 dark:border-white/10">
          <button
            onClick={() => handleTabChange('spotify')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'spotify'
                ? 'bg-white dark:bg-white/20 text-[#142347] dark:text-white shadow-xs'
                : 'text-[#64748B] dark:text-white/60 hover:text-[#142347] dark:hover:text-white'
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-[#1DB954] shrink-0"
            >
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.495 17.306c-.215.352-.674.463-1.026.248-2.809-1.716-6.345-2.104-10.509-1.153-.403.092-.806-.16-.898-.562-.092-.403.16-.806.562-.898 4.542-1.038 8.448-.597 11.623 1.34.352.214.463.673.248 1.025zm1.467-3.262c-.27.441-.851.58-1.292.31-3.216-1.977-8.118-2.548-11.922-1.393-.497.151-1.026-.135-1.177-.633-.151-.497.135-1.026.633-1.177 4.348-1.32 9.755-.682 13.448 1.59.441.27.58.851.31 1.303zm.126-3.41c-3.856-2.29-10.217-2.502-13.882-1.39-.59.18-1.222-.16-1.402-.751-.18-.59.16-1.222.751-1.402 4.217-1.28 11.238-1.033 15.68 1.604.532.316.707 1.004.391 1.536-.316.533-1.004.708-1.538.403z" />
            </svg>
            <span>Spotify</span>
          </button>

          <button
            onClick={() => handleTabChange('yt')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'yt'
                ? 'bg-white dark:bg-white/20 text-[#142347] dark:text-white shadow-xs'
                : 'text-[#64748B] dark:text-white/60 hover:text-[#142347] dark:hover:text-white'
            }`}
          >
            <Youtube size={14} className="text-rose-500 shrink-0" />
            <span>YT Music</span>
          </button>

          <button
            onClick={() => handleTabChange('sc')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'sc'
                ? 'bg-white dark:bg-white/20 text-[#142347] dark:text-white shadow-xs'
                : 'text-[#64748B] dark:text-white/60 hover:text-[#142347] dark:hover:text-white'
            }`}
          >
            <Cloud size={14} className="text-amber-500 shrink-0" />
            <span>SoundCloud</span>
          </button>

          <button
            onClick={() => handleTabChange('oto')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'oto'
                ? 'bg-white dark:bg-white/20 text-[#142347] dark:text-white shadow-xs'
                : 'text-[#64748B] dark:text-white/60 hover:text-[#142347] dark:hover:text-white'
            }`}
          >
            <FolderArchive size={14} className="text-[#142347] dark:text-white shrink-0" />
            <span>.oto Export</span>
          </button>

          <button
            onClick={() => handleTabChange('otofy')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'otofy'
                ? 'bg-white dark:bg-white/20 text-[#142347] dark:text-white shadow-xs'
                : 'text-[#64748B] dark:text-white/60 hover:text-[#142347] dark:hover:text-white'
            }`}
          >
            <Share2 size={14} className="text-slate-500 shrink-0" />
            <span>Share Code</span>
          </button>
        </div>

        <div className="space-y-4">
          {activeTab === 'oto' ? (
            <div className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                accept=".oto,.json"
                className="hidden"
                onChange={handleFileInputChange}
              />

              {!otoData ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDropOtoFile}
                  onClick={handleSelectOtoFile}
                  className={`p-8 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                    isDragOver
                      ? 'border-[#142347] dark:border-white bg-[#142347]/5 dark:bg-white/10 scale-[1.01]'
                      : 'border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-white/[0.04] hover:border-[#142347]/40 dark:hover:border-white/30 hover:bg-slate-100/70 dark:hover:bg-white/[0.07]'
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#142347]/10 dark:bg-white/10 text-[#142347] dark:text-white flex items-center justify-center mb-3">
                    <FolderArchive size={28} />
                  </div>
                  <h3 className="text-sm font-bold text-[#142347] dark:text-white mb-1">
                    Choose or Drop .oto File
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-white/60 max-w-sm mb-4 leading-relaxed">
                    Select your exported Otofy file (.oto) to import all playlists and liked tracks in one click.
                  </p>
                  <button
                    type="button"
                    className="px-4 py-2 bg-[#142347] dark:bg-white dark:text-black hover:bg-[#101b38] dark:hover:bg-white/90 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    Browse .oto File
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-[#142347] dark:bg-white text-white dark:text-black shrink-0">
                        <FolderArchive size={20} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-[#142347] dark:text-white truncate">
                          {otoFileName || 'Otofy-Export.oto'}
                        </h4>
                        <p className="text-[11px] text-[#64748B] dark:text-white/60">
                          Exported: {new Date(otoData.exportedAt).toLocaleDateString()} • v{otoData.appVersion}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOtoData(null);
                        setOtoFileName('');
                      }}
                      disabled={isImporting}
                      className="text-xs text-[#64748B] dark:text-white/60 hover:text-rose-500 transition-colors cursor-pointer"
                    >
                      Change file
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 text-center">
                      <span className="block text-base font-black text-[#142347] dark:text-white">
                        {otoData.stats.playlistsCount}
                      </span>
                      <span className="text-[10px] text-[#64748B] dark:text-white/60 uppercase tracking-wider font-semibold">
                        Playlists
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 text-center">
                      <span className="block text-base font-black text-[#142347] dark:text-white">
                        {otoData.stats.likedTracksCount}
                      </span>
                      <span className="text-[10px] text-[#64748B] dark:text-white/60 uppercase tracking-wider font-semibold">
                        Liked Tracks
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 text-center">
                      <span className="block text-base font-black text-[#142347] dark:text-white">
                        {otoData.stats.totalTracksCount}
                      </span>
                      <span className="text-[10px] text-[#64748B] dark:text-white/60 uppercase tracking-wider font-semibold">
                        Total Tracks
                      </span>
                    </div>
                  </div>

                  {otoData.playlists.length > 0 && (
                    <div className="pt-1">
                      <p className="text-[11px] font-semibold text-[#64748B] dark:text-white/60 uppercase tracking-wider mb-1 px-1">
                        Playlists included:
                      </p>
                      <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                        {otoData.playlists.map((pl, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-white/60 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5"
                          >
                            <span className="font-semibold text-[#142347] dark:text-white truncate max-w-[280px]">
                              {pl.title}
                            </span>
                            <span className="text-[10px] text-[#64748B] dark:text-white/60 shrink-0 font-mono">
                              {pl.tracks.length} tracks
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isImporting && (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-[#142347] dark:text-white">
                        <span className="truncate">{otoProgress.message || 'Restoring library...'}</span>
                        <span className="font-mono text-xs">{otoProgress.percent}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#142347] dark:bg-white rounded-full transition-all duration-150"
                          style={{ width: `${otoProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {!isImporting && (
                    <button
                      type="button"
                      onClick={handleImportOto}
                      className="w-full py-3 bg-[#142347] hover:bg-[#101b38] dark:bg-white dark:text-black dark:hover:bg-white/90 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2 mt-2"
                    >
                      <CheckCircle2 size={16} />
                      <span>Restore Library (1-Click)</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-[#64748B] dark:text-white/60 uppercase tracking-wider mb-1.5 ml-1">
                {activeTab === 'spotify'
                  ? 'Spotify Playlist Link'
                  : activeTab === 'yt'
                  ? 'YouTube / YouTube Music Link'
                  : activeTab === 'sc'
                  ? 'SoundCloud Playlist / Set Link'
                  : 'Otofy Share Code'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInspect()}
                  disabled={isMatching || isImporting}
                  placeholder={
                    activeTab === 'spotify'
                      ? 'https://open.spotify.com/playlist/...'
                      : activeTab === 'yt'
                      ? 'https://music.youtube.com/playlist?list=...'
                      : activeTab === 'sc'
                      ? 'https://soundcloud.com/.../sets/...'
                      : 'OTO-xxxx-xxxx'
                  }
                  className="flex-1 px-4 py-3 bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-white/[0.1] focus:border-slate-400 dark:focus:border-white/30 rounded-xl focus:outline-none text-xs font-sans text-[#142347] dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 shadow-xs transition-all disabled:opacity-50"
                  autoFocus
                />
                <button
                  onClick={handleInspect}
                  disabled={isInspecting || isMatching || isImporting || !inputValue.trim()}
                  className="px-5 py-3 bg-[#142347] dark:bg-white dark:text-black hover:bg-[#101b38] dark:hover:bg-white/90 text-white rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {isInspecting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <span>Inspect</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3 rounded-xl text-xs font-medium">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Direct Import Progress Box (YouTube / SoundCloud / Otofy) */}
          {isImporting && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 space-y-3 shadow-xs animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Download size={16} className="text-[#142347] dark:text-white animate-bounce" />
                  <span className="font-bold text-[#142347] dark:text-white">
                    Importing: {directImportProgress.current} / {directImportProgress.total} tracks...
                  </span>
                </div>
                <span className="font-mono font-bold text-xs text-[#64748B] dark:text-white/70">
                  {directImportProgress.total > 0
                    ? Math.round((directImportProgress.current / directImportProgress.total) * 100)
                    : 0}%
                </span>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full h-2.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-[#142347] dark:bg-white rounded-full transition-all duration-150"
                  style={{
                    width: `${
                      directImportProgress.total > 0
                        ? Math.round((directImportProgress.current / directImportProgress.total) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-[#64748B] dark:text-white/60 truncate max-w-[340px]">
                  {directImportProgress.currentTrackTitle || 'Saving to library...'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-white/15 text-[#142347] dark:text-white border border-slate-300 dark:border-white/20">
                  {directImportProgress.current} of {directImportProgress.total}
                </span>
              </div>
            </div>
          )}

          {/* Spotify Match Engine Progress Box */}
          {isMatching && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 space-y-3 shadow-xs animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-[#142347] dark:text-white animate-pulse" />
                  <span className="font-bold text-[#142347] dark:text-white">
                    Importing: {matchProgress.current} / {matchProgress.total} tracks...
                  </span>
                </div>
                <span className="font-mono font-bold text-xs text-[#64748B] dark:text-white/70">
                  {progressPercent}%
                </span>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full h-2.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-[#142347] dark:bg-white rounded-full transition-all duration-150"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-[#64748B] dark:text-white/60 truncate max-w-[280px]">
                  Searching: {matchProgress.currentTrackTitle || 'Connecting...'}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-white/15 text-[#142347] dark:text-white border border-slate-300 dark:border-white/20">
                    âœ“ {matchProgress.matched} confirmed
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                    ? {matchProgress.unresolved} need review
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Spotify Preview Card */}
          {spotifyData && !isMatching && (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                {spotifyData.artworkUrl ? (
                  <img
                    src={spotifyData.artworkUrl}
                    alt={spotifyData.title}
                    className="w-14 h-14 rounded-xl object-cover bg-slate-100 dark:bg-white/10 shadow-xs shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-white/10 text-[#142347] dark:text-white flex items-center justify-center font-bold shrink-0">
                    <Music size={22} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-[#142347] dark:text-white text-sm truncate">
                    {spotifyData.title}
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-white/60 truncate">
                    by {spotifyData.creator} • {spotifyData.trackCount} tracks
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-white/15 text-[#142347] dark:text-white border border-slate-300 dark:border-white/20">
                      Ready to auto-match
                    </span>
                    <span className="text-[10px] text-[#64748B] dark:text-white/50">
                      Concurrency: 4 parallel workers
                    </span>
                  </div>
                </div>
              </div>

              {/* Sample tracks preview */}
              <div className="max-h-28 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.06] text-xs pr-1">
                {spotifyData.tracks.slice(0, 5).map((t, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-[#334155] dark:text-white/80 py-1"
                  >
                    <span className="truncate max-w-[320px]">
                      <span className="text-[#94A3B8] dark:text-white/50 font-mono mr-1.5">
                        {idx + 1}.
                      </span>
                      {t.title} – <span className="text-[#64748B] dark:text-white/60">{t.artist}</span>
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono font-bold text-[#64748B] dark:text-white/80">
                      {`${Math.floor(t.durationSec / 60)}:${(t.durationSec % 60).toString().padStart(2, '0')}`}
                    </span>
                  </div>
                ))}
                {spotifyData.tracks.length > 5 && (
                  <div className="text-[11px] text-[#94A3B8] dark:text-white/50 italic pt-1">
                    ...and {spotifyData.tracks.length - 5} more tracks
                  </div>
                )}
              </div>

              <button
                onClick={handleSpotifyMatchAndImport}
                disabled={isMatching}
                className="w-full py-3.5 bg-[#142347] hover:bg-[#101b38] active:bg-[#0c142b] dark:bg-white dark:hover:bg-white/90 text-white dark:text-black rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles size={16} />
                <span>Start Import & Match Engine ({spotifyData.tracks.length} tracks)</span>
              </button>
            </div>
          )}

          {/* YouTube / SoundCloud Preview Card */}
          {remoteData && (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                {remoteData.artworkUrl ? (
                  <img
                    src={remoteData.artworkUrl}
                    alt={remoteData.title}
                    className="w-14 h-14 rounded-xl object-cover bg-slate-100 dark:bg-white/10 shadow-xs shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center font-bold shrink-0">
                    <Music size={22} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-[#142347] dark:text-white text-sm truncate">
                    {remoteData.title}
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-white/60 truncate">
                    by {remoteData.author} • {remoteData.tracks.length} tracks
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-white/15 text-[#142347] dark:text-white border border-slate-300 dark:border-white/20">
                    Ready to import
                  </span>
                </div>
              </div>

              <div className="max-h-28 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.06] text-xs pr-1">
                {remoteData.tracks.slice(0, 5).map((t, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-[#334155] dark:text-white/80 py-1"
                  >
                    <span className="truncate max-w-[320px]">
                      <span className="text-[#94A3B8] dark:text-white/50 font-mono mr-1.5">
                        {idx + 1}.
                      </span>
                      {t.title} – <span className="text-[#64748B] dark:text-white/60">{t.artist}</span>
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono font-bold text-[#64748B] dark:text-white/80">
                      {t.duration}
                    </span>
                  </div>
                ))}
                {remoteData.tracks.length > 5 && (
                  <div className="text-[11px] text-[#94A3B8] dark:text-white/50 italic pt-1">
                    ...and {remoteData.tracks.length - 5} more tracks
                  </div>
                )}
              </div>

              <button
                onClick={handleDirectImport}
                disabled={isImporting}
                className="w-full py-3.5 bg-[#142347] dark:bg-white text-white dark:text-black hover:bg-[#101b38] dark:hover:bg-white/90 rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {isImporting ? (
                  <span>Importing playlist...</span>
                ) : (
                  <span>Import Playlist ({remoteData.tracks.length} tracks)</span>
                )}
              </button>
            </div>
          )}

          {/* Otofy Share Code Preview Card */}
          {otofyData && (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-[#142347] dark:text-white text-sm">{otofyData.title}</h4>
                  <p className="text-xs text-[#64748B] dark:text-white/60">
                    by {otofyData.creator} • {otofyData.tracks.length} tracks
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-white/15 text-[#142347] dark:text-white border border-slate-300 dark:border-white/20">
                  Ready to import
                </span>
              </div>

              <div className="max-h-28 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.06] text-xs pr-1">
                {otofyData.tracks.slice(0, 5).map((t, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-[#334155] dark:text-white/80 py-1"
                  >
                    <span className="truncate max-w-[320px]">
                      <span className="text-[#94A3B8] dark:text-white/50 font-mono mr-1.5">
                        {idx + 1}.
                      </span>
                      {t.title} – <span className="text-[#64748B] dark:text-white/60">{t.artist}</span>
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono font-bold text-[#64748B] dark:text-white/80">
                      {t.duration || '0:00'}
                    </span>
                  </div>
                ))}
                {otofyData.tracks.length > 5 && (
                  <div className="text-[11px] text-[#94A3B8] dark:text-white/50 italic pt-1">
                    ...and {otofyData.tracks.length - 5} more tracks
                  </div>
                )}
              </div>

              <button
                onClick={handleDirectImport}
                disabled={isImporting}
                className="w-full py-3.5 bg-[#142347] dark:bg-white text-white dark:text-black hover:bg-[#101b38] dark:hover:bg-white/90 rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {isImporting ? (
                  <span>Importing playlist...</span>
                ) : (
                  <span>Import Playlist ({otofyData.tracks.length} tracks)</span>
                )}
              </button>
            </div>
          )}

          {/* Success Banner */}
          {success && (
            <div className="flex items-center gap-2 text-[#142347] dark:text-white bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/15 p-3 rounded-xl text-xs font-semibold animate-in fade-in">
              <CheckCircle2 size={16} className="shrink-0 text-[#142347] dark:text-white" />
              <span>{successMessage || 'Playlist imported successfully!'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
