'use client'
import { useEffect } from 'react'

export default function PWAProvider() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => {
            console.log('[PWA] Service worker registered:', reg.scope)
          })
          .catch((err) => {
            console.error('[PWA] Service worker registration failed:', err)
          })
      })
    }
  }, [])

  return null
}
