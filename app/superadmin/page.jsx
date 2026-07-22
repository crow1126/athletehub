'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── ICONS ──
const IconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
const IconClubs = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10v6" /><path d="M6 10h12" /><path d="M12 22V2M12 2l10 8H2L12 2z" />
  </svg>
)
const IconMaintenance = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
)
const IconMenu = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)
const IconClose = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const TABLES = ['profiles', 'athletes', 'teams', 'contracts', 'injuries', 'transfers', 'subscriptions', 'site_clicks']

const STATUS_META = {
  pending:                   { bg: '#FEF3C7', color: '#D97706', label: 'Pending' },
  pending_email_verification:{ bg: '#DBEAFE', color: '#2563EB', label: 'Verify Email' },
  approved:                  { bg: '#D1FAE5', color: '#059669', label: 'Approved' },
  rejected:                  { bg: '#FFE4E6', color: '#E11D48', label: 'Rejected' },
}

const ROLE_COLORS = {
  admin:'#0D9488', coach:'#27AE60', physio:'#E67E22',
  analyst:'#9B59B6', scout:'#1ABC9C', player:'#2D6B6B', superadmin:'#EF4444',
}

function Pill({ status }) {
  const s = STATUS_META[status?.toLowerCase()] || STATUS_META.pending
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:s.bg, color:s.color, borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:700 }}>
      <span style={{ width:5, height:5, borderRadius:'50%', background:s.color, flexShrink:0 }} />
      {s.label}
    </span>
  )
}

function RoleBadge({ role }) {
  const color = ROLE_COLORS[role] || '#64748b'
  return (
    <span style={{ display:'inline-block', background:color+'22', color, borderRadius:99, padding:'2px 10px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>
      {role}
    </span>
  )
}

function Avatar({ name, size = 34 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:'linear-gradient(135deg,#e2e8f0,#cbd5e1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.36, fontWeight:800, color:'#64748b', flexShrink:0 }}>
      {initials}
    </div>
  )
}

function ClubLogoImg({ url, name, size = 34 }) {
  const [err, setErr] = useState(false)
  const isValid = url && !url.startsWith('data:') && !url.startsWith('blob:') && !err
  if (isValid) return <img src={url} alt={name} onError={() => setErr(true)} style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', border:'1px solid #e2e8f0', flexShrink:0 }} />
  return <Avatar name={name} size={size} />
}

function Toast({ toast }) {
  if (!toast) return null
  const isErr = toast.type === 'error'
  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, background:isErr?'#7f1d1d':'#064e3b', color:isErr?'#fca5a5':'#6ee7b7', padding:'12px 20px', borderRadius:12, fontSize:13, fontWeight:700, boxShadow:'0 10px 30px rgba(0,0,0,0.15)', maxWidth:340, border:`1px solid ${isErr?'#ef444440':'#10b98140'}`, display:'flex', alignItems:'center', gap:10 }}>
      <span style={{ color:isErr?'#ef4444':'#10b981', fontSize:16 }}>{isErr?'':'✓'}</span>
      <span>{toast.msg}</span>
    </div>
  )
}

function Btn({ onClick, children, style={}, disabled=false, variant='default' }) {
  const bases = {
    default:{ background:'#f1f5f9', color:'#475569', border:'1px solid #e2e8f0' },
    primary:{ background:'linear-gradient(135deg,#0d9488,#0f766e)', color:'#fff', border:'none' },
    danger: { background:'#fff1f2', color:'#e11d48', border:'1px solid #fecdd3' },
    success:{ background:'#f0fdf4', color:'#059669', border:'1px solid #bbf7d0' },
  }
  const base = bases[variant] || bases.default
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...base, borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:disabled?'not-allowed':'pointer', transition:'all 0.15s', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, opacity:disabled?0.6:1, ...style }}
      onMouseEnter={e => { if(!disabled){ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)' } }}
      onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}>
      {children}
    </button>
  )
}

const IconAnalytics = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
  </svg>
)

const NAV_ITEMS = [
  { id:'users',       label:'User Accounts',    icon:<IconUsers /> },
  { id:'clubs',       label:'Clubs & Teams',    icon:<IconClubs /> },
  { id:'analytics',   label:'Analytics & Clicks', icon:<IconAnalytics /> },
  { id:'maintenance', label:'Database & Roots', icon:<IconMaintenance /> },
]

export default function SuperadminPage() {
  const router = useRouter()
  const [authOk, setAuthOk] = useState(false)
  const [section, setSection] = useState('users')
  const [profiles, setProfiles] = useState([])
  const [teams, setTeams] = useState([])
  const [athletes, setAthletes] = useState([])
  const [mobileNav, setMobileNav] = useState(false)
  const [expandedUser, setExpandedUser] = useState(null)
  const [clicks, setClicks] = useState([])
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [clickFilter, setClickFilter] = useState('all')
  const [clickSearch, setClickSearch] = useState('')

  const [dbRows, setDbRows] = useState([])
  const [dbCols, setDbCols] = useState([])
  const [dbTable, setDbTable] = useState('profiles')
  const [dbLoading, setDbLoading] = useState(false)

  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [acting, setActing] = useState(false)
  const [selected, setSelected] = useState(null)

  const [targetUserId, setTargetUserId] = useState('')
  const [deletingUserById, setDeletingUserById] = useState(false)
  const [targetTeamId, setTargetTeamId] = useState('')
  const [deletingTeamById, setDeletingTeamById] = useState(false)

  const [selectedClearTable, setSelectedClearTable] = useState('athletes')
  const [clearingTable, setClearingTable] = useState(false)
  const [clearingAll, setClearingAll] = useState(false)

  const [addModal, setAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newClub, setNewClub] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)

  // Close mobile nav when section changes
  useEffect(() => { setMobileNav(false) }, [section])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      if (p?.role !== 'superadmin') { router.replace('/dashboard'); return }
      setAuthOk(true)
    })
  }, [router])

  const fetchWithAuth = useCallback(async (url) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No active session')
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${session.access_token}` } })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `HTTP error ${res.status}`)
    }
    return res.json()
  }, [])

  const loadProfiles = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchWithAuth('/api/admin/superadmin-data?section=profiles')
      setProfiles(data.profiles || [])
      if (data.athletes) setAthletes(data.athletes)
    } catch (err) { showToast('Failed to load profiles: ' + err.message, 'error') }
    finally { setLoading(false) }
  }, [fetchWithAuth])

  const loadTeams = useCallback(async () => {
    try {
      const data = await fetchWithAuth('/api/admin/superadmin-data?section=teams')
      setTeams(data.teams || [])
    } catch (err) { console.error(err) }
  }, [fetchWithAuth])

  const loadTable = useCallback(async (tbl) => {
    setDbLoading(true); setDbRows([]); setDbCols([])
    try {
      const data = await fetchWithAuth(`/api/admin/superadmin-data?table=${tbl}`)
      if (data?.data?.length) { setDbCols(Object.keys(data.data[0])); setDbRows(data.data) }
    } catch (err) { showToast('Failed to load table: ' + err.message, 'error') }
    finally { setDbLoading(false) }
  }, [fetchWithAuth])

  const loadClicks = useCallback(async () => {
    setAnalyticsLoading(true)
    try {
      const data = await fetchWithAuth('/api/admin/superadmin-data?section=analytics')
      setClicks(data.clicks || [])
    } catch (err) {
      showToast('Failed to load click analytics: ' + err.message, 'error')
    } finally {
      setAnalyticsLoading(false)
    }
  }, [fetchWithAuth])

  useEffect(() => { if (authOk) { loadProfiles(); loadTeams() } }, [authOk, loadProfiles, loadTeams])
  useEffect(() => { if (authOk && section === 'maintenance') { loadTable(dbTable) } }, [authOk, section, dbTable, loadTable])
  useEffect(() => { if (authOk && section === 'analytics') { loadClicks() } }, [authOk, section, loadClicks])

  function showToast(msg, type='success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  // ── DB HELPER FUNCTIONS FOR USER AND TEAM ROOTS ──
  function resolveIdName(colName, val) {
    if (!val) return null
    if (colName === 'team_id' || (colName === 'id' && dbTable === 'teams')) {
      const team = teams.find(t => t.id === val)
      return team ? { name: team.name, icon: '', type: 'team' } : null
    }
    if (colName === 'profile_id' || colName === 'user_id' || colName === 'admin_id' || (colName === 'id' && dbTable === 'profiles')) {
      const p = profiles.find(x => x.id === val)
      return p ? { name: p.full_name || p.email, icon: '', type: 'profile', club: p.club_name } : null
    }
    if (colName === 'athlete_id' || (colName === 'id' && dbTable === 'athletes')) {
      const a = athletes.find(x => x.id === val)
      return a ? { name: a.name, icon: '', type: 'athlete' } : null
    }
    return null
  }

  function getRowStatus(table, row, profiles, teams) {
    if (table === 'profiles') {
      if (row.role === 'superadmin') return { label: 'Superadmin', bg: '#f1f5f9', color: '#475569' }
      if (!row.club_name?.trim() && !row.team_id) {
        return { label: 'Orphaned (No Club)', bg: '#ffe4e6', color: '#e11d48', isOrphan: true }
      }
    }
    if (table === 'teams') {
      const hasActiveAdmin = profiles.some(p => p.team_id === row.id && p.registration_status === 'approved')
      if (!hasActiveAdmin) {
        return { label: 'Orphaned (No Admin)', bg: '#ffe4e6', color: '#e11d48', isOrphan: true }
      }
    }
    if (table === 'athletes') {
      if (!row.team_id || !teams.some(t => t.id === row.team_id)) {
        return { label: 'Orphaned Athlete', bg: '#ffe4e6', color: '#e11d48', isOrphan: true }
      }
    }
    return null
  }

  // ── ANALYTICS HELPER FUNCTIONS ──
  function formatPageTitle(urlStr) {
    try {
      const u = new URL(urlStr)
      const p = u.pathname
      if (p === '/' || p === '') return 'Landing Page'
      if (p.startsWith('/billing')) return 'Pricing & Billing'
      if (p.startsWith('/login')) return 'Login Page'
      if (p.startsWith('/superadmin')) return 'Superadmin Console'
      if (p.startsWith('/dashboard')) return 'Club Dashboard'
      if (p.startsWith('/athletes')) return 'Athletes Directory'
      if (p.startsWith('/coaches')) return 'Coaches Directory'
      if (p.startsWith('/pay')) return 'ApexPay Payroll'
      if (p.startsWith('/privacy')) return 'Privacy Policy'
      if (p.startsWith('/terms')) return 'Terms of Service'
      if (p.startsWith('/security')) return 'Security'
      return p
    } catch {
      return urlStr || 'Landing Page'
    }
  }

  function timeAgo(dateStr) {
    if (!dateStr) return ''
    const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diffSec < 60) return 'Just now'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
    return `${Math.floor(diffSec / 86400)}d ago`
  }

  function getDeviceType(ua) {
    if (!ua) return 'Desktop'
    const u = ua.toLowerCase()
    if (u.includes('android') || u.includes('iphone') || u.includes('mobile')) return 'Mobile'
    if (u.includes('ipad') || u.includes('tablet')) return 'Tablet'
    return 'Desktop'
  }

  function getTopPath(clicksList) {
    if (!clicksList || clicksList.length === 0) return 'None'
    const counts = {}
    clicksList.forEach(c => {
      const title = formatPageTitle(c.url)
      counts[title] = (counts[title] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
  }

  function getTopReferrer(clicksList) {
    if (!clicksList || clicksList.length === 0) return 'Direct Traffic'
    const counts = {}
    clicksList.forEach(c => {
      const ref = formatReferrer(c.referrer)
      counts[ref] = (counts[ref] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
  }

  function getMobilePercentage(clicksList) {
    if (!clicksList || clicksList.length === 0) return '0%'
    const mobileCount = clicksList.filter(c => getDeviceType(c.user_agent) === 'Mobile').length
    return `${Math.round((mobileCount / clicksList.length) * 100)}%`
  }

  function formatUrlPath(urlStr) {
    try {
      const u = new URL(urlStr)
      return u.pathname + u.search
    } catch {
      return urlStr
    }
  }

  function formatReferrer(refStr) {
    if (!refStr) return 'Direct / Link'
    try {
      const u = new URL(refStr)
      if (u.hostname.includes('whatsapp')) return 'WhatsApp'
      if (u.hostname.includes('t.co') || u.hostname.includes('x.com') || u.hostname.includes('twitter')) return 'Twitter / X'
      if (u.hostname.includes('facebook') || u.hostname.includes('fb.')) return 'Facebook'
      if (u.hostname.includes('google')) return 'Google'
      if (u.hostname.includes('instagram')) return 'Instagram'
      return u.hostname.replace('www.', '')
    } catch {
      return refStr
    }
  }

  function getBrowserName(ua) {
    if (!ua) return 'Unknown'
    const u = ua.toLowerCase()
    if (u.includes('firefox')) return 'Firefox'
    if (u.includes('chrome') && !u.includes('chromium')) return 'Chrome'
    if (u.includes('safari') && !u.includes('chrome')) return 'Safari'
    if (u.includes('edge')) return 'Edge'
    if (u.includes('opera') || u.includes('opr')) return 'Opera'
    if (u.includes('android')) return 'Android'
    if (u.includes('iphone') || u.includes('ipad')) return 'iOS'
    return 'Browser'
  }

  async function deleteUserDirect(userId, userName) {
    if (!confirm(`Delete user "${userName}"? This will permanently wipe their account and profile.`)) return
    setActing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/system-commands', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${session.access_token}` }, body:JSON.stringify({ command:'delete_user', userId }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete user')
      showToast(`User ${userName} deleted successfully.`); loadProfiles(); loadTeams(); loadTable(dbTable)
    } catch (err) { showToast('Deletion failed: ' + err.message, 'error') }
    finally { setActing(false) }
  }

  async function deleteTeamDirect(teamId, teamName) {
    if (!confirm(`CAUTION: Wiping Team "${teamName}" will delete this club and ALL its data! This cannot be undone.`)) return
    setActing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/system-commands', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${session.access_token}` }, body:JSON.stringify({ command:'delete_team', teamId }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete team')
      showToast(data.message || `Wiped team "${teamName}" successfully!`); loadProfiles(); loadTeams(); loadTable(dbTable)
    } catch (err) { showToast('Deletion failed: ' + err.message, 'error') }
    finally { setActing(false) }
  }

  async function handleApprove(p) {
    setActing(true)
    try {
      let teamId = null
      if (p.club_name) {
        const { data: existingTeam } = await supabase.from('teams').select('id').ilike('name', p.club_name.trim()).maybeSingle()
        if (existingTeam?.id) { teamId = existingTeam.id }
        else {
          const { data: newTeam, error: teamError } = await supabase.from('teams').insert([{
            name: p.club_name.trim(),
            short_name: p.club_name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0,4),
          }]).select().single()
          if (!teamError) teamId = newTeam.id
        }
        if (teamId) {
          const { data: existingSub } = await supabase.from('subscriptions').select('id').eq('team_id', teamId).maybeSingle()
          if (!existingSub) {
            const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 30)
            await supabase.from('subscriptions').insert([{ team_id:teamId, plan:'trial', status:'active', trial_ends_at:trialEnd.toISOString(), current_period_end:trialEnd.toISOString() }])
          }
        }
      }
      const { error } = await supabase.from('profiles').update({ is_active:true, registration_status:'approved', approved_at:new Date().toISOString(), team_id:teamId }).eq('id', p.id)
      if (error) throw error
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        await fetch('/api/admin/confirm-email', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}` }, body:JSON.stringify({ user_id:p.id }) })
      }
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-welcome`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
        body:JSON.stringify({ full_name:p.full_name, email:p.email, club_name:p.club_name, app_url:window.location.origin }),
      })
      showToast('Approved administrator and team provisioned successfully!')
      setSelected(null); loadProfiles(); loadTeams()
    } catch (err) { showToast('Approval failed: ' + err.message, 'error') }
    finally { setActing(false) }
  }

  async function handleReject(p) {
    const reason = prompt('Please enter a rejection reason:')
    if (reason === null) return
    if (!reason.trim()) { showToast('A rejection reason is required.', 'error'); return }
    setActing(true)
    try {
      const { error } = await supabase.from('profiles').update({ registration_status:'rejected', is_active:false, rejection_reason:reason.trim() }).eq('id', p.id)
      if (error) throw error
      showToast('Profile registration rejected.'); loadProfiles()
    } catch (err) { showToast('Rejection failed: ' + err.message, 'error') }
    finally { setActing(false) }
  }

  async function toggleActive(p) {
    await supabase.from('profiles').update({ is_active:!p.is_active }).eq('id', p.id)
    showToast(`${p.full_name} has been ${!p.is_active?'activated':'deactivated'}`)
    loadProfiles()
  }

  async function handleDeleteUser(p) {
    if (!confirm(`Delete ${p.full_name}? This will permanently wipe their account and profile.`)) return
    setActing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/system-commands', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${session.access_token}` }, body:JSON.stringify({ command:'delete_user', userId:p.id }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete user')
      showToast(`User ${p.full_name} deleted successfully.`); loadProfiles()
    } catch (err) { showToast('Deletion failed: ' + err.message, 'error') }
    finally { setActing(false) }
  }

  async function handleDeleteUserById() {
    const trimmedId = targetUserId.trim()
    if (!trimmedId) { showToast('Please enter a valid User ID', 'error'); return }
    if (!confirm(`Delete user ID "${trimmedId}"? This will permanently wipe their Auth and profile data.`)) return
    setDeletingUserById(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/system-commands', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${session.access_token}` }, body:JSON.stringify({ command:'delete_user', userId:trimmedId }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete user')
      showToast(`Successfully deleted user ID: ${trimmedId}`); setTargetUserId(''); loadProfiles(); loadTeams()
    } catch (err) { showToast('Deletion failed: ' + err.message, 'error') }
    finally { setDeletingUserById(false) }
  }

  async function handleDeleteTeamById() {
    const trimmedId = targetTeamId.trim()
    if (!trimmedId) { showToast('Please enter a valid Team ID', 'error'); return }
    if (!confirm(`CAUTION: Wiping Team ID "${trimmedId}" will delete this club and ALL its data! This cannot be undone.`)) return
    setDeletingTeamById(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/system-commands', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${session.access_token}` }, body:JSON.stringify({ command:'delete_team', teamId:trimmedId }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete team')
      showToast(data.message || `Wiped team ID: ${trimmedId} successfully!`); setTargetTeamId(''); loadProfiles(); loadTeams()
      if (section === 'maintenance' && dbTable === 'teams') loadTable('teams')
    } catch (err) { showToast('Deletion failed: ' + err.message, 'error') }
    finally { setDeletingTeamById(false) }
  }

  async function handleClearTable(tbl) {
    if (!confirm(`Clear table "${tbl}"?`)) return
    setClearingTable(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/system-commands', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${session.access_token}` }, body:JSON.stringify({ command:'clear_table', tableName:tbl }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to clear table')
      showToast(`Successfully cleared table "${tbl}"`); loadProfiles(); loadTeams()
      if (section === 'maintenance' && dbTable === tbl) loadTable(tbl)
    } catch (err) { showToast('Clear table failed: ' + err.message, 'error') }
    finally { setClearingTable(false) }
  }

  async function handleClearAll() {
    const confirmation = prompt('To wipe all system data, type "CONFIRM CLEAR ALL":')
    if (confirmation !== 'CONFIRM CLEAR ALL') { showToast('Confirmation mismatch. Cancelled.', 'error'); return }
    setClearingAll(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/system-commands', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${session.access_token}` }, body:JSON.stringify({ command:'clear_all' }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to clear system')
      showToast('All system records and tenant accounts cleared!'); loadProfiles(); loadTeams()
    } catch (err) { showToast('Wipe failed: ' + err.message, 'error') }
    finally { setClearingAll(false) }
  }

  async function handleAddAdmin() {
    if (!newName.trim() || !newEmail.trim() || !newPassword || !newClub.trim()) {
      showToast('Please fill out all provisioning parameters.', 'error'); return
    }
    setAddingAdmin(true)
    try {
      const checkRes = await fetch(`/api/signup-provision?club_name=${encodeURIComponent(newClub.trim())}`)
      const checkData = await checkRes.json()
      if (checkData.exists) throw new Error('A club with this name is already registered.')
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmail.trim().toLowerCase(), password: newPassword,
        options: { data:{ full_name:newName.trim(), club_name:newClub.trim() }, emailRedirectTo:`${window.location.origin}/auth/confirm` },
      })
      if (authError) throw authError
      if (!authData?.user) throw new Error('User account creation failed.')
      const provRes = await fetch('/api/signup-provision', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ user_id:authData.user.id, full_name:newName.trim(), club_name:newClub.trim(), email:newEmail.trim().toLowerCase() }) })
      const provData = await provRes.json()
      if (!provRes.ok) throw new Error(provData.error || 'Provision failed')
      showToast('Account provisioned — verification email sent!')
      setAddModal(false); setNewName(''); setNewEmail(''); setNewPassword(''); setNewClub('')
      loadProfiles(); loadTeams()
    } catch (err) { showToast('Provisioning failed: ' + err.message, 'error') }
    finally { setAddingAdmin(false) }
  }

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase()
    const matchQ = !search || [p.full_name, p.email, p.club_name].some(v => v?.toLowerCase().includes(q))
    const matchF = filter === 'all' || p.registration_status === filter || (filter === 'pending' && p.registration_status?.startsWith('pending'))
    return matchQ && matchF
  })

  // Split teams into active vs no-admin (orphaned/deletable)
  const activeTeams = teams.filter(t => profiles.some(p => p.team_id === t.id && p.registration_status === 'approved'))
  const orphanedTeams = teams.filter(t => !profiles.some(p => p.team_id === t.id && p.registration_status === 'approved'))

  // Get all users for a team
  function getTeamUsers(teamId) {
    return profiles.filter(p => p.team_id === teamId)
  }

  if (!authOk) {
    return (
      <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f8fafc', flexDirection:'column', gap:16 }}>
        <img src="/logo.png" alt="AthleteHub" style={{ width:56, height:56, objectFit:'contain', marginBottom:8 }} onError={e => e.target.style.display='none'} />
        <div style={{ width:32, height:32, border:'3px solid #e2e8f0', borderTopColor:'#0d9488', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <div style={{ fontSize:12, color:'#64748b', fontFamily:'monospace', fontWeight:600, letterSpacing:'0.1em' }}>AUTHENTICATING ACCESS…</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  const inputStyle = {
    width:'100%', padding:'10px 14px', background:'#f8fafc', border:'1px solid #e2e8f0',
    borderRadius:10, fontSize:13, color:'#0f172a', outline:'none', fontFamily:'inherit',
    transition:'all 0.15s',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#f8fafc;font-family:'Plus Jakarta Sans',sans-serif;color:#0f172a;overflow-x:hidden}
        
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        
        .sa-main-layout{display:flex;min-height:100vh;background:#f8fafc}
        
        /* SIDEBAR — dark theme */
        .sa-sidebar{
          width:240px;flex-shrink:0;background:#0F172A;border-right:1px solid #1E293B;
          display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:80;
        }
        
        .sa-content{margin-left:240px;flex:1;min-width:0;display:flex;flex-direction:column;}
        
        .sa-header{
          height:68px;background:rgba(255,255,255,0.95);backdrop-filter:blur(8px);
          border-bottom:1px solid #E2E8F0;
          display:flex;align-items:center;justify-content:space-between;
          padding:0 28px;position:sticky;top:0;z-index:70;
        }
        
        .sa-main{flex:1;padding:28px 32px;overflow-y:auto;animation:fadeIn 0.3s ease;}
        
        .sa-nav-btn{
          width:100%;display:flex;align-items:center;gap:12px;padding:11px 16px;
          border-radius:10px;border:none;background:transparent;
          font-weight:600;font-size:13.5px;cursor:pointer;text-align:left;
          transition:all 0.2s ease;font-family:'Plus Jakarta Sans',sans-serif;
          color:#94A3B8;
        }
        .sa-nav-btn:hover{background:rgba(255,255,255,0.06);color:#F8FAFC}
        .sa-nav-btn.active{background:#0D9488;color:#FFFFFF;font-weight:700;box-shadow:0 4px 12px rgba(13,148,136,0.3)}
        
        .sa-card{
          background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;
          padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.02);
          transition:all 0.2s ease;
        }
        .sa-card:hover{box-shadow:0 4px 20px rgba(0,0,0,0.06)}
        
        .sa-custom-input{
          width:100%;padding:10px 14px;background:#F8FAFC;border:1px solid #E2E8F0;
          border-radius:10px;font-size:13px;color:#0F172A;outline:none;
          transition:all 0.15s;font-family:'Plus Jakarta Sans',sans-serif;
        }
        .sa-custom-input:focus{border-color:#0D9488;box-shadow:0 0 0 3px rgba(13,148,136,0.12);background:#FFFFFF}
        
        .sa-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
        .sa-table{width:100%;border-collapse:collapse;text-align:left;min-width:720px}
        .sa-th{padding:12px 16px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:0.06em;background:#F8FAFC;border-bottom:1px solid #E2E8F0}
        .sa-td{padding:14px 16px;border-bottom:1px solid #F1F5F9;font-size:13px;color:#334155;vertical-align:middle}
        
        /* MOBILE OVERRIDES */
        @media(max-width:768px){
          .sa-sidebar{display:none}
          .sa-content{margin-left:0}
          .sa-header{padding:0 16px;height:60px}
          .sa-main{padding:16px}
          .sa-main-layout{flex-direction:column}
          .sa-card{padding:16px}
          .sa-header-btns{display:none!important}
          
          /* Mobile drawer nav */
          .sa-mobile-drawer{
            position:fixed;top:60px;left:0;right:0;bottom:0;z-index:150;
            background:rgba(15,23,42,0.35);backdrop-filter:blur(4px);
          }
          .sa-mobile-drawer-inner{
            background:#ffffff;border-bottom:1px solid #e2e8f0;
            padding:8px 12px 16px;
          }
          .sa-mobile-provision{
            display:flex!important;
          }
        }
        @media(min-width:769px){
          .sa-mobile-drawer{display:none!important}
          .sa-mobile-only{display:none!important}
          .sa-mobile-provision{display:none!important}
        }
        
        /* Team cards grid */
        .sa-teams-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
        @media(max-width:640px){.sa-teams-grid{grid-template-columns:1fr}}
        
        /* maintenance grid */
        .sa-maint-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
        @media(max-width:640px){.sa-maint-grid{grid-template-columns:1fr}}
        
        /* Filter row */
        .sa-filter-row{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
        .sa-filter-btns{display:flex;gap:6px;flex-wrap:wrap}
        @media(max-width:500px){
          .sa-filter-row{flex-direction:column;align-items:stretch}
          .sa-filter-btns{justify-content:flex-start}
        }
        
        /* User card fallback for mobile */
        .sa-user-card{display:none}
        @media(max-width:768px){
          .sa-table-wrap{margin:0 -4px}
          .sa-table{min-width:600px}
        }
      `}</style>

      <Toast toast={toast} />

      {/* MOBILE DRAWER NAV */}
      {mobileNav && (
        <div className="sa-mobile-drawer" onClick={() => setMobileNav(false)}>
          <div className="sa-mobile-drawer-inner" onClick={e => e.stopPropagation()}>
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => { setSection(item.id); setMobileNav(false) }}
                className="sa-nav-btn"
                style={{ color:section===item.id?'#0d9488':'#334155', background:section===item.id?'#f0fdfa':'transparent', marginBottom:2 }}>
                <span style={{ color:section===item.id?'#0d9488':'#94a3b8' }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
            <div style={{ borderTop:'1px solid #e2e8f0', marginTop:8, paddingTop:12 }}>
              <div className="sa-mobile-provision" style={{ display:'none', gap:8, flexDirection:'column' }}>
                <Btn variant="primary" onClick={() => { setAddModal(true); setMobileNav(false) }} style={{ width:'100%', justifyContent:'center', padding:'10px 14px' }}>
                  + Provision Admin
                </Btn>
                <Btn onClick={() => router.push('/dashboard')} style={{ width:'100%', justifyContent:'center', padding:'10px 14px' }}>
                  Admin Suite →
                </Btn>
                <Btn onClick={() => supabase.auth.signOut().then(() => router.replace('/login'))} variant="danger" style={{ width:'100%', justifyContent:'center', padding:'10px 14px' }}>
                  Sign Out
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="sa-main-layout">
        {/* SIDEBAR (desktop) */}
        <aside className="sa-sidebar">
          {/* Logo */}
          <div style={{ padding:'22px 20px 18px', borderBottom:'1px solid #1E293B', display:'flex', alignItems:'center', gap:12 }}>
            <img src="/logo.png" alt="ApexTrack" style={{ width:38, height:38, objectFit:'contain', borderRadius:10, background:'#0F766E', padding:4 }}
              onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
            <div style={{ display:'none', width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,#0d9488,#0f766e)', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:900, color:'#fff' }}></div>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:'#F8FAFC', lineHeight:1.2, letterSpacing:'-0.02em' }}>Apex<span style={{ color:'#2DD4BF' }}>Track</span></div>
              <div style={{ fontSize:10, color:'#0D9488', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginTop:2 }}>Superadmin Console</div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex:1, padding:'20px 14px', display:'flex', flexDirection:'column', gap:6 }}>
            <p style={{ fontSize:10, fontWeight:800, color:'#64748B', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8, paddingLeft:10 }}>Main Navigation</p>
            {NAV_ITEMS.map(item => {
              const active = section === item.id
              return (
                <button key={item.id} onClick={() => setSection(item.id)} className={`sa-nav-btn${active ? ' active' : ''}`}>
                  <span style={{ color: active ? '#FFFFFF' : '#64748B', display:'flex' }}>{item.icon}</span>
                  {item.label}
                </button>
              )
            })}
          </nav>

          {/* User info */}
          <div style={{ padding:'16px 20px', borderTop:'1px solid #1E293B', background:'rgba(15,23,42,0.6)' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#F8FAFC' }}>Samuel Wobil</div>
            <div style={{ fontSize:11, color:'#64748B', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>admin@apextrackgh.com</div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <div className="sa-content">
          {/* Header */}
          <header className="sa-header">
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              {/* Mobile hamburger */}
              <button className="sa-mobile-only" onClick={() => setMobileNav(v => !v)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'#475569', padding:4, display:'flex', alignItems:'center' }}>
                {mobileNav ? <IconClose /> : <IconMenu />}
              </button>
              {/* Mobile logo */}
              <div className="sa-mobile-only" style={{ display:'flex', alignItems:'center', gap:8 }}>
                <img src="/logo.png" alt="AthleteHub" style={{ width:32, height:32, objectFit:'contain', borderRadius:8 }}
                  onError={e => e.target.style.display='none'} />
                <span style={{ fontSize:14, fontWeight:800, color:'#0f172a' }}>Superadmin</span>
              </div>
              {/* Desktop title */}
              <div style={{ display:'flex', alignItems:'center', gap:8 }} className="sa-desktop-title">
                <div style={{ fontSize:15, fontWeight:700, color:'#0f172a' }}>
                  {NAV_ITEMS.find(n => n.id === section)?.label || 'Dashboard'}
                </div>
                <span style={{ fontSize:10, background:'#f0fdfa', color:'#0d9488', padding:'2px 8px', borderRadius:4, fontWeight:700, border:'1px solid #99f6e4' }}>CORE</span>
              </div>
            </div>

            <div className="sa-header-btns" style={{ display:'flex', alignItems:'center', gap:8 }}>
              <a href="/api/download-logo" download style={{ textDecoration:'none' }}>
                <Btn style={{ fontSize:12, background:'#F0FDFA', color:'#0D9488', border:'1px solid #CCFBF1' }}>
                  ↓ Download Logo
                </Btn>
              </a>
              <Btn variant="primary" onClick={() => setAddModal(true)} className="sa-provision-btn" style={{ fontSize:12 }}>
                + Provision Admin
              </Btn>
              <Btn onClick={() => router.push('/dashboard')} style={{ fontSize:12 }}>
                Admin Suite →
              </Btn>
              <Btn onClick={() => supabase.auth.signOut().then(() => router.replace('/login'))} variant="danger" style={{ fontSize:12 }}>
                Sign Out
              </Btn>
            </div>
          </header>

          {/* Content */}
          <main className="sa-main">

            {/* ── USER ACCOUNTS ── */}
            {section === 'users' && (() => {
              // Group filtered profiles by team or club name
              const clubGroups = {}
              const orphans = []
              filtered.forEach(p => {
                const team = p.team_id ? teams.find(t => t.id === p.team_id) : null
                const key = team ? team.name : p.club_name?.trim() || ''
                const logo = team ? team.logo_url : p.club_logo_url || null
                
                if (key) {
                  if (!clubGroups[key]) {
                    clubGroups[key] = { club_name: key, logo: logo, users: [] }
                  }
                  clubGroups[key].users.push(p)
                } else {
                  orphans.push(p)
                }
              })
              const clubs = Object.values(clubGroups).sort((a,b) => a.club_name.localeCompare(b.club_name))

              return (
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                  {/* Search & Filter */}
                  <div className="sa-filter-row">
                    <div style={{ position:'relative', flex:'1 1 240px', maxWidth:340 }}>
                      <input className="sa-custom-input" placeholder="Search name, email, or club…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft:36 }} />
                      <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', fontSize:14 }}></span>
                    </div>
                    <div className="sa-filter-btns">
                      {['all','pending','approved','rejected'].map(f => (
                        <Btn key={f} onClick={() => setFilter(f)} style={{
                          padding:'6px 12px', fontSize:11,
                          background:filter===f?'#f0fdfa':'transparent',
                          color:filter===f?'#0d9488':'#64748b',
                          border:filter===f?'1px solid #99f6e4':'1px solid #e2e8f0',
                          textTransform:'capitalize',
                        }}>
                          {f}
                        </Btn>
                      ))}
                    </div>
                  </div>

                  {/* Summary */}
                  <div style={{ fontSize:12, color:'#64748b', fontWeight:600 }}>
                    {clubs.length} club{clubs.length !== 1 ? 's' : ''} · {filtered.length} total accounts
                    {orphans.length > 0 && <span style={{ color:'#e11d48', marginLeft:10 }}>{orphans.length} orphaned</span>}
                  </div>

                  {loading ? (
                    <div className="sa-card" style={{ padding:48, textAlign:'center', color:'#94a3b8' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontSize:13 }}>
                        <div style={{ width:16, height:16, border:'2px solid #e2e8f0', borderTopColor:'#0d9488', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                        Syncing user accounts…
                      </div>
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="sa-card" style={{ padding:48, textAlign:'center', color:'#94a3b8', fontSize:13 }}>
                      No accounts match the filter.
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

                      {/* ── CLUB GROUPS ── */}
                      {clubs.map(group => {
                        const isOpen = expandedUser === group.club_name
                        const allApproved = group.users.every(u => u.registration_status === 'approved')
                        const hasPending  = group.users.some(u => u.registration_status?.startsWith('pending'))
                        const borderColor = isOpen ? '#99f6e4' : '#e2e8f0'
                        const headerBg    = isOpen ? '#f0fdfa' : '#fff'
                        return (
                          <div key={group.club_name} style={{ border:`1px solid ${borderColor}`, borderRadius:14, overflow:'hidden', transition:'border 0.2s', boxShadow: isOpen ? '0 4px 16px rgba(13,148,136,0.08)' : '0 1px 4px rgba(0,0,0,0.04)' }}>
                            {/* Club header row — click to expand/collapse */}
                            <button
                              onClick={() => setExpandedUser(isOpen ? null : group.club_name)}
                              style={{ width:'100%', display:'flex', alignItems:'center', gap:14, padding:'14px 18px', background:headerBg, border:'none', cursor:'pointer', textAlign:'left', transition:'background 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.background='#f0fdfa'}
                              onMouseLeave={e => e.currentTarget.style.background=headerBg}>
                              <ClubLogoImg url={group.logo} name={group.club_name} size={42} />
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontWeight:800, fontSize:15, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{group.club_name}</div>
                                <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{group.users.length} user{group.users.length !== 1 ? 's' : ''} attached</div>
                              </div>
                              {/* Aggregate status indicators */}
                              {hasPending && <span style={{ fontSize:10, fontWeight:700, background:'#FEF3C7', color:'#D97706', padding:'3px 10px', borderRadius:99, flexShrink:0 }}>Has Pending</span>}
                              {allApproved && !hasPending && <span style={{ fontSize:10, fontWeight:700, background:'#D1FAE5', color:'#059669', padding:'3px 10px', borderRadius:99, flexShrink:0 }}>✓ All Approved</span>}
                              {/* User count badge */}
                              <span style={{ fontSize:12, fontWeight:800, background:'#f1f5f9', color:'#334155', borderRadius:99, padding:'2px 10px', flexShrink:0, minWidth:28, textAlign:'center' }}>{group.users.length}</span>
                              <span style={{ color:'#94a3b8', fontSize:14, transition:'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink:0 }}>▾</span>
                            </button>

                            {/* Expanded: all users in this club */}
                            {isOpen && (
                              <div style={{ borderTop:'1px solid #e2e8f0', background:'#fafcff', animation:'fadeIn 0.2s ease' }}>
                                {group.users.map((p, idx) => (
                                  <div key={p.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 18px', borderBottom: idx < group.users.length - 1 ? '1px solid #f1f5f9' : 'none', flexWrap:'wrap' }}
                                    onMouseEnter={e => e.currentTarget.style.background='#f0fdfa'}
                                    onMouseLeave={e => e.currentTarget.style.background=''}>
                                    {/* Role badge */}
                                    <RoleBadge role={p.role || 'admin'} />
                                    {/* Name + email + copyable ID */}
                                    <div style={{ flex:'1 1 180px', minWidth:0 }}>
                                      <div style={{ fontWeight:700, fontSize:13, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.full_name || '—'}</div>
                                      <div style={{ fontSize:11, color:'#64748b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.email}</div>
                                      <div style={{ fontSize:10, color:'#0d9488', fontFamily:'monospace', marginTop:2, display:'flex', alignItems:'center', gap:4 }}>
                                        <span>ID: {p.id}</span>
                                        <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(p.id); showToast('Copied User ID!') }}
                                          style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:10, padding:0, display:'inline-block' }} title="Copy User ID"></button>
                                      </div>
                                    </div>
                                    {/* Status */}
                                    <Pill status={p.registration_status || 'pending'} />
                                    {/* Lock */}
                                    <Btn onClick={() => toggleActive(p)} variant={p.is_active?'success':'danger'} style={{ fontSize:10, padding:'3px 8px', flexShrink:0 }}>
                                      {p.is_active ? 'Active' : 'Blocked'}
                                    </Btn>
                                    {/* Actions */}
                                    <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                                      {p.registration_status !== 'approved' && (
                                        <Btn onClick={() => handleApprove(p)} variant="success" style={{ fontSize:10, padding:'3px 8px' }} disabled={acting}>✓ Approve</Btn>
                                      )}
                                      {p.registration_status !== 'rejected' && (
                                        <Btn onClick={() => handleReject(p)} variant="danger" style={{ fontSize:10, padding:'3px 8px' }} disabled={acting}>✕ Reject</Btn>
                                      )}
                                      <Btn onClick={() => handleDeleteUser(p)} variant="danger" style={{ fontSize:10, padding:'3px 8px', background:'#7f1d1d', color:'#fecaca', border:'1px solid #991b1b40' }} disabled={acting}>Delete</Btn>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* ── ORPHANED / INDIVIDUAL ACCOUNTS ── */}
                      {orphans.length > 0 && (
                        <div style={{ border:'1.5px solid #fca5a5', borderRadius:14, overflow:'hidden', boxShadow:'0 2px 8px rgba(225,29,72,0.08)' }}>
                          {/* Orphan header */}
                          <button
                            onClick={() => setExpandedUser(expandedUser === '__orphans__' ? null : '__orphans__')}
                            style={{ width:'100%', display:'flex', alignItems:'center', gap:14, padding:'14px 18px', background: expandedUser === '__orphans__' ? '#fff5f5' : '#fff', border:'none', cursor:'pointer', textAlign:'left', transition:'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background='#fff5f5'}
                            onMouseLeave={e => e.currentTarget.style.background=expandedUser === '__orphans__' ? '#fff5f5' : '#fff'}>
                            <div style={{ width:42, height:42, borderRadius:'50%', background:'#ffe4e6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}></div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:800, fontSize:15, color:'#e11d48' }}>Orphaned / No Club Assigned</div>
                              <div style={{ fontSize:11, color:'#f87171', marginTop:2 }}>{orphans.length} account{orphans.length !== 1 ? 's' : ''} — no club linked, may need cleanup</div>
                            </div>
                            <span style={{ fontSize:12, fontWeight:800, background:'#ffe4e6', color:'#e11d48', borderRadius:99, padding:'2px 10px', flexShrink:0 }}>{orphans.length}</span>
                            <span style={{ color:'#f87171', fontSize:14, transition:'transform 0.2s', transform: expandedUser === '__orphans__' ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink:0 }}>▾</span>
                          </button>

                          {expandedUser === '__orphans__' && (
                            <div style={{ borderTop:'1px solid #fca5a5', background:'#fff9f9', animation:'fadeIn 0.2s ease' }}>
                              {orphans.map((p, idx) => (
                                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 18px', borderBottom: idx < orphans.length - 1 ? '1px solid #fee2e2' : 'none', flexWrap:'wrap' }}
                                  onMouseEnter={e => e.currentTarget.style.background='#fff5f5'}
                                  onMouseLeave={e => e.currentTarget.style.background=''}>
                                  <RoleBadge role={p.role || 'admin'} />
                                  {/* Name + email + copyable ID */}
                                  <div style={{ flex:'1 1 180px', minWidth:0 }}>
                                    <div style={{ fontWeight:700, fontSize:13, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.full_name || '— No Name —'}</div>
                                    <div style={{ fontSize:11, color:'#ef4444', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.email}</div>
                                    <div style={{ fontSize:10, color:'#e11d48', fontFamily:'monospace', marginTop:2, display:'flex', alignItems:'center', gap:4 }}>
                                      <span>ID: {p.id}</span>
                                      <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(p.id); showToast('Copied User ID!') }}
                                        style={{ background:'none', border:'none', cursor:'pointer', color:'#f87171', fontSize:10, padding:0, display:'inline-block' }} title="Copy User ID"></button>
                                    </div>
                                  </div>
                                  <Pill status={p.registration_status || 'pending'} />
                                  <Btn onClick={() => toggleActive(p)} variant={p.is_active?'success':'danger'} style={{ fontSize:10, padding:'3px 8px', flexShrink:0 }}>
                                    {p.is_active ? 'Active' : 'Blocked'}
                                  </Btn>
                                  <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                                    {p.registration_status !== 'approved' && (
                                      <Btn onClick={() => handleApprove(p)} variant="success" style={{ fontSize:10, padding:'3px 8px' }} disabled={acting}>✓ Approve</Btn>
                                    )}
                                    {p.registration_status !== 'rejected' && (
                                      <Btn onClick={() => handleReject(p)} variant="danger" style={{ fontSize:10, padding:'3px 8px' }} disabled={acting}>✕ Reject</Btn>
                                    )}
                                    <Btn onClick={() => handleDeleteUser(p)} variant="danger" style={{ fontSize:10, padding:'3px 8px', background:'#7f1d1d', color:'#fecaca', border:'1px solid #991b1b40' }} disabled={acting}>Delete</Btn>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* ── CLUBS & TEAMS ── */}
            {section === 'clubs' && (
              <div style={{ display:'flex', flexDirection:'column', gap:28 }}>

                {/* ACTIVE TEAMS */}
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:'#059669', boxShadow:'0 0 6px #05966960' }} />
                    <h2 style={{ fontSize:16, fontWeight:800, color:'#0f172a' }}>Active Teams</h2>
                    <span style={{ fontSize:11, background:'#d1fae5', color:'#059669', padding:'2px 10px', borderRadius:99, fontWeight:700 }}>{activeTeams.length}</span>
                  </div>

                  {activeTeams.length === 0 ? (
                    <div style={{ padding:32, textAlign:'center', color:'#94a3b8', fontSize:13, background:'#f8fafc', borderRadius:14, border:'1px dashed #e2e8f0' }}>
                      No active teams found.
                    </div>
                  ) : (
                    <div className="sa-teams-grid">
                      {activeTeams.map(t => {
                        const teamUsers = getTeamUsers(t.id)
                        const admin = teamUsers.find(p => p.role === 'admin')
                        const otherUsers = teamUsers.filter(p => p.role !== 'admin' && p.role !== 'superadmin')
                        return (
                          <div key={t.id} className="sa-card">
                            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                              <ClubLogoImg url={t.logo_url} name={t.name} size={44} />
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontWeight:800, fontSize:15, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</div>
                                <div style={{ fontSize:10, color:'#64748b', fontFamily:'monospace', marginTop:2 }}>CODE: {t.short_name}</div>
                              </div>
                              <span style={{ fontSize:9, background:'#d1fae5', color:'#059669', padding:'2px 8px', borderRadius:99, fontWeight:800, flexShrink:0 }}>ACTIVE</span>
                            </div>

                            <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:12, display:'flex', flexDirection:'column', gap:8 }}>
                              {/* Admin */}
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                                <span style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>Club Admin</span>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                  {admin ? (
                                    <>
                                      <span style={{ fontSize:12, color:'#0f172a', fontWeight:600 }}>{admin.full_name}</span>
                                      <RoleBadge role="admin" />
                                    </>
                                  ) : <span style={{ fontSize:12, color:'#94a3b8', fontStyle:'italic' }}>Unassigned</span>}
                                </div>
                              </div>

                              {/* Other role users */}
                              {otherUsers.length > 0 && (
                                <div>
                                  <div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Team Members</div>
                                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                                    {otherUsers.slice(0, 6).map(u => (
                                      <div key={u.id} style={{ display:'flex', alignItems:'center', gap:4, background:'#f8fafc', borderRadius:8, padding:'3px 8px', border:'1px solid #e2e8f0' }}>
                                        <span style={{ fontSize:11, fontWeight:600, color:'#334155' }}>{u.full_name?.split(' ')[0]}</span>
                                        <RoleBadge role={u.role} />
                                      </div>
                                    ))}
                                    {otherUsers.length > 6 && (
                                      <span style={{ fontSize:10, color:'#94a3b8', padding:'3px 6px' }}>+{otherUsers.length - 6} more</span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Team ID */}
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                                <span style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>Team ID</span>
                                <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                                  <span style={{ fontSize:10, color:'#94a3b8', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={t.id}>{t.id}</span>
                                  <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(t.id); showToast('Copied Team ID!') }}
                                    style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:11, padding:0 }} title="Copy Team ID"></button>
                                </div>
                              </div>
                              <Btn variant="danger" onClick={() => deleteTeamDirect(t.id, t.name)} style={{ fontSize:11, width:'100%', justifyContent:'center', marginTop:8 }} disabled={acting}>
                                Wipe Team
                              </Btn>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* DELETED / ORPHANED TEAMS */}
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:'#e11d48' }} />
                    <h2 style={{ fontSize:16, fontWeight:800, color:'#0f172a' }}>Unassigned / Orphaned Teams</h2>
                    <span style={{ fontSize:11, background:'#ffe4e6', color:'#e11d48', padding:'2px 10px', borderRadius:99, fontWeight:700 }}>{orphanedTeams.length}</span>
                  </div>
                  <p style={{ fontSize:12, color:'#94a3b8', marginBottom:14 }}>Teams with no approved admin. These can be cleaned up from Database &amp; Roots.</p>

                  {orphanedTeams.length === 0 ? (
                    <div style={{ padding:32, textAlign:'center', color:'#94a3b8', fontSize:13, background:'#f8fafc', borderRadius:14, border:'1px dashed #e2e8f0' }}>
                      No orphaned teams found.
                    </div>
                  ) : (
                    <div className="sa-teams-grid">
                      {orphanedTeams.map(t => {
                        const teamUsers = getTeamUsers(t.id)
                        return (
                          <div key={t.id} className="sa-card" style={{ border:'1px solid #fecdd3', background:'#fff5f5' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                              <ClubLogoImg url={t.logo_url} name={t.name} size={44} />
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontWeight:800, fontSize:15, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</div>
                                <div style={{ fontSize:10, color:'#64748b', fontFamily:'monospace', marginTop:2 }}>CODE: {t.short_name}</div>
                              </div>
                              <span style={{ fontSize:9, background:'#ffe4e6', color:'#e11d48', padding:'2px 8px', borderRadius:99, fontWeight:800, flexShrink:0 }}>ORPHANED</span>
                            </div>

                            <div style={{ borderTop:'1px solid #fecdd3', paddingTop:12, display:'flex', flexDirection:'column', gap:8 }}>
                              {teamUsers.length > 0 ? (
                                <div>
                                  <div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Linked Users</div>
                                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                                    {teamUsers.map(u => (
                                      <div key={u.id} style={{ display:'flex', alignItems:'center', gap:4, background:'#fff', borderRadius:8, padding:'3px 8px', border:'1px solid #fecdd3' }}>
                                        <span style={{ fontSize:11, fontWeight:600, color:'#334155' }}>{u.full_name?.split(' ')[0]}</span>
                                        <RoleBadge role={u.role} />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ fontSize:12, color:'#94a3b8', fontStyle:'italic' }}>No linked users</div>
                              )}
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                                <span style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>Team ID</span>
                                <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                                  <span style={{ fontSize:10, color:'#94a3b8', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={t.id}>{t.id}</span>
                                  <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(t.id); showToast('Copied Team ID!') }}
                                    style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:11, padding:0 }} title="Copy Team ID"></button>
                                </div>
                              </div>
                              <Btn variant="danger" onClick={() => deleteTeamDirect(t.id, t.name)} style={{ fontSize:11, width:'100%', justifyContent:'center' }} disabled={acting}>
                                Wipe Team
                              </Btn>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {section === 'analytics' && (() => {
              const filteredClicks = clicks.filter(c => {
                if (clickFilter === 'direct' && c.referrer) return false
                if (clickFilter === 'referrals' && !c.referrer) return false
                if (clickFilter === 'mobile' && getDeviceType(c.user_agent) !== 'Mobile') return false
                if (clickFilter === 'desktop' && getDeviceType(c.user_agent) !== 'Desktop') return false
                if (clickSearch) {
                  const q = clickSearch.toLowerCase()
                  const matchUrl = (c.url || '').toLowerCase().includes(q)
                  const matchRef = (c.referrer || '').toLowerCase().includes(q)
                  const matchLoc = (c.country || '').toLowerCase().includes(q)
                  const matchPage = formatPageTitle(c.url).toLowerCase().includes(q)
                  if (!matchUrl && !matchRef && !matchLoc && !matchPage) return false
                }
                return true
              })

              return (
                <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
                  {/* Metric Cards Header */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(210px, 1fr))', gap:16 }}>
                    <div className="sa-card" style={{ background:'linear-gradient(135deg, #0F172A, #1E293B)', color:'#fff' }}>
                      <div style={{ fontSize:10, fontWeight:800, color:'#0D9488', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Total Site Visits</div>
                      <div style={{ fontSize:28, fontWeight:900, color:'#F8FAFC' }}>
                        {analyticsLoading ? '...' : clicks.length}
                      </div>
                      <div style={{ fontSize:11, color:'#94A3B8', marginTop:4 }}>Tracked click events</div>
                    </div>

                    <div className="sa-card">
                      <div style={{ fontSize:10, fontWeight:800, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Top Visited Page</div>
                      <div style={{ fontSize:16, fontWeight:800, color:'#0D9488', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={analyticsLoading ? 'Loading...' : getTopPath(clicks)}>
                        {analyticsLoading ? '...' : getTopPath(clicks)}
                      </div>
                      <div style={{ fontSize:11, color:'#64748B', marginTop:4 }}>Most popular destination</div>
                    </div>

                    <div className="sa-card">
                      <div style={{ fontSize:10, fontWeight:800, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Top Traffic Source</div>
                      <div style={{ fontSize:16, fontWeight:800, color:'#0F172A', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={analyticsLoading ? 'Loading...' : getTopReferrer(clicks)}>
                        {analyticsLoading ? '...' : getTopReferrer(clicks)}
                      </div>
                      <div style={{ fontSize:11, color:'#64748B', marginTop:4 }}>Main visitor origin</div>
                    </div>

                    <div className="sa-card">
                      <div style={{ fontSize:10, fontWeight:800, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Mobile Device Share</div>
                      <div style={{ fontSize:28, fontWeight:900, color:'#0F172A' }}>
                        {analyticsLoading ? '...' : getMobilePercentage(clicks)}
                      </div>
                      <div style={{ fontSize:11, color:'#64748B', marginTop:4 }}>Visitors on phones</div>
                    </div>
                  </div>

                  {/* Clean Activity Feed Card */}
                  <div className="sa-card">
                    {/* Header + Filters */}
                    <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:16, paddingBottom:16, borderBottom:'1px solid #F1F5F9' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
                        <div>
                          <h3 style={{ fontSize:15, fontWeight:800, color:'#0F172A', margin:0 }}>Traffic Activity Feed</h3>
                          <div style={{ fontSize:11, color:'#64748B', marginTop:2 }}>Real-time logs of visitor clicks across ApexTrack</div>
                        </div>
                        <Btn onClick={loadClicks} disabled={analyticsLoading} style={{ padding:'6px 14px', fontSize:12 }}>
                          {analyticsLoading ? 'Refreshing...' : '↻ Refresh Data'}
                        </Btn>
                      </div>

                      {/* Filter Chips & Search Bar */}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          {[
                            { id:'all', label:`All (${clicks.length})` },
                            { id:'direct', label:'Direct Traffic' },
                            { id:'referrals', label:'Referrals' },
                            { id:'mobile', label:'Mobile' },
                            { id:'desktop', label:'Desktop' }
                          ].map(f => {
                            const active = clickFilter === f.id
                            return (
                              <button key={f.id} onClick={() => setClickFilter(f.id)}
                                style={{
                                  padding:'5px 12px', borderRadius:20, border:'none', fontSize:11, fontWeight:700, cursor:'pointer', transition:'all 0.15s',
                                  background: active ? '#0D9488' : '#F1F5F9',
                                  color: active ? '#FFFFFF' : '#475569',
                                }}>
                                {f.label}
                              </button>
                            )
                          })}
                        </div>

                        <input className="sa-custom-input" placeholder="Search URL, source or location..." value={clickSearch} onChange={e => setClickSearch(e.target.value)} style={{ width:220, padding:'6px 12px', fontSize:11 }} />
                      </div>
                    </div>

                    {analyticsLoading ? (
                      <div style={{ padding:40, textAlign:'center', color:'#94A3B8', fontSize:13 }}>Loading click logs...</div>
                    ) : filteredClicks.length === 0 ? (
                      <div style={{ padding:40, textAlign:'center', color:'#94A3B8', fontSize:13 }}>No traffic events match your filter.</div>
                    ) : (
                      <div className="sa-table-wrap">
                        <table className="sa-table">
                          <thead>
                            <tr>
                              <th className="sa-th">Time</th>
                              <th className="sa-th">Page Visited</th>
                              <th className="sa-th">Traffic Source</th>
                              <th className="sa-th">Device</th>
                              <th className="sa-th">Location</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredClicks.map(c => {
                              const devType = getDeviceType(c.user_agent)
                              const pageTitle = formatPageTitle(c.url)
                              const pathName = formatUrlPath(c.url)
                              const refName = formatReferrer(c.referrer)
                              return (
                                <tr key={c.id}>
                                  <td className="sa-td" style={{ whiteSpace:'nowrap' }}>
                                    <div style={{ fontSize:12, fontWeight:700, color:'#0F172A' }}>{timeAgo(c.created_at)}</div>
                                    <div style={{ fontSize:10, color:'#94A3B8', marginTop:1 }}>{new Date(c.created_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}</div>
                                  </td>
                                  <td className="sa-td">
                                    <div style={{ fontSize:13, fontWeight:700, color:'#0F172A' }}>{pageTitle}</div>
                                    <div style={{ fontSize:10, color:'#0D9488', fontFamily:'monospace', marginTop:2 }}>{pathName}</div>
                                  </td>
                                  <td className="sa-td">
                                    <span style={{
                                      display:'inline-block', padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700,
                                      background: !c.referrer ? '#F1F5F9' : '#F0FDFA',
                                      color: !c.referrer ? '#475569' : '#0D9488',
                                      border: !c.referrer ? '1px solid #E2E8F0' : '1px solid #CCFBF1'
                                    }}>
                                      {refName}
                                    </span>
                                  </td>
                                  <td className="sa-td">
                                    <span style={{ fontSize:11, fontWeight:600, color:'#334155', display:'inline-flex', alignItems:'center', gap:4 }}>
                                      {devType === 'Mobile' ? '📱 Mobile' : '💻 Desktop'}
                                    </span>
                                  </td>
                                  <td className="sa-td">
                                    <span style={{ fontSize:10, padding:'2px 8px', background:'#F8FAFC', border:'1px solid #E2E8F0', color:'#334155', borderRadius:6, fontWeight:800 }}>
                                      🇬🇭 {c.country || 'GH'}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* ── DATABASE & ROOTS MAINTENANCE ── */}
            {section === 'maintenance' && (
              <div style={{ display:'flex', flexDirection:'column', gap:22 }}>

                <div className="sa-maint-grid">
                  {/* Delete User by ID */}
                  <div className="sa-card" style={{ border:'1px solid #fecdd3' }}>
                    <h2 style={{ fontSize:13, fontWeight:700, color:'#e11d48', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                      Delete User Roots &amp; Auth
                    </h2>
                    <p style={{ fontSize:12, color:'#64748b', marginBottom:14, lineHeight:1.6 }}>
                      Purge an administrator and delete their Auth account using their User ID.
                    </p>
                    <div style={{ display:'flex', gap:8 }}>
                      <input className="sa-custom-input" placeholder="Paste User UUID…" value={targetUserId} onChange={e => setTargetUserId(e.target.value)} style={{ flex:1, fontSize:11 }} />
                      <Btn variant="danger" onClick={handleDeleteUserById} disabled={deletingUserById} style={{ flexShrink:0 }}>
                        {deletingUserById?'Deleting…':'Delete'}
                      </Btn>
                    </div>
                  </div>

                  {/* Delete Team by ID */}
                  <div className="sa-card" style={{ border:'1px solid #fecdd3' }}>
                    <h2 style={{ fontSize:13, fontWeight:700, color:'#e11d48', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                      Delete Team, Athletes &amp; Roots
                    </h2>
                    <p style={{ fontSize:12, color:'#64748b', marginBottom:14, lineHeight:1.6 }}>
                      Purge a team completely — athletes, contracts, coaches, subscriptions, profiles — by Team ID.
                    </p>
                    <div style={{ display:'flex', gap:8 }}>
                      <input className="sa-custom-input" placeholder="Paste Team UUID…" value={targetTeamId} onChange={e => setTargetTeamId(e.target.value)} style={{ flex:1, fontSize:11 }} />
                      <Btn variant="danger" onClick={handleDeleteTeamById} disabled={deletingTeamById} style={{ flexShrink:0 }}>
                        {deletingTeamById?'Wiping…':'Wipe'}
                      </Btn>
                    </div>
                  </div>

                  {/* Table & System Cleanup */}
                  <div className="sa-card">
                    <h2 style={{ fontSize:13, fontWeight:700, color:'#0f172a', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                      Table &amp; System Cleanup
                    </h2>
                    <p style={{ fontSize:12, color:'#64748b', marginBottom:14, lineHeight:1.6 }}>
                      Wipe specific table data or trigger a system-wide clean (superadmin preserved).
                    </p>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <select value={selectedClearTable} onChange={e => setSelectedClearTable(e.target.value)}
                        style={{ flex:1, minWidth:120, padding:'8px 12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, fontSize:12, color:'#0f172a', outline:'none' }}>
                        {['athletes','coaches','injuries','contracts','transfers','subscriptions','teams','profiles'].map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <Btn variant="danger" onClick={() => handleClearTable(selectedClearTable)} disabled={clearingTable} style={{ fontSize:11 }}>
                        {clearingTable?'Clearing…':'Clear Table'}
                      </Btn>
                      <Btn variant="danger" onClick={handleClearAll} disabled={clearingAll} style={{ fontSize:11, background:'#7f1d1d', color:'#fecaca', border:'1px solid #991b1b40' }}>
                        Nuclear Wipe
                      </Btn>
                    </div>
                  </div>
                </div>

                {/* DB Inspector */}
                <div className="sa-card">
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, paddingBottom:12, borderBottom:'1px solid #f1f5f9', flexWrap:'wrap', gap:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:'#64748b', letterSpacing:'0.06em' }}>DB INSPECTOR:</span>
                      <select value={dbTable} onChange={e => setDbTable(e.target.value)}
                        style={{ padding:'4px 10px', background:'#f0fdfa', border:'1px solid #99f6e4', borderRadius:6, fontSize:12, color:'#0d9488', outline:'none', fontFamily:'monospace', fontWeight:600 }}>
                        {TABLES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <Btn onClick={() => loadTable(dbTable)} style={{ padding:'4px 12px', fontSize:11 }}>↻ Refresh</Btn>
                  </div>

                  {dbLoading ? (
                    <div style={{ padding:32, textAlign:'center', color:'#94a3b8', fontSize:13 }}>Reading database schema…</div>
                  ) : dbRows.length === 0 ? (
                    <div style={{ padding:32, textAlign:'center', color:'#94a3b8', fontSize:13 }}>Table is empty or columns unreadable.</div>
                  ) : (
                    <div className="sa-table-wrap">
                      <table className="sa-table" style={{ minWidth:'auto' }}>
                        <thead>
                          <tr>
                            {dbCols.map(c => (
                              <th key={c} className="sa-th" style={{ whiteSpace:'nowrap', background: c==='full_name'||c==='name'?'#f0fdfa':undefined, color: c==='full_name'||c==='name'?'#0d9488':undefined }}>
                                {c}
                              </th>
                            ))}
                            <th className="sa-th" style={{ whiteSpace:'nowrap' }}>Root Status</th>
                            {['profiles', 'teams', 'athletes'].includes(dbTable) && (
                              <th className="sa-th" style={{ textAlign:'right', whiteSpace:'nowrap' }}>Direct Actions</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {dbRows.map((row, i) => {
                            const rowStatus = getRowStatus(dbTable, row, profiles, teams)
                            const isOrphan = rowStatus?.isOrphan
                            const rowBg = isOrphan ? '#fff5f5' : ''
                            
                            return (
                              <tr key={i}
                                style={{ background: rowBg, borderLeft: isOrphan ? '4px solid #ef4444' : undefined }}
                                onMouseEnter={e => e.currentTarget.style.background = isOrphan ? '#fee2e2' : '#f0fdfa'}
                                onMouseLeave={e => e.currentTarget.style.background = rowBg}>
                                {dbCols.map(c => {
                                  const isName = c === 'full_name' || c === 'name'
                                  const isId = c === 'id' || c?.endsWith('_id')
                                  const isRole = c === 'role'
                                  const val = row[c]
                                  const resolved = isId ? resolveIdName(c, val) : null

                                  return (
                                    <td key={c} className="sa-td" style={{ 
                                      maxWidth: isName || resolved ? 240 : 160, 
                                      overflow:'hidden', 
                                      textOverflow:'ellipsis', 
                                      whiteSpace:'nowrap', 
                                      fontFamily: isId && !resolved ? 'monospace' : 'inherit', 
                                      fontSize:11,
                                      background: isName ? '#f0fdfa' : undefined,
                                      color: val===null ? '#cbd5e1' : isName ? '#0f172a' : isId ? '#0d9488' : '#334155',
                                      fontWeight: isName || resolved ? 700 : undefined,
                                    }}>
                                      {val === null ? (
                                        <span style={{ fontStyle:'italic', color:'#cbd5e1' }}>null</span>
                                      ) : isRole ? (
                                        <RoleBadge role={String(val)} />
                                      ) : resolved ? (
                                        <span title={val} style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
                                          <span style={{ color: '#0f172a', fontWeight: 700 }}>
                                            {resolved.icon} {resolved.name}
                                          </span>
                                          {resolved.club && (
                                            <span style={{ fontSize: 9, color: '#0d9488', fontWeight: 600 }}>
                                              ({resolved.club})
                                            </span>
                                          )}
                                          <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', fontWeight: 400 }}>
                                            {val.slice(0, 8)}…
                                          </span>
                                        </span>
                                      ) : (
                                        String(val)
                                      )}
                                    </td>
                                  )
                                })}
                                {/* Root Status Column */}
                                <td className="sa-td" style={{ whiteSpace:'nowrap' }}>
                                  {rowStatus ? (
                                    <span style={{ display:'inline-block', background: rowStatus.bg, color: rowStatus.color, borderRadius:99, padding:'2px 8px', fontSize:10, fontWeight:700 }}>
                                      {rowStatus.label}
                                    </span>
                                  ) : (
                                    <span style={{ display:'inline-block', background: '#d1fae5', color: '#059669', borderRadius:99, padding:'2px 8px', fontSize:10, fontWeight:700 }}>
                                      Healthy
                                    </span>
                                  )}
                                </td>
                                {/* Direct Actions Column */}
                                {['profiles', 'teams', 'athletes'].includes(dbTable) && (
                                  <td className="sa-td" style={{ textAlign:'right', whiteSpace:'nowrap' }}>
                                    {dbTable === 'profiles' && row.role !== 'superadmin' && (
                                      <Btn variant="danger" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => deleteUserDirect(row.id, row.full_name || row.email)} disabled={acting}>
                                        Delete User
                                      </Btn>
                                    )}
                                    {dbTable === 'teams' && (
                                      <Btn variant="danger" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => deleteTeamDirect(row.id, row.name)} disabled={acting}>
                                        Wipe Team
                                      </Btn>
                                    )}
                                    {dbTable === 'athletes' && (
                                      <Btn variant="danger" style={{ padding: '3px 8px', fontSize: 10 }} onClick={async () => {
                                        if (!confirm(`Delete athlete "${row.name}"? This will remove all associated database records.`)) return
                                        setActing(true)
                                        try {
                                          const { error } = await supabase.from('athletes').delete().eq('id', row.id)
                                          if (error) throw error
                                          showToast(`Deleted athlete "${row.name}" successfully!`)
                                          loadProfiles()
                                          loadTable('athletes')
                                        } catch (err) { showToast('Deletion failed: ' + err.message, 'error') }
                                        finally { setActing(false) }
                                      }} disabled={acting}>
                                        Delete Athlete
                                      </Btn>
                                    )}
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

          </main>
        </div>
      </div>

      {/* PROVISION MODAL */}
      {addModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', backdropFilter:'blur(8px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div className="sa-card" style={{ width:'100%', maxWidth:440, display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #f1f5f9', paddingBottom:12 }}>
              <h3 style={{ fontSize:15, fontWeight:800, color:'#0f172a' }}>+ Provision Administrator</h3>
              <button onClick={() => setAddModal(false)} style={{ background:'none', border:'none', color:'#94a3b8', fontSize:20, cursor:'pointer', lineHeight:1 }}>×</button>
            </div>
            {[
              { label:'Full Name', key:'name', value:newName, set:setNewName, placeholder:'e.g. John Doe', type:'text' },
              { label:'Email Address', key:'email', value:newEmail, set:setNewEmail, placeholder:'e.g. john@example.com', type:'email' },
              { label:'Secure Password', key:'password', value:newPassword, set:setNewPassword, placeholder:'Min. 8 characters', type:'password' },
              { label:'Club / Team Name', key:'club', value:newClub, set:setNewClub, placeholder:'e.g. Accra Lions FC', type:'text' },
            ].map(({ label, key, value, set, placeholder, type }) => (
              <div key={key}>
                <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{label}</label>
                <input className="sa-custom-input" type={type} placeholder={placeholder} value={value} onChange={e => set(e.target.value)} />
              </div>
            ))}
            <div style={{ display:'flex', gap:8, borderTop:'1px solid #f1f5f9', paddingTop:14 }}>
              <Btn onClick={() => setAddModal(false)} style={{ flex:1, justifyContent:'center' }}>Cancel</Btn>
              <Btn variant="primary" onClick={handleAddAdmin} disabled={addingAdmin} style={{ flex:2, justifyContent:'center' }}>
                {addingAdmin?'Provisioning…':'Provision Account'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </>
  )
}