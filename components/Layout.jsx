'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { signOut, ROLE_PERMISSIONS } from '@/lib/auth'
import InstallPWAButton from '@/components/InstallPWAButton'

import { getTenantProfile, setSuperadminActiveTeam, getSuperadminActiveTeam } from '@/lib/tenant'
import { logger } from '@/lib/logger'
import { triggerNotificationAlert, requestNotificationPermission, playNotificationSound } from '@/lib/notifications'

import {
  LayoutDashboard, Users, ShieldCheck, ShieldAlert, CalendarDays, HeartPulse, TrendingUp, 
  Search, ClipboardList, BarChart3, Settings, ArrowLeftRight, CreditCard,
  Wallet, Menu, X, Bell, ChevronDown, Building2, Megaphone
} from 'lucide-react'

const ALL_NAV = [
  { href:'/superadmin',  label:'Superadmin Console', page:'superadmin' },
  { href:'/dashboard',   label:'Dashboard',          page:'dashboard'   },
  { href:'/notices',     label:'Notice Board',       page:'notices'     },
  { href:'/athletes',    label:'Athletes',           page:'athletes'    },
  { href:'/coaches',     label:'Staff',              page:'coaches'     },
  { href:'/schedule',    label:'Schedule',           page:'schedule'    },
  { href:'/injuries',    label:'Medical',            page:'injuries'    },
  { href:'/performance', label:'Performance',        page:'performance' },
  { href:'/scouting',    label:'Scouting',           page:'scouting'    },
  { href:'/contracts',   label:'Contracts',          page:'contracts'   },
  { href:'/reports',     label:'Reports',            page:'reports'     },
  { href:'/settings',    label:'Settings',           page:'settings'    },
  { href:'/transfers',   label:'Transfers',          page:'transfers'   },
  { href:'/billing',     label:'Billing',            page:'billing'     },
]

const MOBILE_NAV = ['superadmin','dashboard','notices','athletes','schedule','injuries','settings']

const MOBILE_NAV_LABELS = {
  superadmin: 'Console',
  dashboard:  'Home',
  notices:    'Notices',
  athletes:   'Squad',
  schedule:   'Schedule',
  injuries:   'Medical',
  settings:   'Settings',
}

const iconProps = { size: 20, strokeWidth: 2 }
const ICONS = {
  superadmin:  <ShieldAlert {...iconProps} />,
  dashboard:   <LayoutDashboard {...iconProps} />,
  notices:     <Megaphone {...iconProps} />,
  athletes:    <Users {...iconProps} />,
  coaches:     <ShieldCheck {...iconProps} />,
  schedule:    <CalendarDays {...iconProps} />,
  injuries:    <HeartPulse {...iconProps} />,
  performance: <TrendingUp {...iconProps} />,
  scouting:    <Search {...iconProps} />,
  contracts:   <ClipboardList {...iconProps} />,
  reports:     <BarChart3 {...iconProps} />,
  settings:    <Settings {...iconProps} />,
  billing:     <CreditCard {...iconProps} />,
  transfers:   <ArrowLeftRight {...iconProps} />,
  pay:         <Wallet {...iconProps} />,
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

const ROLE_DISPLAY_LABELS = {
  superadmin:  'Superadmin',
  admin:       'Club Admin',
  coach:       'Coach',
  physio:      'Physiotherapist',
  analyst:     'Performance Analyst',
  scout:       'Scout',
  player:      'Player',
  accountant:  'Accountant',
}

const NOTIF_TYPE_LABELS = {
  sms_schedule: 'Training Session Scheduled',
  sms_reminder: 'Session Reminder',
  general:      'Team Announcement',
  performance:  'Performance Stats Published',
}

// ─── Bell Notification Panel ───────────────────────────────────────────────

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
            width: 340,
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

// ─── Main Layout ───────────────────────────────────────────────────────────

export default function Layout({ children }) {
  const path   = usePathname()
  const router = useRouter()
  const [profile,    setProfile]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [expanded,   setExpanded]   = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [logoError,  setLogoError]  = useState(false)
  const [isMobile,   setIsMobile]   = useState(false)

  // ── Notifications state ──
  const [notifications,  setNotifications]  = useState([])
  const [notifOpen,      setNotifOpen]      = useState(false)
  const [currentUserId,  setCurrentUserId]  = useState(null)
  const notifPanelRef = useRef(null)

  // ── Superadmin Workspace Switcher state ──
  const [allClubs,      setAllClubs]      = useState([])
  const [switcherOpen,  setSwitcherOpen]  = useState(false)
  const [clubSearch,    setClubSearch]    = useState('')
  const switcherRef = useRef(null)

  const unreadCount = notifications.filter(n => !n._isRead).length

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { setMobileMenu(false) }, [path])

  // Close notification panel and switcher when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
      if (switcherRef.current && !switcherRef.current.contains(e.target)) {
        setSwitcherOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notifOpen, switcherOpen])

  const loadProfile = useCallback(async () => {
    try {
      const { session, profile: p } = await getTenantProfile('*, club_name, club_logo_url, teams(id, name, short_name, primary_color, logo_url)', true)
      if (!session) { router.replace('/login'); return }
      if (p?.role === 'player' && (path === '/dashboard' || path === '/')) {
        router.replace('/player-hub')
        return
      }

      setCurrentUserId(session.user.id)
      setProfile(p || { full_name: session.user.email, role: 'admin', email: session.user.email })

      // Set logger context so all subsequent logs are tagged with this tenant
      if (p) {
        logger.setContext({
          team_id: p.team_id || null,
          user_id: session.user.id,
          role:    p.role || 'admin',
        })
      }

      if (p?.role === 'superadmin') {
        const { data: teamsList } = await supabase.from('teams').select('id, name, short_name, logo_url').order('name')
        if (teamsList) setAllClubs(teamsList)
      }
    } catch (e) { console.error('Layout error:', e) }
    setLoading(false)
  }, [router])

  useEffect(() => {
    loadProfile()
    const onTeamChange = () => loadProfile()
    window.addEventListener('apex_superadmin_team_changed', onTeamChange)
    return () => {
      window.removeEventListener('apex_superadmin_team_changed', onTeamChange)
    }
  }, [loadProfile])

  // ── Load + subscribe to notifications once profile is loaded ──
  const fetchNotifications = useCallback(async (teamId, userId) => {
    if (!teamId || !userId) return
    // Fetch notifications + this user's read records in one query
    const { data: notifs } = await supabase
      .from('notifications')
      .select('*, notification_reads!left(id, user_id, read_at)')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (notifs) {
      // Annotate each notification with a per-user _isRead flag
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

    // Request notification permission once user is active in dashboard
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
    // Optimistic update — only flips _isRead for THIS user's local state
    setNotifications(prev => prev.map(n =>
      unreadIds.includes(n.id) ? { ...n, _isRead: true } : n
    ))
    // Persist: upsert one read record per notification per user — never touches other users
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

  function handleApexPayClick(e) {
    e.preventDefault()
    if (typeof window !== 'undefined' && (window.electronAPI?.isElectron || navigator.userAgent.includes('Electron') || navigator.userAgent.includes('ApexTrackDesktop'))) {
      window.location.href = '/pay'
      return
    }
    const host     = window.location.host.replace(/^www\./i, '')
    const protocol = window.location.protocol
    const isIP     = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(window.location.hostname)
    const payUrl   = isIP
      ? `${protocol}//${host}/pay`
      : `${protocol}//pay.${host}`
    window.location.href = payUrl
  }

  const role        = profile?.role || 'admin'
  const allowed     = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['admin']
  const navLinks = ALL_NAV.filter(n => allowed.includes(n.page))
  const mobileNav = navLinks.filter(n => MOBILE_NAV.includes(n.page))
  const initials  = (profile?.full_name || 'AD').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const isSandbox = (role === 'superadmin') && (!profile?.team_id || profile?.club_name?.toLowerCase().includes('sandbox') || profile?.club_name?.toLowerCase().includes('test'))

  const teamName  = isSandbox ? 'Apex Test Sandbox' : (profile?.teams?.name || (role !== 'superadmin' ? profile?.club_name : null) || 'Admin Workspace')
  const teamShort = isSandbox ? 'TEST' : (profile?.teams?.short_name || (profile?.club_name ? profile.club_name.slice(0,3).toUpperCase() : 'ADM'))
  const teamLogo  = isSandbox ? null : ((profile?.teams?.logo_url) || (role !== 'superadmin' && profile?.club_logo_url && !profile.club_logo_url.startsWith('data:') ? profile.club_logo_url : null))

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background: C.floral }}>
      <div style={{ width:36, height:36, border:`3px solid ${C.floralMuted}`, borderTopColor: C.lagoon, borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const sideW = expanded ? 240 : 72

  function ClubLogo({ size = 44 }) {
    if (isSandbox) {
      return (
        <div style={{ width:size, height:size, borderRadius:12, background:'linear-gradient(135deg, #0F766E, #0D9488)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#FFFFFF', fontWeight:900, fontSize:size*0.32, letterSpacing:'0.05em', boxShadow:'0 2px 8px rgba(13,148,136,0.3)' }} title="Apex Test Sandbox">
          TEST
        </div>
      )
    }
    if (teamLogo && !logoError) {
      return (
        <img src={teamLogo} alt={teamName || 'Club'} onError={() => setLogoError(true)}
          style={{ width:size, height:size, borderRadius:12, objectFit:'contain', background: C.floral, padding:4, flexShrink:0, border:`1px solid ${C.border}` }} />
      )
    }
    return (
      <div style={{ width:size, height:size, borderRadius:12, background: C.floral, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:`0 4px 12px rgba(0,106,106,0.12)`, border:`1px solid ${C.border}` }}>
        <img src="/logo.png" alt="ApexTrack" style={{ width:'85%', height:'85%', objectFit:'contain', borderRadius:'4px' }} />
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
              <div style={{ fontSize:11, color: C.text3, textTransform:'capitalize' }}>{ROLE_DISPLAY_LABELS[role] || role}</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {role === 'superadmin' && (
              <Link href="/superadmin" style={{
                display:'flex',
                alignItems:'center',
                gap:4,
                background:'linear-gradient(135deg, #0F766E, #0D9488)',
                color:'#fff',
                borderRadius:8,
                padding:'5px 10px',
                fontSize:11,
                fontWeight:700,
                textDecoration:'none',
                boxShadow:'0 2px 6px rgba(13,148,136,0.25)',
              }}>
                <ShieldAlert size={13} strokeWidth={2.2} />
                <span>Console</span>
              </Link>
            )}
            {/* Bell — mobile */}
            <BellButton
              notifications={notifications}
              unreadCount={unreadCount}
              onToggle={() => setNotifOpen(v => !v)}
              panelOpen={notifOpen}
              panelRef={notifPanelRef}
              onMarkRead={handleMarkAllRead}
            />
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
                if (page === 'pay') {
                  return (
                    <a key={href} href="/pay" onClick={handleApexPayClick}
                      style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 20px', color: C.text2, fontWeight: 500, fontSize:15, textDecoration:'none', borderLeft: '3px solid transparent' }}>
                      <span style={{ color: C.text3 }}>{ICONS[page]}</span>
                      {label}
                    </a>
                  )
                }
                return (
                  <Link key={href} href={href}
                    style={{ 
                      display:'flex', alignItems:'center', gap:14, padding:'14px 20px', 
                      color: active ? (page === 'superadmin' ? '#0F766E' : C.lagoon) : (page === 'superadmin' ? '#0D9488' : C.text2), 
                      fontWeight: active ? 700 : (page === 'superadmin' ? 700 : 500), 
                      fontSize:15, textDecoration:'none', 
                      background: active ? 'var(--lagoon-alpha)' : (page === 'superadmin' ? '#F0FDFA' : 'transparent'), 
                      borderLeft: active ? `3px solid ${page === 'superadmin' ? '#0F766E' : C.lagoon}` : (page === 'superadmin' ? '3px solid #99F6E4' : '3px solid transparent') 
                    }}>
                    <span style={{ color: active ? (page === 'superadmin' ? '#0F766E' : C.lagoon) : (page === 'superadmin' ? '#0D9488' : C.text3) }}>{ICONS[page]}</span>
                    {label}
                    {page === 'superadmin' && <span style={{ marginLeft:'auto', fontSize:9, background:'#CCFBF1', color:'#0F766E', padding:'2px 6px', borderRadius:4, fontWeight:800 }}>SUPERADMIN</span>}
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

        <style>{`
          @keyframes spin{to{transform:rotate(360deg)}}
          @keyframes notifDrop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
          @keyframes notifPing{0%,100%{opacity:1}50%{opacity:0.6}}
          ::-webkit-scrollbar{width:4px}
          ::-webkit-scrollbar-thumb{background:${C.floralMuted};border-radius:4px}
        `}</style>
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
            
            // Modern active state: light teal background with primary teal text
            const activeBg = 'var(--lagoon-alpha)'
            const activeColor = C.lagoon
            
            if (page === 'pay') {
              return (
                <a key={href} href="/pay" onClick={handleApexPayClick}
                  style={{ 
                    display:'flex', alignItems:'center', gap:12, padding:'10px 12px',
                    justifyContent: expanded ? 'flex-start' : 'center',
                    borderRadius:12, 
                    background: 'transparent', 
                    color: C.text3, 
                    fontWeight: 500, 
                    fontSize:14, textDecoration:'none', transition:'all 0.15s', whiteSpace:'nowrap', overflow:'hidden', flexShrink:0
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.floralMuted; e.currentTarget.style.color = C.text2 }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text3 }}>
                  <span style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', minWidth:24 }}>
                    {ICONS[page] || ICONS.dashboard}
                  </span>
                  {expanded && <span style={{ overflow:'hidden', textOverflow:'ellipsis', marginTop:1 }}>{label}</span>}
                </a>
              )
            }

            return (
              <Link key={href} href={href}
                style={{ 
                  display:'flex', alignItems:'center', gap:12, padding:'10px 12px',
                  justifyContent: expanded ? 'flex-start' : 'center',
                  borderRadius:12, 
                  background: active ? activeBg : (page === 'superadmin' ? '#F0FDFA' : 'transparent'), 
                  color: active ? activeColor : (page === 'superadmin' ? '#0F766E' : C.text3), 
                  fontWeight: active ? 600 : (page === 'superadmin' ? 700 : 500), 
                  fontSize:14, textDecoration:'none', transition:'all 0.15s', whiteSpace:'nowrap', overflow:'hidden', flexShrink:0,
                  border: page === 'superadmin' && !active ? '1px solid #CCFBF1' : '1px solid transparent',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = (page === 'superadmin' ? '#CCFBF1' : C.floralMuted); e.currentTarget.style.color = C.text2 } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = (page === 'superadmin' ? '#F0FDFA' : 'transparent'); e.currentTarget.style.color = (page === 'superadmin' ? '#0F766E' : C.text3) } }}>
                <span style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', minWidth:24, color: page === 'superadmin' ? '#0D9488' : 'inherit' }}>
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
                  <div style={{ fontSize:11, color: C.text3, textTransform:'capitalize', marginTop:2 }}>{ROLE_DISPLAY_LABELS[role] || role}</div>
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
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            {role === 'superadmin' ? (
              <>
                {/* Superadmin Workspace Switcher */}
                <div style={{ position:'relative' }} ref={switcherRef}>
                  <button
                    onClick={() => setSwitcherOpen(v => !v)}
                    style={{
                      display:'inline-flex',
                      alignItems:'center',
                      gap:8,
                      background: '#F0FDFA',
                      border: '1.5px solid #99F6E4',
                      borderRadius: 99,
                      padding: '6px 14px',
                      color: '#0F766E',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      boxShadow: switcherOpen ? '0 0 0 3px rgba(13,148,136,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#CCFBF1'}
                    onMouseLeave={e => e.currentTarget.style.background = switcherOpen ? '#CCFBF1' : '#F0FDFA'}
                    title="Switch inspected club workspace"
                  >
                    <Building2 size={15} strokeWidth={2.2} style={{ color:'#0D9488' }} />
                    <span style={{ maxWidth: 160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {teamName || 'Sandbox Workspace'}
                    </span>
                    <span style={{ fontSize:9, background:'#0D9488', color:'#fff', padding:'1px 6px', borderRadius:99, fontWeight:800 }}>
                      WORKSPACE
                    </span>
                    <ChevronDown size={14} style={{ transform: switcherOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.2s', color:'#0D9488' }} />
                  </button>

                  {/* Dropdown Menu */}
                  {switcherOpen && (
                    <div style={{
                      position:'absolute',
                      top:'calc(100% + 8px)',
                      right: 0,
                      width: 320,
                      background: '#FFFFFF',
                      borderRadius: 14,
                      boxShadow: '0 12px 36px rgba(0,0,0,0.15)',
                      border: '1px solid #E2E8F0',
                      zIndex: 200,
                      overflow: 'hidden',
                      animation: 'notifDrop 0.2s ease',
                    }}>
                      <div style={{ padding:'12px 14px', borderBottom:'1px solid #F1F5F9', background:'#F8FAFC' }}>
                        <div style={{ fontSize:11, fontWeight:800, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
                          Switch Club Workspace
                        </div>
                        <input
                          type="text"
                          placeholder="Search club name or code…"
                          value={clubSearch}
                          onChange={e => setClubSearch(e.target.value)}
                          style={{
                            width:'100%',
                            padding:'7px 10px',
                            borderRadius:8,
                            border:'1px solid #CBD5E1',
                            fontSize:12,
                            outline:'none',
                            boxSizing:'border-box',
                          }}
                          autoFocus
                        />
                      </div>

                      <div style={{ maxHeight: 260, overflowY:'auto', padding:'6px' }}>
                        {/* Sandbox Workspace Option */}
                        <button
                          onClick={() => {
                            setSuperadminActiveTeam(null)
                            setSwitcherOpen(false)
                            window.location.reload()
                          }}
                          style={{
                            width:'100%',
                            display:'flex',
                            alignItems:'center',
                            gap:10,
                            padding:'8px 10px',
                            borderRadius:8,
                            border:'none',
                            background: (!profile?.team_id || profile?.club_name?.toLowerCase().includes('sandbox') || profile?.club_name?.toLowerCase().includes('test')) ? '#F0FDFA' : 'transparent',
                            color: '#0F766E',
                            cursor:'pointer',
                            textAlign:'left',
                            marginBottom: 4,
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          <div style={{ width:28, height:28, borderRadius:6, background:'#CCFBF1', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#0F766E' }}>
                            TEST
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Apex Test Sandbox</div>
                            <div style={{ fontSize:10, color:'#64748B', fontWeight:500 }}>Isolated testing workspace</div>
                          </div>
                          {(!profile?.team_id || profile?.club_name?.toLowerCase().includes('sandbox') || profile?.club_name?.toLowerCase().includes('test')) && (
                            <span style={{ fontSize:11, color:'#0D9488', fontWeight:800 }}>✓</span>
                          )}
                        </button>

                        {/* Registered Clubs List */}
                        {allClubs
                          .filter(c => !clubSearch || c.name?.toLowerCase().includes(clubSearch.toLowerCase()) || c.short_name?.toLowerCase().includes(clubSearch.toLowerCase()))
                          .map(c => {
                            const isCurrent = profile?.team_id === c.id
                            return (
                              <button
                                key={c.id}
                                onClick={() => {
                                  setSuperadminActiveTeam(c.id)
                                  setSwitcherOpen(false)
                                  window.location.reload()
                                }}
                                style={{
                                  width:'100%',
                                  display:'flex',
                                  alignItems:'center',
                                  gap:10,
                                  padding:'8px 10px',
                                  borderRadius:8,
                                  border:'none',
                                  background: isCurrent ? '#F0FDFA' : 'transparent',
                                  color: isCurrent ? '#0F766E' : '#334155',
                                  cursor:'pointer',
                                  textAlign:'left',
                                  transition:'background 0.1s',
                                  fontSize: 12,
                                }}
                                onMouseEnter={e => { if(!isCurrent) e.currentTarget.style.background = '#F8FAFC' }}
                                onMouseLeave={e => { if(!isCurrent) e.currentTarget.style.background = 'transparent' }}
                              >
                                {c.logo_url ? (
                                  <img src={c.logo_url} alt={c.name} style={{ width:28, height:28, borderRadius:6, objectFit:'cover', border:'1px solid #E2E8F0' }} />
                                ) : (
                                  <div style={{ width:28, height:28, borderRadius:6, background:'#E2E8F0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#475569' }}>
                                    {c.short_name?.slice(0,2) || c.name?.slice(0,2)}
                                  </div>
                                )}
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontWeight: isCurrent ? 800 : 600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>
                                  <div style={{ fontSize:10, color:'#64748B' }}>CODE: {c.short_name}</div>
                                </div>
                                {isCurrent && (
                                  <span style={{ fontSize:11, color:'#0D9488', fontWeight:800 }}>✓</span>
                                )}
                              </button>
                            )
                          })}
                      </div>

                      <div style={{ padding:'8px 12px', borderTop:'1px solid #F1F5F9', background:'#F8FAFC', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <Link href="/superadmin" onClick={() => setSwitcherOpen(false)} style={{ fontSize:11, color:'#0D9488', fontWeight:700, textDecoration:'none' }}>
                          Open Superadmin Console &rarr;
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Return button */}
                <Link href="/superadmin"
                  style={{
                    display:'inline-flex',
                    alignItems:'center',
                    gap:7,
                    background:'linear-gradient(135deg, #0F766E, #0D9488)',
                    color:'#FFFFFF',
                    borderRadius:99,
                    padding:'7px 16px',
                    fontSize:12,
                    fontWeight:700,
                    textDecoration:'none',
                    boxShadow:'0 2px 10px rgba(13, 148, 136, 0.3)',
                    transition:'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.92'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  <ShieldAlert size={15} strokeWidth={2.2} />
                  <span>Superadmin Console &rarr;</span>
                </Link>
              </>
            ) : (
              teamName && (
                <div style={{ display:'flex', alignItems:'center', gap:8, background: C.floralMuted, borderRadius:99, padding:'6px 14px', border:`1px solid ${C.border}` }}>
                  {teamLogo && !logoError
                    ? <img src={teamLogo} alt={teamName} onError={() => setLogoError(true)} style={{ width:20, height:20, objectFit:'contain', borderRadius:6 }} />
                    : <div style={{ width:20, height:20, borderRadius:6, background: C.lagoon, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color: '#fff' }}>{teamShort?.slice(0,2)}</div>
                  }
                  <span style={{ fontSize:13, color: C.text2, fontWeight:600 }}>{teamName}</span>
                </div>
              )
            )}
            <div style={{ fontSize:13, color: C.text3, fontWeight:500 }}>
              {new Date().toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6, background: 'var(--success-light)', borderRadius:99, padding:'6px 14px', border:`1px solid rgba(5, 150, 105, 0.2)` }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--success)', boxShadow:'0 0 8px var(--success)' }} />
              <span style={{ fontSize:12, color: 'var(--success)', fontWeight:700 }}>Live</span>
            </div>

            {/* Bell — desktop */}
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

        {/* SUPERADMIN WORKSPACE INSPECTION & DIAGNOSTICS BAR */}
        {role === 'superadmin' && (
          <div style={{
            background: isSandbox ? '#042F2E' : '#0F172A',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            padding: '8px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            fontSize: 12,
            color: '#E2E8F0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontWeight: 800,
                color: isSandbox ? '#5EEAD4' : '#FDE047',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontSize: 11
              }}>
                {isSandbox ? '🔬 Sandbox Test Mode' : '🔍 Workspace Inspection'}
              </span>

              <span style={{ color: '#64748B' }}>|</span>

              <span>
                Workspace: <strong style={{ color: '#FFFFFF' }}>{teamName || 'Apex Test Sandbox'}</strong>
              </span>

              {isSandbox && (
                <span style={{ fontSize:11, color:'#99F6E4' }}>
                  Isolated test environment · No customer data impacted
                </span>
              )}
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:11, color:'#94A3B8', fontFamily:'monospace' }}>
                Scope: {profile?.team_id ? `${profile.team_id.slice(0,8)}...` : 'TEST-ENV'}
              </span>

              {!isSandbox && (
                <button
                  onClick={() => {
                    setSuperadminActiveTeam(null)
                    window.location.reload()
                  }}
                  style={{
                    background: 'rgba(13, 148, 136, 0.3)',
                    border: '1px solid rgba(20, 184, 166, 0.4)',
                    color: '#5EEAD4',
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Enter Sandbox &rarr;
                </button>
              )}

              <Link
                href="/superadmin"
                style={{
                  color: '#94A3B8',
                  textDecoration: 'none',
                  fontSize: 11,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#FFFFFF'}
                onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
              >
                Exit to Superadmin &rarr;
              </Link>
            </div>
          </div>
        )}

        <main style={{ flex:1, minWidth:0, width:'100%', overflowX:'hidden' }}>{children}</main>
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