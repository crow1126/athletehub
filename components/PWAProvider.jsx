'use client'
import { useEffect } from 'react'

export default function PWAProvider() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault()
        window.deferredPWAEvent = e
        window.dispatchEvent(new CustomEvent('pwa-prompt-ready'))
      })

      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js')
            .then((reg) => console.log('[PWA] Registered:', reg.scope))
            .catch((err) => console.error('[PWA] SW Error:', err))
        })
      }
    }
  }, [])

  return null
}
