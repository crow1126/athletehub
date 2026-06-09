'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const NAV = [
  { href: '/pay',              label: 'Overview',     icon: '◈' },
  { href: '/pay/payroll',      label: 'Payroll',      icon: '💳' },
  { href: '/pay/transactions', label: 'Transactions', icon: '📋' },
  { href: '/pay/settings',     label: 'Settings',     icon: '⚙️' },
]

export default function PayLayout({ children }) {
  const path    = usePathname()
  const router  = useRouter()
  const [profile,   setProfile]   = useState(null)
  const [team,      setTeam]      = useState(null)
  const [isMobile,  setIsMobile]  = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)

  /* Detect mobile */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  /* Close menu on route change */
  useEffect(() => { setMenuOpen(false) }, [path])

  useEffect(() => {
    async function load() {
      // SSO — parse access_token / refresh_token from URL hash
      if (typeof window !== 'undefined' && window.location.hash) {
        const hash   = window.location.hash.substring(1)
        const params = new URLSearchParams(hash)
        const accessToken  = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        if (accessToken && refreshToken) {
          try {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
            window.history.replaceState(null, '', window.location.pathname + window.location.search)
          } catch (e) {
            console.error('Failed to restore SSO session:', e)
          }
        }
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data } = await supabase
        .from('profiles')
        .select('*, teams(id, name, logo_url)')
        .eq('id', session.user.id)
        .single()
      if (data) { setProfile(data); setTeam(data.teams) }
    }
    load()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const mainUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host.replace(/^pay\./i, '')}/dashboard`
    : '/dashboard'

  /* ── GLOBAL STYLES ── */
  const globalCss = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: #0A0F1E; }
    ::-webkit-scrollbar-thumb { background: #1E2D4A; border-radius: 4px; }
    @keyframes spin    { to { transform: rotate(360deg); } }
    @keyframes fadeUp  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 16px rgba(251,191,36,0.2); } 50% { box-shadow: 0 0 32px rgba(251,191,36,0.5); } }
    @keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }

    /* ── Nav link (sidebar) ── */
    .pay-nav-link {
      display: flex; align-items: center; gap: 12px;
      padding: 11px 14px; border-radius: 12px;
      text-decoration: none; font-size: 14px; font-weight: 500;
      transition: all 0.18s; color: #64748B;
    }
    .pay-nav-link:hover  { background: rgba(251,191,36,0.07); color: #CBD5E1; }
    .pay-nav-link.active { background: rgba(251,191,36,0.12); color: #FBB124; font-weight: 700; }

    /* ── Cards & inputs ── */
    .pay-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; }
    .pay-btn-gold  { background: linear-gradient(135deg,#D97706,#F59E0B); color: #0A0F1E; border: none; border-radius: 10px; padding: 11px 20px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.2s; }
    .pay-btn-gold:hover  { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(251,191,36,0.35); }
    .pay-btn-ghost { background: rgba(255,255,255,0.06); color: #94A3B8; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 11px 20px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; }
    .pay-btn-ghost:hover { background: rgba(255,255,255,0.1); color: #CBD5E1; }
    .pay-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
    .pay-inp { width: 100%; padding: 11px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; font-size: 14px; color: #E2E8F0; font-family: inherit; outline: none; transition: border-color 0.18s; }
    .pay-inp:focus { border-color: #F59E0B; box-shadow: 0 0 0 3px rgba(245,158,11,0.12); }
    .pay-lbl { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #64748B; margin-bottom: 6px; }

    /* ── Mobile bottom nav ── */
    .pay-bottom-nav {
      position: fixed; bottom: 0; left: 0; right: 0; height: 64px;
      background: #060A14; border-top: 1px solid rgba(255,255,255,0.08);
      display: flex; align-items: center; justify-content: space-around;
      z-index: 200;
      padding-bottom: env(safe-area-inset-bottom);
    }
    .pay-bottom-nav-item {
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      text-decoration: none; color: #475569; font-size: 9px; font-weight: 600;
      padding: 6px 4px; flex: 1; transition: color 0.15s;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      letter-spacing: 0.04em; text-transform: uppercase;
    }
    .pay-bottom-nav-item.active { color: #F59E0B; }
    .pay-bottom-nav-icon {
      font-size: 18px; width: 34px; height: 34px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s;
    }
    .pay-bottom-nav-item.active .pay-bottom-nav-icon { background: rgba(251,191,36,0.12); }

    /* ── Mobile header ── */
    .pay-mobile-header {
      position: sticky; top: 0; z-index: 150;
      height: 56px; background: #060A14;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      display: flex; align-items: center; padding: 0 16px;
      justify-content: space-between;
    }
    .pay-hamburger {
      background: none; border: none; cursor: pointer;
      color: #94A3B8; padding: 6px; display: flex;
      align-items: center; justify-content: center;
      border-radius: 8px; transition: background 0.15s;
    }
    .pay-hamburger:hover { background: rgba(255,255,255,0.06); }

    /* ── Mobile drawer ── */
    .pay-drawer-overlay {
      position: fixed; inset: 0; z-index: 300;
      background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);
    }
    .pay-drawer {
      position: fixed; top: 0; left: 0; bottom: 0; width: 260px;
      background: #060A14; border-right: 1px solid rgba(255,255,255,0.08);
      z-index: 301; display: flex; flex-direction: column;
      animation: slideIn 0.22s cubic-bezier(0.4,0,0.2,1);
    }
    @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }

    /* ── Scrollable table wrapper ── */
    .pay-table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .pay-table-scroll table { min-width: 560px; }

    /* ── Responsive page padding ── */
    .pay-page { padding: 24px 32px; }
    @media (max-width: 767px) {
      .pay-page { padding: 16px; }
      .pay-btn-gold, .pay-btn-ghost { padding: 10px 16px; font-size: 13px; }
    }
  `

  /* ── MOBILE LAYOUT ── */
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0A0F1E', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: '#E2E8F0' }}>
        <style>{globalCss}</style>

        {/* Mobile top header */}
        <header className="pay-mobile-header">
          <button className="pay-hamburger" onClick={() => setMenuOpen(v => !v)} aria-label="Menu">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="7" x2="19" y2="7"/><line x1="3" y1="12" x2="19" y2="12"/><line x1="3" y1="17" x2="19" y2="17"/>
            </svg>
          </button>
          <Link href="/pay" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#D97706,#F59E0B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, animation: 'pulse-glow 3s ease-in-out infinite' }}>₵</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.03em' }}>Apex<span style={{ color: '#F59E0B' }}>Pay</span></div>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(5,150,105,0.15)', borderRadius: 99, padding: '4px 10px', border: '1px solid rgba(5,150,105,0.3)' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#10B981' }}>Live</span>
          </div>
        </header>

        {/* Slide-in drawer */}
        {menuOpen && (
          <div className="pay-drawer-overlay" onClick={() => setMenuOpen(false)}>
            <div className="pay-drawer" onClick={e => e.stopPropagation()}>
              {/* Drawer brand */}
              <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#D97706,#F59E0B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900 }}>₵</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#F1F5F9' }}>Apex<span style={{ color: '#F59E0B' }}>Pay</span></div>
                    <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Club Payroll</div>
                  </div>
                </div>
                {team && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                    {team.logo_url
                      ? <img src={team.logo_url} alt={team.name} style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'contain' }} />
                      : <div style={{ width: 22, height: 22, borderRadius: 5, background: 'rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#F59E0B' }}>{team.name?.slice(0,2)}</div>
                    }
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</span>
                  </div>
                )}
              </div>

              {/* Drawer nav */}
              <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
                {NAV.map(n => (
                  <Link key={n.href} href={n.href} className={`pay-nav-link${path === n.href ? ' active' : ''}`}>
                    <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{n.icon}</span>
                    {n.label}
                  </Link>
                ))}
                {profile?.role !== 'accountant' && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <a href={mainUrl} className="pay-nav-link" style={{ fontSize: 13 }}>
                      <span>←</span> Back to ApexTrack
                    </a>
                  </div>
                )}
              </nav>

              {/* Drawer user footer */}
              <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#F59E0B', flexShrink: 0 }}>
                    {(profile?.full_name || 'A').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#CBD5E1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name || 'Admin'}</div>
                    <div style={{ fontSize: 10, color: '#475569', textTransform: 'capitalize' }}>{profile?.role}</div>
                  </div>
                </div>
                <button onClick={signOut} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#475569', padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main style={{ flex: 1, paddingBottom: 72, minWidth: 0, overflowX: 'hidden' }}>{children}</main>

        {/* Bottom navigation */}
        <nav className="pay-bottom-nav">
          {NAV.map(n => {
            const active = path === n.href || (n.href !== '/pay' && path.startsWith(n.href + '/'))
              || (n.href === '/pay' && path === '/pay')
            return (
              <Link key={n.href} href={n.href} className={`pay-bottom-nav-item${active ? ' active' : ''}`}>
                <div className="pay-bottom-nav-icon">{n.icon}</div>
                {n.label}
              </Link>
            )
          })}
        </nav>
      </div>
    )
  }

  /* ── DESKTOP LAYOUT ── */
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0A0F1E', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: '#E2E8F0' }}>
      <style>{globalCss}</style>

      {/* ── SIDEBAR ── */}
      <aside style={{ width: 220, flexShrink: 0, background: '#060A14', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100 }}>
        {/* Brand */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Link href="/pay" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#D97706,#F59E0B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, animation: 'pulse-glow 3s ease-in-out infinite' }}>₵</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.03em' }}>Apex<span style={{ color: '#F59E0B' }}>Pay</span></div>
              <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Club Payroll</div>
            </div>
          </Link>
        </div>

        {/* Club badge */}
        {team && (
          <div style={{ margin: '16px 14px', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {team.logo_url
              ? <img src={team.logo_url} alt={team.name} style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'contain' }} />
              : <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#F59E0B' }}>{team.name?.slice(0,2)}</div>
            }
            <span style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</span>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(n => (
            <Link key={n.href} href={n.href} className={`pay-nav-link${path === n.href ? ' active' : ''}`}>
              <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{n.icon}</span>
              {n.label}
            </Link>
          ))}
          {profile?.role !== 'accountant' && (
            <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, marginTop: 16 }}>
              <a href={mainUrl} className="pay-nav-link" style={{ fontSize: 12 }}>
                <span>←</span> Back to ApexTrack
              </a>
            </div>
          )}
        </nav>

        {/* User footer */}
        <div style={{ padding: '16px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#F59E0B', flexShrink: 0 }}>
              {(profile?.full_name || 'A').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#CBD5E1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name || 'Admin'}</div>
              <div style={{ fontSize: 10, color: '#475569', textTransform: 'capitalize' }}>{profile?.role}</div>
            </div>
          </div>
          <button onClick={signOut} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#475569', padding: '7px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ marginLeft: 220, flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <header style={{ height: 60, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', padding: '0 32px', justifyContent: 'space-between', background: 'rgba(6,10,20,0.8)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(5,150,105,0.15)', borderRadius: 99, padding: '5px 14px', border: '1px solid rgba(5,150,105,0.3)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981' }}>ApexPay Live</span>
          </div>
        </header>
        <main style={{ flex: 1 }}>{children}</main>
      </div>
    </div>
  )
}
