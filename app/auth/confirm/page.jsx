'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

// Premium animated orb background similar to landing page
function OrbBackground() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let W = canvas.width  = canvas.offsetWidth
    let H = canvas.height = canvas.offsetHeight
    let raf
    const orbs = [
      { x: W * 0.2, y: H * 0.3, r: 250, vx: 0.15, vy: 0.08, color: 'rgba(20, 184, 166, 0.12)' },
      { x: W * 0.8, y: H * 0.7, r: 280, vx: -0.1, vy: 0.12, color: 'rgba(13, 148, 136, 0.09)' },
    ]
    function draw() {
      ctx.clearRect(0, 0, W, H)
      orbs.forEach(o => {
        o.x += o.vx; o.y += o.vy
        if (o.x < -o.r || o.x > W + o.r) o.vx *= -1
        if (o.y < -o.r || o.y > H + o.r) o.vy *= -1
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r)
        g.addColorStop(0, o.color)
        g.addColorStop(1, 'transparent')
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2)
        ctx.fillStyle = g; ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    const onResize = () => { if (canvas) { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight } }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [])
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
}

function LoadingUI() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0F172A' }}>
      <Loader2 size={40} className="animate-spin" color="#14B8A6" />
    </div>
  )
}

function ConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('verifying') // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState('Verifying your email and activating your account...')
  const isRunningActivation = useRef(false)

  useEffect(() => {
    if (isRunningActivation.current) return
    isRunningActivation.current = true

    async function handleConfirm() {
      try {
        const code = searchParams.get('code')
        let session = null

        // 1. If PKCE flow (has code query parameter), exchange code for session
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw new Error('Code exchange failed: ' + error.message)
          session = data?.session
        }

        // 2. Fetch current session if not set from code exchange
        if (!session) {
          const { data } = await supabase.auth.getSession()
          session = data?.session
        }

        if (!session?.user) {
          throw new Error('No active verification session found. Please sign up or request a new verification link.')
        }

        // 3. Call the backend API to securely activate user account
        const actRes = await fetch('/api/auth/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: session.user.id })
        })

        const actData = await actRes.json()

        if (!actRes.ok) {
          throw new Error(actData.error || 'Failed to activate account.')
        }

        setStatus('success')
        setMessage('Your email has been verified and your club profile is fully activated!')
      } catch (err) {
        console.error('Confirmation error:', err)
        setStatus('error')
        setMessage(err.message || 'An unexpected error occurred during activation.')
      }
    }

    handleConfirm()
  }, [searchParams])



  return (
    <div className="confirm-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        
        .confirm-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0F172A;
          font-family: 'Plus Jakarta Sans', sans-serif;
          position: relative;
          overflow: hidden;
          padding: 24px;
        }

        .confirm-card {
          width: 100%;
          max-width: 440px;
          background: rgba(30, 41, 59, 0.7);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 40px 32px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          text-align: center;
          position: relative;
          z-index: 10;
          animation: scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .logo-row {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 32px;
        }

        .logo-img {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          object-fit: contain;
        }

        .logo-text {
          font-size: 16px;
          font-weight: 800;
          color: #14B8A6;
          letter-spacing: -0.02em;
        }

        .logo-text span {
          color: #FFF;
          font-weight: 400;
        }

        .icon-wrapper {
          display: flex;
          justify-content: center;
          margin-bottom: 24px;
        }

        .heading {
          font-size: 22px;
          font-weight: 800;
          color: #FFF;
          margin-bottom: 12px;
          letter-spacing: -0.02em;
        }

        .subtext {
          font-size: 14px;
          color: #94A3B8;
          line-height: 1.6;
          margin-bottom: 32px;
        }

        .action-btn {
          width: 100%;
          padding: 13px;
          background: linear-gradient(135deg, #14B8A6, #0D9488);
          color: #FFF;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 10px 20px -5px rgba(20, 184, 166, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .action-btn:hover {
          transform: translateY(-1.5px);
          box-shadow: 0 12px 24px -5px rgba(20, 184, 166, 0.4);
        }

        .spin-loader {
          width: 48px;
          height: 48px;
          border: 3px solid rgba(20, 184, 166, 0.15);
          border-top-color: #14B8A6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .redirect-progress-bar {
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 2px;
          overflow: hidden;
          margin-top: 24px;
        }

        .redirect-progress-fill {
          height: 100%;
          background: #14B8A6;
          border-radius: 2px;
          transition: width 1s linear;
        }
      `}</style>
      <OrbBackground />

      <div className="confirm-card">
        {/* Logo Branding */}
        <div className="logo-row">
          <img src="/logo.png" alt="Apex Track" className="logo-img" />
          <div className="logo-text">Apex <span>Track</span></div>
        </div>

        {/* State UI */}
        {status === 'verifying' && (
          <div>
            <div className="icon-wrapper">
              <div className="spin-loader" />
            </div>
            <h2 className="heading">Activating Account</h2>
            <p className="subtext">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div className="icon-wrapper">
              <CheckCircle2 size={56} color="#14B8A6" style={{ filter: 'drop-shadow(0 0 12px rgba(20, 184, 166, 0.35))' }} />
            </div>
            <h2 className="heading">Account Activated!</h2>
            <p className="subtext">{message}</p>

            <button className="action-btn" onClick={() => router.replace('/login')}>
              Go to Login →
            </button>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="icon-wrapper">
              <XCircle size={56} color="#EF4444" style={{ filter: 'drop-shadow(0 0 12px rgba(239, 68, 68, 0.35))' }} />
            </div>
            <h2 className="heading">Activation Failed</h2>
            <p className="subtext">{message}</p>

            <button className="action-btn" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFF' }} onClick={() => router.replace('/login')}>
              Return to Login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<LoadingUI />}>
      <ConfirmContent />
    </Suspense>
  )
}
