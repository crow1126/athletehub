'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Bell } from 'lucide-react'

const NAV = [
  { href: '/pay',              label: 'Overview',     icon: '◈' },
  { href: '/pay/payroll',      label: 'Payroll',      icon: '💳' },
  { href: '/pay/transactions', label: 'Transactions', icon: '' },
  { href: '/pay/settings',     label: 'Settings',     icon: '' },
]

// ── ApexTrack colour tokens (mirrors globals.css :root) ──────────────────────
const C = {
  bg:          '#F0FBF4',          // --floral      mint bg
  sidebar:     '#FFFFFF',          // --floral-dark  sidebar / cards
  muted:       '#E2F5E9',          // --floral-muted hover
  border:      '#82C29A',          // --border (darkened for contrast)
  teal:        '#0B7A70',          // --lagoon (darkened for contrast)
  tealLight:   '#0D9488',          // --lagoon-light
  tealDeep:    '#0A5C54',          // --lagoon-deep
  tealAlpha:   'rgba(11,122,112,0.10)', // --lagoon-alpha
  text:        '#0B1E14',          // --text
  text2:       '#102A1C',          // --text2 (darkened for contrast)
  text3:       '#243E30',          // --text3 (darkened for contrast)
  success:     '#047857',
  successBg:   '#D1FAE5',
  shadow:      '0 1px 3px rgba(10,80,50,0.08)',
  shadowMd:    '0 4px 8px rgba(10,80,50,0.10)',
  shadowLg:    '0 10px 20px rgba(10,80,50,0.10)',
}

const NOTIF_TYPE_LABELS = {
  sms_schedule: 'Session Scheduled',
  sms_reminder: 'Session Reminder',
}

function BellButton({ notifications, unreadCount, onToggle, panelOpen, panelRef, onMarkRead }) {
  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      <button
        id="bell-notification-btn"
        onClick={onToggle}
        title="Notifications"
        style={{
          position: 'relative',
          background: panelOpen ? C.tealAlpha : 'none',
          border: `1px solid ${panelOpen ? C.teal : 'transparent'}`,
          cursor: 'pointer',
          color: panelOpen ? C.teal : C.text2,
          padding: 6,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          if (!panelOpen) { e.currentTarget.style.background = C.muted; e.currentTarget.style.color = C.text }
        }}
        onMouseLeave={e => {
          if (!panelOpen) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text2 }
        }}
      >
        <Bell size={20} strokeWidth={2} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 2, right: 2,
            minWidth: 16, height: 16,
            borderRadius: '50%',
            background: '#EF4444',
            color: '#fff',
            fontSize: 9,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            padding: '0 3px',
            boxShadow: `0 0 0 2px ${C.sidebar}`,
            animation: 'notifPing 2s ease infinite',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {panelOpen && (
        <div
          id="notification-panel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 340,
            maxHeight: 480,
            background: C.sidebar,
            border: `1px solid ${C.border}`,
            borderRadius: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            zIndex: 300,
            overflow: 'hidden',
            animation: 'notifDrop 0.18s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {/* Panel header */}
          <div style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Notifications</div>
              {unreadCount > 0 && (
                <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
                  {unreadCount} unread
                </div>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={onMarkRead}
                style={{
                  background: 'none',
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.teal,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div style={{ overflowY: 'auto', maxHeight: 400 }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: '40px 18px',
                textAlign: 'center',
                color: C.text3,
                fontSize: 13,
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}></div>
                No notifications yet
              </div>
            ) : notifications.map(n => {
              const isUnread = !n.read_at
              const timeAgo = getTimeAgo(n.created_at)
              return (
                <div
                  key={n.id}
                  style={{
                    padding: '13px 18px',
                    borderBottom: `1px solid ${C.border}`,
                    background: isUnread ? C.tealAlpha : 'transparent',
                    borderLeft: isUnread ? `3px solid ${C.teal}` : '3px solid transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: isUnread ? 700 : 600, color: C.text, marginBottom: 2 }}>
                        {NOTIF_TYPE_LABELS[n.type] || n.title}
                      </div>
                      {n.body && (
                        <div style={{ fontSize: 11, color: C.text2, lineHeight: 1.4, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {n.body}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: C.text3 }}>{timeAgo}</span>
                        {n.sent_count > 0 && (
                          <span style={{ fontSize: 10, color: C.teal, fontWeight: 700 }}>
                            📱 {n.sent_count} SMS sent
                          </span>
                        )}
                      </div>
                    </div>
                    {isUnread && (
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.teal, flexShrink: 0, marginTop: 4 }} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function getTimeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function PayLayout({ children }) {
  const path   = usePathname()
  const router = useRouter()
  const [profile,  setProfile]  = useState(null)
  const [team,     setTeam]     = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // ── Notifications state ──
  const [notifications,  setNotifications]  = useState([])
  const [notifOpen,      setNotifOpen]      = useState(false)
  const notifPanelRef = useRef(null)

  const unreadCount = notifications.filter(n => !n.read_at).length

  /* Detect mobile */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  /* Close menu on route change */
  useEffect(() => { setMenuOpen(false) }, [path])

  // Close notification panel when clicking outside
  useEffect(() => {
    if (!notifOpen) return
    function handleClickOutside(e) {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notifOpen])

  useEffect(() => {
    async function load() {
      // Session is provided by the shared .apextrackgh.com cookie
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

  // ── Load + subscribe to notifications once profile is loaded ──
  const fetchNotifications = useCallback(async (teamId) => {
    if (!teamId) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setNotifications(data)
  }, [])

  useEffect(() => {
    const teamId = profile?.team_id
    if (!teamId) return

    fetchNotifications(teamId)

    // Realtime subscription
    const channel = supabase
      .channel(`pay_notifications:${teamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `team_id=eq.${teamId}` },
        () => fetchNotifications(teamId)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.team_id, fetchNotifications])

  async function handleMarkAllRead() {
    const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id)
    if (unreadIds.length === 0) return
    const now = new Date().toISOString()
    // Optimistic update
    setNotifications(prev => prev.map(n => unreadIds.includes(n.id) ? { ...n, read_at: now } : n))
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .in('id', unreadIds)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const mainUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host.replace(/^pay\./i, '')}/dashboard`
    : '/dashboard'

  const initials = (profile?.full_name || 'AD').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  /* ── INJECTED CSS ── */
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    ::-webkit-scrollbar        { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track  { background: ${C.bg}; }
    ::-webkit-scrollbar-thumb  { background: ${C.tealLight}; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: ${C.teal}; }

    @keyframes spin     { to { transform: rotate(360deg); } }
    @keyframes fadeUp   { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    @keyframes slideIn  { from { transform: translateX(-100%); } to { transform: translateX(0); } }
    @keyframes tealPulse { 0%,100% { box-shadow: 0 0 12px rgba(13,148,136,0.2); } 50% { box-shadow: 0 0 28px rgba(13,148,136,0.45); } }
    @keyframes notifDrop { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
    @keyframes notifPing { 0%,100% { opacity:1; } 50% { opacity:0.5; } }

    /* ── Sidebar nav link ── */
    .pay-nav-link {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px; border-radius: 12px;
      text-decoration: none; font-size: 14px; font-weight: 600;
      transition: all 0.18s; color: ${C.text3};
    }
    .pay-nav-link:hover  { background: ${C.muted}; color: ${C.text2}; }
    .pay-nav-link.active { background: ${C.tealAlpha}; color: ${C.teal}; font-weight: 800; }

    /* ── Shared component classes (used by page.jsx children) ── */
    .pay-card {
      background: rgba(255,255,255,0.92);
      border: 1px solid ${C.border};
      border-radius: 18px;
      box-shadow: ${C.shadow};
      backdrop-filter: blur(4px);
    }
    .pay-btn-primary {
      background: ${C.teal}; color: #fff; border: none; border-radius: 10px;
      padding: 11px 20px; font-size: 14px; font-weight: 700;
      cursor: pointer; font-family: inherit; transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(13,122,112,0.2);
    }
    .pay-btn-primary:hover { background: ${C.tealDeep}; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(13,122,112,0.3); }
    /* Legacy alias so existing page files keep working */
    .pay-btn-gold { background: ${C.teal}; color: #fff; border: none; border-radius: 10px; padding: 11px 20px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.2s; box-shadow: 0 4px 12px rgba(13,122,112,0.2); }
    .pay-btn-gold:hover  { background: ${C.tealDeep}; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(13,122,112,0.3); }
    .pay-btn-ghost {
      background: ${C.muted}; color: ${C.text2};
      border: 1px solid ${C.border}; border-radius: 10px;
      padding: 11px 20px; font-size: 14px; font-weight: 600;
      cursor: pointer; font-family: inherit; transition: all 0.2s;
    }
    .pay-btn-ghost:hover { background: ${C.border}; color: ${C.text}; }
    .pay-badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: 99px;
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
    }
    .pay-inp {
      width: 100%; padding: 11px 14px;
      background: ${C.sidebar}; border: 1px solid ${C.border};
      border-radius: 10px; font-size: 14px; color: ${C.text};
      font-family: inherit; outline: none; transition: border-color 0.18s;
    }
    .pay-inp:focus { border-color: ${C.teal}; box-shadow: 0 0 0 3px ${C.tealAlpha}; }
    select.pay-inp {
      appearance: none;
      background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23243E30' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      background-size: 16px;
      padding-right: 36px;
    }
    .pay-lbl {
      display: block; font-size: 11px; font-weight: 700;
      letter-spacing: 0.08em; text-transform: uppercase;
      color: ${C.text3}; margin-bottom: 6px;
    }

    /* ── Mobile bottom nav ── */
    .pay-bottom-nav {
      position: fixed; bottom: 0; left: 0; right: 0; height: 64px;
      background: ${C.sidebar}; border-top: 1px solid ${C.border};
      display: flex; align-items: center; justify-content: space-around;
      z-index: 200; padding-bottom: env(safe-area-inset-bottom);
      box-shadow: 0 -4px 16px rgba(13,100,60,0.06);
    }
    .pay-bottom-nav-item {
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      text-decoration: none; color: ${C.text3}; font-size: 9px; font-weight: 600;
      padding: 6px 4px; flex: 1; transition: color 0.15s;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      letter-spacing: 0.04em; text-transform: uppercase;
    }
    .pay-bottom-nav-item.active { color: ${C.teal}; }
    .pay-bottom-nav-icon {
      font-size: 18px; width: 34px; height: 34px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; transition: background 0.15s;
    }
    .pay-bottom-nav-item.active .pay-bottom-nav-icon { background: ${C.tealAlpha}; }

    /* ── Mobile header ── */
    .pay-mobile-header {
      position: sticky; top: 0; z-index: 150; height: 56px;
      background: ${C.sidebar}; border-bottom: 1px solid ${C.border};
      display: flex; align-items: center; padding: 0 16px;
      justify-content: space-between;
      box-shadow: ${C.shadow};
    }
    .pay-hamburger {
      background: none; border: none; cursor: pointer; color: ${C.text3};
      padding: 6px; display: flex; align-items: center; justify-content: center;
      border-radius: 8px; transition: background 0.15s;
    }
    .pay-hamburger:hover { background: ${C.muted}; color: ${C.text2}; }

    /* ── Mobile drawer ── */
    .pay-drawer-overlay {
      position: fixed; inset: 0; z-index: 300;
      background: rgba(15,34,24,0.4); backdrop-filter: blur(4px);
    }
    .pay-drawer {
      position: fixed; top: 0; left: 0; bottom: 0; width: 260px;
      background: ${C.sidebar}; border-right: 1px solid ${C.border};
      z-index: 301; display: flex; flex-direction: column;
      animation: slideIn 0.22s cubic-bezier(0.4,0,0.2,1);
      box-shadow: ${C.shadowLg};
    }

    /* ── Page padding ── */
    .pay-page { padding: 24px 32px; }
    @media (max-width: 767px) {
      .pay-page { padding: 16px; }
      .pay-btn-gold, .pay-btn-ghost, .pay-btn-primary { padding: 10px 16px; font-size: 13px; }
    }

    /* ── Table scroll ── */
    .pay-table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .pay-table-scroll table { min-width: 560px; }
  `

  /* ── Brand logo block (shared between mobile + desktop) ── */
  function Brand({ size = 36 }) {
    return (
      <Link href="/pay" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: size, height: size, borderRadius: 10,
          background: C.sidebar, border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: C.shadowMd, flexShrink: 0,
          animation: 'tealPulse 3s ease-in-out infinite',
        }}>
          <img src="/logo.png" alt="Apex Track" style={{ width: '82%', height: '82%', objectFit: 'contain', borderRadius: 6 }} />
        </div>
        <div>
          <div style={{ fontSize: size === 36 ? 15 : 13, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>
            Apex<span style={{ color: C.teal }}>Pay</span>
          </div>
          <div style={{ fontSize: 9, color: C.text3, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1 }}>
            Club Payroll
          </div>
        </div>
      </Link>
    )
  }

  /* ── Club badge ── */
  function ClubBadge({ compact = false }) {
    if (!team) return null
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: compact ? '6px 10px' : '10px 14px',
        background: C.muted, borderRadius: 10, border: `1px solid ${C.border}`,
      }}>
        {team.logo_url
          ? <img src={team.logo_url} alt={team.name} style={{ width: compact ? 20 : 26, height: compact ? 20 : 26, borderRadius: 5, objectFit: 'contain' }} />
          : <div style={{ width: compact ? 20 : 26, height: compact ? 20 : 26, borderRadius: 5, background: C.tealAlpha, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: C.teal }}>{team.name?.slice(0,2)}</div>
        }
        <span style={{ fontSize: compact ? 11 : 12, fontWeight: 600, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</span>
      </div>
    )
  }

  /* ── MOBILE LAYOUT ── */
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: C.bg, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: C.text }}>
        <style>{css}</style>

        {/* Mobile top header */}
        <header className="pay-mobile-header">
          <button className="pay-hamburger" onClick={() => setMenuOpen(v => !v)} aria-label="Menu">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="7" x2="19" y2="7"/><line x1="3" y1="12" x2="19" y2="12"/><line x1="3" y1="17" x2="19" y2="17"/>
            </svg>
          </button>
          <Brand size={28} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Bell — mobile */}
            <BellButton
              notifications={notifications}
              unreadCount={unreadCount}
              onToggle={() => setNotifOpen(v => !v)}
              panelOpen={notifOpen}
              panelRef={notifPanelRef}
              onMarkRead={handleMarkAllRead}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: C.successBg, borderRadius: 99, padding: '4px 10px', border: `1px solid rgba(5,150,105,0.25)` }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.success, boxShadow: `0 0 6px ${C.success}` }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: C.success }}>Live</span>
            </div>
          </div>
        </header>

        {/* Slide-in drawer */}
        {menuOpen && (
          <div className="pay-drawer-overlay" onClick={() => setMenuOpen(false)}>
            <div className="pay-drawer" onClick={e => e.stopPropagation()}>
              {/* Drawer brand */}
              <div style={{ padding: '20px 18px 16px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ marginBottom: 14 }}><Brand size={34} /></div>
                <ClubBadge compact />
              </div>

              {/* Drawer nav */}
              <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
                {NAV.map(n => (
                  <Link key={n.href} href={n.href} className={`pay-nav-link${path === n.href ? ' active' : ''}`}>
                    <span style={{ fontSize: 17, width: 24, textAlign: 'center' }}>{n.icon}</span>
                    {n.label}
                  </Link>
                ))}
                {profile?.role !== 'accountant' && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                    <a href={mainUrl} onClick={(e) => { e.preventDefault(); window.location.href = mainUrl }}
                      className="pay-nav-link" style={{ fontSize: 13 }}>
                      <span>←</span> Back to ApexTrack
                    </a>
                  </div>
                )}
              </nav>

              {/* Drawer user footer */}
              <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: C.tealAlpha, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: C.teal, flexShrink: 0, border: `1px solid ${C.border}` }}>
                    {initials}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name || 'Admin'}</div>
                    <div style={{ fontSize: 10, color: C.text3, textTransform: 'capitalize' }}>{profile?.role}</div>
                  </div>
                </div>
                <button onClick={signOut} style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, color: C.text3, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
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
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: C.text }}>
      <style>{css}</style>

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: 220, flexShrink: 0, background: C.sidebar,
        borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
        boxShadow: C.shadowLg,
      }}>
        {/* Brand */}
        <div style={{ padding: '22px 18px 18px', borderBottom: `1px solid ${C.border}` }}>
          <Brand size={36} />
        </div>

        {/* Club badge */}
        {team && (
          <div style={{ margin: '14px 12px 4px' }}>
            <ClubBadge />
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
          {NAV.map(n => {
            const active = path === n.href || (n.href !== '/pay' && path.startsWith(n.href + '/'))
            return (
              <Link key={n.href} href={n.href} className={`pay-nav-link${active ? ' active' : ''}`}>
                <span style={{ fontSize: 15, width: 22, textAlign: 'center' }}>{n.icon}</span>
                {n.label}
              </Link>
            )
          })}

          {profile?.role !== 'accountant' && (
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 12 }}>
              <a href={mainUrl} onClick={(e) => { e.preventDefault(); window.location.href = mainUrl }}
                className="pay-nav-link" style={{ fontSize: 12 }}>
                <span>←</span> Back to ApexTrack
              </a>
            </div>
          )}
        </nav>

        {/* User footer */}
        <div style={{ padding: '14px 12px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.tealAlpha, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: C.teal, flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name || 'Admin'}</div>
              <div style={{ fontSize: 10, color: C.text3, textTransform: 'capitalize', marginTop: 1 }}>{profile?.role}</div>
            </div>
          </div>
          <button onClick={signOut}
            style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, color: C.text3, padding: '7px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = C.muted; e.currentTarget.style.color = C.text }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text3 }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ marginLeft: 220, flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <header style={{
          height: 64, background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center',
          padding: '0 32px', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50,
          boxShadow: C.shadow,
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
            {NAV.find(n => path === n.href || path.startsWith(n.href + '/'))?.label || 'ApexPay'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: C.text3, fontWeight: 500 }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            
            {/* Bell — desktop */}
            <BellButton
              notifications={notifications}
              unreadCount={unreadCount}
              onToggle={() => setNotifOpen(v => !v)}
              panelOpen={notifOpen}
              panelRef={notifPanelRef}
              onMarkRead={handleMarkAllRead}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.successBg, borderRadius: 99, padding: '5px 14px', border: `1px solid rgba(5,150,105,0.25)` }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.success, boxShadow: `0 0 8px ${C.success}` }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: C.success }}>ApexPay Live</span>
            </div>
          </div>
        </header>
        <main style={{ flex: 1 }}>{children}</main>
      </div>
    </div>
  )
}
