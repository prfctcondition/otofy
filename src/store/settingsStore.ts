import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import audioEngine from '../audio/AudioEngine';

export type StreamingQuality = 'low' | 'normal' | 'high';
export type AutoLaunchMode = 'no' | 'yes' | 'minimized';

export interface SettingsState {
  // 1. Autoplay
  autoplay: boolean;

  // 2. Audio Quality
  streamingQuality: StreamingQuality;
  autoAdjustQuality: boolean;

  // 3. Playback
  crossfadeEnabled: boolean;
  crossfadeDuration: number; // in seconds (1 - 12)
  normalizeVolume: boolean;
  monoAudio: boolean;
  audioOutputDeviceId: string;

  // 4. Startup and Window Behaviour
  autoLaunch: AutoLaunchMode;
  closeToTray: boolean;

  // 5. Storage & Downloads
  downloadsPath: string;

  // 6. System / Performance
  hardwareAcceleration: boolean;

  // Actions
  setAutoplay: (autoplay: boolean) => void;
  setStreamingQuality: (streamingQuality: StreamingQuality) => void;
  setAutoAdjustQuality: (autoAdjustQuality: boolean) => void;
  setCrossfadeEnabled: (crossfadeEnabled: boolean) => void;
  setCrossfadeDuration: (crossfadeDuration: number) => void;
  setNormalizeVolume: (normalizeVolume: boolean) => void;
  setMonoAudio: (monoAudio: boolean) => void;
  setAudioOutputDeviceId: (deviceId: string) => Promise<void>;
  setAutoLaunch: (autoLaunch: AutoLaunchMode) => Promise<void>;
  setCloseToTray: (closeToTray: boolean) => Promise<void>;
  setDownloadsPath: (downloadsPath: string) => void;
  setHardwareAcceleration: (hardwareAcceleration: boolean) => Promise<void>;
  initFromSystem: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      autoplay: true,
      streamingQuality: 'high',
      autoAdjustQuality: true,
      crossfadeEnabled: false,
      crossfadeDuration: 3,
      normalizeVolume: false,
      monoAudio: false,
      audioOutputDeviceId: 'default',
      autoLaunch: 'no',
      closeToTray: false,
      downloadsPath: '',
      hardwareAcceleration: true,

      setAutoplay: (autoplay) => set({ autoplay }),

      setStreamingQuality: (streamingQuality) => set({ streamingQuality }),

      setAutoAdjustQuality: (autoAdjustQuality) => set({ autoAdjustQuality }),

      setCrossfadeEnabled: (crossfadeEnabled) => set({ crossfadeEnabled }),

      setCrossfadeDuration: (crossfadeDuration) => {
        const clamped = Math.max(1, Math.min(12, Math.round(crossfadeDuration)));
        set({ crossfadeDuration: clamped });
      },

      setNormalizeVolume: (normalizeVolume) => {
        set({ normalizeVolume });
        audioEngine.setNormalizeVolume(normalizeVolume);
      },

      setMonoAudio: (monoAudio) => {
        set({ monoAudio });
        audioEngine.setMonoAudio(monoAudio);
      },

      setAudioOutputDeviceId: async (deviceId) => {
        set({ audioOutputDeviceId: deviceId });
        await audioEngine.setOutputDevice(deviceId);
      },

      setAutoLaunch: async (autoLaunch) => {
        set({ autoLaunch });
        if (window.electronAPI?.setAutoLaunch) {
          await window.electronAPI.setAutoLaunch(autoLaunch);
        }
      },

      setCloseToTray: async (closeToTray) => {
        set({ closeToTray });
        if (window.electronAPI?.setCloseToTray) {
          await window.electronAPI.setCloseToTray(closeToTray);
        }
      },

      setDownloadsPath: (downloadsPath) => set({ downloadsPath }),

      setHardwareAcceleration: async (hardwareAcceleration) => {
        set({ hardwareAcceleration });
        if (window.electronAPI?.setHardwareAcceleration) {
          await window.electronAPI.setHardwareAcceleration(hardwareAcceleration);
        }
      },

      initFromSystem: async () => {
        if (!window.electronAPI) return;

        // Apply audio settings to AudioEngine on launch
        const state = get();
        audioEngine.setNormalizeVolume(state.normalizeVolume);
        audioEngine.setMonoAudio(state.monoAudio);
        if (state.audioOutputDeviceId && state.audioOutputDeviceId !== 'default') {
          await audioEngine.setOutputDevice(state.audioOutputDeviceId);
        }

        try {
          if (window.electronAPI.getConfig) {
            const cfg = await window.electronAPI.getConfig();
            if (cfg) {
              set({
                hardwareAcceleration: cfg.hardwareAcceleration ?? state.hardwareAcceleration,
                closeToTray: cfg.closeToTray ?? state.closeToTray,
                autoLaunch: (cfg.autoLaunch as AutoLaunchMode) ?? state.autoLaunch,
              });
            }
          }

          if (window.electronAPI.getDownloadsPath) {
            const dlPath = await window.electronAPI.getDownloadsPath();
            if (dlPath) {
              set({ downloadsPath: dlPath });
            }
          }
        } catch (err) {
          console.warn('[SettingsStore] Failed to initialize from system:', err);
        }
      },
    }),
    {
      name: 'otofy-settings',
    }
  )
);
