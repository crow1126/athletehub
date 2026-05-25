'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
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

const REVIEWS = [
  { name:'Kwame Mensah', role:'Head Coach, Hearts of Oak', avatar:'KM', text:'Apex Track transformed how we monitor player fitness. The injury hub alone saved us three key players last season.', rating:5 },
  { name:'Abena Sarpong', role:'Sports Scientist, Kotoko SC', avatar:'AS', text:'The xG analytics are on par with what European clubs use. Our recruitment decisions are now data-driven and precise.', rating:5 },
  { name:'Daniel Ofori', role:'Club Administrator, RTU FC', avatar:'DO', text:'Role-based access means every staff member sees exactly what they need. Clean, fast, and reliable on mobile.', rating:5 },
  { name:'Ama Asante', role:'Performance Analyst, Dreams FC', avatar:'AA', text:'Match logs and squad reports used to take hours. Now it\'s minutes. The platform just works.', rating:5 },
]

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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html { scroll-behavior:smooth; }
        body { font-family:'Plus Jakarta Sans',sans-serif; background:#002828; overflow-x:hidden; }

        @keyframes spin    { to { transform:rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        @keyframes float0  { 0%,100%{transform:translateY(0)}   50%{transform:translateY(-10px)} }
        @keyframes float1  { 0%,100%{transform:translateY(-6px)}50%{transform:translateY(6px)}   }
        @keyframes float2  { 0%,100%{transform:translateY(0)}   50%{transform:translateY(-8px)}  }
        @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        @keyframes slideUp { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.93)} to{opacity:1;transform:scale(1)} }

        /* ── NAV ── */
        .lp-nav {
          position:fixed; top:0; left:0; right:0; z-index:100;
          display:flex; align-items:center; justify-content:space-between;
          padding:0 40px; height:80px;
          transition:background 0.3s, box-shadow 0.3s, backdrop-filter 0.3s, height 0.3s;
        }
        .lp-nav.solid {
          background:rgba(15, 23, 42, 0.95);
          backdrop-filter:blur(16px);
          box-shadow:0 1px 0 rgba(255,255,255,0.05);
          height:64px;
        }
        .nav-logo { display:flex; align-items:center; gap:12px; text-decoration:none; }
        .nav-logo-icon {
          width:36px; height:36px; border-radius:10px;
          background:transparent;
          display:flex; align-items:center; justify-content:center;
          font-size:16px; border:none;
        }
        .nav-logo-text { font-size:18px; font-weight:800; color:#FFFFFF; letter-spacing:-0.03em; }
        .nav-logo-text span { color:#14B8A6; font-weight:700; }
        .nav-links { display:flex; align-items:center; gap:32px; }
        .nav-link { font-size:14px; font-weight:600; color:rgba(248, 250, 252, 0.7); text-decoration:none; transition:color 0.2s; cursor:pointer; background:none; border:none; font-family:inherit; }
        .nav-link:hover { color:#FFFFFF; }
        .nav-cta {
          background:#14B8A6;
          color:#FFFFFF; border:none; border-radius:99px;
          padding:10px 24px; font-size:14px; font-weight:700;
          cursor:pointer; font-family:inherit;
          transition:all 0.2s;
          box-shadow:0 4px 14px rgba(20, 184, 166, 0.3);
        }
        .nav-cta:hover { background:#0D9488; transform:translateY(-1px); box-shadow:0 6px 20px rgba(20, 184, 166, 0.4); }
        .nav-mobile-btn { display:none; background:none; border:none; color:#FFFCF6; font-size:22px; cursor:pointer; padding:4px; }

        /* ── HERO ── */
        .hero {
          position:relative; overflow:hidden;
          min-height:100vh;
          background:#0F172A; /* Slate 900 */
          display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          padding:120px 40px 80px; text-align:center;
        }
        .hero-grid {
          position:absolute; inset:0;
          background-image:radial-gradient(circle, rgba(20, 184, 166, 0.15) 0%, transparent 70%),
                           linear-gradient(rgba(20, 184, 166, 0.05) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(20, 184, 166, 0.05) 1px, transparent 1px);
          background-size:100% 100%, 64px 64px, 64px 64px;
          background-position: top center, 0 0, 0 0;
          pointer-events:none;
        }
        .hero-eyebrow {
          display:inline-flex; align-items:center; gap:10px;
          background:rgba(20, 184, 166, 0.1); border:1px solid rgba(20, 184, 166, 0.2);
          border-radius:99px; padding:6px 16px 6px 8px;
          margin-bottom:28px;
          opacity:0; animation:fadeUp 0.7s ease 0.3s forwards;
        }
        .hero-eyebrow-dot { width:8px; height:8px; border-radius:50%; background:#14B8A6; flex-shrink:0; animation:float0 2s ease-in-out infinite; box-shadow: 0 0 10px rgba(20, 184, 166, 0.5); }
        .hero-eyebrow-text { font-size:12px; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; color:#14B8A6; }
        .hero-h1 {
          font-size:clamp(46px,8vw,96px); font-weight:800; line-height:1.05;
          letter-spacing:-0.03em; color:#FFFFFF; margin-bottom:12px;
          opacity:0; animation:fadeUp 0.9s cubic-bezier(0.22,1,0.36,1) 0.45s forwards;
        }
        .hero-h1 .teal { color:#14B8A6; }
        .hero-h1 .outline { color:transparent; -webkit-text-stroke:2px rgba(255,255,255,0.15); }
        .hero-sub {
          font-size:clamp(16px,2vw,20px); line-height:1.6; color:rgba(248, 250, 252, 0.7);
          max-width:680px; margin:0 auto 40px; font-weight:500;
          opacity:0; animation:fadeUp 0.9s ease 0.55s forwards;
        }
        .hero-btns {
          display:flex; align-items:center; justify-content:center; gap:12px; flex-wrap:wrap;
          opacity:0; animation:fadeUp 0.7s ease 0.9s forwards;
        }
        .hero-btn-primary {
          background:#14B8A6; color:#fff; border:none; border-radius:99px;
          padding:16px 36px; font-size:16px; font-weight:700; cursor:pointer;
          box-shadow: 0 10px 25px -5px rgba(20, 184, 166, 0.4);
          transition:all 0.2s ease; font-family:inherit;
        }
        .hero-btn-primary:hover { transform:translateY(-2px); box-shadow: 0 15px 30px -5px rgba(20, 184, 166, 0.5); background:#0D9488; }
        
        .hero-btn-secondary {
          background:rgba(255,255,255,0.05); color:#fff; border:1px solid rgba(255,255,255,0.15);
          border-radius:99px; padding:16px 36px; font-size:16px; font-weight:700;
          cursor:pointer; transition:all 0.2s ease; backdrop-filter:blur(10px); font-family:inherit;
        }
        .hero-btn-secondary:hover { background:rgba(255,255,255,0.1); transform:translateY(-2px); }

        /* Hero floating stat cards */
        .hero-floats {
          position:absolute; inset:0; pointer-events:none;
          opacity:0; animation:fadeIn 0.8s ease 1.1s forwards;
        }
        .hf-card {
          position:absolute;
          background:rgba(255,252,246,0.06); border:1px solid rgba(255,252,246,0.12);
          backdrop-filter:blur(14px); border-radius:14px; padding:12px 16px;
          display:flex; align-items:center; gap:10px;
        }
        .hf-icon { width:34px; height:34px; border-radius:9px; background:rgba(0,128,128,0.25); border:1px solid rgba(0,128,128,0.4); display:flex; align-items:center; justify-content:center; font-size:15px; }
        .hf-label { font-size:9px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:rgba(255,252,246,0.4); margin-bottom:2px; }
        .hf-val   { font-size:17px; font-weight:800; color:#FFFCF6; line-height:1; }

        /* Hero pills */
        .hero-pills {
          display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-top:36px;
          opacity:0; animation:fadeUp 0.7s ease 1.0s forwards;
        }
        .hero-pill {
          display:flex; align-items:center; gap:6px;
          background:rgba(255,252,246,0.05); border:1px solid rgba(255,252,246,0.1);
          border-radius:99px; padding:5px 13px 5px 7px;
          font-size:11.5px; font-weight:500; color:rgba(255,252,246,0.6);
          transition:all 0.2s ease;
        }
        .hero-pill:hover { background:rgba(0,128,128,0.2); border-color:rgba(0,128,128,0.45); color:#FFFCF6; }
        .pill-dot { width:5px; height:5px; border-radius:50%; background:#7ECACA; }

        /* Scroll indicator */
        .scroll-ind {
          position:absolute; bottom:32px; left:50%; transform:translateX(-50%);
          display:flex; flex-direction:column; align-items:center; gap:6px;
          opacity:0; animation:fadeIn 1s ease 1.5s forwards;
          cursor:pointer;
        }
        .scroll-ind-text { font-size:10px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,252,246,0.3); }
        .scroll-ind-arrow { width:24px; height:24px; border-right:2px solid rgba(255,252,246,0.25); border-bottom:2px solid rgba(255,252,246,0.25); transform:rotate(45deg); animation:float1 1.4s ease-in-out infinite; }

        /* ── SECTION BASE ── */
        .section { padding:100px 40px; max-width:1200px; margin:0 auto; }
        .section-dark { background:linear-gradient(180deg,#001E1E,#002828); padding:100px 0; }
        .section-dark .section { max-width:1200px; margin:0 auto; padding:0 40px; }
        .section-light { background:#FFFCF6; padding:100px 0; }
        .section-light .section { max-width:1200px; margin:0 auto; padding:0 40px; }
        .section-mid { background:linear-gradient(180deg,#002828,#003D3D); padding:100px 0; }
        .section-mid .section { max-width:1200px; margin:0 auto; padding:0 40px; }

        .s-eyebrow { display:inline-flex; align-items:center; gap:8px; margin-bottom:14px; }
        .s-eyebrow-line { width:24px; height:1.5px; background:linear-gradient(90deg,#7ECACA,#008080); border-radius:2px; }
        .s-eyebrow-text { font-size:10px; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; color:#7ECACA; }
        .s-title-dark  { font-size:clamp(28px,3.5vw,42px); font-weight:800; color:#FFFCF6; letter-spacing:-0.025em; line-height:1.15; margin-bottom:14px; }
        .s-title-light { font-size:clamp(28px,3.5vw,42px); font-weight:800; color:#003D3D; letter-spacing:-0.025em; line-height:1.15; margin-bottom:14px; }
        .s-sub-dark  { font-size:15px; color:rgba(255,252,246,0.5); line-height:1.8; max-width:480px; }
        .s-sub-light { font-size:15px; color:#5A9494; line-height:1.8; max-width:480px; }

        /* ── STATS BAND ── */
        .stats-band {
          background:linear-gradient(90deg,#004F4F,#006A6A,#008080);
          padding:52px 40px;
        }
        .stats-band-inner { max-width:1200px; margin:0 auto; display:grid; grid-template-columns:repeat(4,1fr); gap:0; }
        .stat-col { text-align:center; padding:0 20px; }
        .stat-col + .stat-col { border-left:1px solid rgba(255,252,246,0.15); }
        .stat-col-val { font-size:clamp(32px,4vw,52px); font-weight:900; color:#FFFCF6; letter-spacing:-0.03em; line-height:1; margin-bottom:6px; }
        .stat-col-lbl { font-size:12px; font-weight:600; color:rgba(255,252,246,0.55); letter-spacing:0.05em; text-transform:uppercase; }

        /* ── FEATURES ── */
        .features-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-top:52px; }
        .feat-card {
          background:rgba(255,252,246,0.04); border:1px solid rgba(255,252,246,0.09);
          border-radius:16px; padding:22px 20px;
          transition:all 0.22s ease;
        }
        .feat-card:hover {
          background:rgba(0,128,128,0.12); border-color:rgba(0,128,128,0.3);
          transform:translateY(-3px); box-shadow:0 8px 28px rgba(0,106,106,0.18);
        }
        .feat-icon { width:42px; height:42px; border-radius:11px; background:rgba(0,128,128,0.2); border:1px solid rgba(0,128,128,0.35); display:flex; align-items:center; justify-content:center; font-size:18px; margin-bottom:14px; }
        .feat-title { font-size:14px; font-weight:700; color:#FFFCF6; margin-bottom:7px; }
        .feat-desc  { font-size:12.5px; color:rgba(255,252,246,0.45); line-height:1.7; }

        /* ── REVIEWS ── */
        .reviews-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:18px; margin-top:52px; }
        .review-card {
          background:#fff; border:1px solid #E0F0F0; border-radius:18px; padding:24px 24px 20px;
          transition:all 0.22s ease; position:relative; overflow:hidden;
        }
        .review-card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg,#006A6A,#7ECACA); opacity:0; transition:opacity 0.22s; }
        .review-card:hover { transform:translateY(-3px); box-shadow:0 10px 32px rgba(0,106,106,0.12); border-color:#B8DADA; }
        .review-card:hover::before { opacity:1; }
        .review-stars { display:flex; gap:3px; margin-bottom:12px; }
        .review-text { font-size:14px; color:#2D4A4A; line-height:1.75; margin-bottom:18px; font-style:italic; }
        .review-author { display:flex; align-items:center; gap:11px; }
        .review-avatar { width:38px; height:38px; border-radius:50%; background:linear-gradient(135deg,#006A6A,#008080); display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; color:#FFFCF6; flex-shrink:0; }
        .review-name { font-size:13px; font-weight:700; color:#003D3D; }
        .review-role { font-size:11px; color:#5A9494; margin-top:1px; }

        /* ── AUTH SECTION ── */
        .auth-section { padding:100px 40px; background:#0F172A; } /* Slate 900 */
        .auth-wrap { max-width:960px; margin:0 auto; display:grid; grid-template-columns:1fr 1fr; gap:52px; align-items:start; }
        .auth-left {}
        .auth-card {
          background:#FFFFFF; border-radius:24px; overflow:hidden;
          box-shadow: 0 20px 40px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05);
          border:1px solid #F1F5F9;
        }
        .auth-tabs { display:flex; border-bottom:1px solid #E2E8F0; }
        .auth-tab {
          flex:1; padding:18px; text-align:center;
          font-size:14px; font-weight:700; cursor:pointer;
          border:none; background:none; font-family:inherit;
          color:#64748B; transition:all 0.2s ease;
        }
        .auth-tab.active { color:#0F172A; border-bottom:2px solid #14B8A6; background:#FFFFFF; }
        .auth-tab:not(.active):hover { color:#0F172A; background:#F8FAFC; }
        .auth-form { padding:32px 32px 28px; display:flex; flex-direction:column; gap:20px; }
        .auth-field-label { display:block; font-size:11px; font-weight:700; color:#475569; letter-spacing:0.05em; text-transform:uppercase; margin-bottom:8px; }
        .auth-trust { display:flex; align-items:center; justify-content:center; gap:24px; padding:16px 24px; border-top:1px solid #F1F5F9; background:#F8FAFC; }
        .auth-trust-item { display:flex; align-items:center; gap:6px; font-size:12px; color:#64748B; font-weight:600; }

        /* ── FOOTER ── */
        .footer { background:#001E1E; padding:48px 40px 32px; }
        .footer-inner { max-width:1200px; margin:0 auto; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:20px; padding-bottom:24px; border-bottom:1px solid rgba(255,252,246,0.07); }
        .footer-copy { font-size:12px; color:rgba(255,252,246,0.3); margin-top:20px; max-width:1200px; margin-left:auto; margin-right:auto; }

        /* ── RESPONSIVE ── */
        @media(max-width:1024px) {
          .features-grid { grid-template-columns:repeat(2,1fr); }
          .auth-wrap { grid-template-columns:1fr; max-width:480px; }
          .auth-left { display:none; }
        }
        @media(max-width:768px) {
          .lp-nav { padding:0 20px; }
          .nav-links { display:none; }
          .nav-mobile-btn { display:block; }
          .hero { padding:80px 20px 70px; }
          .hf-card { display:none; }
          .stats-band-inner { grid-template-columns:repeat(2,1fr); gap:20px; }
          .stat-col + .stat-col { border-left:none; }
          .stat-col:nth-child(odd) { border-right:1px solid rgba(255,252,246,0.15); }
          .reviews-grid { grid-template-columns:1fr; }
          .features-grid { grid-template-columns:1fr 1fr; gap:10px; }
          .section { padding:60px 20px; }
          .auth-section { padding:60px 20px; }
          .footer { padding:36px 20px 24px; }
          .footer-inner { flex-direction:column; align-items:flex-start; }
        }
        @media(max-width:480px) {
          .features-grid { grid-template-columns:1fr; }
          .stats-band-inner { grid-template-columns:1fr 1fr; }
        }

        /* mobile nav overlay */
        .mobile-nav {
          position:fixed; inset:0; z-index:200;
          background:rgba(0,30,30,0.97); backdrop-filter:blur(16px);
          display:flex; flex-direction:column;
          align-items:center; justify-content:center; gap:28px;
          animation:fadeIn 0.2s ease;
        }
        .mobile-nav-link { font-size:22px; font-weight:700; color:#FFFCF6; text-decoration:none; cursor:pointer; background:none; border:none; font-family:inherit; }
        .mobile-nav-close { position:absolute; top:20px; right:20px; background:none; border:none; color:#FFFCF6; font-size:28px; cursor:pointer; }
      `}</style>

      {/* ── MOBILE NAV OVERLAY ── */}
      {mobileMenu && (
        <div className="mobile-nav">
          <button className="mobile-nav-close" onClick={()=>setMobileMenu(false)}>×</button>
          {['Features','Stats','Reviews'].map(l=>(
            <button key={l} className="mobile-nav-link" onClick={()=>{ document.getElementById(l.toLowerCase())?.scrollIntoView({behavior:'smooth'}); setMobileMenu(false); }}>{l}</button>
          ))}
          <button className="mobile-nav-link" onClick={scrollToAuth}>Sign In</button>
          <button className="nav-cta" style={{fontSize:16,padding:'12px 32px'}} onClick={()=>{ setTab('signup'); scrollToAuth(); }}>Get Started</button>
        </div>
      )}

      {/* ── NAVBAR ── */}
      <nav className={`lp-nav ${navSolid?'solid':''}`}>
        <a className="nav-logo" href="#" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.png" alt="Apex Track Logo" style={{ height: '42px', width: 'auto', borderRadius: '8px', objectFit: 'contain' }} />
          <div className="nav-logo-text">Apex <span>Track</span></div>
        </a>
        <div className="nav-links">
          {['Features','Stats','Reviews'].map(l=>(
            <button key={l} className="nav-link" onClick={()=>document.getElementById(l.toLowerCase())?.scrollIntoView({behavior:'smooth'})}>{l}</button>
          ))}
          <button className="nav-link" onClick={scrollToAuth}>Sign In</button>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button className="nav-cta" onClick={()=>{ setTab('signup'); scrollToAuth(); }}>Get Started →</button>
          <button className="nav-mobile-btn" onClick={()=>setMobileMenu(true)}>☰</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero">
        <OrbCanvas/>
        <div className="hero-grid"/>

        {/* Floating stat cards (desktop) */}
        <div className="hero-floats">
          <div className="hf-card" style={{top:'22%',left:'6%',animation:'float0 3.5s ease-in-out 0s infinite'}}>
            <div className="hf-icon" style={{ background: 'transparent', border: 'none' }}><Users size={24} color="#14B8A6"/></div>
            <div><div className="hf-label">Active Athletes</div><div className="hf-val">248</div></div>
          </div>
          <div className="hf-card" style={{top:'55%',left:'4%',animation:'float1 4s ease-in-out 0.4s infinite'}}>
            <div className="hf-icon" style={{ background: 'transparent', border: 'none' }}><BarChart3 size={24} color="#14B8A6"/></div>
            <div><div className="hf-label">Avg Match Rating</div><div className="hf-val">7.4</div></div>
          </div>
          <div className="hf-card" style={{top:'30%',right:'5%',animation:'float2 3.8s ease-in-out 0.8s infinite'}}>
            <div className="hf-icon" style={{ background: 'transparent', border: 'none' }}><Activity size={24} color="#14B8A6"/></div>
            <div><div className="hf-label">Injury Recovery</div><div className="hf-val">94%</div></div>
          </div>
        </div>

        {/* Content */}
        <div style={{position:'relative',zIndex:3,maxWidth:700}}>
          <div className="hero-eyebrow">
            <div className="hero-eyebrow-dot"/>
            <span className="hero-eyebrow-text">Football Performance Platform</span>
          </div>
          <h1 className="hero-h1">
            Elite <span className="teal">Athlete</span><br/>
            <span className="outline">Intelligence</span>
          </h1>
          <p className="hero-sub">
            Multi-club management built for football — performance analytics, squad intelligence, injury tracking and sports science in one place.
          </p>
          <div className="hero-btns">
            <button className="hero-btn-primary" onClick={()=>{ setTab('signup'); scrollToAuth(); }}>Start Free Trial →</button>
            <button className="hero-btn-secondary" onClick={scrollToAuth}>Sign In</button>
          </div>
          <div className="hero-pills">
            {['xG & xA Analytics','Injury Hub','Squad Management','Role-based Access','Transfer Log','Reports'].map(f=>(
              <div key={f} className="hero-pill"><div className="pill-dot"/>{f}</div>
            ))}
          </div>
        </div>

        <div className="scroll-ind" onClick={()=>document.getElementById('stats')?.scrollIntoView({behavior:'smooth'})}>
          <span className="scroll-ind-text">Scroll</span>
          <div className="scroll-ind-arrow"/>
        </div>
      </section>

      {/* ── STATS BAND ── */}
      <div id="stats" className="stats-band">
        <div className="stats-band-inner">
          {STATS.map(s=>(
            <div key={s.label} className="stat-col">
              <div className="stat-col-val">{s.value}</div>
              <div className="stat-col-lbl">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div id="features" className="section-dark">
        <div className="section">
          <div className="s-eyebrow"><div className="s-eyebrow-line"/><span className="s-eyebrow-text">Platform</span></div>
          <h2 className="s-title-dark">Everything your club needs</h2>
          <p className="s-sub-dark">Built specifically for Ghanaian and African football infrastructure — from grassroots to professional level.</p>
          <div className="features-grid">
            {FEATURES.map(f=>(
              <div key={f.title} className="feat-card">
                <div className="feat-icon">{f.icon}</div>
                <div className="feat-title">{f.title}</div>
                <div className="feat-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── REVIEWS ── */}
      <div id="reviews" className="section-light">
        <div className="section">
          <div className="s-eyebrow"><div className="s-eyebrow-line"/><span className="s-eyebrow-text" style={{color:'#006A6A'}}>Testimonials</span></div>
          <h2 className="s-title-light">Trusted by Ghana's top clubs</h2>
          <p className="s-sub-light">Coaches and analysts across the Ghana Premier League rely on Apex Track every matchday.</p>
          <div className="reviews-grid">
            {REVIEWS.map(r=>(
              <div key={r.name} className="review-card">
                <div className="review-stars">{Array(r.rating).fill(0).map((_,i)=><span key={i} style={{fontSize:14,color:'#F59E0B'}}>★</span>)}</div>
                <p className="review-text">"{r.text}"</p>
                <div className="review-author">
                  <div className="review-avatar">{r.avatar}</div>
                  <div>
                    <div className="review-name">{r.name}</div>
                    <div className="review-role">{r.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── AUTH SECTION ── */}
      <div ref={authRef} className="auth-section">
        <div className="auth-wrap" style={{margin:'0 auto'}}>

          {/* Left copy */}
          <div className="auth-left">
            <div className="s-eyebrow"><div className="s-eyebrow-line"/><span className="s-eyebrow-text">Access</span></div>
            <h2 className="s-title-dark" style={{marginBottom:18}}>Your squad.<br/>Your data.</h2>
            <p className="s-sub-dark" style={{marginBottom:28}}>Sign in to your club dashboard or register to bring your team onto the platform.</p>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {['Real-time squad updates','Injury alerts & recovery tracking','Scheduled sessions & reports','Secure role-based access'].map(pt=>(
                <div key={pt} style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:20,height:20,borderRadius:6,background:'rgba(0,128,128,0.2)',border:'1px solid rgba(0,128,128,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#7ECACA',flexShrink:0}}>✓</div>
                  <span style={{fontSize:13,color:'rgba(255,252,246,0.6)',fontWeight:500}}>{pt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Auth card */}
          <div>
            {/* Progress bar */}
            <div style={{height:3,background:'linear-gradient(90deg,#006A6A,#008080,#7ECACA)',borderRadius:'22px 22px 0 0',backgroundSize:'200% 100%',animation:'shimmer 2.5s ease infinite'}}/>
            <div className="auth-card" style={{borderRadius:'0 0 22px 22px',borderTop:'none'}}>
              <div className="auth-tabs">
                <button className={`auth-tab ${tab==='login'?'active':''}`} onClick={()=>{ setTab('login'); setError(''); setSuccess(''); }}>Sign In</button>
                <button className={`auth-tab ${tab==='signup'?'active':''}`} onClick={()=>{ setTab('signup'); setError(''); setSuccess(''); }}>Register</button>
              </div>

              {/* Logo row */}
              <div style={{padding:'24px 28px 4px',display:'flex',alignItems:'center',gap:12}}>
                <img src="/logo.png" alt="Apex Track Logo" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain', border: '1px solid rgba(0,106,106,0.12)' }} />
                <div>
                  <div style={{fontSize:15,fontWeight:800,color:'#006A6A',letterSpacing:'-0.02em'}}>Apex <span style={{color:'#2D6B6B',fontWeight:400}}>Track</span></div>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#5A9494'}}>Performance Platform</div>
                </div>
              </div>

              {tab === 'login' ? (
                <form className="auth-form" onSubmit={handleLogin}>
                  <div>
                    <h3 style={{fontSize:22,fontWeight:800,color:'#003D3D',letterSpacing:'-0.02em',marginBottom:3}}>Welcome back</h3>
                    <p style={{fontSize:13,color:'#5A9494'}}>Sign in to your Apex Track account</p>
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
                      style={{ width:'100%', padding:'11px', background:'rgba(0,106,106,0.08)', color:'#006A6A', border:'1px solid rgba(0,106,106,0.25)', borderRadius:10, fontSize:13, fontWeight:700, cursor:resendLoading?'not-allowed':'pointer', fontFamily:'inherit' }}
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
                      <button type="button" onClick={()=>setShowPass(v=>!v)} style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16,color:'#5A9494',padding:0,display:'flex',alignItems:'center'}}>{showPass?'🙈':'👁️'}</button>
                    </div>
                  </div>

                  <button type="submit" disabled={loading} style={{width:'100%',padding:'13px',background:'linear-gradient(135deg,#006A6A,#008080)',color:'#FFFCF6',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:loading?'not-allowed':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity:loading?0.7:1,boxShadow:'0 4px 14px rgba(0,106,106,0.3)',transition:'all 0.2s'}}>
                    {loading ? <><span style={{width:15,height:15,border:'2px solid rgba(255,252,246,0.35)',borderTopColor:'#FFFCF6',borderRadius:'50%',animation:'spin 0.6s linear infinite',display:'inline-block'}}/> Signing in…</> : 'Sign In →'}
                  </button>

                  <p style={{textAlign:'center',fontSize:12,color:'#5A9494'}}>
                    No account? <button type="button" onClick={()=>{ setTab('signup'); setError(''); }} style={{background:'none',border:'none',color:'#006A6A',fontWeight:700,cursor:'pointer',fontFamily:'inherit',fontSize:12}}>Register here</button>
                  </p>
                </form>
              ) : (
                <form className="auth-form" onSubmit={handleSignup}>
                  <div>
                    <h3 style={{fontSize:22,fontWeight:800,color:'#003D3D',letterSpacing:'-0.02em',marginBottom:3}}>Create account</h3>
                    <p style={{fontSize:13,color:'#5A9494'}}>Join Apex Track — free to get started</p>
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
                    <label className="auth-field-label">Club Logo <span style={{fontWeight:400,textTransform:'none',letterSpacing:0,fontSize:10,color:'#8AAEAE'}}>(optional)</span></label>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:48,height:48,borderRadius:'50%',background:'#E8F5F5',border:'2px dashed #B8D8D8',overflow:'hidden',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {logoPreview
                          ? <img src={logoPreview} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                          : <span style={{fontSize:20,color:'#8AAEAE'}}>🏟️</span>
                        }
                      </div>
                      <div style={{flex:1}}>
                        <label htmlFor="signup-logo" style={{display:'inline-block',background:'#E8F0FA',color:'#1A4A8A',border:'1px solid rgba(26,74,138,0.2)',padding:'7px 14px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',transition:'all 0.15s'}}>
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
                      <button type="button" onClick={()=>setShowPass(v=>!v)} style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16,color:'#5A9494',padding:0,display:'flex',alignItems:'center'}}>{showPass?'🙈':'👁️'}</button>
                    </div>
                  </div>

                  <button type="submit" disabled={loading} style={{width:'100%',padding:'13px',background:'linear-gradient(135deg,#006A6A,#008080)',color:'#FFFCF6',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:loading?'not-allowed':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity:loading?0.7:1,boxShadow:'0 4px 14px rgba(0,106,106,0.3)',transition:'all 0.2s'}}>
                    {loading ? <><span style={{width:15,height:15,border:'2px solid rgba(255,252,246,0.35)',borderTopColor:'#FFFCF6',borderRadius:'50%',animation:'spin 0.6s linear infinite',display:'inline-block'}}/> Creating account…</> : 'Create Account →'}
                  </button>

                  <p style={{textAlign:'center',fontSize:12,color:'#5A9494'}}>
                    Already registered? <button type="button" onClick={()=>{ setTab('login'); setError(''); }} style={{background:'none',border:'none',color:'#006A6A',fontWeight:700,cursor:'pointer',fontFamily:'inherit',fontSize:12}}>Sign in</button>
                  </p>
                </form>
              )}

              <div className="auth-trust">
                {[['🔒','Encrypted'],['🏟️','Multi-Club'],['📱','Mobile Ready']].map(([ico,lbl])=>(
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
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:34,height:34,borderRadius:9,background:'linear-gradient(135deg,#004F4F,#008080)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15}}>⚽</div>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:'#FFFCF6',letterSpacing:'-0.02em'}}>Apex <span style={{color:'#7ECACA',fontWeight:400}}>Track</span></div>
              <div style={{fontSize:9,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,252,246,0.35)'}}>Performance Platform</div>
            </div>
          </div>
          <div style={{display:'flex',gap:24,flexWrap:'wrap'}}>
            {['Features','Reviews','Sign In','Register'].map(l=>(
              <button key={l} onClick={()=> l==='Sign In'||l==='Register' ? (setTab(l==='Register'?'signup':'login'),scrollToAuth()) : document.getElementById(l.toLowerCase())?.scrollIntoView({behavior:'smooth'})}
                style={{background:'none',border:'none',color:'rgba(255,252,246,0.4)',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit',transition:'color 0.2s'}}
                onMouseEnter={e=>e.target.style.color='rgba(255,252,246,0.8)'}
                onMouseLeave={e=>e.target.style.color='rgba(255,252,246,0.4)'}
              >{l}</button>
            ))}
          </div>
        </div>
        <p className="footer-copy">© {new Date().getFullYear()} Apex Track. Built for African football.</p>
      </footer>
    </>
  )
}


