'use client'

import React from 'react'
import { APEXTRACK_LOGO_BASE64 } from '@/lib/logoBase64'

/**
 * Traditional Loading Screen
 * Plain background and a small circular motion.
 */
export function TraditionalLoadingScreen({
  fullScreen = true,
  background = 'var(--floral, #F4FAF6)',
  spinnerColor = 'var(--lagoon, #0D9488)',
  spinnerTrack = 'var(--floral-muted, #E5F5EB)',
  size = 36,
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background,
        position: fullScreen ? 'fixed' : 'relative',
        inset: fullScreen ? 0 : 'auto',
        width: fullScreen ? '100vw' : '100%',
        height: fullScreen ? '100vh' : '100%',
        zIndex: fullScreen ? 99999 : 1,
      }}
      aria-label="Loading"
      role="status"
    >
      <div
        style={{
          width: size,
          height: size,
          border: `3px solid ${spinnerTrack}`,
          borderTopColor: spinnerColor,
          borderRadius: '50%',
          animation: 'atk-spin 0.7s linear infinite',
          boxSizing: 'border-box',
        }}
      />
      <style>{`
        @keyframes atk-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

/**
 * Branded Loading Animation
 * Soft, modern, warm-toned sports dashboard aesthetic:
 * Gentle pastel mint/emerald ambient glow on a clean light backdrop,
 * smooth rounded dual spinner rings, clean base64 club crest, 4s countdown subtitle,
 * and a synchronized 4-second linear progress bar.
 * Completely eliminates the sharp, harsh, pitch-black aesthetic.
 */
export function LoginLoadingScreen({
  title = null,
  subtitle = null,
  fullScreen = true,
  brandColor = '#0D9488',
  duration = 4,
}) {
  const [remaining, setRemaining] = React.useState(duration)
  const [progress, setProgress] = React.useState(0)

  React.useEffect(() => {
    const totalMs = Math.max(1, duration * 1000)
    const startTime = Date.now()

    // Immediate tick
    setProgress(0)
    setRemaining(duration)

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime
      const leftSec = Math.max(0, Math.ceil((totalMs - elapsed) / 1000))
      const pct = Math.min(100, (elapsed / totalMs) * 100)
      setRemaining(leftSec)
      setProgress(pct)

      if (elapsed >= totalMs) {
        setRemaining(0)
        setProgress(100)
        clearInterval(timer)
      }
    }, 50)

    return () => clearInterval(timer)
  }, [duration])

  const effectiveSubtitle = subtitle
    ? (remaining > 0 ? `${subtitle.replace(/\.?$/, '')} in ${remaining}s…` : 'Entering workspace…')
    : (remaining > 0 ? `Preparing workspace in ${remaining}s…` : 'Entering workspace…')

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 45%, #F4FAF6 75%, #FFFFFF 100%)',
        flexDirection: 'column',
        gap: 22,
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        overflow: 'hidden',
        position: fullScreen ? 'fixed' : 'relative',
        inset: fullScreen ? 0 : 'auto',
        width: fullScreen ? '100vw' : '100%',
        height: fullScreen ? '100vh' : '100%',
        zIndex: fullScreen ? 99999 : 1,
        color: '#0F2218',
      }}
      aria-label="Loading ApexTrack GH"
      role="status"
    >
      <style>{`
        @keyframes atk-orb-1 {
          0%, 100% { transform: translate(0px, 0px) scale(1); opacity: 0.35; }
          50% { transform: translate(-18px, -20px) scale(1.08); opacity: 0.55; }
        }
        @keyframes atk-orb-2 {
          0%, 100% { transform: translate(0px, 0px) scale(1); opacity: 0.3; }
          50% { transform: translate(20px, 16px) scale(0.95); opacity: 0.45; }
        }
        @keyframes atk-ring-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes atk-ring-spin-rev {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes atk-logo-pulse {
          0%, 100% {
            box-shadow: 0 10px 28px rgba(13, 148, 136, 0.12), 0 2px 8px rgba(0,0,0,0.04);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 16px 36px rgba(13, 148, 136, 0.22), 0 4px 12px rgba(0,0,0,0.06);
            transform: scale(1.025);
          }
        }
        @keyframes atk-dot-bounce {
          0%, 80%, 100% { transform: translateY(0) scale(0.75); opacity: 0.4; }
          40% { transform: translateY(-4px) scale(1.05); opacity: 1; }
        }
        @keyframes atk-fade-up {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Soft ambient background glow orbs — gentle pastel mint & teal */}
      <div
        style={{
          position: 'absolute',
          width: 520,
          height: 520,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(13,148,136,0.18) 0%, rgba(20,184,166,0.08) 45%, transparent 70%)',
          top: '-10%',
          left: '-8%',
          animation: 'atk-orb-1 8s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 440,
          height: 440,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(52,211,153,0.16) 0%, rgba(16,185,129,0.06) 45%, transparent 70%)',
          bottom: '-8%',
          right: '-6%',
          animation: 'atk-orb-2 9s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* Centerpiece: Soft-glow dual spinner + Clean Crest container */}
      <div
        style={{
          position: 'relative',
          width: 108,
          height: 108,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {/* Outer clockwise ring — emerald/teal arc with soft rounded ends */}
        <div
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            border: '2.5px solid rgba(13, 148, 136, 0.14)',
            borderTopColor: '#0D9488',
            borderRightColor: '#14B8A6',
            animation: 'atk-ring-spin 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
          }}
        />

        {/* Inner counter-clockwise ring — soft sage accent */}
        <div
          style={{
            position: 'absolute',
            inset: 3,
            borderRadius: '50%',
            border: '2px solid rgba(16, 185, 129, 0.12)',
            borderBottomColor: '#10B981',
            borderLeftColor: 'rgba(16, 185, 129, 0.35)',
            animation: 'atk-ring-spin-rev 2.2s linear infinite',
          }}
        />

        {/* Elevated circular crest badge */}
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: '50%',
            background: '#FFFFFF',
            border: '1px solid rgba(13, 148, 136, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 10,
            animation: 'atk-logo-pulse 2.8s ease-in-out infinite',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <img
            src={APEXTRACK_LOGO_BASE64}
            alt="ApexTrack GH"
            loading="eager"
            decoding="sync"
            onError={e => {
              if (e.currentTarget.src !== '/logo-loading.png') {
                e.currentTarget.src = '/logo-loading.png'
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              borderRadius: '50%',
              display: 'block',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      {/* Brand title & subtitle */}
      <div
        style={{
          textAlign: 'center',
          animation: 'atk-fade-up 0.5s 0.15s cubic-bezier(0.16,1,0.3,1) both',
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontSize: 21,
            fontWeight: 800,
            color: '#0F2218',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}
        >
          {title || (
            <>
              Apex<span style={{ color: brandColor }}>Track GH</span>
            </>
          )}
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#2D5540',
            marginTop: 6,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span>{effectiveSubtitle}</span>
        </div>
      </div>

      {/* Synchronized 4-second linear progress bar */}
      <div
        style={{
          width: 200,
          animation: 'atk-fade-up 0.5s 0.25s cubic-bezier(0.16,1,0.3,1) both',
          zIndex: 1,
        }}
      >
        <div
          style={{
            height: 4,
            background: 'rgba(13, 148, 136, 0.14)',
            borderRadius: 99,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #0D9488 0%, #10B981 60%, #34D399 100%)',
              borderRadius: 99,
              transition: 'width 0.1s linear',
              boxShadow: '0 0 8px rgba(13, 148, 136, 0.35)',
            }}
          />
        </div>
      </div>

      {/* Bouncing indicator dots */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          animation: 'atk-fade-up 0.5s 0.35s cubic-bezier(0.16,1,0.3,1) both',
          zIndex: 1,
        }}
      >
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: i === 1 ? '#0D9488' : 'rgba(13, 148, 136, 0.45)',
              animation: `atk-dot-bounce 1.2s ${i * 0.18}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * LoadingScreen
 *
 * If `variant="login"` (or if currently in login transition via sessionStorage 'apex_logging_in'):
 *   Renders the rich glowing login animation.
 * Otherwise ('traditional' or default non-login):
 *   Renders the traditional loading screen with a plain background and a small circular motion.
 */
export default function LoadingScreen({
  variant = 'auto', // 'auto' | 'traditional' | 'login'
  minDuration,      // optional override in ms
  ...props
}) {
  const isLogin = React.useMemo(() => {
    if (variant === 'login') return true
    if (variant === 'traditional') return false
    if (typeof window !== 'undefined') {
      try {
        return sessionStorage.getItem('apex_logging_in') === 'true'
      } catch (_e) {
        return false
      }
    }
    return false
  }, [variant])

  const durationSec = typeof minDuration === 'number' ? Math.ceil(minDuration / 1000) : 4

  if (isLogin) {
    return <LoginLoadingScreen {...props} duration={durationSec} />
  }

  return <TraditionalLoadingScreen {...props} />
}
