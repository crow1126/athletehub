'use client'
import { useState, useEffect } from 'react'

export default function InstallPWAButton({ style = {}, compact = false }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Check if app is already running in standalone mode
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
      if (isStandalone) {
        setInstalled(true)
      }
    }

    const handleBeforeInstall = (e) => {
      // Prevent automatic browser banner
      e.preventDefault()
      // Store event for triggering on click
      setDeferredPrompt(e)
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setInstalled(true)
      console.log('[PWA] App successfully installed')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    // Show prompt
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log(`[PWA] User choice outcome: ${outcome}`)
    setDeferredPrompt(null)
  }

  // Only render when the prompt is available and app is not installed
  if (!deferredPrompt || installed) return null

  return (
    <button
      id="pwa-install-btn"
      onClick={handleInstallClick}
      title="Install ApexTrack Desktop/Mobile App"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'linear-gradient(135deg, #0F766E, #0D9488)',
        color: '#FFFFFF',
        border: 'none',
        borderRadius: 99,
        padding: compact ? '5px 10px' : '6px 14px',
        fontSize: compact ? 11 : 12,
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)',
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        fontFamily: 'inherit',
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(13, 148, 136, 0.35)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(13, 148, 136, 0.25)'
      }}
    >
      <svg width={compact ? 12 : 14} height={compact ? 12 : 14} viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5v9M4.5 7L8 10.5 11.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2.5 13.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
      <span>{compact ? 'Install' : 'Install App'}</span>
    </button>
  )
}
