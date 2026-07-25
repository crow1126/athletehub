'use client'
import { useState, useEffect } from 'react'

export default function InstallPWAButton() {
  const [isStandalone, setIsStandalone] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || window.electronAPI?.isElectron || navigator.userAgent.includes('Electron')) {
      setIsStandalone(true)
      return
    }

    const handlePromptReady = () => {}
    const handleInstalled = () => {
      window.deferredPWAEvent = null
      setInstalled(true)
    }

    window.addEventListener('pwa-prompt-ready', handlePromptReady)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('pwa-prompt-ready', handlePromptReady)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  if (isStandalone || installed) return null

  const handleClick = async () => {
    const promptEvent = window.deferredPWAEvent
    if (promptEvent) {
      promptEvent.prompt()
      const { outcome } = await promptEvent.userChoice
      if (outcome === 'accepted') {
        window.deferredPWAEvent = null
        setInstalled(true)
      }
    } else {
      alert('To install ApexTrack on your laptop/phone, click the Install (⤓) icon in your browser address bar at top right.')
    }
  }

  return (
    <button
      id="pwa-install-btn"
      onClick={handleClick}
      title="Install ApexTrack Desktop App"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'linear-gradient(135deg, #0F766E 0%, #0D9488 100%)',
        color: '#FFFFFF',
        border: 'none',
        borderRadius: 99,
        padding: '12px 20px',
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(13, 148, 136, 0.45), 0 2px 8px rgba(0,0,0,0.15)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        fontFamily: 'var(--font), system-ui, sans-serif',
        letterSpacing: '-0.01em',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)'
        e.currentTarget.style.boxShadow = '0 8px 28px rgba(13, 148, 136, 0.55), 0 4px 12px rgba(0,0,0,0.2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0) scale(1)'
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(13, 148, 136, 0.45), 0 2px 8px rgba(0,0,0,0.15)'
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12M8 12l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span>Install App</span>
    </button>
  )
}
