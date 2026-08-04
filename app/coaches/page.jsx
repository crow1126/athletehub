'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { IconStar, IconCamera, IconCheck } from '@/lib/icons'

import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import Badge from '@/components/Badge'
import { supabase } from '@/lib/supabase'
import { getTenantProfile, scopeTeam } from '@/lib/tenant'
import { getSportConfig } from '@/lib/sportsConfig'

const currency = v => v ? `GHS ${parseFloat(v).toLocaleString('en-GH', { minimumFractionDigits: 2 })}` : '—'
const daysLeft = d => { if (!d) return null; const diff = Math.floor((new Date(d) - new Date()) / 86400000); return diff }

const STAFF_TYPES = [
  { value:'head_coach',       label:'Head Coach',          icon:'', color:'#4A90E2', dept:'Coaching'   },
  { value:'assistant_coach',  label:'Assistant Coach',     icon:'', color:'#2E6FC4', dept:'Coaching'   },
  { value:'fitness_coach',    label:'Fitness Coach',       icon:'', color:'#27AE60', dept:'Coaching'   },
  { value:'physio',           label:'Physiotherapist',     icon:'', color:'#E67E22', dept:'Medical'    },
  { value:'sports_scientist', label:'Sports Scientist',    icon:'', color:'#E74C3C', dept:'Medical'    },
  { value:'medical',          label:'Medical Officer',     icon:'', color:'#C0392B', dept:'Medical'    },
  { value:'analyst',          label:'Performance Analyst', icon:'', color:'#9B59B6', dept:'Analytics'  },
  { value:'scout',            label:'Scout',               icon:'', color:'#1ABC9C', dept:'Scouting'   },
  { value:'kit_manager',      label:'Kit Manager',         icon:'', color:'#F39C12', dept:'Other'      },
  { value:'accountant',       label:'Accountant',          icon:'', color:'#F59E0B', dept:'Other'      },
  { value:'other',            label:'Other',               icon:'', color:'#7F8C8D', dept:'Other'      },
]

const DEPT_TABS = [
  { key:'All',       label:'All Staff',  icon:'', color:'#4A90E2' },
  { key:'Coaching',  label:'Coaching',   icon:'', color:'#2E6FC4' },
  { key:'Medical',   label:'Medical',    icon:'', color:'#E67E22' },
  { key:'Analytics', label:'Analytics',  icon:'', color:'#9B59B6' },
  { key:'Scouting',  label:'Scouting',   icon:'', color:'#1ABC9C' },
  { key:'Other',     label:'Other',      icon:'', color:'#7F8C8D' },
]

const AV_COLORS = ['#4A90E2','#27AE60','#E67E22','#9B59B6','#E74C3C','#1ABC9C']

function initials(n) { return (n||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }
function getStaffType(val) { return STAFF_TYPES.find(t=>t.value===val)||{label:val||'Staff',icon:'',color:'#7F8C8D',dept:'Other'} }

function StaffAvatar({ staff, size=54 }) {
  const [err, setErr] = useState(false)
  if (staff?.photo_url && !err) {
    return <img src={staff.photo_url} alt={staff.name} onError={()=>setErr(true)} style={{ width:size,height:size,borderRadius:'50%',objectFit:'cover',border:'2px solid var(--border)',flexShrink:0,boxShadow:'0 2px 8px rgba(0,0,0,0.08)' }}/>
  }
  return (
    <div style={{ width:size,height:size,borderRadius:'50%',flexShrink:0,background:'var(--surface3,#e2e8f0)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.32,fontWeight:800,color:'var(--text2)',border:'2px solid var(--border)' }}>
      {initials(staff?.name)}
    </div>
  )
}

function PostStamp({ loggedBy, loggedAt, updatedBy, updatedAt }) {
  if (!loggedBy && !loggedAt) return null
  const fmt = d => !d ? '—' : new Date(d).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
  return (
    <div style={{ marginTop:10,display:'flex',flexWrap:'wrap',gap:6 }}>
      {loggedBy && (
        <div style={{ display:'inline-flex',alignItems:'center',gap:5,background:'rgba(74,144,226,0.09)',border:'1px solid rgba(74,144,226,0.18)',borderRadius:99,padding:'3px 10px' }}>
          <span style={{ fontSize:11 }}></span>
          <span style={{ fontSize:10,fontWeight:700,color:'#2E6FC4' }}>{loggedBy}</span>
          {loggedAt&&<span style={{ fontSize:10,color:'#7A9CC4' }}>· {fmt(loggedAt)}</span>}
        </div>
      )}
      {updatedBy && (
        <div style={{ display:'inline-flex',alignItems:'center',gap:5,background:'rgba(155,89,182,0.09)',border:'1px solid rgba(155,89,182,0.18)',borderRadius:99,padding:'3px 10px' }}>
          <span style={{ fontSize:11 }}></span>
          <span style={{ fontSize:10,fontWeight:700,color:'#7D3C98' }}>{updatedBy}</span>
          {updatedAt&&<span style={{ fontSize:10,color:'#9B59B6' }}>· {fmt(updatedAt)}</span>}
        </div>
      )}
    </div>
  )
}

const EMPTY_FORM = { name:'',staff_type:'assistant_coach',speciality:'',experience_years:'',phone:'',email:'',is_active:true,
  monthly_salary:'', win_bonus:'', contract_start:'', contract_end:'', contract_status:'Active', contract_notes:'' }
const inp = { width:'100%',padding:'10px 14px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',fontSize:14,outline:'none',color:'var(--text)',fontFamily:'var(--font)' }
const lbl = { display:'block',fontSize:11,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)',marginBottom:6 }

export default function CoachesPage() {
  const [coaches,      setCoaches]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [deleting,     setDeleting]     = useState(null)
  const [showForm,     setShowForm]     = useState(false)
  const [editId,       setEditId]       = useState(null)
  const [form,         setForm]         = useState(EMPTY_FORM)
  const [photoFile,    setPhotoFile]    = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [activeTab,    setActiveTab]    = useState('All')
  const [mainView,     setMainView]     = useState('staff') // 'staff' | 'contracts'
  const [formError,    setFormError]    = useState('')
  const [currentUser,  setCurrentUser]  = useState(null)
  const [hasStampCols, setHasStampCols] = useState(false)
  const [teamId,       setTeamId]       = useState(null)
  const [sportType,    setSportType]    = useState('football')
  const [draftSavedAt, setDraftSavedAt] = useState(null)
  const [hasDraft,     setHasDraft]     = useState(false)
  const draftTimer = useRef(null)
  const DRAFT_KEY = 'staff_entry_draft'

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { profile: p, teamId: currentTeamId } = await getTenantProfile('id,full_name,role,team_id,teams(sport_type)')
      setCurrentUser(p)
      setTeamId(currentTeamId)
      if (p?.teams?.sport_type) setSportType(p.teams.sport_type)

      // Try with stamp cols first
      const r1 = await scopeTeam(supabase.from('coaches')
        .select('*,athletes(id,name,position,status,photo_url),logged_profile:logged_by(full_name),updated_profile:updated_by(full_name)'), currentTeamId)
        .order('name')

      if (!r1.error) {
        setCoaches(r1.data||[])
        setHasStampCols(true)
      } else {
        // Fallback without stamp cols (columns not added yet)
        const r2 = await scopeTeam(supabase.from('coaches').select('*,athletes(id,name,position,status,photo_url)'), currentTeamId).order('name')
        if (r2.error) console.error('Coaches fetch error:', r2.error.message)
        setCoaches(r2.data||[])
        setHasStampCols(false)
      }
    } catch(e) { console.error('fetchData error:', e) }
    setLoading(false)
  }, [])

  useEffect(()=>{ fetchData() },[fetchData])

  // Auto-save draft when adding new staff (not editing)
  useEffect(() => {
    if (!showForm || editId) return
    clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
        setDraftSavedAt(new Date())
      } catch (_) {}
    }, 600)
    return () => clearTimeout(draftTimer.current)
  }, [form, showForm, editId])

  // Check for saved draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      setHasDraft(!!raw && raw !== JSON.stringify(EMPTY_FORM))
    } catch (_) {}
  }, [])

  const set = k => v => setForm(f=>({...f,[k]:v}))

  function openAdd() {
    setEditId(null); setPhotoFile(null); setPhotoPreview(null); setFormError('')
    // Restore draft if one exists
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        setForm({ ...EMPTY_FORM, ...JSON.parse(raw) })
        setDraftSavedAt(null)
      } else {
        setForm(EMPTY_FORM)
      }
    } catch (_) {
      setForm(EMPTY_FORM)
    }
    setShowForm(true)
  }

  function clearStaffDraft() {
    try { localStorage.removeItem(DRAFT_KEY) } catch (_) {}
    setDraftSavedAt(null); setHasDraft(false); setForm(EMPTY_FORM)
  }
  function openEdit(c) {
    setEditId(c.id)
    setForm({name:c.name||'',staff_type:c.staff_type||'assistant_coach',speciality:c.speciality||'',experience_years:c.experience_years||'',phone:c.phone||'',email:c.email||'',is_active:c.is_active!==false,
      monthly_salary:c.monthly_salary||'',win_bonus:c.win_bonus||'',contract_start:c.contract_start||'',contract_end:c.contract_end||'',contract_status:c.contract_status||'Active',contract_notes:c.contract_notes||''
    })
    setPhotoFile(null);setPhotoPreview(c.photo_url||null);setFormError('');setShowForm(true)
  }

  async function uploadPhoto(coachId) {
    if (!photoFile) return null
    try {
      const ext=photoFile.name.split('.').pop()
      const path=`staff/${coachId}.${ext}`
      const {error}=await supabase.storage.from('athlete-photos').upload(path,photoFile,{upsert:true})
      if (error){console.error('Photo upload:',error);return null}
      const {data}=supabase.storage.from('athlete-photos').getPublicUrl(path)
      return data.publicUrl
    } catch(e){console.error('Upload:',e);return null}
  }

  async function handleSave() {
    setFormError('')
    if (!form.name.trim()){setFormError('Full name is required.');return}
    if (!teamId){setFormError('Your account is not assigned to a team.');return}
    setSaving(true)
    const now=new Date().toISOString()
    const userId=currentUser?.id||null
    const payload={
      name:form.name.trim(),staff_type:form.staff_type,
      speciality:form.speciality||null,experience_years:parseInt(form.experience_years)||null,
      phone:form.phone||null,email:form.email||null,is_active:form.is_active,
      team_id:teamId,
      monthly_salary: form.monthly_salary ? parseFloat(form.monthly_salary) : null,
      win_bonus:       form.win_bonus      ? parseFloat(form.win_bonus)      : null,
      contract_start:  form.contract_start  || null,
      contract_end:    form.contract_end    || null,
      contract_status: form.contract_status || 'Active',
      contract_notes:  form.contract_notes  || null,
    }
    if (hasStampCols) {
      if (editId){payload.updated_by=userId;payload.updated_at=now}
      else{payload.logged_by=userId;payload.logged_at=now}
    }
    if (editId) {
      const url=await uploadPhoto(editId)
      if (url) payload.photo_url=url
      const {error}=await scopeTeam(supabase.from('coaches').update(payload).eq('id',editId), teamId)
      if (error){setFormError('Update failed: '+error.message);setSaving(false);return}
    } else {
      const {data:nc,error}=await supabase.from('coaches').insert([payload]).select().single()
      if (error){setFormError('Save failed: '+error.message);setSaving(false);return}
      const url=await uploadPhoto(nc.id)
      if (url) await scopeTeam(supabase.from('coaches').update({photo_url:url}).eq('id',nc.id), teamId)
    }
    // Clear draft on successful save
    try { localStorage.removeItem(DRAFT_KEY) } catch (_) {}
    setHasDraft(false); setDraftSavedAt(null)
    setShowForm(false);setForm(EMPTY_FORM);setPhotoFile(null);setPhotoPreview(null);setSaving(false);fetchData()
  }

  async function handleDelete(id,name) {
    if (!confirm(`Remove ${name} from staff?`))return
    setDeleting(id)
    const {error}=await scopeTeam(supabase.from('coaches').delete().eq('id',id), teamId)
    if (error) alert('Delete failed: '+error.message)
    else fetchData()
    setDeleting(null)
  }

  async function toggleActive(id,current) {
    const update={is_active:!current}
    if (hasStampCols){update.updated_by=currentUser?.id||null;update.updated_at=new Date().toISOString()}
    await scopeTeam(supabase.from('coaches').update(update).eq('id',id), teamId)
    fetchData()
  }

  const filtered=activeTab==='All'?coaches:coaches.filter(c=>getStaffType(c.staff_type).dept===activeTab)
  const deptCounts={}
  DEPT_TABS.forEach(d=>{deptCounts[d.key]=d.key==='All'?coaches.length:coaches.filter(c=>getStaffType(c.staff_type).dept===d.key).length})
  const nowStr=new Date().toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
  const activeContracts=coaches.filter(c=>c.contract_status==='Active'&&c.monthly_salary)
  const totalWageBill=activeContracts.reduce((s,c)=>s+(parseFloat(c.monthly_salary)||0),0)
  const expiringContracts=coaches.filter(c=>{ const d=daysLeft(c.contract_end); return d!==null&&d>=0&&d<=90 })

  const sportConfig = getSportConfig(sportType)
  const pageTitle = sportConfig.labels?.coaches || 'Team & Staff'

  return (
    <Layout>
      <div className="page-outer">
        <PageHeader label="Organisation" title={pageTitle} subtitle={`${coaches.length} staff member${coaches.length!==1?'s':''} across departments`} action={<button className="btn-blue" onClick={openAdd}>+ Add Staff Member</button>}/>

        {/* Main View Toggle */}
        <div style={{ display:'flex', gap:4, marginBottom:24, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:4, width:'fit-content' }}>
          {[{key:'staff',label:'Staff Directory'},{key:'contracts',label:'Staff Contracts'}].map(v=>(
            <button key={v.key} onClick={()=>setMainView(v.key)} style={{ padding:'8px 20px', background:mainView===v.key?'#0D9488':'transparent', border:'none', borderRadius:'var(--r-md)', fontSize:13, fontWeight:700, color:mainView===v.key?'#fff':'var(--text2)', cursor:'pointer', transition:'var(--transition)', fontFamily:'var(--font)' }}>
              {v.label}
              {v.key==='contracts'&&activeContracts.length>0&&<span style={{ marginLeft:6,fontSize:11,background:mainView==='contracts'?'rgba(255,255,255,0.25)':'var(--surface3)',padding:'1px 7px',borderRadius:99 }}>{activeContracts.length}</span>}
            </button>
          ))}
        </div>

        {mainView === 'contracts' ? (
          /* ─────────────────── STAFF CONTRACTS VIEW ─────────────────── */
          <div className="fade-up">
            {/* Contract Summary Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14, marginBottom:24 }}>
              {[
                { label:'Active Staff Contracts', value:activeContracts.length, color:'#0D9488' },
                { label:'Monthly Wage Bill', value:currency(totalWageBill), color:'#276749' },
                { label:'Expiring (90 days)', value:expiringContracts.length, color:'#B45309' },
                { label:'Total Staff', value:coaches.length, color:'#4A90E2' },
              ].map(s=>(
                <div key={s.label} className="card" style={{ padding:'18px 20px', borderTop:`3px solid ${s.color}` }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>{s.label}</div>
                  <div style={{ fontSize:24, fontWeight:900, color:s.color, letterSpacing:'-0.03em' }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Contracts Table */}
            <div className="card" style={{ overflow:'hidden' }}>
              <div style={{ padding:'16px 22px', borderBottom:'1px solid var(--border)', background:'var(--surface2)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <h3 style={{ fontSize:14, fontWeight:800, color:'var(--text)', margin:0 }}>Staff Contract Terms</h3>
                <span style={{ fontSize:12, color:'var(--text3)' }}>Click any row to edit contract terms</span>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead style={{ background:'var(--surface2)' }}>
                    <tr>
                      {['Staff Member','Role','Monthly Salary','Win Bonus','Contract Period','Status','Days Left','Actions'].map(h=>(
                        <th key={h} style={{ padding:'10px 16px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text3)', textAlign:'left', borderBottom:'1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {coaches.length===0?(
                      <tr><td colSpan={8} style={{ padding:'40px', textAlign:'center', color:'var(--text3)' }}>No staff yet. Add your first staff member.</td></tr>
                    ):coaches.map((coach,ci)=>{
                      const st=getStaffType(coach.staff_type)
                      const dl=daysLeft(coach.contract_end)
                      const contractColor=coach.contract_status==='Active'?'#1B7A3E':coach.contract_status==='Expired'?'#B91C1C':'#B45309'
                      const contractBg=coach.contract_status==='Active'?'#E8F8EE':coach.contract_status==='Expired'?'#FDEDEC':'#FEF9E7'
                      return(
                        <tr key={coach.id} style={{ borderBottom:'1px solid var(--border)', cursor:'pointer' }} onClick={()=>openEdit(coach)}
                          onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                          onMouseLeave={e=>e.currentTarget.style.background=''}>
                          <td style={{ padding:'12px 16px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <StaffAvatar staff={coach} size={32}/>
                              <div>
                                <div style={{ fontWeight:700, color:'var(--text)', fontSize:13 }}>{coach.name}</div>
                                <div style={{ fontSize:10, color:'var(--text3)' }}>{coach.email||coach.phone||'—'}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding:'12px 16px' }}><span style={{ fontSize:11, fontWeight:600, background:st.color+'18', color:st.color, padding:'3px 9px', borderRadius:99 }}>{st.label}</span></td>
                          <td style={{ padding:'12px 16px', fontWeight:800, color:'#276749' }}>{coach.monthly_salary?currency(coach.monthly_salary):<span style={{color:'var(--text3)',fontStyle:'italic',fontWeight:400}}>Not set</span>}</td>
                          <td style={{ padding:'12px 16px', color:'var(--text2)' }}>{coach.win_bonus?currency(coach.win_bonus):'—'}</td>
                          <td style={{ padding:'12px 16px', fontSize:12, color:'var(--text3)' }}>{coach.contract_start||'—'} → {coach.contract_end||'—'}</td>
                          <td style={{ padding:'12px 16px' }}>
                            {coach.contract_status?<span style={{ fontSize:11, fontWeight:700, background:contractBg, color:contractColor, padding:'3px 9px', borderRadius:99 }}>{coach.contract_status}</span>:<span style={{color:'var(--text3)',fontSize:11}}>—</span>}
                          </td>
                          <td style={{ padding:'12px 16px', fontSize:12 }}>
                            {dl!==null?(
                              <span style={{ fontWeight:700, color:dl<30?'#B91C1C':dl<90?'#B45309':'#276749' }}>{dl<0?'Expired':`${dl}d`}</span>
                            ):'—'}
                          </td>
                          <td style={{ padding:'12px 16px' }}>
                            <button onClick={e=>{e.stopPropagation();openEdit(coach)}} style={{ background:'var(--surface3)', border:'1px solid var(--border)', color:'var(--text2)', padding:'5px 12px', borderRadius:'var(--r-sm)', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>Edit Contract</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
        /* ─────────────────── STAFF DIRECTORY VIEW ─────────────────── */
        <>
        {/* Dept stats */}
        <div className="fade-up stat-grid-5" style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:14,marginBottom:24 }}>
          {DEPT_TABS.filter(d=>d.key!=='All').map(dept=>{
            const count=deptCounts[dept.key]||0
            const active=coaches.filter(c=>getStaffType(c.staff_type).dept===dept.key&&c.is_active!==false).length
            return(
              <div key={dept.key} className="card" style={{ padding:'16px 18px',cursor:'pointer',transition:'var(--transition)',borderTop:`3px solid ${dept.color}`,opacity:activeTab!=='All'&&activeTab!==dept.key?0.55:1 }}
                onClick={()=>setActiveTab(activeTab===dept.key?'All':dept.key)}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='var(--shadow-md)'}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='var(--shadow-sm)'}}>
                <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8 }}><span style={{ fontSize:20 }}>{dept.icon}</span><span style={{ fontSize:12,fontWeight:700,color:'var(--text2)' }}>{dept.label}</span></div>
                <div style={{ fontSize:26,fontWeight:900,color:'var(--text)',lineHeight:1,marginBottom:3 }}>{count}</div>
                <div style={{ fontSize:11,color:'var(--text3)' }}>{active} active</div>
              </div>
            )
          })}
        </div>

        {/* Tabs */}
        <div className="fade-up tabs-scroll" style={{ display:'flex',gap:4,marginBottom:22,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:4,width:'fit-content',maxWidth:'100%',flexWrap:'wrap' }}>
          {DEPT_TABS.map(dept=>(
            <button key={dept.key} onClick={()=>setActiveTab(dept.key)} style={{ padding:'8px 16px',background:activeTab===dept.key?dept.color:'transparent',border:'none',borderRadius:'var(--r-md)',fontSize:13,fontWeight:600,color:activeTab===dept.key?'#fff':'var(--text2)',cursor:'pointer',transition:'var(--transition)',whiteSpace:'nowrap',fontFamily:'var(--font)' }}>
              {dept.icon} {dept.label}
              {deptCounts[dept.key]>0&&<span style={{ marginLeft:5,fontSize:11,background:activeTab===dept.key?'rgba(255,255,255,0.25)':'var(--surface3)',padding:'1px 6px',borderRadius:99 }}>{deptCounts[dept.key]}</span>}
            </button>
          ))}
        </div>

        {/* Staff cards */}
        {loading?(
          <div style={{ padding:'60px',textAlign:'center' }}>
            <div style={{ width:32,height:32,border:'4px solid #F0FDFA',borderTopColor:'#0D9488',borderRadius:'50%',animation:'spin 0.7s linear infinite',margin:'0 auto 10px' }}/>
            <p style={{ color:'var(--text3)',fontSize:13 }}>Loading staff…</p>
          </div>
        ):filtered.length===0?(
          <div className="card" style={{ padding:'52px',textAlign:'center' }}>
            <div style={{ fontSize:44,marginBottom:14 }}></div>
            <div style={{ fontSize:17,fontWeight:700,color:'var(--text)',marginBottom:8 }}>No staff in this department</div>
            <div style={{ fontSize:13,color:'var(--text3)',marginBottom:20 }}>Add your first staff member to get started.</div>
            <button className="btn-blue" onClick={openAdd}>+ Add Staff Member</button>
          </div>
        ):(
          <div className="staff-card-grid" style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:18 }}>
            {filtered.map((coach,ci)=>{
              const st=getStaffType(coach.staff_type)
              const squad=coach.athletes||[]
              const injured=squad.filter(a=>a.status==='Injured').length
              const isCoachType=['head_coach','assistant_coach','fitness_coach'].includes(coach.staff_type)
              return(
                <div key={coach.id} className="card fade-up" style={{ padding:0,overflow:'hidden',opacity:coach.is_active===false?0.65:1,transition:'var(--transition)' }}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='var(--shadow-lg)'}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='var(--shadow-sm)'}}>

                  <div style={{ background:'var(--surface2)',borderBottom:'1px solid var(--border)',padding:'18px 20px' }}>
                    <div style={{ display:'flex',gap:12,alignItems:'flex-start' }}>
                      <StaffAvatar staff={coach} size={54}/>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:10,color:'var(--text3)',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:3 }}>{st.icon} {st.label}</div>
                        <div style={{ fontSize:16,fontWeight:800,color:'var(--text)',marginBottom:3 }}>{coach.name}</div>
                        <div style={{ fontSize:11,color:'var(--text2)' }}>
                          {coach.experience_years?`${coach.experience_years} yrs exp`:''}
                          {coach.phone?(coach.experience_years?` · ${coach.phone}`:coach.phone):''}
                        </div>
                        {coach.email&&<div style={{ fontSize:11,color:'var(--text3)',marginTop:2 }}>{coach.email}</div>}
                      </div>
                      <span style={{ fontSize:9,fontWeight:700,background:coach.is_active!==false?'var(--success-light,rgba(39,174,96,0.12))':'var(--danger-light)',color:coach.is_active!==false?'var(--success,#16a34a)':'var(--danger)',padding:'3px 9px',borderRadius:99,flexShrink:0,letterSpacing:'0.06em',textTransform:'uppercase',border:`1px solid ${coach.is_active!==false?'rgba(39,174,96,0.25)':'rgba(231,76,60,0.25)'}` }}>
                        {coach.is_active!==false?'● Active':'○ Inactive'}
                      </span>
                    </div>
                    <div style={{ display:'flex',gap:6,marginTop:12,flexWrap:'wrap' }}>
                      <button onClick={()=>openEdit(coach)} style={{ background:'var(--surface)',color:'var(--text2)',border:'1px solid var(--border)',padding:'5px 12px',borderRadius:'var(--r-sm)',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)' }}>Edit</button>
                      <button onClick={()=>toggleActive(coach.id,coach.is_active!==false)} style={{ background:'var(--surface)',color:'var(--text2)',border:'1px solid var(--border)',padding:'5px 12px',borderRadius:'var(--r-sm)',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)' }}>{coach.is_active!==false?'Deactivate':'Activate'}</button>
                      <button onClick={()=>handleDelete(coach.id,coach.name)} disabled={deleting===coach.id} style={{ background:'var(--danger-light)',color:'var(--danger)',border:'1px solid rgba(231,76,60,0.25)',padding:'5px 12px',borderRadius:'var(--r-sm)',fontSize:11,fontWeight:600,cursor:'pointer',opacity:deleting===coach.id?0.5:1,fontFamily:'var(--font)' }}>{deleting===coach.id?'…':'Remove'}</button>
                    </div>
                  </div>

                  <div style={{ padding:'14px 18px' }}>
                    {coach.speciality&&<div style={{ fontSize:12,color:'var(--text2)',marginBottom:12,background:'var(--surface2)',padding:'7px 12px',borderRadius:'var(--r-sm)',display:'flex',gap:6,alignItems:'center',border:'1px solid var(--border)' }}><IconStar size={13} color="#F39C12" style={{flexShrink:0}} /><span><strong>Speciality:</strong> {coach.speciality}</span></div>}

                    {/* Contract summary chip */}
                    {coach.monthly_salary&&(
                      <div style={{ display:'flex',gap:8,marginBottom:12,flexWrap:'wrap' }}>
                        <div style={{ fontSize:11,fontWeight:700,background:'rgba(4,120,87,0.1)',color:'#047857',padding:'4px 10px',borderRadius:99,border:'1px solid rgba(4,120,87,0.2)',display:'flex',alignItems:'center',gap:5 }}>
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L14 4v4c0 3.5-2.5 6.5-6 7.5C2.5 14.5 0 11.5 0 8V4l6-2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                          {currency(coach.monthly_salary)}/mo
                        </div>
                        {coach.win_bonus&&<div style={{ fontSize:11,fontWeight:700,background:'rgba(180,83,9,0.1)',color:'#B45309',padding:'4px 10px',borderRadius:99,border:'1px solid rgba(180,83,9,0.2)' }}>Bonus: {currency(coach.win_bonus)}</div>}
                        {coach.contract_status&&<div style={{ fontSize:10,fontWeight:700,background:coach.contract_status==='Active'?'#E8F8EE':'#FDEDEC',color:coach.contract_status==='Active'?'#1B7A3E':'#B91C1C',padding:'4px 9px',borderRadius:99 }}>{coach.contract_status}</div>}
                      </div>
                    )}

                    {['physio','medical','sports_scientist','analyst','scout','accountant'].includes(coach.staff_type)&&(
                      <div style={{ background:'var(--surface2)',borderRadius:'var(--r-md)',padding:'7px 12px',fontSize:12,color:'var(--text2)',marginBottom:10,border:'1px solid var(--border)' }}>
                        {coach.staff_type==='physio'&&'Medical access — injury records & rehab'}
                        {coach.staff_type==='medical'&&'Medical officer — clinical oversight'}
                        {coach.staff_type==='sports_scientist'&&'Sports science — GPS & load monitoring'}
                        {coach.staff_type==='analyst'&&'Performance analyst — xG, xA & metrics'}
                        {coach.staff_type==='scout'&&'Scout — recruitment & talent ID'}
                        {coach.staff_type==='accountant'&&'Accountant — ApexPay portal access'}
                      </div>
                    )}

                    {isCoachType&&(
                      <>
                        <div style={{ fontSize:11,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)',marginBottom:10 }}>Assigned Athletes ({squad.length})</div>
                        {squad.length===0?<p style={{ fontSize:12,color:'var(--text3)',fontStyle:'italic' }}>No athletes assigned.</p>:squad.slice(0,4).map((ath,i)=>(
                          <div key={ath.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:i<Math.min(squad.length,4)-1?'1px solid var(--border)':'none' }}>
                            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                              {ath.photo_url?<img src={ath.photo_url} alt={ath.name} style={{ width:26,height:26,borderRadius:'50%',objectFit:'cover',border:'2px solid var(--border)',flexShrink:0 }}/>:<div style={{ width:26,height:26,borderRadius:'50%',background:AV_COLORS[i%AV_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,color:'#fff',flexShrink:0 }}>{initials(ath.name)}</div>}
                              <div><span style={{ fontSize:12,fontWeight:600,color:'var(--text)' }}>{ath.name}</span><span style={{ color:'var(--text3)',marginLeft:5,fontSize:10 }}>{ath.position}</span></div>
                            </div>
                            <Badge status={ath.status}/>
                          </div>
                        ))}
                        {squad.length>4&&<div style={{ fontSize:11,color:'var(--text3)',marginTop:6,fontStyle:'italic' }}>+{squad.length-4} more</div>}
                        {injured>0&&<div style={{ marginTop:10,fontSize:12,color:'var(--danger)',fontWeight:600,background:'var(--danger-light)',padding:'6px 10px',borderRadius:'var(--r-sm)' }}>{injured} athlete{injured>1?'s':''} injured</div>}
                      </>
                    )}

                    <PostStamp loggedBy={coach.logged_profile?.full_name} loggedAt={coach.logged_at} updatedBy={coach.updated_profile?.full_name} updatedAt={coach.updated_at}/>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        </>
        )}
      </div>

      {showForm&&(
        <div style={{ position:'fixed',inset:0,background:'rgba(15,23,42,0.6)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
          <div style={{ background:'#FFFFFF',borderRadius:'20px',width:'100%',maxWidth:560,maxHeight:'92vh',overflow:'auto',boxShadow:'0 25px 60px -10px rgba(0,0,0,0.25)',border:'1px solid #E2E8F0' }}>
            <div style={{ background:'linear-gradient(135deg,#0F766E,#0D9488)',padding:'20px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',borderRadius:'20px 20px 0 0' }}>
              <div>
                <div style={{ fontSize:10,color:'rgba(255,255,255,0.55)',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:4 }}>{editId?'Edit Record':'New Staff Member'}</div>
                <h2 style={{ fontSize:18,fontWeight:800,color:'#fff',margin:0 }}>{editId?'Edit Staff Member':'Add Staff Member'}</h2>
              </div>
              <button onClick={()=>{setShowForm(false);setFormError('')}} style={{ background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.25)',width:36,height:36,borderRadius:'50%',fontSize:20,cursor:'pointer',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,lineHeight:1 }}>×</button>
            </div>

            <div style={{ padding:24,display:'flex',flexDirection:'column',gap:16 }}>
              {formError&&<div style={{ background:'var(--danger-light)',border:'1px solid rgba(231,76,60,0.25)',borderRadius:'var(--r-md)',padding:'10px 14px',fontSize:13,color:'var(--danger)',fontWeight:600 }}>{formError}</div>}

              {/* Auto-save / Draft status banner */}
              {!editId && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8,
                  background: hasDraft && !draftSavedAt ? 'rgba(234,179,8,0.08)' : 'rgba(13,148,136,0.07)',
                  border: `1px solid ${hasDraft && !draftSavedAt ? 'rgba(234,179,8,0.35)' : 'rgba(13,148,136,0.2)'}`,
                  borderRadius:10, padding:'9px 14px' }}>
                  <span style={{ fontSize:12, fontWeight:600, color: hasDraft && !draftSavedAt ? '#92400E' : '#0F766E', display:'flex', alignItems:'center', gap:6 }}>
                    {draftSavedAt
                      ? <>✓ Draft auto-saved at {draftSavedAt.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</>
                      : hasDraft
                        ? <>⚠ Restored unsaved draft — continue where you left off</>
                        : <>📝 Auto-save enabled — changes saved automatically</>}
                  </span>
                  {(draftSavedAt || hasDraft) && (
                    <button onClick={clearStaffDraft} style={{ fontSize:11, fontWeight:700, color:'#64748B', background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'3px 10px', cursor:'pointer', fontFamily:'var(--font)' }}>
                      Clear Draft
                    </button>
                  )}
                </div>
              )}

              {/* Photo upload */}
              <div>
                <label style={lbl}>Passport / Staff Photo</label>
                <div style={{ display:'flex',alignItems:'center',gap:16 }}>
                  <div style={{ width:84,height:84,borderRadius:'50%',background:'#F0FDFA',border:'3px dashed #99F6E4',overflow:'hidden',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center' }}>
                    {photoPreview?<img src={photoPreview} alt="Preview" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>:<div style={{ width:34,height:34,borderRadius:'50%',background:'rgba(13,148,136,0.1)',display:'flex',alignItems:'center',justifyContent:'center' }}><IconCamera size={18} color="#0D9488" /></div>}
                  </div>
                  <div>
                    <label htmlFor="staff-photo-upload" style={{ display:'inline-block',background:'#F0FDFA',color:'#0F766E',border:'1px solid #CCFBF1',padding:'8px 18px',borderRadius:'8px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'var(--font)' }}>
                      {photoPreview?'Change Photo':'Upload Photo'}
                    </label>
                    <input id="staff-photo-upload" type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];if(!f)return;setPhotoFile(f);setPhotoPreview(URL.createObjectURL(f))}} style={{ display:'none' }}/>
                    {photoPreview&&<button onClick={()=>{setPhotoFile(null);setPhotoPreview(null)}} style={{ marginLeft:8,background:'var(--danger-light)',color:'var(--danger)',border:'none',padding:'7px 14px',borderRadius:'var(--r-sm)',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)' }}>Remove</button>}
                    <p style={{ fontSize:11,color:'var(--text3)',marginTop:6 }}>Passport-style. JPG or PNG.</p>
                  </div>
                </div>
              </div>

              <div><label style={lbl}>Full Name *</label><input value={form.name} onChange={e=>set('name')(e.target.value)} style={inp} placeholder="e.g. Dr. Emmanuel Mensah" onFocus={e=>e.target.style.borderColor='#0D9488'} onBlur={e=>e.target.style.borderColor='var(--border)'}/></div>

              <div>
                <label style={lbl}>Staff Type / Department *</label>
                <select value={form.staff_type} onChange={e=>set('staff_type')(e.target.value)} style={inp}>
                  <optgroup label="Coaching"><option value="head_coach">Head Coach</option><option value="assistant_coach">Assistant Coach</option><option value="fitness_coach">Fitness Coach</option></optgroup>
                  <optgroup label="Medical"><option value="physio">Physiotherapist</option><option value="sports_scientist">Sports Scientist</option><option value="medical">Medical Officer</option></optgroup>
                  <optgroup label="Analytics & Scouting"><option value="analyst">Performance Analyst</option><option value="scout">Scout</option></optgroup>
                  <optgroup label="Other"><option value="kit_manager">Kit Manager</option><option value="accountant">Accountant</option><option value="other">Other</option></optgroup>
                </select>
              </div>

              <div><label style={lbl}>Speciality / Qualification</label><input value={form.speciality} onChange={e=>set('speciality')(e.target.value)} style={inp} placeholder="e.g. UEFA A Licence, MSc Sports Science" onFocus={e=>e.target.style.borderColor='#0D9488'} onBlur={e=>e.target.style.borderColor='var(--border)'}/></div>

              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
                <div><label style={lbl}>Years Experience</label><input type="number" min="0" max="50" value={form.experience_years} onChange={e=>set('experience_years')(e.target.value)} style={inp} onFocus={e=>e.target.style.borderColor='#0D9488'} onBlur={e=>e.target.style.borderColor='var(--border)'}  /></div>
                <div><label style={lbl}>Phone</label><input value={form.phone} onChange={e=>set('phone')(e.target.value)} style={inp} placeholder="+233 24 000 0000" onFocus={e=>e.target.style.borderColor='#0D9488'} onBlur={e=>e.target.style.borderColor='var(--border)'}  /></div>
              </div>

              <div><label style={lbl}>Email Address</label><input type="email" value={form.email} onChange={e=>set('email')(e.target.value)} style={inp} placeholder="staff@club.gh" onFocus={e=>e.target.style.borderColor='#0D9488'} onBlur={e=>e.target.style.borderColor='var(--border)'}/></div>

              {/* Contract Terms Section */}
              <div style={{ borderTop:'2px solid var(--border)', paddingTop:16, marginTop:4 }}>
                <div style={{ fontSize:12, fontWeight:800, color:'#0D9488', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L14 4v4c0 3.5-2.5 6.5-6 7.5C2.5 14.5 0 11.5 0 8V4l6-2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                  Contract Terms
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                  <div><label style={lbl}>Monthly Salary (GHS)</label><input type="number" min="0" value={form.monthly_salary} onChange={e=>set('monthly_salary')(e.target.value)} style={inp} placeholder="0.00" onFocus={e=>e.target.style.borderColor='#0D9488'} onBlur={e=>e.target.style.borderColor='var(--border)'}/></div>
                  <div><label style={lbl}>Win Bonus (GHS)</label><input type="number" min="0" value={form.win_bonus} onChange={e=>set('win_bonus')(e.target.value)} style={inp} placeholder="0.00" onFocus={e=>e.target.style.borderColor='#0D9488'} onBlur={e=>e.target.style.borderColor='var(--border)'}/></div>
                  <div><label style={lbl}>Contract Start</label><input type="date" value={form.contract_start} onChange={e=>set('contract_start')(e.target.value)} style={inp}/></div>
                  <div><label style={lbl}>Contract End</label><input type="date" value={form.contract_end} onChange={e=>set('contract_end')(e.target.value)} style={inp}/></div>
                </div>
                <div style={{ marginTop:14 }}>
                  <label style={lbl}>Contract Status</label>
                  <select value={form.contract_status} onChange={e=>set('contract_status')(e.target.value)} style={inp}>
                    {['Active','Expired','Terminated','Negotiating'].map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ marginTop:14 }}><label style={lbl}>Contract Notes</label><textarea value={form.contract_notes} onChange={e=>set('contract_notes')(e.target.value)} rows={2} style={{ ...inp, resize:'vertical' }} placeholder="Additional terms, clauses or notes…"/></div>
              </div>

              <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'var(--surface2)',borderRadius:'var(--r-md)',border:'1px solid var(--border)' }}>
                <input type="checkbox" id="isactive" checked={form.is_active} onChange={e=>set('is_active')(e.target.checked)} style={{ width:16,height:16,cursor:'pointer',accentColor:'#0D9488' }}/>
                <label htmlFor="isactive" style={{ fontSize:13,fontWeight:600,color:'var(--text)',cursor:'pointer' }}>Active staff member</label>
                <span style={{ fontSize:11,color:'var(--text3)',marginLeft:'auto' }}>{form.is_active?'● Visible':'○ Hidden'}</span>
              </div>

              {currentUser&&(
                <div style={{ background:'linear-gradient(135deg,rgba(74,144,226,0.08),rgba(74,144,226,0.03))',borderRadius:'var(--r-md)',padding:'12px 16px',border:'1px solid rgba(74,144,226,0.2)',position:'relative',overflow:'hidden' }}>
                  <div style={{ position:'absolute',top:0,left:0,width:3,height:'100%',background:'linear-gradient(180deg,#4A90E2,#9B59B6)',borderRadius:'3px 0 0 3px' }}/>
                  <div style={{ fontSize:11,color:'#0F766E',fontWeight:700,marginBottom:5 }}>Record will be stamped:</div>
                  <div style={{ display:'inline-flex',alignItems:'center',gap:6,background:'rgba(74,144,226,0.12)',borderRadius:99,padding:'4px 12px' }}>
                    <span style={{ fontSize:13 }}></span>
                    <span style={{ fontSize:12,fontWeight:700,color:'#2E6FC4' }}>{currentUser.full_name}</span>
                    <span style={{ fontSize:11,color:'#7A9CC4' }}>· {nowStr}</span>
                  </div>
                </div>
              )}

              <div style={{ display:'flex',gap:10,paddingTop:8 }}>
                <button onClick={()=>{setShowForm(false);setFormError('')}} style={{ flex:1,background:'#F1F5F9',border:'1px solid #E2E8F0',color:'#334155',padding:'12px',borderRadius:'12px',fontSize:14,cursor:'pointer',fontWeight:800,fontFamily:'var(--font)' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ flex:2,padding:'12px',opacity:saving?0.7:1,fontSize:14,background:'linear-gradient(135deg,#0F766E,#0D9488)',border:'none',color:'#fff',borderRadius:'12px',cursor:'pointer',fontWeight:900,fontFamily:'var(--font)' }}>{saving?'Saving…':editId?'Save Changes':'Add Staff Member'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
