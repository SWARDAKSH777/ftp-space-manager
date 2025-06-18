
import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.lovable.18de09bfc1a640ee8d9e011cfe08d362',
  appName: 'ftp-space-manager',
  webDir: 'dist',
  server: {
    url: 'https://18de09bf-c1a6-40ee-8d9e-011cfe08d362.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: true,
      spinnerColor: '#3b82f6'
    }
  }
};

export default config;
