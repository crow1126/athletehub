'use client'
import { useState, useEffect } from 'react'

export default function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Already running as installed standalone app — hide everything
    const mq = window.matchMedia('(display-mode: standalone)')
    if (mq.matches || window.navigator.standalone) {
      setIsInstalled(true)
      return
    }

    // Listen for browser-native install prompt (HTTPS only)
    const onBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    const onInstalled = () => {
      setDeferredPrompt(null)
      setInstalled(true)
      setShowModal(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // Don't render if already installed
  if (isInstalled || installed) return null

  const handleClick = async () => {
    if (deferredPrompt) {
      // Native prompt available (HTTPS / Vercel) — trigger directly
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setInstalled(true)
      }
    } else {
      // Localhost or browser without auto-prompt — show manual steps
      setShowModal(true)
    }
  }

  return (
    <>
      {/* ── Floating Install Button ── */}
      <button
        id="pwa-install-btn"
        onClick={handleClick}
        title="Install ApexTrack as a desktop or mobile app"
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
        {/* Download icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12M8 12l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>Install App</span>
        {/* Subtle pulsing ring for attention */}
        <span style={{
          position: 'absolute',
          inset: -3,
          borderRadius: 99,
          border: '2px solid rgba(13,148,136,0.4)',
          animation: 'installPulse 2s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      </button>

      {/* ── Modal ── */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              borderRadius: 24,
              maxWidth: 440,
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 30px 60px -12px rgba(0,0,0,0.3)',
              fontFamily: 'var(--font), system-ui, sans-serif',
            }}
          >
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #0F766E, #0D9488)', padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <img src="/logo.png" alt="ApexTrack" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'contain', background: '#fff', padding: 4 }} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>Install ApexTrack</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Desktop & Mobile App — Free</div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', width: 36, height: 36, borderRadius: '50%', fontSize: 20, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px 28px' }}>
              <p style={{ fontSize: 13, color: '#1E4433', lineHeight: 1.6, marginBottom: 20 }}>
                Install <strong>ApexTrack</strong> to get a dedicated desktop or mobile app — launch it from your taskbar or home screen without opening the browser.
              </p>

              {/* Windows/Mac Chrome & Edge */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  Windows / Mac — Chrome or Edge
                </div>
                <ol style={{ paddingLeft: 20, fontSize: 13, color: '#0F2218', lineHeight: 1.7, margin: 0 }}>
                  <li>Look at the browser <strong>address bar</strong> (top right)</li>
                  <li>Click the <strong>install icon</strong> — looks like a monitor with a down arrow ⤓</li>
                  <li>Click <strong>&quot;Install&quot;</strong> in the popup</li>
                  <li>ApexTrack opens in its own window and pins to your taskbar ✓</li>
                </ol>
              </div>

              <div style={{ height: 1, background: '#E8F7EE', margin: '16px 0' }} />

              {/* Mobile */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="18" r="1" fill="currentColor"/></svg>
                  iPhone / Android
                </div>
                <ol style={{ paddingLeft: 20, fontSize: 13, color: '#0F2218', lineHeight: 1.7, margin: 0 }}>
                  <li><strong>iPhone (Safari):</strong> Tap the <strong>Share</strong> button → &quot;Add to Home Screen&quot;</li>
                  <li><strong>Android (Chrome):</strong> Tap menu <strong>⋮</strong> → &quot;Add to Home Screen&quot; or &quot;Install app&quot;</li>
                </ol>
              </div>

              <div style={{ background: '#F0FBF4', border: '1px solid #86D4A8', borderRadius: 12, padding: '10px 14px', fontSize: 12, color: '#0F766E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                The install icon appears automatically in your browser address bar once the page loads on the live site.
              </div>

              <button
                onClick={() => setShowModal(false)}
                style={{ marginTop: 20, width: '100%', padding: 13, background: 'linear-gradient(135deg, #0F766E, #0D9488)', border: 'none', color: '#fff', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', letterSpacing: '-0.01em' }}
              >
                Got it — Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes installPulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 0; transform: scale(1.2); }
        }
      `}</style>
    </>
  )
}
