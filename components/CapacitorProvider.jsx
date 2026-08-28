'use client'
import { useEffect, useState } from 'react'
import { initAudioUnlock } from '@/lib/notifications'

export default function CapacitorProvider() {
  const [isOffline, setIsOffline] = useState(false)
  const [isNative, setIsNative] = useState(false)

  useEffect(() => {
    initAudioUnlock()
    let cleanup = () => {}

    async function initCapacitor() {
      try {
        const { Capacitor } = await import('@capacitor/core')
        const native = Capacitor.isNativePlatform()
        setIsNative(native)

        if (native) {
          // Initialize Status Bar
          const { StatusBar, Style } = await import('@capacitor/status-bar')
          try {
            await StatusBar.setStyle({ style: Style.Dark })
            await StatusBar.setBackgroundColor({ color: '#0D9488' })
          } catch (sbErr) {
            console.warn('Capacitor StatusBar init warning:', sbErr)
          }

          // Initialize Splash Screen
          const { SplashScreen } = await import('@capacitor/splash-screen')
          try {
            await SplashScreen.hide()
          } catch (ssErr) {
            console.warn('Capacitor SplashScreen hide warning:', ssErr)
          }
        }

        // Initialize Network Status Listener
        const { Network } = await import('@capacitor/network')
        const status = await Network.getStatus()
        setIsOffline(!status.connected)

        const handle = await Network.addListener('networkStatusChange', status => {
          setIsOffline(!status.connected)
        })

        cleanup = () => {
          handle.remove()
        }
      } catch (err) {
        console.warn('Capacitor plugins not active in browser environment:', err.message)
      }
    }

    initCapacitor()

    // Browser offline listeners as fallback
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      cleanup()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: 'linear-gradient(135deg, #B91C1C, #991B1B)',
        color: '#FFFFFF',
        padding: '10px 16px',
        fontSize: 13,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justify: 'center',
        gap: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      <span>No Internet Connection. ApexTrack GH will automatically reconnect when online.</span>
    </div>
  )
}
