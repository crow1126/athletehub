'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [checking, setChecking] = useState(true)
  const [error,    setError]    = useState('')
  const [showPass, setShowPass] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check for disabled reason in URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('reason') === 'disabled') setDisabled(true)
    }

    // Check if already logged in
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_active')
            .eq('id', session.user.id)
            .single()
          if (profile?.is_active !== false) {
            router.replace('/dashboard')
            return
          }
        } catch (e) {
          // ignore
        }
      }
      setChecking(false)
    })
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Please enter your email address.'); return }
    if (!password)     { setError('Please enter your password.');       return }
    setLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email:    email.trim().toLowerCase(),
        password: password,
      })

      if (authError) {
        if (authError.message.toLowerCase().includes('invalid'))  setError('Incorrect email or password.')
        else if (authError.message.toLowerCase().includes('ban')) setError('This account has been disabled. Contact your administrator.')
        else setError(authError.message)
        setLoading(false)
        return
      }

      if (!data?.user) { setError('Login failed. Please try again.'); setLoading(false); return }

      // Check is_active
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', data.user.id)
        .single()

      if (profile?.is_active === false) {
        await supabase.auth.signOut()
        setError('Your account has been disabled by your administrator.')
        setLoading(false)
        return
      }

      router.replace('/dashboard')
    } catch (err) {
      if (err.message?.includes('fetch') || err.message?.includes('Failed')) {
        setError(
          'Cannot connect. Please check:\n' +
          '• Your .env.local file has correct Supabase URL and keys\n' +
          '• Restart the dev server after editing .env.local'
        )
      } else {
        setError(err.message || 'Unexpected error. Please try again.')
      }
      setLoading(false)
    }
  }

  if (checking) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#F8FAFB', flexDirection:'column', gap:12 }}>
      <div style={{ width:36, height:36, border:'4px solid #E8F4FF', borderTopColor:'#4A90E2', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const F = { width:'100%', padding:'12px 16px', border:'1.5px solid #E8ECF0', borderRadius:10, fontSize:14, outline:'none', fontFamily:'Plus Jakarta Sans,sans-serif', color:'#1A2332', background:'#F8FAFB', boxSizing:'border-box', transition:'border-color 0.15s' }

  return (
    <div style={{ minHeight:'100vh', display:'flex', fontFamily:'Plus Jakarta Sans,sans-serif' }}>

      {/* Left panel */}
      <div style={{ flex:1, background:'linear-gradient(135deg,#1A3A6C 0%,#2E6FC4 50%,#4A90E2 100%)', display:'flex', flexDirection:'column', justifyContent:'center', padding:'60px 80px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-80, right:-80, width:320, height:320, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }}/>
        <div style={{ position:'absolute', bottom:-60, left:-60, width:240, height:240, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }}/>
        <div style={{ position:'relative', zIndex:2 }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:52 }}>
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
            Multi-club platform — athlete management, performance analytics, and sports science. Each club's data is fully isolated and secure.
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
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

      {/* Right form */}
      <div style={{ width:460, display:'flex', alignItems:'center', justifyContent:'center', padding:44, background:'#fff' }}>
        <div style={{ width:'100%', maxWidth:360 }}>
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
                <button type="button" onClick={()=>setShowPass(v=>!v)} style={{ position:'absolute', right:13, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:15, color:'#96A3B0', padding:0 }}>
                  {showPass?'🙈':'👁'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background:'#FDEDEC', border:'1px solid rgba(231,76,60,0.2)', borderRadius:10, padding:'11px 14px', fontSize:13, color:'#C0392B', fontWeight:600, whiteSpace:'pre-line', lineHeight:1.6 }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{ background:loading?'#96A3B0':'linear-gradient(135deg,#2E6FC4,#4A90E2)', color:'#fff', border:'none', padding:'13px', borderRadius:10, fontSize:14, fontWeight:700, cursor:loading?'not-allowed':'pointer', boxShadow:'0 4px 14px rgba(74,144,226,0.3)', fontFamily:'Plus Jakarta Sans,sans-serif', width:'100%', marginTop:4 }}>
              {loading?'Signing in…':'Sign In →'}
            </button>
          </form>

          <div style={{ marginTop:24, padding:'14px 16px', background:'#F8FAFB', borderRadius:10, border:'1px solid #E8ECF0' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#96A3B0', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:7 }}>Default Admin</div>
            <div style={{ fontSize:13, color:'#5A6778', lineHeight:1.9 }}>
              <div>📧 <strong>admin@pitchreport.gh</strong></div>
              <div>🔑 <strong>Admin@1234</strong></div>
            </div>
          </div>

          <details style={{ marginTop:14 }}>
            <summary style={{ fontSize:12, color:'#B0B8C4', cursor:'pointer' }}>Can't sign in?</summary>
            <div style={{ marginTop:8, fontSize:12, color:'#96A3B0', lineHeight:1.9, background:'#F8FAFB', borderRadius:8, padding:'10px 12px' }}>
              <div>1. Check <strong>.env.local</strong> has correct Supabase keys</div>
              <div>2. Restart <strong>npm run dev</strong> after editing .env.local</div>
              <div>3. Confirm user exists in Supabase → Authentication → Users</div>
              <div>4. Run this SQL: <code style={{ background:'#E8ECF0', padding:'1px 5px', borderRadius:4 }}>select * from profiles</code></div>
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}