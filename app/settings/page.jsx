'use client'
import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import { supabase } from '@/lib/supabase'

const ROLES = ['admin','coach','physio','analyst','scout','player']
const ROLE_COLORS = {
  admin:'#4A90E2', coach:'#27AE60', physio:'#E67E22',
  analyst:'#9B59B6', scout:'#1ABC9C', player:'#E74C3C',
}
const ROLE_LABELS = {
  admin:   'Full system access — all modules',
  coach:   'Dashboard, Athletes, Schedule, Medical, Performance',
  physio:  'Dashboard, Athletes, Medical Hub only',
  analyst: 'Dashboard, Athletes, Performance, Reports',
  scout:   'Dashboard, Scouting, Athletes',
  player:  'Dashboard only',
}

function initials(n) { return (n||'A').slice(0,2).toUpperCase() }

const inp = {
  width:'100%', padding:'10px 14px',
  background:'var(--surface2)', border:'1px solid var(--border)',
  borderRadius:'var(--r-md)', fontSize:14, outline:'none',
  color:'var(--text)', fontFamily:'var(--font)',
}
const lbl = {
  display:'block', fontSize:11, fontWeight:600,
  letterSpacing:'0.08em', textTransform:'uppercase',
  color:'var(--text3)', marginBottom:6,
}

export default function SettingsPage() {
  const [profile,       setProfile]       = useState(null)
  const [allUsers,      setAllUsers]      = useState([])
  const [allStaff,      setAllStaff]      = useState([])
  const [staffLogins,   setStaffLogins]   = useState([])
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [tab,           setTab]           = useState('profile')
  const [isAdmin,       setIsAdmin]       = useState(false)
  const [msg,           setMsg]           = useState({ text:'', type:'' })
  const [profileForm,   setProfileForm]   = useState({ full_name:'', phone:'' })
  const [pwForm,        setPwForm]        = useState({ newPw:'', confirm:'' })

  // Issue login
  const [issueForm,     setIssueForm]     = useState({ coach_id:'', email:'', password:'', role:'physio', notes:'' })
  const [issueSaving,   setIssueSaving]   = useState(false)
  const [issueMsg,      setIssueMsg]      = useState({ text:'', type:'' })
  const [showIssueForm, setShowIssueForm] = useState(false)

  // Recover login
  const [recoverForm,   setRecoverForm]   = useState({ login_id:'', new_password:'', confirm_password:'' })
  const [recoverSaving, setRecoverSaving] = useState(false)
  const [recoverMsg,    setRecoverMsg]    = useState({ text:'', type:'' })
  const [showPassword,  setShowPassword]  = useState({})

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const { data:{ session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }

      const { data:p } = await supabase
        .from('profiles')
        .select('*, teams(id,name,short_name)')
        .eq('id', session.user.id)
        .single()

      const prof = p || { full_name: session.user.email, role: 'admin' }
      setProfile({ ...prof, email: session.user.email })
      setProfileForm({ full_name: prof.full_name||'', phone: prof.phone||'' })
      const admin = prof.role === 'admin' || prof.role === 'superadmin'
      setIsAdmin(admin)

      if (admin) {
        const [{ data:users },{ data:staff },{ data:logins }] = await Promise.all([
          supabase.from('profiles').select('id,full_name,role,is_active,email').order('created_at',{ ascending:false }),
          supabase.from('coaches').select('id,name,staff_type,email,is_active').order('name'),
          // Fetch plain_password so admin can see/recover it
          supabase.from('staff_logins').select('*,coaches(name,staff_type)').order('created_at',{ ascending:false }),
        ])
        setAllUsers(users||[])
        setAllStaff(staff||[])
        setStaffLogins(logins||[])
      }
    } catch(e) { console.error(e) }
    setLoading(false)
  }

  const flash        = (text, type='success') => { setMsg({ text, type }); setTimeout(()=>setMsg({ text:'',type:'' }),9000) }
  const flashIssue   = (text, type='success') => setIssueMsg({ text, type })
  const flashRecover = (text, type='success') => setRecoverMsg({ text, type })

  async function saveProfile() {
    if (!profileForm.full_name.trim()) { flash('Name is required.','error'); return }
    setSaving(true)
    const { data:{ session } } = await supabase.auth.getSession()
    const { error } = await supabase.from('profiles')
      .update({ full_name: profileForm.full_name.trim(), phone: profileForm.phone||null })
      .eq('id', session.user.id)
    if (error) flash('Failed: '+error.message,'error')
    else { flash('Profile updated!'); await loadAll() }
    setSaving(false)
  }

  // ── Admin password change uses SERVICE ROLE via API (not client SDK) ─────
  async function changePassword() {
    if (!pwForm.newPw)                   { flash('New password required.','error'); return }
    if (pwForm.newPw.length < 8)         { flash('Minimum 8 characters.','error'); return }
    if (pwForm.newPw !== pwForm.confirm) { flash('Passwords do not match.','error'); return }
    setSaving(true)

    try {
      const { data:{ session } } = await supabase.auth.getSession()
      if (!session?.user?.id) { flash('Session expired. Please log in again.','error'); setSaving(false); return }

      // Use the service role API — this is the fix for "change password not working"
      const res = await fetch('/api/admin/create-user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:      session.user.id,
          action:       'change_own_password',
          new_password: pwForm.newPw,
        }),
      })
      const data = await res.json()
      if (!res.ok) { flash('Failed: ' + (data.error||'Unknown error'),'error'); setSaving(false); return }

      flash('Password changed! You will be signed out now. Please log in again with your new password.')
      setPwForm({ newPw:'', confirm:'' })

      // Sign out current session and redirect to login
      setTimeout(async () => {
        await supabase.auth.signOut()
        window.location.href = '/login'
      }, 2500)
    } catch(e) {
      flash('Error: '+e.message,'error')
    }
    setSaving(false)
  }

  // ── Issue Login ───────────────────────────────────────────────────────────
  async function issueLogin() {
    if (!issueForm.coach_id)            { flashIssue('Select a staff member.','error'); return }
    if (!issueForm.email.trim())        { flashIssue('Email is required.','error'); return }
    if (!issueForm.email.includes('@')) { flashIssue('Enter a valid email.','error'); return }
    if (issueForm.password.length < 8)  { flashIssue('Password: min 8 characters.','error'); return }
    if (!profile?.team_id)             { flashIssue('Your account has no team assigned.','error'); return }
    setIssueSaving(true); setIssueMsg({ text:'',type:'' })
    try {
      const staff = allStaff.find(s => s.id === issueForm.coach_id)
      const res = await fetch('/api/admin/create-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:     issueForm.email.trim().toLowerCase(),
          password:  issueForm.password,
          full_name: staff?.name || issueForm.email,
          role:      issueForm.role,
          coach_id:  issueForm.coach_id,
          team_id:   profile.team_id,
          notes:     issueForm.notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) { flashIssue(data.error||'Failed.','error'); setIssueSaving(false); return }
      flashIssue(
        `✅ Login created for ${staff?.name}!\n` +
        `📧 Email: ${issueForm.email}\n` +
        `🔑 Password: ${issueForm.password}\n\n` +
        `Share these credentials securely.`,
        'success'
      )
      setIssueForm({ coach_id:'',email:'',password:'',role:'physio',notes:'' })
      setShowIssueForm(false)
      await loadAll()
    } catch(err) { flashIssue('Error: '+err.message,'error') }
    setIssueSaving(false)
  }

  // ── Recover Login ─────────────────────────────────────────────────────────
  // This shows the stored password OR resets to a new one
  async function recoverLogin() {
    if (!recoverForm.login_id)                                     { flashRecover('Select a staff member.','error'); return }
    if (!recoverForm.new_password)                                 { flashRecover('New password is required.','error'); return }
    if (recoverForm.new_password.length < 8)                       { flashRecover('Password must be at least 8 characters.','error'); return }
    if (recoverForm.new_password !== recoverForm.confirm_password) { flashRecover('Passwords do not match.','error'); return }

    setRecoverSaving(true); setRecoverMsg({ text:'',type:'' })
    try {
      const login = staffLogins.find(l => l.id === recoverForm.login_id)
      if (!login) { flashRecover('Login record not found.','error'); setRecoverSaving(false); return }

      // Find user_id — try multiple strategies
      let userId = null

      // Strategy 1: match by email in profiles table
      const { data: byEmail } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', login.email)
        .maybeSingle()
      if (byEmail?.id) userId = byEmail.id

      // Strategy 2: match allUsers by email
      if (!userId) {
        const u = allUsers.find(u => u.email?.toLowerCase() === login.email?.toLowerCase())
        if (u?.id) userId = u.id
      }

      // Strategy 3: match allUsers by full_name matching coach name
      if (!userId && login.coaches?.name) {
        const u = allUsers.find(u => u.full_name?.toLowerCase() === login.coaches.name.toLowerCase())
        if (u?.id) userId = u.id
      }

      if (!userId) {
        flashRecover(
          `Cannot find the system account for ${login.coaches?.name||login.email}.\n\n` +
          `This usually means their email in Supabase Auth doesn't match the login record.\n\n` +
          `Go to Supabase → Authentication → Users and check the email for this staff member is exactly: ${login.email}`,
          'error'
        )
        setRecoverSaving(false); return
      }

      const res = await fetch('/api/admin/create-user', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:      userId,
          login_id:     recoverForm.login_id,
          action:       'reset_password',
          new_password: recoverForm.new_password,
        }),
      })
      const data = await res.json()
      if (!res.ok) { flashRecover(data.error||'Reset failed.','error'); setRecoverSaving(false); return }

      flashRecover(
        `✅ Password reset for ${login.coaches?.name||login.email}!\n` +
        `📧 Email: ${login.email}\n` +
        `🔑 New Password: ${recoverForm.new_password}\n\n` +
        `Share these credentials securely. Their old sessions have been signed out.`,
        'success'
      )
      setRecoverForm({ login_id:'', new_password:'', confirm_password:'' })
      await loadAll()
    } catch(err) { flashRecover('Error: '+err.message,'error') }
    setRecoverSaving(false)
  }

  async function revokeLogin(loginId) {
    if (!confirm('Revoke this login? The user will be signed out immediately.')) return
    const login   = staffLogins.find(l => l.id === loginId)
    const user    = allUsers.find(u =>
      u.email?.toLowerCase() === login?.email?.toLowerCase() ||
      u.full_name?.toLowerCase() === login?.coaches?.name?.toLowerCase()
    )
    const user_id = user?.id
    if (!user_id) {
      await supabase.from('staff_logins').update({ is_active: false }).eq('id', loginId)
      flash('Login revoked in records (auth account not found).'); await loadAll(); return
    }
    const res  = await fetch('/api/admin/create-user',{ method:'PATCH', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ user_id, login_id:loginId, action:'revoke' }) })
    const data = await res.json()
    if (!res.ok) { flash('Failed: '+data.error,'error'); return }
    flash('✅ Login revoked. User has been signed out immediately.')
    await loadAll()
  }

  async function reactivateLogin(loginId) {
    if (!confirm('Reactivate this login?')) return
    const login   = staffLogins.find(l => l.id === loginId)
    const user    = allUsers.find(u =>
      u.email?.toLowerCase() === login?.email?.toLowerCase() ||
      u.full_name?.toLowerCase() === login?.coaches?.name?.toLowerCase()
    )
    const user_id = user?.id
    if (!user_id) {
      await supabase.from('staff_logins').update({ is_active: true }).eq('id', loginId)
      flash('Login reactivated in records.'); await loadAll(); return
    }
    const res  = await fetch('/api/admin/create-user',{ method:'PATCH', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ user_id, login_id:loginId, action:'reactivate' }) })
    const data = await res.json()
    if (!res.ok) { flash('Failed: '+data.error,'error'); return }
    flash('✅ Login reactivated.')
    await loadAll()
  }

  async function updateUserRole(userId, role) {
    await supabase.from('profiles').update({ role }).eq('id', userId)
    setAllUsers(u => u.map(x => x.id === userId ? { ...x, role } : x))
  }

  async function toggleUserActive(userId, current) {
    if (current && !confirm('Disable this user? They will be signed out immediately.')) return
    const res = await fetch('/api/admin/create-user',{ method:'PATCH', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ user_id:userId, action:current?'revoke':'reactivate' }) })
    const data = await res.json()
    if (!res.ok) { flash('Failed: '+data.error,'error'); return }
    flash(current ? '✅ User disabled and signed out.' : '✅ User enabled.')
    await loadAll()
  }

  const TABS = [
    { id:'profile',  label:'👤 My Profile',     show: true    },
    { id:'security', label:'🔒 Security',        show: true    },
    { id:'logins',   label:'🔑 Issue Logins',    show: isAdmin },
    { id:'recover',  label:'🔓 Recover Logins',  show: isAdmin },
    { id:'users',    label:'👥 User Management', show: isAdmin },
    { id:'system',   label:'⚙️ System',          show: isAdmin },
  ].filter(t => t.show)

  const MsgBox = ({ m }) => !m.text ? null : (
    <div style={{ padding:'13px 16px',borderRadius:'var(--r-md)',fontSize:13,fontWeight:600,whiteSpace:'pre-line',lineHeight:1.7,marginTop:12,background:m.type==='error'?'var(--danger-light)':'#E8F8EE',color:m.type==='error'?'var(--danger)':'#1B7A3E',border:`1px solid ${m.type==='error'?'rgba(231,76,60,0.2)':'rgba(39,174,96,0.2)'}` }}>
      {m.text}
    </div>
  )

  if (loading) return (
    <Layout>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh' }}>
        <div style={{ width:36,height:36,border:'4px solid var(--blue-light)',borderTopColor:'var(--blue)',borderRadius:'50%',animation:'spin 0.7s linear infinite' }}/>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div style={{ maxWidth:1100,margin:'0 auto',padding:'32px 40px' }}>
        <PageHeader label="Configuration" title="Settings" subtitle="Profile, security, and system administration"/>

        <style>{`
          .settings-wrap { display:grid; grid-template-columns:230px 1fr; gap:24px; align-items:start; }
          .settings-tabs-list { display:flex; flex-direction:column; }
          .settings-content { padding:30px; }
          @media(max-width:768px){
            .settings-wrap { grid-template-columns:1fr !important; gap:12px !important; }
            .settings-profile-header { display:none !important; }
            .settings-tabs-list { flex-direction:row !important; overflow-x:auto; gap:4px !important; padding:4px 0 8px !important; scrollbar-width:none; }
            .settings-tabs-list::-webkit-scrollbar { display:none; }
            .settings-tab-btn { white-space:nowrap !important; flex-shrink:0 !important; text-align:center !important; padding:8px 14px !important; }
            .settings-content { padding:16px !important; }
            .settings-grid-2 { grid-template-columns:1fr !important; }
            .issue-grid { grid-template-columns:1fr !important; }
            .recover-grid { grid-template-columns:1fr !important; }
            .logins-table-header { display:none !important; }
            .logins-table-row { display:flex !important; flex-direction:column !important; gap:6px !important; padding:14px !important; }
            .users-table-header { display:none !important; }
            .users-table-row { display:flex !important; flex-wrap:wrap !important; gap:8px !important; align-items:center !important; padding:12px 14px !important; }
            .system-grid { grid-template-columns:1fr !important; }
          }
        `}</style>

        <div className="settings-wrap">

          {/* Sidebar */}
          <div className="card" style={{ padding:10 }}>
            <div className="settings-profile-header" style={{ textAlign:'center',padding:'16px 12px',borderBottom:'1px solid var(--border)',marginBottom:10 }}>
              <div style={{ width:54,height:54,borderRadius:'50%',background:`linear-gradient(135deg,${ROLE_COLORS[profile?.role||'admin']},${ROLE_COLORS[profile?.role||'admin']}99)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:800,color:'#fff',margin:'0 auto 10px' }}>
                {initials(profile?.full_name)}
              </div>
              <div style={{ fontSize:14,fontWeight:700,color:'var(--text)',marginBottom:4 }}>{profile?.full_name||'User'}</div>
              {profile?.teams?.name && <div style={{ fontSize:11,color:'var(--text3)',marginBottom:6 }}>🏟 {profile.teams.name}</div>}
              <span style={{ fontSize:10,fontWeight:700,background:ROLE_COLORS[profile?.role||'admin']+'20',color:ROLE_COLORS[profile?.role||'admin'],padding:'2px 12px',borderRadius:99,letterSpacing:'0.08em',textTransform:'uppercase' }}>
                {profile?.role||'user'}
              </span>
            </div>
            <div className="settings-tabs-list">
            {TABS.map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setMsg({ text:'',type:'' }); setIssueMsg({ text:'',type:'' }); setRecoverMsg({ text:'',type:'' }) }}
                className="settings-tab-btn"
                style={{ width:'100%',padding:'10px 14px',background:tab===t.id?'var(--blue-light)':'transparent',border:'none',borderRadius:'var(--r-md)',fontSize:13,fontWeight:tab===t.id?700:500,color:tab===t.id?'var(--blue)':'var(--text2)',cursor:'pointer',textAlign:'left',transition:'var(--transition)',marginBottom:2,fontFamily:'var(--font)',display:'block' }}>
                {t.label}
              </button>
            ))}
            </div>
          </div>

          {/* Content */}
          <div className="card settings-content">

            {/* ── MY PROFILE ── */}
            {tab === 'profile' && (
              <div>
                <h2 style={{ fontSize:20,fontWeight:700,marginBottom:22 }}>My Profile</h2>
                <div style={{ display:'flex',flexDirection:'column',gap:16,maxWidth:440 }}>
                  <div><label style={lbl}>Full Name</label><input value={profileForm.full_name} onChange={e=>setProfileForm(f=>({...f,full_name:e.target.value}))} style={inp} placeholder="Your full name" onFocus={e=>e.target.style.borderColor='var(--blue)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/></div>
                  <div><label style={lbl}>Email Address</label><input value={profile?.email||''} disabled style={{ ...inp,opacity:0.55,cursor:'not-allowed' }}/></div>
                  <div><label style={lbl}>System Role</label><input value={profile?.role||''} disabled style={{ ...inp,opacity:0.55,cursor:'not-allowed',textTransform:'capitalize' }}/></div>
                  <div><label style={lbl}>Club / Team</label><input value={profile?.teams?.name||'No team assigned'} disabled style={{ ...inp,opacity:0.55,cursor:'not-allowed' }}/></div>
                  <div><label style={lbl}>Phone</label><input value={profileForm.phone} onChange={e=>setProfileForm(f=>({...f,phone:e.target.value}))} style={inp} placeholder="+233 24 000 0000" onFocus={e=>e.target.style.borderColor='var(--blue)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/></div>
                  <MsgBox m={msg}/>
                  <button onClick={saveProfile} disabled={saving} className="btn-blue" style={{ width:'fit-content',padding:'11px 28px',opacity:saving?0.7:1 }}>
                    {saving?'Saving…':'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* ── SECURITY ── */}
            {tab === 'security' && (
              <div>
                <h2 style={{ fontSize:20,fontWeight:700,marginBottom:8 }}>Security</h2>

                {!isAdmin ? (
                  // Non-admin: show contact-admin notice
                  <div style={{ background:'#EEF6FF',border:'1px solid rgba(74,144,226,0.3)',borderRadius:'var(--r-lg)',padding:'24px 28px' }}>
                    <div style={{ fontSize:26,marginBottom:12 }}>🔒</div>
                    <h3 style={{ fontSize:16,fontWeight:700,color:'var(--blue-dark)',marginBottom:8 }}>Password changes are managed by your admin</h3>
                    <p style={{ fontSize:14,color:'var(--text2)',lineHeight:1.7,marginBottom:18 }}>
                      For security, staff accounts cannot change their own passwords. Contact your club administrator if you need your password changed or have forgotten it.
                    </p>
                    <div style={{ background:'rgba(255,255,255,0.8)',borderRadius:'var(--r-md)',padding:'14px 18px',border:'1px solid rgba(74,144,226,0.15)' }}>
                      <div style={{ fontSize:11,fontWeight:700,color:'var(--text3)',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:8 }}>Your admin can</div>
                      <div style={{ fontSize:13,color:'var(--text2)',lineHeight:2 }}>
                        <div>🔓 See and reset your password via <strong>Settings → Recover Logins</strong></div>
                        <div>🚫 Revoke or restore your account access</div>
                        <div>👤 Update your role and permissions</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Admin: full password change form using service role API
                  <>
                    <p style={{ fontSize:14,color:'var(--text3)',marginBottom:24 }}>
                      After changing your password you will be signed out and must log in again with the new password.
                    </p>
                    <div style={{ display:'flex',flexDirection:'column',gap:16,maxWidth:420 }}>
                      <div><label style={lbl}>New Password</label><input type="password" value={pwForm.newPw} onChange={e=>setPwForm(f=>({...f,newPw:e.target.value}))} style={inp} placeholder="Minimum 8 characters" onFocus={e=>e.target.style.borderColor='var(--blue)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/></div>
                      <div><label style={lbl}>Confirm New Password</label><input type="password" value={pwForm.confirm} onChange={e=>setPwForm(f=>({...f,confirm:e.target.value}))} style={inp} placeholder="Repeat password" onFocus={e=>e.target.style.borderColor='var(--blue)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/></div>
                      <MsgBox m={msg}/>
                      <button onClick={changePassword} disabled={saving} className="btn-blue" style={{ width:'fit-content',padding:'11px 28px',opacity:saving?0.7:1 }}>
                        {saving ? '⏳ Changing password…' : 'Update Password'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── ISSUE LOGINS ── */}
            {tab === 'logins' && isAdmin && (
              <div>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20 }}>
                  <div>
                    <h2 style={{ fontSize:20,fontWeight:700,marginBottom:6 }}>Issue Staff Logins</h2>
                    <p style={{ fontSize:14,color:'var(--text3)' }}>Grant access to staff. Linked to: <strong style={{ color:'var(--blue)' }}>{profile?.teams?.name||'No team'}</strong></p>
                  </div>
                  <button onClick={()=>{ setShowIssueForm(!showIssueForm); setIssueMsg({ text:'',type:'' }) }} className="btn-blue" style={{ padding:'9px 18px',flexShrink:0 }}>
                    {showIssueForm ? '✕ Cancel' : '+ Issue New Login'}
                  </button>
                </div>

                {showIssueForm && (
                  <div style={{ background:'var(--blue-light)',border:'1px solid rgba(74,144,226,0.3)',borderRadius:'var(--r-lg)',padding:24,marginBottom:24 }}>
                    <h3 style={{ fontSize:16,fontWeight:700,color:'var(--blue-dark)',marginBottom:18 }}>🔑 New Login Credentials</h3>
                    <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
                      <div>
                        <label style={{ ...lbl,color:'#1A4A8A' }}>Staff Member *</label>
                        <select value={issueForm.coach_id} onChange={e=>setIssueForm(f=>({...f,coach_id:e.target.value}))} style={{ ...inp,background:'#fff' }}>
                          <option value="">— Select a staff member —</option>
                          {allStaff.length===0 ? <option disabled>No staff found — add staff in Teams tab first</option> : allStaff.map(s=><option key={s.id} value={s.id}>{s.name} ({(s.staff_type||'').replace(/_/g,' ')})</option>)}
                        </select>
                      </div>
                      <div className="issue-grid" style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
                        <div><label style={{ ...lbl,color:'#1A4A8A' }}>Login Email *</label><input type="email" value={issueForm.email} onChange={e=>setIssueForm(f=>({...f,email:e.target.value}))} style={{ ...inp,background:'#fff' }} placeholder="staff@club.gh" onFocus={e=>e.target.style.borderColor='var(--blue)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/></div>
                        <div><label style={{ ...lbl,color:'#1A4A8A' }}>Password *</label><input type="text" value={issueForm.password} onChange={e=>setIssueForm(f=>({...f,password:e.target.value}))} style={{ ...inp,background:'#fff' }} placeholder="Min 8 characters" onFocus={e=>e.target.style.borderColor='var(--blue)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/></div>
                      </div>
                      <div>
                        <label style={{ ...lbl,color:'#1A4A8A' }}>System Role *</label>
                        <select value={issueForm.role} onChange={e=>setIssueForm(f=>({...f,role:e.target.value}))} style={{ ...inp,background:'#fff' }}>
                          <option value="physio">physio — Medical Hub access</option>
                          <option value="coach">coach — Training & Athletes</option>
                          <option value="analyst">analyst — Performance & Reports</option>
                          <option value="scout">scout — Scouting module</option>
                          <option value="player">player — Dashboard only</option>
                        </select>
                      </div>
                      <div><label style={{ ...lbl,color:'#1A4A8A' }}>Notes (optional)</label><input value={issueForm.notes} onChange={e=>setIssueForm(f=>({...f,notes:e.target.value}))} style={{ ...inp,background:'#fff' }} placeholder="e.g. Temporary credentials"/></div>
                      <MsgBox m={issueMsg}/>
                      <button onClick={issueLogin} disabled={issueSaving||!profile?.team_id} className="btn-blue" style={{ width:'fit-content',padding:'11px 28px',opacity:(issueSaving||!profile?.team_id)?0.7:1 }}>
                        {issueSaving ? '⏳ Creating…' : '🔑 Issue Login Now'}
                      </button>
                    </div>
                  </div>
                )}
                {!showIssueForm && <MsgBox m={issueMsg}/>}

                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,marginTop:showIssueForm?0:8 }}>
                  <h3 style={{ fontSize:16,fontWeight:700,margin:0 }}>Issued Logins ({staffLogins.length})</h3>
                  <span style={{ fontSize:12,color:'var(--text3)' }}>{staffLogins.filter(l=>l.is_active).length} active · {staffLogins.filter(l=>!l.is_active).length} revoked</span>
                </div>
                <MsgBox m={msg}/>

                {staffLogins.length === 0 ? (
                  <div style={{ padding:'28px',textAlign:'center',background:'var(--surface2)',borderRadius:'var(--r-lg)',color:'var(--text3)',fontSize:14,fontStyle:'italic',border:'1px solid var(--border)',marginTop:12 }}>No logins issued yet.</div>
                ) : (
                  <div style={{ border:'1px solid var(--border)',borderRadius:'var(--r-lg)',overflow:'hidden',marginTop:12 }}>
                    <div className="logins-table-header" style={{ display:'grid',gridTemplateColumns:'1.3fr 1.6fr 1.8fr 0.8fr 0.8fr 0.7fr 1.2fr',gap:8,padding:'11px 18px',background:'var(--surface2)',borderBottom:'1px solid var(--border)' }}>
                      {['Staff','Email','Password','Role','Issued','Status','Action'].map(h=>(
                        <div key={h} style={{ fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase' }}>{h}</div>
                      ))}
                    </div>
                    {staffLogins.map(login => (
                      <div key={login.id} className="logins-table-row" style={{ display:'grid',gridTemplateColumns:'1.3fr 1.6fr 1.8fr 0.8fr 0.8fr 0.7fr 1.2fr',gap:8,alignItems:'center',padding:'13px 18px',borderBottom:'1px solid var(--border)',transition:'var(--transition)',opacity:login.is_active?1:0.6 }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                        onMouseLeave={e=>e.currentTarget.style.background=''}>
                        <div>
                          <div style={{ fontSize:13,fontWeight:700,color:'var(--text)' }}>{login.coaches?.name||'—'}</div>
                          <div style={{ fontSize:11,color:'var(--text3)',textTransform:'capitalize' }}>{(login.coaches?.staff_type||'').replace(/_/g,' ')}</div>
                        </div>
                        <div style={{ fontSize:11,color:'var(--text2)',wordBreak:'break-all' }}>{login.email}</div>

                        {/* Password column — show/hide toggle */}
                        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                          {login.plain_password ? (
                            <>
                              <span style={{ fontSize:11,fontFamily:'monospace',background:'var(--surface2)',padding:'2px 8px',borderRadius:4,border:'1px solid var(--border)',color:'var(--text)' }}>
                                {showPassword[login.id] ? login.plain_password : '••••••••'}
                              </span>
                              <button
                                onClick={()=>setShowPassword(p=>({...p,[login.id]:!p[login.id]}))}
                                title={showPassword[login.id]?'Hide password':'Show password'}
                                style={{ background:'none',border:'none',cursor:'pointer',fontSize:14,padding:2,color:'var(--text3)' }}>
                                {showPassword[login.id] ? '🙈' : '👁'}
                              </button>
                            </>
                          ) : (
                            <span style={{ fontSize:11,color:'var(--text3)',fontStyle:'italic' }}>Not stored</span>
                          )}
                        </div>

                        <div><span style={{ fontSize:10,fontWeight:700,background:ROLE_COLORS[login.role]+'20',color:ROLE_COLORS[login.role],padding:'2px 8px',borderRadius:99,letterSpacing:'0.06em',textTransform:'uppercase' }}>{login.role}</span></div>
                        <div style={{ fontSize:11,color:'var(--text3)' }}>{new Date(login.created_at).toLocaleDateString('en-GB')}</div>
                        <div><span style={{ fontSize:10,fontWeight:700,background:login.is_active?'#E8F8EE':'var(--danger-light)',color:login.is_active?'#1B7A3E':'var(--danger)',padding:'2px 8px',borderRadius:99 }}>{login.is_active?'● Active':'○ Revoked'}</span></div>
                        <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>
                          {login.is_active
                            ?<button onClick={()=>revokeLogin(login.id)} style={{ background:'var(--danger-light)',color:'var(--danger)',border:'none',padding:'5px 10px',borderRadius:'var(--r-sm)',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)' }}>🚫 Revoke</button>
                            :<button onClick={()=>reactivateLogin(login.id)} style={{ background:'#E8F8EE',color:'#1B7A3E',border:'none',padding:'5px 10px',borderRadius:'var(--r-sm)',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)' }}>✅ Restore</button>
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── RECOVER LOGINS ── */}
            {tab === 'recover' && isAdmin && (
              <div>
                <h2 style={{ fontSize:20,fontWeight:700,marginBottom:8 }}>Recover Staff Logins</h2>
                <p style={{ fontSize:14,color:'var(--text3)',marginBottom:24 }}>
                  Reset a staff member's forgotten password. You can also see their current stored password in the <strong>Issue Logins</strong> tab by clicking the 👁 icon.
                </p>

                <div style={{ background:'var(--blue-light)',border:'1px solid rgba(74,144,226,0.25)',borderRadius:'var(--r-lg)',padding:26,marginBottom:28 }}>
                  <h3 style={{ fontSize:16,fontWeight:700,color:'var(--blue-dark)',marginBottom:18 }}>🔓 Set New Password for Staff</h3>
                  <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
                    <div>
                      <label style={{ ...lbl,color:'#1A4A8A' }}>Staff Member *</label>
                      <select value={recoverForm.login_id} onChange={e=>setRecoverForm(f=>({...f,login_id:e.target.value}))} style={{ ...inp,background:'#fff' }}>
                        <option value="">— Select a staff member —</option>
                        {staffLogins.filter(l=>l.is_active).length===0
                          ?<option disabled>No active logins found</option>
                          :staffLogins.filter(l=>l.is_active).map(l=>(
                            <option key={l.id} value={l.id}>{l.coaches?.name||'—'} · {l.email} · {l.role}</option>
                          ))
                        }
                      </select>

                      {/* Show selected staff + their CURRENT stored password */}
                      {recoverForm.login_id && (() => {
                        const login = staffLogins.find(l=>l.id===recoverForm.login_id)
                        if (!login) return null
                        return (
                          <div style={{ marginTop:10,padding:'12px 16px',background:'rgba(255,255,255,0.8)',borderRadius:'var(--r-md)',border:'1px solid rgba(74,144,226,0.2)' }}>
                            <div style={{ display:'flex',gap:20,flexWrap:'wrap',marginBottom:login.plain_password?10:0 }}>
                              <span style={{ fontSize:12,color:'var(--blue-dark)' }}>👤 <strong>{login.coaches?.name||'—'}</strong></span>
                              <span style={{ fontSize:12,color:'var(--blue-dark)' }}>📧 {login.email}</span>
                              <span style={{ fontSize:12,color:'var(--blue-dark)',textTransform:'capitalize' }}>🎭 {login.role}</span>
                            </div>
                            {login.plain_password && (
                              <div style={{ display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'#E8F4FF',borderRadius:6,border:'1px solid rgba(74,144,226,0.2)' }}>
                                <span style={{ fontSize:11,fontWeight:700,color:'var(--blue-dark)' }}>Current password:</span>
                                <span style={{ fontFamily:'monospace',fontSize:13,color:'var(--text)',fontWeight:600 }}>
                                  {showPassword['recover_'+login.id] ? login.plain_password : '••••••••'}
                                </span>
                                <button
                                  onClick={()=>setShowPassword(p=>({...p,['recover_'+login.id]:!p['recover_'+login.id]}))}
                                  style={{ background:'none',border:'none',cursor:'pointer',fontSize:16,padding:2 }}>
                                  {showPassword['recover_'+login.id] ? '🙈' : '👁'}
                                </button>
                                <button
                                  onClick={()=>navigator.clipboard?.writeText(login.plain_password)}
                                  style={{ background:'rgba(74,144,226,0.1)',border:'1px solid rgba(74,144,226,0.2)',color:'var(--blue)',borderRadius:4,padding:'2px 8px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)' }}>
                                  📋 Copy
                                </button>
                              </div>
                            )}
                            {!login.plain_password && (
                              <div style={{ fontSize:11,color:'var(--text3)',fontStyle:'italic' }}>
                                No stored password — this login was created before password storage was added. Set a new password below.
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>

                    <div className="recover-grid" style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
                      <div><label style={{ ...lbl,color:'#1A4A8A' }}>Set New Password *</label><input type="text" value={recoverForm.new_password} onChange={e=>setRecoverForm(f=>({...f,new_password:e.target.value}))} style={{ ...inp,background:'#fff' }} placeholder="Min 8 characters" onFocus={e=>e.target.style.borderColor='var(--blue)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/></div>
                      <div><label style={{ ...lbl,color:'#1A4A8A' }}>Confirm Password *</label><input type="text" value={recoverForm.confirm_password} onChange={e=>setRecoverForm(f=>({...f,confirm_password:e.target.value}))} style={{ ...inp,background:'#fff' }} placeholder="Repeat password" onFocus={e=>e.target.style.borderColor='var(--blue)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/></div>
                    </div>

                    <MsgBox m={recoverMsg}/>

                    <button onClick={recoverLogin} disabled={recoverSaving} className="btn-blue" style={{ width:'fit-content',padding:'11px 28px',opacity:recoverSaving?0.7:1 }}>
                      {recoverSaving ? '⏳ Resetting…' : '🔓 Reset Password Now'}
                    </button>
                  </div>
                </div>

                {/* All logins overview — click to pre-select */}
                <h3 style={{ fontSize:16,fontWeight:700,marginBottom:12 }}>All Active Logins</h3>
                {staffLogins.filter(l=>l.is_active).length===0 ? (
                  <div style={{ padding:'24px',background:'var(--surface2)',borderRadius:'var(--r-lg)',color:'var(--text3)',fontSize:13,fontStyle:'italic',border:'1px solid var(--border)',textAlign:'center' }}>No active staff logins.</div>
                ) : (
                  <div style={{ border:'1px solid var(--border)',borderRadius:'var(--r-lg)',overflow:'hidden' }}>
                    <div style={{ display:'grid',gridTemplateColumns:'1.3fr 1.6fr 1.6fr 0.8fr 0.7fr',gap:8,padding:'10px 18px',background:'var(--surface2)',borderBottom:'1px solid var(--border)' }}>
                      {['Staff','Email','Password','Role','Issued'].map(h=><div key={h} style={{ fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase' }}>{h}</div>)}
                    </div>
                    {staffLogins.filter(l=>l.is_active).map((login,i)=>{
                      const selected = recoverForm.login_id === login.id
                      return (
                        <div key={login.id}
                          onClick={()=>setRecoverForm(f=>({...f,login_id:login.id}))}
                          style={{ display:'grid',gridTemplateColumns:'1.3fr 1.6fr 1.6fr 0.8fr 0.7fr',gap:8,alignItems:'center',padding:'12px 18px',borderBottom:'1px solid var(--border)',transition:'var(--transition)',cursor:'pointer',background:selected?'#EEF6FF':i%2===0?'var(--surface)':'var(--surface2)' }}
                          onMouseEnter={e=>{ if(!selected)e.currentTarget.style.background='var(--surface2)' }}
                          onMouseLeave={e=>{ if(!selected)e.currentTarget.style.background=i%2===0?'var(--surface)':'var(--surface2)' }}>
                          <div style={{ display:'flex',alignItems:'center',gap:7 }}>
                            {selected && <span style={{ fontSize:14 }}>✅</span>}
                            <div>
                              <div style={{ fontSize:13,fontWeight:700,color:'var(--text)' }}>{login.coaches?.name||'—'}</div>
                              <div style={{ fontSize:11,color:'var(--text3)',textTransform:'capitalize' }}>{(login.coaches?.staff_type||'').replace(/_/g,' ')}</div>
                            </div>
                          </div>
                          <div style={{ fontSize:12,color:'var(--text2)',wordBreak:'break-all' }}>{login.email}</div>
                          {/* Password with show/hide */}
                          <div style={{ display:'flex',alignItems:'center',gap:5 }}>
                            {login.plain_password ? (
                              <>
                                <span style={{ fontSize:12,fontFamily:'monospace',color:'var(--text)' }}>
                                  {showPassword['tbl_'+login.id] ? login.plain_password : '••••••••'}
                                </span>
                                <button onClick={e=>{e.stopPropagation();setShowPassword(p=>({...p,['tbl_'+login.id]:!p['tbl_'+login.id]}))}} style={{ background:'none',border:'none',cursor:'pointer',fontSize:13,padding:0 }}>
                                  {showPassword['tbl_'+login.id]?'🙈':'👁'}
                                </button>
                              </>
                            ) : (
                              <span style={{ fontSize:11,color:'var(--text3)',fontStyle:'italic' }}>—</span>
                            )}
                          </div>
                          <div><span style={{ fontSize:10,fontWeight:700,background:ROLE_COLORS[login.role]+'20',color:ROLE_COLORS[login.role],padding:'2px 8px',borderRadius:99,textTransform:'uppercase' }}>{login.role}</span></div>
                          <div style={{ fontSize:11,color:'var(--text3)' }}>{new Date(login.created_at).toLocaleDateString('en-GB')}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <p style={{ fontSize:11,color:'var(--text3)',marginTop:10 }}>💡 Click any row to pre-select · 👁 to reveal password · 📋 to copy</p>
              </div>
            )}

            {/* ── USER MANAGEMENT ── */}
            {tab === 'users' && isAdmin && (
              <div>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
                  <div><h2 style={{ fontSize:20,fontWeight:700,marginBottom:4 }}>User Management</h2><p style={{ fontSize:13,color:'var(--text3)' }}>All users in: <strong>{profile?.teams?.name||'—'}</strong></p></div>
                  <span style={{ fontSize:12,background:'var(--blue-light)',color:'var(--blue)',padding:'6px 14px',borderRadius:99,fontWeight:700 }}>{allUsers.length} users</span>
                </div>
                <MsgBox m={msg}/>
                {allUsers.length===0 ? <p style={{ fontSize:13,color:'var(--text3)',fontStyle:'italic',marginTop:12 }}>No users yet.</p> : (
                  <div style={{ border:'1px solid var(--border)',borderRadius:'var(--r-lg)',overflow:'hidden',marginTop:msg.text?12:0 }}>
                    <div className="users-table-header" style={{ display:'grid',gridTemplateColumns:'1.6fr 1.8fr 1.1fr 0.9fr 1.1fr',gap:8,padding:'12px 18px',background:'var(--surface2)',borderBottom:'1px solid var(--border)' }}>
                      {['Name','Email','Role','Status','Action'].map(h=><div key={h} style={{ fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase' }}>{h}</div>)}
                    </div>
                    {allUsers.map(u=>(
                      <div key={u.id} className="users-table-row" style={{ display:'grid',gridTemplateColumns:'1.6fr 1.8fr 1.1fr 0.9fr 1.1fr',gap:8,alignItems:'center',padding:'12px 18px',borderBottom:'1px solid var(--border)',transition:'var(--transition)',opacity:u.is_active!==false?1:0.6 }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                        onMouseLeave={e=>e.currentTarget.style.background=''}>
                        <div style={{ display:'flex',alignItems:'center',gap:9 }}>
                          <div style={{ width:32,height:32,borderRadius:'50%',background:ROLE_COLORS[u.role||'coach']+'33',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:ROLE_COLORS[u.role||'coach'],flexShrink:0 }}>{initials(u.full_name)}</div>
                          <span style={{ fontSize:13,fontWeight:600,color:'var(--text)' }}>{u.full_name||'—'}</span>
                        </div>
                        <div style={{ fontSize:12,color:'var(--text3)',wordBreak:'break-all' }}>{u.email||'—'}</div>
                        <div><select value={u.role||'coach'} onChange={e=>updateUserRole(u.id,e.target.value)} style={{ padding:'5px 10px',border:'1px solid var(--border)',borderRadius:'var(--r-sm)',fontSize:12,background:'var(--surface2)',color:'var(--text)',fontFamily:'var(--font)',cursor:'pointer',outline:'none' }}>{ROLES.map(r=><option key={r}>{r}</option>)}</select></div>
                        <div><span style={{ fontSize:10,fontWeight:700,background:u.is_active!==false?'#E8F8EE':'var(--danger-light)',color:u.is_active!==false?'#1B7A3E':'var(--danger)',padding:'3px 10px',borderRadius:99 }}>{u.is_active!==false?'Active':'Disabled'}</span></div>
                        <div><button onClick={()=>toggleUserActive(u.id,u.is_active!==false)} style={{ background:u.is_active!==false?'var(--danger-light)':'#E8F8EE',color:u.is_active!==false?'var(--danger)':'#1B7A3E',border:'none',padding:'5px 12px',borderRadius:'var(--r-sm)',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)' }}>{u.is_active!==false?'Disable':'Enable'}</button></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── SYSTEM ── */}
            {tab === 'system' && isAdmin && (
              <div>
                <h2 style={{ fontSize:20,fontWeight:700,marginBottom:22 }}>System Information</h2>
                <div style={{ background:'linear-gradient(135deg,var(--blue-light),#E8F4FF)',border:'1px solid rgba(74,144,226,0.25)',borderRadius:'var(--r-lg)',padding:'18px 22px',marginBottom:22 }}>
                  <div style={{ fontSize:13,fontWeight:700,color:'var(--blue-dark)',marginBottom:10 }}>🏟 Your Club</div>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                    {[['Club Name',profile?.teams?.name||'—'],['Short Name',profile?.teams?.short_name||'—'],['Team ID',profile?.team_id||'—'],['Your Role',profile?.role||'—']].map(([label,value])=>(
                      <div key={label} style={{ background:'rgba(255,255,255,0.7)',borderRadius:'var(--r-sm)',padding:'10px 14px' }}>
                        <div style={{ fontSize:10,color:'var(--text3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:3 }}>{label}</div>
                        <div style={{ fontSize:13,fontWeight:600,color:'var(--text)',wordBreak:'break-all' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="system-grid" style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:24 }}>
                  {[['Platform','AthleteHub FOS v2.0'],['Database','Supabase PostgreSQL'],['Framework','Next.js 16'],['Auth','Supabase Auth (JWT)'],['Security','Multi-tenant RLS'],['Region','West EU (London)']].map(([label,value])=>(
                    <div key={label} style={{ background:'var(--surface2)',borderRadius:'var(--r-md)',padding:'14px 18px',border:'1px solid var(--border)' }}>
                      <div style={{ fontSize:10,color:'var(--text3)',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:5 }}>{label}</div>
                      <div style={{ fontSize:14,fontWeight:600,color:'var(--text)' }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background:'var(--blue-light)',border:'1px solid rgba(74,144,226,0.2)',borderRadius:'var(--r-lg)',padding:'20px 24px' }}>
                  <h3 style={{ fontSize:15,fontWeight:700,color:'var(--blue-dark)',marginBottom:14 }}>Role Permission Matrix</h3>
                  {Object.entries(ROLE_LABELS).map(([role,desc])=>(
                    <div key={role} style={{ display:'flex',alignItems:'center',gap:12,padding:'9px 0',borderBottom:'1px solid rgba(74,144,226,0.12)' }}>
                      <span style={{ fontSize:10,fontWeight:700,background:ROLE_COLORS[role]+'25',color:ROLE_COLORS[role],padding:'3px 12px',borderRadius:99,letterSpacing:'0.08em',textTransform:'uppercase',flexShrink:0,minWidth:76,textAlign:'center' }}>{role}</span>
                      <span style={{ fontSize:13,color:'var(--text2)' }}>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </Layout>
  )
}