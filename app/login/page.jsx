'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { BarChart3, Activity, Users, Calendar, Search, Lock, FileText, DollarSign, ActivitySquare, Shield } from 'lucide-react'

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
      { x:W*0.15, y:H*0.3,  r:320, vx:0.18, vy:0.10, color:'rgba(0,106,106,0.16)' },
      { x:W*0.75, y:H*0.6,  r:260, vx:-0.12,vy:0.14, color:'rgba(0,128,128,0.11)' },
      { x:W*0.5,  y:H*0.85, r:380, vx:0.08, vy:-0.09,color:'rgba(0,79,79,0.09)'   },
      { x:W*0.88, y:H*0.12, r:200, vx:-0.16,vy:0.11, color:'rgba(0,106,106,0.08)' },
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
  return <canvas ref={ref} style={{ position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none' }}/>
}

const iconProps = { size: 24, strokeWidth: 1.5, color: '#14B8A6' }
const FEATURES = [
  { icon:<BarChart3 {...iconProps}/>, title:'xG & xA Analytics', desc:'Expected goals and assists modelling with match-by-match breakdowns and squad-level trend views.' },
  { icon:<Activity {...iconProps}/>, title:'Injury Hub', desc:'Full injury lifecycle tracking — onset, treatment, recovery timeline and return-to-play clearance.' },
  { icon:<Users {...iconProps}/>, title:'Squad Management', desc:'Complete athlete registry with positions, physical data, coach assignments and status badges.' },
  { icon:<Calendar {...iconProps}/>, title:'Training Scheduler', desc:'Session planner with type categorisation, venue booking, duration tracking and coach assignments.' },
  { icon:<Search {...iconProps}/>, title:'Scouting Module', desc:'Prospect tracking, trial management, and comparison tools to build your transfer shortlist.' },
  { icon:<Lock {...iconProps}/>, title:'Role-based Access', desc:'Superadmin, admin, coach and analyst roles — each with tailored data access and permissions.' },
  { icon:<FileText {...iconProps}/>, title:'Reports', desc:'Automated performance, medical and squad reports exportable for board and technical staff use.' },
  { icon:<DollarSign {...iconProps}/>, title:'Transfer Log', desc:'Track incoming, outgoing and loan transactions with fee records and contract status.' },
]

const STATS = [
  { value:'40+',    label:'Clubs Onboarded' },
  { value:'2,000+', label:'Athletes Tracked' },
  { value:'14k+',   label:'Matches Logged'  },
  { value:'94%',    label:'Injury Recovery Rate' },
]

export default function LandingPage() {
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
  const [ready,      setReady]     = useState(false)
  const [navSolid,   setNavSolid]  = useState(false)
  const [mobileMenu, setMobileMenu]= useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const authRef  = useRef(null)
  const router   = useRouter()

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80)
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search)
      if (p.get('reason') === 'disabled') setDisabled(true)
      if (p.get('reason') === 'subscription_expired') {
        setSubExpired(true); supabase.auth.signOut()
        return () => clearTimeout(t)
      }
      if (p.get('tab') === 'signup') setTab('signup')
    }
    supabase.auth.getSession().then(async ({ data:{ session } }) => {
      if (session) {
        try {
          const { data:profile } = await supabase.from('profiles').select('is_active, role').eq('id',session.user.id).single()
          if (profile?.is_active !== false) if (profile?.role === 'superadmin') { router.replace('/superadmin') } else { router.replace('/dashboard') }
        } catch {}
      }
    }).catch(()=>{})

    const onScroll = () => setNavSolid(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => { clearTimeout(t); window.removeEventListener('scroll', onScroll) }
  }, [])

  function scrollToAuth() {
    authRef.current?.scrollIntoView({ behavior:'smooth', block:'center' })
    setMobileMenu(false)
  }

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
      const data = await res.json()
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
        // It's a username! Resolve it to an email address.
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
      if (profile?.role === 'superadmin') { router.replace('/superadmin') } else { router.replace('/dashboard') }
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
        // Upload club logo if provided
        let logoUrl = null
        if (clubLogo) {
          try {
            const ext = clubLogo.name.split('.').pop()
            const path = `club-logos/${data.user.id}.${ext}`
            const { error: uploadErr } = await supabase.storage.from('athlete-photos').upload(path, clubLogo, { upsert: true })
            if (!uploadErr) {
              logoUrl = supabase.storage.from('athlete-photos').getPublicUrl(path).data.publicUrl
            }
          } catch (uploadErr) {
            console.warn('Logo upload failed (non-blocking):', uploadErr.message)
          }
        }

        // Auto-provision: create team, trial subscription, activate account
        try {
          const provRes = await fetch('/api/signup-provision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: data.user.id,
              full_name: fullName.trim(),
              club_name: clubName.trim(),
              email: email.trim().toLowerCase(),
              logo_url: logoUrl,
            }),
          })
          const provData = await provRes.json()
          if (!provRes.ok) console.warn('Auto-provision warning:', provData.error)
        } catch (provErr) {
          console.warn('Auto-provision failed (non-blocking):', provErr.message)
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
  const focusInp = e => { e.target.style.borderColor='#006A6A'; e.target.style.boxShadow='0 0 0 3px rgba(0,106,106,0.1)' }
  const blurInp  = e => { e.target.style.borderColor='#C8E0E0'; e.target.style.boxShadow='none' }

  function scrollTo(id) {
    if (id === 'pricing' || id === 'support' || id === 'faq') {
      scrollToAuth()
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    }
    setMobileMenu(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        body {
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          background: #FFFFFF;
          color: #0F172A;
          overflow-x: hidden;
        }

        /* ── KEYFRAMES ── */
        @keyframes fadeUp   { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
        @keyframes float0   { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-10px)} }
        @keyframes float1   { 0%,100%{transform:translateY(-6px)} 50%{transform:translateY(6px)} }
        @keyframes float2   { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-8px)} }
        @keyframes marquee  { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes shimmer  { 0%{background-position:-400px 0} 100%{background-position:400px 0} }

        /* ── NAVBAR ── */
        .lp-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 48px; height: 72px;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(16px);
          transition: box-shadow 0.3s, height 0.3s;
        }
        .lp-nav.solid {
          box-shadow: 0 1px 0 rgba(0,0,0,0.07), 0 4px 20px rgba(0,0,0,0.04);
          height: 60px;
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

        .nav-links-center {
          display: flex; align-items: center; gap: 36px;
          position: absolute; left: 50%; transform: translateX(-50%);
        }
        .nav-link {
          font-size: 14px; font-weight: 600; color: #475569;
          text-decoration: none; background: none; border: none;
          cursor: pointer; font-family: inherit;
          transition: color 0.2s;
          display: flex; align-items: center; gap: 4px;
        }
        .nav-link:hover { color: #0F172A; }
        .nav-link-arrow { font-size: 10px; opacity: 0.5; }

        .nav-right { display: flex; align-items: center; gap: 12px; }
        .nav-pricing {
          font-size: 14px; font-weight: 600; color: #475569;
          text-decoration: none; transition: color 0.2s; background: none; border: none; cursor: pointer;
        }
        .nav-pricing:hover { color: #0F172A; }
        .nav-cta {
          background: #0F172A; color: #fff;
          border: none; border-radius: 99px;
          padding: 10px 22px; font-size: 14px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          transition: all 0.2s; text-decoration: none;
          display: inline-flex; align-items: center;
        }
        .nav-cta:hover { background: #1E293B; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(15,23,42,0.18); }
        .nav-hamburger {
          display: none; background: none; border: none;
          cursor: pointer; color: #0F172A; font-size: 22px; padding: 4px;
        }

        /* ── MOBILE MENU ── */
        .mobile-menu {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(255,255,255,0.98); backdrop-filter: blur(16px);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 32px;
          animation: fadeIn 0.2s ease;
        }
        .mobile-menu-close {
          position: absolute; top: 20px; right: 20px;
          background: none; border: none; font-size: 28px;
          cursor: pointer; color: #0F172A;
        }
        .mobile-menu-link {
          font-size: 24px; font-weight: 700; color: #0F172A;
          text-decoration: none; background: none; border: none;
          cursor: pointer; font-family: inherit;
        }

        /* ── HERO ── */
        .hero {
          padding: 148px 48px 0;
          text-align: center;
          background: #FFFFFF;
          position: relative;
          overflow: hidden;
        }
        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          background: #F0FDFA; border: 1px solid #CCFBF1;
          border-radius: 99px; padding: 5px 14px 5px 8px;
          margin-bottom: 28px;
          opacity: 0; animation: fadeUp 0.6s ease 0.2s forwards;
        }
        .hero-eyebrow-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #14B8A6; animation: float0 2s ease-in-out infinite;
        }
        .hero-eyebrow-text {
          font-size: 12px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: #0D9488;
        }
        .hero-h1 {
          font-size: clamp(44px, 7vw, 88px);
          font-weight: 800; line-height: 1.04;
          letter-spacing: -0.03em; color: #0F172A;
          margin-bottom: 22px; max-width: 760px; margin-left: auto; margin-right: auto;
          opacity: 0; animation: fadeUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.3s forwards;
        }
        .hero-sub {
          font-size: clamp(15px, 1.8vw, 18px); line-height: 1.65;
          color: #64748B; max-width: 540px; margin: 0 auto 36px;
          font-weight: 500;
          opacity: 0; animation: fadeUp 0.8s ease 0.45s forwards;
        }
        .hero-btns {
          display: flex; align-items: center; justify-content: center;
          gap: 12px; flex-wrap: wrap;
          opacity: 0; animation: fadeUp 0.7s ease 0.6s forwards;
        }
        .btn-primary {
          background: #0F172A; color: #fff;
          border: none; border-radius: 99px;
          padding: 15px 32px; font-size: 15px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          transition: all 0.22s;
          box-shadow: 0 8px 24px rgba(15,23,42,0.15);
          text-decoration: none; display: inline-flex; align-items: center;
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(15,23,42,0.22); background: #1E293B; }
        .btn-outline {
          background: transparent; color: #0F172A;
          border: 1.5px solid #CBD5E1; border-radius: 99px;
          padding: 15px 32px; font-size: 15px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          transition: all 0.22s;
          text-decoration: none; display: inline-flex; align-items: center;
        }
        .btn-outline:hover { border-color: #94A3B8; background: #F8FAFC; transform: translateY(-2px); }

        /* ── HERO IMAGE BOX ── */
        .hero-visual {
          position: relative;
          margin: 48px auto 0;
          max-width: 960px;
          border-radius: 24px 24px 0 0;
          overflow: hidden;
          opacity: 0; animation: fadeUp 0.9s ease 0.75s forwards;
        }
        .hero-img {
          width: 100%; display: block;
          border-radius: 24px 24px 0 0;
        }

        /* Floating stat cards on the hero image */
        .hf-card {
          position: absolute;
          background: rgba(255,255,255,0.92);
          border: 1px solid rgba(0,0,0,0.07);
          backdrop-filter: blur(12px);
          border-radius: 14px; padding: 11px 15px;
          display: flex; align-items: center; gap: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
          white-space: nowrap;
        }
        .hf-icon {
          width: 34px; height: 34px; border-radius: 9px;
          background: #F0FDFA; border: 1px solid #CCFBF1;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; flex-shrink: 0;
        }
        .hf-label { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #94A3B8; }
        .hf-val   { font-size: 16px; font-weight: 800; color: #0F172A; line-height: 1; }
        .hf-badge {
          display: inline-flex; align-items: center; gap: 4px;
          background: #F0FDF4; border: 1px solid #BBF7D0;
          border-radius: 99px; padding: 3px 9px;
          font-size: 10px; font-weight: 700; color: #16A34A;
        }

        /* ── LOGOS STRIP ── */
        .logos-strip {
          padding: 52px 0 48px;
          background: #FFFFFF;
          border-bottom: 1px solid #F1F5F9;
        }
        .logos-label {
          text-align: center;
          font-size: 12px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: #94A3B8; margin-bottom: 28px;
        }
        .logos-track-wrap { overflow: hidden; }
        .logos-track {
          display: flex; align-items: center; gap: 64px;
          animation: marquee 22s linear infinite;
          width: max-content;
        }
        .logo-item {
          color: #CBD5E1;
          transition: color 0.2s;
          cursor: default;
          user-select: none;
        }
        .logo-item:hover { color: #94A3B8; }

        /* ── FEATURES ── */
        .features-section {
          padding: 96px 48px;
          background: #FAFAFA;
        }
        .section-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          margin-bottom: 14px;
        }
        .eyebrow-line { width: 22px; height: 2px; background: linear-gradient(90deg,#14B8A6,#0D9488); border-radius: 2px; }
        .eyebrow-text { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #0D9488; }
        .section-title {
          font-size: clamp(28px, 3.5vw, 42px); font-weight: 800;
          color: #0F172A; letter-spacing: -0.025em; margin-bottom: 12px;
        }
        .section-sub {
          font-size: 15px; color: #64748B; line-height: 1.75;
          max-width: 480px; margin-bottom: 52px;
        }
        .features-grid {
          max-width: 1100px; margin: 0 auto;
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
        }
        .feat-card {
          background: #FFFFFF; border: 1px solid #E2E8F0;
          border-radius: 18px; padding: 28px 24px;
          transition: all 0.22s ease;
        }
        .feat-card:hover {
          border-color: #99F6E4;
          box-shadow: 0 8px 32px rgba(13,148,136,0.1);
          transform: translateY(-3px);
        }
        .feat-icon {
          width: 46px; height: 46px; border-radius: 13px;
          background: #F0FDFA; border: 1px solid #CCFBF1;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; margin-bottom: 18px;
        }
        .feat-title { font-size: 15px; font-weight: 700; color: #0F172A; margin-bottom: 8px; }
        .feat-desc  { font-size: 13px; color: #64748B; line-height: 1.7; }

        /* ── STATS BAND ── */
        .stats-band {
          background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
          padding: 64px 48px;
        }
        .stats-grid {
          max-width: 960px; margin: 0 auto;
          display: grid; grid-template-columns: repeat(4,1fr); gap: 0;
          text-align: center;
        }
        .stat-col { padding: 0 24px; }
        .stat-col + .stat-col { border-left: 1px solid rgba(255,255,255,0.1); }
        .stat-val { font-size: clamp(36px,4vw,56px); font-weight: 900; color: #fff; letter-spacing: -0.03em; line-height: 1; margin-bottom: 8px; }
        .stat-lbl { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.45); letter-spacing: 0.05em; text-transform: uppercase; }

        /* ── AUTH SECTION ── */
        .auth-section { padding: 96px 48px; background: #FAFAFA; border-top: 1px solid #E2E8F0; }
        .auth-wrap { max-width: 960px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 52px; align-items: start; }
        .auth-left {}
        .auth-card {
          background: #FFFFFF; border-radius: 24px; overflow: hidden;
          box-shadow: 0 20px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.03);
          border: 1px solid #E2E8F0;
        }
        .auth-tabs { display: flex; border-bottom: 1px solid #E2E8F0; }
        .auth-tab {
          flex: 1; padding: 18px; text-align: center;
          font-size: 14px; font-weight: 700; cursor: pointer;
          border: none; background: none; font-family: inherit;
          color: #64748B; transition: all 0.2s ease;
        }
        .auth-tab.active { color: #0F172A; border-bottom: 2px solid #0D9488; background: #FFFFFF; }
        .auth-tab:not(.active):hover { color: #0F172A; background: #F8FAFC; }
        .auth-form { padding: 32px 32px 28px; display: flex; flex-direction: column; gap: 20px; }
        .auth-field-label { display: block; font-size: 11px; font-weight: 700; color: #475569; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px; }
        .auth-trust { display: flex; align-items: center; justify-content: center; gap: 24px; padding: 16px 24px; border-top: 1px solid #E2E8F0; background: #F8FAFC; flex-wrap: wrap; }
        .auth-trust-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748B; font-weight: 600; }

        /* ── TRUST & COMPLIANCE ── */
        .trust-section { padding: 96px 48px; background: #FFFFFF; border-top: 1px solid #E2E8F0; }
        .trust-inner { max-width: 1100px; margin: 0 auto; }
        .trust-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; margin-top: 40px; }
        .trust-card {
          background: #FAFAFA; border: 1px solid #E2E8F0;
          border-radius: 16px; padding: 24px 22px; transition: border-color 0.2s;
        }
        .trust-card:hover { border-color: #99F6E4; }
        .trust-card-title { font-size: 15px; font-weight: 700; color: #0F172A; margin-bottom: 8px; }
        .trust-card-desc { font-size: 13px; color: #64748B; line-height: 1.7; margin-bottom: 14px; }
        .trust-card-link { font-size: 12px; font-weight: 700; color: #0D9488; text-decoration: none; }
        .trust-card-link:hover { color: #0F766E; }
        .terms-check { display: flex; align-items: flex-start; gap: 10px; font-size: 12px; color: #64748B; line-height: 1.55; }
        .terms-check input { margin-top: 3px; flex-shrink: 0; accent-color: #0D9488; }

        /* ── FOOTER ── */
        .footer { background: #0F172A; padding: 48px 48px 32px; }
        .footer-inner { max-width: 1100px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 28px; padding-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .footer-legal { display: flex; flex-direction: column; gap: 10px; }
        .footer-legal a { font-size: 13px; color: rgba(255,255,255,0.4); text-decoration: none; font-weight: 500; transition: color 0.2s; }
        .footer-legal a:hover { color: rgba(255,255,255,0.85); }
        .footer-copy { font-size: 12px; color: rgba(255,255,255,0.2); margin-top: 20px; max-width: 1100px; margin-left: auto; margin-right: auto; text-align: center; }

        /* ── RESPONSIVE ── */
        @media(max-width:1024px) {
          .features-grid { grid-template-columns:repeat(2,1fr); }
          .trust-grid { grid-template-columns:1fr; }
          .auth-wrap { grid-template-columns:1fr; max-width:480px; }
          .auth-left { display:none; }
        }
        @media (max-width: 900px) {
          .nav-links-center { display: none; }
          .nav-hamburger { display: block; }
          .stats-grid { grid-template-columns: repeat(2,1fr); gap: 28px; }
          .stat-col + .stat-col { border-left: none; }
          .stat-col:col:nth-child(odd) { border-right: 1px solid rgba(255,255,255,0.1); }
        }
        @media(max-width:768px) {
          .lp-nav { padding:0 20px; }
          .hero { padding:120px 20px 0; }
          .hero-visual { margin: 36px 16px 0; border-radius: 16px 16px 0 0; }
          .hero-img { border-radius: 16px 16px 0 0; }
          .hf-card { display:none; }
          .features-section { padding: 64px 20px; }
          .features-grid { grid-template-columns: 1fr; }
          .stats-band { padding: 52px 20px; }
          .auth-section { padding: 64px 20px; }
          .trust-section { padding:64px 20px; }
          .footer { padding:36px 20px 24px; }
          .footer-inner { flex-direction:column; align-items:flex-start; }
        }
      `}</style>

      {/* ── MOBILE MENU ── */}
      {mobileMenu && (
        <div className="mobile-menu">
          <button className="mobile-menu-close" onClick={()=>setMobileMenu(false)}>×</button>
          {['Features','Stats','Trust'].map(l=>(
            <button key={l} className="mobile-menu-link" onClick={()=>{ scrollTo(l.toLowerCase()) }}>{l}</button>
          ))}
          <button className="mobile-menu-link" onClick={scrollToAuth}>Sign In</button>
          <button className="btn-primary" style={{fontSize:16,padding:'12px 32px'}} onClick={()=>{ setTab('signup'); scrollToAuth(); }}>Get Started</button>
        </div>
      )}

      {/* ── NAVBAR ── */}
      <nav className={`lp-nav ${navSolid ? 'solid' : ''}`}>
        <a className="nav-brand" href="/">
          <img src="/logo.png" alt="ApexTrack" className="nav-brand-img" />
          <span className="nav-brand-name">Apex<span>Track</span></span>
        </a>
        <div className="nav-links-center">
          {['Features','Stats','Trust'].map(l=>(
            <button key={l} className="nav-link" onClick={()=>scrollTo(l.toLowerCase())}>{l} <span className="nav-link-arrow">▾</span></button>
          ))}
        </div>
        <div className="nav-right">
          <button className="nav-pricing" onClick={scrollToAuth}>Pricing</button>
          <button className="nav-cta" onClick={()=>{ setTab('signup'); scrollToAuth(); }}>Get Started</button>
          <button className="nav-hamburger" onClick={()=>setMobileMenu(true)}>☰</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero" id="features">
        <div className="hero-eyebrow">
          <div className="hero-eyebrow-dot"/>
          <span className="hero-eyebrow-text">Football Performance Platform</span>
        </div>
        <h1 className="hero-h1">
          The Leading<br/>
          Football Management<br/>
          Platform
        </h1>
        <p className="hero-sub">
          Manage squads, track athlete performance, and prevent injuries — all in one place. Built for clubs across Africa.
        </p>
        <div className="hero-btns">
          <button className="btn-primary" onClick={()=>{ setTab('signup'); scrollToAuth(); }}>Get Started — It&apos;s Free</button>
          <button className="btn-outline" onClick={scrollToAuth}>Sign In — Dashboard</button>
        </div>

        {/* Hero visual */}
        <div className="hero-visual">
          <img src="/hero-light.png" alt="ApexTrack dashboard preview" className="hero-img" />

          {/* Floating cards */}
          <div className="hf-card" style={{ top: '18%', left: '3%', animation: 'float0 3.6s ease-in-out infinite' }}>
            <div className="hf-icon">👥</div>
            <div>
              <div className="hf-label">Active Athletes</div>
              <div className="hf-val">248 <span className="hf-badge">↑ 12 New</span></div>
            </div>
          </div>

          <div className="hf-card" style={{ top: '55%', left: '2%', animation: 'float1 4.2s ease-in-out 0.4s infinite' }}>
            <div className="hf-icon">📊</div>
            <div>
              <div className="hf-label">Avg Match Rating</div>
              <div className="hf-val">7.4</div>
            </div>
          </div>

          <div className="hf-card" style={{ top: '24%', right: '3%', animation: 'float2 3.9s ease-in-out 0.7s infinite' }}>
            <div className="hf-icon">🤖</div>
            <div>
              <div className="hf-label">Co-Pilot</div>
              <div className="hf-val" style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>AI · Live</div>
            </div>
          </div>

          <div className="hf-card" style={{ top: '58%', right: '2%', animation: 'float0 4s ease-in-out 1s infinite' }}>
            <div className="hf-icon">🏥</div>
            <div>
              <div className="hf-label">Recovery Rate</div>
              <div className="hf-val">94% <span className="hf-badge">Secure</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LOGOS STRIP ── */}
      <div className="logos-strip">
        <div className="logos-label">Trusted by clubs across Africa</div>
        <div className="logos-track-wrap">
          <div className="logos-track">
            {[
              { name: 'GFA', style: { fontWeight: 900, fontSize: 22, letterSpacing: '-0.03em' } },
              { name: 'CAF', style: { fontWeight: 800, fontSize: 20, letterSpacing: '0.08em' } },
              { name: 'Premier League', style: { fontWeight: 700, fontSize: 15 } },
              { name: 'Ghana Stars FC', style: { fontWeight: 900, fontSize: 16, letterSpacing: '-0.02em' } },
              { name: 'Accra Lions', style: { fontWeight: 800, fontSize: 17 } }
            ].concat([
              { name: 'GFA', style: { fontWeight: 900, fontSize: 22, letterSpacing: '-0.03em' } },
              { name: 'CAF', style: { fontWeight: 800, fontSize: 20, letterSpacing: '0.08em' } },
              { name: 'Premier League', style: { fontWeight: 700, fontSize: 15 } },
              { name: 'Ghana Stars FC', style: { fontWeight: 900, fontSize: 16, letterSpacing: '-0.02em' } },
              { name: 'Accra Lions', style: { fontWeight: 800, fontSize: 17 } }
            ]).map((logo, i) => (
              <div key={i} className="logo-item" style={logo.style}>{logo.name}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section className="features-section" id="features">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="section-eyebrow">
            <div className="eyebrow-line" />
            <span className="eyebrow-text">Platform</span>
          </div>
          <h2 className="section-title">Everything your club needs</h2>
          <p className="section-sub">
            Built specifically for Ghanaian and African football infrastructure — from grassroots to professional level.
          </p>
          <div className="features-grid">
            {[
               { emoji: '📊', title: 'xG & xA Analytics', desc: 'Expected goals and assists modelling with match-by-match breakdowns and squad-level trend views.' },
               { emoji: '🏥', title: 'Injury Hub', desc: 'Full injury lifecycle tracking — onset, treatment, recovery timeline and return-to-play clearance.' },
               { emoji: '👥', title: 'Squad Management', desc: 'Complete athlete registry with positions, physical data, coach assignments and status badges.' },
               { emoji: '📅', title: 'Training Scheduler', desc: 'Session planner with type categorisation, venue booking, duration tracking and coach assignments.' },
               { emoji: '🔍', title: 'Scouting Module', desc: 'Prospect tracking, trial management, and comparison tools to build your transfer shortlist.' },
               { emoji: '🔒', title: 'Role-based Access', desc: 'Superadmin, admin, coach and analyst roles — each with tailored data access and permissions.' },
               { emoji: '📄', title: 'Reports', desc: 'Automated performance, medical and squad reports exportable for board and technical staff use.' },
               { emoji: '💵', title: 'Transfer Log', desc: 'Track incoming, outgoing and loan transactions with fee records and contract status.' },
               { emoji: '💬', title: 'Dedicated Support', desc: 'Direct technical assistance and custom onboarding support via active email admin@apextrackgh.com.' }
            ].map(f => (
              <div key={f.title} className="feat-card">
                <div className="feat-icon">{f.emoji}</div>
                <div className="feat-title">{f.title}</div>
                <p className="feat-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS BAND ── */}
      <div id="stats" className="stats-band">
        <div className="stats-grid">
          {[
            { value:'40+',    label:'Clubs Onboarded' },
            { value:'2,000+', label:'Athletes Tracked' },
            { value:'14k+',   label:'Matches Logged'  },
            { value:'94%',    label:'Injury Recovery Rate' }
          ].map(s=>(
            <div key={s.label} className="stat-col">
              <div className="stat-val">{s.value}</div>
              <div className="stat-lbl">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TRUST & COMPLIANCE ── */}
      <section id="trust" className="trust-section">
        <div className="trust-inner">
          <div className="section-eyebrow"><div className="eyebrow-line"/><span className="eyebrow-text">Trust</span></div>
          <h2 className="section-title">Built for sensitive squad data</h2>
          <p className="section-sub" style={{ maxWidth: 640 }}>
            Injury notes and athlete records deserve clear policies and honest security practices — not vague marketing claims.
          </p>
          <div className="trust-grid">
            <div className="trust-card">
              <div className="trust-card-title">Privacy &amp; GDPR</div>
              <p className="trust-card-desc">
                UK/EU-ready privacy policy. Clubs act as data controllers; we process on your instructions with EU West hosting.
              </p>
              <Link href="/privacy" className="trust-card-link">Read Privacy Policy →</Link>
            </div>
            <div className="trust-card">
              <div className="trust-card-title">Terms of Service</div>
              <p className="trust-card-desc">
                Clear account responsibilities, medical disclaimer, and acceptable use — so staff know what the platform is (and isn&apos;t).
              </p>
              <Link href="/terms" className="trust-card-link">Read Terms →</Link>
            </div>
            <div className="trust-card">
              <div className="trust-card-title">Security &amp; backups</div>
              <p className="trust-card-desc">
                Club-scoped database access (RLS), TLS encryption, and provider-managed backups. We explain limits openly.
              </p>
              <Link href="/security" className="trust-card-link">Security overview →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── AUTH SECTION ── */}
      <div ref={authRef} className="auth-section">
        <div className="auth-wrap" style={{margin:'0 auto'}}>

          {/* Left copy */}
          <div className="auth-left">
            <div className="section-eyebrow"><div className="eyebrow-line"/><span className="eyebrow-text">Access</span></div>
            <h2 className="section-title" style={{marginBottom:18}}>Your squad.<br/>Your data.</h2>
            <p className="section-sub" style={{marginBottom:28}}>Sign in to your club dashboard or register to bring your team onto the platform.</p>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {['Real-time squad updates','Injury alerts & recovery tracking','Scheduled sessions & reports','Club-scoped access & role permissions'].map(pt=>(
                <div key={pt} style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:20,height:20,borderRadius:6,background:'rgba(13, 148, 136, 0.1)',border:'1px solid rgba(13, 148, 136, 0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#0D9488',flexShrink:0}}>✓</div>
                  <span style={{fontSize:13,color:'#475569',fontWeight:500}}>{pt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Auth card */}
          <div>
            {/* Progress bar */}
            <div style={{height:3,background:'linear-gradient(90deg,#0D9488,#14B8A6,#99F6E4)',borderRadius:'22px 22px 0 0',backgroundSize:'200% 100%',animation:'shimmer 2.5s ease infinite'}}/>
            <div className="auth-card" style={{borderRadius:'0 0 22px 22px',borderTop:'none'}}>
              <div className="auth-tabs">
                <button className={`auth-tab ${tab==='login'?'active':''}`} onClick={()=>{ setTab('login'); setError(''); setSuccess(''); }}>Sign In</button>
                <button className={`auth-tab ${tab==='signup'?'active':''}`} onClick={()=>{ setTab('signup'); setError(''); setSuccess(''); }}>Register</button>
              </div>

              {/* Logo row */}
              <div style={{padding:'24px 28px 4px',display:'flex',alignItems:'center',gap:12}}>
                <img src="/logo.png" alt="Apex Track Logo" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain', border: '1px solid rgba(13, 148, 136, 0.12)' }} />
                <div>
                  <div style={{fontSize:15,fontWeight:800,color:'#0D9488',letterSpacing:'-0.02em'}}>Apex <span style={{color:'#64748B',fontWeight:400}}>Track</span></div>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#94A3B8'}}>Performance Platform</div>
                </div>
              </div>

              {tab === 'login' ? (
                <form className="auth-form" onSubmit={handleLogin}>
                  <div>
                    <h3 style={{fontSize:22,fontWeight:800,color:'#0F172A',letterSpacing:'-0.02em',marginBottom:3}}>Welcome back</h3>
                    <p style={{fontSize:13,color:'#64748B'}}>Sign in to your Apex Track account</p>
                  </div>

                  {disabled && <div style={{background:'#F9E8E8',border:'1px solid rgba(180,50,50,0.2)',borderRadius:10,padding:'11px 14px',fontSize:13,color:'#8B2020',fontWeight:600}}>🚫 Account disabled. Contact your administrator.</div>}
                  {subExpired && <div style={{background:'#FEF9E7',border:'1px solid rgba(183,119,13,0.3)',borderRadius:10,padding:'12px 14px',fontSize:13,color:'#7A5A0A'}}>🔒 Subscription cancelled. Contact your club admin.</div>}
                  {success && <div style={{background:'#E8F8EE',border:'1px solid rgba(39,174,96,0.3)',borderRadius:10,padding:'11px 14px',fontSize:13,color:'#1B6B3A',fontWeight:600}}>✓ {success}</div>}
                  {error && <div style={{background:'#F9E8E8',border:'1px solid rgba(180,50,50,0.18)',borderRadius:10,padding:'11px 14px',fontSize:13,color:'#8B2020',fontWeight:600}}>⚠️ {error}</div>}
                  {needsVerification && (
                    <button
                      type="button"
                      disabled={resendLoading}
                      onClick={handleResendVerification}
                      style={{ width:'100%', padding:'11px', background:'rgba(13,148,136,0.08)', color:'#0D9488', border:'1px solid rgba(13,148,136,0.25)', borderRadius:10, fontSize:13, fontWeight:700, cursor:resendLoading?'not-allowed':'pointer', fontFamily:'inherit' }}
                    >
                      {resendLoading ? 'Sending verification email…' : 'Resend confirmation email'}
                    </button>
                  )}

                  <div>
                    <label className="auth-field-label">Username or Email Address</label>
                    <input type="text" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Username or email" autoComplete="username" style={inp} onFocus={focusInp} onBlur={blurInp}/>
                  </div>
                  <div>
                    <label className="auth-field-label">Password</label>
                    <div style={{position:'relative'}}>
                      <input type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" style={{...inp,paddingRight:46}} onFocus={focusInp} onBlur={blurInp}/>
                      <button type="button" onClick={()=>setShowPass(v=>!v)} style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16,color:'#94A3B8',padding:0,display:'flex',alignItems:'center'}}>{showPass?'🙈':'👁️'}</button>
                    </div>
                  </div>

                  <button type="submit" disabled={loading} style={{width:'100%',padding:'13px',background:'linear-gradient(135deg,#0D9488,#0F766E)',color:'#FFFFFF',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:loading?'not-allowed':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity:loading?0.7:1,boxShadow:'0 4px 14px rgba(13,148,136,0.3)',transition:'all 0.2s'}}>
                    {loading ? <><span style={{width:15,height:15,border:'2px solid rgba(255,255,255,0.35)',borderTopColor:'#FFFFFF',borderRadius:'50%',animation:'spin 0.6s linear infinite',display:'inline-block'}}/> Signing in…</> : 'Sign In →'}
                  </button>

                  <p style={{textAlign:'center',fontSize:12,color:'#64748B'}}>
                    No account? <button type="button" onClick={()=>{ setTab('signup'); setError(''); }} style={{background:'none',border:'none',color:'#0D9488',fontWeight:700,cursor:'pointer',fontFamily:'inherit',fontSize:12}}>Register here</button>
                  </p>
                </form>
              ) : (
                <form className="auth-form" onSubmit={handleSignup}>
                  <div>
                    <h3 style={{fontSize:22,fontWeight:800,color:'#0F172A',letterSpacing:'-0.02em',marginBottom:3}}>Create account</h3>
                    <p style={{fontSize:13,color:'#64748B'}}>Join Apex Track — free to get started</p>
                  </div>

                  {error   && <div style={{background:'#F9E8E8',border:'1px solid rgba(180,50,50,0.18)',borderRadius:10,padding:'11px 14px',fontSize:13,color:'#8B2020',fontWeight:600}}>⚠️ {error}</div>}
                  {success && <div style={{background:'#E8F8EE',border:'1px solid rgba(39,174,96,0.3)',borderRadius:10,padding:'11px 14px',fontSize:13,color:'#1B6B3A',fontWeight:600}}>✓ {success}</div>}

                  <div>
                    <label className="auth-field-label">Full Name</label>
                    <input type="text" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="e.g. Kwame Mensah" style={inp} onFocus={focusInp} onBlur={blurInp}/>
                  </div>
                  <div>
                    <label className="auth-field-label">Club / Organisation</label>
                    <input type="text" value={clubName} onChange={e=>setClubName(e.target.value)} placeholder="e.g. Asante Kotoko SC" style={inp} onFocus={focusInp} onBlur={blurInp}/>
                  </div>
                  <div>
                    <label className="auth-field-label">Club Logo <span style={{fontWeight:400,textTransform:'none',letterSpacing:0,fontSize:10,color:'#94A3B8'}}>(optional)</span></label>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:48,height:48,borderRadius:'50%',background:'#F0FDFA',border:'2px dashed #CCFBF1',overflow:'hidden',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {logoPreview
                          ? <img src={logoPreview} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                          : <span style={{fontSize:20,color:'#94A3B8'}}>🏟️</span>
                        }
                      </div>
                      <div style={{flex:1}}>
                        <label htmlFor="signup-logo" style={{display:'inline-block',background:'#F0FDFA',color:'#0D9488',border:'1px solid rgba(13,148,136,0.2)',padding:'7px 14px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',transition:'all 0.15s'}}>
                          {logoPreview ? '✓ Change Logo' : '📁 Upload Logo'}
                        </label>
                        <input id="signup-logo" type="file" accept="image/*" style={{display:'none'}} onChange={e=>{
                          const f = e.target.files[0]
                          if (!f) return
                          if (f.size > 2 * 1024 * 1024) { setError('Logo must be under 2MB.'); return }
                          setClubLogo(f)
                          setLogoPreview(URL.createObjectURL(f))
                        }}/>
                        {logoPreview && <button type="button" onClick={()=>{setClubLogo(null);setLogoPreview('')}} style={{marginLeft:8,background:'none',border:'none',color:'#8B2020',fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>✕ Remove</button>}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="auth-field-label">Email Address</label>
                    <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" style={inp} onFocus={focusInp} onBlur={blurInp}/>
                  </div>
                  <div>
                    <label className="auth-field-label">Password</label>
                    <div style={{position:'relative'}}>
                      <input type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min 8 characters" autoComplete="new-password" style={{...inp,paddingRight:46}} onFocus={focusInp} onBlur={blurInp}/>
                      <button type="button" onClick={()=>setShowPass(v=>!v)} style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16,color:'#94A3B8',padding:0,display:'flex',alignItems:'center'}}>{showPass?'🙈':'👁️'}</button>
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

                  <button type="submit" disabled={loading || !acceptedTerms} style={{width:'100%',padding:'13px',background:'linear-gradient(135deg,#0D9488,#0F766E)',color:'#FFFFFF',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:loading||!acceptedTerms?'not-allowed':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity:loading||!acceptedTerms?0.7:1,boxShadow:'0 4px 14px rgba(13,148,136,0.3)',transition:'all 0.2s'}}>
                    {loading ? <><span style={{width:15,height:15,border:'2px solid rgba(255,255,255,0.35)',borderTopColor:'#FFFFFF',borderRadius:'50%',animation:'spin 0.6s linear infinite',display:'inline-block'}}/> Creating account…</> : 'Create Account →'}
                  </button>

                  <p style={{textAlign:'center',fontSize:12,color:'#64748B'}}>
                    Already registered? <button type="button" onClick={()=>{ setTab('login'); setError(''); }} style={{background:'none',border:'none',color:'#0D9488',fontWeight:700,cursor:'pointer',fontFamily:'inherit',fontSize:12}}>Sign in</button>
                  </p>
                </form>
              )}

              <div className="auth-trust">
                {[['🔒','TLS Encrypted'],['🏟️','Club-scoped data'],['🛡','GDPR-aware']].map(([ico,lbl])=>(
                  <div key={lbl} className="auth-trust-item"><span style={{fontSize:13}}>{ico}</span>{lbl}</div>
                ))}
              </div>
            </div>
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
            <button className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={scrollToAuth}>Sign In</button>
          </div>
        </div>
        <div className="footer-copy">© {new Date().getFullYear()} ApexTrack. All rights reserved. Built for African football.</div>
      </footer>
    </>
  )
}


