import { create } from 'zustand';
import useToastStore from './toastStore';

interface NetworkState {
  isOnline: boolean;
  initNetworkListeners: () => () => void;
}

export const useNetworkStore = create<NetworkState>()((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

  initNetworkListeners: () => {
    if (typeof window === 'undefined') return () => {};

    const handleOnline = () => {
      set({ isOnline: true });
      useToastStore.getState().success('Back Online', 'Internet connection restored.');
    };

    const handleOffline = () => {
      set({ isOnline: false });
      useToastStore.getState().warning(
        'Offline Mode',
        'No internet connection. Only downloaded and cached tracks are playable.'
      );
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  },
}));

export default useNetworkStore;
