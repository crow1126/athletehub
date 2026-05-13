'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const GM_ICON = (
  <span className="gm-icon" aria-hidden="true">
    <svg viewBox="0 0 16 19" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 18C7 18.5523 7.44772 19 8 19C8.55228 19 9 18.5523 9 18H7ZM8.70711 0.292893C8.31658 -0.0976311 7.68342 -0.0976311 7.29289 0.292893L0.928932 6.65685C0.538408 7.04738 0.538408 7.68054 0.928932 8.07107C1.31946 8.46159 1.95262 8.46159 2.34315 8.07107L8 2.41421L13.6569 8.07107C14.0474 8.46159 14.6805 8.46159 15.0711 8.07107C15.4616 7.68054 15.4616 7.04738 15.0711 6.65685L8.70711 0.292893ZM9 18L9 1H7L7 18H9Z"/>
    </svg>
  </span>
)

export default function LoginPage() {
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [disabled,   setDisabled]   = useState(false)
  const [subExpired, setSubExpired] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('reason') === 'disabled') setDisabled(true)
      if (params.get('reason') === 'subscription_expired') {
        setSubExpired(true)
        supabase.auth.signOut()
        return
      }
    }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        try {
          const { data: profile } = await supabase
            .from('profiles').select('is_active').eq('id', session.user.id).single()
          if (profile?.is_active !== false) router.replace('/dashboard')
        } catch (e) {}
      }
    }).catch(() => {})
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

  const F = {
    width:'100%', padding:'12px 16px',
    border:'1.5px solid #C8E0E0', borderRadius:10,
    fontSize:16, outline:'none',
    fontFamily:'Plus Jakarta Sans,sans-serif',
    color:'#003D3D', background:'#FFFCF6',
    boxSizing:'border-box', transition:'border-color 0.15s',
    WebkitAppearance:'none',
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .login-wrap { min-height:100vh; display:flex; font-family:'Plus Jakarta Sans',sans-serif; }
        .login-left { flex:1; background:linear-gradient(135deg,#004F4F 0%,#006A6A 55%,#008080 100%); display:flex; flex-direction:column; justify-content:center; padding:60px 80px; position:relative; overflow:hidden; }
        .login-right { width:460px; display:flex; align-items:center; justify-content:center; padding:44px; background:#FFFCF6; }
        @media (max-width: 768px) {
          .login-wrap { flex-direction:column; }
          .login-left { padding:28px 24px 24px; flex:none; }
          .login-left h1 { font-size:24px !important; margin-bottom:8px !important; }
          .login-features { display:none !important; }
          .login-left p { display:none !important; }
          .login-right { width:100%; padding:28px 20px 48px; flex:1; align-items:flex-start; }
        }
      `}</style>

      <div className="login-wrap">
        <div className="login-left">
          <div style={{ position:'absolute',top:-80,right:-80,width:320,height:320,borderRadius:'50%',background:'rgba(255,252,246,0.05)' }}/>
          <div style={{ position:'absolute',bottom:-60,left:-60,width:240,height:240,borderRadius:'50%',background:'rgba(255,252,246,0.03)' }}/>
          <div style={{ position:'relative',zIndex:2 }}>
            <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:24 }}>
              <div style={{ width:46,height:46,borderRadius:13,background:'rgba(255,252,246,0.15)',border:'2px solid rgba(255,252,246,0.25)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <img src="/apex-track-logo.svg" alt="Apex Track" style={{ width:30,height:30,objectFit:'contain' }}/>
              </div>
              <div>
                <div style={{ fontWeight:800,fontSize:19,color:'#FFFCF6' }}>Apex <span style={{ color:'#7ECACA' }}>Track</span></div>
                <div style={{ fontSize:10,color:'rgba(255,252,246,0.45)',letterSpacing:'0.1em',textTransform:'uppercase' }}>Football Performance Platform</div>
              </div>
            </div>
            <h1 style={{ fontSize:40,fontWeight:800,color:'#FFFCF6',lineHeight:1.15,marginBottom:14,letterSpacing:'-0.02em' }}>
              Elite Football<br/>Performance<br/><span style={{ color:'#7ECACA' }}>Tracking</span>
            </h1>
            <p style={{ fontSize:14,color:'rgba(255,252,246,0.55)',lineHeight:1.7,marginBottom:40,maxWidth:340 }}>
              Multi-club platform — athlete management, performance analytics, and sports science.
            </p>
            <div className="login-features" style={{ display:'flex',flexDirection:'column',gap:12 }}>
              {[
                ['⚽','Multi-tenant — each club sees only their own data'],
                ['📊','Performance analytics with xG & xA metrics'],
                ['🩺','Medical hub, injury tracking & athlete reports'],
                ['🔑','Role-based access — admin, coach, physio, scout'],
              ].map(([icon,label]) => (
                <div key={label} style={{ display:'flex',alignItems:'center',gap:12 }}>
                  <div style={{ width:34,height:34,borderRadius:9,background:'rgba(255,252,246,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0 }}>{icon}</div>
                  <span style={{ fontSize:13,color:'rgba(255,252,246,0.7)',fontWeight:500 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="login-right">
          <div style={{ width:'100%',maxWidth:360,animation:'fadeUp 0.35s ease both' }}>
            <div style={{ marginBottom:28 }}>
              <h2 style={{ fontSize:26,fontWeight:800,color:'#006A6A',marginBottom:7,letterSpacing:'-0.02em' }}>Welcome back</h2>
              <p style={{ fontSize:14,color:'#2D6B6B' }}>Sign in to your Apex Track account</p>
            </div>

            {disabled && (
              <div style={{ background:'#F9E8E8',border:'1px solid rgba(180,50,50,0.2)',borderRadius:10,padding:'11px 14px',marginBottom:18,fontSize:13,color:'#8B2020',fontWeight:600 }}>
                🚫 Your account has been disabled. Contact your club administrator.
              </div>
            )}

            {subExpired && (
              <div style={{ background:'#FEF9E7',border:'1px solid rgba(183,119,13,0.3)',borderRadius:10,padding:'14px 16px',marginBottom:18 }}>
                <div style={{ fontSize:14,fontWeight:700,color:'#B7770D',marginBottom:4 }}>🔒 Subscription Cancelled</div>
                <div style={{ fontSize:13,color:'#7A5A0A',lineHeight:1.6 }}>
                  Your club's Apex Track subscription has been cancelled by the administrator.<br/>
                  Please contact your club admin to restore access.
                </div>
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display:'flex',flexDirection:'column',gap:16 }}>
              <div>
                <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#2D6B6B',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6 }}>Email Address</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" style={F}
                  onFocus={e=>e.target.style.borderColor='#006A6A'}
                  onBlur={e=>e.target.style.borderColor='#C8E0E0'}/>
              </div>
              <div>
                <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#2D6B6B',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6 }}>Password</label>
                <div style={{ position:'relative' }}>
                  <input type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" style={{ ...F,paddingRight:44 }}
                    onFocus={e=>e.target.style.borderColor='#006A6A'}
                    onBlur={e=>e.target.style.borderColor='#C8E0E0'}/>
                  <button type="button" onClick={()=>setShowPass(v=>!v)} style={{ position:'absolute',right:13,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:18,color:'#2D6B6B',padding:0,lineHeight:1,minHeight:'auto' }}>
                    {showPass?'🙈':'👁️'}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ background:'#F9E8E8',border:'1px solid rgba(180,50,50,0.18)',borderRadius:10,padding:'11px 14px',fontSize:13,color:'#8B2020',fontWeight:600,whiteSpace:'pre-line',lineHeight:1.6 }}>
                  ⚠️ {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="gm-btn" style={{ width:'100%',marginTop:4,justifyContent:'center',opacity:loading?0.7:1,cursor:loading?'not-allowed':'pointer' }}>
                {loading ? 'Signing in…' : 'Sign In'}
                {!loading && GM_ICON}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}