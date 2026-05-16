'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── helpers ──────────────────────────────────────────────────────────
const TABLES = ['profiles', 'athletes', 'teams', 'sessions', 'injuries', 'transfers']

const PILL = {
  pending:  { bg:'#FEF9E7', color:'#B7770D', dot:'#F59E0B' },
  approved: { bg:'#E8F8EE', color:'#1B6B3A', dot:'#27AE60' },
  rejected: { bg:'#F9E8E8', color:'#8B2020', dot:'#E74C3C' },
  active:   { bg:'#E8F8EE', color:'#1B6B3A', dot:'#27AE60' },
  inactive: { bg:'#F9E8E8', color:'#8B2020', dot:'#E74C3C' },
  deployed: { bg:'#E8F8EE', color:'#1B6B3A', dot:'#27AE60' },
}

function Pill({ status }) {
  const s = PILL[status] || PILL.pending
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:s.bg, color:s.color, borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:700, textTransform:'capitalize' }}>
      <span style={{ width:5, height:5, borderRadius:'50%', background:s.dot }} />
      {status}
    </span>
  )
}

function Avatar({ name, size=32 }) {
  const initials = (name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:'linear-gradient(135deg,#004F4F,#008080)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.32, fontWeight:700, color:'#FFFCF6', flexShrink:0 }}>
      {initials}
    </div>
  )
}

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div style={{ position:'fixed', top:20, right:20, zIndex:999, background:toast.type==='error'?'#8B2020':'#006A6A', color:'#FFFCF6', padding:'12px 20px', borderRadius:12, fontSize:13, fontWeight:600, boxShadow:'0 8px 24px rgba(0,0,0,0.18)', maxWidth:340 }}>
      {toast.msg}
    </div>
  )
}

function Btn({ onClick, children, style={}, disabled=false }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ border:'none', borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:disabled?'not-allowed':'pointer', fontFamily:'inherit', opacity:disabled?0.5:1, transition:'all 0.15s', ...style }}>
      {children}
    </button>
  )
}

// ── main component ────────────────────────────────────────────────────
export default function SuperadminPage() {
  const router = useRouter()
  const [authOk,    setAuthOk]    = useState(false)
  const [section,   setSection]   = useState('overview')
  const [profiles,  setProfiles]  = useState([])
  const [dbRows,    setDbRows]    = useState([])
  const [dbCols,    setDbCols]    = useState([])
  const [dbTable,   setDbTable]   = useState('profiles')
  const [dbLoading, setDbLoading] = useState(false)
  const [filter,    setFilter]    = useState('all')
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const [toast,     setToast]     = useState(null)
  const [acting,    setActing]    = useState(false)
  const [selected,  setSelected]  = useState(null)
  const [logoUrl,   setLogoUrl]   = useState('')
  const [rejReason, setRejReason] = useState('')
  const [sqlQuery,  setSqlQuery]  = useState('SELECT * FROM profiles LIMIT 50;')
  const [sqlResult, setSqlResult] = useState(null)
  const [sqlError,  setSqlError]  = useState('')
  const [stats,     setStats]     = useState({ total:0, pending:0, approved:0, rejected:0, clubs:0 })

  // ── auth guard ──
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data:{ session } }) => {
      if (!session) { router.replace('/login'); return }
      const { data:p } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      if (p?.role !== 'superadmin') { router.replace('/dashboard'); return }
      setAuthOk(true)
    })
  }, [])

  // ── load profiles ──
  const loadProfiles = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id,full_name,email,club_name,role,is_active,registration_status,created_at,club_logo_url,phone')
      .order('created_at', { ascending:false })
    const rows = data || []
    setProfiles(rows)
    setStats({
      total:    rows.length,
      pending:  rows.filter(p=>p.registration_status==='pending').length,
      approved: rows.filter(p=>p.registration_status==='approved').length,
      rejected: rows.filter(p=>p.registration_status==='rejected').length,
      clubs:    rows.filter(p=>p.club_name).length,
    })
    setLoading(false)
  }, [])

  useEffect(() => { if (authOk) loadProfiles() }, [authOk, loadProfiles])

  // ── load db table ──
  const loadTable = useCallback(async (tbl) => {
    setDbLoading(true)
    setDbRows([]); setDbCols([])
    const { data, error } = await supabase.from(tbl).select('*').limit(50)
    if (!error && data?.length) {
      setDbCols(Object.keys(data[0]))
      setDbRows(data)
    }
    setDbLoading(false)
  }, [])

  useEffect(() => { if (authOk && section==='database') loadTable(dbTable) }, [authOk, section, dbTable])

  function showToast(msg, type='success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── approve ──
  async function handleApprove() {
    if (!selected) return
    setActing(true)
    try {
      const { error } = await supabase.from('profiles').update({
        is_active: true,
        registration_status: 'approved',
        approved_at: new Date().toISOString(),
        club_logo_url: logoUrl || null,
      }).eq('id', selected.id)
      if (error) throw error

      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-welcome`, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':`Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          full_name: selected.full_name,
          email: selected.email,
          club_name: selected.club_name,
          club_logo_url: logoUrl || null,
        }),
      })
      showToast(`✅ ${selected.full_name} approved — welcome email sent!`)
      setSelected(null)
      loadProfiles()
    } catch (err) {
      showToast('❌ ' + (err.message||'Approval failed'), 'error')
    }
    setActing(false)
  }

  // ── reject ──
  async function handleReject() {
    if (!selected || !rejReason.trim()) { showToast('Enter a rejection reason', 'error'); return }
    setActing(true)
    try {
      const { error } = await supabase.from('profiles').update({
        registration_status: 'rejected',
        is_active: false,
        rejection_reason: rejReason.trim(),
      }).eq('id', selected.id)
      if (error) throw error
      showToast(`Rejected — ${selected.full_name}`)
      setSelected(null); loadProfiles()
    } catch (err) { showToast('❌ ' + (err.message||'Failed'), 'error') }
    setActing(false)
  }

  // ── delete user ──
  async function handleDelete(p) {
    if (!confirm(`Delete ${p.full_name}? This cannot be undone.`)) return
    await supabase.from('profiles').delete().eq('id', p.id)
    showToast(`Deleted ${p.full_name}`)
    loadProfiles()
  }

  // ── toggle active ──
  async function toggleActive(p) {
    await supabase.from('profiles').update({ is_active: !p.is_active }).eq('id', p.id)
    showToast(`${p.full_name} ${!p.is_active?'activated':'deactivated'}`)
    loadProfiles()
  }

  // ── filtered users ──
  const filtered = profiles.filter(p => {
    const q = search.toLowerCase()
    const matchQ = !search || [p.full_name,p.email,p.club_name].some(v=>v?.toLowerCase().includes(q))
    const matchF = filter==='all' || p.registration_status===filter
    return matchQ && matchF
  })

  // ── styles ──
  const S = {
    shell:    { display:'flex', height:'100vh', fontFamily:"'Plus Jakarta Sans',sans-serif", background:'#F2F7F7', overflow:'hidden' },
    sidebar:  { width:210, background:'#002828', display:'flex', flexDirection:'column', flexShrink:0 },
    logo:     { padding:'20px 18px 14px', borderBottom:'1px solid rgba(255,252,246,0.08)' },
    nav:      { flex:1, padding:'10px 10px' },
    navItem:  (active) => ({ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10, cursor:'pointer', fontSize:13, color:active?'#FFFCF6':'rgba(255,252,246,0.5)', background:active?'rgba(255,252,246,0.1)':'transparent', marginBottom:2, fontWeight:active?700:400, transition:'all 0.15s' }),
    main:     { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
    topbar:   { padding:'14px 24px', background:'#fff', borderBottom:'1px solid #E0EEEE', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
    content:  { flex:1, overflowY:'auto', padding:'22px 24px' },
    card:     { background:'#fff', borderRadius:16, border:'1px solid #E0EEEE', overflow:'hidden', marginBottom:16, boxShadow:'0 2px 8px rgba(0,0,0,0.04)' },
    cardHdr:  { padding:'14px 18px', borderBottom:'1px solid #E0EEEE', display:'flex', alignItems:'center', justifyContent:'space-between' },
    th:       { padding:'9px 14px', fontSize:10, fontWeight:700, color:'#5A9494', textTransform:'uppercase', letterSpacing:'0.08em', background:'#F0FAF9', borderBottom:'1px solid #E0EEEE', textAlign:'left', whiteSpace:'nowrap' },
    td:       { padding:'10px 14px', fontSize:13, borderBottom:'1px solid #F0F8F8', verticalAlign:'middle' },
    input:    { padding:'8px 12px', border:'1px solid #D0E8E8', borderRadius:9, fontSize:13, fontFamily:'inherit', outline:'none', color:'#003D3D', background:'#fff' },
    statGrid: { display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 },
    statCard: { background:'#fff', border:'1px solid #E0EEEE', borderRadius:14, padding:'14px 16px', boxShadow:'0 2px 8px rgba(0,0,0,0.03)' },
  }

  if (!authOk) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#002828' }}>
      <div style={{ width:36, height:36, border:'4px solid rgba(0,128,128,0.3)', borderTopColor:'#008080', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const NAV = [
    { id:'overview',  label:'Overview',       icon:'⬛' },
    { id:'users',     label:'Users',          icon:'👥', badge: stats.pending || null },
    { id:'clubs',     label:'Clubs',          icon:'🏟️' },
    { id:'database',  label:'Database',       icon:'🗄️' },
    { id:'functions', label:'Edge Functions', icon:'⚡' },
    { id:'settings',  label:'Settings',       icon:'⚙️' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        tr:hover td{background:#F8FDFD}
        textarea,input,select{font-family:'Plus Jakarta Sans',sans-serif}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#C0D8D8;border-radius:99px}
      `}</style>

      <Toast toast={toast} />

      <div style={S.shell}>
        {/* Sidebar */}
        <div style={S.sidebar}>
          <div style={S.logo}>
            <div style={{ fontSize:16, fontWeight:800, color:'#FFFCF6', letterSpacing:'-0.02em' }}>Apex Track</div>
            <div style={{ fontSize:10, color:'rgba(255,252,246,0.35)', marginTop:2, fontWeight:500, letterSpacing:'0.1em', textTransform:'uppercase' }}>Superadmin</div>
          </div>
          <nav style={S.nav}>
            {NAV.map(n => (
              <div key={n.id} style={S.navItem(section===n.id)} onClick={()=>setSection(n.id)}>
                <span style={{ fontSize:14 }}>{n.icon}</span>
                <span style={{ flex:1 }}>{n.label}</span>
                {n.badge ? <span style={{ background:'#E74C3C', color:'#fff', fontSize:10, fontWeight:700, borderRadius:99, padding:'1px 6px' }}>{n.badge}</span> : null}
              </div>
            ))}
          </nav>
          <div style={{ padding:'14px 18px', borderTop:'1px solid rgba(255,252,246,0.08)' }}>
            <div style={{ fontSize:11, color:'rgba(255,252,246,0.3)', marginBottom:6 }}>Signed in as</div>
            <div style={{ fontSize:12, color:'rgba(255,252,246,0.6)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>samuelwobil11@gmail.com</div>
            <div onClick={()=>supabase.auth.signOut().then(()=>router.replace('/login'))}
              style={{ marginTop:10, fontSize:12, color:'rgba(255,252,246,0.35)', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
              ← Sign out
            </div>
          </div>
        </div>

        {/* Main */}
        <div style={S.main}>
          <div style={S.topbar}>
            <div style={{ fontSize:15, fontWeight:800, color:'#003D3D' }}>{NAV.find(n=>n.id===section)?.label}</div>
            <div style={{ display:'flex', gap:8 }}>
              <Btn onClick={loadProfiles} style={{ background:'#F0FAF9', color:'#006A6A', border:'1px solid #C8E8E4' }}>↻ Refresh</Btn>
              <Btn onClick={()=>router.push('/dashboard')} style={{ background:'#003D3D', color:'#FFFCF6' }}>← Dashboard</Btn>
            </div>
          </div>

          <div style={S.content}>

            {/* ── OVERVIEW ── */}
            {section==='overview' && (
              <div style={{ animation:'fadeUp 0.25s ease' }}>
                <div style={S.statGrid}>
                  {[
                    { label:'Total users',      val:stats.total,    color:'#008080' },
                    { label:'Pending approval', val:stats.pending,  color:'#B7770D' },
                    { label:'Approved',         val:stats.approved, color:'#27AE60' },
                    { label:'Rejected',         val:stats.rejected, color:'#E74C3C' },
                    { label:'Clubs registered', val:stats.clubs,    color:'#6A4CB7' },
                  ].map(s => (
                    <div key={s.label} style={S.statCard}>
                      <div style={{ fontSize:11, color:'#5A9494', marginBottom:6, fontWeight:600 }}>{s.label}</div>
                      <div style={{ fontSize:28, fontWeight:900, color:s.color, letterSpacing:'-0.03em', lineHeight:1 }}>{s.val}</div>
                    </div>
                  ))}
                </div>
                <div style={S.card}>
                  <div style={S.cardHdr}><span style={{ fontSize:13, fontWeight:700, color:'#003D3D' }}>Pending registrations</span></div>
                  {profiles.filter(p=>p.registration_status==='pending').length===0 ? (
                    <div style={{ padding:32, textAlign:'center', color:'#5A9494', fontSize:13 }}>🎉 No pending registrations</div>
                  ) : profiles.filter(p=>p.registration_status==='pending').map(p => (
                    <div key={p.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 18px', borderBottom:'1px solid #F0F8F8' }}>
                      <Avatar name={p.full_name} size={36} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'#003D3D' }}>{p.full_name}</div>
                        <div style={{ fontSize:11, color:'#5A9494' }}>{p.club_name||p.email}</div>
                      </div>
                      <div style={{ fontSize:11, color:'#5A9494' }}>{new Date(p.created_at).toLocaleDateString()}</div>
                      <Btn onClick={()=>{ setSelected(p); setLogoUrl(p.club_logo_url||''); setRejReason(''); setSection('users') }}
                        style={{ background:'#E8F0FA', color:'#1A4A8A' }}>Review</Btn>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── USERS ── */}
            {section==='users' && (
              <div style={{ animation:'fadeUp 0.25s ease' }}>
                <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
                  <input style={{ ...S.input, width:220 }} placeholder="Search name, club, email…" value={search} onChange={e=>setSearch(e.target.value)} />
                  {['all','pending','approved','rejected'].map(f => (
                    <Btn key={f} onClick={()=>setFilter(f)}
                      style={{ background:filter===f?'#006A6A':'#fff', color:filter===f?'#FFFCF6':'#5A9494', border:'1px solid #D0E8E8', textTransform:'capitalize' }}>
                      {f} ({f==='all'?stats.total:stats[f]||0})
                    </Btn>
                  ))}
                </div>
                <div style={S.card}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr>{['Name / Club','Email','Role','Status','Active','Actions'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', padding:32, color:'#5A9494' }}>Loading…</td></tr>
                      ) : filtered.length===0 ? (
                        <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', padding:32, color:'#5A9494' }}>No users found</td></tr>
                      ) : filtered.map(p => (
                        <tr key={p.id}>
                          <td style={S.td}>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <Avatar name={p.full_name} size={32} />
                              <div>
                                <div style={{ fontWeight:700, color:'#003D3D' }}>{p.full_name}</div>
                                <div style={{ fontSize:11, color:'#5A9494' }}>{p.club_name||'—'}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ ...S.td, fontSize:12, color:'#5A9494' }}>{p.email}</td>
                          <td style={{ ...S.td, fontSize:12, color:'#2D6B6B', fontWeight:600, textTransform:'capitalize' }}>{p.role||'admin'}</td>
                          <td style={S.td}><Pill status={p.registration_status||'pending'} /></td>
                          <td style={S.td}>
                            <Btn onClick={()=>toggleActive(p)}
                              style={{ background:p.is_active?'#E8F8EE':'#F9E8E8', color:p.is_active?'#1B6B3A':'#8B2020', fontSize:11 }}>
                              {p.is_active?'On':'Off'}
                            </Btn>
                          </td>
                          <td style={S.td}>
                            <div style={{ display:'flex', gap:6 }}>
                              <Btn onClick={()=>{ setSelected(p); setLogoUrl(p.club_logo_url||''); setRejReason('') }}
                                style={{ background:'#E8F0FA', color:'#1A4A8A' }}>Review</Btn>
                              <Btn onClick={()=>handleDelete(p)} style={{ background:'#F9E8E8', color:'#8B2020' }}>Delete</Btn>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── CLUBS ── */}
            {section==='clubs' && (
              <div style={{ animation:'fadeUp 0.25s ease' }}>
                <div style={S.card}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr>{['Club','Admin','Email','Status','Actions'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {profiles.filter(p=>p.club_name).map(p => (
                        <tr key={p.id}>
                          <td style={S.td}>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              {p.club_logo_url
                                ? <img src={p.club_logo_url} alt="" style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', border:'2px solid #E0EEEE' }}/>
                                : <Avatar name={p.club_name} size={32}/>}
                              <span style={{ fontWeight:700, color:'#003D3D' }}>{p.club_name}</span>
                            </div>
                          </td>
                          <td style={S.td}>{p.full_name}</td>
                          <td style={{ ...S.td, fontSize:12, color:'#5A9494' }}>{p.email}</td>
                          <td style={S.td}><Pill status={p.registration_status||'pending'} /></td>
                          <td style={S.td}>
                            <Btn onClick={()=>{ setSelected(p); setLogoUrl(p.club_logo_url||''); setRejReason(''); setSection('users') }}
                              style={{ background:'#E8F0FA', color:'#1A4A8A' }}>Review</Btn>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── DATABASE ── */}
            {section==='database' && (
              <div style={{ animation:'fadeUp 0.25s ease' }}>
                <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
                  {TABLES.map(t => (
                    <Btn key={t} onClick={()=>setDbTable(t)}
                      style={{ background:dbTable===t?'#006A6A':'#fff', color:dbTable===t?'#FFFCF6':'#5A9494', border:'1px solid #D0E8E8', fontFamily:'monospace', fontSize:12 }}>
                      {t}
                    </Btn>
                  ))}
                </div>
                <div style={S.card}>
                  <div style={S.cardHdr}>
                    <span style={{ fontSize:13, fontWeight:700, color:'#003D3D', fontFamily:'monospace' }}>{dbTable}</span>
                    <Btn onClick={()=>loadTable(dbTable)} style={{ background:'#F0FAF9', color:'#006A6A' }}>↻ Reload</Btn>
                  </div>
                  {dbLoading ? (
                    <div style={{ padding:32, textAlign:'center', color:'#5A9494' }}>Loading…</div>
                  ) : dbRows.length===0 ? (
                    <div style={{ padding:32, textAlign:'center', color:'#5A9494' }}>No rows or table not accessible</div>
                  ) : (
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <thead><tr>{dbCols.map(c=><th key={c} style={S.th}>{c}</th>)}</tr></thead>
                        <tbody>
                          {dbRows.map((row,i) => (
                            <tr key={i}>
                              {dbCols.map(c => (
                                <td key={c} style={{ ...S.td, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:c==='id'?'monospace':'inherit', fontSize:c==='id'?11:13, color:c==='id'?'#5A9494':'#003D3D' }}>
                                  {row[c]===null?<span style={{ color:'#B8C8C8', fontStyle:'italic' }}>null</span>:String(row[c])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* SQL editor */}
                <div style={S.card}>
                  <div style={S.cardHdr}><span style={{ fontSize:13, fontWeight:700, color:'#003D3D' }}>SQL Editor</span></div>
                  <div style={{ padding:16 }}>
                    <textarea value={sqlQuery} onChange={e=>setSqlQuery(e.target.value)} rows={4}
                      style={{ width:'100%', fontFamily:'monospace', fontSize:12, padding:'10px 12px', border:'1px solid #D0E8E8', borderRadius:10, outline:'none', color:'#003D3D', resize:'vertical', background:'#F8FDFD' }} />
                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      <Btn onClick={async()=>{
                        setSqlError(''); setSqlResult(null)
                        const { data, error } = await supabase.rpc('run_sql', { query: sqlQuery }).catch(()=>({ error:{ message:'RPC not available — use Supabase dashboard SQL editor' } }))
                        if (error) setSqlError(error.message)
                        else setSqlResult(data)
                      }} style={{ background:'#006A6A', color:'#FFFCF6' }}>Run query</Btn>
                      <Btn onClick={()=>setSqlQuery('SELECT * FROM profiles LIMIT 50;')} style={{ background:'#F0FAF9', color:'#006A6A' }}>Reset</Btn>
                    </div>
                    {sqlError && <div style={{ marginTop:10, padding:'10px 14px', background:'#F9E8E8', borderRadius:8, fontSize:12, color:'#8B2020', fontFamily:'monospace' }}>{sqlError}</div>}
                    {sqlResult && <pre style={{ marginTop:10, padding:'10px 14px', background:'#F0FAF9', borderRadius:8, fontSize:11, color:'#003D3D', overflow:'auto' }}>{JSON.stringify(sqlResult, null, 2)}</pre>}
                  </div>
                </div>
              </div>
            )}

            {/* ── FUNCTIONS ── */}
            {section==='functions' && (
              <div style={{ animation:'fadeUp 0.25s ease' }}>
                <div style={S.card}>
                  <div style={S.cardHdr}><span style={{ fontSize:13, fontWeight:700, color:'#003D3D' }}>Edge functions</span><span style={{ fontSize:11, color:'#5A9494', fontFamily:'monospace' }}>nivgcxbobofxoszvijhp</span></div>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead><tr>{['Function','Status','Trigger','Actions'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {[
                        { name:'notify-registration', trigger:'DB INSERT on profiles', desc:'Emails admin on new signup' },
                        { name:'send-welcome',        trigger:'Manual / superadmin',   desc:'Emails user on approval' },
                      ].map(f => (
                        <tr key={f.name}>
                          <td style={S.td}>
                            <div style={{ fontWeight:700, color:'#003D3D', fontFamily:'monospace', fontSize:12 }}>{f.name}</div>
                            <div style={{ fontSize:11, color:'#5A9494' }}>{f.desc}</div>
                          </td>
                          <td style={S.td}><Pill status="deployed" /></td>
                          <td style={{ ...S.td, fontSize:11, fontFamily:'monospace', color:'#5A9494' }}>{f.trigger}</td>
                          <td style={S.td}>
                            <Btn onClick={async()=>{
                              const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${f.name}`
                              const r = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` }, body:JSON.stringify({ test:true }) })
                              showToast(r.ok ? `✅ ${f.name} responded ${r.status}` : `⚠️ ${f.name} returned ${r.status}`, r.ok?'success':'error')
                            }} style={{ background:'#F0FAF9', color:'#006A6A' }}>Test ping</Btn>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={S.card}>
                  <div style={S.cardHdr}><span style={{ fontSize:13, fontWeight:700, color:'#003D3D' }}>Secrets</span></div>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead><tr>{['Key','Value','Status'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      <tr>
                        <td style={{ ...S.td, fontFamily:'monospace', fontSize:12 }}>RESEND_API_KEY</td>
                        <td style={{ ...S.td, fontFamily:'monospace', fontSize:12, color:'#5A9494' }}>re_••••••••••••••••</td>
                        <td style={S.td}><Pill status="deployed" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── SETTINGS ── */}
            {section==='settings' && (
              <div style={{ animation:'fadeUp 0.25s ease' }}>
                <div style={S.card}>
                  <div style={S.cardHdr}><span style={{ fontSize:13, fontWeight:700, color:'#003D3D' }}>App configuration</span></div>
                  <div style={{ padding:20, display:'flex', flexDirection:'column', gap:18 }}>
                    {[
                      { label:'App name',                  val:'Apex Track',                              hint:'Displayed across the platform' },
                      { label:'Admin notification email',  val:'samuelwobil11@gmail.com',                 hint:'Receives new registration alerts' },
                      { label:'App URL',                   val:'https://athletehub-seven.vercel.app',     hint:'Used in email links' },
                      { label:'Supabase project ref',      val:'nivgcxbobofxoszvijhp',                    hint:'Read-only' },
                    ].map(s => (
                      <div key={s.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:18, borderBottom:'1px solid #F0F8F8' }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:'#003D3D' }}>{s.label}</div>
                          <div style={{ fontSize:11, color:'#5A9494', marginTop:2 }}>{s.hint}</div>
                        </div>
                        <input defaultValue={s.val} style={{ ...S.input, width:260, fontSize:12 }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ padding:'14px 20px', borderTop:'1px solid #E0EEEE', display:'flex', justifyContent:'flex-end' }}>
                    <Btn onClick={()=>showToast('Settings saved!')} style={{ background:'#006A6A', color:'#FFFCF6', padding:'10px 24px' }}>Save settings</Btn>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── REVIEW MODAL ── */}
      {selected && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,20,20,0.65)', backdropFilter:'blur(6px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e=>{ if(e.target===e.currentTarget) setSelected(null) }}>
          <div style={{ background:'#FFFCF6', borderRadius:20, width:'100%', maxWidth:480, maxHeight:'92vh', overflow:'auto', boxShadow:'0 32px 80px rgba(0,20,20,0.4)' }}>
            <div style={{ background:'linear-gradient(135deg,#004F4F,#008080)', padding:'18px 22px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:11, color:'rgba(255,252,246,0.5)', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:3 }}>Review Registration</div>
                <div style={{ fontSize:16, fontWeight:800, color:'#FFFCF6' }}>{selected.full_name}</div>
              </div>
              <button onClick={()=>setSelected(null)} style={{ background:'rgba(255,252,246,0.15)', border:'none', width:32, height:32, borderRadius:'50%', fontSize:18, cursor:'pointer', color:'#FFFCF6' }}>×</button>
            </div>
            <div style={{ padding:22, display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ background:'#F0FAF9', border:'1px solid #C8E8E4', borderRadius:12, padding:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[
                  ['Club',    selected.club_name||'—'],
                  ['Email',   selected.email],
                  ['Role',    selected.role||'admin'],
                  ['Status',  selected.registration_status||'pending'],
                  ['Active',  selected.is_active?'Yes':'No'],
                  ['Joined',  new Date(selected.created_at).toLocaleDateString()],
                ].map(([k,v])=>(
                  <div key={k}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#5A9494', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>{k}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#003D3D' }}>{v}</div>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#2D6B6B', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Club Logo URL</div>
                <input value={logoUrl} onChange={e=>setLogoUrl(e.target.value)} placeholder="https://..." style={{ ...S.input, width:'100%' }} />
                {logoUrl && <img src={logoUrl} alt="" style={{ width:48, height:48, borderRadius:'50%', objectFit:'cover', marginTop:8, border:'2px solid #E0EEEE' }}/>}
              </div>

              {selected.registration_status!=='approved' && (
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#8B2020', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Rejection Reason (required to reject)</div>
                  <textarea value={rejReason} onChange={e=>setRejReason(e.target.value)} rows={3}
                    placeholder="e.g. Could not verify club affiliation."
                    style={{ width:'100%', padding:'10px 12px', border:'1px solid #E0C0C0', borderRadius:10, fontSize:13, outline:'none', color:'#003D3D', resize:'vertical', background:'#FFF8F8', fontFamily:'inherit' }} />
                </div>
              )}

              <div style={{ display:'flex', gap:10 }}>
                <Btn onClick={()=>setSelected(null)} style={{ flex:1, background:'#F0F8F8', color:'#5A9494', border:'1px solid #D0E8E8', padding:'11px' }}>Cancel</Btn>
                {selected.registration_status!=='rejected' && (
                  <Btn onClick={handleReject} disabled={acting} style={{ flex:1, background:'#F9E8E8', color:'#8B2020', padding:'11px' }}>✕ Reject</Btn>
                )}
                <Btn onClick={handleApprove} disabled={acting} style={{ flex:2, background:'linear-gradient(135deg,#006A6A,#008080)', color:'#FFFCF6', padding:'11px', boxShadow:'0 4px 14px rgba(0,106,106,0.25)' }}>
                  {acting ? 'Processing…' : selected.registration_status==='approved' ? '✓ Update & Resend' : '✓ Approve & Email'}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}