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
]

// Bottom nav shows only the most important 5 links on mobile
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
  menu:        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  close:       <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
}

export default function Layout({ children }) {
  const path   = usePathname()
  const router = useRouter()
  const [profile,   setProfile]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState(false)
  const [mobileMenu,setMobileMenu]= useState(false)
  const [logoError, setLogoError] = useState(false)
  const [isMobile,  setIsMobile]  = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close mobile menu on route change
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
  const teamName  = profile?.teams?.name       || null
  const teamShort = profile?.teams?.short_name  || null
  const teamLogo  = profile?.teams?.logo_url    || null
  const teamColor = profile?.teams?.primary_color || '#4A90E2'

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#EEF4FF' }}>
      <div style={{ width:36, height:36, border:'3px solid #BDD4FF', borderTopColor:'#4A90E2', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const sideW = expanded ? 240 : 72

  function ClubLogo({ size = 44 }) {
    if (teamLogo && !logoError) {
      return (
        <img src={teamLogo} alt={teamName || 'Club'} onError={() => setLogoError(true)}
          style={{ width:size, height:size, borderRadius:12, objectFit:'contain', background:'#fff', padding:4, flexShrink:0, border:'1px solid #DDEAFF' }} />
      )
    }
    return (
      <div style={{ width:size, height:size, borderRadius:12, background:`linear-gradient(135deg, ${teamColor}, ${teamColor}BB)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:`0 4px 12px ${teamColor}40` }}>
        <span style={{ fontSize:size * 0.35, fontWeight:800, color:'#fff', letterSpacing:'-0.02em' }}>
          {teamShort?.slice(0,2) || initials}
        </span>
      </div>
    )
  }

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', background:'#EEF4FF', fontFamily:'Plus Jakarta Sans, sans-serif' }}>

        {/* Mobile top bar */}
        <header style={{ height:56, background:'#F0F6FF', borderBottom:'1px solid #DDEAFF', display:'flex', alignItems:'center', padding:'0 16px', justifyContent:'space-between', position:'sticky', top:0, zIndex:200 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <ClubLogo size={32} />
            <div>
              <div style={{ fontSize:13, fontWeight:800, color:'#1A2E4A' }}>{teamName || 'AthleteHub'}</div>
              <div style={{ fontSize:10, color:'#7A9CC4', textTransform:'capitalize' }}>{role}</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ fontSize:11, background:'#E0ECFF', color:'#3B6BA0', borderRadius:99, padding:'4px 10px', fontWeight:600, border:'1px solid #DDEAFF' }}>
              {ALL_NAV.find(n => path === n.href || path.startsWith(n.href + '/'))?.label || 'Dashboard'}
            </div>
            <button onClick={() => setMobileMenu(v => !v)}
              style={{ background:'none', border:'none', cursor:'pointer', color:'#3B6BA0', padding:4, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {mobileMenu ? ICONS.close : ICONS.menu}
            </button>
          </div>
        </header>

        {/* Mobile slide-down full menu */}
        {mobileMenu && (
          <div style={{ position:'fixed', top:56, left:0, right:0, bottom:0, zIndex:150, background:'rgba(0,0,0,0.4)' }} onClick={() => setMobileMenu(false)}>
            <div style={{ background:'#F0F6FF', borderBottom:'1px solid #DDEAFF', padding:'12px 0', maxHeight:'80vh', overflowY:'auto' }}
              onClick={e => e.stopPropagation()}>
              {navLinks.map(({ href, label, page }) => {
                const active = path === href || path.startsWith(href + '/')
                return (
                  <Link key={href} href={href}
                    style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 20px', color: active ? '#4A90E2' : '#3B6BA0', fontWeight: active ? 700 : 500, fontSize:15, textDecoration:'none', background: active ? '#E0ECFF' : 'transparent', borderLeft: active ? '3px solid #4A90E2' : '3px solid transparent' }}>
                    <span style={{ color: active ? '#4A90E2' : '#7A9CC4' }}>{ICONS[page]}</span>
                    {label}
                  </Link>
                )
              })}
              <div style={{ padding:'16px 20px', borderTop:'1px solid #DDEAFF', marginTop:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:`linear-gradient(135deg, ${teamColor}, ${teamColor}BB)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#fff' }}>
                    {initials}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#1A2E4A' }}>{profile?.full_name || 'Admin'}</div>
                    <div style={{ fontSize:11, color:'#7A9CC4' }}>{profile?.email}</div>
                  </div>
                </div>
                <button onClick={handleSignOut}
                  style={{ width:'100%', background:'rgba(74,144,226,0.1)', color:'#4A90E2', border:'1px solid rgba(74,144,226,0.2)', borderRadius:8, padding:'10px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'Plus Jakarta Sans,sans-serif' }}>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page content */}
        <main style={{ flex:1, paddingBottom:72 }}>
          {children}
        </main>

        {/* Mobile bottom nav bar */}
        <nav style={{ position:'fixed', bottom:0, left:0, right:0, height:64, background:'#F0F6FF', borderTop:'1px solid #DDEAFF', display:'flex', alignItems:'center', justifyContent:'space-around', zIndex:100, paddingBottom:'env(safe-area-inset-bottom)' }}>
          {mobileNav.map(({ href, label, page }) => {
            const active = path === href || path.startsWith(href + '/')
            return (
              <Link key={href} href={href}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'6px 12px', textDecoration:'none', color: active ? '#4A90E2' : '#7A9CC4', flex:1 }}>
                <span style={{ display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32, borderRadius:10, background: active ? '#E0ECFF' : 'transparent', transition:'all 0.15s' }}>
                  {ICONS[page]}
                </span>
                <span style={{ fontSize:10, fontWeight: active ? 700 : 500 }}>{label}</span>
              </Link>
            )
          })}
        </nav>

        <style>{`@keyframes spin{to{transform:rotate(360deg)}} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#BDD4FF;border-radius:4px}`}</style>
      </div>
    )
  }

  // ── DESKTOP LAYOUT ─────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#EEF4FF', fontFamily:'Plus Jakarta Sans, sans-serif' }}>

      {/* Sidebar */}
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        style={{ width:sideW, flexShrink:0, background:'#F0F6FF', display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, bottom:0, zIndex:100, borderRight:'1px solid #DDEAFF', transition:'width 0.22s cubic-bezier(0.4,0,0.2,1)', overflow:'hidden', boxShadow:'2px 0 16px rgba(74,144,226,0.08)' }}>

        <div style={{ padding:'14px 0', display:'flex', alignItems:'center', justifyContent: expanded ? 'flex-start' : 'center', paddingLeft: expanded ? 14 : 0, borderBottom:'1px solid #DDEAFF', minHeight:72, flexShrink:0, gap: expanded ? 12 : 0, transition:'all 0.22s' }}>
          <ClubLogo size={44} />
          {expanded && (
            <div style={{ overflow:'hidden', whiteSpace:'nowrap' }}>
              <div style={{ fontWeight:800, fontSize:14, color:'#1A2E4A', overflow:'hidden', textOverflow:'ellipsis', maxWidth:150 }}>{teamName || 'AthleteHub'}</div>
              <div style={{ fontSize:10, color:'#7A9CC4', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', marginTop:2 }}>{teamShort || 'FOS'}</div>
            </div>
          )}
        </div>

        <nav style={{ flex:1, padding:'10px 0', overflowY:'auto', overflowX:'hidden' }}>
          {navLinks.map(({ href, label, page }) => {
            const active = path === href || path.startsWith(href + '/')
            return (
              <Link key={href} href={href}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', paddingLeft: expanded ? 16 : 0, justifyContent: expanded ? 'flex-start' : 'center', margin:'2px 8px', borderRadius:10, background: active ? 'linear-gradient(135deg, #4A90E2, #3B7DD8)' : 'transparent', color: active ? '#fff' : '#5A7BA0', fontWeight: active ? 600 : 500, fontSize:14, textDecoration:'none', transition:'all 0.15s', whiteSpace:'nowrap', overflow:'hidden', flexShrink:0, boxShadow: active ? '0 4px 12px rgba(74,144,226,0.35)' : 'none' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#E0ECFF' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                <span style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', color: active ? '#fff' : '#5A7BA0', minWidth:20 }}>
                  {ICONS[page] || ICONS.dashboard}
                </span>
                {expanded && <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{label}</span>}
              </Link>
            )
          })}
        </nav>

        <div style={{ padding:'12px 0', borderTop:'1px solid #DDEAFF', flexShrink:0 }}>
          {expanded ? (
            <div style={{ padding:'0 12px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, background:'#E8F0FF', borderRadius:10, padding:'10px 12px' }}>
                <div style={{ width:34, height:34, borderRadius:'50%', background:`linear-gradient(135deg, ${teamColor}, ${teamColor}BB)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#fff', flexShrink:0 }}>
                  {initials}
                </div>
                <div style={{ flex:1, overflow:'hidden' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#1A2E4A', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile?.full_name || 'Admin'}</div>
                  <div style={{ fontSize:10, color:'#7A9CC4', textTransform:'capitalize', marginTop:1 }}>{role}</div>
                </div>
              </div>
              <button onClick={handleSignOut}
                style={{ width:'100%', background:'rgba(74,144,226,0.1)', color:'#4A90E2', border:'1px solid rgba(74,144,226,0.2)', borderRadius:8, padding:'8px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'Plus Jakarta Sans,sans-serif', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,144,226,0.2)'; e.currentTarget.style.color = '#2E6FC4' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(74,144,226,0.1)'; e.currentTarget.style.color = '#4A90E2' }}>
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', justifyContent:'center' }}>
              <button onClick={handleSignOut} title={`${profile?.full_name || 'Admin'} · Sign Out`}
                style={{ width:44, height:44, borderRadius:'50%', background:`linear-gradient(135deg,${teamColor},${teamColor}BB)`, border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:12, fontWeight:800, color:'#fff', transition:'all 0.15s', boxShadow:`0 2px 8px ${teamColor}40` }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                {initials}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div style={{ marginLeft:sideW, flex:1, display:'flex', flexDirection:'column', minHeight:'100vh', transition:'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)' }}>
        <header style={{ height:56, background:'#F0F6FF', borderBottom:'1px solid #DDEAFF', display:'flex', alignItems:'center', padding:'0 28px', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
          <div style={{ fontSize:16, fontWeight:700, color:'#1A2E4A' }}>
            {ALL_NAV.find(n => path === n.href || path.startsWith(n.href + '/'))?.label || 'Dashboard'}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            {teamName && (
              <div style={{ display:'flex', alignItems:'center', gap:7, background:'#E0ECFF', borderRadius:99, padding:'5px 12px', border:'1px solid #DDEAFF' }}>
                {teamLogo && !logoError
                  ? <img src={teamLogo} alt={teamName} onError={() => setLogoError(true)} style={{ width:18, height:18, objectFit:'contain', borderRadius:4 }} />
                  : <div style={{ width:18, height:18, borderRadius:4, background:teamColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:800, color:'#fff' }}>{teamShort?.slice(0,2)}</div>
                }
                <span style={{ fontSize:12, color:'#3B6BA0', fontWeight:600 }}>{teamName}</span>
              </div>
            )}
            <div style={{ fontSize:12, color:'#7A9CC4', fontWeight:500 }}>
              {new Date().toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'#E0ECFF', borderRadius:99, padding:'5px 12px', border:'1px solid #DDEAFF' }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#27AE60', boxShadow:'0 0 5px #27AE60' }} />
              <span style={{ fontSize:12, color:'#3B6BA0', fontWeight:600 }}>Live</span>
            </div>
          </div>
        </header>
        <main style={{ flex:1 }}>{children}</main>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#BDD4FF;border-radius:4px}`}</style>
    </div>
  )
}