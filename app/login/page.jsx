'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/* ── Arrow icon used in submit button ── */
const GM_ICON = (
  <span className="gm-icon" aria-hidden="true">
    <svg viewBox="0 0 16 19" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 18C7 18.5523 7.44772 19 8 19C8.55228 19 9 18.5523 9 18H7ZM8.70711 0.292893C8.31658 -0.0976311 7.68342 -0.0976311 7.29289 0.292893L0.928932 6.65685C0.538408 7.04738 0.538408 7.68054 0.928932 8.07107C1.31946 8.46159 1.95262 8.46159 2.34315 8.07107L8 2.41421L13.6569 8.07107C14.0474 8.46159 14.6805 8.46159 15.0711 8.07107C15.4616 7.68054 15.4616 7.04738 15.0711 6.65685L8.70711 0.292893ZM9 18L9 1H7L7 18H9Z"/>
    </svg>
  </span>
)

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
      { x: W*0.18, y: H*0.28, r: 260, vx: 0.18, vy: 0.10, color: 'rgba(0,106,106,0.18)' },
      { x: W*0.72, y: H*0.60, r: 200, vx:-0.12, vy: 0.14, color: 'rgba(0,128,128,0.13)' },
      { x: W*0.50, y: H*0.80, r: 320, vx: 0.08, vy:-0.09, color: 'rgba(0,79,79,0.10)'   },
      { x: W*0.85, y: H*0.15, r: 180, vx:-0.16, vy: 0.11, color: 'rgba(0,106,106,0.09)' },
      { x: W*0.08, y: H*0.75, r: 140, vx: 0.20, vy:-0.13, color: 'rgba(0,128,128,0.10)' },
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
        ctx.beginPath()
        ctx.arc(o.x,o.y,o.r,0,Math.PI*2)
        ctx.fillStyle = g
        ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }

    draw()
    const onResize = () => {
      W = canvas.width  = canvas.offsetWidth
      H = canvas.height = canvas.offsetHeight
    }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [])
  return <canvas ref={ref} style={{ position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none' }}/>
}

/* ── Animated line grid ── */
function GridLines() {
  return (
    <svg style={{ position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',opacity:0.06 }} preserveAspectRatio="none">
      <defs>
        <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse">
          <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#FFFCF6" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)"/>
    </svg>
  )
}

/* ── Floating stat cards ── */
const FLOAT_CARDS = [
  { icon:'⚽', label:'Active Athletes', value:'248', top:'14%', left:'6%', delay:'0s'  },
  { icon:'📊', label:'Avg Match Rating', value:'7.4', top:'52%', left:'4%', delay:'0.4s' },
  { icon:'🩺', label:'Injury Recovery', value:'94%', top:'76%', left:'62%', delay:'0.8s' },
]

export default function LoginPage() {
  const [email,      setEmail]    = useState('')
  const [password,   setPassword] = useState('')
  const [loading,    setLoading]  = useState(false)
  const [error,      setError]    = useState('')
  const [showPass,   setShowPass] = useState(false)
  const [disabled,   setDisabled] = useState(false)
  const [subExpired, setSubExpired] = useState(false)
  const [ready,      setReady]    = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Small delay so animations start clean
    const t = setTimeout(() => setReady(true), 80)

    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search)
      if (p.get('reason') === 'disabled') setDisabled(true)
      if (p.get('reason') === 'subscription_expired') {
        setSubExpired(true)
        supabase.auth.signOut()
        return () => clearTimeout(t)
      }
    }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        try {
          const { data: profile } = await supabase
            .from('profiles').select('is_active').eq('id', session.user.id).single()
          if (profile?.is_active !== false) router.replace('/dashboard')
        } catch {}
      }
    }).catch(() => {})

    return () => clearTimeout(t)
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Please enter your email address.'); return }
    if (!password)     { setError('Please enter your password.');       return }
    setLoading(true)
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(), password,
      })
      if (authError) {
        if (authError.message.toLowerCase().includes('invalid'))  setError('Incorrect email or password.')
        else if (authError.message.toLowerCase().includes('ban')) setError('This account has been disabled. Contact your administrator.')
        else setError(authError.message)
        setLoading(false); return
      }
      if (!data?.user) { setError('Login failed. Please try again.'); setLoading(false); return }
      const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', data.user.id).single()
      if (profile?.is_active === false) {
        await supabase.auth.signOut()
        setError('Your account has been disabled by your administrator.')
        setLoading(false); return
      }
      router.replace('/dashboard')
    } catch (err) {
      if (err.message?.includes('fetch') || err.message?.includes('Failed')) {
        setError('Cannot connect. Check your internet connection and try again.')
      } else {
        setError(err.message || 'Unexpected error. Please try again.')
      }
      setLoading(false)
    }
  }

  const inputStyle = {
    width:'100%', padding:'13px 16px',
    border:'1.5px solid #C8E0E0', borderRadius:10,
    fontSize:15, outline:'none',
    fontFamily:'Plus Jakarta Sans,sans-serif',
    color:'#003D3D', background:'#FFFCF6',
    boxSizing:'border-box',
    transition:'border-color 0.18s, box-shadow 0.18s',
    WebkitAppearance:'none',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }

        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes fadeUp   { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
        @keyframes slideRight { from { opacity:0; transform:translateX(-32px); } to { opacity:1; transform:translateX(0); } }
        @keyframes slideLeft  { from { opacity:0; transform:translateX(32px);  } to { opacity:1; transform:translateX(0); } }
        @keyframes float0   { 0%,100% { transform:translateY(0px);   } 50% { transform:translateY(-10px); } }
        @keyframes float1   { 0%,100% { transform:translateY(-6px);  } 50% { transform:translateY(6px);  } }
        @keyframes float2   { 0%,100% { transform:translateY(0px);   } 50% { transform:translateY(-8px); } }
        @keyframes drawLine { from { stroke-dashoffset:1; } to { stroke-dashoffset:0; } }
        @keyframes pulse    { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }
        @keyframes rotSlow  { to { transform: rotate(360deg); } }
        @keyframes shimmer  {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }

        body { font-family:'Plus Jakarta Sans',sans-serif; background:#003D3D; }

        .login-wrap {
          min-height:100vh; display:flex;
        }

        /* ── LEFT HERO PANEL ── */
        .hero-panel {
          flex:1;
          position:relative;
          background: linear-gradient(145deg, #002828 0%, #003D3D 30%, #004F4F 60%, #005A5A 100%);
          display:flex; flex-direction:column;
          justify-content:space-between;
          padding:40px 52px 44px;
          overflow:hidden;
        }

        /* Diagonal accent line */
        .hero-panel::before {
          content:'';
          position:absolute;
          top:0; right:80px;
          width:1px; height:100%;
          background: linear-gradient(180deg, transparent 0%, rgba(0,128,128,0.3) 30%, rgba(0,128,128,0.5) 60%, transparent 100%);
        }

        /* Radial vignette edge */
        .hero-panel::after {
          content:'';
          position:absolute;
          inset:0;
          background: radial-gradient(ellipse 80% 80% at 110% 50%, transparent 50%, rgba(0,30,30,0.5) 100%);
          pointer-events:none;
        }

        /* ── FLOATING STAT CARD ── */
        .stat-card {
          position:absolute;
          background:rgba(255,252,246,0.06);
          border:1px solid rgba(255,252,246,0.12);
          backdrop-filter:blur(12px);
          -webkit-backdrop-filter:blur(12px);
          border-radius:14px;
          padding:12px 18px;
          display:flex;
          align-items:center;
          gap:11px;
          opacity:0;
        }
        .stat-card.ready { opacity:1; }
        .stat-card-icon {
          width:36px; height:36px; border-radius:10px;
          background:rgba(0,128,128,0.3);
          border:1px solid rgba(0,128,128,0.4);
          display:flex; align-items:center; justify-content:center;
          font-size:16px; flex-shrink:0;
        }
        .stat-card-label { font-size:10px; font-weight:500; color:rgba(255,252,246,0.45); letter-spacing:0.08em; text-transform:uppercase; margin-bottom:2px; }
        .stat-card-value { font-size:18px; font-weight:800; color:#FFFCF6; line-height:1; }

        /* ── HERO MAIN TEXT ── */
        .hero-eyebrow {
          display:flex; align-items:center; gap:12px;
          opacity:0; transform:translateY(20px);
          transition:opacity 0.7s ease 0.2s, transform 0.7s ease 0.2s;
        }
        .hero-eyebrow.ready { opacity:1; transform:translateY(0); }
        .hero-eyebrow-line { width:32px; height:1.5px; background:linear-gradient(90deg,#7ECACA,#008080); border-radius:2px; }
        .hero-eyebrow-text { font-size:10px; font-weight:600; letter-spacing:0.2em; text-transform:uppercase; color:#7ECACA; }

        .hero-headline-clip { overflow:hidden; }
        .hero-headline {
          font-size:clamp(44px,5.5vw,72px);
          font-weight:800;
          line-height:1.05;
          letter-spacing:-0.025em;
          color:#FFFCF6;
          display:block;
          opacity:0; transform:translateY(100%);
          transition:opacity 0.01s, transform 0.9s cubic-bezier(0.22,1,0.36,1);
        }
        .hero-headline.ready { opacity:1; transform:translateY(0); }
        .hero-headline.d1 { transition-delay:0.35s; }
        .hero-headline.d2 { transition-delay:0.50s; }
        .hero-headline.d3 { transition-delay:0.65s; }
        .hero-headline .teal  { color:#7ECACA; }
        .hero-headline .outline {
          color:transparent;
          -webkit-text-stroke:1.5px rgba(255,252,246,0.22);
        }

        .hero-sub {
          font-size:13.5px; font-weight:400; line-height:1.75;
          color:rgba(255,252,246,0.45); max-width:320px;
          opacity:0; transform:translateY(16px);
          transition:opacity 0.7s ease 0.9s, transform 0.7s ease 0.9s;
        }
        .hero-sub.ready { opacity:1; transform:translateY(0); }

        /* ── FEATURE PILLS ── */
        .feature-pills {
          display:flex; flex-wrap:wrap; gap:8px;
          opacity:0; transform:translateY(16px);
          transition:opacity 0.7s ease 1.05s, transform 0.7s ease 1.05s;
        }
        .feature-pills.ready { opacity:1; transform:translateY(0); }
        .pill {
          display:flex; align-items:center; gap:7px;
          background:rgba(255,252,246,0.06);
          border:1px solid rgba(255,252,246,0.1);
          border-radius:99px;
          padding:6px 14px 6px 8px;
          font-size:11.5px; font-weight:500;
          color:rgba(255,252,246,0.65);
          transition:all 0.2s ease;
        }
        .pill:hover {
          background:rgba(0,128,128,0.2);
          border-color:rgba(0,128,128,0.5);
          color:#FFFCF6;
        }
        .pill-dot { width:6px; height:6px; border-radius:50%; background:#7ECACA; flex-shrink:0; }

        /* ── BOTTOM META ROW ── */
        .hero-meta {
          display:flex; align-items:center; gap:20px;
          opacity:0;
          transition:opacity 0.7s ease 1.2s;
        }
        .hero-meta.ready { opacity:1; }
        .meta-divider { width:1px; height:28px; background:rgba(255,252,246,0.12); }
        .meta-label { font-size:10px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:rgba(255,252,246,0.35); margin-bottom:2px; }
        .meta-value { font-size:13px; font-weight:700; color:rgba(255,252,246,0.7); }

        /* ── RIGHT FORM PANEL ── */
        .form-panel {
          width:460px; flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
          padding:44px 48px;
          background:#FFFCF6;
          position:relative;
          opacity:0; transform:translateX(32px);
          transition:opacity 0.8s ease 0.15s, transform 0.8s cubic-bezier(0.22,1,0.36,1) 0.15s;
        }
        .form-panel.ready { opacity:1; transform:translateX(0); }

        /* Decorative corner accent */
        .form-panel::before {
          content:'';
          position:absolute;
          top:0; left:0;
          width:120px; height:120px;
          background:linear-gradient(135deg,rgba(0,106,106,0.06) 0%,transparent 60%);
          pointer-events:none;
        }

        .form-inner { width:100%; max-width:340px; }

        .form-logo {
          display:flex; align-items:center; gap:11px; margin-bottom:36px;
          opacity:0; transform:translateY(12px);
          transition:opacity 0.6s ease 0.35s, transform 0.6s ease 0.35s;
        }
        .form-logo.ready { opacity:1; transform:translateY(0); }
        .logo-icon {
          width:44px; height:44px; border-radius:12px;
          background:linear-gradient(135deg,#004F4F,#006A6A);
          border:2px solid rgba(0,106,106,0.25);
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 4px 14px rgba(0,106,106,0.22);
        }
        .logo-name { font-size:18px; font-weight:800; color:#006A6A; }
        .logo-name span { color:#2D6B6B; font-weight:400; }
        .logo-sub  { font-size:9.5px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:#5A9494; margin-top:1px; }

        .form-title {
          font-size:27px; font-weight:800; color:#003D3D; letter-spacing:-0.025em; margin-bottom:5px;
          opacity:0; transform:translateY(12px);
          transition:opacity 0.6s ease 0.48s, transform 0.6s ease 0.48s;
        }
        .form-title.ready { opacity:1; transform:translateY(0); }
        .form-subtitle {
          font-size:14px; font-weight:400; color:#5A9494; margin-bottom:28px;
          opacity:0; transform:translateY(10px);
          transition:opacity 0.6s ease 0.56s, transform 0.6s ease 0.56s;
        }
        .form-subtitle.ready { opacity:1; transform:translateY(0); }

        .form-body {
          opacity:0; transform:translateY(14px);
          transition:opacity 0.6s ease 0.64s, transform 0.6s ease 0.64s;
        }
        .form-body.ready { opacity:1; transform:translateY(0); }

        .field-label {
          display:block; font-size:10.5px; font-weight:700;
          color:#2D6B6B; letter-spacing:0.09em;
          text-transform:uppercase; margin-bottom:6px;
        }
        input:focus {
          border-color:#006A6A !important;
          box-shadow:0 0 0 3px rgba(0,106,106,0.1) !important;
        }

        /* Progress line on card top */
        .form-progress {
          position:absolute; top:0; left:0; right:0;
          height:3px;
          background:linear-gradient(90deg,#006A6A,#008080,#7ECACA);
          background-size:200% 100%;
          animation:shimmer 2.5s ease infinite;
          opacity:0;
          transition:opacity 0.5s ease 1.4s;
        }
        .form-progress.ready { opacity:1; }

        @media (max-width:900px) {
          .login-wrap { flex-direction:column; }
          .hero-panel { padding:28px 24px 32px; flex:none; min-height:45vh; }
          .hero-headline { font-size:clamp(34px,8vw,52px) !important; }
          .stat-card { display:none !important; }
          .form-panel { width:100%; padding:36px 24px 52px; flex:1; align-items:flex-start; }
        }
      `}</style>

      <div className="login-wrap">

        {/* ══════════════ LEFT HERO PANEL ══════════════ */}
        <div className="hero-panel">
          <OrbCanvas/>
          <GridLines/>

          {/* Floating stat cards */}
          {FLOAT_CARDS.map((c,i) => (
            <div key={i} className={`stat-card ${ready?'ready':''}`}
              style={{
                top:c.top, left:c.left,
                animation:ready?`float${i} ${3.5+i*0.5}s ease-in-out ${1.2+i*0.2}s infinite`:undefined,
                transition:`opacity 0.8s ease ${0.8+i*0.2}s`,
              }}>
              <div className="stat-card-icon">{c.icon}</div>
              <div>
                <div className="stat-card-label">{c.label}</div>
                <div className="stat-card-value">{c.value}</div>
              </div>
            </div>
          ))}

          {/* Top: Eyebrow + Brand */}
          <div style={{ position:'relative',zIndex:3 }}>
            <div className={`hero-eyebrow ${ready?'ready':''}`} style={{ marginBottom:40 }}>
              <div className="hero-eyebrow-line"/>
              <span className="hero-eyebrow-text">Football Performance Platform</span>
            </div>
          </div>

          {/* Centre: Main headline */}
          <div style={{ position:'relative',zIndex:3,flex:1,display:'flex',flexDirection:'column',justifyContent:'center',gap:10 }}>
            <div className="hero-headline-clip">
              <span className={`hero-headline d1 ${ready?'ready':''}`}>Elite</span>
            </div>
            <div className="hero-headline-clip">
              <span className={`hero-headline d2 ${ready?'ready':''}`}>
                <span className="teal">Athlete</span>
              </span>
            </div>
            <div className="hero-headline-clip">
              <span className={`hero-headline d3 ${ready?'ready':''}`}>
                <span className="outline">Intelligence</span>
              </span>
            </div>

            <p className={`hero-sub ${ready?'ready':''}`} style={{ marginTop:20 }}>
              Multi-club management platform built for football — performance analytics, squad intelligence, injury tracking and sports science in one place.
            </p>

            <div className={`feature-pills ${ready?'ready':''}`} style={{ marginTop:22 }}>
              {['xG & xA Analytics','Injury Hub','Squad Management','Role-based Access','Transfer Log','Reports'].map(f=>(
                <div key={f} className="pill">
                  <div className="pill-dot"/>
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: Meta stats row */}
          <div className={`hero-meta ${ready?'ready':''}`} style={{ position:'relative',zIndex:3 }}>
            {[
              ['Clubs Onboarded','40+'],
              ['Athletes Tracked','2,000+'],
              ['Matches Logged','14k+'],
            ].map(([label,val],i) => (
              <div key={i} style={{ display:'flex',alignItems:'center',gap:20 }}>
                {i>0 && <div className="meta-divider"/>}
                <div>
                  <div className="meta-label">{label}</div>
                  <div className="meta-value">{val}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════ RIGHT FORM PANEL ══════════════ */}
        <div className={`form-panel ${ready?'ready':''}`}>
          <div className={`form-progress ${ready?'ready':''}`}/>

          <div className="form-inner">

            {/* Logo */}
            <div className={`form-logo ${ready?'ready':''}`}>
              <div className="logo-icon">
                <img src="/apex-track-logo.svg" alt="Apex Track" style={{ width:26,height:26,objectFit:'contain',filter:'brightness(0) invert(1)' }}/>
              </div>
              <div>
                <div className="logo-name">Apex <span>Track</span></div>
                <div className="logo-sub">Performance Platform</div>
              </div>
            </div>

            <h2 className={`form-title ${ready?'ready':''}`}>Welcome back</h2>
            <p className={`form-subtitle ${ready?'ready':''}`}>Sign in to your Apex Track account</p>

            {/* Alerts */}
            {disabled && (
              <div style={{ background:'#F9E8E8',border:'1px solid rgba(180,50,50,0.2)',borderRadius:10,padding:'11px 14px',marginBottom:18,fontSize:13,color:'#8B2020',fontWeight:600 }}>
                🚫 Your account has been disabled. Contact your club administrator.
              </div>
            )}
            {subExpired && (
              <div style={{ background:'#FEF9E7',border:'1px solid rgba(183,119,13,0.3)',borderRadius:10,padding:'14px 16px',marginBottom:18 }}>
                <div style={{ fontSize:14,fontWeight:700,color:'#B7770D',marginBottom:4 }}>🔒 Subscription Cancelled</div>
                <div style={{ fontSize:13,color:'#7A5A0A',lineHeight:1.6 }}>
                  Your club's Apex Track subscription has been cancelled.<br/>Please contact your club admin to restore access.
                </div>
              </div>
            )}

            <div className={`form-body ${ready?'ready':''}`}>
              <form onSubmit={handleLogin} style={{ display:'flex',flexDirection:'column',gap:18 }}>

                <div>
                  <label className="field-label">Email Address</label>
                  <input
                    type="email" value={email}
                    onChange={e=>setEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoComplete="email"
                    style={inputStyle}
                    onFocus={e=>{ e.target.style.borderColor='#006A6A'; e.target.style.boxShadow='0 0 0 3px rgba(0,106,106,0.1)'; }}
                    onBlur={e=>{  e.target.style.borderColor='#C8E0E0'; e.target.style.boxShadow='none'; }}
                  />
                </div>

                <div>
                  <label className="field-label">Password</label>
                  <div style={{ position:'relative' }}>
                    <input
                      type={showPass?'text':'password'} value={password}
                      onChange={e=>setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      style={{ ...inputStyle,paddingRight:48 }}
                      onFocus={e=>{ e.target.style.borderColor='#006A6A'; e.target.style.boxShadow='0 0 0 3px rgba(0,106,106,0.1)'; }}
                      onBlur={e=>{  e.target.style.borderColor='#C8E0E0'; e.target.style.boxShadow='none'; }}
                    />
                    <button
                      type="button"
                      onClick={()=>setShowPass(v=>!v)}
                      style={{ position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:17,color:'#5A9494',padding:0,lineHeight:1,display:'flex',alignItems:'center' }}>
                      {showPass?'🙈':'👁️'}
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{ background:'#F9E8E8',border:'1px solid rgba(180,50,50,0.18)',borderRadius:10,padding:'11px 14px',fontSize:13,color:'#8B2020',fontWeight:600,whiteSpace:'pre-line',lineHeight:1.6,animation:'fadeUp 0.25s ease' }}>
                    ⚠️ {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="gm-btn"
                  style={{ width:'100%',marginTop:4,justifyContent:'center',opacity:loading?0.7:1,cursor:loading?'not-allowed':'pointer',fontSize:14 }}>
                  {loading
                    ? <><span style={{ width:16,height:16,border:'2px solid rgba(255,252,246,0.4)',borderTopColor:'#FFFCF6',borderRadius:'50%',animation:'spin 0.6s linear infinite',display:'inline-block',flexShrink:0 }}/> Signing in…</>
                    : <>{' '}Sign In{GM_ICON}</>
                  }
                </button>

              </form>

              {/* Bottom trust row */}
              <div style={{ marginTop:28,paddingTop:20,borderTop:'1px solid #E0F0F0',display:'flex',alignItems:'center',justifyContent:'center',gap:20 }}>
                {[['🔒','Encrypted'],['🏟️','Multi-Club'],['📱','Mobile Ready']].map(([ico,lbl])=>(
                  <div key={lbl} style={{ display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#5A9494',fontWeight:500 }}>
                    <span style={{ fontSize:13 }}>{ico}</span>{lbl}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  )
}