import React, { useEffect, useState } from 'react';
import { Cloud, X, Youtube, Radio, CheckCircle2, AlertCircle, RefreshCw, LogOut, ExternalLink, ShieldCheck } from 'lucide-react';
import { useLibraryStore } from '../store/libraryStore';
import repo from '../db/repository';

interface AccountSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountSyncModal: React.FC<AccountSyncModalProps> = ({ isOpen, onClose }) => {
  const [ytConnected, setYtConnected] = useState(false);
  const [ytUser, setYtUser] = useState<string | null>(null);
  const [scConnected, setScConnected] = useState(false);
  const [scUser, setScUser] = useState<string | null>(null);

  const [isAuthorizing, setIsAuthorizing] = useState<'yt' | 'sc' | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncPercent, setSyncPercent] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadLibrary = useLibraryStore((state) => state.loadLibrary);

  useEffect(() => {
    if (!isOpen) return;

    // Load initial account connection status
    if (window.electronAPI?.getAccountStatus) {
      window.electronAPI.getAccountStatus().then((status) => {
        if (status.youtube.connected) {
          setYtConnected(true);
          setYtUser(status.youtube.username || 'Google Account');
        } else {
          setYtConnected(false);
          setYtUser(null);
        }

        if (status.soundcloud.connected) {
          setScConnected(true);
          setScUser(status.soundcloud.username || 'SoundCloud User');
        } else {
          setScConnected(false);
          setScUser(null);
        }
      }).catch(() => {});
    }

    if (window.electronAPI?.onCloudSyncProgress) {
      const cleanup = window.electronAPI.onCloudSyncProgress((progress) => {
        const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
        setSyncPercent(pct);
        setStatusMessage(progress.message);
      });
      return cleanup;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAuthorizeYT = async () => {
    setErrorMessage('');
    setStatusMessage('');
    setIsAuthorizing('yt');

    try {
      if (window.electronAPI?.loginAccount) {
        const res = await window.electronAPI.loginAccount('youtube');
        if (res.success) {
          setYtConnected(true);
          setYtUser(res.username || 'Google Account');
          setStatusMessage('Google Account connected successfully! Rate limits lifted.');
          await handleSyncYT();
        } else {
          setErrorMessage(res.error || 'YouTube Music authorization canceled.');
        }
      } else {
        window.open('https://accounts.google.com/ServiceLogin?service=youtube', '_blank');
        setYtConnected(true);
        setYtUser('Google User (Web Session)');
        setStatusMessage('Google authentication session active.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to authorize YouTube account.');
    } finally {
      setIsAuthorizing(null);
    }
  };

  const handleAuthorizeSC = async () => {
    setErrorMessage('');
    setStatusMessage('');
    setIsAuthorizing('sc');

    try {
      if (window.electronAPI?.loginAccount) {
        const res = await window.electronAPI.loginAccount('soundcloud');
        if (res.success) {
          setScConnected(true);
          setScUser(res.username || 'SoundCloud User');
          setStatusMessage('SoundCloud connected successfully!');
          await handleSyncSC();
        } else {
          setErrorMessage(res.error || 'SoundCloud authorization canceled.');
        }
      } else {
        window.open('https://soundcloud.com/signin', '_blank');
        setScConnected(true);
        setScUser('SoundCloud User (Web)');
        setStatusMessage('SoundCloud session active.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to connect SoundCloud account.');
    } finally {
      setIsAuthorizing(null);
    }
  };

  const handleDisconnect = async (platform: 'youtube' | 'soundcloud') => {
    setErrorMessage('');
    setStatusMessage('');
    try {
      if (window.electronAPI?.logoutAccount) {
        await window.electronAPI.logoutAccount(platform);
      }
      if (platform === 'youtube') {
        setYtConnected(false);
        setYtUser(null);
      } else {
        setScConnected(false);
        setScUser(null);
      }
      setStatusMessage(`Disconnected from ${platform === 'youtube' ? 'YouTube Music' : 'SoundCloud'}.`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to disconnect account.');
    }
  };

  const handleSyncYT = async () => {
    setIsSyncing(true);
    setErrorMessage('');
    setStatusMessage('Syncing YouTube Music library & playlists...');
    setSyncPercent(0);

    try {
      if (window.electronAPI?.syncCloudLibrary) {
        const res = await window.electronAPI.syncCloudLibrary('youtube');
        if (res.success && res.playlists?.length > 0) {
          for (const pl of res.playlists) {
            if (pl.id === 'pl-yt-liked' || pl.id === 'pl-sc-likes') continue;
            await repo.createPlaylist({
              id: pl.id,
              title: pl.title,
              creator: pl.creator,
              artworkUrl: pl.artworkUrl,
              iconName: pl.iconName || 'music',
              gradientFrom: pl.gradientFrom || '#DC2626',
              gradientTo: pl.gradientTo || '#991B1B',
              isSynced: true,
              syncSource: 'youtube',
            });
            await repo.reconcilePlaylistTracks(pl.id, pl.tracks as any);
          }
          await loadLibrary();
          setStatusMessage(`Synced ${res.playlists.length} playlists from YouTube Music!`);
        } else if (res.error) {
          setErrorMessage(res.error);
        } else {
          setStatusMessage('No playlists found to sync in this account.');
        }
      }
    } catch (err: any) {
      console.warn('Sync YT error:', err);
      setErrorMessage(err?.message || 'Failed to sync YouTube library.');
    } finally {
      setIsSyncing(false);
      setSyncPercent(null);
    }
  };

  const handleSyncSC = async () => {
    setIsSyncing(true);
    setErrorMessage('');
    setStatusMessage('Syncing SoundCloud playlists...');
    setSyncPercent(0);

    try {
      if (window.electronAPI?.syncCloudLibrary) {
        const res = await window.electronAPI.syncCloudLibrary('soundcloud');
        if (res.success && res.playlists?.length > 0) {
          for (const pl of res.playlists) {
            if (pl.id === 'pl-yt-liked' || pl.id === 'pl-sc-likes') continue;
            await repo.createPlaylist({
              id: pl.id,
              title: pl.title,
              creator: pl.creator,
              artworkUrl: pl.artworkUrl,
              iconName: pl.iconName || 'radio',
              gradientFrom: pl.gradientFrom || '#EA580C',
              gradientTo: pl.gradientTo || '#C2410C',
              isSynced: true,
              syncSource: 'soundcloud',
            });
            await repo.reconcilePlaylistTracks(pl.id, pl.tracks as any);
          }
          await loadLibrary();
          setStatusMessage(`Synced ${res.playlists.length} playlists from SoundCloud!`);
        } else if (res.error) {
          setErrorMessage(res.error);
        } else {
          setStatusMessage('No playlists found to sync in this account.');
        }
      }
    } catch (err: any) {
      console.warn('Sync SC error:', err);
      setErrorMessage(err?.message || 'Failed to sync SoundCloud library.');
    } finally {
      setIsSyncing(false);
      setSyncPercent(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/95 dark:bg-[#0C0C10] backdrop-blur-3xl border border-white dark:border-white/10 rounded-3xl w-full max-w-lg flex flex-col p-6 m-4 relative shadow-[0_25px_60px_rgba(0,0,0,0.18),inset_0_1px_2px_#FFFFFF] dark:shadow-[0_25px_60px_rgba(0,0,0,0.8)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#0F172A] dark:bg-white rounded-2xl text-white dark:text-black shadow-md">
              <Cloud size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white leading-tight">Account & Cloud Sync</h2>
              <p className="text-xs text-[#64748B] dark:text-white/60">Connect accounts to bypass rate limits and sync your libraries</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Info Card */}
        <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 mb-5 flex items-start gap-3.5 backdrop-blur-md">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0 mt-0.5">
            <ShieldCheck size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-bold text-[#0F172A] dark:text-white">Account Free by Default</h4>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                Optional
              </span>
            </div>
            <p className="text-xs text-[#64748B] dark:text-white/60 leading-relaxed">
              Otofy works without an account. Connecting your Google or SoundCloud account provides exemption from YouTube bot challenges and enables 1-click library sync.
            </p>
          </div>
        </div>

        {/* Sync Progress Bar */}
        {isSyncing && syncPercent !== null && (
          <div className="mb-4">
            <div className="flex justify-between text-[11px] font-bold text-[#64748B] dark:text-white/70 mb-1.5">
              <span>{statusMessage || 'Synchronizing...'}</span>
              <span>{syncPercent}%</span>
            </div>
            <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-[#0F172A] dark:bg-white h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(syncPercent, 5)}%` }}
              />
            </div>
          </div>
        )}

        {/* Status Banners */}
        {!isSyncing && statusMessage && (
          <div className="mb-4 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-3 rounded-xl text-xs font-medium">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 flex items-center gap-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3 rounded-xl text-xs font-medium">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Platform Cards */}
        <div className="space-y-4 mb-6">
          {/* YouTube Music Card */}
          <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <Youtube size={22} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0F172A] dark:text-white">YouTube Music</h4>
                  <p className="text-xs text-[#64748B] dark:text-white/60">
                    {ytConnected ? ytUser : 'Connect Google account to sync playlists and prevent bot challenge'}
                  </p>
                </div>
              </div>

              {ytConnected && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  Connected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-white/10">
              {!ytConnected ? (
                <button
                  onClick={handleAuthorizeYT}
                  disabled={isAuthorizing === 'yt' || isSyncing}
                  className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isAuthorizing === 'yt' ? (
                    <span>Signing in via Google...</span>
                  ) : (
                    <>
                      <span>Authorize with Google</span>
                      <ExternalLink size={14} />
                    </>
                  )}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSyncYT}
                    disabled={isSyncing}
                    className="flex-1 py-2 px-3 bg-slate-900 hover:bg-black dark:bg-white/15 dark:hover:bg-white/25 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                    <span>Sync Playlists</span>
                  </button>
                  <button
                    onClick={() => handleDisconnect('youtube')}
                    disabled={isSyncing}
                    className="p-2 text-[#94A3B8] dark:text-white/60 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                    title="Disconnect Account"
                  >
                    <LogOut size={16} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* SoundCloud Card */}
          <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <Radio size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0F172A] dark:text-white">SoundCloud</h4>
                  <p className="text-xs text-[#64748B] dark:text-white/60">
                    {scConnected ? scUser : 'Sign in to sync your SoundCloud playlists and liked tracks'}
                  </p>
                </div>
              </div>

              {scConnected && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  Connected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-white/10">
              {!scConnected ? (
                <button
                  onClick={handleAuthorizeSC}
                  disabled={isAuthorizing === 'sc' || isSyncing}
                  className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isAuthorizing === 'sc' ? (
                    <span>Signing in to SoundCloud...</span>
                  ) : (
                    <>
                      <span>Connect SoundCloud Account</span>
                      <ExternalLink size={14} />
                    </>
                  )}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSyncSC}
                    disabled={isSyncing}
                    className="flex-1 py-2 px-3 bg-slate-900 hover:bg-black dark:bg-white/15 dark:hover:bg-white/25 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                    <span>Sync Playlists & Likes</span>
                  </button>
                  <button
                    onClick={() => handleDisconnect('soundcloud')}
                    disabled={isSyncing}
                    className="p-2 text-[#94A3B8] dark:text-white/60 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                    title="Disconnect Account"
                  >
                    <LogOut size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-[#0F172A] dark:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default AccountSyncModal;
