'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { signOut } from '@/lib/auth'
import { User, Zap, Calendar, LogOut } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/player-hub', label: 'My Profile', icon: <User size={20} strokeWidth={2} /> },
  { href: '/player-hub/performance', label: 'My Stats', icon: <Zap size={20} strokeWidth={2} /> },
  { href: '/player-hub/schedule', label: 'Schedule', icon: <Calendar size={20} strokeWidth={2} /> },
]

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

export default function PlayerLayout({ children }) {
  const path = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [logoError, setLogoError] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.replace('/login'); return }
        const { data } = await supabase
          .from('profiles')
          .select('*, teams(id, name, short_name, logo_url)')
          .eq('id', session.user.id)
          .single()
        
        if (!data || data.role !== 'player' || data.is_active === false) {
          await supabase.auth.signOut()
          router.replace('/login?reason=disabled')
          return
        }
        setProfile({ ...data, email: session.user.email })
      } catch (e) {
        console.error('PlayerLayout error:', e)
        router.replace('/login')
      }
      setLoading(false)
    }
    loadProfile()
  }, [router])

  async function handleSignOut() {
    await signOut()
    router.replace('/login')
  }

  const teamName = profile?.teams?.name || profile?.club_name || null
  const teamLogo = profile?.teams?.logo_url || profile?.club_logo_url || null
  const initials = (profile?.full_name || 'PL').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: C.floral }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${C.floralMuted}`, borderTopColor: C.lagoon, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  function ClubLogo({ size = 40 }) {
    if (teamLogo && !logoError) {
      return (
        <img src={teamLogo} alt={teamName || 'Club'} onError={() => setLogoError(true)}
          style={{ width: size, height: size, borderRadius: 10, objectFit: 'contain', background: C.floral, padding: 3, flexShrink: 0, border: `1px solid ${C.border}` }} />
      )
    }
    return (
      <div style={{ width: size, height: size, borderRadius: 10, background: C.floral, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${C.border}` }}>
        <img src="/logo.png" alt="Apex Track" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
      </div>
    )
  }

  // ── MOBILE LAYOUT ──
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: C.floral, fontFamily: 'var(--font)' }}>
        <header style={{ height: 60, background: C.floralDark, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ClubLogo size={32} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{teamName || 'ApexTrack Player Portal'}</div>
              <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Player Hub</div>
            </div>
          </div>
          <button onClick={handleSignOut} title="Sign Out"
            style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
            <LogOut size={20} />
          </button>
        </header>

        <main style={{ flex: 1, paddingBottom: 72, minWidth: 0, overflowX: 'hidden' }}>{children}</main>

        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 64, background: C.floralDark, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-around', zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
          {NAV_ITEMS.map(({ href, label, icon }) => {
            const active = path === href
            const shortLabel = href === '/player-hub' ? 'Profile' : href.includes('performance') ? 'Stats' : 'Schedule'
            return (
              <Link key={href} href={href}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 4px', textDecoration: 'none', color: active ? C.lagoon : C.text3, flex: 1, minWidth: 0, maxWidth: 96 }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: active ? 'var(--lagoon-alpha)' : 'transparent', transition: 'all 0.15s', flexShrink: 0 }}>
                  {icon}
                </span>
                <span style={{ fontSize: 9, fontWeight: active ? 600 : 500, lineHeight: 1.1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{shortLabel}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    )
  }

  // ── DESKTOP LAYOUT ──
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.floral, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      
      {/* Sidebar */}
      <aside style={{ width: 240, flexShrink: 0, background: C.floralDark, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100, borderRight: `1px solid ${C.border}`, boxShadow: 'var(--shadow-md)' }}>
        
        {/* Sidebar Header */}
        <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${C.border}`, minHeight: 80, gap: 12 }}>
          <ClubLogo size={42} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{teamName || 'ApexTrack'}</div>
            <div style={{ fontSize: 10, color: C.text3, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>Player Hub</div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV_ITEMS.map(({ href, label, icon }) => {
            const active = path === href
            return (
              <Link key={href} href={href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  borderRadius: 12,
                  background: active ? 'var(--lagoon-alpha)' : 'transparent',
                  color: active ? C.lagoon : C.text3,
                  fontWeight: active ? 600 : 500,
                  fontSize: 14, textDecoration: 'none', transition: 'all 0.15s'
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = C.floralMuted; e.currentTarget.style.color = C.text2 } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text3 } }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Sidebar Footer */}
        <div style={{ padding: '20px 12px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '8px' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.floralMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: C.text2, flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name}</div>
              <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>Player</div>
            </div>
          </div>
          <button onClick={handleSignOut}
            style={{ width: '100%', background: 'transparent', color: C.text3, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.borderColor = '#FCA5A5' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text3; e.currentTarget.style.borderColor = C.border }}>
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', background: C.floral }}>
        <header style={{ height: 64, background: C.floralDark, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 32px', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
            {NAV_ITEMS.find(n => path === n.href)?.label || 'Player Portal'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {teamName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.floralMuted, borderRadius: 99, padding: '6px 14px', border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.text2, fontWeight: 600 }}>{teamName}</span>
              </div>
            )}
            <div style={{ fontSize: 13, color: C.text3, fontWeight: 500 }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </header>
        <main style={{ flex: 1 }}>{children}</main>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
