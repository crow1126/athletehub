'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { signOut, ROLE_PERMISSIONS } from '@/lib/auth'

const ALL_NAV = [
  { href:'/dashboard',   label:'Dashboard',   page:'dashboard'   },
  { href:'/athletes',    label:'Athletes',    page:'athletes'    },
  { href:'/coaches',     label:'Teams',       page:'coaches'     },
  { href:'/schedule',    label:'Schedule',    page:'schedule'    },
  { href:'/injuries',    label:'Medical',     page:'injuries'    },
  { href:'/performance', label:'Performance', page:'performance' },
  { href:'/scouting',    label:'Scouting',    page:'scouting'    },
  { href:'/contracts',   label:'Contracts',   page:'contracts'   },
  { href:'/reports',     label:'Reports',     page:'reports'     },
  { href:'/settings',    label:'Settings',    page:'settings'    },
  { href:'/billing',     label:'Billing',     page:'billing'     },
]

const MOBILE_NAV = ['dashboard','athletes','schedule','injuries','settings']

const ICONS = {
  dashboard:   <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  athletes:    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>,
  coaches:     <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M12 11v4M9 14h6"/></svg>,
  schedule:    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  injuries:    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  performance: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 20h18M5 20V14m4 6V10m4 10V4m4 16v-6"/></svg>,
  scouting:    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>,
  contracts:   <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  reports:     <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  settings:    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  billing:     <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  menu:        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  close:       <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
}

const C = {
  milk:      '#FFF3E6',
  milkDark:  '#F5E6D3',
  milkMuted: '#EDD9C8',
  plum:      '#381932',
  plumLight: '#4E2445',
  plumDeep:  '#250F21',
  border:    '#D9C4B5',
  text:      '#381932',
  text2:     '#7A4E6A',
  text3:     '#9E7A8E',
}

export default function Layout({ children }) {
  const path   = usePathname()
  const router = useRouter()
  const [profile,    setProfile]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [expanded,   setExpanded]   = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [logoError,  setLogoError]  = useState(false)
  const [isMobile,   setIsMobile]   = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { setMobileMenu(false) }, [path])

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.replace('/login'); return }
        const { data } = await supabase
          .from('profiles')
          .select('*, teams(id, name, short_name, primary_color, logo_url)')
          .eq('id', session.user.id)
          .single()
        setProfile(data
          ? { ...data, email: session.user.email }
          : { full_name: session.user.email, role: 'admin', email: session.user.email }
        )
      } catch (e) { console.error('Layout error:', e) }
      setLoading(false)
    }
    loadProfile()
  }, [])

  async function handleSignOut() {
    await signOut()
    router.replace('/login')
  }

  const role      = profile?.role || 'admin'
  const allowed   = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['admin']
  const navLinks  = ALL_NAV.filter(n => allowed.includes(n.page))
  const mobileNav = navLinks.filter(n => MOBILE_NAV.includes(n.page))
  const initials  = (profile?.full_name || 'AD').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const teamName  = profile?.teams?.name        || null
  const teamShort = profile?.teams?.short_name   || null
  const teamLogo  = profile?.teams?.logo_url     || null

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background: C.milk }}>
      <div style={{ width:36, height:36, border:`3px solid ${C.milkMuted}`, borderTopColor: C.plum, borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const sideW = expanded ? 240 : 72

  function ClubLogo({ size = 44 }) {
    if (teamLogo && !logoError) {
      return (
        <img src={teamLogo} alt={teamName || 'Club'} onError={() => setLogoError(true)}
          style={{ width:size, height:size, borderRadius:12, objectFit:'contain', background: C.milk, padding:4, flexShrink:0, border:`1px solid ${C.border}` }} />
      )
    }
    return (
      <div style={{ width:size, height:size, borderRadius:12, background: C.milk, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:`0 4px 12px rgba(56,25,50,0.2)`, border:`1px solid ${C.border}` }}>
        <img src="/apex-track-logo.svg" alt="Apex Track" style={{ width:size * 0.78, height:size * 0.78, objectFit:'contain' }} />
      </div>
    )
  }

  // ── MOBILE ──────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', background: C.milk, fontFamily:'Plus Jakarta Sans, sans-serif' }}>

        <header style={{ height:56, background: C.milkDark, borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', padding:'0 16px', justifyContent:'space-between', position:'sticky', top:0, zIndex:200 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <ClubLogo size={32} />
            <div>
              <div style={{ fontSize:13, fontWeight:800, color: C.plum }}>{teamName || 'Apex Track'}</div>
              <div style={{ fontSize:10, color: C.text2, textTransform:'capitalize' }}>{role}</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:11, background: C.milkMuted, color: C.plumLight, borderRadius:99, padding:'4px 10px', fontWeight:600, border:`1px solid ${C.border}` }}>
              {ALL_NAV.find(n => path === n.href || path.startsWith(n.href + '/'))?.label || 'Dashboard'}
            </div>
            <button onClick={() => setMobileMenu(v => !v)}
              style={{ background:'none', border:'none', cursor:'pointer', color: C.plum, padding:4, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {mobileMenu ? ICONS.close : ICONS.menu}
            </button>
          </div>
        </header>

        {mobileMenu && (
          <div style={{ position:'fixed', top:56, left:0, right:0, bottom:0, zIndex:150, background:'rgba(56,25,50,0.4)' }} onClick={() => setMobileMenu(false)}>
            <div style={{ background: C.milkDark, borderBottom:`1px solid ${C.border}`, padding:'12px 0', maxHeight:'80vh', overflowY:'auto' }}
              onClick={e => e.stopPropagation()}>
              {navLinks.map(({ href, label, page }) => {
                const active = path === href || path.startsWith(href + '/')
                return (
                  <Link key={href} href={href}
                    style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 20px', color: active ? C.plum : C.text2, fontWeight: active ? 700 : 500, fontSize:15, textDecoration:'none', background: active ? C.milkMuted : 'transparent', borderLeft: active ? `3px solid ${C.plum}` : '3px solid transparent' }}>
                    <span style={{ color: active ? C.plum : C.text3 }}>{ICONS[page]}</span>
                    {label}
                  </Link>
                )
              })}
              <div style={{ padding:'16px 20px', borderTop:`1px solid ${C.border}`, marginTop:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:`linear-gradient(135deg, ${C.plum}, ${C.plumLight})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color: C.milk }}>
                    {initials}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color: C.plum }}>{profile?.full_name || 'Admin'}</div>
                    <div style={{ fontSize:11, color: C.text2 }}>{profile?.email}</div>
                  </div>
                </div>
                <button onClick={handleSignOut}
                  style={{ width:'100%', background:`rgba(56,25,50,0.08)`, color: C.plum, border:`1px solid rgba(56,25,50,0.2)`, borderRadius:8, padding:'10px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'Plus Jakarta Sans,sans-serif' }}>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        <main style={{ flex:1, paddingBottom:72 }}>{children}</main>

        <nav style={{ position:'fixed', bottom:0, left:0, right:0, height:64, background: C.milkDark, borderTop:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-around', zIndex:100, paddingBottom:'env(safe-area-inset-bottom)' }}>
          {mobileNav.map(({ href, label, page }) => {
            const active = path === href || path.startsWith(href + '/')
            return (
              <Link key={href} href={href}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'6px 12px', textDecoration:'none', color: active ? C.plum : C.text3, flex:1 }}>
                <span style={{ display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32, borderRadius:10, background: active ? C.milkMuted : 'transparent', transition:'all 0.15s' }}>
                  {ICONS[page]}
                </span>
                <span style={{ fontSize:10, fontWeight: active ? 700 : 500 }}>{label}</span>
              </Link>
            )
          })}
        </nav>

        <style>{`@keyframes spin{to{transform:rotate(360deg)}} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:${C.milkMuted};border-radius:4px}`}</style>
      </div>
    )
  }

  // ── DESKTOP ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', minHeight:'100vh', background: C.milk, fontFamily:'Plus Jakarta Sans, sans-serif' }}>

      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        style={{ width:sideW, flexShrink:0, background: C.milkDark, display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, bottom:0, zIndex:100, borderRight:`1px solid ${C.border}`, transition:'width 0.22s cubic-bezier(0.4,0,0.2,1)', overflow:'hidden', boxShadow:`2px 0 16px rgba(56,25,50,0.08)` }}>

        <div style={{ padding:'14px 0', display:'flex', alignItems:'center', justifyContent: expanded ? 'flex-start' : 'center', paddingLeft: expanded ? 14 : 0, borderBottom:`1px solid ${C.border}`, minHeight:72, flexShrink:0, gap: expanded ? 12 : 0, transition:'all 0.22s' }}>
          <ClubLogo size={44} />
          {expanded && (
            <div style={{ overflow:'hidden', whiteSpace:'nowrap' }}>
              <div style={{ fontWeight:800, fontSize:14, color: C.plum, overflow:'hidden', textOverflow:'ellipsis', maxWidth:150 }}>{teamName || 'Apex Track'}</div>
              <div style={{ fontSize:10, color: C.text2, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', marginTop:2 }}>{teamShort || 'AT'}</div>
            </div>
          )}
        </div>

        <nav style={{ flex:1, padding:'10px 0', overflowY:'auto', overflowX:'hidden' }}>
          {navLinks.map(({ href, label, page }) => {
            const active    = path === href || path.startsWith(href + '/')
            const isBilling = page === 'billing'
            return (
              <Link key={href} href={href}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', paddingLeft: expanded ? 16 : 0, justifyContent: expanded ? 'flex-start' : 'center', margin:'2px 8px', borderRadius:10, background: active ? `linear-gradient(135deg, ${C.plum}, ${C.plumLight})` : isBilling && !active ? 'rgba(56,25,50,0.04)' : 'transparent', color: active ? C.milk : C.text2, fontWeight: active ? 600 : 500, fontSize:14, textDecoration:'none', transition:'all 0.15s', whiteSpace:'nowrap', overflow:'hidden', flexShrink:0, boxShadow: active ? `0 4px 12px rgba(56,25,50,0.3)` : 'none', border: isBilling && !active ? `1px solid ${C.border}` : '1px solid transparent' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.milkMuted }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = isBilling ? 'rgba(56,25,50,0.04)' : 'transparent' }}>
                <span style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', color: active ? C.milk : C.text2, minWidth:20 }}>
                  {ICONS[page] || ICONS.dashboard}
                </span>
                {expanded && <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{label}</span>}
              </Link>
            )
          })}
        </nav>

        <div style={{ padding:'12px 0', borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
          {expanded ? (
            <div style={{ padding:'0 12px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, background: C.milkMuted, borderRadius:10, padding:'10px 12px' }}>
                <div style={{ width:34, height:34, borderRadius:'50%', background:`linear-gradient(135deg, ${C.plum}, ${C.plumLight})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color: C.milk, flexShrink:0 }}>
                  {initials}
                </div>
                <div style={{ flex:1, overflow:'hidden' }}>
                  <div style={{ fontSize:12, fontWeight:700, color: C.plum, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile?.full_name || 'Admin'}</div>
                  <div style={{ fontSize:10, color: C.text2, textTransform:'capitalize', marginTop:1 }}>{role}</div>
                </div>
              </div>
              <button onClick={handleSignOut}
                style={{ width:'100%', background:`rgba(56,25,50,0.08)`, color: C.plum, border:`1px solid rgba(56,25,50,0.18)`, borderRadius:8, padding:'8px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Plus Jakarta Sans,sans-serif', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = `rgba(56,25,50,0.16)`; e.currentTarget.style.color = C.plumDeep }}
                onMouseLeave={e => { e.currentTarget.style.background = `rgba(56,25,50,0.08)`; e.currentTarget.style.color = C.plum }}>
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', justifyContent:'center' }}>
              <button onClick={handleSignOut} title={`${profile?.full_name || 'Admin'} · Sign Out`}
                style={{ width:44, height:44, borderRadius:'50%', background:`linear-gradient(135deg, ${C.plum}, ${C.plumLight})`, border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:12, fontWeight:800, color: C.milk, transition:'all 0.15s', boxShadow:`0 2px 8px rgba(56,25,50,0.3)` }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                {initials}
              </button>
            </div>
          )}
        </div>
      </aside>

      <div style={{ marginLeft:sideW, flex:1, display:'flex', flexDirection:'column', minHeight:'100vh', transition:'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)' }}>
        <header style={{ height:56, background: C.milkDark, borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', padding:'0 28px', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
          <div style={{ fontSize:16, fontWeight:700, color: C.plum }}>
            {ALL_NAV.find(n => path === n.href || path.startsWith(n.href + '/'))?.label || 'Dashboard'}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {teamName && (
              <div style={{ display:'flex', alignItems:'center', gap:7, background: C.milkMuted, borderRadius:99, padding:'5px 12px', border:`1px solid ${C.border}` }}>
                {teamLogo && !logoError
                  ? <img src={teamLogo} alt={teamName} onError={() => setLogoError(true)} style={{ width:18, height:18, objectFit:'contain', borderRadius:4 }} />
                  : <div style={{ width:18, height:18, borderRadius:4, background: C.plum, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:800, color: C.milk }}>{teamShort?.slice(0,2)}</div>
                }
                <span style={{ fontSize:12, color: C.plumLight, fontWeight:600 }}>{teamName}</span>
              </div>
            )}
            <div style={{ fontSize:12, color: C.text2, fontWeight:500 }}>
              {new Date().toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6, background: C.milkMuted, borderRadius:99, padding:'5px 12px', border:`1px solid ${C.border}` }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#27AE60', boxShadow:'0 0 5px #27AE60' }} />
              <span style={{ fontSize:12, color: C.plumLight, fontWeight:600 }}>Live</span>
            </div>
          </div>
        </header>
        <main style={{ flex:1 }}>{children}</main>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:${C.milkMuted};border-radius:4px}`}</style>
    </div>
  )
}