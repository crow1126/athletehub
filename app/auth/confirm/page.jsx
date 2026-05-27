'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  const [status, setStatus] = useState('verifying') // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState('Verifying your email and activating your account...')
  const isRunningActivation = useRef(false)

  useEffect(() => {
    // Prevent multiple parallel activation executions
    if (isRunningActivation.current) return

    async function handleConfirm() {
      // Get parameters directly from window to bypass Next.js hydration lag
      if (typeof window === 'undefined') return

      const queryParams = new URLSearchParams(window.location.search)
      const activated = queryParams.get('activated')
      const callbackError = queryParams.get('error')

      if (activated === '1') {
        await supabase.auth.signOut()
        setStatus('success')
        setMessage('Your email has been verified and your club profile is fully activated!')
        return
      }

      if (callbackError) {
        setStatus('error')
        setMessage(decodeURIComponent(callbackError))
        return
      }
      
      const code = queryParams.get('code')
      const tokenHash = queryParams.get('token_hash')
      const type = queryParams.get('type')
      const hasHashToken = window.location.hash.includes('access_token') || window.location.hash.includes('refresh_token')

      // Check if we already have an active session in local storage
      const { data: initialSessionData } = await supabase.auth.getSession()
      let session = initialSessionData?.session

      // If we don't have a session, and there is no code/token/hash in the URL, then we can't verify
      if (!session && !code && !tokenHash && !hasHashToken) {
        setStatus('error')
        setMessage('No active verification session found. Please sign up or request a new verification link.')
        return
      }

      // Mark as running once we know we have a valid context to process
      isRunningActivation.current = true

      try {
        // 1. If we have a code (PKCE flow), send to server callback
        if (code || (tokenHash && type)) {
          window.location.replace(`/auth/callback${window.location.search}`)
          return
        }

        // 2. Handle legacy hash-token links on this page
        if (!session && hasHashToken) {
          console.log('Waiting for hash token session parsing...')
          session = await new Promise((resolve) => {
            let resolved = false
            
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
              if (currentSession && !resolved) {
                resolved = true
                subscription.unsubscribe()
                resolve(currentSession)
              }
            })

            // Timeout after 5 seconds
            setTimeout(() => {
              if (!resolved) {
                resolved = true
                subscription.unsubscribe()
                resolve(null)
              }
            }, 5000)
          })
        }

        // 4. Final session check
        if (!session?.user) {
          throw new Error('No active verification session found. Please sign up or request a new verification link.')
        }

        console.log('User session verified:', session.user.email)

        // 5. Call the backend API to securely activate user account
        const actRes = await fetch('/api/auth/activate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ user_id: session.user.id })
        })

        const actData = await actRes.json()

        if (!actRes.ok) {
          throw new Error(actData.error || 'Failed to activate account.')
        }

        // End the verification session so the user signs in manually on /login
        await supabase.auth.signOut()

        setStatus('success')
        setMessage('Your email has been verified and your club profile is fully activated!')
      } catch (err) {
        console.error('Confirmation error:', err)
        setStatus('error')
        setMessage(err.message || 'An unexpected error occurred during activation.')
        // Reset so user can retry if they click again or refresh
        isRunningActivation.current = false
      }
    }

    handleConfirm()
  }, [])



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

            <button
              className="action-btn"
              onClick={async () => {
                await supabase.auth.signOut()
                router.replace('/login')
              }}
            >
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
