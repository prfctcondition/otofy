import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.otofy.app',
  appName: 'Otofy',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
