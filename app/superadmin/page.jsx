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

const TABLES = ['profiles', 'athletes', 'teams', 'contracts', 'injuries', 'transfers', 'subscriptions']

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
      <span style={{ color:isErr?'#ef4444':'#10b981', fontSize:16 }}>{isErr?'⚠':'✓'}</span>
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

const NAV_ITEMS = [
  { id:'users',       label:'User Accounts',    icon:<IconUsers /> },
  { id:'clubs',       label:'Clubs & Teams',    icon:<IconClubs /> },
  { id:'maintenance', label:'Database & Roots', icon:<IconMaintenance /> },
]

export default function SuperadminPage() {
  const router = useRouter()
  const [authOk, setAuthOk] = useState(false)
  const [section, setSection] = useState('users')
  const [profiles, setProfiles] = useState([])
  const [teams, setTeams] = useState([])
  const [mobileNav, setMobileNav] = useState(false)
  const [expandedUser, setExpandedUser] = useState(null)

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

  useEffect(() => { if (authOk) { loadProfiles(); loadTeams() } }, [authOk, loadProfiles, loadTeams])
  useEffect(() => { if (authOk && section === 'maintenance') { loadTable(dbTable) } }, [authOk, section, dbTable, loadTable])

  function showToast(msg, type='success') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

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
      showToast('✅ Account provisioned — verification email sent!')
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
        
        /* SIDEBAR — hidden on mobile */
        .sa-sidebar{
          width:230px;flex-shrink:0;background:#ffffff;border-right:1px solid #e2e8f0;
          display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:80;
        }
        
        .sa-content{margin-left:230px;flex:1;min-width:0;display:flex;flex-direction:column;}
        
        .sa-header{
          height:68px;background:#ffffff;border-bottom:1px solid #e2e8f0;
          display:flex;align-items:center;justify-content:space-between;
          padding:0 28px;position:sticky;top:0;z-index:70;
        }
        
        .sa-main{flex:1;padding:28px 32px;overflow-y:auto;animation:fadeIn 0.3s ease;}
        
        .sa-nav-btn{
          width:100%;display:flex;align-items:center;gap:10px;padding:10px 14px;
          border-radius:10px;border:none;background:transparent;
          font-weight:600;font-size:13.5px;cursor:pointer;text-align:left;
          transition:all 0.15s;fontFamily:'Plus Jakarta Sans',sans-serif;
        }
        .sa-nav-btn:hover{background:#f1f5f9}
        
        .sa-card{
          background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;
          padding:22px;box-shadow:0 1px 4px rgba(0,0,0,0.04);
        }
        
        .sa-custom-input{
          width:100%;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;
          border-radius:10px;font-size:13px;color:#0f172a;outline:none;
          transition:all 0.15s;fontFamily:'Plus Jakarta Sans',sans-serif;
        }
        .sa-custom-input:focus{border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,0.08)}
        
        .sa-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
        .sa-table{width:100%;border-collapse:collapse;text-align:left;min-width:720px}
        .sa-th{padding:12px 16px;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;background:#f8fafc;border-bottom:1px solid #e2e8f0}
        .sa-td{padding:12px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;vertical-align:middle}
        
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
          <div style={{ padding:'20px 16px 16px', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', gap:12 }}>
            <img src="/logo.png" alt="AthleteHub" style={{ width:42, height:42, objectFit:'contain', borderRadius:10, background:'#f0fdfa', padding:4 }}
              onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
            <div style={{ display:'none', width:42, height:42, borderRadius:10, background:'linear-gradient(135deg,#0d9488,#0f766e)', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:900, color:'#fff' }}>⚡</div>
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:'#0f172a', lineHeight:1.2 }}>AthleteHub</div>
              <div style={{ fontSize:10, color:'#0d9488', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', marginTop:1 }}>Superadmin</div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex:1, padding:'16px 12px', display:'flex', flexDirection:'column', gap:4 }}>
            <p style={{ fontSize:9, fontWeight:800, color:'#94a3b8', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8, paddingLeft:8 }}>Navigation</p>
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => setSection(item.id)} className="sa-nav-btn"
                style={{ color:section===item.id?'#0d9488':'#334155', background:section===item.id?'#f0fdfa':'transparent' }}>
                <span style={{ color:section===item.id?'#0d9488':'#94a3b8', display:'flex' }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* User info */}
          <div style={{ padding:'14px 16px', borderTop:'1px solid #e2e8f0' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#0f172a' }}>Samuel Wobil</div>
            <div style={{ fontSize:10, color:'#64748b', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>samuelwobil11@gmail.com</div>
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
            {section === 'users' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

                {/* Search & Filter */}
                <div className="sa-filter-row">
                  <div style={{ position:'relative', flex:'1 1 240px', maxWidth:340 }}>
                    <input className="sa-custom-input" placeholder="Search name, email, or club…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft:36 }} />
                    <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', fontSize:14 }}>🔍</span>
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

                {/* Summary strip */}
                <div style={{ fontSize:12, color:'#64748b', fontWeight:600 }}>
                  {filtered.length} account{filtered.length !== 1 ? 's' : ''} · click a row to expand details
                </div>

                {/* Accordion Cards */}
                {loading ? (
                  <div className="sa-card" style={{ padding:48, textAlign:'center', color:'#94a3b8' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontSize:13 }}>
                      <div style={{ width:16, height:16, border:'2px solid #e2e8f0', borderTopColor:'#0d9488', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                      Syncing user accounts…
                    </div>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="sa-card" style={{ padding:48, textAlign:'center', color:'#94a3b8', fontSize:13 }}>
                    No administrator accounts match the selected parameters.
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {filtered.map(p => {
                      const isOpen = expandedUser === p.id
                      const statusMeta = STATUS_META[p.registration_status?.toLowerCase()] || STATUS_META.pending
                      return (
                        <div key={p.id} className="sa-card" style={{ padding:0, overflow:'hidden', border: isOpen ? '1px solid #99f6e4' : '1px solid #e2e8f0', transition:'border 0.2s' }}>
                          {/* ── COLLAPSED ROW (always visible) ── */}
                          <button
                            onClick={() => setExpandedUser(isOpen ? null : p.id)}
                            style={{ width:'100%', display:'flex', alignItems:'center', gap:14, padding:'14px 18px', background:'none', border:'none', cursor:'pointer', textAlign:'left', transition:'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background=''}>
                            {/* Logo */}
                            <ClubLogoImg url={p.club_logo_url} name={p.full_name} size={40} />
                            {/* Name + Club */}
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontWeight:700, fontSize:14, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.full_name || '—'}</div>
                              <div style={{ fontSize:11, color:'#0d9488', marginTop:2, fontWeight:600 }}>{p.club_name || 'Individual'}</div>
                            </div>
                            {/* Status pill */}
                            <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:statusMeta.bg, color:statusMeta.color, borderRadius:99, padding:'3px 12px', fontSize:11, fontWeight:700, flexShrink:0 }}>
                              <span style={{ width:6, height:6, borderRadius:'50%', background:statusMeta.color }} />
                              {statusMeta.label}
                            </span>
                            {/* Lock badge */}
                            <span style={{ fontSize:10, fontWeight:700, background:p.is_active?'#d1fae5':'#ffe4e6', color:p.is_active?'#059669':'#e11d48', padding:'3px 10px', borderRadius:99, flexShrink:0 }}>
                              {p.is_active ? 'Active' : 'Blocked'}
                            </span>
                            {/* Chevron */}
                            <span style={{ color:'#94a3b8', fontSize:12, transition:'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink:0 }}>▾</span>
                          </button>

                          {/* ── EXPANDED PANEL ── */}
                          {isOpen && (
                            <div style={{ borderTop:'1px solid #e2e8f0', padding:'16px 18px', background:'#fafcff', display:'flex', flexDirection:'column', gap:14, animation:'fadeIn 0.2s ease' }}>
                              {/* Detail grid */}
                              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12 }}>
                                {/* Role */}
                                <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 14px' }}>
                                  <div style={{ fontSize:9, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>Role</div>
                                  <RoleBadge role={p.role || 'admin'} />
                                </div>
                                {/* Full Name */}
                                <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 14px' }}>
                                  <div style={{ fontSize:9, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>Full Name</div>
                                  <div style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>{p.full_name || '—'}</div>
                                </div>
                                {/* Email */}
                                <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 14px' }}>
                                  <div style={{ fontSize:9, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>Email</div>
                                  <div style={{ fontSize:12, color:'#334155', wordBreak:'break-all' }}>{p.email}</div>
                                </div>
                                {/* User ID */}
                                <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 14px' }}>
                                  <div style={{ fontSize:9, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>User ID</div>
                                  <div style={{ fontSize:10, color:'#0d9488', fontFamily:'monospace', wordBreak:'break-all' }}>{p.id}</div>
                                </div>
                                {/* Status */}
                                <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 14px' }}>
                                  <div style={{ fontSize:9, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>Status</div>
                                  <Pill status={p.registration_status || 'pending'} />
                                </div>
                                {/* Lock / Active */}
                                <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 14px' }}>
                                  <div style={{ fontSize:9, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>Lock</div>
                                  <Btn onClick={() => toggleActive(p)} variant={p.is_active?'success':'danger'} style={{ fontSize:11, padding:'4px 10px' }}>
                                    {p.is_active ? '🔓 Active' : '🔒 Blocked'}
                                  </Btn>
                                </div>
                              </div>

                              {/* Actions row */}
                              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', paddingTop:8, borderTop:'1px solid #f1f5f9' }}>
                                <span style={{ fontSize:11, fontWeight:600, color:'#64748b', marginRight:4 }}>Actions:</span>
                                {p.registration_status !== 'approved' && (
                                  <Btn onClick={() => handleApprove(p)} variant="success" style={{ fontSize:12, padding:'6px 14px' }} disabled={acting}>✓ Approve</Btn>
                                )}
                                {p.registration_status !== 'rejected' && (
                                  <Btn onClick={() => handleReject(p)} variant="danger" style={{ fontSize:12, padding:'6px 14px' }} disabled={acting}>✕ Reject</Btn>
                                )}
                                <Btn onClick={() => handleDeleteUser(p)} variant="danger" style={{ fontSize:12, padding:'6px 14px', background:'#7f1d1d', color:'#fecaca', border:'1px solid #991b1b40' }} disabled={acting}>🗑 Delete</Btn>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

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
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <span style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>Team ID</span>
                                <span style={{ fontSize:10, color:'#94a3b8', fontFamily:'monospace' }}>{t.id?.slice(0,18)}…</span>
                              </div>
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
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <span style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>Team ID</span>
                                <span style={{ fontSize:10, color:'#94a3b8', fontFamily:'monospace' }}>{t.id?.slice(0,18)}…</span>
                              </div>
                              <Btn variant="danger" onClick={() => { setTargetTeamId(t.id); setSection('maintenance') }} style={{ fontSize:11, width:'100%', justifyContent:'center' }}>
                                🗑 Wipe This Team
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

            {/* ── DATABASE & ROOTS MAINTENANCE ── */}
            {section === 'maintenance' && (
              <div style={{ display:'flex', flexDirection:'column', gap:22 }}>

                <div className="sa-maint-grid">
                  {/* Delete User by ID */}
                  <div className="sa-card" style={{ border:'1px solid #fecdd3' }}>
                    <h2 style={{ fontSize:13, fontWeight:700, color:'#e11d48', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                      👤 Delete User Roots &amp; Auth
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
                      🏟️ Delete Team, Athletes &amp; Roots
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
                      ⚙️ Table &amp; System Cleanup
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
                                {c}{(c==='full_name'||c==='name') ? ' 👤' : ''}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dbRows.map((row, i) => {
                            const nameVal = row['full_name'] || row['name'] || null
                            const clubVal = row['club_name'] || null
                            const roleVal = row['role'] || null
                            return (
                              <tr key={i} onMouseEnter={e => e.currentTarget.style.background='#f0fdfa'} onMouseLeave={e => e.currentTarget.style.background=''}>
                                {dbCols.map(c => {
                                  const isName = c === 'full_name' || c === 'name'
                                  const isId = c === 'id' || c?.endsWith('_id')
                                  const isRole = c === 'role'
                                  const val = row[c]
                                  return (
                                    <td key={c} className="sa-td" style={{ maxWidth: isName ? 200 : 160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily: isId ? 'monospace' : 'inherit', fontSize:11,
                                      background: isName ? '#f0fdfa' : undefined,
                                      color: val===null ? '#cbd5e1' : isName ? '#0f172a' : isId ? '#0d9488' : '#334155',
                                      fontWeight: isName ? 700 : undefined,
                                    }}>
                                      {val === null ? (
                                        <span style={{ fontStyle:'italic', color:'#cbd5e1' }}>null</span>
                                      ) : isRole ? (
                                        <RoleBadge role={String(val)} />
                                      ) : (
                                        String(val)
                                      )}
                                    </td>
                                  )
                                })}
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