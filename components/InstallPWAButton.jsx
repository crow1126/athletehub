'use client'
import { useState, useEffect } from 'react'

export default function InstallPWAButton({ style = {}, compact = false }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
      if (standalone) {
        setIsStandalone(true)
      }
    }

    const handleBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setIsStandalone(true)
      setShowModal(false)
      console.log('[PWA] App successfully installed')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      console.log(`[PWA] Choice outcome: ${outcome}`)
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
      }
    } else {
      setShowModal(true)
    }
  }

  // Hide button if already running inside installed standalone app
  if (isStandalone) return null

  return (
    <>
      <button
        id="pwa-install-btn"
        onClick={handleClick}
        title="Install ApexTrack Desktop / Mobile App"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'linear-gradient(135deg, #0F766E, #0D9488)',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 99,
          padding: compact ? '5px 12px' : '7px 16px',
          fontSize: compact ? 11 : 12,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)',
          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
          fontFamily: 'var(--font), system-ui, sans-serif',
          flexShrink: 0,
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

      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            animation: 'fadeUp 0.2s ease',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              maxWidth: 480,
              width: '100%',
              padding: 28,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #D4EDDE',
              fontFamily: 'var(--font), system-ui, sans-serif',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src="/apex-track-logo.svg" alt="ApexTrack" style={{ width: 40, height: 40, borderRadius: 10 }} />
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0F2218', margin: 0 }}>Install ApexTrack</h3>
                  <p style={{ fontSize: 12, color: '#5A7A68', margin: 0 }}>Desktop & Mobile App</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: '#F0FBF4', border: '1px solid #D4EDDE', width: 32, height: 32, borderRadius: '50%', fontSize: 18, cursor: 'pointer', color: '#1E4433', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: 13, color: '#1E4433', marginBottom: 16, lineHeight: 1.5 }}>
              Install <strong>ApexTrack</strong> as a native application on your laptop or phone for 1-click access without opening the browser.
            </p>

            <div style={{ background: '#F0FBF4', border: '1px solid #86D4A8', borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                How to install in your browser:
              </div>
              <ol style={{ paddingLeft: 18, fontSize: 13, color: '#0F2218', lineHeight: 1.6 }}>
                <li style={{ marginBottom: 6 }}>
                  Look at your browser&apos;s <strong>address bar (top right)</strong> for the <strong>Install icon</strong> (computer screen with down arrow).
                </li>
                <li style={{ marginBottom: 6 }}>
                  Or click Chrome / Edge menu <strong>(⋮) → Save and share → Install ApexTrack</strong>.
                </li>
                <li>
                  On Mobile (Safari / Chrome): Tap <strong>Share → Add to Home Screen</strong>.
                </li>
              </ol>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ flex: 1, padding: '11px', background: '#F0FBF4', border: '1px solid #D4EDDE', color: '#1E4433', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
