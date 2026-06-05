'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { signOut, ROLE_PERMISSIONS } from '@/lib/auth'

import {
  LayoutDashboard, Users, Shield, Calendar, Activity, Zap, 
  Search, FileText, BarChart3, Settings, ArrowRightLeft, CreditCard,
  Menu, X
} from 'lucide-react'

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
  { href:'/transfers',   label:'Transfers',   page:'transfers'   },
  { href:'/billing',     label:'Billing',     page:'billing'     },
]

const MOBILE_NAV = ['dashboard','athletes','schedule','injuries','settings']

const MOBILE_NAV_LABELS = {
  dashboard: 'Home',
  athletes:  'Squad',
  schedule:  'Schedule',
  injuries:  'Medical',
  settings:  'Settings',
}

const iconProps = { size: 20, strokeWidth: 2 }
const ICONS = {
  dashboard:   <LayoutDashboard {...iconProps} />,
  athletes:    <Users {...iconProps} />,
  coaches:     <Shield {...iconProps} />,
  schedule:    <Calendar {...iconProps} />,
  injuries:    <Activity {...iconProps} />,
  performance: <Zap {...iconProps} />,
  scouting:    <Search {...iconProps} />,
  contracts:   <FileText {...iconProps} />,
  reports:     <BarChart3 {...iconProps} />,
  settings:    <Settings {...iconProps} />,
  billing:     <CreditCard {...iconProps} />,
  transfers:   <ArrowRightLeft {...iconProps} />,
  menu:        <Menu size={24} strokeWidth={2} />,
  close:       <X size={24} strokeWidth={2} />,
}

const C = {
  floral:     'var(--floral)',
  floralDark: 'var(--floral-dark)',
  floralMuted:'var(--floral-muted)',
  lagoon:     'var(--lagoon)',
  lagoonLight:'var(--lagoon-light)',
  lagoonDeep: 'var(--lagoon-deep)',
  border:     'var(--border)',
  text:       'var(--text)',
  text2:      'var(--text2)',
  text3:      'var(--text3)',
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
          // ── KEY FIX: added club_name and club_logo_url to the select ──
          .select('*, club_name, club_logo_url, teams(id, name, short_name, primary_color, logo_url)')
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

  const teamName  = profile?.teams?.name      || profile?.club_name  || null
  const teamShort = profile?.teams?.short_name || (profile?.club_name ? profile.club_name.slice(0,3).toUpperCase() : null)
  // ── KEY FIX: prefer club_logo_url from profiles, fall back to teams.logo_url ──
  const teamLogo  = (profile?.club_logo_url && !profile.club_logo_url.startsWith('data:'))
    ? profile.club_logo_url
    : (profile?.teams?.logo_url || null)

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background: C.floral }}>
      <div style={{ width:36, height:36, border:`3px solid ${C.floralMuted}`, borderTopColor: C.lagoon, borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const sideW = expanded ? 240 : 72

  function ClubLogo({ size = 44 }) {
    if (teamLogo && !logoError) {
      return (
        <img src={teamLogo} alt={teamName || 'Club'} onError={() => setLogoError(true)}
          style={{ width:size, height:size, borderRadius:12, objectFit:'contain', background: C.floral, padding:4, flexShrink:0, border:`1px solid ${C.border}` }} />
      )
    }
    return (
      <div style={{ width:size, height:size, borderRadius:12, background: C.floral, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:`0 4px 12px rgba(0,106,106,0.12)`, border:`1px solid ${C.border}` }}>
        <img src="/logo.png" alt="Apex Track" style={{ width:'85%', height:'85%', objectFit:'contain', borderRadius:'4px' }} />
      </div>
    )
  }

  // ── MOBILE ──
  if (isMobile) {
    return (
      <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', background: C.floral, fontFamily:'var(--font)' }}>

        <header style={{ height:60, background: C.floralDark, borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', padding:'0 16px', justifyContent:'space-between', position:'sticky', top:0, zIndex:200 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <ClubLogo size={32} />
            <div>
              <div style={{ fontSize:14, fontWeight:700, color: C.text }}>{teamName || 'Apex Track'}</div>
              <div style={{ fontSize:11, color: C.text3, textTransform:'capitalize' }}>{role}</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={() => setMobileMenu(v => !v)}
              style={{ background:'none', border:'none', cursor:'pointer', color: C.text2, padding:4, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {mobileMenu ? ICONS.close : ICONS.menu}
            </button>
          </div>
        </header>

        {mobileMenu && (
          <div style={{ position:'fixed', top:60, left:0, right:0, bottom:0, zIndex:150, background:'rgba(15, 23, 42, 0.4)', backdropFilter:'blur(4px)' }} onClick={() => setMobileMenu(false)}>
            <div style={{ background: C.floralDark, borderBottom:`1px solid ${C.border}`, padding:'12px 0', maxHeight:'80vh', overflowY:'auto' }}
              onClick={e => e.stopPropagation()}>
              {navLinks.map(({ href, label, page }) => {
                const active = path === href || path.startsWith(href + '/')
                return (
                  <Link key={href} href={href}
                    style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 20px', color: active ? C.lagoon : C.text2, fontWeight: active ? 600 : 500, fontSize:15, textDecoration:'none', background: active ? 'var(--lagoon-alpha)' : 'transparent', borderLeft: active ? `3px solid ${C.lagoon}` : '3px solid transparent' }}>
                    <span style={{ color: active ? C.lagoon : C.text3 }}>{ICONS[page]}</span>
                    {label}
                  </Link>
                )
              })}
              <div style={{ padding:'16px 20px', borderTop:`1px solid ${C.border}`, marginTop:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background: C.floralMuted, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color: C.text2 }}>
                    {initials}
                  </div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color: C.text }}>{profile?.full_name || 'Admin'}</div>
                    <div style={{ fontSize:12, color: C.text3 }}>{profile?.email}</div>
                  </div>
                </div>
                <button onClick={handleSignOut}
                  style={{ width:'100%', background:'transparent', color: C.text3, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        <main style={{ flex:1, paddingBottom:72, minWidth:0, overflowX:'hidden' }}>{children}</main>

        <nav style={{ position:'fixed', bottom:0, left:0, right:0, height:64, background: C.floralDark, borderTop:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-around', zIndex:100, paddingBottom:'env(safe-area-inset-bottom)', paddingLeft:'env(safe-area-inset-left)', paddingRight:'env(safe-area-inset-right)' }}>
          {mobileNav.map(({ href, label, page }) => {
            const active = path === href || path.startsWith(href + '/')
            const navLabel = MOBILE_NAV_LABELS[page] || label
            return (
              <Link key={href} href={href}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'6px 4px', textDecoration:'none', color: active ? C.lagoon : C.text3, flex:1, minWidth:0, maxWidth:72 }}>
                <span style={{ display:'flex', alignItems:'center', justifyContent:'center', width:30, height:30, borderRadius:8, background: active ? 'var(--lagoon-alpha)' : 'transparent', transition:'all 0.15s', flexShrink:0 }}>
                  {ICONS[page]}
                </span>
                <span style={{ fontSize:9, fontWeight: active ? 600 : 500, lineHeight:1.1, textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', width:'100%' }}>{navLabel}</span>
              </Link>
            )
          })}
        </nav>

        <style>{`@keyframes spin{to{transform:rotate(360deg)}} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:${C.floralMuted};border-radius:4px}`}</style>
      </div>
    )
  }

  // ── DESKTOP ──
  return (
    <div style={{ display:'flex', minHeight:'100vh', background: C.floral, fontFamily:'Plus Jakarta Sans, sans-serif' }}>

      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        style={{ width:sideW, flexShrink:0, background: C.floralDark, display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, bottom:0, zIndex:100, borderRight:`1px solid ${C.border}`, transition:'width 0.22s cubic-bezier(0.4,0,0.2,1)', overflow:'hidden', boxShadow:`var(--shadow-lg)` }}>

        <div style={{ padding:'20px 0', display:'flex', alignItems:'center', justifyContent: expanded ? 'flex-start' : 'center', paddingLeft: expanded ? 16 : 0, borderBottom:`1px solid ${C.border}`, minHeight:80, flexShrink:0, gap: expanded ? 12 : 0, transition:'all 0.22s' }}>
          <ClubLogo size={44} />
          {expanded && (
            <div style={{ overflow:'hidden', whiteSpace:'nowrap', animation: 'fadeUp 0.3s ease' }}>
              <div style={{ fontWeight:800, fontSize:15, color: C.text, overflow:'hidden', textOverflow:'ellipsis', maxWidth:150 }}>{teamName || 'Apex Track'}</div>
              <div style={{ fontSize:11, color: C.text3, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', marginTop:2 }}>{teamShort || 'AT'}</div>
            </div>
          )}
        </div>

        <nav style={{ flex:1, padding:'20px 12px', overflowY:'auto', overflowX:'hidden', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navLinks.map(({ href, label, page }) => {
            const active    = path === href || path.startsWith(href + '/')
            const isBilling = page === 'billing'
            
            // Modern active state: light teal background with primary teal text
            const activeBg = 'var(--lagoon-alpha)'
            const activeColor = C.lagoon
            
            return (
              <Link key={href} href={href}
                style={{ 
                  display:'flex', alignItems:'center', gap:12, padding:'10px 12px',
                  justifyContent: expanded ? 'flex-start' : 'center',
                  borderRadius:12, 
                  background: active ? activeBg : 'transparent', 
                  color: active ? activeColor : C.text3, 
                  fontWeight: active ? 600 : 500, 
                  fontSize:14, textDecoration:'none', transition:'all 0.15s', whiteSpace:'nowrap', overflow:'hidden', flexShrink:0
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = C.floralMuted; e.currentTarget.style.color = C.text2 } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text3 } }}>
                <span style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', minWidth:24 }}>
                  {ICONS[page] || ICONS.dashboard}
                </span>
                {expanded && <span style={{ overflow:'hidden', textOverflow:'ellipsis', marginTop:1 }}>{label}</span>}
              </Link>
            )
          })}
        </nav>

        <div style={{ padding:'20px 12px', borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
          {expanded ? (
            <div style={{ animation: 'fadeUp 0.3s ease' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, padding:'8px', borderRadius:12 }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background: C.floralMuted, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color: C.text2, flexShrink:0 }}>
                  {initials}
                </div>
                <div style={{ flex:1, overflow:'hidden' }}>
                  <div style={{ fontSize:13, fontWeight:600, color: C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile?.full_name || 'Admin'}</div>
                  <div style={{ fontSize:11, color: C.text3, textTransform:'capitalize', marginTop:2 }}>{role}</div>
                </div>
              </div>
              <button onClick={handleSignOut}
                style={{ width:'100%', background:'transparent', color: C.text3, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onMouseEnter={e => { e.currentTarget.style.background = C.floralMuted; e.currentTarget.style.color = C.text }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text3 }}>
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', justifyContent:'center' }}>
              <button onClick={handleSignOut} title={`${profile?.full_name || 'Admin'} · Sign Out`}
                style={{ width:40, height:40, borderRadius:'50%', background: C.floralMuted, border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:13, fontWeight:700, color: C.text2, transition:'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = C.border}
                onMouseLeave={e => e.currentTarget.style.background = C.floralMuted}>
                {initials}
              </button>
            </div>
          )}
        </div>
      </aside>

      <div style={{ marginLeft:sideW, flex:1, display:'flex', flexDirection:'column', minHeight:'100vh', transition:'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)', background: C.floral }}>
        <header style={{ height:64, background: C.floralDark, borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', padding:'0 32px', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
          <div style={{ fontSize:18, fontWeight:700, color: C.text, letterSpacing: '-0.01em' }}>
            {ALL_NAV.find(n => path === n.href || path.startsWith(n.href + '/'))?.label || 'Dashboard'}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:20 }}>
            {teamName && (
              <div style={{ display:'flex', alignItems:'center', gap:8, background: C.floralMuted, borderRadius:99, padding:'6px 14px', border:`1px solid ${C.border}` }}>
                {teamLogo && !logoError
                  ? <img src={teamLogo} alt={teamName} onError={() => setLogoError(true)} style={{ width:20, height:20, objectFit:'contain', borderRadius:6 }} />
                  : <div style={{ width:20, height:20, borderRadius:6, background: C.lagoon, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color: '#fff' }}>{teamShort?.slice(0,2)}</div>
                }
                <span style={{ fontSize:13, color: C.text2, fontWeight:600 }}>{teamName}</span>
              </div>
            )}
            <div style={{ fontSize:13, color: C.text3, fontWeight:500 }}>
              {new Date().toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6, background: 'var(--success-light)', borderRadius:99, padding:'6px 14px', border:`1px solid rgba(5, 150, 105, 0.2)` }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--success)', boxShadow:'0 0 8px var(--success)' }} />
              <span style={{ fontSize:12, color: 'var(--success)', fontWeight:700 }}>Live</span>
            </div>
          </div>
        </header>
        <main style={{ flex:1 }}>{children}</main>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:${C.floralMuted};border-radius:4px}`}</style>
    </div>
  )
}