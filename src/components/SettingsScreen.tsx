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
} from 'lucide-react';
import { useSettingsStore, StreamingQuality, AutoLaunchMode } from '../store/settingsStore';
import { useLibraryStore } from '../store/libraryStore';
import useToastStore from '../store/toastStore';

interface AudioDeviceOption {
  deviceId: string;
  label: string;
}

export const SettingsScreen: React.FC = () => {
  const settings = useSettingsStore();
  const navigateBack = useLibraryStore((s) => s.navigateBack);

  const [cacheSize, setCacheSize] = useState<string>('Calculating...');
  const [isClearingCache, setIsClearingCache] = useState<boolean>(false);
  const [audioDevices, setAudioDevices] = useState<AudioDeviceOption[]>([]);
  const [showRestartModal, setShowRestartModal] = useState<boolean>(false);

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
          setAudioDevices(outputs.length > 0 ? outputs : [{ deviceId: 'default', label: 'Default System Output' }]);
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
  }, []);

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      if (window.electronAPI?.clearCache) {
        await window.electronAPI.clearCache();
      }
      setCacheSize('0 MB');
      useToastStore.getState().success('Cache Cleared', 'Temporary files and network cache have been removed.');
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
        useToastStore.getState().success('Downloads Folder Updated', selected);
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

  return (
    <div
      id="settings-screen"
      className="flex-1 overflow-y-auto px-6 lg:px-12 py-8 select-none text-[#0F172A] dark:text-white"
    >
      {/* Top Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          id="settings-back-btn"
          onClick={navigateBack}
          className="p-2.5 rounded-full text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          title="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight drop-shadow-xs">Settings</h1>
          <p className="text-xs text-[#64748B] dark:text-white/60 font-medium mt-1">
            Configure playback, audio engine, startup behavior, and local storage.
          </p>
        </div>
      </div>

      <div className="max-w-4xl space-y-8 pb-16">
        {/* SECTION 1: Autoplay */}
        <section className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <Radio size={18} className="text-violet-600 dark:text-violet-400" />
            <h2 className="text-base font-bold">Autoplay</h2>
          </div>

          <div className="flex items-center justify-between gap-4 py-3">
            <div className="max-w-xl">
              <span className="text-sm font-semibold block">Autoplay similar tracks</span>
              <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                Enjoy non-stop listening. When your queue reaches the end, Otofy will automatically load and continue
                playing similar music.
              </p>
            </div>
            <button
              id="toggle-autoplay-btn"
              onClick={() => settings.setAutoplay(!settings.autoplay)}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                settings.autoplay ? 'bg-violet-600' : 'bg-slate-300 dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform transform shadow-sm ${
                  settings.autoplay ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </section>

        {/* SECTION 2: Audio Quality */}
        <section className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <Sparkles size={18} className="text-violet-600 dark:text-violet-400" />
            <h2 className="text-base font-bold">Audio Quality</h2>
          </div>

          <div className="space-y-4 divide-y divide-black/5 dark:divide-white/10">
            {/* Streaming Quality */}
            <div className="flex items-center justify-between gap-4 pt-1">
              <div>
                <span className="text-sm font-semibold block">Streaming quality</span>
                <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                  Select the audio stream quality. Higher bitrates provide studio clarity but consume more bandwidth.
                </p>
              </div>
              <select
                id="select-streaming-quality"
                value={settings.streamingQuality}
                onChange={(e) => settings.setStreamingQuality(e.target.value as StreamingQuality)}
                className="bg-white/80 dark:bg-[#181820] border border-black/10 dark:border-white/15 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-violet-500 cursor-pointer shadow-xs"
              >
                <option value="low">Low (128 kbps)</option>
                <option value="normal">Normal (160 kbps)</option>
                <option value="high">High (320 kbps / Best)</option>
              </select>
            </div>

            {/* Auto Adjust Quality */}
            <div className="flex items-center justify-between gap-4 pt-4">
              <div className="max-w-xl">
                <span className="text-sm font-semibold block">Auto-adjust quality</span>
                <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                  Automatically downscale streaming quality during network slowdowns or extended buffer delays.
                </p>
              </div>
              <button
                id="toggle-auto-adjust-quality-btn"
                onClick={() => settings.setAutoAdjustQuality(!settings.autoAdjustQuality)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  settings.autoAdjustQuality ? 'bg-violet-600' : 'bg-slate-300 dark:bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform transform shadow-sm ${
                    settings.autoAdjustQuality ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 3: Playback & Web Audio */}
        <section className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <Volume2 size={18} className="text-violet-600 dark:text-violet-400" />
            <h2 className="text-base font-bold">Playback</h2>
          </div>

          <div className="space-y-4 divide-y divide-black/5 dark:divide-white/10">
            {/* Crossfade Songs */}
            <div className="pt-1">
              <div className="flex items-center justify-between gap-4">
                <div className="max-w-xl">
                  <span className="text-sm font-semibold block">Crossfade songs</span>
                  <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                    Seamlessly transition between songs using the Dual Deck (A/B) Web Audio engine.
                  </p>
                </div>
                <button
                  id="toggle-crossfade-btn"
                  onClick={() => settings.setCrossfadeEnabled(!settings.crossfadeEnabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    settings.crossfadeEnabled ? 'bg-violet-600' : 'bg-slate-300 dark:bg-white/20'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform transform shadow-sm ${
                      settings.crossfadeEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {settings.crossfadeEnabled && (
                <div className="mt-4 pl-4 border-l-2 border-violet-500/40 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[#64748B] dark:text-white/70">Crossfade transition duration:</span>
                    <span className="px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300">
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
                    className="w-full accent-violet-600 cursor-pointer h-1.5 bg-slate-200 dark:bg-white/20 rounded-lg appearance-none"
                  />
                </div>
              )}
            </div>

            {/* Normalize Volume */}
            <div className="flex items-center justify-between gap-4 pt-4">
              <div className="max-w-xl">
                <span className="text-sm font-semibold block">Normalize volume</span>
                <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                  Set the same loudness level for all tracks using the studio-grade dynamic compressor.
                </p>
              </div>
              <button
                id="toggle-normalize-volume-btn"
                onClick={() => settings.setNormalizeVolume(!settings.normalizeVolume)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  settings.normalizeVolume ? 'bg-violet-600' : 'bg-slate-300 dark:bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform transform shadow-sm ${
                    settings.normalizeVolume ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Mono Audio */}
            <div className="flex items-center justify-between gap-4 pt-4">
              <div className="max-w-xl">
                <span className="text-sm font-semibold block">Mono audio</span>
                <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                  Combine stereo left and right channels into a single mono output for single-speaker listening.
                </p>
              </div>
              <button
                id="toggle-mono-audio-btn"
                onClick={() => settings.setMonoAudio(!settings.monoAudio)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  settings.monoAudio ? 'bg-violet-600' : 'bg-slate-300 dark:bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform transform shadow-sm ${
                    settings.monoAudio ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Audio Output Device */}
            <div className="flex items-center justify-between gap-4 pt-4">
              <div className="max-w-xl">
                <span className="text-sm font-semibold block">Audio output device</span>
                <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                  Select specific speakers, headphones, or external audio interfaces.
                </p>
              </div>
              <select
                id="select-audio-output-device"
                value={settings.audioOutputDeviceId}
                onChange={(e) => settings.setAudioOutputDeviceId(e.target.value)}
                className="max-w-xs bg-white/80 dark:bg-[#181820] border border-black/10 dark:border-white/15 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-violet-500 cursor-pointer shadow-xs truncate"
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

        {/* SECTION 4: Startup and Window Behaviour */}
        <section className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <Monitor size={18} className="text-violet-600 dark:text-violet-400" />
            <h2 className="text-base font-bold">Startup and Window Behaviour</h2>
          </div>

          <div className="space-y-4 divide-y divide-black/5 dark:divide-white/10">
            {/* Open automatically at login */}
            <div className="flex items-center justify-between gap-4 pt-1">
              <div>
                <span className="text-sm font-semibold block">Open Otofy automatically at computer login</span>
                <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                  Launch the application automatically when Windows starts.
                </p>
              </div>
              <select
                id="select-auto-launch"
                value={settings.autoLaunch}
                onChange={(e) => settings.setAutoLaunch(e.target.value as AutoLaunchMode)}
                className="bg-white/80 dark:bg-[#181820] border border-black/10 dark:border-white/15 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-violet-500 cursor-pointer shadow-xs"
              >
                <option value="no">No (disabled)</option>
                <option value="yes">Yes (open window)</option>
                <option value="minimized">Minimized (start in tray)</option>
              </select>
            </div>

            {/* Close button minimize to tray */}
            <div className="flex items-center justify-between gap-4 pt-4">
              <div className="max-w-xl">
                <span className="text-sm font-semibold block">Close button minimizes to tray</span>
                <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                  Clicking the close button ('X') hides the window to the system tray. The minimize button ('-') continues
                  to minimize to the taskbar.
                </p>
              </div>
              <button
                id="toggle-close-to-tray-btn"
                onClick={() => settings.setCloseToTray(!settings.closeToTray)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  settings.closeToTray ? 'bg-violet-600' : 'bg-slate-300 dark:bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform transform shadow-sm ${
                    settings.closeToTray ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 5: Storage & Downloads */}
        <section className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <FolderDown size={18} className="text-violet-600 dark:text-violet-400" />
            <h2 className="text-base font-bold">Storage & Downloads</h2>
          </div>

          <div className="space-y-4 divide-y divide-black/5 dark:divide-white/10">
            {/* Cache Row */}
            <div className="flex items-center justify-between gap-4 pt-1">
              <div>
                <span className="text-sm font-semibold block">Local cache</span>
                <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                  Temporary audio streams, artwork previews, and cached metadata.
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
                  <span>{isClearingCache ? 'Clearing...' : 'Clear cache'}</span>
                </button>
              </div>
            </div>

            {/* Downloads Location */}
            <div className="pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold block">Downloads location</span>
                  <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                    Default folder for future offline downloads.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    id="open-downloads-folder-btn"
                    onClick={handleOpenDownloadsFolder}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Open in Windows Explorer"
                  >
                    <FolderOpen size={13} />
                    <span>Open in Explorer</span>
                  </button>
                  <button
                    id="change-downloads-folder-btn"
                    onClick={handleChangeDownloadsFolder}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <FolderSync size={13} />
                    <span>Change</span>
                  </button>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-black/40 border border-black/5 dark:border-white/10 font-mono text-[11px] text-[#475569] dark:text-white/60 break-all select-text">
                {settings.downloadsPath || 'C:\\Users\\...\\AppData\\Roaming\\Otofy\\Downloads'}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6: System & Performance */}
        <section className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <Cpu size={18} className="text-violet-600 dark:text-violet-400" />
            <h2 className="text-base font-bold">System & Performance</h2>
          </div>

          <div className="flex items-center justify-between gap-4 py-1">
            <div className="max-w-xl">
              <span className="text-sm font-semibold block">Hardware acceleration</span>
              <p className="text-xs text-[#64748B] dark:text-white/60 mt-0.5">
                Utilize GPU rendering for buttery smooth animations and liquid glass UI effects. Requires restarting the
                app to apply.
              </p>
            </div>
            <button
              id="toggle-hardware-acceleration-btn"
              onClick={handleToggleHwAccel}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                settings.hardwareAcceleration ? 'bg-violet-600' : 'bg-slate-300 dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform transform shadow-sm ${
                  settings.hardwareAcceleration ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </section>
      </div>

      {/* Restart Prompt Modal */}
      {showRestartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white/95 dark:bg-[#111116] backdrop-blur-2xl border border-white/80 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-500">
              <AlertTriangle size={24} />
              <h3 className="text-base font-bold text-[#0F172A] dark:text-white">Restart Required</h3>
            </div>
            <p className="text-xs text-[#475569] dark:text-white/70 leading-relaxed">
              Hardware acceleration settings will take effect after restarting Otofy. Would you like to restart now?
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowRestartModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#64748B] dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                Later
              </button>
              <button
                onClick={handleRelaunch}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={14} />
                <span>Restart Now</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
