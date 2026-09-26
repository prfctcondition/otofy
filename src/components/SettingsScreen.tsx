import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Radio,
  Sliders,
  Sparkles,
  Volume2,
  Monitor,
  FolderDown,
  Cpu,
  Trash2,
  FolderOpen,
  FolderSync,
  Check,
  AlertTriangle,
  RotateCcw,
  DownloadCloud,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Cloud,
  User,
  Globe,
  Sun,
  Moon,
} from 'lucide-react';
import { useSettingsStore, StreamingQuality, AutoLaunchMode } from '../store/settingsStore';
import { useLibraryStore } from '../store/libraryStore';
import { useThemeStore } from '../store/themeStore';
import useToastStore from '../store/toastStore';
import { useTranslation } from '../i18n';
import { invalidateWaveCache } from '../services/waveService';
import type { UpdateCheckResult } from '../types';

interface AudioDeviceOption {
  deviceId: string;
  label: string;
}

export const SettingsScreen: React.FC = () => {
  const { t, language, setLanguage, supportedLanguages } = useTranslation();
  const settings = useSettingsStore();
  const { theme, setTheme } = useThemeStore();
  const navigateBack = useLibraryStore((s) => s.navigateBack);

  const [cacheSize, setCacheSize] = useState<string>('Calculating...');
  const [isClearingCache, setIsClearingCache] = useState<boolean>(false);
  const [audioDevices, setAudioDevices] = useState<AudioDeviceOption[]>([]);
  const [showRestartModal, setShowRestartModal] = useState<boolean>(false);

  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState<boolean>(false);
  const [updateProgress, setUpdateProgress] = useState<{ percent: number; transferred: number; total: number } | null>(null);
  const [appVersion, setAppVersion] = useState<string>(
    typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.1.4'
  );

  // Fetch cache size and audio output devices
  useEffect(() => {
    // 1. Audio devices
    const updateDevices = async () => {
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devs = await navigator.mediaDevices.enumerateDevices();
          const outputs = devs
            .filter((d) => d.kind === 'audiooutput')
            .map((d, index) => ({
              deviceId: d.deviceId,
              label: d.label || `Speaker / Headphone ${index + 1}`,
            }));
          setAudioDevices(outputs.length > 0 ? outputs : [{ deviceId: 'default', label: t.settings?.playback?.defaultDevice || 'Default System Output' }]);
        }
      } catch (err) {
        console.warn('Failed to enumerate audio devices:', err);
      }
    };
    updateDevices();

    // 2. Cache size via Electron IPC
    if (window.electronAPI?.getCacheSize) {
      window.electronAPI.getCacheSize().then((res) => {
        setCacheSize(res.formatted);
      }).catch(() => setCacheSize('0 MB'));
    } else {
      setCacheSize('0 MB (Browser)');
    }

    // 3. App version via Electron IPC
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then((ver) => {
        if (ver) setAppVersion(ver);
      }).catch(() => {});
    }
  }, [t.settings?.playback?.defaultDevice]);

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      if (window.electronAPI?.clearCache) {
        await window.electronAPI.clearCache();
      }
      setCacheSize('0 MB');
      useToastStore.getState().success(
        t.settings?.storage?.cacheClearedToast || 'Cache Cleared',
        t.settings?.storage?.cacheClearedToastDesc || 'Temporary files and network cache have been removed.'
      );
    } catch (err: any) {
      useToastStore.getState().error('Error', err?.message || 'Failed to clear cache.');
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleChangeDownloadsFolder = async () => {
    if (window.electronAPI?.selectDownloadsFolder) {
      const selected = await window.electronAPI.selectDownloadsFolder();
      if (selected) {
        settings.setDownloadsPath(selected);
        useToastStore.getState().success(
          t.settings?.storage?.folderUpdatedToast || 'Downloads Folder Updated',
          selected
        );
      }
    }
  };

  const handleOpenDownloadsFolder = () => {
    if (window.electronAPI?.openFolder) {
      window.electronAPI.openFolder(settings.downloadsPath);
    }
  };

  const handleToggleHwAccel = async () => {
    const nextVal = !settings.hardwareAcceleration;
    await settings.setHardwareAcceleration(nextVal);
    setShowRestartModal(true);
  };

  const handleRelaunch = () => {
    if (window.electronAPI?.relaunchApp) {
      window.electronAPI.relaunchApp();
    } else {
      window.location.reload();
    }
  };

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      if (window.electronAPI?.checkForUpdates) {
        const res = await window.electronAPI.checkForUpdates();
        setUpdateInfo(res);
        if (res.hasUpdate) {
          useLibraryStore.getState().openUpdateModal(res);
        } else {
          useToastStore.getState().success(
            t.settings?.updates?.upToDateToast || 'Up to Date',
            (t.settings?.updates?.upToDateToastDesc || 'You are running the latest version of Otofy ({version}).').replace('{version}', res.currentVersion)
          );
        }
      } else {
        setUpdateInfo({
          hasUpdate: false,
          canAutoInstall: false,
          currentVersion: `${appVersion} (Web)`,
          latestVersion: appVersion,
          releaseNotes: t.settings?.updates?.browserPreviewNotes || 'Running in browser preview mode.',
        });
      }
    } catch (err: any) {
      useToastStore.getState().error('Update Check Failed', err?.message || 'Failed to query GitHub releases.');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleDownloadAndInstallUpdate = async () => {
    setIsDownloadingUpdate(true);
    setUpdateProgress({ percent: 0, transferred: 0, total: 0 });
    try {
      if (window.electronAPI?.onUpdateDownloadProgress) {
        window.electronAPI.onUpdateDownloadProgress((prog) => {
          setUpdateProgress(prog);
        });
      }
      if (window.electronAPI?.downloadAndInstallUpdate) {
        const res = await window.electronAPI.downloadAndInstallUpdate();
        if (!res.success) {
          useToastStore.getState().error('Update Failed', res.error || 'Failed to download installer.');
          setIsDownloadingUpdate(false);
          setUpdateProgress(null);
        }
      }
    } catch (err: any) {
      useToastStore.getState().error('Update Error', err?.message || 'Error occurred during update download.');
      setIsDownloadingUpdate(false);
      setUpdateProgress(null);
    }
  };

  return (
    <div
      id="settings-screen"
      className="flex-1 overflow-y-auto px-6 lg:px-12 py-8 select-none text-[#0F172A] dark:text-white"
    >
      <div className="flex items-center gap-4 mb-8">
        <button
          id="settings-back-btn"
          onClick={navigateBack}
          className="p-2.5 rounded-full text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          title={t.settings?.backBtnTitle || 'Go back'}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight drop-shadow-xs">
            {t.settings?.headerTitle || 'Settings'}
          </h1>
          <p className="text-xs text-[#64748B] dark:text-white/60 font-medium mt-1">
            {t.settings?.headerSubtitle || 'Configure playback, audio engine, startup behavior, and local storage.'}
          </p>
        </div>
      </div>

      <div className="max-w-4xl space-y-8 pb-16">
        <section className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <Globe size={18} className="text-[#0F172A] dark:text-white" />
            <h2 className="text-base font-bold">
              {t.settings?.appearance?.sectionTitle || 'Appearance & Language'}
            </h2>
          </div>

          <div className="space-y-4 divide-y divide-black/5 dark:divide-white/10">
            <div className="flex items-center justify-between gap-4 pt-1">
              <div>
                <span className="text-sm font-semibold block">
                  {t.settings?.appearance?.languageTitle || 'Interface Language'}
                </span>
                <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                  {t.settings?.appearance?.languageDesc || 'Choose your preferred language for all interface elements and tooltips.'}
                </p>
              </div>
              <select
                id="select-interface-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="bg-white/80 dark:bg-[#181820] border border-black/10 dark:border-white/15 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-black/30 dark:focus:border-white/40 cursor-pointer shadow-xs"
              >
                {supportedLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeName} ({lang.name})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-4 pt-4">
              <div className="max-w-xl">
                <span className="text-sm font-semibold block">
                  {t.settings?.appearance?.themeTitle || 'Visual Theme'}
                </span>
                <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                  {t.settings?.appearance?.themeDesc || 'Crystal liquid glass light theme or deep obsidian OLED dark theme.'}
                </p>
              </div>
              <div className="flex items-center gap-2 bg-black/5 dark:bg-white/10 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    theme === 'light'
                      ? 'bg-white text-black shadow-xs'
                      : 'text-slate-600 dark:text-white/60 hover:text-black dark:hover:text-white'
                  }`}
                >
                  <Sun size={13} className={theme === 'light' ? 'text-amber-500' : ''} />
                  <span>{t.settings?.appearance?.themeLight || 'Light Theme'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-[#181820] text-white shadow-xs'
                      : 'text-slate-600 dark:text-white/60 hover:text-black dark:hover:text-white'
                  }`}
                >
                  <Moon size={13} className={theme === 'dark' ? 'text-sky-400' : ''} />
                  <span>{t.settings?.appearance?.themeDark || 'Dark Theme'}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <Cloud size={18} className="text-[#0F172A] dark:text-white" />
            <h2 className="text-base font-bold">
              {t.settings?.cloud?.sectionTitle || 'Account & Cloud Sync'}
            </h2>
          </div>

          <div className="flex items-center justify-between gap-4 py-3">
            <div className="max-w-xl">
              <span className="text-sm font-semibold block">
                {t.settings?.cloud?.rowTitle || 'Connected services & library synchronization'}
              </span>
              <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                {t.settings?.cloud?.rowDesc || 'Connect your YouTube Music or SoundCloud accounts to seamlessly sync personal playlists, liked songs, and lift network rate limits.'}
              </p>
            </div>
            <button
              onClick={() => useLibraryStore.getState().toggleSyncModal()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0F172A] text-white dark:bg-white dark:text-black hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer shadow-xs shrink-0"
            >
              <Cloud size={14} />
              <span>{t.settings?.cloud?.manageBtn || 'Manage Accounts'}</span>
            </button>
          </div>
        </section>

        <section className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <Sparkles size={18} className="text-[#0F172A] dark:text-white" />
            <h2 className="text-base font-bold">
              {t.settingsPersonalization?.sectionTitle || 'Personalization & My Wave'}
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3">
            <div className="max-w-xl">
              <span className="text-sm font-semibold block">
                {t.settingsPersonalization?.rowTitle || 'Favorite Artists & Recommendation Calibration'}
              </span>
              <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                {settings.favoriteArtists && settings.favoriteArtists.length > 0
                  ? (t.settingsPersonalization?.rowSubtitleConfigured || 'Selected artists ({count}): {artists}')
                      .replace('{count}', String(settings.favoriteArtists.length))
                      .replace('{artists}', settings.favoriteArtists.join(', '))
                  : (t.settingsPersonalization?.rowSubtitleEmpty ||
                      'No favorite artists selected yet. Calibrate to power your personal "My Wave" endless station.')}
              </p>

              {settings.favoriteArtists && settings.favoriteArtists.length > 0 && (
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  {settings.favoriteArtists.map((artistName) => {
                    const avatar = settings.favoriteArtistAvatars?.[artistName];
                    return (
                      <div
                        key={artistName}
                        className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/10 border border-black/5 dark:border-white/10 text-xs font-medium text-slate-800 dark:text-white/90"
                      >
                        <div className="w-5 h-5 rounded-full overflow-hidden bg-black/10 dark:bg-white/10 shrink-0 flex items-center justify-center">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={artistName}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <User size={11} className="text-slate-600 dark:text-white/60" />
                          )}
                        </div>
                        <span className="truncate max-w-[120px]">{artistName}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => settings.setIsOnboardingModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0F172A] text-white dark:bg-white dark:text-black hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Sparkles size={14} />
                <span>{t.settingsPersonalization?.configureBtn || 'Configure Artists'}</span>
              </button>
              {settings.favoriteArtists && settings.favoriteArtists.length > 0 && (
                <button
                  onClick={() => {
                    invalidateWaveCache();
                    settings.resetOnboarding();
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-medium border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title={t.settingsPersonalization?.resetBtn || 'Reset'}
                >
                  {t.settingsPersonalization?.resetBtn || 'Reset'}
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <Radio size={18} className="text-[#0F172A] dark:text-white" />
            <h2 className="text-base font-bold">
              {t.settings?.autoplay?.sectionTitle || 'Autoplay'}
            </h2>
          </div>

          <div className="flex items-center justify-between gap-4 py-3">
            <div className="max-w-xl">
              <span className="text-sm font-semibold block">
                {t.settings?.autoplay?.rowTitle || 'Autoplay similar tracks'}
              </span>
              <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                {t.settings?.autoplay?.rowDesc || 'Enjoy non-stop listening. When your queue reaches the end, Otofy will automatically load and continue playing similar music.'}
              </p>
            </div>
            <button
              id="toggle-autoplay-btn"
              onClick={() => settings.setAutoplay(!settings.autoplay)}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                settings.autoplay ? 'bg-[#0F172A] dark:bg-white' : 'bg-slate-300 dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full transition-transform transform shadow-sm ${
                  settings.autoplay ? 'translate-x-6 bg-white dark:bg-black' : 'translate-x-0.5 bg-white dark:bg-zinc-300'
                }`}
              />
            </button>
          </div>
        </section>

        <section className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <Sparkles size={18} className="text-[#0F172A] dark:text-white" />
            <h2 className="text-base font-bold">
              {t.settings?.audioQuality?.sectionTitle || 'Audio Quality'}
            </h2>
          </div>

          <div className="space-y-4 divide-y divide-black/5 dark:divide-white/10">
            <div className="flex items-center justify-between gap-4 pt-1">
              <div>
                <span className="text-sm font-semibold block">
                  {t.settings?.audioQuality?.streamingQuality || 'Streaming quality'}
                </span>
                <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                  {t.settings?.audioQuality?.streamingQualityDesc || 'Select the audio stream quality. Higher bitrates provide studio clarity but consume more bandwidth.'}
                </p>
              </div>
              <select
                id="select-streaming-quality"
                value={settings.streamingQuality}
                onChange={(e) => settings.setStreamingQuality(e.target.value as StreamingQuality)}
                className="bg-white/80 dark:bg-[#181820] border border-black/10 dark:border-white/15 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-black/30 dark:focus:border-white/40 cursor-pointer shadow-xs"
              >
                <option value="low">{t.settings?.audioQuality?.qualityLow || 'Low (128 kbps)'}</option>
                <option value="normal">{t.settings?.audioQuality?.qualityNormal || 'Normal (160 kbps)'}</option>
                <option value="high">{t.settings?.audioQuality?.qualityHigh || 'High (320 kbps / Best)'}</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-4 pt-4">
              <div className="max-w-xl">
                <span className="text-sm font-semibold block">
                  {t.settings?.audioQuality?.autoAdjust || 'Auto-adjust quality'}
                </span>
                <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                  {t.settings?.audioQuality?.autoAdjustDesc || 'Automatically downscale streaming quality during network slowdowns or extended buffer delays.'}
                </p>
              </div>
              <button
                id="toggle-auto-adjust-quality-btn"
                onClick={() => settings.setAutoAdjustQuality(!settings.autoAdjustQuality)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  settings.autoAdjustQuality ? 'bg-[#0F172A] dark:bg-white' : 'bg-slate-300 dark:bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full transition-transform transform shadow-sm ${
                    settings.autoAdjustQuality ? 'translate-x-6 bg-white dark:bg-black' : 'translate-x-0.5 bg-white dark:bg-zinc-300'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <Volume2 size={18} className="text-[#0F172A] dark:text-white" />
            <h2 className="text-base font-bold">
              {t.settings?.playback?.sectionTitle || 'Playback'}
            </h2>
          </div>

          <div className="space-y-4 divide-y divide-black/5 dark:divide-white/10">
            <div className="pt-1">
              <div className="flex items-center justify-between gap-4">
                <div className="max-w-xl">
                  <span className="text-sm font-semibold block">
                    {t.settings?.playback?.crossfade || 'Crossfade songs'}
                  </span>
                  <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                    {t.settings?.playback?.crossfadeDesc || 'Seamlessly transition between songs using the Dual Deck (A/B) Web Audio engine.'}
                  </p>
                </div>
                <button
                  id="toggle-crossfade-btn"
                  onClick={() => settings.setCrossfadeEnabled(!settings.crossfadeEnabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    settings.crossfadeEnabled ? 'bg-[#0F172A] dark:bg-white' : 'bg-slate-300 dark:bg-white/20'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full transition-transform transform shadow-sm ${
                      settings.crossfadeEnabled ? 'translate-x-6 bg-white dark:bg-black' : 'translate-x-0.5 bg-white dark:bg-zinc-300'
                    }`}
                  />
                </button>
              </div>

              {settings.crossfadeEnabled && (
                <div className="mt-4 pl-4 border-l-2 border-black/20 dark:border-white/30 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[#64748B] dark:text-white/70">
                      {t.settings?.playback?.crossfadeDuration || 'Crossfade transition duration:'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-[#0F172A] dark:text-white">
                      {settings.crossfadeDuration}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    step="1"
                    value={settings.crossfadeDuration}
                    onChange={(e) => settings.setCrossfadeDuration(Number(e.target.value))}
                    className="w-full accent-[#0F172A] dark:accent-white cursor-pointer h-1.5 bg-slate-200 dark:bg-white/20 rounded-lg appearance-none"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 pt-4">
              <div className="max-w-xl">
                <span className="text-sm font-semibold block">
                  {t.settings?.playback?.normalizeVolume || 'Normalize volume'}
                </span>
                <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                  {t.settings?.playback?.normalizeVolumeDesc || 'Set the same loudness level for all tracks using the studio-grade dynamic compressor.'}
                </p>
              </div>
              <button
                id="toggle-normalize-volume-btn"
                onClick={() => settings.setNormalizeVolume(!settings.normalizeVolume)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  settings.normalizeVolume ? 'bg-[#0F172A] dark:bg-white' : 'bg-slate-300 dark:bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full transition-transform transform shadow-sm ${
                    settings.normalizeVolume ? 'translate-x-6 bg-white dark:bg-black' : 'translate-x-0.5 bg-white dark:bg-zinc-300'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 pt-4">
              <div className="max-w-xl">
                <span className="text-sm font-semibold block">
                  {t.settings?.playback?.monoAudio || 'Mono audio'}
                </span>
                <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                  {t.settings?.playback?.monoAudioDesc || 'Combine stereo left and right channels into a single mono output for single-speaker listening.'}
                </p>
              </div>
              <button
                id="toggle-mono-audio-btn"
                onClick={() => settings.setMonoAudio(!settings.monoAudio)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  settings.monoAudio ? 'bg-[#0F172A] dark:bg-white' : 'bg-slate-300 dark:bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full transition-transform transform shadow-sm ${
                    settings.monoAudio ? 'translate-x-6 bg-white dark:bg-black' : 'translate-x-0.5 bg-white dark:bg-zinc-300'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 pt-4">
              <div className="max-w-xl">
                <span className="text-sm font-semibold block">
                  {t.settings?.playback?.outputDevice || 'Audio output device'}
                </span>
                <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                  {t.settings?.playback?.outputDeviceDesc || 'Select specific speakers, headphones, or external audio interfaces.'}
                </p>
              </div>
              <select
                id="select-audio-output-device"
                value={settings.audioOutputDeviceId}
                onChange={(e) => settings.setAudioOutputDeviceId(e.target.value)}
                className="max-w-xs bg-white/80 dark:bg-[#181820] border border-black/10 dark:border-white/15 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-black/30 dark:focus:border-white/40 cursor-pointer shadow-xs truncate"
              >
                {audioDevices.map((dev) => (
                  <option key={dev.deviceId} value={dev.deviceId}>
                    {dev.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <Monitor size={18} className="text-[#0F172A] dark:text-white" />
            <h2 className="text-base font-bold">
              {t.settings?.startup?.sectionTitle || 'Startup and Window Behaviour'}
            </h2>
          </div>

          <div className="space-y-4 divide-y divide-black/5 dark:divide-white/10">
            <div className="flex items-center justify-between gap-4 pt-1">
              <div>
                <span className="text-sm font-semibold block">
                  {t.settings?.startup?.autoLaunch || 'Open Otofy automatically at computer login'}
                </span>
                <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                  {t.settings?.startup?.autoLaunchDesc || 'Launch the application automatically when Windows starts.'}
                </p>
              </div>
              <select
                id="select-auto-launch"
                value={settings.autoLaunch}
                onChange={(e) => settings.setAutoLaunch(e.target.value as AutoLaunchMode)}
                className="bg-white/80 dark:bg-[#181820] border border-black/10 dark:border-white/15 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-black/30 dark:focus:border-white/40 cursor-pointer shadow-xs"
              >
                <option value="no">{t.settings?.startup?.autoLaunchNo || 'No (disabled)'}</option>
                <option value="yes">{t.settings?.startup?.autoLaunchYes || 'Yes (open window)'}</option>
                <option value="minimized">{t.settings?.startup?.autoLaunchMinimized || 'Minimized (start in tray)'}</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-4 pt-4">
              <div className="max-w-xl">
                <span className="text-sm font-semibold block">
                  {t.settings?.startup?.closeToTray || 'Close button minimizes to tray'}
                </span>
                <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                  {t.settings?.startup?.closeToTrayDesc || "Clicking the close button ('X') hides the window to the system tray. The minimize button ('-') continues to minimize to the taskbar."}
                </p>
              </div>
              <button
                id="toggle-close-to-tray-btn"
                onClick={() => settings.setCloseToTray(!settings.closeToTray)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  settings.closeToTray ? 'bg-[#0F172A] dark:bg-white' : 'bg-slate-300 dark:bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full transition-transform transform shadow-sm ${
                    settings.closeToTray ? 'translate-x-6 bg-white dark:bg-black' : 'translate-x-0.5 bg-white dark:bg-zinc-300'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <FolderDown size={18} className="text-[#0F172A] dark:text-white" />
            <h2 className="text-base font-bold">
              {t.settings?.storage?.sectionTitle || 'Storage & Downloads'}
            </h2>
          </div>

          <div className="space-y-4 divide-y divide-black/5 dark:divide-white/10">
            <div className="flex items-center justify-between gap-4 pt-1">
              <div>
                <span className="text-sm font-semibold block">
                  {t.settings?.storage?.localCache || 'Local cache'}
                </span>
                <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                  {t.settings?.storage?.localCacheDesc || 'Temporary audio streams, artwork previews, and cached metadata.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-[#64748B] dark:text-white/70">{cacheSize}</span>
                <button
                  id="clear-cache-btn"
                  onClick={handleClearCache}
                  disabled={isClearingCache}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 dark:bg-rose-500/10 text-red-600 dark:text-rose-400 hover:bg-red-100 dark:hover:bg-rose-500/20 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Trash2 size={13} />
                  <span>
                    {isClearingCache
                      ? (t.settings?.storage?.clearing || 'Clearing...')
                      : (t.settings?.storage?.clearCache || 'Clear cache')}
                  </span>
                </button>
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold block">
                    {t.settings?.storage?.downloadsLocation || 'Downloads location'}
                  </span>
                  <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                    {t.settings?.storage?.downloadsLocationDesc || 'Default folder for future offline downloads.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    id="open-downloads-folder-btn"
                    onClick={handleOpenDownloadsFolder}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title={t.settings?.storage?.openInExplorer || 'Open in Explorer'}
                  >
                    <FolderOpen size={13} />
                    <span>{t.settings?.storage?.openInExplorer || 'Open in Explorer'}</span>
                  </button>
                  <button
                    id="change-downloads-folder-btn"
                    onClick={handleChangeDownloadsFolder}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/5 dark:bg-white/10 text-[#0F172A] dark:text-white hover:bg-black/10 dark:hover:bg-white/15 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <FolderSync size={13} />
                    <span>{t.settings?.storage?.changeFolder || 'Change'}</span>
                  </button>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-black/40 border border-black/5 dark:border-white/10 font-mono text-[11px] text-[#475569] dark:text-white/60 break-all select-text">
                {settings.downloadsPath || 'C:\\Users\\...\\AppData\\Roaming\\Otofy\\Downloads'}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <Cpu size={18} className="text-[#0F172A] dark:text-white" />
            <h2 className="text-base font-bold">
              {t.settings?.performance?.sectionTitle || 'System & Performance'}
            </h2>
          </div>

          <div className="flex items-center justify-between gap-4 py-1">
            <div className="max-w-xl">
              <span className="text-sm font-semibold block">
                {t.settings?.performance?.hardwareAcceleration || 'Hardware acceleration'}
              </span>
              <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                {t.settings?.performance?.hardwareAccelerationDesc || 'Utilize GPU rendering for buttery smooth animations and liquid glass UI effects. Requires restarting the app to apply.'}
              </p>
            </div>
            <button
              id="toggle-hardware-acceleration-btn"
              onClick={handleToggleHwAccel}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                settings.hardwareAcceleration ? 'bg-[#0F172A] dark:bg-white' : 'bg-slate-300 dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full transition-transform transform shadow-sm ${
                  settings.hardwareAcceleration ? 'translate-x-6 bg-white dark:bg-black' : 'translate-x-0.5 bg-white dark:bg-zinc-300'
                }`}
              />
            </button>
          </div>
        </section>

        <section className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <DownloadCloud size={18} className="text-[#0F172A] dark:text-white" />
              <h2 className="text-base font-bold">
                {t.settings?.updates?.sectionTitle || 'App Updates'}
              </h2>
            </div>
            <span className="px-2.5 py-1 text-xs font-mono font-bold bg-slate-100 dark:bg-white/10 rounded-xl text-[#0F172A] dark:text-white border border-black/5 dark:border-white/10">
              v{appVersion}
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 py-1">
              <div className="max-w-xl">
                <span className="text-sm font-semibold block">
                  {t.settings?.updates?.checkForUpdates || 'Check for updates'}
                </span>
                <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                  {t.settings?.updates?.checkForUpdatesDesc || 'Check GitHub releases for new features, audio improvements, and official installer upgrades.'}
                </p>
              </div>
              <button
                id="check-updates-btn"
                onClick={handleCheckUpdate}
                disabled={isCheckingUpdate || isDownloadingUpdate}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0F172A] dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <RefreshCw size={13} className={isCheckingUpdate ? 'animate-spin' : ''} />
                <span>
                  {isCheckingUpdate
                    ? (t.settings?.updates?.checking || 'Checking...')
                    : (t.settings?.updates?.checkNow || 'Check now')}
                </span>
              </button>
            </div>

            {updateInfo && updateInfo.hasUpdate && (
              <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
                    <span className="text-xs font-bold text-sky-950 dark:text-sky-200">
                      {(t.settings?.updates?.updateAvailable || 'Update {version} available').replace('{version}', updateInfo.latestVersion)}
                    </span>
                  </div>
                  {updateInfo.fileSize && (
                    <span className="text-[11px] font-mono text-sky-700 dark:text-sky-300">
                      {(updateInfo.fileSize / 1048576).toFixed(1)} MB
                    </span>
                  )}
                </div>

                {updateInfo.releaseNotes && (
                  <div className="p-3 bg-white/70 dark:bg-black/40 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 max-h-32 overflow-y-auto whitespace-pre-wrap select-text border border-sky-100 dark:border-sky-900/40">
                    {updateInfo.releaseNotes}
                  </div>
                )}

                {isDownloadingUpdate && updateProgress && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[11px] font-bold text-sky-900 dark:text-sky-200">
                      <span>{t.settings?.updates?.downloadingInstaller || 'Downloading official installer...'}</span>
                      <span>{updateProgress.percent}%</span>
                    </div>
                    <div className="w-full bg-sky-200 dark:bg-sky-900 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-sky-600 dark:bg-sky-400 h-full transition-all duration-200 rounded-full"
                        style={{ width: `${Math.max(updateProgress.percent, 3)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  {updateInfo.canAutoInstall ? (
                    <button
                      onClick={handleDownloadAndInstallUpdate}
                      disabled={isDownloadingUpdate}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <DownloadCloud size={14} />
                      <span>
                        {isDownloadingUpdate
                          ? (t.settings?.updates?.downloading || 'Downloading installer...')
                          : (t.settings?.updates?.installAndRestart || 'Install & Restart')}
                      </span>
                    </button>
                  ) : null}

                  {updateInfo.releaseUrl && (
                    <a
                      href={updateInfo.releaseUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2 bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/15 text-slate-800 dark:text-white rounded-xl text-xs font-semibold transition-all border border-slate-200 dark:border-white/15 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{t.settings?.updates?.viewOnGithub || 'View on GitHub'}</span>
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>
            )}

            {updateInfo && !updateInfo.hasUpdate && !updateInfo.error && (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/15 flex items-center gap-2.5 text-[#0F172A] dark:text-white text-xs font-medium animate-in fade-in">
                <CheckCircle2 size={16} className="shrink-0 text-[#0F172A] dark:text-white" />
                <span>
                  {(t.settings?.updates?.upToDateBanner || 'Otofy is up to date ({version}).').replace('{version}', updateInfo.currentVersion)}
                </span>
              </div>
            )}
          </div>
        </section>
      </div>

      {showRestartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white/95 dark:bg-[#111116] backdrop-blur-2xl border border-white/80 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-500">
              <AlertTriangle size={24} />
              <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                {t.settings?.restartModal?.title || 'Restart Required'}
              </h3>
            </div>
            <p className="text-xs text-[#475569] dark:text-white/70 leading-relaxed">
              {t.settings?.restartModal?.message || 'Hardware acceleration settings will take effect after restarting Otofy. Would you like to restart now?'}
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowRestartModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#64748B] dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                {t.settings?.restartModal?.later || 'Later'}
              </button>
              <button
                onClick={handleRelaunch}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0F172A] hover:bg-black dark:bg-white dark:hover:bg-white/90 text-white dark:text-black transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={14} />
                <span>{t.settings?.restartModal?.restartNow || 'Restart Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
