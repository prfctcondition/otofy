import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { parseShareCode } from '../services/shareCodeService';
import { useLibraryStore } from '../store/libraryStore';
import { useToastStore } from '../store/toastStore';
import type { Track, ShareCodeData } from '../types';

interface ImportPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportSourceTab = 'otofy' | 'yt' | 'sc' | 'spotify';

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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Tab-specific parsed preview data
  const [otofyData, setOtofyData] = useState<ShareCodeData | null>(null);
  const [remoteData, setRemoteData] = useState<RemotePlaylistPreview | null>(null);
  const [spotifyData, setSpotifyData] = useState<SpotifyInspectionData | null>(null);

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

  // Reset inputs when switching tabs
  const handleTabChange = (tab: ImportSourceTab) => {
    setActiveTab(tab);
    setInputValue('');
    setError('');
    setSuccess(false);
    setOtofyData(null);
    setRemoteData(null);
    setSpotifyData(null);
    setIsMatching(false);
  };

  const handleClose = () => {
    setInputValue('');
    setError('');
    setSuccess(false);
    setOtofyData(null);
    setRemoteData(null);
    setSpotifyData(null);
    setIsMatching(false);
    onClose();
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
        if (!window.electronAPI?.importRemotePlaylist) {
          throw new Error('Desktop IPC bridge is unavailable.');
        }
        const res = await window.electronAPI.importRemotePlaylist('YT', clean);
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
        if (!window.electronAPI?.importRemotePlaylist) {
          throw new Error('Desktop IPC bridge is unavailable.');
        }
        const res = await window.electronAPI.importRemotePlaylist('SC', clean);
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
        if (!window.electronAPI?.inspectSpotifyPlaylist) {
          throw new Error('Spotify scraper is unavailable in current build.');
        }
        const spDetails = await window.electronAPI.inspectSpotifyPlaylist(clean);
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
        const newPl = await createPlaylist({
          title: otofyData.title,
          creator: otofyData.creator || 'Imported User',
          gradientFrom: '#334155',
          gradientTo: '#0F172A',
          iconName: 'disc',
        });

        for (let i = 0; i < otofyData.tracks.length; i++) {
          const item = otofyData.tracks[i];
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
            gradientTo: '#0F172A',
            isLiked: false,
            artworkUrl:
              item.source === 'YT' && item.sourceId
                ? `https://i.ytimg.com/vi/${item.sourceId}/hqdefault.jpg`
                : undefined,
          };
          await addTrackToPlaylist(newPl.id, track);
        }

        setSuccess(true);
        setSuccessMessage(`Imported ${otofyData.tracks.length} tracks successfully!`);
        await selectPlaylist(newPl.id);
        setTimeout(handleClose, 1200);
      } else if ((activeTab === 'yt' || activeTab === 'sc') && remoteData) {
        const newPl = await createPlaylist({
          title: remoteData.title,
          creator: remoteData.author || (activeTab === 'yt' ? 'YouTube Music' : 'SoundCloud'),
          artworkUrl: remoteData.artworkUrl,
          gradientFrom: activeTab === 'yt' ? '#DC2626' : '#EA580C',
          gradientTo: '#0F172A',
          iconName: activeTab === 'yt' ? 'music' : 'waves',
        });

        for (let i = 0; i < remoteData.tracks.length; i++) {
          const t = remoteData.tracks[i];
          const track: Track = {
            ...t,
            id: t.id || `imp-${Date.now()}-${i}`,
            number: i + 1,
            album: remoteData.title,
            dateAdded: new Date().toISOString(),
            iconName: 'music',
            gradientFrom: '#1E293B',
            gradientTo: '#0F172A',
          };
          await addTrackToPlaylist(newPl.id, track);
        }

        setSuccess(true);
        setSuccessMessage(`Imported ${remoteData.tracks.length} tracks successfully!`);
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
    if (!spotifyData || !window.electronAPI?.importAndMatchSpotify) return;

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
      const matchedTracks = await window.electronAPI.importAndMatchSpotify({
        tracks: spotifyData.tracks,
        playlistTitle: spotifyData.title,
      });

      // Create new playlist in user library
      const newPl = await createPlaylist({
        title: spotifyData.title,
        creator: spotifyData.creator || 'Spotify',
        artworkUrl: spotifyData.artworkUrl,
        gradientFrom: '#059669',
        gradientTo: '#064E3B',
        iconName: 'sparkles',
      });

      // Add matched tracks into playlist
      for (const track of matchedTracks) {
        await addTrackToPlaylist(newPl.id, track);
      }

      setSuccess(true);
      const unresolvedCount = matchedTracks.filter((t) => t.unresolved).length;
      const matchedCount = matchedTracks.length - unresolvedCount;

      setSuccessMessage(
        `Imported ${matchedTracks.length} tracks (${matchedCount} matched, ${unresolvedCount} need review)`
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
      <div className="bg-white/95 dark:bg-[#0C0C10] backdrop-blur-3xl border border-white/80 dark:border-white/10 rounded-3xl w-full max-w-xl flex flex-col p-6 m-4 relative shadow-[0_25px_60px_rgba(0,0,0,0.35)]">
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#0F172A] dark:bg-white text-white dark:text-black rounded-2xl shadow-md">
              <Download size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white leading-tight">Import Playlist</h2>
              <p className="text-xs text-[#64748B] dark:text-white/60">
                Universal hub: Spotify, YouTube Music, SoundCloud & Otofy Share
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Segmented Source Tabs */}
        <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100/90 dark:bg-white/[0.06] rounded-2xl mb-5 border border-slate-200/80 dark:border-white/10">
          <button
            onClick={() => handleTabChange('spotify')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'spotify'
                ? 'bg-white dark:bg-white/20 text-[#0F172A] dark:text-white shadow-xs'
                : 'text-[#64748B] dark:text-white/60 hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate">Spotify</span>
          </button>

          <button
            onClick={() => handleTabChange('yt')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'yt'
                ? 'bg-white dark:bg-white/20 text-[#0F172A] dark:text-white shadow-xs'
                : 'text-[#64748B] dark:text-white/60 hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            <Youtube size={14} className="text-rose-500 shrink-0" />
            <span className="truncate">YT Music</span>
          </button>

          <button
            onClick={() => handleTabChange('sc')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'sc'
                ? 'bg-white dark:bg-white/20 text-[#0F172A] dark:text-white shadow-xs'
                : 'text-[#64748B] dark:text-white/60 hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            <Cloud size={14} className="text-amber-500 shrink-0" />
            <span className="truncate">SoundCloud</span>
          </button>

          <button
            onClick={() => handleTabChange('otofy')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'otofy'
                ? 'bg-white dark:bg-white/20 text-[#0F172A] dark:text-white shadow-xs'
                : 'text-[#64748B] dark:text-white/60 hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            <Share2 size={14} className="text-slate-500 shrink-0" />
            <span className="truncate">Otofy Code</span>
          </button>
        </div>

        {/* Input & Inspect Area */}
        <div className="space-y-4">
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
                className="flex-1 px-4 py-3 bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-white/[0.1] focus:border-slate-400 dark:focus:border-white/30 rounded-xl focus:outline-none text-xs font-sans text-[#0F172A] dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 shadow-xs transition-all disabled:opacity-50"
                autoFocus
              />
              <button
                onClick={handleInspect}
                disabled={isInspecting || isMatching || isImporting || !inputValue.trim()}
                className="px-5 py-3 bg-[#0F172A] dark:bg-white dark:text-black hover:bg-black dark:hover:bg-white/90 text-white rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
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

          {error && (
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3 rounded-xl text-xs font-medium">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Spotify Match Engine Progress Box */}
          {isMatching && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 space-y-3 shadow-xs">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-emerald-500 animate-pulse" />
                  <span className="font-bold text-[#0F172A] dark:text-white">
                    Импорт: {matchProgress.current} / {matchProgress.total} треков найдено...
                  </span>
                </div>
                <span className="font-mono font-bold text-xs text-[#64748B] dark:text-white/70">
                  {progressPercent}%
                </span>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full h-2.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-150"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-[#64748B] dark:text-white/60 truncate max-w-[280px]">
                  Поиск: {matchProgress.currentTrackTitle || 'Connecting...'}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                    ✓ {matchProgress.matched} confirmed
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
                  <div className="w-14 h-14 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
                    <Music size={22} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-[#0F172A] dark:text-white text-sm truncate">
                    {spotifyData.title}
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-white/60 truncate">
                    by {spotifyData.creator} • {spotifyData.trackCount} tracks
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
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
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
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
                  <h4 className="font-bold text-[#0F172A] dark:text-white text-sm truncate">
                    {remoteData.title}
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-white/60 truncate">
                    by {remoteData.author} • {remoteData.tracks.length} tracks
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
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
                className="w-full py-3.5 bg-[#0F172A] dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-white/90 rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
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
                  <h4 className="font-bold text-[#0F172A] dark:text-white text-sm">{otofyData.title}</h4>
                  <p className="text-xs text-[#64748B] dark:text-white/60">
                    by {otofyData.creator} • {otofyData.tracks.length} tracks
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
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
                className="w-full py-3.5 bg-[#0F172A] dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-white/90 rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
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
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-3 rounded-xl text-xs font-semibold animate-in fade-in">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{successMessage || 'Playlist imported successfully!'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
