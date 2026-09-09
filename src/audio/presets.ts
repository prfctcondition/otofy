import type { EqPreset } from '../types';
export type { EqPreset };

export interface EqBandConfig {
  frequency: number;
  label: string;
}

export const EQ_BANDS: EqBandConfig[] = [
  { frequency: 32, label: '32Hz' },
  { frequency: 64, label: '64Hz' },
  { frequency: 125, label: '125Hz' },
  { frequency: 250, label: '250Hz' },
  { frequency: 500, label: '500Hz' },
  { frequency: 1000, label: '1kHz' },
  { frequency: 2000, label: '2kHz' },
  { frequency: 4000, label: '4kHz' },
  { frequency: 8000, label: '8kHz' },
  { frequency: 16000, label: '16kHz' },
];

export const EQ_PRESETS: EqPreset[] = [
  { name: 'Flat', bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Bass Boost', bands: [5.5, 4.5, 3.5, 2, 0.5, 0, 0, 0, 0, 0] },
  { name: 'Bass Reducer', bands: [-6, -5, -4, -2, -1, 0, 0, 0, 0, 0] },
  { name: 'Treble Boost', bands: [0, 0, 0, 0, 0, 1, 2.5, 4, 5.5, 6] },
  { name: 'Treble Reducer', bands: [0, 0, 0, 0, 0, -1, -2, -3.5, -5, -6] },
  { name: 'Rock', bands: [4.5, 3, -1, -2, -0.5, 1.5, 3.5, 4.5, 4.5, 5] },
  { name: 'Pop', bands: [-1.5, -0.5, 1.5, 3, 4, 3, 1, 0, -1, -1.5] },
  { name: 'Electronic', bands: [5, 4, 2, 0, -1.5, 1.5, 3, 4, 4.5, 4] },
  { name: 'Hip-Hop', bands: [6, 5, 2, 1, -1, -1, 1, 2, 3, 3.5] },
  { name: 'Acoustic', bands: [3, 2.5, 1.5, 1, 1.5, 2, 3, 3.5, 3, 2] },
  { name: 'Classical', bands: [4, 3, 2, 1.5, -1, -1, 0, 1.5, 2.5, 3] },
  { name: 'Vocal Boost', bands: [-2, -2, -1, 1.5, 3.5, 4, 3.5, 2, 0, -1] },
  { name: 'Deep Lounge', bands: [4.5, 3.5, 1, 1, -1, -0.5, 1, 2, 1.5, -1] },
  { name: 'R&B', bands: [2.5, 6, 4.5, 1, -1.5, -1, 1.5, 2.5, 3, 3.5] },
];

export const DEFAULT_EQ_BANDS = EQ_PRESETS[0].bands;
