'use client'
import { useEffect } from 'react'
import { initAudioUnlock, subscribeToPushNotifications } from '@/lib/notifications'

export default function PWAProvider() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Initialize universal Audio unlock on first touch/click
    initAudioUnlock()

    // 2. Handle PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      window.deferredPWAEvent = e
      window.dispatchEvent(new CustomEvent('pwa-prompt-ready'))
    })

    // 3. Register Service Worker with robust auto-update checking
    if ('serviceWorker' in navigator) {
      let refreshing = false

      // When a new service worker takes over, reload once to ensure all new assets & features are active
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true
          console.log('[PWA] New version activated, refreshing application…')
          window.location.reload()
        }
      })

      const registerSW = async () => {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js')
          console.log('[PWA] Registered Service Worker scope:', reg.scope)

          // If a new worker is waiting, activate it immediately
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' })
          }

          // When a new update is found during the active session
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] New update ready. Activating…')
                  newWorker.postMessage({ type: 'SKIP_WAITING' })
                }
              })
            }
          })

          // Check for updates every 5 minutes automatically
          const updateInterval = setInterval(() => {
            reg.update().catch(() => {})
          }, 5 * 60 * 1000)

          // Also check for updates whenever user brings app back to foreground
          const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
              reg.update().catch(() => {})
            }
          }
          document.addEventListener('visibilitychange', onVisibilityChange)
          window.addEventListener('focus', () => reg.update().catch(() => {}))

          // Clean up on unmount
          window.addEventListener('beforeunload', () => {
            clearInterval(updateInterval)
            document.removeEventListener('visibilitychange', onVisibilityChange)
          }, { once: true })

          // If notification permission was granted, sync push subscription
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            subscribeToPushNotifications().catch(() => {})
          }
        } catch (err) {
          console.error('[PWA] SW Error:', err)
        }
      }

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        registerSW()
      } else {
        window.addEventListener('load', registerSW, { once: true })
      }
    }

    // 4. Capacitor Android native push auto-register
    if (window.Capacitor?.isNativePlatform?.()) {
      subscribeToPushNotifications().catch(() => {})
    }

    // 5. Desktop Electron App: periodic auto-refresh when idle to sync with web releases
    if (window.electronAPI?.isElectron || navigator.userAgent.includes('ApexTrackDesktop') || navigator.userAgent.includes('Electron')) {
      const desktopCheck = setInterval(() => {
        // If app has been open in background for 30+ mins, soft-check
        if (document.visibilityState === 'hidden') {
          // silently refresh cached chunks
          fetch('/api/version', { cache: 'no-store' }).then(r => r.json()).then(data => {
            if (data?.buildId && window.__APEX_BUILD_ID__ && data.buildId !== window.__APEX_BUILD_ID__) {
              window.location.reload()
            }
          }).catch(() => {})
        }
      }, 15 * 60 * 1000)

      return () => clearInterval(desktopCheck)
    }
  }, [])

  return null
}
