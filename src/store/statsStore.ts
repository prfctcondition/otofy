import { create } from 'zustand';
import {
  getEventsByTimeRange,
  calculateAggregatedStats,
  type AggregatedStats,
} from '../db/analyticsDb';

export type StatsTimeRange = 'week' | 'month' | 'year' | 'all';

interface StatsStoreState {
  timeRange: StatsTimeRange;
  stats: AggregatedStats | null;
  isLoading: boolean;
  setTimeRange: (range: StatsTimeRange) => void;
  loadStats: () => Promise<void>;
}

export const useStatsStore = create<StatsStoreState>((set, get) => ({
  timeRange: 'week',
  stats: null,
  isLoading: false,

  setTimeRange: (range: StatsTimeRange) => {
    set({ timeRange: range });
    get().loadStats();
  },

  loadStats: async () => {
    set({ isLoading: true });
    try {
      const range = get().timeRange;
      const events = await getEventsByTimeRange(range);
      const computed = calculateAggregatedStats(events);
      set({ stats: computed, isLoading: false });
    } catch (err) {
      console.error('[StatsStore] Failed to load stats:', err);
      set({ isLoading: false });
    }
  },
}));
