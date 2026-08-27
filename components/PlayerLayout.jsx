'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { signOut } from '@/lib/auth'
import { triggerNotificationAlert, requestNotificationPermission } from '@/lib/notifications'
import { User, Zap, Calendar, LogOut, Bell, Megaphone } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/player-hub', label: 'My Profile', icon: <User size={20} strokeWidth={2} /> },
  { href: '/player-hub/performance', label: 'My Stats', icon: <Zap size={20} strokeWidth={2} /> },
  { href: '/player-hub/schedule', label: 'Schedule', icon: <Calendar size={20} strokeWidth={2} /> },
  { href: '/notices', label: 'Notice Board', icon: <Megaphone size={20} strokeWidth={2} /> },
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

const NOTIF_TYPE_LABELS = {
  sms_schedule: 'Training Session Scheduled',
  sms_reminder: 'Session Reminder',
  general:      'Team Announcement',
  performance:  'Performance Stats Published',
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
          background: panelOpen ? 'var(--lagoon-alpha)' : 'none',
          border: `1px solid ${panelOpen ? C.lagoon : 'transparent'}`,
          cursor: 'pointer',
          color: panelOpen ? C.lagoon : C.text2,
          padding: 6,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          if (!panelOpen) { e.currentTarget.style.background = C.floralMuted; e.currentTarget.style.color = C.text }
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
            boxShadow: '0 0 0 2px var(--floral-dark)',
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
            width: 320,
            maxHeight: 480,
            background: C.floralDark,
            border: `1px solid ${C.border}`,
            borderRadius: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
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
                  color: C.lagoon,
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
                <div style={{ marginBottom: 12, display:'flex', justifyContent:'center', color:'var(--text3)' }}><Bell size={28} strokeWidth={1.5}/></div>
                No notifications yet
              </div>
            ) : notifications.map(n => {
              const isUnread = !n._isRead
              const timeAgo = getTimeAgo(n.created_at)
              const typeLabel = NOTIF_TYPE_LABELS[n.type] || n.title
              return (
                <div
                  key={n.id}
                  style={{
                    padding: '13px 18px',
                    borderBottom: `1px solid ${C.border}`,
                    background: isUnread ? 'var(--lagoon-alpha)' : 'transparent',
                    borderLeft: isUnread ? `3px solid ${C.lagoon}` : '3px solid transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: isUnread ? 700 : 600, color: C.text, marginBottom: 2 }}>
                        {typeLabel}
                      </div>
                      {n.body && (
                        <div style={{ fontSize: 11, color: C.text2, lineHeight: 1.4, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {n.body}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: C.text3 }}>{timeAgo}</span>
                        {n.sent_count > 0 && (
                          <span style={{ fontSize: 10, color: C.lagoon, fontWeight: 600 }}>
                            {n.sent_count} {n.sent_count === 1 ? 'member' : 'members'} notified via SMS
                          </span>
                        )}
                      </div>
                    </div>
                    {isUnread && (
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.lagoon, flexShrink: 0, marginTop: 4 }} />
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

export default function PlayerLayout({ children }) {
  const path = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [logoError, setLogoError] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // ── Notifications state ──
  const [notifications,  setNotifications]  = useState([])
  const [notifOpen,      setNotifOpen]      = useState(false)
  const [currentUserId,  setCurrentUserId]  = useState(null)
  const notifPanelRef = useRef(null)

  const unreadCount = notifications.filter(n => !n._isRead).length

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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
    async function loadProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.replace('/login'); return }
        setCurrentUserId(session.user.id)
        const { data } = await supabase
          .from('profiles')
          .select('*, teams(id, name, short_name, logo_url)')
          .eq('id', session.user.id)
          .single()
        
        if (!data || data.is_active === false) {
          await supabase.auth.signOut()
          router.replace('/login?reason=disabled')
          return
        }

        if (data.role !== 'player') {
          router.replace(data.role === 'superadmin' ? '/superadmin' : '/dashboard')
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

  // ── Load + subscribe to notifications once profile is loaded ──
  const fetchNotifications = useCallback(async (teamId, userId) => {
    if (!teamId || !userId) return
    const { data: notifs } = await supabase
      .from('notifications')
      .select('*, notification_reads!left(id, user_id, read_at)')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (notifs) {
      const annotated = notifs.map(n => ({
        ...n,
        _isRead: Array.isArray(n.notification_reads)
          ? n.notification_reads.some(r => r.user_id === userId)
          : false,
      }))
      setNotifications(annotated)
    }
  }, [])

  useEffect(() => {
    const teamId = profile?.team_id
    if (!teamId || !currentUserId) return

    fetchNotifications(teamId, currentUserId)

    // Request notification permission once user is active
    requestNotificationPermission().catch(() => {})

    // Realtime: re-fetch and play sound + native push alert when new notifications arrive
    const channel = supabase
      .channel(`notifications:${teamId}:${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `team_id=eq.${teamId}` },
        (payload) => {
          const newNotif = payload.new
          if (newNotif) {
            triggerNotificationAlert({
              title: newNotif.title || 'ApexTrack Alert',
              message: newNotif.message || '',
              url: newNotif.link || '/notices',
              playSound: true,
            })
          }
          fetchNotifications(teamId, currentUserId)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `team_id=eq.${teamId}` },
        () => fetchNotifications(teamId, currentUserId)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `team_id=eq.${teamId}` },
        () => fetchNotifications(teamId, currentUserId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notification_reads' },
        () => fetchNotifications(teamId, currentUserId)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.team_id, currentUserId, fetchNotifications])

  async function handleMarkAllRead() {
    if (!currentUserId) return
    const unreadIds = notifications.filter(n => !n._isRead).map(n => n.id)
    if (unreadIds.length === 0) return
    const now = new Date().toISOString()
    // Optimistic update
    setNotifications(prev => prev.map(n =>
      unreadIds.includes(n.id) ? { ...n, _isRead: true } : n
    ))
    // Persist
    await supabase
      .from('notification_reads')
      .upsert(
        unreadIds.map(notification_id => ({ notification_id, user_id: currentUserId, read_at: now })),
        { onConflict: 'notification_id,user_id' }
      )
  }

  async function handleSignOut() {
    await signOut()
    window.location.href = '/'
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BellButton
              notifications={notifications}
              unreadCount={unreadCount}
              onToggle={() => setNotifOpen(v => !v)}
              panelOpen={notifOpen}
              panelRef={notifPanelRef}
              onMarkRead={handleMarkAllRead}
            />
            <button onClick={handleSignOut} title="Sign Out"
              style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main style={{ flex: 1, paddingBottom: 72, minWidth: 0, overflowX: 'hidden' }}>{children}</main>

        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 64, background: C.floralDark, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-around', zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
          {NAV_ITEMS.map(({ href, label, icon }) => {
            const active = path === href
            const shortLabel = href === '/player-hub' ? 'Profile' : href.includes('performance') ? 'Stats' : href.includes('schedule') ? 'Schedule' : 'Notices'
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
            <BellButton
              notifications={notifications}
              unreadCount={unreadCount}
              onToggle={() => setNotifOpen(v => !v)}
              panelOpen={notifOpen}
              panelRef={notifPanelRef}
              onMarkRead={handleMarkAllRead}
            />
          </div>
        </header>
        <main style={{ flex: 1 }}>{children}</main>
      </div>

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes notifDrop{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes notifPing{0%,100%{opacity:1}50%{opacity:0.5}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:${C.floralMuted};border-radius:4px}
      `}</style>
    </div>
  )
}
