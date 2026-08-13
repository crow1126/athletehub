'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/* ── Animated canvas orbs ── */
function OrbCanvas() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let W = canvas.width  = canvas.offsetWidth
    let H = canvas.height = canvas.offsetHeight
    let raf
    const orbs = [
      { x:W*0.15, y:H*0.3,  r:320, vx:0.18, vy:0.10, color:'rgba(13,148,136,0.12)' },
      { x:W*0.75, y:H*0.6,  r:260, vx:-0.12,vy:0.14, color:'rgba(20,184,166,0.08)' },
      { x:W*0.5,  y:H*0.85, r:380, vx:0.08, vy:-0.09,color:'rgba(13,148,136,0.07)'   },
      { x:W*0.88, y:H*0.12, r:200, vx:-0.16,vy:0.11, color:'rgba(20,184,166,0.06)' },
    ]
    function draw() {
      ctx.clearRect(0,0,W,H)
      orbs.forEach(o => {
        o.x += o.vx; o.y += o.vy
        if (o.x < -o.r || o.x > W+o.r) o.vx *= -1
        if (o.y < -o.r || o.y > H+o.r) o.vy *= -1
        const g = ctx.createRadialGradient(o.x,o.y,0,o.x,o.y,o.r)
        g.addColorStop(0, o.color)
        g.addColorStop(1, 'transparent')
        ctx.beginPath(); ctx.arc(o.x,o.y,o.r,0,Math.PI*2)
        ctx.fillStyle = g; ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    const onResize = () => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [])
  return <canvas ref={ref} style={{ position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:0 }}/>
}

export default function LoginPage() {
  const [tab,        setTab]       = useState('login')   // 'login' | 'signup'
  const [email,      setEmail]     = useState('')
  const [password,   setPassword]  = useState('')
  const [fullName,   setFullName]  = useState('')
  const [clubName,   setClubName]  = useState('')

  const [clubLogo,   setClubLogo]  = useState(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [showPass,   setShowPass]  = useState(false)
  const [loading,    setLoading]   = useState(false)
  const [error,      setError]     = useState('')
  const [success,    setSuccess]   = useState('')
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [disabled,   setDisabled]  = useState(false)
  const [subExpired, setSubExpired]= useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [isElectron, setIsElectron] = useState(false)
  const router   = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.electronAPI?.isElectron || navigator.userAgent.includes('Electron')) {
        setIsElectron(true)
      }
      const p = new URLSearchParams(window.location.search)
      if (p.get('reason') === 'disabled') setDisabled(true)
      if (p.get('reason') === 'profile_error') setError('Account profile lookup error. Please try again or contact support.')
      if (p.get('reason') === 'signed_out') setSuccess('You have been signed out.')
      if (p.get('reason') === 'subscription_expired') {
        setSubExpired(true); supabase.auth.signOut()
        return
      }
      if (p.get('tab') === 'signup') setTab('signup')
    }
    supabase.auth.getSession().then(async ({ data:{ session } }) => {
      if (session) {
        try {
          const { data:profile } = await supabase.from('profiles').select('is_active, role').eq('id',session.user.id).single()
          if (profile?.is_active !== false) {
            const isPaySub = typeof window !== 'undefined' && (window.location.hostname.startsWith('pay.apextrackgh.com') || window.location.hostname.startsWith('pay.localhost'))
            if (isPaySub) {
              window.location.href = '/'
            } else if (profile?.role === 'accountant') {
              if (window.electronAPI?.isElectron || (typeof navigator !== 'undefined' && (navigator.userAgent.includes('Electron') || navigator.userAgent.includes('ApexTrackDesktop')))) {
                window.location.href = '/pay'
                return
              }
              const host = window.location.host.replace(/^www\./i, '')
              const protocol = window.location.protocol
              const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(window.location.hostname)
              let redirectUrl = isIP
                ? `${protocol}//${host}/pay`
                : (host.startsWith('localhost:')
                  ? `${protocol}//pay.${host}`
                  : `${protocol}//pay.apextrackgh.com`)
              if (session) {
                redirectUrl += `#access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}`
              }
              window.location.href = redirectUrl
            } else if (profile?.role === 'superadmin') {
              router.replace('/superadmin')
            } else if (profile?.role === 'player') {
              router.replace('/player-hub')
            } else {
              router.replace('/dashboard')
            }
          }
        } catch (_e) { /* session check failed silently */ }
      }
    }).catch(()=>{})
  }, [])

  async function handleResendVerification() {
    const resendEmail = email.trim().toLowerCase()
    if (!resendEmail || !resendEmail.includes('@')) {
      setError('Enter your registered email address above, then resend verification.')
      return
    }
    setResendLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to resend verification email.')
      setSuccess(data.message || 'Verification email sent. Check your inbox.')
      setNeedsVerification(true)
    } catch (err) {
      setError(err.message || 'Failed to resend verification email.')
    }
    setResendLoading(false)
  }



  async function handleLogin(e) {
    e.preventDefault(); setError(''); setSuccess(''); setNeedsVerification(false)
    if (!email.trim()) { setError('Please enter your username or email address.'); return }
    if (!password)     { setError('Please enter your password.'); return }
    setLoading(true)
    try {
      let loginEmail = email.trim().toLowerCase()
      if (!loginEmail.includes('@')) {
        const resolveRes = await fetch(`/api/auth/resolve-username?username=${encodeURIComponent(loginEmail)}`)
        const resolveData = await resolveRes.json()
        if (resolveRes.ok && resolveData.email) {
          loginEmail = resolveData.email
        } else {
          setError(resolveData.error || 'Username not found.')
          setLoading(false)
          return
        }
      }

      const { data, error:authError } = await supabase.auth.signInWithPassword({ email:loginEmail, password })
      if (authError) {
        const msg = authError.message || ''
        const unconfirmed = msg.toLowerCase().includes('email not confirmed') || msg.toLowerCase().includes('confirm')
        if (unconfirmed) {
          setNeedsVerification(true)
          setError('Please confirm your email first. Check your inbox for "Confirm your email - Apex Track", or resend the link below.')
        } else {
          setError(msg.toLowerCase().includes('invalid') ? 'Incorrect username, email or password.' : msg)
        }
        setLoading(false); return
      }
      if (!data?.user) { setError('Login failed. Please try again.'); setLoading(false); return }
      const { data:profile } = await supabase.from('profiles').select('is_active, role, registration_status').eq('id',data.user.id).single()
      if (profile?.is_active === false) {
        await supabase.auth.signOut()
        if (profile?.registration_status === 'rejected') {
          setError('Your account has been disabled. Contact your administrator for assistance.')
        } else if (profile?.registration_status === 'pending') {
          setError('Your account is being set up. Please try again in a moment.')
        } else if (profile?.registration_status === 'pending_email_verification') {
          setNeedsVerification(true)
          setError('Please confirm your email before signing in. Open the "Confirm Email & Activate Account" link from your welcome email, or resend it below.')
        } else {
          setError('Your account is currently inactive. Contact your administrator.')
        }
        setLoading(false); return
      }
      const isPaySub = typeof window !== 'undefined' && (window.location.hostname.startsWith('pay.apextrackgh.com') || window.location.hostname.startsWith('pay.localhost'))
      if (isPaySub) {
        window.location.href = '/'
      } else if (profile?.role === 'accountant') {
        if (window.electronAPI?.isElectron || (typeof navigator !== 'undefined' && (navigator.userAgent.includes('Electron') || navigator.userAgent.includes('ApexTrackDesktop')))) {
          window.location.href = '/pay'
          return
        }
        const host = window.location.host.replace(/^www\./i, '')
        const protocol = window.location.protocol
        const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(window.location.hostname)
        let redirectUrl = isIP
          ? `${protocol}//${host}/pay`
          : (host.startsWith('localhost:')
            ? `${protocol}//pay.${host}`
            : `${protocol}//pay.apextrackgh.com`)
        
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          redirectUrl += `#access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}`
        }
        window.location.href = redirectUrl
      } else if (profile?.role === 'superadmin') {
        window.location.href = '/superadmin'
      } else if (profile?.role === 'player') {
        window.location.href = '/player-hub'
      } else {
        window.location.href = '/dashboard'
      }
    } catch(err) {
      setError(err.message?.includes('fetch') ? 'Cannot connect. Check your internet and try again.' : (err.message||'Unexpected error.'))
      setLoading(false)
    }
  }

  async function handleSignup(e) {
    e.preventDefault(); setError(''); setSuccess('')
    if (!fullName.trim()) { setError('Full name is required.'); return }
    if (!email.trim())    { setError('Email address is required.'); return }
    if (!clubName.trim()) { setError('Club / organisation name is required.'); return }
    if (!password || password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (!acceptedTerms) { setError('Please accept the Terms of Service and Privacy Policy to register.'); return }
    setLoading(true)
    try {
      // 1. Check if email is already registered
      const emailCheckRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const emailCheckData = await emailCheckRes.json()
      if (emailCheckData.exists) {
        setError('This email is already registered. Please sign in instead.')
        setLoading(false)
        return
      }

      // 2. Check if club name already exists
      const checkRes = await fetch(`/api/signup-provision?club_name=${encodeURIComponent(clubName.trim())}`)
      const checkData = await checkRes.json()
      if (checkData.exists) {
        setError('A club with this name is already registered.')
        setLoading(false)
        return
      }

      const { data, error:authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password,
        options:{
          data:{ full_name:fullName.trim(), club_name:clubName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/confirm`
        }
      })
      if (authError) { setError(authError.message); setLoading(false); return }
      if (data?.user) {
        let provTeamId = null
        try {
          const provRes = await fetch('/api/signup-provision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: data.user.id,
              full_name: fullName.trim(),
              club_name: clubName.trim(),
              email: email.trim().toLowerCase(),
            }),
          })
          const provData = await provRes.json()
          if (!provRes.ok) console.warn('Auto-provision warning:', provData.error)
          else provTeamId = provData.team_id
        } catch (provErr) {
          console.warn('Auto-provision failed (non-blocking):', provErr.message)
        }

        if (clubLogo && provTeamId) {
          try {
            const ext = clubLogo.name.split('.').pop()
            const path = `${provTeamId}/logo.${ext}`
            const { error: uploadErr } = await supabase.storage.from('athlete-photos').upload(path, clubLogo, { upsert: true })
            if (!uploadErr) {
              const logoUrl = supabase.storage.from('athlete-photos').getPublicUrl(path).data.publicUrl
              await supabase.from('profiles').update({ club_logo_url: logoUrl }).eq('id', data.user.id)
              await supabase.from('teams').update({ logo_url: logoUrl }).eq('id', provTeamId)
            }
          } catch (uploadErr) {
            console.warn('Logo upload failed (non-blocking):', uploadErr.message)
          }
        }
        setSuccess('Account created! Check your email for "Confirm your email - Apex Track" and click the button to activate. Then sign in here.')
        setTab('login'); setPassword(''); setFullName(''); setClubName(''); setClubLogo(null); setLogoPreview('')
      }
    } catch(err) { setError(err.message||'Unexpected error.') }
    setLoading(false)
  }

  const inp = {
    width:'100%', padding:'12px 16px',
    border:'1.5px solid #C8E0E0', borderRadius:10,
    fontSize:14, outline:'none',
    fontFamily:'Plus Jakarta Sans,sans-serif',
    color:'#003D3D', background:'#fff',
    boxSizing:'border-box',
    transition:'border-color 0.18s, box-shadow 0.18s',
  }
  const focusInp = e => { e.target.style.borderColor='#0D9488'; e.target.style.boxShadow='0 0 0 3px rgba(13,148,136,0.1)' }
  const blurInp  = e => { e.target.style.borderColor='#C8E0E0'; e.target.style.boxShadow='none' }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          background-color: #FFFFFF;
          background-image:
            radial-gradient(ellipse at 0% 0%, rgba(180, 220, 180, 0.45) 0%, transparent 55%),
            radial-gradient(ellipse at 5% 80%, rgba(180, 215, 175, 0.3) 0%, transparent 45%),
            radial-gradient(ellipse at 30% 30%, rgba(200, 230, 200, 0.25) 0%, transparent 50%),
            linear-gradient(to right, rgba(195, 225, 190, 0.3) 0%, rgba(220, 240, 220, 0.1) 40%, #FFFFFF 70%);
          background-attachment: fixed;
          color: #0F172A;
          overflow-x: hidden;
        }

        /* ── KEYFRAMES ── */
        @keyframes fadeUp   { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
        @keyframes shimmer  { 0% { background-position: 0% 50% } 50% { background-position: 100% 50% } 100% { background-position: 0% 50% } }
        @keyframes spin     { to { transform: rotate(360deg); } }

        /* ── NAVBAR ── */
        .lp-nav {
          position: absolute; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 48px; height: 72px;
          background: transparent;
        }
        .nav-brand {
          display: flex; align-items: center; gap: 10px;
          text-decoration: none;
        }
        .nav-brand-img {
          height: 38px; width: auto; border-radius: 8px; object-fit: contain;
        }
        .nav-brand-name {
          font-size: 18px; font-weight: 800; color: #0F172A;
          letter-spacing: -0.03em;
        }
        .nav-brand-name span { color: #0D9488; }
        
        .nav-back-link {
          font-size: 14px; font-weight: 600; color: #475569;
          text-decoration: none; display: flex; align-items: center; gap: 4px;
          transition: color 0.15s;
        }
        .nav-back-link:hover { color: #0D9488; }

        /* ── AUTH CONTAINER ── */
        .auth-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          background: transparent;
          padding: 100px 48px 32px;
          box-sizing: border-box;
          z-index: 1;
        }
        .auth-wrap {
          max-width: 1040px;
          width: 100%;
          margin: auto;
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          align-items: center;
          gap: 64px;
          opacity: 0; animation: fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s forwards;
          position: relative;
          z-index: 2;
        }
        .auth-left {
          display: flex;
          flex-direction: column;
        }
        .section-eyebrow { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 18px; }
        .eyebrow-line { width: 16px; height: 1.5px; background: #0D9488; }
        .eyebrow-text { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #0D9488; }
        .section-title { font-size: clamp(32px, 4.5vw, 48px); font-weight: 800; color: #0F172A; line-height: 1.1; letter-spacing: -0.03em; }
        .section-sub { font-size: 15px; color: #64748B; line-height: 1.6; margin-bottom: 28px; font-weight: 500; }

        /* Auth card */
        .auth-card {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 22px;
          box-shadow: 0 20px 48px rgba(15,23,42,0.06);
          position: relative;
          overflow: hidden;
          width: 100%;
          max-width: 460px;
          justify-self: end;
        }
        .auth-tabs { display: flex; border-bottom: 1px solid #F1F5F9; }
        .auth-tab {
          flex: 1; text-align: center; padding: 16px;
          font-size: 14px; font-weight: 700; color: #94A3B8;
          background: none; border: none; cursor: pointer;
          font-family: inherit; transition: all 0.18s;
          border-bottom: 2px solid transparent;
        }
        .auth-tab.active { color: #0D9488; border-bottom-color: #0D9488; background: rgba(13, 148, 136, 0.02); }
        .auth-tab:hover:not(.active) { color: #475569; background: #F8FAFC; }
        
        .auth-form { padding: 32px 28px 24px; display: flex; flex-direction: column; gap: 20px; }
        .auth-field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748B; margin-bottom: 6px; display: block; }
        
        .auth-trust {
          background: #F8FAFC; border-top: 1px solid #F1F5F9;
          padding: 16px 28px; display: flex; justify-content: space-between;
          font-size: 11px; font-weight: 600; color: #64748B;
        }
        .auth-trust-item { display: flex; align-items: center; gap: 6px; }

        .terms-check { display: flex; align-items: flex-start; gap: 10px; font-size: 12px; color: #64748B; line-height: 1.55; }
        .terms-check input { margin-top: 3px; flex-shrink: 0; accent-color: #0D9488; }

        /* ── FOOTER ── */
        .footer { background: transparent; padding: 24px 0 0; border-top: 1px solid #F1F5F9; width: 100%; max-width: 1040px; margin: 0 auto; position: relative; z-index: 2; }
        .footer-inner { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; padding-bottom: 16px; }
        .footer-brand { font-size: 15px; font-weight: 800; color: #0F172A; letter-spacing: -0.025em; }
        .footer-brand span { color: #0D9488; }
        .footer-links { display: flex; gap: 20px; flex-wrap: wrap; }
        .footer-link { font-size: 12px; color: #64748B; text-decoration: none; font-weight: 500; transition: color 0.15s; }
        .footer-link:hover { color: #0F172A; }
        .footer-copy { font-size: 11px; color: #94A3B8; text-align: center; padding-top: 12px; border-top: 1px solid #F1F5F9; }

        /* ── RESPONSIVE ── */
        @media(max-width:1024px) {
          .auth-wrap { grid-template-columns: 1fr; max-width: 480px; }
          .auth-left { display: none; }
          .auth-card { justify-self: center; }
        }
        @media(max-width:768px) {
          .lp-nav { padding: 0 20px; }
          .auth-container { padding: 88px 20px 24px; }
          .footer { padding-top: 16px; }
          .footer-inner { flex-direction: column; align-items: center; }
        }
      `}</style>

      {/* ── BACKGROUND CANVAS ORBS ── */}
      <OrbCanvas />

      {/* ── NAVBAR ── */}
      <nav className="lp-nav">
        <Link className="nav-brand" href="/">
          <img src="/logo.png" alt="ApexTrack" className="nav-brand-img" />
          <span className="nav-brand-name">Apex<span>Track</span></span>
        </Link>
        <Link href="/" className="nav-back-link">
          ← Back to Home
        </Link>
      </nav>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <div className="auth-container">
        <div className="auth-wrap">
          {/* Left copy */}
          <div className="auth-left">
            <div className="section-eyebrow">
              <div className="eyebrow-line" />
              <span className="eyebrow-text">Access</span>
            </div>
            <h2 className="section-title" style={{ marginBottom: 18, lineHeight: 1.1 }}>
              Your squad.<br />Your data.
            </h2>
            <p className="section-sub">
              Sign in to your club dashboard or register to bring your team onto the platform.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                'Real-time squad updates',
                'Injury alerts & recovery tracking',
                'Scheduled sessions & reports',
                'Club-scoped access & role permissions',
              ].map(pt => (
                <div key={pt} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(13, 148, 136, 0.1)', border: '1px solid rgba(13, 148, 136, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#0D9488" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                  <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>{pt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Auth card */}
          <div>
            {/* Progress bar */}
            <div style={{ height: 3, background: 'linear-gradient(90deg,#0D9488,#14B8A6,#99F6E4)', borderRadius: '22px 22px 0 0', backgroundSize: '200% 100%', animation: 'shimmer 2.5s ease infinite' }} />
            <div className="auth-card" style={{ borderRadius: '0 0 22px 22px', borderTop: 'none' }}>
              <div className="auth-tabs">
                <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError(''); setSuccess(''); }}>Sign In</button>
                <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => { setTab('signup'); setError(''); setSuccess(''); }}>Register</button>
              </div>

              {/* Logo row */}
              <div style={{ padding: '24px 28px 4px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src="/logo.png" alt="Apex Track Logo" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain', border: '1px solid rgba(13, 148, 136, 0.12)' }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0D9488', letterSpacing: '-0.02em' }}>Apex <span style={{ color: '#64748B', fontWeight: 400 }}>Track</span></div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94A3B8' }}>Performance Platform</div>
                </div>
              </div>

              {tab === 'login' ? (
                <form className="auth-form" onSubmit={handleLogin}>
                  <div>
                    <h3 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: 3 }}>Welcome back</h3>
                    <p style={{ fontSize: 13, color: '#64748B' }}>Sign in to your Apex Track account</p>
                  </div>

                  {disabled && <div style={{ background: '#F9E8E8', border: '1px solid rgba(180,50,50,0.2)', borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#8B2020', fontWeight: 600 }}>Account disabled. Contact your administrator.</div>}
                  {subExpired && <div style={{ background: '#FEF9E7', border: '1px solid rgba(183,119,13,0.3)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#7A5A0A' }}>Subscription cancelled. Contact your club admin.</div>}
                  {success && <div style={{ background: '#E8F8EE', border: '1px solid rgba(39,174,96,0.3)', borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#1B6B3A', fontWeight: 600 }}>{success}</div>}
                  {error && <div style={{ background: '#F9E8E8', border: '1px solid rgba(180,50,50,0.18)', borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#8B2020', fontWeight: 600 }}>{error}</div>}
                  {needsVerification && (
                    <button
                      type="button"
                      disabled={resendLoading}
                      onClick={handleResendVerification}
                      style={{ width: '100%', padding: '11px', background: 'rgba(13,148,136,0.08)', color: '#0D9488', border: '1px solid rgba(13,148,136,0.25)', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: resendLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                    >
                      {resendLoading ? 'Sending verification email…' : 'Resend confirmation email'}
                    </button>
                  )}

                  <div>
                    <label className="auth-field-label">Username or Email Address</label>
                    <input type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="Username or email" autoComplete="username" style={inp} onFocus={focusInp} onBlur={blurInp} />
                  </div>
                  <div>
                    <label className="auth-field-label">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" style={{ ...inp, paddingRight: 46 }} onFocus={focusInp} onBlur={blurInp} />
                      <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0, display: 'flex', alignItems: 'center' }}>{showPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                    </div>
                  </div>

                  <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', background: 'linear-gradient(135deg,#0D9488,#0F766E)', color: '#FFFFFF', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.7 : 1, boxShadow: '0 4px 14px rgba(13,148,136,0.3)', transition: 'all 0.2s' }}>
                    {loading ? <><span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#FFFFFF', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} /> Signing in…</> : 'Sign In →'}
                  </button>
                  <p style={{ textAlign: 'center', fontSize: 12, color: '#64748B' }}>
                    <Link href="/forgot-password" style={{ color: '#94A3B8', fontWeight: 600, textDecoration: 'none' }}>Forgot password?</Link>
                    {'  ·  '}
                    No account? <button type="button" onClick={() => { setTab('signup'); setError(''); }} style={{ background: 'none', border: 'none', color: '#0D9488', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Register here</button>
                  </p>
                </form>
              ) : (
                <form className="auth-form" onSubmit={handleSignup}>
                  <div>
                    <h3 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: 3 }}>Create account</h3>
                    <p style={{ fontSize: 13, color: '#64748B' }}>Join Apex Track — free to get started</p>
                  </div>

                  {error && <div style={{ background: '#F9E8E8', border: '1px solid rgba(180,50,50,0.18)', borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#8B2020', fontWeight: 600 }}>{error}</div>}
                  {success && <div style={{ background: '#E8F8EE', border: '1px solid rgba(39,174,96,0.3)', borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#1B6B3A', fontWeight: 600 }}>✓ {success}</div>}

                  <div>
                    <label className="auth-field-label">Full Name</label>
                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Kwame Mensah" style={inp} onFocus={focusInp} onBlur={blurInp} />
                  </div>
                  <div>
                    <label className="auth-field-label">Club / Organisation</label>
                    <input type="text" value={clubName} onChange={e => setClubName(e.target.value)} placeholder="e.g. Asante Kotoko SC" style={inp} onFocus={focusInp} onBlur={blurInp} />
                  </div>



                  <div>
                    <label className="auth-field-label">Club Logo <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10, color: '#94A3B8' }}>(optional)</span></label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#F0FDFA', border: '2px dashed #CCFBF1', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {logoPreview
                          ? <img src={logoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3.5" stroke="#94A3B8" strokeWidth="1.5"/><path d="M3 18c0-3.866 3.134-6 7-6s7 2.134 7 6" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        }
                      </div>
                      <div style={{ flex: 1 }}>
                        <label htmlFor="signup-logo" style={{ display: 'inline-block', background: '#F0FDFA', color: '#0D9488', border: '1px solid rgba(13,148,136,0.2)', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                          {logoPreview ? 'Change Logo' : 'Upload Logo'}
                        </label>
                        <input id="signup-logo" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                          const f = e.target.files[0]
                          if (!f) return
                          if (f.size > 2 * 1024 * 1024) { setError('Logo must be under 2MB.'); return }
                          setClubLogo(f)
                          setLogoPreview(URL.createObjectURL(f))
                        }} />
                        {logoPreview && <button type="button" onClick={() => { setClubLogo(null); setLogoPreview('') }} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#8B2020', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Remove</button>}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="auth-field-label">Email Address</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" style={inp} onFocus={focusInp} onBlur={blurInp} />
                  </div>
                  <div>
                    <label className="auth-field-label">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" autoComplete="new-password" style={{ ...inp, paddingRight: 46 }} onFocus={focusInp} onBlur={blurInp} />
                      <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0, display: 'flex', alignItems: 'center' }}>{showPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                    </div>
                  </div>

                  <label className="terms-check">
                    <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} />
                    <span>
                      I agree to the{' '}
                      <Link href="/terms" target="_blank" style={{ color: '#0D9488', fontWeight: 700 }}>Terms of Service</Link>
                      {' '}and{' '}
                      <Link href="/privacy" target="_blank" style={{ color: '#0D9488', fontWeight: 700 }}>Privacy Policy</Link>.
                      I confirm our club is authorised to store athlete data entered here.
                    </span>
                  </label>

                  <button type="submit" disabled={loading || !acceptedTerms} style={{ width: '100%', padding: '13px', background: 'linear-gradient(135deg,#0D9488,#0F766E)', color: '#FFFFFF', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading || !acceptedTerms ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading || !acceptedTerms ? 0.7 : 1, boxShadow: '0 4px 14px rgba(13,148,136,0.3)', transition: 'all 0.2s' }}>
                    {loading ? <><span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#FFFFFF', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} /> Creating account…</> : 'Create Account →'}
                  </button>

                  <p style={{ textAlign: 'center', fontSize: 12, color: '#64748B' }}>
                    Already registered? <button type="button" onClick={() => { setTab('login'); setError(''); }} style={{ background: 'none', border: 'none', color: '#0D9488', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Sign in</button>
                  </p>
                </form>
              )}


            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer className="footer">
          <div className="footer-inner">
            <div className="footer-brand">Apex<span>Track</span></div>
            <div className="footer-links">
              <Link href="/privacy" className="footer-link">Privacy Policy</Link>
              <Link href="/terms" className="footer-link">Terms of Service</Link>
              <Link href="/security" className="footer-link">Security</Link>
              <Link href="/" className="footer-link">Home</Link>
            </div>
          </div>
          <div className="footer-copy">© {new Date().getFullYear()} ApexTrack. All rights reserved. Built for African football.</div>
        </footer>
      </div>
    </>
  )
}
