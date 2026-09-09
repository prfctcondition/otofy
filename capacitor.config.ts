import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zenmusic.app',
  appName: 'Zen Music',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
