// lib/appEnvironment.js
/**
 * Detects whether the current runtime environment is an installed or persistent app:
 * 1. Desktop PWA (Chrome/Edge installed standalone window)
 * 2. Saved to Home screen app (iOS Safari PWA, Android Chrome PWA)
 * 3. Android download app (Capacitor native app, Android WebView, APK)
 * 4. Desktop Electron app
 */
export function isPersistentAppEnvironment() {
  if (typeof window === 'undefined') return false

  // 1. Electron Desktop App
  if (window.electronAPI?.isElectron) return true

  // 2. Capacitor Native Mobile App (Android / iOS)
  if (window.Capacitor?.isNativePlatform?.() || window.Capacitor !== undefined) return true

  const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '') || ''

  if (
    ua.includes('Electron') ||
    ua.includes('ApexTrackDesktop') ||
    ua.includes('Capacitor')
  ) {
    return true
  }

  // 3. Android WebView / APK packaging
  if (ua.includes('Android') && (ua.includes('wv') || ua.includes('Version/4.0') || ua.includes('ApexTrack'))) {
    return true
  }

  // 4. iOS Safari "Add to Home Screen" (Saved to Home app standalone mode)
  if (window.navigator && window.navigator.standalone === true) {
    markStandalone()
    return true
  }

  // 5. Standard Web PWA standalone display mode (Desktop Chrome/Edge PWA, Android Chrome PWA)
  if (typeof window.matchMedia === 'function') {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches
    ) {
      markStandalone()
      return true
    }
  }

  // 6. Android TWA (Trusted Web Activity) / WebAPK referrer check
  if (typeof document !== 'undefined' && document.referrer && document.referrer.startsWith('android-app://')) {
    markStandalone()
    return true
  }

  // 7. Check if previously marked as standalone PWA in this local origin storage
  try {
    if (localStorage.getItem('apex_app_mode') === 'standalone') {
      return true
    }
  } catch {}

  // 8. HTML document classes
  if (typeof document !== 'undefined') {
    if (
      document.documentElement.classList.contains('is-electron') ||
      document.documentElement.classList.contains('is-native-app') ||
      document.documentElement.classList.contains('is-pwa')
    ) {
      return true
    }
  }

  return false
}

function markStandalone() {
  try {
    localStorage.setItem('apex_app_mode', 'standalone')
    if (typeof document !== 'undefined' && !document.documentElement.classList.contains('is-pwa')) {
      document.documentElement.classList.add('is-pwa')
    }
  } catch {}
}
