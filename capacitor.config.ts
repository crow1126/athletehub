import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'gh.apextrack.app',
  appName: 'ApexTrack GH',
  webDir: 'public',
  server: {
    // Points directly to the live production deployment so Vercel remains
    // the single source of truth without requiring native rebuilds for web changes.
    url: 'https://apextrackgh.com',
    cleartext: true,
    androidScheme: 'https',
    // Keep all navigation within the WebView — prevents Chrome from intercepting
    // links to the same domain and opening them in the browser instead of the app.
    allowNavigation: ['apextrackgh.com', '*.apextrackgh.com'],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0D9488',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0D9488',
      overlaysWebView: false,
    },
  },
};

export default config;
