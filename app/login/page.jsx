'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showPass, setShowPass] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('reason') === 'disabled') setDisabled(true)
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

  const F = { width:'100%', padding:'12px 16px', border:'1.5px solid #E8ECF0', borderRadius:10, fontSize:16, outline:'none', fontFamily:'Plus Jakarta Sans,sans-serif', color:'#1A2332', background:'#F8FAFB', boxSizing:'border-box', transition:'border-color 0.15s', WebkitAppearance:'none' }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .login-wrap { min-height:100vh; display:flex; font-family:'Plus Jakarta Sans',sans-serif; }
        .login-left { flex:1; background:linear-gradient(135deg,#1A3A6C 0%,#2E6FC4 50%,#4A90E2 100%); display:flex; flex-direction:column; justify-content:center; padding:60px 80px; position:relative; overflow:hidden; }
        .login-right { width:460px; display:flex; align-items:center; justify-content:center; padding:44px; background:#fff; }
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
          <div style={{ position:'absolute', top:-80, right:-80, width:320, height:320, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }}/>
          <div style={{ position:'absolute', bottom:-60, left:-60, width:240, height:240, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }}/>
          <div style={{ position:'relative', zIndex:2 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
              <div style={{ width:46, height:46, borderRadius:13, background:'rgba(255,255,255,0.18)', border:'2px solid rgba(255,255,255,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>📊</div>
              <div>
                <div style={{ fontWeight:800, fontSize:19, color:'#fff' }}>Athlete<span style={{ color:'#93C5FD' }}>Hub</span></div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', letterSpacing:'0.1em', textTransform:'uppercase' }}>Ghana Football FOS</div>
              </div>
            </div>
            <h1 style={{ fontSize:40, fontWeight:800, color:'#fff', lineHeight:1.15, marginBottom:14, letterSpacing:'-0.02em' }}>
              Football<br/>Operating<br/><span style={{ color:'#93C5FD' }}>System</span>
            </h1>
            <p style={{ fontSize:14, color:'rgba(255,255,255,0.6)', lineHeight:1.7, marginBottom:40, maxWidth:340 }}>
              Multi-club platform — athlete management, performance analytics, and sports science.
            </p>
            <div className="login-features" style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                ['⚽','Multi-tenant — each club sees only their own data'],
                ['📊','Performance analytics with xG & xA metrics'],
                ['🩺','Medical hub, injury tracking & athlete reports'],
                ['🔑','Role-based access — admin, coach, physio, scout'],
              ].map(([icon,label]) => (
                <div key={label} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:34, height:34, borderRadius:9, background:'rgba(255,255,255,0.14)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{icon}</div>
                  <span style={{ fontSize:13, color:'rgba(255,255,255,0.75)', fontWeight:500 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="login-right">
          <div style={{ width:'100%', maxWidth:360, animation:'fadeUp 0.35s ease both' }}>
            <div style={{ marginBottom:28 }}>
              <h2 style={{ fontSize:26, fontWeight:800, color:'#1A2332', marginBottom:7, letterSpacing:'-0.02em' }}>Welcome back</h2>
              <p style={{ fontSize:14, color:'#96A3B0' }}>Sign in to your AthleteHub account</p>
            </div>

            {disabled && (
              <div style={{ background:'#FDEDEC', border:'1px solid rgba(231,76,60,0.25)', borderRadius:10, padding:'11px 14px', marginBottom:18, fontSize:13, color:'#C0392B', fontWeight:600 }}>
                🚫 Your account has been disabled. Contact your club administrator.
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#5A6778', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Email Address</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" style={F}
                  onFocus={e=>e.target.style.borderColor='#4A90E2'}
                  onBlur={e=>e.target.style.borderColor='#E8ECF0'} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#5A6778', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Password</label>
                <div style={{ position:'relative' }}>
                  <input type={showPass?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" style={{ ...F, paddingRight:44 }}
                    onFocus={e=>e.target.style.borderColor='#4A90E2'}
                    onBlur={e=>e.target.style.borderColor='#E8ECF0'} />
                  <button type="button" onClick={()=>setShowPass(v=>!v)} style={{ position:'absolute', right:13, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#96A3B0', padding:0, lineHeight:1, minHeight:'auto' }}>
                    {showPass?'🙈':'👁️'}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ background:'#FDEDEC', border:'1px solid rgba(231,76,60,0.2)', borderRadius:10, padding:'11px 14px', fontSize:13, color:'#C0392B', fontWeight:600, whiteSpace:'pre-line', lineHeight:1.6 }}>
                  ⚠️ {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{ background:loading?'#96A3B0':'linear-gradient(135deg,#2E6FC4,#4A90E2)', color:'#fff', border:'none', padding:'15px', borderRadius:10, fontSize:16, fontWeight:700, cursor:loading?'not-allowed':'pointer', boxShadow:'0 4px 14px rgba(74,144,226,0.3)', fontFamily:'Plus Jakarta Sans,sans-serif', width:'100%', marginTop:4, touchAction:'manipulation', minHeight:52 }}>
                {loading?'Signing in…':'Sign In →'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}