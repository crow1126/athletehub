'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
      { x:W*0.5,  y:H*0.85, r:380, vx:0.08, vy:-0.09,color:'rgba(13,148,136,0.07)' },
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

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password,     setPassword]     = useState('')
  const [confirm,      setConfirm]      = useState('')
  const [showPass,     setShowPass]     = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [done,         setDone]         = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the recovery token in the URL hash is detected
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setSessionReady(true)
      }
    })
    // In case there is already a session (page reload scenario)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })
    // Timeout fallback — if nothing fires in 8s, show a link error
    const t = setTimeout(() => setSessionReady(s => s || 'error'), 8000)
    return () => { subscription.unsubscribe(); clearTimeout(t) }
  }, [])

  async function handleReset(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8)       { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm)       { setError('Passwords do not match.'); return }
    setLoading(true)
    const { error: updateErr } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateErr) { setError(updateErr.message); return }
    setDone(true)
    await supabase.auth.signOut()
    setTimeout(() => router.replace('/login'), 3000)
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
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        body {
          font-family:'Plus Jakarta Sans',system-ui,sans-serif;
          background-color:#FFFFFF;
          background-image:
            radial-gradient(ellipse at 0% 0%, rgba(180,220,180,0.45) 0%, transparent 55%),
            radial-gradient(ellipse at 5% 80%, rgba(180,215,175,0.3) 0%, transparent 45%),
            linear-gradient(to right, rgba(195,225,190,0.3) 0%, rgba(220,240,220,0.1) 40%, #FFFFFF 70%);
          background-attachment:fixed;
          color:#0F172A; overflow-x:hidden;
        }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
      `}</style>

      <div style={{ position:'relative', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 20px' }}>
        <OrbCanvas />

        <div style={{ position:'relative', zIndex:2, width:'100%', maxWidth:420, animation:'fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) forwards' }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:24, justifyContent:'center' }}>
            <img src="/logo.png" alt="Apex Track" style={{ width:36, height:36, borderRadius:8, objectFit:'contain' }} />
            <div style={{ fontSize:17, fontWeight:800, color:'#0D9488', letterSpacing:'-0.02em' }}>
              Apex <span style={{ color:'#64748B', fontWeight:400 }}>Track</span>
            </div>
          </div>

          {/* Shimmer bar */}
          <div style={{ height:3, background:'linear-gradient(90deg,#0D9488,#14B8A6,#99F6E4)', borderRadius:'22px 22px 0 0', backgroundSize:'200% 100%', animation:'shimmer 2.5s ease infinite' }} />

          <div style={{ background:'#FFFFFF', border:'1px solid #E2E8F0', borderRadius:'0 0 22px 22px', borderTop:'none', boxShadow:'0 20px 48px rgba(15,23,42,0.06)', padding:'32px 28px' }}>

            {done ? (
              /* Success state */
              <div style={{ textAlign:'center', padding:'8px 0' }}>
                <div style={{ fontSize:52, marginBottom:16 }}></div>
                <h2 style={{ fontSize:22, fontWeight:800, color:'#0F172A', marginBottom:8 }}>Password updated!</h2>
                <p style={{ fontSize:14, color:'#64748B', lineHeight:1.6 }}>Your password has been changed successfully.<br />Redirecting you to sign in…</p>
              </div>

            ) : sessionReady === 'error' ? (
              /* Invalid / expired link */
              <div style={{ textAlign:'center', padding:'8px 0' }}>
                <div style={{ fontSize:44, marginBottom:14 }}></div>
                <h2 style={{ fontSize:18, fontWeight:700, color:'#0F172A', marginBottom:8 }}>Invalid or expired link</h2>
                <p style={{ fontSize:13, color:'#64748B', marginBottom:20, lineHeight:1.6 }}>This password reset link has expired or already been used. Please request a new one.</p>
                <a href="/login" style={{ display:'inline-block', padding:'11px 24px', background:'linear-gradient(135deg,#0D9488,#0F766E)', color:'#fff', borderRadius:10, fontSize:14, fontWeight:700, textDecoration:'none' }}>Back to Sign In</a>
              </div>

            ) : !sessionReady ? (
              /* Loading / verifying */
              <div style={{ textAlign:'center', padding:'24px 0' }}>
                <div style={{ width:36, height:36, border:'3px solid rgba(13,148,136,0.2)', borderTopColor:'#0D9488', borderRadius:'50%', animation:'spin 0.7s linear infinite', margin:'0 auto 16px' }} />
                <p style={{ fontSize:14, color:'#64748B' }}>Verifying your reset link…</p>
              </div>

            ) : (
              /* Reset form */
              <form onSubmit={handleReset} style={{ display:'flex', flexDirection:'column', gap:20 }}>
                <div>
                  <h2 style={{ fontSize:22, fontWeight:800, color:'#0F172A', letterSpacing:'-0.02em', marginBottom:4 }}>Set new password</h2>
                  <p style={{ fontSize:13, color:'#64748B' }}>Choose a strong password for your Apex Track account.</p>
                </div>

                {error && (
                  <div style={{ background:'#F9E8E8', border:'1px solid rgba(180,50,50,0.18)', borderRadius:10, padding:'11px 14px', fontSize:13, color:'#8B2020', fontWeight:600 }}>
                    {error}
                  </div>
                )}

                <div>
                  <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:'#64748B', marginBottom:6, display:'block' }}>New Password</label>
                  <div style={{ position:'relative' }}>
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      autoComplete="new-password"
                      style={{ ...inp, paddingRight:46 }}
                      onFocus={focusInp} onBlur={blurInp}
                      required
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#94A3B8', padding:0 }}>
                      {showPass ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:'#64748B', marginBottom:6, display:'block' }}>Confirm New Password</label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    style={inp}
                    onFocus={focusInp} onBlur={blurInp}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ width:'100%', padding:'13px', background:'linear-gradient(135deg,#0D9488,#0F766E)', color:'#FFFFFF', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity:loading?0.7:1, boxShadow:'0 4px 14px rgba(13,148,136,0.3)', transition:'all 0.2s' }}
                >
                  {loading
                    ? <><span style={{ width:15, height:15, border:'2px solid rgba(255,255,255,0.35)', borderTopColor:'#FFFFFF', borderRadius:'50%', animation:'spin 0.6s linear infinite', display:'inline-block' }} /> Updating…</>
                    : 'Update Password →'
                  }
                </button>

                <p style={{ textAlign:'center', fontSize:12, color:'#64748B' }}>
                  <a href="/login" style={{ color:'#94A3B8', fontWeight:600, textDecoration:'none' }}>← Back to Sign In</a>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

