import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'gh.apextrack.app',
  appName: 'ApexTrack GH',
  webDir: 'public',
  server: {
    // Points directly to the live canonical URL so no 307 redirect occurs
    url: 'https://www.apextrackgh.com',
    cleartext: true,
    androidScheme: 'https',
    // Keep all navigation within the WebView — prevents Chrome from intercepting
    // links and opening them in the browser instead of the app.
    allowNavigation: [
      'www.apextrackgh.com',
      'apextrackgh.com',
      '*.apextrackgh.com',
      '*.supabase.co',
    ],
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
