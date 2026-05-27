'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── CUSTOM SVG ICONS FOR Command Center ──
const IconOverview = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
)

const IconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const IconClubs = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10v6" />
    <path d="M6 10h12" />
    <path d="M12 22V2M12 2l10 8H2L12 2z" />
  </svg>
)

const IconDatabase = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
  </svg>
)

const IconFunctions = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)

const IconActivity = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
)

const IconCopy = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const TABLES = ['profiles', 'athletes', 'teams', 'sessions', 'injuries', 'transfers']

const STATUS_META = {
  pending:                   { bg:'rgba(245,158,11,0.12)',  color:'#F59E0B', label:'Pending Review' },
  pending_email_verification: { bg:'rgba(59,130,246,0.12)',  color:'#3B82F6', label:'Email Verify' },
  approved:                  { bg:'rgba(16,185,129,0.12)',  color:'#10B981', label:'Approved' },
  rejected:                  { bg:'rgba(239,68,68,0.12)',   color:'#EF4444', label:'Rejected' },
  active:                    { bg:'rgba(16,185,129,0.12)',  color:'#10B981', label:'Active' },
  inactive:                  { bg:'rgba(239,68,68,0.12)',   color:'#EF4444', label:'Inactive' },
}

function Pill({ status }) {
  const s = STATUS_META[status?.toLowerCase()] || STATUS_META.pending
  return (
    <span style={{ display:'inline-flex', alignItems: 'center', gap: 6, background: s.bg, color: s.color, borderRadius: 99, padding: '4px 11px', fontSize: 11, fontWeight: 700, border: `1px solid ${s.color}25` }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
      {s.label}
    </span>
  )
}

function Avatar({ name, size=36, gradient='linear-gradient(135deg, #0D9488, #0F766E)' }) {
  const initials = (name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.34, fontWeight: 800, color: '#fff', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 2px 8px rgba(13,148,136,0.25)' }}>
      {initials}
    </div>
  )
}

function ClubLogo({ url, name, size=36 }) {
  const [err, setErr] = useState(false)
  const isValidUrl = url && !url.startsWith('data:') && !url.startsWith('blob:') && !err
  if (isValidUrl) return <img src={url} alt={name} onError={()=>setErr(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(20, 184, 166, 0.3)', flexShrink: 0 }}/>
  return <Avatar name={name} size={size}/>
}

function StatCard({ label, value, icon, color, sub }) {
  return (
    <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px', position: 'relative', overflow: 'hidden', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
      className="stat-card">
      <div style={{ position: 'absolute', top: -14, right: -14, width: 80, height: 80, borderRadius: '50%', background: `${color}08`, filter: 'blur(10px)' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 24, background: `${color}15`, width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${color}20` }}>{icon}</div>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: 4 }}>{sub}</div>
      </div>
      <div style={{ fontSize: 34, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{label}</div>
    </div>
  )
}

function Toast({ toast }) {
  if (!toast) return null
  const isErr = toast.type === 'error'
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: isErr ? '#1c0e0e' : '#071b15', color: isErr ? '#fca5a5' : '#6ee7b7', padding: '14px 22px', borderRadius: 12, fontSize: 13, fontWeight: 700, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', maxWidth: 360, border: `1px solid ${isErr ? '#ef444430' : '#10b98130'}`, display: 'flex', alignItems: 'center', gap: 10, animation: 'fadeUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
      <span style={{ color: isErr ? '#ef4444' : '#10b981', fontSize: 16 }}>{isErr ? '⚠️' : '✓'}</span>
      <span style={{ lineHeight: 1.4 }}>{toast.msg}</span>
    </div>
  )
}

function Btn({ onClick, children, style={}, disabled=false, variant='default' }) {
  const bases = {
    default: { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.08)' },
    primary: { background: 'linear-gradient(135deg, #0D9488, #14B8A6)', color: '#fff', border: 'none', boxShadow: '0 4px 14px rgba(13,148,136,0.3)' },
    danger:  { background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' },
    success: { background: 'rgba(16,185,129,0.1)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.2)' },
    ghost:   { background: 'transparent', color: 'rgba(255,255,255,0.35)', border: 'none' },
  }
  const base = bases[variant] || bases.default
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...base, borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.5 : 1, transition: 'all 0.15s ease', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, ...style }}
      className="hover-trigger">
      {children}
    </button>
  )
}

const NAV_ITEMS = [
  { id:'overview',  label:'Overview',       icon: <IconOverview /> },
  { id:'users',     label:'Users',          icon: <IconUsers /> },
  { id:'clubs',     label:'Clubs',          icon: <IconClubs /> },
  { id:'database',  label:'Database',       icon: <IconDatabase /> },
  { id:'functions', label:'Edge Functions', icon: <IconFunctions /> },
]

export default function SuperadminPage() {
  const router = useRouter()
  const [authOk,         setAuthOk]         = useState(false)
  const [section,        setSection]        = useState('overview')
  const [profiles,       setProfiles]       = useState([])
  const [teams,          setTeams]          = useState([])
  const [dbRows,         setDbRows]         = useState([])
  const [dbCols,         setDbCols]         = useState([])
  const [dbTable,        setDbTable]        = useState('profiles')
  const [dbLoading,      setDbLoading]      = useState(false)
  const [filter,         setFilter]         = useState('all')
  const [search,         setSearch]         = useState('')
  const [loading,        setLoading]        = useState(true)
  const [toast,          setToast]          = useState(null)
  const [acting,         setActing]         = useState(false)
  const [selected,       setSelected]       = useState(null)
  const [logoUrl,        setLogoUrl]        = useState('')
  const [logoPreview,    setLogoPreview]    = useState('')
  const [logoUploading,  setLogoUploading]  = useState(false)
  const [rejReason,      setRejReason]      = useState('')
  const [sqlQuery,       setSqlQuery]       = useState('SELECT * FROM profiles LIMIT 50;')
  const [sqlResult,      setSqlResult]      = useState(null)
  const [sqlError,       setSqlError]       = useState('')
  const [stats,          setStats]          = useState({ total:0, pending:0, approved:0, rejected:0, clubs:0 })
  const [addModal,       setAddModal]       = useState(false)
  const [newName,        setNewName]        = useState('')
  const [newEmail,       setNewEmail]       = useState('')
  const [newPassword,    setNewPassword]    = useState('')
  const [newClub,        setNewClub]        = useState('')
  const [newLogoUrl,     setNewLogoUrl]     = useState('')
  const [newLogoPreview, setNewLogoPreview] = useState('')
  const [newLogoFile,    setNewLogoFile]    = useState(null)
  const [addingAdmin,    setAddingAdmin]    = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [currentTime,    setCurrentTime]    = useState(new Date())

  const [selectedClearTable, setSelectedClearTable] = useState('athletes')
  const [clearAllModal, setClearAllModal] = useState(false)
  const [confirmClearAllText, setConfirmClearAllText] = useState('')
  const [clearingAll, setClearingAll] = useState(false)
  const [clearingTable, setClearingTable] = useState(false)

  // Telemetry indicators
  const [systemLatency,  setSystemLatency]  = useState(38)
  const [systemCpu,      setSystemCpu]      = useState(14)
  const [systemMem,      setSystemMem]      = useState(88)
  const [activities,     setActivities]     = useState([])
  const [actLoading,     setActLoading]     = useState(false)

  // Simulation tick for health indicators
  useEffect(() => {
    const timer = setInterval(() => {
      setSystemLatency(prev => Math.max(22, Math.min(94, prev + Math.floor(Math.random() * 15) - 7)))
      setSystemCpu(prev => Math.max(6, Math.min(88, prev + Math.floor(Math.random() * 9) - 4)))
      setSystemMem(prev => Math.max(70, Math.min(194, prev + Math.floor(Math.random() * 3) - 1)))
      setCurrentTime(new Date())
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data:{ session } }) => {
      if (!session) { router.replace('/login'); return }
      const { data:p } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      if (p?.role !== 'superadmin') { router.replace('/dashboard'); return }
      setAuthOk(true)
    })
  }, [router])

  const fetchWithAuth = useCallback(async (url) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No active session')
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    })
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
      const rows = data.profiles || []
      setProfiles(rows)
      setStats({
        total:    rows.length,
        pending:  rows.filter(p=>p.registration_status==='pending_email_verification'||p.registration_status==='pending').length,
        approved: rows.filter(p=>p.registration_status==='approved').length,
        rejected: rows.filter(p=>p.registration_status==='rejected').length,
        clubs:    [...new Set(rows.filter(p=>p.team_id).map(p=>p.team_id))].length,
      })
    } catch (err) {
      console.error('Error loading profiles:', err)
      showToast('Failed to load profiles: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [fetchWithAuth])

  const loadTeams = useCallback(async () => {
    try {
      const data = await fetchWithAuth('/api/admin/superadmin-data?section=teams')
      setTeams(data.teams || [])
    } catch (err) {
      console.error('Error loading teams:', err)
    }
  }, [fetchWithAuth])

  const loadActivities = useCallback(async () => {
    setActLoading(true)
    try {
      const data = await fetchWithAuth('/api/admin/superadmin-data?section=activities')
      const acts = []
      if (data.recentProfiles) {
        data.recentProfiles.forEach(p => {
          acts.push({
            type: 'signup',
            title: 'Club Signup Request',
            desc: `${p.full_name} registered for ${p.club_name || 'Individual Profile'}`,
            time: new Date(p.created_at),
            badgeColor: '#F59E0B'
          })
        })
      }
      if (data.recentAthletes) {
        data.recentAthletes.forEach(a => {
          acts.push({
            type: 'athlete',
            title: 'Athlete Profile Created',
            desc: `Athlete record generated for ${a.name}`,
            time: new Date(a.created_at),
            badgeColor: '#10B981'
          })
        })
      }
      if (data.recentTeams) {
        data.recentTeams.forEach(t => {
          acts.push({
            type: 'club',
            title: 'Franchise Auto-Provision',
            desc: `Club system created for franchise "${t.name}"`,
            time: new Date(t.created_at),
            badgeColor: '#818CF8'
          })
        })
      }

      // Sort by time descending
      acts.sort((a, b) => b.time - a.time)
      setActivities(acts.slice(0, 10))
    } catch (e) {
      console.error(e)
    }
    setActLoading(false)
  }, [fetchWithAuth])

  useEffect(() => {
    if (authOk) {
      loadProfiles()
      loadTeams()
      loadActivities()
    }
  }, [authOk, loadProfiles, loadTeams, loadActivities])

  const loadTable = useCallback(async (tbl) => {
    setDbLoading(true); setDbRows([]); setDbCols([])
    try {
      const data = await fetchWithAuth(`/api/admin/superadmin-data?table=${tbl}`)
      if (data?.data?.length) {
        setDbCols(Object.keys(data.data[0]))
        setDbRows(data.data)
      }
    } catch (err) {
      console.error('Error loading table:', err)
      showToast('Failed to load table: ' + err.message, 'error')
    } finally {
      setDbLoading(false)
    }
  }, [fetchWithAuth])

  useEffect(() => { if (authOk && section==='database') loadTable(dbTable) }, [authOk, section, dbTable, loadTable])

  function showToast(msg, type='success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openReview(p) {
    setSelected(p)
    const validUrl = p.club_logo_url && !p.club_logo_url.startsWith('data:') ? p.club_logo_url : ''
    setLogoUrl(validUrl); setLogoPreview(validUrl); setRejReason('')
  }

  async function handleLogoFile(e) {
    const file = e.target.files[0]
    if (!file || !selected) return
    setLogoPreview(URL.createObjectURL(file)); setLogoUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `club-logos/${selected.id}.${ext}`
      const { error } = await supabase.storage.from('athlete-photos').upload(path, file, { upsert:true })
      if (error) throw error
      const url = supabase.storage.from('athlete-photos').getPublicUrl(path).data.publicUrl
      setLogoUrl(url); setLogoPreview(url); showToast('Logo uploaded successfully!')
    } catch (err) { showToast('Upload failed: ' + (err.message || ''), 'error'); setLogoPreview(logoUrl) }
    setLogoUploading(false)
  }

  async function handleApprove() {
    if (!selected) return
    const finalLogoUrl = (logoUrl && !logoUrl.startsWith('data:') && !logoUrl.startsWith('blob:')) ? logoUrl : null
    setActing(true)
    try {
      let teamId = null
      if (selected.club_name) {
        const { data: existingTeam } = await supabase.from('teams').select('id').ilike('name', selected.club_name.trim()).maybeSingle()
        if (existingTeam?.id) {
          teamId = existingTeam.id
          if (finalLogoUrl) await supabase.from('teams').update({ logo_url: finalLogoUrl }).eq('id', teamId)
        } else {
          const { data: newTeam, error: teamError } = await supabase.from('teams').insert([{
            name: selected.club_name.trim(),
            short_name: selected.club_name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4),
            logo_url: finalLogoUrl || null,
          }]).select().single()
          if (!teamError) teamId = newTeam.id
        }
        if (teamId) {
          const { data: existingSub } = await supabase.from('subscriptions').select('id').eq('team_id', teamId).maybeSingle()
          if (!existingSub) {
            const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 30)
            await supabase.from('subscriptions').insert([{ team_id: teamId, plan: 'trial', status: 'active', trial_ends_at: trialEnd.toISOString(), current_period_end: trialEnd.toISOString() }])
          }
        }
      }
      const { error } = await supabase.from('profiles').update({ is_active: true, registration_status: 'approved', approved_at: new Date().toISOString(), club_logo_url: finalLogoUrl, team_id: teamId }).eq('id', selected.id)
      if (error) throw error

      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        await fetch('/api/admin/confirm-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ user_id: selected.id }),
        })
      }

      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          full_name: selected.full_name,
          email: selected.email,
          club_name: selected.club_name,
          club_logo_url: finalLogoUrl,
          app_url: window.location.origin,
        }),
      })
      showToast('✅ Approved — welcome mail dispatched and team provisioned!')
      setSelected(null); loadProfiles(); loadTeams(); loadActivities()
    } catch (err) { showToast('Approval failed: ' + (err.message || ''), 'error') }
    setActing(false)
  }

  async function handleReject() {
    if (!selected || !rejReason.trim()) { showToast('Enter a valid rejection reason', 'error'); return }
    setActing(true)
    try {
      const { error } = await supabase.from('profiles').update({ registration_status: 'rejected', is_active: false, rejection_reason: rejReason.trim() }).eq('id', selected.id)
      if (error) throw error
      showToast('Profile rejected: ' + selected.full_name); setSelected(null); loadProfiles(); loadActivities()
    } catch (err) { showToast('Rejection failed: ' + (err.message||''), 'error') }
    setActing(false)
  }

  async function handleAddAdmin() {
    if (!newName.trim())  { showToast('Full name is required', 'error'); return }
    if (!newEmail.trim()) { showToast('Email is required', 'error'); return }
    if (!newPassword || newPassword.length < 8) { showToast('Password must be at least 8 characters', 'error'); return }
    if (!newClub.trim())  { showToast('Club name is required', 'error'); return }
    setAddingAdmin(true)
    try {
      const checkRes = await fetch(`/api/signup-provision?club_name=${encodeURIComponent(newClub.trim())}`)
      const checkData = await checkRes.json()
      if (checkData.exists) throw new Error('A club with this name is already registered.')
      const { data:authData, error:authError } = await supabase.auth.signUp({
        email: newEmail.trim().toLowerCase(), password: newPassword,
        options: {
          data: { full_name: newName.trim(), club_name: newClub.trim() },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      })
      if (authError) throw authError
      if (!authData?.user) throw new Error('User creation failed')
      const userId = authData.user.id
      let finalLogoUrl = null
      if (newLogoUrl && !newLogoUrl.startsWith('data:') && !newLogoUrl.startsWith('blob:')) finalLogoUrl = newLogoUrl
      if (newLogoFile) {
        const ext  = newLogoFile.name.split('.').pop()
        const path = `club-logos/${userId}.${ext}`
        const { error:uploadError } = await supabase.storage.from('athlete-photos').upload(path, newLogoFile, { upsert:true })
        if (!uploadError) finalLogoUrl = supabase.storage.from('athlete-photos').getPublicUrl(path).data.publicUrl
      }
      const provRes = await fetch('/api/signup-provision', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, full_name: newName.trim(), club_name: newClub.trim(), email: newEmail.trim().toLowerCase() }),
      })
      const provData = await provRes.json()
      if (!provRes.ok) throw new Error(provData.error || 'Provision failed')
      if (!provData.verification_email_sent) {
        throw new Error('Account created but verification email failed. Use Resend verification from login or try again.')
      }
      if (finalLogoUrl) await supabase.from('profiles').update({ club_logo_url: finalLogoUrl }).eq('id', userId)
      showToast('✅ Account provisioned — verification email sent!')
      setAddModal(false); setNewName(''); setNewEmail(''); setNewPassword(''); setNewClub('')
      setNewLogoUrl(''); setNewLogoPreview(''); setNewLogoFile(null)
      loadProfiles(); loadTeams(); loadActivities()
    } catch (err) { showToast('Failed to add admin: ' + (err.message || 'Unknown error'), 'error') }
    setAddingAdmin(false)
  }

  async function handleDelete(p) {
    if (!confirm(`Are you sure you want to delete ${p.full_name}? This will delete their Auth account and clear their profile data.`)) return
    setActing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/system-commands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          command: 'delete_user',
          userId: p.id
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete user')
      showToast(`Deleted ${p.full_name} and their Auth account`)
      loadProfiles(); loadTeams(); loadActivities()
    } catch (err) {
      showToast('Deletion failed: ' + err.message, 'error')
    } finally {
      setActing(false)
    }
  }

  async function toggleActive(p) {
    await supabase.from('profiles').update({ is_active: !p.is_active }).eq('id', p.id)
    showToast(p.full_name + ' has been ' + (!p.is_active ? 'activated' : 'deactivated')); loadProfiles()
  }

  async function handleClearTable(tbl) {
    if (!confirm(`Are you sure you want to delete all data in table "${tbl}"? This action cannot be undone.`)) return
    setClearingTable(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/system-commands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          command: 'clear_table',
          tableName: tbl
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to clear table')
      showToast(`Successfully cleared table "${tbl}"`)
      loadProfiles(); loadTeams(); loadActivities()
      if (section === 'database' && dbTable === tbl) {
        loadTable(tbl)
      }
    } catch (err) {
      showToast('Clear table failed: ' + err.message, 'error')
    } finally {
      setClearingTable(false)
    }
  }

  async function handleClearAll() {
    if (confirmClearAllText !== 'CONFIRM CLEAR ALL') {
      showToast('Please type the exact phrase to confirm.', 'error')
      return
    }
    setClearingAll(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/system-commands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          command: 'clear_all'
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to clear system')
      showToast('System data wiped successfully!')
      setClearAllModal(false)
      setConfirmClearAllText('')
      loadProfiles(); loadTeams(); loadActivities()
    } catch (err) {
      showToast('Wipe failed: ' + err.message, 'error')
    } finally {
      setClearingAll(false)
    }
  }

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase()
    const matchQ = !search || [p.full_name,p.email,p.club_name].some(v=>v?.toLowerCase().includes(q))
    const matchF = filter==='all' || p.registration_status===filter || (filter==='pending' && p.registration_status?.startsWith('pending'))
    return matchQ && matchF
  })

  const pendingCount = stats.pending

  if (!authOk) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#030712', flexDirection:'column', gap:16 }}>
      <div style={{ width:42, height:42, border:'3px solid rgba(20,184,166,0.1)', borderTopColor:'#14B8A6', borderRadius:'50%', animation:'spin 0.8s cubic-bezier(0.5,0.1,0.1,0.9) infinite' }} />
      <div style={{ fontSize:12, color:'rgba(20,184,166,0.5)', fontFamily:'system-ui', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase' }}>Glow Core Booting…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const INP = { width:'100%', padding:'10px 14px', background:'rgba(11,19,41,0.5)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, fontSize:13, outline:'none', color:'#fff', fontFamily:'inherit', transition:'border-color 0.15s ease' }
  const LBL = { fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:6, display:'block' }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#030712;font-family:'Inter',sans-serif}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes liveIndicator{0%,100%{transform:scale(1);opacity:0.9}50%{transform:scale(1.3);opacity:0.5}}
        
        .glow-card {
          background: #0b1329;
          border: 1px solid rgba(20,184,166,0.12);
          box-shadow: 0 4px 20px rgba(0,0,0,0.25);
        }
        .stat-card:hover {
          transform: translateY(-2px);
          border-color: rgba(20,184,166,0.3) !important;
          box-shadow: 0 10px 24px rgba(13,148,136,0.1) !important;
        }
        input:focus,textarea:focus,select:focus{
          border-color:rgba(20,184,166,0.6)!important;
          box-shadow:0 0 0 3px rgba(20,184,166,0.1)!important;
        }
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:rgba(255,255,255,0.01)}
        ::-webkit-scrollbar-thumb{background:rgba(20,184,166,0.15);border-radius:99px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(20,184,166,0.4)}
        
        tr:hover td{background:rgba(20,184,166,0.02) !important}
        .nav-item{transition:all 0.2s;cursor:pointer}
        .nav-item:hover{background:rgba(255,255,255,0.04) !important;color:#fff !important}
        .hover-trigger:hover{transform:translateY(-1px);filter:brightness(1.1)}
      `}</style>

      <Toast toast={toast} />

      <div style={{ display:'flex', height:'100vh', background:'#030712', overflow:'hidden', color:'#e2e8f0' }}>

        {/* ── COLLAPSIBLE COMMAND SIDEBAR ── */}
        <div style={{ width: sidebarCollapsed ? 72 : 240, background:'#080e1c', display:'flex', flexDirection:'column', flexShrink:0, borderRight:'1px solid rgba(255,255,255,0.05)', transition:'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)', overflow:'hidden' }}>

          {/* Platform Identity */}
          <div style={{ padding:'22px 18px', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', gap:12, minHeight:76 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg, #0D9488, #14B8A6)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', flexShrink:0, boxShadow:'0 0 16px rgba(20,184,166,0.4)', fontWeight:900 }}>⚡</div>
            {!sidebarCollapsed && (
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:'#fff', letterSpacing:'-0.01em', display:'flex', alignItems:'center', gap:6 }}>
                  AthleteHub
                  <span style={{ fontSize:9, background:'rgba(20,184,166,0.15)', color:'#14B8A6', padding:'1px 5px', borderRadius:4, fontWeight:700 }}>PRO</span>
                </div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', marginTop:2 }}>Command Center</div>
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          <nav style={{ flex:1, padding:'16px 10px', display:'flex', flexDirection:'column', gap:4 }}>
            {NAV_ITEMS.map(n => {
              const isActive = section === n.id
              const hasBadge = n.id==='users' && pendingCount > 0
              return (
                <div key={n.id} className="nav-item"
                  onClick={() => setSection(n.id)}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:10, color: isActive ? '#fff' : 'rgba(255,255,255,0.4)', background: isActive ? 'rgba(20,184,166,0.12)' : 'transparent', fontWeight: isActive ? 700 : 500, fontSize:13, position:'relative', border: isActive ? '1px solid rgba(20,184,166,0.15)' : '1px solid transparent' }}>
                  {isActive && <div style={{ position:'absolute', left:0, top:'50%', transform:'translateY(-50%)', width:3, height:20, borderRadius:99, background:'#14B8A6', boxShadow:'0 0 8px #14B8A6' }} />}
                  <span style={{ display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color: isActive ? '#14B8A6' : 'inherit' }}>{n.icon}</span>
                  {!sidebarCollapsed && <span style={{ flex:1, whiteSpace:'nowrap' }}>{n.label}</span>}
                  {hasBadge && !sidebarCollapsed && (
                    <span style={{ background:'#EF4444', color:'#fff', fontSize:9, fontWeight:800, borderRadius:99, padding:'1px 6px', animation:'pulse 2s infinite' }}>{pendingCount}</span>
                  )}
                  {hasBadge && sidebarCollapsed && (
                    <span style={{ position:'absolute', top:6, right:6, width:7, height:7, borderRadius:'50%', background:'#EF4444', animation:'pulse 2s infinite' }} />
                  )}
                </div>
              )
            })}
          </nav>

          {/* Superadmin Signature Profile */}
          <div style={{ padding:'16px 12px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px', borderRadius:12, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#14B8A6, #0D9488)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900, color:'#fff', flexShrink:0 }}>S</div>
              {!sidebarCollapsed && (
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, color:'#fff', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Samuel Wobil</div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:1 }}>samuelwobil11@gmail.com</div>
                </div>
              )}
            </div>
            <div onClick={()=>supabase.auth.signOut().then(()=>router.replace('/login'))}
              style={{ marginTop:10, display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:8, cursor:'pointer', color:'rgba(255,255,255,0.3)', fontSize:12, fontWeight:600, transition:'all 0.15s ease' }}
              onMouseEnter={e=>{ e.currentTarget.style.color='#F87171'; e.currentTarget.style.background='rgba(239,68,68,0.08)' }}
              onMouseLeave={e=>{ e.currentTarget.style.color='rgba(255,255,255,0.3)'; e.currentTarget.style.background='transparent' }}>
              <span style={{ fontSize:14 }}>↩</span>
              {!sidebarCollapsed && 'Disconnect session'}
            </div>
          </div>
        </div>

        {/* ── VIEW CONTAINER ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Control Bar Header */}
          <div style={{ padding:'0 30px', height:76, background:'rgba(3,7,18,0.85)', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, backdropFilter:'blur(16px)', zIndex:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <button onClick={()=>setSidebarCollapsed(c=>!c)} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, width:34, height:34, cursor:'pointer', color:'rgba(255,255,255,0.4)', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }}
                className="hover-trigger">
                {sidebarCollapsed ? '➔' : '➔'}
              </button>
              <div>
                <div style={{ fontSize:18, fontWeight:800, color:'#fff', letterSpacing:'-0.02em', display:'flex', alignItems:'center', gap:8 }}>
                  {NAV_ITEMS.find(n=>n.id===section)?.label || 'Overview'}
                  <span style={{ width:6, height:6, borderRadius:'50%', background:'#10B981', display:'inline-block', animation:'liveIndicator 1.5s infinite' }}/>
                </div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:2, display:'flex', alignItems:'center', gap:4 }}>
                  <span>GMT System Status Clock:</span>
                  <span style={{ fontWeight:700, color:'rgba(255,255,255,0.5)' }}>{currentTime.toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              {(section==='users'||section==='overview') && (
                <Btn variant="primary" onClick={()=>setAddModal(true)}>
                  <span>+ Provision Admin</span>
                </Btn>
              )}
              <Btn onClick={() => { loadProfiles(); loadTeams(); loadActivities(); showToast('Telemetry buffer synced') }}>
                <span>Sync Cache</span>
              </Btn>
              <Btn onClick={()=>router.push('/dashboard')} style={{ background: 'rgba(20,184,166,0.1)', color: '#14B8A6', borderColor: 'rgba(20,184,166,0.2)' }}>
                <span>Admin Suite ➔</span>
              </Btn>
            </div>
          </div>

          {/* Telemetry Teleports */}
          <div style={{ flex:1, overflowY:'auto', padding:'30px', background:'radial-gradient(circle at 10% 10%, rgba(20, 184, 166, 0.04), transparent 50%), #030712' }}>

            {/* ── TELEMETRY COMMAND CONSOLE (OVERVIEW) ── */}
            {section==='overview' && (
              <div style={{ animation:'fadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)', display:'flex', flexDirection:'column', gap:24 }}>
                
                {/* Stats cards Grid */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:16 }}>
                  <StatCard icon="👤" label="Registered Admins" value={stats.total} color="#06B6D4" sub="Total Profiles" />
                  <StatCard icon="⏳" label="Awaiting Approval" value={stats.pending} color="#F59E0B" sub="Alert Trigger" />
                  <StatCard icon="✅" label="Approved Franchisees" value={stats.approved} color="#10B981" sub="Live Tenants" />
                  <StatCard icon="🚫" label="Declined Logins" value={stats.rejected} color="#EF4444" sub="Declined" />
                  <StatCard icon="🏟️" label="Total Clubs Active" value={stats.clubs} color="#818CF8" sub="Dataspaces" />
                </div>

                {/* Telemetry Visual Health Meters */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  
                  {/* Database Engine Pulse */}
                  <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: '20px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:16 }}>📊</span>
                        <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>PostgreSQL Storage Pulse</div>
                      </div>
                      <span style={{ fontSize:10, background:'rgba(16,185,129,0.15)', color:'#10B981', padding:'2px 8px', borderRadius:6, fontWeight:700 }}>99.9% Up</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                      <div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>
                          <span>Database Latency</span>
                          <span style={{ fontWeight:700, color:'#14B8A6' }}>{systemLatency}ms</span>
                        </div>
                        <div style={{ height:6, background:'rgba(255,255,255,0.05)', borderRadius:99, overflow:'hidden' }}>
                          <div style={{ width: `${Math.min(100, (systemLatency / 120) * 100)}%`, height:'100%', background:'#14B8A6', borderRadius:99, transition:'width 0.4s ease' }}/>
                        </div>
                      </div>
                      <div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>
                          <span>Edge Node Latency</span>
                          <span style={{ fontWeight:700, color:'#3B82F6' }}>18ms</span>
                        </div>
                        <div style={{ height:6, background:'rgba(255,255,255,0.05)', borderRadius:99, overflow:'hidden' }}>
                          <div style={{ width: '22%', height:'100%', background:'#3B82F6', borderRadius:99 }}/>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Server Telemetry Performance */}
                  <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: '20px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:16 }}>⚙️</span>
                        <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>CPU & Memory Allocation</div>
                      </div>
                      <span style={{ fontSize:10, background:'rgba(20,184,166,0.15)', color:'#14B8A6', padding:'2px 8px', borderRadius:6, fontWeight:700 }}>Telemetry</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                      <div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>
                          <span>Heap Memory</span>
                          <span style={{ fontWeight:700, color:'#10B981' }}>{systemMem} MB / 512 MB</span>
                        </div>
                        <div style={{ height:6, background:'rgba(255,255,255,0.05)', borderRadius:99, overflow:'hidden' }}>
                          <div style={{ width: `${(systemMem / 512) * 100}%`, height:'100%', background:'#10B981', borderRadius:99, transition:'width 0.4s ease' }}/>
                        </div>
                      </div>
                      <div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>
                          <span>Simulated CPU load</span>
                          <span style={{ fontWeight:700, color:'#EF4444' }}>{systemCpu}%</span>
                        </div>
                        <div style={{ height:6, background:'rgba(255,255,255,0.05)', borderRadius:99, overflow:'hidden' }}>
                          <div style={{ width: `${systemCpu}%`, height:'100%', background:'#EF4444', borderRadius:99, transition:'width 0.4s ease' }}/>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Core Platform Services */}
                  <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: '20px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:16 }}>🖧</span>
                        <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Supabase Stack Status</div>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      {[
                        ['Database Engine', 'Active'],
                        ['Storage API', 'Online'],
                        ['Auth / JWT Services', 'Stable'],
                        ['PostgREST Cache', 'Synced'],
                      ].map(([sName, sVal]) => (
                        <div key={sName} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)', borderRadius:10, padding:'8px 10px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontWeight:600 }}>{sName}</span>
                          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <span style={{ width:5, height:5, borderRadius:'50%', background:'#10B981' }}/>
                            <span style={{ fontSize:10, color:'#10B981', fontWeight:700 }}>{sVal}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* ── SYSTEM COMMANDS CONSOLE ── */}
                <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>⚡</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>System Command Console</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>Execute high-level administrative database & user commands</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.15)', color: '#EF4444', padding: '2px 8px', borderRadius: 6, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Restricted Access</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                    
                    {/* Database Truncator */}
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 12, padding: '16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>🗑️</span> Table Maintenance
                      </div>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 16, lineHeight: 1.4 }}>
                        Wipe all records from a specific table. Profiles table retains superadmin account.
                      </p>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <select 
                          value={selectedClearTable} 
                          onChange={e => setSelectedClearTable(e.target.value)}
                          style={{ 
                            flex: 1, 
                            padding: '8px 12px', 
                            background: 'rgba(11,19,41,0.8)', 
                            border: '1px solid rgba(255,255,255,0.08)', 
                            borderRadius: 8, 
                            fontSize: 12, 
                            color: '#fff', 
                            outline: 'none' 
                          }}
                        >
                          <option value="athletes">athletes</option>
                          <option value="coaches">coaches</option>
                          <option value="injuries">injuries</option>
                          <option value="training_sessions">training_sessions</option>
                          <option value="performance_stats">performance_stats</option>
                          <option value="contracts">contracts</option>
                          <option value="transfers">transfers</option>
                          <option value="scouting_reports">scouting_reports</option>
                          <option value="staff_logins">staff_logins</option>
                          <option value="subscriptions">subscriptions</option>
                          <option value="billing_events">billing_events</option>
                          <option value="teams">teams</option>
                          <option value="profiles">profiles</option>
                        </select>
                        <Btn 
                          variant="danger" 
                          onClick={() => handleClearTable(selectedClearTable)} 
                          disabled={clearingTable}
                          style={{ padding: '8px 16px' }}
                        >
                          {clearingTable ? 'Clearing...' : 'Clear Table'}
                        </Btn>
                      </div>
                    </div>

                    {/* Nuclear Wipe */}
                    <div style={{ background: 'rgba(239,68,68,0.02)', border: '1px solid rgba(239,68,68,0.08)', borderRadius: 12, padding: '16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#F87171', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>☢️</span> System Data Cleanup
                      </div>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 16, lineHeight: 1.4 }}>
                        Wipe all records across all tables (clubs, athletes, plans, logs) and delete all auth IDs except the superadmin.
                      </p>
                      <Btn 
                        variant="danger" 
                        onClick={() => setClearAllModal(true)} 
                        style={{ width: '100%', padding: '9px', background: 'linear-gradient(135deg, #DC2626, #B91C1C)', border: 'none', boxShadow: '0 4px 14px rgba(220,38,38,0.2)' }}
                      >
                        Wipe All System Data
                      </Btn>
                    </div>

                  </div>
                </div>

                {/* Left/Right Split: Live Activity Feed vs Recent Registrations */}
                <div style={{ display:'grid', gridTemplateColumns:'7fr 5fr', gap:16, alignItems:'start' }}>
                  
                  {/* Real-time System Audit Trails */}
                  <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, overflow:'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ display:'inline-flex', color:'#14B8A6' }}><IconActivity /></span>
                        <div>
                          <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>Live Database Activity Monitor</div>
                          <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:1 }}>Synchronized multi-table events</div>
                        </div>
                      </div>
                      <Btn onClick={loadActivities} style={{ padding:'4px 10px', fontSize:10 }}>↻ Poll Streams</Btn>
                    </div>
                    
                    <div style={{ padding: '16px', display:'flex', flexDirection:'column', gap:10, maxHeight:400, overflowY:'auto' }}>
                      {actLoading ? (
                        <div style={{ padding:40, textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:12 }}>Syncing activity stream buffers…</div>
                      ) : activities.length === 0 ? (
                        <div style={{ padding:40, textAlign:'center', color:'rgba(255,255,255,0.2)', fontSize:12 }}>No platform entries found.</div>
                      ) : activities.map((act, idx) => (
                        <div key={idx} style={{ display:'flex', gap:14, background:'rgba(255,255,255,0.01)', border:'1px solid rgba(255,255,255,0.03)', padding:'10px 14px', borderRadius:12 }}>
                          <span style={{ fontSize:16, background:'rgba(255,255,255,0.03)', width:30, height:30, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid rgba(255,255,255,0.05)' }}>
                            {act.type === 'signup' ? '👤' : act.type === 'athlete' ? '🏃' : '🏟️'}
                          </span>
                          <div style={{ flex:1 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{act.title}</span>
                              <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)', fontWeight:600 }}>{act.time.toLocaleTimeString()}</span>
                            </div>
                            <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:2, lineHeight:1.4 }}>{act.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Registrations review quick actions */}
                  <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, overflow:'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>Awaiting Provisioning</div>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:1 }}>Registered accounts needing dashboard access</div>
                    </div>
                    <div style={{ maxHeight:400, overflowY:'auto' }}>
                      {profiles.filter(p=>p.registration_status==='pending_email_verification'||p.registration_status==='pending').length === 0 ? (
                        <div style={{ padding:48, textAlign:'center', color:'rgba(255,255,255,0.2)', fontSize:12 }}>
                          <span style={{ fontSize:22, display:'block', marginBottom:8 }}>✓</span>
                          All signups are currently approved
                        </div>
                      ) : profiles.filter(p=>p.registration_status==='pending_email_verification'||p.registration_status==='pending').slice(0, 6).map((p) => (
                        <div key={p.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 18px', borderBottom:'1px solid rgba(255,255,255,0.04)', transition:'background 0.15s' }}
                          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.015)'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <ClubLogo url={p.club_logo_url} name={p.full_name} size={34}/>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:800, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.full_name}</div>
                            <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.club_name||p.email}</div>
                          </div>
                          <Btn onClick={()=>{ openReview(p); setSection('users') }} style={{ padding:'5px 10px', fontSize:10 }}>Review</Btn>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Bottom platform technical blueprint metadata */}
                <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding:'20px' }}>
                  <div style={{ fontSize:13, fontWeight:800, color:'#fff', marginBottom:14 }}>Platform Architecture Blueprint</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
                    {[
                      ['Active Architecture Version', 'AthleteHub FOS v2.4 (Lagoon Theme)'],
                      ['Cloud Hosting Engine', 'Supabase Cloud Core (PostgreSQL)'],
                      ['Framework Compilation', 'Next.js 16.2.1 Turbopack Enabled'],
                      ['Security Gateway Access', 'Club-scoped Row Level Security (RLS)'],
                      ['Platform System Email', 'Resend API Integration via Welcome Node'],
                      ['Active Superadmin Gateway', 'samuelwobil11@gmail.com'],
                    ].map(([blueprintLabel, blueprintValue]) => (
                      <div key={blueprintLabel} style={{ background:'rgba(255,255,255,0.015)', border:'1px solid rgba(255,255,255,0.03)', padding:'10px 14px', borderRadius:10 }}>
                        <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{blueprintLabel}</div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', fontWeight:600 }}>{blueprintValue}</div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* ── REGISTERED USERS MANAGEMENT (USERS) ── */}
            {section==='users' && (
              <div style={{ animation:'fadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)', display:'flex', flexDirection:'column', gap:16 }}>
                
                {/* Search filters and controls */}
                <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', gap:10, flex:1, minWidth:260 }}>
                    <div style={{ position:'relative', flex:1 }}>
                      <input style={{ ...INP, paddingLeft:36, height:38 }} placeholder="Search admin name, email, or club..." value={search} onChange={e=>setSearch(e.target.value)}/>
                      <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.25)', fontSize:12 }}>🔍</span>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    {['all','pending','approved','rejected'].map(f => (
                      <Btn key={f} onClick={()=>setFilter(f)} style={{
                        padding:'6px 14px',
                        background: filter===f ? 'rgba(20,184,166,0.15)' : 'rgba(255,255,255,0.03)',
                        color: filter===f ? '#14B8A6' : 'rgba(255,255,255,0.4)',
                        border: filter===f ? '1px solid rgba(20,184,166,0.25)' : '1px solid rgba(255,255,255,0.06)',
                        textTransform:'capitalize',
                      }}>
                        {f} <span style={{ opacity:0.5, fontSize:10, marginLeft:2 }}>({f==='all'?stats.total : f==='pending'?stats.pending : stats[f]||0})</span>
                      </Btn>
                    ))}
                  </div>
                </div>

                {/* Table of user listings */}
                <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, overflow:'hidden' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ background:'rgba(255,255,255,0.015)' }}>
                        {['Administrator Account / Club','Email Contact Info','Account Role','Provision Status','App Access','Action Center'].map(h=>(
                          <th key={h} style={{ padding:'14px 20px', fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.08em', textAlign:'left', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={6} style={{ padding:60, textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:12 }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                            <div style={{ width:18, height:18, border:'2px solid rgba(20,184,166,0.1)', borderTopColor:'#14B8A6', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
                            Fetching tenant data...
                          </div>
                        </td></tr>
                      ) : filtered.length===0 ? (
                        <tr><td colSpan={6} style={{ padding:60, textAlign:'center', color:'rgba(255,255,255,0.2)', fontSize:12 }}>No accounts matching search guidelines were found.</td></tr>
                      ) : filtered.map((p) => (
                        <tr key={p.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                          
                          {/* Admin Details */}
                          <td style={{ padding:'14px 20px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                              <ClubLogo url={p.club_logo_url} name={p.full_name} size={36}/>
                              <div>
                                <div style={{ fontWeight:800, color:'#fff', fontSize:13 }}>{p.full_name}</div>
                                <div style={{ fontSize:11, color:'rgba(20,184,166,0.8)', fontWeight:600, marginTop:2 }}>{p.club_name||'Individual Tenant'}</div>
                              </div>
                            </div>
                          </td>

                          {/* Email info */}
                          <td style={{ padding:'14px 20px', fontSize:12, color:'rgba(255,255,255,0.45)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span>{p.email}</span>
                              <button onClick={()=>{ navigator.clipboard.writeText(p.email); showToast('Email copied to clipboard') }}
                                style={{ background:'transparent', border:'none', color:'rgba(255,255,255,0.2)', cursor:'pointer', padding:'2px', transition:'color 0.1s' }}
                                onMouseEnter={e=>e.currentTarget.style.color='#14B8A6'}
                                onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.2)'}
                                title="Copy Email">
                                <IconCopy />
                              </button>
                            </div>
                          </td>

                          {/* Platform role */}
                          <td style={{ padding:'14px 20px' }}>
                            <span style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', color:'#14B8A6', background:'rgba(20,184,166,0.08)', padding:'4px 10px', borderRadius:6, border:'1px solid rgba(20,184,166,0.15)', letterSpacing:'0.04em' }}>{p.role||'admin'}</span>
                          </td>

                          {/* Provision status */}
                          <td style={{ padding:'14px 20px' }}><Pill status={p.registration_status||'pending'}/></td>

                          {/* Active / Inactive switch */}
                          <td style={{ padding:'14px 20px' }}>
                            <Btn onClick={()=>toggleActive(p)} variant={p.is_active ? 'success' : 'danger'} style={{ fontSize:10, padding:'4px 10px', borderRadius:6 }}>
                              {p.is_active ? '● Active' : '○ Locked'}
                            </Btn>
                          </td>

                          {/* Action triggers */}
                          <td style={{ padding:'14px 20px' }}>
                            <div style={{ display:'flex', gap:6 }}>
                              <Btn onClick={()=>openReview(p)} style={{ padding:'4px 10px', fontSize:11, borderRadius:6 }}>Review</Btn>
                              <Btn onClick={()=>handleDelete(p)} variant="danger" style={{ padding:'4px 10px', fontSize:11, borderRadius:6 }}>Delete</Btn>
                            </div>
                          </td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {/* ── REGISTERED FRANCHISE CLUBS (CLUBS) ── */}
            {section==='clubs' && (
              <div style={{ animation:'fadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)', display:'flex', flexDirection:'column', gap:16 }}>
                
                {/* List of active club tenants */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:16 }}>
                  {teams.length === 0 ? (
                    <div style={{ gridColumn:'1/-1', padding:60, textAlign:'center', color:'rgba(255,255,255,0.2)', fontSize:12 }}>No clubs registered on AthleteHub system databases yet.</div>
                  ) : teams.map(t => {
                    const admin = profiles.find(p=>p.team_id===t.id && p.role==='admin')
                    return (
                      <div key={t.id} style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: '20px', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
                        onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(20,184,166,0.35)'; e.currentTarget.style.boxShadow='0 10px 24px rgba(0,0,0,0.3)' }}
                        onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow='none' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
                          <ClubLogo url={t.logo_url} name={t.name} size={48}/>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize:15, fontWeight:800, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</div>
                            <div style={{ fontSize:11, color:'rgba(20,184,166,0.8)', fontFamily:'monospace', marginTop:2, fontWeight:700 }}>Shortcode: {t.short_name}</div>
                          </div>
                        </div>
                        <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:14, display:'flex', flexDirection:'column', gap:8 }}>
                          {[
                            ['System Admin', admin?.full_name || 'Unassigned'],
                            ['Admin Email', admin?.email || 'Unassigned'],
                            ['Data Status', admin?.registration_status ? String(admin.registration_status).toUpperCase() : 'N/A'],
                            ['Franchise ID', t.id?.slice(0,18)+'…'],
                          ].map(([k,v])=>(
                            <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <span style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em' }}>{k}</span>
                              <span style={{ fontSize:11, color: k==='System Admin' ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight:600, fontFamily: k==='Franchise ID'?'monospace':'inherit', maxWidth:170, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</span>
                            </div>
                          ))}
                        </div>
                        {admin && (
                          <div style={{ marginTop:16, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                            <Btn onClick={()=>{ openReview(admin); setSection('users') }} style={{ width:'100%', padding:'7px', textAlign:'center', borderRadius:8 }}>
                              Edit Admin Credentials ➔
                            </Btn>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

              </div>
            )}

            {/* ── POSTGRESQL RUNTIME STUDIO (DATABASE) ── */}
            {section==='database' && (
              <div style={{ animation:'fadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)', display:'flex', flexDirection:'column', gap:16 }}>
                
                {/* Visual table selector */}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                  <span style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.08em', marginRight:8 }}>Select Schema Table:</span>
                  {TABLES.map(t => (
                    <Btn key={t} onClick={()=>setDbTable(t)} style={{
                      fontFamily:'monospace', fontSize:11, padding:'6px 12px', borderRadius:6,
                      background: dbTable===t ? 'rgba(20,184,166,0.15)' : 'rgba(255,255,255,0.03)',
                      color: dbTable===t ? '#14B8A6' : 'rgba(255,255,255,0.4)',
                      border: dbTable===t ? '1px solid rgba(20,184,166,0.25)' : '1px solid rgba(255,255,255,0.06)',
                    }}>{t}</Btn>
                  ))}
                </div>

                {/* Database grid panel */}
                <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, overflow:'hidden' }}>
                  <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,0.015)' }}>
                    <span style={{ fontSize:12, fontWeight:800, color:'#fff', fontFamily:'monospace', display:'inline-flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:'#14B8A6' }}/>
                      public.{dbTable}
                    </span>
                    <Btn onClick={()=>loadTable(dbTable)} style={{ padding:'4px 12px', fontSize:10 }}>↻ Reload Workspace</Btn>
                  </div>
                  {dbLoading ? (
                    <div style={{ padding:60, textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:12 }}>Parsing query outputs...</div>
                  ) : dbRows.length===0 ? (
                    <div style={{ padding:60, textAlign:'center', color:'rgba(255,255,255,0.2)', fontSize:12 }}>No columns accessible or table contains no active datasets.</div>
                  ) : (
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ background:'rgba(255,255,255,0.01)' }}>
                            {dbCols.map(c=>(
                              <th key={c} style={{ padding:'10px 14px', fontSize:9, fontWeight:800, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left', borderBottom:'1px solid rgba(255,255,255,0.05)', fontFamily:'monospace' }}>{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dbRows.map((row,i) => (
                            <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.02)' }}>
                              {dbCols.map(c => (
                                <td key={c} style={{ padding:'10px 14px', fontSize:11, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily: c==='id'||c?.endsWith('_id')?'monospace':'inherit', color: row[c]===null ? 'rgba(255,255,255,0.15)' : c==='id'||c?.endsWith('_id') ? '#14B8A6' : 'rgba(255,255,255,0.6)' }}>
                                  {row[c]===null ? <span style={{ fontStyle:'italic', color:'rgba(255,255,255,0.15)' }}>null</span> : String(row[c]).startsWith('data:') ? <span style={{ color:'rgba(20,184,166,0.3)', fontStyle:'italic' }}>[binary base64]</span> : String(row[c])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Monospaced SQL Editor console */}
                <div style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, overflow:'hidden' }}>
                  <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.015)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:13 }}>💻</span>
                      <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>PostgreSQL SQL Sandbox Console</span>
                      <span style={{ fontSize:10, color:'rgba(255,255,255,0.25)', marginLeft:6 }}>Direct read queries via rpc</span>
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      {[
                        ['Admins', 'SELECT * FROM profiles LIMIT 10;'],
                        ['Athletes', 'SELECT * FROM athletes LIMIT 10;'],
                        ['Clubs', 'SELECT * FROM teams LIMIT 10;'],
                      ].map(([sLabel, sQuery]) => (
                        <button key={sLabel} onClick={()=>setSqlQuery(sQuery)}
                          style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:4, padding:'2px 8px', fontSize:9, color:'rgba(255,255,255,0.4)', fontFamily:'monospace', cursor:'pointer', transition:'all 0.1s' }}
                          onMouseEnter={e=>{e.currentTarget.style.color='#14B8A6'; e.currentTarget.style.borderColor='rgba(20,184,166,0.3)'}}
                          onMouseLeave={e=>{e.currentTarget.style.color='rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'}}>
                          {sLabel}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding:20 }}>
                    <textarea value={sqlQuery} onChange={e=>setSqlQuery(e.target.value)} rows={4}
                      style={{ width:'100%', fontFamily:'"JetBrains Mono", monospace', fontSize:12, padding:'14px', background:'rgba(3,7,18,0.6)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, outline:'none', color:'#14B8A6', resize:'vertical', lineHeight:1.5 }} />
                    <div style={{ display:'flex', gap:8, marginTop:12 }}>
                      <Btn variant="primary" style={{ padding:'8px 20px' }} onClick={async()=>{
                        setSqlError(''); setSqlResult(null)
                        const { data, error } = await supabase.rpc('run_sql', { query: sqlQuery }).catch(()=>({ error:{ message:'RPC run_sql restriction or permission denied' } }))
                        if (error) setSqlError(error.message); else setSqlResult(data)
                      }}>
                        <span>▶ Execute Query</span>
                      </Btn>
                      <Btn onClick={()=>setSqlQuery('SELECT * FROM profiles LIMIT 50;')}>Reset Sandbox</Btn>
                    </div>
                    {sqlError && <div style={{ marginTop:14, padding:'12px 16px', background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:10, fontSize:12, color:'#F87171', fontFamily:'"JetBrains Mono", monospace' }}>⚠️ Runtime Failure: {sqlError}</div>}
                    {sqlResult && (
                      <div style={{ marginTop:14 }}>
                        <div style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Returned Dataset JSON Output</div>
                        <pre style={{ padding:'14px', background:'rgba(3,7,18,0.6)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, fontSize:11, color:'#6EE7B7', overflow:'auto', maxHeight:300, fontFamily:'"JetBrains Mono", monospace', lineHeight:1.5 }}>{JSON.stringify(sqlResult, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* ── EDGE FUNCTIONS GATEWAY (FUNCTIONS) ── */}
            {section==='functions' && (
              <div style={{ animation:'fadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)', display:'flex', flexDirection:'column', gap:16 }}>
                
                {/* Node edge functions */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:16 }}>
                  {[
                    { name:'notify-registration', trigger:'Profiles DB insert hook', desc:'Monitors database registration events on user profiles. Sends automated webhook triggers containing sign-up payloads directly to platform operators.', status:'deployed', color:'#A78BFA' },
                    { name:'send-welcome',        trigger:'Direct gateway RPC trigger',  desc:'Initiates the Resend email integration mechanism to deliver administrative login paths, security tokens, and setup walkthrough steps directly to approved clients.', status:'deployed', color:'#10B981' },
                  ].map(f => (
                    <div key={f.name} style={{ background: '#0b1329', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: '24px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position:'absolute', top:0, right:0, width:140, height:140, borderRadius:'50%', background:`${f.color}05`, filter:'blur(20px)', transform:'translate(30%,-30%)' }} />
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
                        <div>
                          <div style={{ fontSize:15, fontWeight:900, color:'#fff', fontFamily:'monospace', marginBottom:6 }}>{f.name}</div>
                          <span style={{ display:'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(16,185,129,0.1)', color: '#10B981', borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 700, border: '1px solid rgba(16,185,129,0.15)' }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }} />
                            Deployed Stable
                          </span>
                        </div>
                        <span style={{ fontSize:28, opacity:0.6 }}>⚙️</span>
                      </div>
                      <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', lineHeight:1.6, marginBottom:16 }}>{f.desc}</div>
                      <div style={{ background:'rgba(3,7,18,0.4)', borderRadius:10, padding:'10px 14px', fontSize:11, fontFamily:'monospace', color:'rgba(20,184,166,0.8)', border:'1px solid rgba(255,255,255,0.03)', marginBottom:20 }}>
                        <span style={{ color:'rgba(255,255,255,0.3)', marginRight:6 }}>Endpoint Path:</span>
                        supabase/v1/{f.name}
                      </div>
                      <Btn style={{ width:'100%', padding:'10px', borderRadius:8 }} onClick={async()=>{
                        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${f.name}`
                        const r = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` }, body:JSON.stringify({test:true, ping_time: new Date().toISOString()}) }).catch(()=>({ ok:false, status:'Connection Timeout' }))
                        showToast(r.ok ? `✅ ${f.name} replied status 200 OK` : `❌ Node deployment check failed`, r.ok?'success':'error')
                      }}>
                        <span>▶ Trigger Diagnostics Ping</span>
                      </Btn>
                    </div>
                  ))}
                </div>

              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── ACCOUNT PROVISION REVIEW MODAL ── */}
      {selected && (
        <div style={{ position:'fixed', inset:0, background:'rgba(3,7,18,0.85)', backdropFilter:'blur(16px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:20, animation:'fadeUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
          onClick={e=>{ if(e.target===e.currentTarget) setSelected(null) }}>
          <div style={{ background: '#0b1329', border: '1px solid rgba(20,184,166,0.15)', borderRadius: 24, width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,0.7)' }}>
            
            {/* Modal header */}
            <div style={{ background: 'rgba(255,255,255,0.01)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <ClubLogo url={selected.club_logo_url} name={selected.full_name} size={42}/>
                <div>
                  <div style={{ fontSize:10, color:'#14B8A6', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:2 }}>Audit Panel</div>
                  <div style={{ fontSize:16, fontWeight:800, color:'#fff' }}>{selected.full_name}</div>
                </div>
              </div>
              <button onClick={()=>setSelected(null)} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', width:32, height:32, borderRadius:'50%', fontSize:16, cursor:'pointer', color:'rgba(255,255,255,0.4)', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
            
            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:18 }}>
              
              {/* Profile info cards */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  ['Franchise Organisation', selected.club_name||'Individual Developer'],
                  ['Security Identifier', selected.id?.slice(0,18)+'…'],
                  ['Mailbox Contact', selected.email],
                  ['Account Role', selected.role||'admin'],
                  ['Gateway Access', selected.is_active ? 'Unblocked' : 'Blocked'],
                  ['Signup Stamp', new Date(selected.created_at).toLocaleDateString()],
                ].map(([k,v])=>(
                  <div key={k} style={{ background:'rgba(255,255,255,0.015)', border:'1px solid rgba(255,255,255,0.04)', borderRadius:12, padding:'10px 12px' }}>
                    <div style={{ fontSize:9, fontWeight:800, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{k}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:'#fff', wordBreak:'break-all' }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Logo uploads dropzone */}
              <div>
                <label style={LBL}>Franchise Logo / Brand Emblem</label>
                <div style={{ display:'flex', alignItems:'center', gap:14, background:'rgba(255,255,255,0.01)', border:'1px dashed rgba(255,255,255,0.08)', padding:16, borderRadius:14 }}>
                  <div style={{ width:60, height:60, borderRadius:12, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {logoPreview && !logoPreview.startsWith('data:')
                      ? <img src={logoPreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                      : <span style={{ fontSize:22 }}>🏟️</span>}
                  </div>
                  <div style={{ flex:1 }}>
                    <label htmlFor="review-logo" style={{ display:'inline-flex', background:'rgba(20,184,166,0.12)', color:'#14B8A6', border:'1px solid rgba(20,184,166,0.2)', padding:'6px 12px', borderRadius:6, fontSize:11, fontWeight:800, cursor:'pointer', marginBottom:6 }}
                      className="hover-trigger">
                      {logoUploading ? 'Uploading emblem…' : 'Upload Brand Emblem'}
                    </label>
                    <input id="review-logo" type="file" accept="image/*" style={{ display:'none' }} onChange={handleLogoFile}/>
                    <input value={logoUrl} onChange={e=>{ setLogoUrl(e.target.value); setLogoPreview(e.target.value) }} placeholder="or paste absolute brand logo URL" style={{ ...INP, fontSize:11, height:32 }}/>
                  </div>
                </div>
              </div>

              {/* Rejection input controls */}
              {selected.registration_status!=='approved' && (
                <div>
                  <label style={{ ...LBL, color:'#F87171' }}>Verification Declination Reason</label>
                  <textarea value={rejReason} onChange={e=>setRejReason(e.target.value)} rows={2}
                    placeholder="Provide a decline justification reasoning (required to reject)."
                    style={{ ...INP, resize:'none' }}/>
                </div>
              )}

              {/* Actions row triggers */}
              <div style={{ display:'flex', gap:8, borderTop:'1px solid rgba(255,255,255,0.04)', paddingTop:16 }}>
                <Btn onClick={()=>setSelected(null)} style={{ flex:1 }}>Dismiss</Btn>
                {selected.registration_status!=='rejected' && (
                  <Btn variant="danger" onClick={handleReject} disabled={acting} style={{ flex:1 }}>Decline</Btn>
                )}
                <Btn variant="primary" onClick={handleApprove} disabled={acting||logoUploading} style={{ flex:2 }}>
                  {acting ? 'Processing…' : selected.registration_status==='approved' ? '✓ Update Metadata' : '✅ Approve & Provision'}
                </Btn>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── PROVISION NEW TENANT ADMIN MODAL ── */}
      {addModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(3,7,18,0.85)', backdropFilter:'blur(16px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:20, animation:'fadeUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
          onClick={e=>{ if(e.target===e.currentTarget) setAddModal(false) }}>
          <div style={{ background: '#0b1329', border: '1px solid rgba(20,184,166,0.15)', borderRadius: 24, width: '100%', maxWidth: 460, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,0.7)' }}>
            
            {/* Header */}
            <div style={{ background: 'rgba(255,255,255,0.01)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <div style={{ fontSize:10, color:'#14B8A6', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:2 }}>Security Portal</div>
                <div style={{ fontSize:16, fontWeight:800, color:'#fff' }}>Provision Franchise Space</div>
              </div>
              <button onClick={()=>setAddModal(false)} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', width:32, height:32, borderRadius:'50%', fontSize:16, cursor:'pointer', color:'rgba(255,255,255,0.4)', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
            
            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:14 }}>
              <div><label style={LBL}>Franchisee Administrator Name</label><input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Kwame Osei" style={INP}/></div>
              <div><label style={LBL}>Franchise Organization Name</label><input value={newClub} onChange={e=>setNewClub(e.target.value)} placeholder="e.g. Asante Kotoko SC" style={INP}/></div>
              <div><label style={LBL}>Communication Mailbox Address</label><input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="e.g. admin@club.com" style={INP}/></div>
              <div><label style={LBL}>Dashboard Access Security Key (min 8 chars)</label><input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="••••••••" style={INP}/></div>
              <div>
                <label style={LBL}>Organisation Brand Emblem</label>
                <div style={{ display:'flex', alignItems:'center', gap:14, background:'rgba(255,255,255,0.01)', border:'1px dashed rgba(255,255,255,0.08)', padding:14, borderRadius:12 }}>
                  <div style={{ width:56, height:56, borderRadius:10, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {newLogoPreview && !newLogoPreview.startsWith('data:')
                      ? <img src={newLogoPreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                      : <span style={{ fontSize:20 }}>🏟️</span>}
                  </div>
                  <div style={{ flex:1 }}>
                    <label htmlFor="new-admin-logo" style={{ display:'inline-flex', background:'rgba(20,184,166,0.12)', color:'#14B8A6', border:'1px solid rgba(20,184,166,0.2)', padding:'5px 12px', borderRadius:6, fontSize:11, fontWeight:800, cursor:'pointer', marginBottom:6 }}
                      className="hover-trigger">
                      {newLogoPreview && !newLogoPreview.startsWith('data:') ? 'Change Emblem' : 'Upload Emblem'}
                    </label>
                    <input id="new-admin-logo" type="file" accept="image/*" style={{ display:'none' }}
                      onChange={e=>{ const f=e.target.files[0]; if(!f) return; setNewLogoFile(f); setNewLogoPreview(URL.createObjectURL(f)); setNewLogoUrl('') }}/>
                    <input value={newLogoUrl} onChange={e=>{ setNewLogoUrl(e.target.value); setNewLogoPreview(e.target.value); setNewLogoFile(null) }} placeholder="or paste absolute brand logo URL" style={{ ...INP, fontSize:11, height:32 }}/>
                  </div>
                </div>
              </div>
              <div style={{ background:'rgba(20,184,166,0.06)', border:'1px solid rgba(20,184,166,0.15)', borderRadius:10, padding:'12px 14px', fontSize:11, color:'rgba(20,184,166,0.85)', lineHeight:1.5 }}>
                ⚙️ Admin workspace will be **instantly unblocked & provisioned**. DB space UUID, Resend welcome protocols, and a **30-day trial subscription** are configured automatically.
              </div>
              <div style={{ display:'flex', gap:8, borderTop:'1px solid rgba(255,255,255,0.04)', paddingTop:14 }}>
                <Btn onClick={()=>setAddModal(false)} style={{ flex:1 }}>Cancel</Btn>
                <Btn variant="primary" onClick={handleAddAdmin} disabled={addingAdmin} style={{ flex:2 }}>
                  {addingAdmin ? 'Provisioning workspace…' : '✅ Provision space & Admin'}
                </Btn>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── NUCLEAR CLEANUP MODAL ── */}
      {clearAllModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(3,7,18,0.92)', backdropFilter:'blur(20px)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:20, animation:'fadeUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
          onClick={e=>{ if(e.target===e.currentTarget) { setClearAllModal(false); setConfirmClearAllText('') } }}>
          <div style={{ background: '#0b1329', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 24, width: '100%', maxWidth: 440, margin: 'auto', boxShadow: '0 24px 70px rgba(0,0,0,0.8)' }}>
            
            {/* Header */}
            <div style={{ background: 'rgba(255,255,255,0.01)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <div style={{ fontSize:10, color:'#EF4444', fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:2 }}>Critical Operation</div>
                <div style={{ fontSize:16, fontWeight:800, color:'#fff' }}>Nuclear Data Wipe</div>
              </div>
              <button onClick={()=>{ setClearAllModal(false); setConfirmClearAllText('') }} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', width:32, height:32, borderRadius:'50%', fontSize:16, cursor:'pointer', color:'rgba(255,255,255,0.4)', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
            
            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:12, padding:'14px', fontSize:12, color:'#F87171', lineHeight:1.5 }}>
                ⚠️ <strong>WARNING:</strong> This action will delete all teams, athletes, coaches, contracts, training logs, injuries, and subscriptions. It will also delete all user accounts from Supabase Auth except yours. <strong>This cannot be undone.</strong>
              </div>
              
              <div>
                <label style={LBL}>Type <strong>CONFIRM CLEAR ALL</strong> to verify</label>
                <input 
                  value={confirmClearAllText} 
                  onChange={e=>setConfirmClearAllText(e.target.value)} 
                  placeholder="Type here..." 
                  style={{ ...INP, borderColor: confirmClearAllText==='CONFIRM CLEAR ALL'?'rgba(16,185,129,0.4)':'rgba(239,68,68,0.2)' }}
                />
              </div>

              <div style={{ display:'flex', gap:8, borderTop:'1px solid rgba(255,255,255,0.04)', paddingTop:14 }}>
                <Btn onClick={()=>{ setClearAllModal(false); setConfirmClearAllText('') }} style={{ flex:1 }}>Cancel</Btn>
                <Btn 
                  variant="danger" 
                  onClick={handleClearAll} 
                  disabled={clearingAll || confirmClearAllText !== 'CONFIRM CLEAR ALL'} 
                  style={{ flex:2, background: confirmClearAllText === 'CONFIRM CLEAR ALL' ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'rgba(255,255,255,0.03)' }}
                >
                  {clearingAll ? 'Wiping System...' : '☢️ Execute Wipe'}
                </Btn>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  )
}