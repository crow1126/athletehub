'use client'

import React from 'react'
import { APEXTRACK_LOGO_BASE64 } from '@/lib/logoBase64'

export default function LoadingScreen({
  title = null,
  subtitle = 'Track. Achieve. Excel.',
  fullScreen = true,
  brandColor = '#2DD4BF',
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse 90% 70% at 50% 20%, #0D1C24 0%, #060E13 60%, #03080B 100%)',
        flexDirection: 'column',
        gap: 26,
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        overflow: 'hidden',
        position: fullScreen ? 'fixed' : 'relative',
        inset: fullScreen ? 0 : 'auto',
        width: fullScreen ? '100vw' : '100%',
        height: fullScreen ? '100vh' : '100%',
        zIndex: fullScreen ? 99999 : 1,
        color: '#FFFFFF',
      }}
      aria-label="Loading ApexTrack GH"
      role="status"
    >
      <style>{`
        @keyframes atk-orb-1 {
          0%, 100% { transform: translate(0px, 0px) scale(1); opacity: 0.22; }
          50% { transform: translate(-20px, -24px) scale(1.1); opacity: 0.35; }
        }
        @keyframes atk-orb-2 {
          0%, 100% { transform: translate(0px, 0px) scale(1); opacity: 0.16; }
          50% { transform: translate(24px, 18px) scale(0.92); opacity: 0.3; }
        }
        @keyframes atk-ring-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes atk-ring-spin-rev {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes atk-logo-glow {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(45,212,191,0), 0 16px 40px rgba(0,0,0,0.6);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 32px 10px rgba(45,212,191,0.28), 0 20px 50px rgba(0,0,0,0.7);
            transform: scale(1.02);
          }
        }
        @keyframes atk-bar-sweep {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes atk-dot-bounce {
          0%, 80%, 100% { transform: translateY(0) scale(0.7); opacity: 0.35; }
          40% { transform: translateY(-5px) scale(1.1); opacity: 1; }
        }
        @keyframes atk-fade-up {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Ambient background glow orbs */}
      <div
        style={{
          position: 'absolute',
          width: 480,
          height: 480,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(13,148,136,0.26) 0%, transparent 68%)',
          top: '-15%',
          left: '-10%',
          animation: 'atk-orb-1 7s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 360,
          height: 360,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(15,118,110,0.2) 0%, transparent 68%)',
          bottom: '-10%',
          right: '-8%',
          animation: 'atk-orb-2 8s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 70% 50% at 50% 45%, rgba(13,148,136,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Centerpiece: Dual-ring Spinner + Instant-Render White Logo */}
      <div
        style={{
          position: 'relative',
          width: 104,
          height: 104,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {/* Outer clockwise spinning ring with gradient tip */}
        <div
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            border: '2px solid rgba(45,212,191,0.12)',
            borderTopColor: '#2DD4BF',
            borderRightColor: 'rgba(45,212,191,0.4)',
            animation: 'atk-ring-spin 1.4s linear infinite',
          }}
        />

        {/* Inner counter-clockwise spinning ring */}
        <div
          style={{
            position: 'absolute',
            inset: 4,
            borderRadius: '50%',
            border: '1.5px solid rgba(13,148,136,0.14)',
            borderBottomColor: '#14B8A6',
            borderLeftColor: 'rgba(45,212,191,0.3)',
            animation: 'atk-ring-spin-rev 2s linear infinite',
          }}
        />

        {/* White circular logo container */}
        <div
          style={{
            width: 82,
            height: 82,
            borderRadius: '50%',
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 9,
            animation: 'atk-logo-glow 2.5s ease-in-out infinite',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {/* Synchronous data URL image: guaranteed to render frame 0 with zero pop-in */}
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
            color: '#F8FAFC',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
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
            fontSize: 10,
            color: '#94A3B8',
            marginTop: 5,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          {subtitle}
        </div>
      </div>

      {/* Shimmering progress bar */}
      <div
        style={{
          width: 170,
          animation: 'atk-fade-up 0.5s 0.25s cubic-bezier(0.16,1,0.3,1) both',
          zIndex: 1,
        }}
      >
        <div
          style={{
            height: 2.5,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 99,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, transparent 0%, #0D9488 25%, #2DD4BF 50%, #0D9488 75%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'atk-bar-sweep 1.5s linear infinite',
              borderRadius: 99,
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
              width: 5.5,
              height: 5.5,
              borderRadius: '50%',
              background: i === 1 ? '#2DD4BF' : 'rgba(45,212,191,0.45)',
              animation: `atk-dot-bounce 1.2s ${i * 0.18}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
