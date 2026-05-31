'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── MINIMALIST ACCENT ICONS ──
const IconUsers = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const IconClubs = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10v6" />
    <path d="M6 10h12" />
    <path d="M12 22V2M12 2l10 8H2L12 2z" />
  </svg>
)

const IconMaintenance = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
)

const TABLES = ['profiles', 'athletes', 'teams', 'contracts', 'injuries', 'transfers', 'subscriptions']

const STATUS_META = {
  pending: { bg: 'hsla(38, 92%, 50%, 0.12)', color: '#F59E0B', label: 'Pending' },
  pending_email_verification: { bg: 'hsla(217, 91%, 60%, 0.12)', color: '#3B82F6', label: 'Verify Email' },
  approved: { bg: 'hsla(142, 71%, 45%, 0.12)', color: '#10B981', label: 'Approved' },
  rejected: { bg: 'hsla(0, 84%, 60%, 0.12)', color: '#EF4444', label: 'Rejected' },
}

function Pill({ status }) {
  const s = STATUS_META[status?.toLowerCase()] || STATUS_META.pending
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: s.bg, color: s.color, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700, border: `1px solid ${s.color}25` }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  )
}

function Avatar({ name, size = 32 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg, #0f172a, #1e293b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: '#94a3b8', border: '1px solid rgba(255,255,255,0.06)' }}>
      {initials}
    </div>
  )
}

function ClubLogo({ url, name, size = 32 }) {
  const [err, setErr] = useState(false)
  const isValidUrl = url && !url.startsWith('data:') && !url.startsWith('blob:') && !err
  if (isValidUrl) return <img src={url} alt={name} onError={() => setErr(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.08)' }} />
  return <Avatar name={name} size={size} />
}

function Toast({ toast }) {
  if (!toast) return null
  const isErr = toast.type === 'error'
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: isErr ? '#1c0e0e' : '#071b15', color: isErr ? '#fca5a5' : '#6ee7b7', padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', maxWidth: 360, border: `1px solid ${isErr ? '#ef444430' : '#10b98130'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: isErr ? '#ef4444' : '#10b981' }}>{isErr ? '⚠️' : '✓'}</span>
      <span>{toast.msg}</span>
    </div>
  )
}

function Btn({ onClick, children, style = {}, disabled = false, variant = 'default' }) {
  const bases = {
    default: { background: 'rgba(255,255,255,0.04)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.06)' },
    primary: { background: 'linear-gradient(135deg, #14b8a6, #0d9488)', color: '#fff', border: 'none' },
    danger: { background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' },
    success: { background: 'rgba(16,185,129,0.1)', color: '#a7f3d0', border: '1px solid rgba(16,185,129,0.2)' },
  }
  const base = bases[variant] || bases.default
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...base, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s ease', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, ...style }}
      className="btn-hover">
      {children}
    </button>
  )
}

export default function SuperadminPage() {
  const router = useRouter()
  const [authOk, setAuthOk] = useState(false)
  const [section, setSection] = useState('users') // 'users' | 'clubs' | 'maintenance'
  const [profiles, setProfiles] = useState([])
  const [teams, setTeams] = useState([])
  
  // Database browse states
  const [dbRows, setDbRows] = useState([])
  const [dbCols, setDbCols] = useState([])
  const [dbTable, setDbTable] = useState('profiles')
  const [dbLoading, setDbLoading] = useState(false)

  // Filtering states
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [acting, setActing] = useState(false)
  const [selected, setSelected] = useState(null)
  
  // Custom delete inputs
  const [targetUserId, setTargetUserId] = useState('')
  const [deletingUserById, setDeletingUserById] = useState(false)
  const [targetTeamId, setTargetTeamId] = useState('')
  const [deletingTeamById, setDeletingTeamById] = useState(false)

  // Maintenance states
  const [selectedClearTable, setSelectedClearTable] = useState('athletes')
  const [clearingTable, setClearingTable] = useState(false)
  const [clearingAll, setClearingAll] = useState(false)

  // Provision modal states
  const [addModal, setAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newClub, setNewClub] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)

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
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
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
      setProfiles(data.profiles || [])
    } catch (err) {
      console.error(err)
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
      console.error(err)
    }
  }, [fetchWithAuth])

  const loadTable = useCallback(async (tbl) => {
    setDbLoading(true)
    setDbRows([])
    setDbCols([])
    try {
      const data = await fetchWithAuth(`/api/admin/superadmin-data?table=${tbl}`)
      if (data?.data?.length) {
        setDbCols(Object.keys(data.data[0]))
        setDbRows(data.data)
      }
    } catch (err) {
      showToast('Failed to load table: ' + err.message, 'error')
    } finally {
      setDbLoading(false)
    }
  }, [fetchWithAuth])

  useEffect(() => {
    if (authOk) {
      loadProfiles()
      loadTeams()
    }
  }, [authOk, loadProfiles, loadTeams])

  useEffect(() => {
    if (authOk && section === 'maintenance') {
      loadTable(dbTable)
    }
  }, [authOk, section, dbTable, loadTable])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleApprove(p) {
    setActing(true)
    try {
      let teamId = null
      if (p.club_name) {
        const { data: existingTeam } = await supabase.from('teams').select('id').ilike('name', p.club_name.trim()).maybeSingle()
        if (existingTeam?.id) {
          teamId = existingTeam.id
        } else {
          const { data: newTeam, error: teamError } = await supabase.from('teams').insert([{
            name: p.club_name.trim(),
            short_name: p.club_name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4),
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
      
      const { error } = await supabase.from('profiles').update({ is_active: true, registration_status: 'approved', approved_at: new Date().toISOString(), team_id: teamId }).eq('id', p.id)
      if (error) throw error

      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        await fetch('/api/admin/confirm-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ user_id: p.id }),
        })
      }

      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          full_name: p.full_name,
          email: p.email,
          club_name: p.club_name,
          app_url: window.location.origin,
        }),
      })
      showToast('Approved administrator and team provisioned successfully!')
      setSelected(null); loadProfiles(); loadTeams()
    } catch (err) {
      showToast('Approval failed: ' + err.message, 'error')
    } finally {
      setActing(false)
    }
  }

  async function handleReject(p) {
    const reason = prompt('Please enter a rejection reason:')
    if (reason === null) return
    if (!reason.trim()) { showToast('A rejection reason is required.', 'error'); return }
    setActing(true)
    try {
      const { error } = await supabase.from('profiles').update({ registration_status: 'rejected', is_active: false, rejection_reason: reason.trim() }).eq('id', p.id)
      if (error) throw error
      showToast('Profile registration rejected.')
      loadProfiles()
    } catch (err) {
      showToast('Rejection failed: ' + err.message, 'error')
    } finally {
      setActing(false)
    }
  }

  async function toggleActive(p) {
    await supabase.from('profiles').update({ is_active: !p.is_active }).eq('id', p.id)
    showToast(`${p.full_name} has been ${!p.is_active ? 'activated' : 'deactivated'}`)
    loadProfiles()
  }

  async function handleDeleteUser(p) {
    if (!confirm(`Are you absolutely sure you want to delete ${p.full_name}? This will permanently wipe their account and profile.`)) return
    setActing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/system-commands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ command: 'delete_user', userId: p.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete user')
      showToast(`User ${p.full_name} deleted successfully.`)
      loadProfiles()
    } catch (err) {
      showToast('Deletion failed: ' + err.message, 'error')
    } finally {
      setActing(false)
    }
  }

  async function handleDeleteUserById() {
    const trimmedId = targetUserId.trim()
    if (!trimmedId) { showToast('Please enter a valid User ID', 'error'); return }
    if (!confirm(`Are you absolutely sure you want to delete user ID "${trimmedId}"? This will permanently wipe their Auth and profile data.`)) return
    setDeletingUserById(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/system-commands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ command: 'delete_user', userId: trimmedId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete user')
      showToast(`Successfully deleted user ID: ${trimmedId}`)
      setTargetUserId('')
      loadProfiles(); loadTeams()
    } catch (err) {
      showToast('Deletion failed: ' + err.message, 'error')
    } finally {
      setDeletingUserById(false)
    }
  }

  async function handleDeleteTeamById() {
    const trimmedId = targetTeamId.trim()
    if (!trimmedId) { showToast('Please enter a valid Team ID', 'error'); return }
    if (!confirm(`CAUTION: Wiping Team ID "${trimmedId}" will delete this club and ALL its roots data (athletes, contracts, coaches, subscriptions, and profiles)! This action cannot be undone.`)) return
    setDeletingTeamById(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/system-commands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ command: 'delete_team', teamId: trimmedId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete team')
      showToast(data.message || `Wiped team ID: ${trimmedId} successfully!`)
      setTargetTeamId('')
      loadProfiles(); loadTeams()
      if (section === 'maintenance' && dbTable === 'teams') {
        loadTable('teams')
      }
    } catch (err) {
      showToast('Deletion failed: ' + err.message, 'error')
    } finally {
      setDeletingTeamById(false)
    }
  }

  async function handleClearTable(tbl) {
    if (!confirm(`Are you absolutely sure you want to clear table "${tbl}"?`)) return
    setClearingTable(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/system-commands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ command: 'clear_table', tableName: tbl })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to clear table')
      showToast(`Successfully cleared table "${tbl}"`)
      loadProfiles(); loadTeams()
      if (section === 'maintenance' && dbTable === tbl) loadTable(tbl)
    } catch (err) {
      showToast('Clear table failed: ' + err.message, 'error')
    } finally {
      setClearingTable(false)
    }
  }

  async function handleClearAll() {
    const confirmation = prompt('To wipe all system data, type "CONFIRM CLEAR ALL":')
    if (confirmation !== 'CONFIRM CLEAR ALL') {
      showToast('Confirmation mismatch. Operation cancelled.', 'error')
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
        body: JSON.stringify({ command: 'clear_all' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to clear system')
      showToast('All system records and tenant accounts cleared!')
      loadProfiles(); loadTeams()
    } catch (err) {
      showToast('Wipe failed: ' + err.message, 'error')
    } finally {
      setClearingAll(false)
    }
  }

  async function handleAddAdmin() {
    if (!newName.trim() || !newEmail.trim() || !newPassword || !newClub.trim()) {
      showToast('Please fill out all provisioning parameters.', 'error')
      return
    }
    setAddingAdmin(true)
    try {
      const checkRes = await fetch(`/api/signup-provision?club_name=${encodeURIComponent(newClub.trim())}`)
      const checkData = await checkRes.json()
      if (checkData.exists) throw new Error('A club with this name is already registered.')
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        options: {
          data: { full_name: newName.trim(), club_name: newClub.trim() },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      })
      if (authError) throw authError
      if (!authData?.user) throw new Error('User account creation failed.')

      const provRes = await fetch('/api/signup-provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: authData.user.id,
          full_name: newName.trim(),
          club_name: newClub.trim(),
          email: newEmail.trim().toLowerCase()
        }),
      })
      const provData = await provRes.json()
      if (!provRes.ok) throw new Error(provData.error || 'Provision failed')

      showToast('✅ Account provisioned — verification email sent!')
      setAddModal(false)
      setNewName('')
      setNewEmail('')
      setNewPassword('')
      setNewClub('')
      loadProfiles(); loadTeams()
    } catch (err) {
      showToast('Provisioning failed: ' + err.message, 'error')
    } finally {
      setAddingAdmin(false)
    }
  }

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase()
    const matchQ = !search || [p.full_name, p.email, p.club_name].some(v => v?.toLowerCase().includes(q))
    const matchF = filter === 'all' || p.registration_status === filter || (filter === 'pending' && p.registration_status?.startsWith('pending'))
    return matchQ && matchF
  })

  if (!authOk) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 32, height: 32, border: '2px solid rgba(20,184,166,0.1)', borderTopColor: '#14b8a6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontWeight: 600, letterSpacing: '0.1em' }}>AUTHENTICATING ACCESS…</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#020617;font-family:'Plus Jakarta Sans',sans-serif;color:#f1f5f9;overflow-x:hidden}
        
        .btn-hover:hover {
          transform: translateY(-1px);
          filter: brightness(1.1);
        }
        
        .tab-item {
          transition: all 0.2s ease;
        }
        .tab-item:hover {
          color: #f1f5f9 !important;
          background: rgba(255,255,255,0.02) !important;
        }

        .data-card {
          background: #090d16;
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 16px;
          padding: 24px;
        }

        .custom-input {
          width: 100%;
          padding: 10px 14px;
          background: rgba(2,6,23,0.6);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          font-size: 13px;
          color: #fff;
          outline: none;
          transition: all 0.15s ease;
        }
        .custom-input:focus {
          border-color: rgba(20,184,166,0.6);
          box-shadow: 0 0 0 3px rgba(20,184,166,0.1);
        }

        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.01);
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.08);
          border-radius: 99px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(20,184,166,0.3);
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <Toast toast={toast} />

      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#020617' }}>
        
        {/* Header navigation bar */}
        <header style={{ height: 72, borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', background: 'rgba(9,13,22,0.8)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #14b8a6, #0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: 14 }}>⚡</div>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                AthleteHub Superadmin
                <span style={{ fontSize: 9, background: 'rgba(20,184,166,0.1)', color: '#14b8a6', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>CORE</span>
              </h1>
              <p style={{ fontSize: 10, color: '#64748b', marginTop: 1, letterSpacing: '0.04em' }}>CENTRALIZED SYSTEM CONTROL GATEWAY</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Btn variant="primary" onClick={() => setAddModal(true)}>
              + Provision Admin
            </Btn>
            <Btn onClick={() => router.push('/dashboard')}>
              Admin Suite ➔
            </Btn>
            <Btn onClick={() => supabase.auth.signOut().then(() => router.replace('/login'))} variant="danger">
              Sign Out
            </Btn>
          </div>
        </header>

        {/* Dashboard workspace layout */}
        <div style={{ display: 'flex', flex: 1 }}>
          
          {/* Minimalist Sidebar */}
          <aside style={{ width: 220, borderRight: '1px solid rgba(255,255,255,0.04)', background: '#040810', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontSize: 9, fontWeight: 800, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 12 }}>Navigation</p>
              
              <button onClick={() => setSection('users')} className="tab-item"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', background: section === 'users' ? 'rgba(20,184,166,0.08)' : 'transparent', color: section === 'users' ? '#14b8a6' : '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                <IconUsers />
                User Accounts
              </button>

              <button onClick={() => setSection('clubs')} className="tab-item"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', background: section === 'clubs' ? 'rgba(20,184,166,0.08)' : 'transparent', color: section === 'clubs' ? '#14b8a6' : '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                <IconClubs />
                Clubs & Teams
              </button>

              <button onClick={() => setSection('maintenance')} className="tab-item"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: 'none', background: section === 'maintenance' ? 'rgba(20,184,166,0.08)' : 'transparent', color: section === 'maintenance' ? '#14b8a6' : '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                <IconMaintenance />
                Database & Roots
              </button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 10, padding: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#f1f5f9' }}>Samuel Wobil</p>
              <p style={{ fontSize: 9, color: '#475569', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>samuelwobil11@gmail.com</p>
            </div>
          </aside>

          {/* Simple Main Content Area */}
          <main style={{ flex: 1, padding: 32, overflowY: 'auto' }}>

            {/* ── USER ACCOUNTS DIRECTORY ── */}
            {section === 'users' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                
                {/* Search & Filter tools */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', width: 320 }}>
                    <input className="custom-input" placeholder="Search name, email, or club..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: 12 }}>🔍</span>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    {['all', 'pending', 'approved', 'rejected'].map(f => (
                      <Btn key={f} onClick={() => setFilter(f)} style={{
                        padding: '6px 12px',
                        background: filter === f ? 'rgba(20,184,166,0.1)' : 'transparent',
                        color: filter === f ? '#14b8a6' : '#64748b',
                        borderColor: filter === f ? 'rgba(20,184,166,0.2)' : 'rgba(255,255,255,0.04)',
                        textTransform: 'capitalize'
                      }}>
                        {f}
                      </Btn>
                    ))}
                  </div>
                </div>

                {/* Main Table Directory */}
                <div style={{ background: '#090d16', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <th style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Administrator Account</th>
                        <th style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Email Address</th>
                        <th style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Tenant Access ID</th>
                        <th style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Verification</th>
                        <th style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>App Lock</th>
                        <th style={{ padding: '14px 20px', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={6} style={{ padding: 48, textAlgin: 'center', color: '#64748b', fontSize: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                              <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.05)', borderTopColor: '#14b8a6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                              Syncing user accounts directory...
                            </div>
                          </td>
                        </tr>
                      ) : filtered.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: 48, textAlign: 'center', color: '#476282', fontSize: 12 }}>
                            No administrator accounts match the selected parameters.
                          </td>
                        </tr>
                      ) : filtered.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <ClubLogo url={p.club_logo_url} name={p.full_name} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{p.full_name}</div>
                                <div style={{ fontSize: 10, color: '#14b8a6', fontWeight: 500, marginTop: 1 }}>{p.club_name || 'Individual Club Admin'}</div>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '14px 20px', fontSize: 12, color: '#94a3b8' }}>
                            {p.email}
                          </td>

                          <td style={{ padding: '14px 20px', fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>
                            {p.id}
                          </td>

                          <td style={{ padding: '14px 20px' }}>
                            <Pill status={p.registration_status || 'pending'} />
                          </td>

                          <td style={{ padding: '14px 20px' }}>
                            <Btn onClick={() => toggleActive(p)} variant={p.is_active ? 'success' : 'danger'} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6 }}>
                              {p.is_active ? 'Unblocked' : 'Blocked'}
                            </Btn>
                          </td>

                          <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              {p.registration_status !== 'approved' && (
                                <Btn onClick={() => handleApprove(p)} variant="success" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6 }} disabled={acting}>
                                  Approve
                                </Btn>
                              )}
                              {p.registration_status !== 'rejected' && (
                                <Btn onClick={() => handleReject(p)} variant="danger" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6 }} disabled={acting}>
                                  Reject
                                </Btn>
                              )}
                              <Btn onClick={() => handleDeleteUser(p)} variant="danger" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6 }} disabled={acting}>
                                Delete
                              </Btn>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {/* ── CLUBS & FRANCHISES VIEW ── */}
            {section === 'clubs' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {teams.length === 0 ? (
                  <div style={{ gridColumn: '1/-1', padding: 48, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                    No system-provisioned clubs or teams found in databases.
                  </div>
                ) : teams.map(t => {
                  const admin = profiles.find(p => p.team_id === t.id && p.role === 'admin')
                  return (
                    <div key={t.id} className="data-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <ClubLogo url={t.logo_url} name={t.name} size={40} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                          <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>CODE: {t.short_name}</div>
                        </div>
                      </div>
                      
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[
                          ['Club Admin', admin?.full_name || 'Unassigned'],
                          ['Admin Email', admin?.email || 'Unassigned'],
                          ['Team ID', t.id?.slice(0, 18) + '…'],
                        ].map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                            <span style={{ color: '#475569', fontWeight: 600 }}>{k}</span>
                            <span style={{ color: '#94a3b8', fontWeight: 500, fontFamily: k === 'Team ID' ? 'monospace' : 'inherit' }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── DATABASE & ROOTS MAINTENANCE ── */}
            {section === 'maintenance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                
                {/* Simplified Data Wiping Utilities */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                  
                  {/* Wipe User roots by ID */}
                  <div className="data-card" style={{ border: '1px solid rgba(239,68,68,0.1)' }}>
                    <h2 style={{ fontSize: 13, fontWeight: 700, color: '#fca5a5', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>👤</span> Delete User Roots & Auth
                    </h2>
                    <p style={{ fontSize: 11, color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>
                      Purge an administrator and delete their Auth account using their User ID.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="custom-input" placeholder="Paste User UUID..." value={targetUserId} onChange={e => setTargetUserId(e.target.value)} style={{ flex: 1, fontSize: 11 }} />
                      <Btn variant="danger" onClick={handleDeleteUserById} disabled={deletingUserById}>
                        {deletingUserById ? 'Deleting...' : 'Delete'}
                      </Btn>
                    </div>
                  </div>

                  {/* Wipe Team roots by ID */}
                  <div className="data-card" style={{ border: '1px solid rgba(239,68,68,0.15)' }}>
                    <h2 style={{ fontSize: 13, fontWeight: 700, color: '#fca5a5', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>🏟️</span> Delete Team, Athletes & Roots
                    </h2>
                    <p style={{ fontSize: 11, color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>
                      Purge a team completely, including its athletes, contracts, coaches, subscriptions, and profiles by Team ID.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="custom-input" placeholder="Paste Team UUID..." value={targetTeamId} onChange={e => setTargetTeamId(e.target.value)} style={{ flex: 1, fontSize: 11 }} />
                      <Btn variant="danger" onClick={handleDeleteTeamById} disabled={deletingTeamById}>
                        {deletingTeamById ? 'Wiping...' : 'Wipe Team'}
                      </Btn>
                    </div>
                  </div>

                  {/* Wipe table maintenance & Wipe all */}
                  <div className="data-card">
                    <h2 style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⚙️</span> Table & System Cleanup
                    </h2>
                    <p style={{ fontSize: 11, color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>
                      Wipe specific table data or trigger a system-wide clean (superadmin is preserved).
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <select value={selectedClearTable} onChange={e => setSelectedClearTable(e.target.value)}
                        style={{ flex: 1, padding: '7px 12px', background: 'rgba(2,6,23,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 12, color: '#fff', outline: 'none' }}>
                        <option value="athletes">athletes</option>
                        <option value="coaches">coaches</option>
                        <option value="injuries">injuries</option>
                        <option value="contracts">contracts</option>
                        <option value="transfers">transfers</option>
                        <option value="subscriptions">subscriptions</option>
                        <option value="teams">teams</option>
                        <option value="profiles">profiles</option>
                      </select>
                      
                      <Btn variant="danger" onClick={() => handleClearTable(selectedClearTable)} disabled={clearingTable} style={{ fontSize: 11 }}>
                        {clearingTable ? 'Clearing...' : 'Clear Table'}
                      </Btn>

                      <Btn variant="danger" onClick={handleClearAll} disabled={clearingAll} style={{ fontSize: 11, background: 'rgba(220,38,38,0.2)', color: '#ef4444', border: '1px solid rgba(220,38,38,0.3)' }}>
                        Nuclear System Wipe
                      </Btn>
                    </div>
                  </div>

                </div>

                {/* Table selector & simple database browsing */}
                <div className="data-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.04em' }}>DB INSPECTOR:</span>
                      <select value={dbTable} onChange={e => setDbTable(e.target.value)}
                        style={{ padding: '4px 8px', background: 'rgba(2,6,23,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, fontSize: 12, color: '#14b8a6', outline: 'none', fontFamily: 'monospace', fontWeight: 600 }}>
                        {TABLES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <Btn onClick={() => loadTable(dbTable)} style={{ padding: '4px 10px', fontSize: 10 }}>↻ Refresh Data</Btn>
                  </div>

                  {dbLoading ? (
                    <div style={{ padding: 48, textAlign: 'center', color: '#64748b', fontSize: 12 }}>Reading database schema...</div>
                  ) : dbRows.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center', color: '#475569', fontSize: 12 }}>Table is empty or columns are unreadable.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            {dbCols.map(c => (
                              <th key={c} style={{ padding: '10px 12px', fontSize: 9, fontFamily: 'monospace', color: '#475569', textTransform: 'uppercase' }}>{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dbRows.map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                              {dbCols.map(c => (
                                <td key={c} style={{ padding: '10px 12px', fontSize: 11, fontFamily: c === 'id' || c?.endsWith('_id') ? 'monospace' : 'inherit', color: row[c] === null ? '#334155' : c === 'id' || c?.endsWith('_id') ? '#14b8a6' : '#94a3b8', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {row[c] === null ? <span style={{ fontStyle: 'italic' }}>null</span> : String(row[c])}
                                </td>
                              ))}
                            </tr>
                          ))}
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

      {/* ── PROVISION NEW TENANT ADMIN MODAL ── */}
      {addModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(10px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="data-card" style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>+ Provision Administrator</h3>
              <button onClick={() => setAddModal(false)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Full Name</label>
              <input className="custom-input" placeholder="e.g. John Doe" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Email Address</label>
              <input className="custom-input" type="email" placeholder="e.g. john@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Secure Password</label>
              <input className="custom-input" type="password" placeholder="Min. 8 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Club / Team Name</label>
              <input className="custom-input" placeholder="e.g. Accra Lions FC" value={newClub} onChange={e => setNewClub(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 16 }}>
              <Btn onClick={() => setAddModal(false)} style={{ flex: 1 }}>Cancel</Btn>
              <Btn variant="primary" onClick={handleAddAdmin} disabled={addingAdmin} style={{ flex: 2 }}>
                {addingAdmin ? 'Provisioning...' : 'Provision Account'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </>
  )
}