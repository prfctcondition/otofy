import { create } from 'zustand';
import audioEngine from '../audio/AudioEngine';
import { EQ_PRESETS, DEFAULT_EQ_BANDS } from '../audio/presets';
import type { EqPreset } from '../types';

interface EqState {
  bands: number[];
  selectedPreset: string;
  isEnabled: boolean;
}

interface EqActions {
  setBand: (index: number, value: number) => void;
  applyPreset: (name: string) => void;
  toggleEnabled: () => void;
  resetToFlat: () => void;
}

export const useEqStore = create<EqState & EqActions>()((set, get) => ({
  bands: [...DEFAULT_EQ_BANDS],
  selectedPreset: 'Flat',
  isEnabled: true,

  setBand: (index, value) => {
    const clamped = Math.max(-12, Math.min(12, value));
    set(s => {
      const newBands = [...s.bands];
      newBands[index] = clamped;
      return { bands: newBands, selectedPreset: 'Custom' };
    });
    if (get().isEnabled) {
      audioEngine.setEqBand(index, clamped);
    }
  },

  applyPreset: (name) => {
    const preset = EQ_PRESETS.find(p => p.name === name);
    if (!preset) return;
    set({ bands: [...preset.bands], selectedPreset: name });
    if (get().isEnabled) {
      audioEngine.applyEqPreset(preset);
    }
  },

  toggleEnabled: () => {
    const { isEnabled, bands } = get();
    const newEnabled = !isEnabled;
    set({ isEnabled: newEnabled });
    if (newEnabled) {
      // Re-apply current bands
      bands.forEach((gain, i) => audioEngine.setEqBand(i, gain));
    } else {
      audioEngine.setEqEnabled(false);
    }
  },

  resetToFlat: () => {
    const flat = EQ_PRESETS.find(p => p.name === 'Flat')!;
    set({ bands: [...flat.bands], selectedPreset: 'Flat' });
    audioEngine.applyEqPreset(flat);
  },
}));
