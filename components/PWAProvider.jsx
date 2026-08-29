'use client'
import { useEffect } from 'react'
import { initAudioUnlock } from '@/lib/notifications'

export default function PWAProvider() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 1. Initialize universal Audio unlock on first touch/click
      initAudioUnlock()

      // 2. Handle PWA install prompt
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault()
        window.deferredPWAEvent = e
        window.dispatchEvent(new CustomEvent('pwa-prompt-ready'))
      })

      // 3. Register Service Worker reliably across mobile & desktop
      if ('serviceWorker' in navigator) {
        const registerSW = () => {
          navigator.serviceWorker.register('/sw.js')
            .then((reg) => console.log('[PWA] Registered Service Worker scope:', reg.scope))
            .catch((err) => console.error('[PWA] SW Error:', err))
        }

        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          registerSW()
        } else {
          window.addEventListener('load', registerSW, { once: true })
        }
      }
    }
  }, [])

  return null
}
