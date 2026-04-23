'use client'
import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import Badge from '@/components/Badge'
import { supabase } from '@/lib/supabase'

const STAFF_TYPES = [
  { value:'head_coach',       label:'Head Coach',          icon:'🎯', color:'#4A90E2', dept:'Coaching'   },
  { value:'assistant_coach',  label:'Assistant Coach',     icon:'📋', color:'#2E6FC4', dept:'Coaching'   },
  { value:'fitness_coach',    label:'Fitness Coach',       icon:'💪', color:'#27AE60', dept:'Coaching'   },
  { value:'physio',           label:'Physiotherapist',     icon:'🩺', color:'#E67E22', dept:'Medical'    },
  { value:'sports_scientist', label:'Sports Scientist',    icon:'🔬', color:'#E74C3C', dept:'Medical'    },
  { value:'medical',          label:'Medical Officer',     icon:'⚕️', color:'#C0392B', dept:'Medical'    },
  { value:'analyst',          label:'Performance Analyst', icon:'📊', color:'#9B59B6', dept:'Analytics'  },
  { value:'scout',            label:'Scout',               icon:'🔍', color:'#1ABC9C', dept:'Scouting'   },
  { value:'kit_manager',      label:'Kit Manager',         icon:'👕', color:'#F39C12', dept:'Other'      },
  { value:'other',            label:'Other',               icon:'👤', color:'#7F8C8D', dept:'Other'      },
]

const DEPT_TABS = [
  { key:'All',       label:'All Staff',  icon:'👥', color:'#4A90E2' },
  { key:'Coaching',  label:'Coaching',   icon:'🎯', color:'#2E6FC4' },
  { key:'Medical',   label:'Medical',    icon:'🩺', color:'#E67E22' },
  { key:'Analytics', label:'Analytics',  icon:'📊', color:'#9B59B6' },
  { key:'Scouting',  label:'Scouting',   icon:'🔍', color:'#1ABC9C' },
  { key:'Other',     label:'Other',      icon:'👤', color:'#7F8C8D' },
]

const AV_COLORS = ['#4A90E2','#27AE60','#E67E22','#9B59B6','#E74C3C','#1ABC9C']

function initials(n) { return (n||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }
function getStaffType(val) { return STAFF_TYPES.find(t=>t.value===val)||{label:val||'Staff',icon:'👤',color:'#7F8C8D',dept:'Other'} }

function StaffAvatar({ staff, size=54 }) {
  const [err, setErr] = useState(false)
  if (staff?.photo_url && !err) {
    return <img src={staff.photo_url} alt={staff.name} onError={()=>setErr(true)} style={{ width:size,height:size,borderRadius:'50%',objectFit:'cover',border:'3px solid rgba(255,255,255,0.5)',flexShrink:0,boxShadow:'0 2px 8px rgba(0,0,0,0.15)' }}/>
  }
  return (
    <div style={{ width:size,height:size,borderRadius:'50%',flexShrink:0,background:'rgba(255,255,255,0.22)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.32,fontWeight:800,color:'#fff',border:'2px solid rgba(255,255,255,0.4)' }}>
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
          <span style={{ fontSize:11 }}>🖊</span>
          <span style={{ fontSize:10,fontWeight:700,color:'#2E6FC4' }}>{loggedBy}</span>
          {loggedAt&&<span style={{ fontSize:10,color:'#7A9CC4' }}>· {fmt(loggedAt)}</span>}
        </div>
      )}
      {updatedBy && (
        <div style={{ display:'inline-flex',alignItems:'center',gap:5,background:'rgba(155,89,182,0.09)',border:'1px solid rgba(155,89,182,0.18)',borderRadius:99,padding:'3px 10px' }}>
          <span style={{ fontSize:11 }}>✏️</span>
          <span style={{ fontSize:10,fontWeight:700,color:'#7D3C98' }}>{updatedBy}</span>
          {updatedAt&&<span style={{ fontSize:10,color:'#9B59B6' }}>· {fmt(updatedAt)}</span>}
        </div>
      )}
    </div>
  )
}

const EMPTY_FORM = { name:'',staff_type:'assistant_coach',speciality:'',experience_years:'',phone:'',email:'',is_active:true }
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
  const [formError,    setFormError]    = useState('')
  const [currentUser,  setCurrentUser]  = useState(null)
  const [hasStampCols, setHasStampCols] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data:{session} } = await supabase.auth.getSession()
      if (session) {
        const { data:p } = await supabase.from('profiles').select('id,full_name,role').eq('id',session.user.id).single()
        setCurrentUser(p)
      }

      // Try with stamp cols first
      const r1 = await supabase.from('coaches')
        .select('*,athletes(id,name,position,status,photo_url),logged_profile:logged_by(full_name),updated_profile:updated_by(full_name)')
        .order('name')

      if (!r1.error) {
        setCoaches(r1.data||[])
        setHasStampCols(true)
      } else {
        // Fallback without stamp cols (columns not added yet)
        const r2 = await supabase.from('coaches').select('*,athletes(id,name,position,status,photo_url)').order('name')
        if (r2.error) console.error('Coaches fetch error:', r2.error.message)
        setCoaches(r2.data||[])
        setHasStampCols(false)
      }
    } catch(e) { console.error('fetchData error:', e) }
    setLoading(false)
  }, [])

  useEffect(()=>{ fetchData() },[fetchData])

  const set = k => v => setForm(f=>({...f,[k]:v}))

  function openAdd() { setEditId(null);setForm(EMPTY_FORM);setPhotoFile(null);setPhotoPreview(null);setFormError('');setShowForm(true) }
  function openEdit(c) {
    setEditId(c.id)
    setForm({name:c.name||'',staff_type:c.staff_type||'assistant_coach',speciality:c.speciality||'',experience_years:c.experience_years||'',phone:c.phone||'',email:c.email||'',is_active:c.is_active!==false})
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
    setSaving(true)
    const now=new Date().toISOString()
    const userId=currentUser?.id||null
    const payload={
      name:form.name.trim(),staff_type:form.staff_type,
      speciality:form.speciality||null,experience_years:parseInt(form.experience_years)||null,
      phone:form.phone||null,email:form.email||null,is_active:form.is_active,
    }
    if (hasStampCols) {
      if (editId){payload.updated_by=userId;payload.updated_at=now}
      else{payload.logged_by=userId;payload.logged_at=now}
    }
    if (editId) {
      const url=await uploadPhoto(editId)
      if (url) payload.photo_url=url
      const {error}=await supabase.from('coaches').update(payload).eq('id',editId)
      if (error){setFormError('Update failed: '+error.message);setSaving(false);return}
    } else {
      const {data:nc,error}=await supabase.from('coaches').insert([payload]).select().single()
      if (error){setFormError('Save failed: '+error.message);setSaving(false);return}
      const url=await uploadPhoto(nc.id)
      if (url) await supabase.from('coaches').update({photo_url:url}).eq('id',nc.id)
    }
    setShowForm(false);setForm(EMPTY_FORM);setPhotoFile(null);setPhotoPreview(null);setSaving(false);fetchData()
  }

  async function handleDelete(id,name) {
    if (!confirm(`Remove ${name} from staff?`))return
    setDeleting(id)
    const {error}=await supabase.from('coaches').delete().eq('id',id)
    if (error) alert('Delete failed: '+error.message)
    else fetchData()
    setDeleting(null)
  }

  async function toggleActive(id,current) {
    const update={is_active:!current}
    if (hasStampCols){update.updated_by=currentUser?.id||null;update.updated_at=new Date().toISOString()}
    await supabase.from('coaches').update(update).eq('id',id)
    fetchData()
  }

  const filtered=activeTab==='All'?coaches:coaches.filter(c=>getStaffType(c.staff_type).dept===activeTab)
  const deptCounts={}
  DEPT_TABS.forEach(d=>{deptCounts[d.key]=d.key==='All'?coaches.length:coaches.filter(c=>getStaffType(c.staff_type).dept===d.key).length})
  const nowStr=new Date().toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})

  return (
    <Layout>
      <div style={{ maxWidth:1280,margin:'0 auto',padding:'32px 40px' }}>
        <PageHeader label="Organisation" title="Team & Staff" subtitle={`${coaches.length} staff member${coaches.length!==1?'s':''} across departments`} action={<button className="btn-blue" onClick={openAdd}>+ Add Staff Member</button>}/>

        {/* Dept stats */}
        <div className="fade-up" style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:14,marginBottom:24 }}>
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
        <div className="fade-up" style={{ display:'flex',gap:4,marginBottom:22,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:4,width:'fit-content',flexWrap:'wrap' }}>
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
            <div style={{ width:32,height:32,border:'4px solid var(--blue-light)',borderTopColor:'var(--blue)',borderRadius:'50%',animation:'spin 0.7s linear infinite',margin:'0 auto 10px' }}/>
            <p style={{ color:'var(--text3)',fontSize:13 }}>Loading staff…</p>
          </div>
        ):filtered.length===0?(
          <div className="card" style={{ padding:'52px',textAlign:'center' }}>
            <div style={{ fontSize:44,marginBottom:14 }}>👥</div>
            <div style={{ fontSize:17,fontWeight:700,color:'var(--text)',marginBottom:8 }}>No staff in this department</div>
            <div style={{ fontSize:13,color:'var(--text3)',marginBottom:20 }}>Add your first staff member to get started.</div>
            <button className="btn-blue" onClick={openAdd}>+ Add Staff Member</button>
          </div>
        ):(
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:18 }}>
            {filtered.map((coach,ci)=>{
              const st=getStaffType(coach.staff_type)
              const squad=coach.athletes||[]
              const injured=squad.filter(a=>a.status==='Injured').length
              const isCoachType=['head_coach','assistant_coach','fitness_coach'].includes(coach.staff_type)
              return(
                <div key={coach.id} className="card fade-up" style={{ padding:0,overflow:'hidden',opacity:coach.is_active===false?0.65:1,transition:'var(--transition)' }}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='var(--shadow-lg)'}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='var(--shadow-sm)'}}>

                  <div style={{ background:`linear-gradient(135deg,${st.color}EE,${st.color}88)`,padding:'18px 20px' }}>
                    <div style={{ display:'flex',gap:12,alignItems:'flex-start' }}>
                      <StaffAvatar staff={coach} size={54}/>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:10,color:'rgba(255,255,255,0.7)',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:3 }}>{st.icon} {st.label}</div>
                        <div style={{ fontSize:16,fontWeight:800,color:'#fff',marginBottom:3 }}>{coach.name}</div>
                        <div style={{ fontSize:11,color:'rgba(255,255,255,0.65)' }}>
                          {coach.experience_years?`${coach.experience_years} yrs exp`:''}
                          {coach.phone?(coach.experience_years?` · ${coach.phone}`:coach.phone):''}
                        </div>
                        {coach.email&&<div style={{ fontSize:11,color:'rgba(255,255,255,0.55)',marginTop:2 }}>✉ {coach.email}</div>}
                      </div>
                      <span style={{ fontSize:9,fontWeight:700,background:coach.is_active!==false?'rgba(39,174,96,0.3)':'rgba(231,76,60,0.3)',color:coach.is_active!==false?'#A8F0C0':'#F5A0A0',padding:'3px 9px',borderRadius:99,flexShrink:0,letterSpacing:'0.06em',textTransform:'uppercase',border:`1px solid ${coach.is_active!==false?'rgba(39,174,96,0.4)':'rgba(231,76,60,0.4)'}` }}>
                        {coach.is_active!==false?'● Active':'○ Inactive'}
                      </span>
                    </div>
                    <div style={{ display:'flex',gap:6,marginTop:12,flexWrap:'wrap' }}>
                      <button onClick={()=>openEdit(coach)} style={{ background:'rgba(255,255,255,0.2)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',padding:'5px 12px',borderRadius:'var(--r-sm)',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)' }}>✏ Edit</button>
                      <button onClick={()=>toggleActive(coach.id,coach.is_active!==false)} style={{ background:'rgba(255,255,255,0.12)',color:'#fff',border:'1px solid rgba(255,255,255,0.22)',padding:'5px 12px',borderRadius:'var(--r-sm)',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)' }}>{coach.is_active!==false?'⏸ Deactivate':'▶ Activate'}</button>
                      <button onClick={()=>handleDelete(coach.id,coach.name)} disabled={deleting===coach.id} style={{ background:'rgba(231,76,60,0.25)',color:'#fdd',border:'1px solid rgba(231,76,60,0.35)',padding:'5px 12px',borderRadius:'var(--r-sm)',fontSize:11,fontWeight:600,cursor:'pointer',opacity:deleting===coach.id?0.5:1,fontFamily:'var(--font)' }}>{deleting===coach.id?'…':'🗑 Remove'}</button>
                    </div>
                  </div>

                  <div style={{ padding:'14px 18px' }}>
                    {coach.speciality&&<div style={{ fontSize:12,color:'var(--text2)',marginBottom:12,background:'var(--surface2)',padding:'7px 12px',borderRadius:'var(--r-sm)',display:'flex',gap:6,alignItems:'center',border:'1px solid var(--border)' }}><span>⭐</span><span><strong>Speciality:</strong> {coach.speciality}</span></div>}

                    {['physio','medical','sports_scientist','analyst','scout'].includes(coach.staff_type)&&(
                      <div style={{ background:coach.staff_type==='physio'?'#FEF9E7':coach.staff_type==='medical'||coach.staff_type==='sports_scientist'?'#FDEDEC':coach.staff_type==='analyst'?'#F3E5F5':'#E0F7F5',borderRadius:'var(--r-md)',padding:'7px 12px',fontSize:12,color:coach.staff_type==='physio'?'#B36200':coach.staff_type==='medical'||coach.staff_type==='sports_scientist'?'#C0392B':coach.staff_type==='analyst'?'#6A1B9A':'#0E8A7E',marginBottom:10 }}>
                        {coach.staff_type==='physio'&&'🩺 Medical access — injury records & rehab'}
                        {coach.staff_type==='medical'&&'⚕️ Medical officer — clinical oversight'}
                        {coach.staff_type==='sports_scientist'&&'🔬 Sports science — GPS & load monitoring'}
                        {coach.staff_type==='analyst'&&'📊 Performance analyst — xG, xA & metrics'}
                        {coach.staff_type==='scout'&&'🔍 Scout — recruitment & talent ID'}
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
                        {injured>0&&<div style={{ marginTop:10,fontSize:12,color:'var(--danger)',fontWeight:600,background:'var(--danger-light)',padding:'6px 10px',borderRadius:'var(--r-sm)' }}>⚠ {injured} athlete{injured>1?'s':''} injured</div>}
                      </>
                    )}

                    <PostStamp loggedBy={coach.logged_profile?.full_name} loggedAt={coach.logged_at} updatedBy={coach.updated_profile?.full_name} updatedAt={coach.updated_at}/>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showForm&&(
        <div style={{ position:'fixed',inset:0,background:'rgba(44,62,80,0.6)',backdropFilter:'blur(8px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:24 }}>
          <div style={{ background:'var(--surface)',borderRadius:'var(--r-xl)',width:'100%',maxWidth:560,maxHeight:'92vh',overflow:'auto',boxShadow:'var(--shadow-lg)',border:'1px solid var(--border)' }}>
            <div style={{ background:'linear-gradient(90deg,#2E6FC4,#4A90E2)',padding:'20px 28px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <div>
                <div style={{ fontSize:10,color:'rgba(255,255,255,0.55)',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:4 }}>{editId?'Edit Record':'New Staff Member'}</div>
                <h2 style={{ fontSize:20,fontWeight:800,color:'#fff' }}>{editId?'Edit Staff Member':'Add Staff Member'}</h2>
              </div>
              <button onClick={()=>{setShowForm(false);setFormError('')}} style={{ background:'rgba(255,255,255,0.2)',border:'none',width:36,height:36,borderRadius:'50%',fontSize:18,cursor:'pointer',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>×</button>
            </div>

            <div style={{ padding:28,display:'flex',flexDirection:'column',gap:16 }}>
              {formError&&<div style={{ background:'var(--danger-light)',border:'1px solid rgba(231,76,60,0.25)',borderRadius:'var(--r-md)',padding:'10px 14px',fontSize:13,color:'var(--danger)',fontWeight:600 }}>⚠ {formError}</div>}

              {/* Photo upload */}
              <div>
                <label style={lbl}>Passport / Staff Photo</label>
                <div style={{ display:'flex',alignItems:'center',gap:16 }}>
                  <div style={{ width:84,height:84,borderRadius:'50%',background:'var(--surface2)',border:'3px dashed var(--border)',overflow:'hidden',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center' }}>
                    {photoPreview?<img src={photoPreview} alt="Preview" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>:<span style={{ fontSize:34 }}>👤</span>}
                  </div>
                  <div>
                    <label htmlFor="staff-photo-upload" style={{ display:'inline-block',background:'var(--blue-light)',color:'var(--blue)',border:'1px solid rgba(74,144,226,0.3)',padding:'8px 18px',borderRadius:'var(--r-sm)',fontSize:12,fontWeight:600,cursor:'pointer' }}>
                      {photoPreview?'🔄 Change Photo':'📷 Upload Photo'}
                    </label>
                    <input id="staff-photo-upload" type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];if(!f)return;setPhotoFile(f);setPhotoPreview(URL.createObjectURL(f))}} style={{ display:'none' }}/>
                    {photoPreview&&<button onClick={()=>{setPhotoFile(null);setPhotoPreview(null)}} style={{ marginLeft:8,background:'var(--danger-light)',color:'var(--danger)',border:'none',padding:'7px 14px',borderRadius:'var(--r-sm)',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)' }}>✕ Remove</button>}
                    <p style={{ fontSize:11,color:'var(--text3)',marginTop:6 }}>Passport-style. JPG or PNG.</p>
                  </div>
                </div>
              </div>

              <div><label style={lbl}>Full Name *</label><input value={form.name} onChange={e=>set('name')(e.target.value)} style={inp} placeholder="e.g. Dr. Emmanuel Mensah" onFocus={e=>e.target.style.borderColor='var(--blue)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/></div>

              <div>
                <label style={lbl}>Staff Type / Department *</label>
                <select value={form.staff_type} onChange={e=>set('staff_type')(e.target.value)} style={inp}>
                  <optgroup label="🎯 Coaching"><option value="head_coach">Head Coach</option><option value="assistant_coach">Assistant Coach</option><option value="fitness_coach">Fitness Coach</option></optgroup>
                  <optgroup label="🩺 Medical"><option value="physio">Physiotherapist</option><option value="sports_scientist">Sports Scientist</option><option value="medical">Medical Officer</option></optgroup>
                  <optgroup label="📊 Analytics & Scouting"><option value="analyst">Performance Analyst</option><option value="scout">Scout</option></optgroup>
                  <optgroup label="⚙ Other"><option value="kit_manager">Kit Manager</option><option value="other">Other</option></optgroup>
                </select>
              </div>

              <div><label style={lbl}>Speciality / Qualification</label><input value={form.speciality} onChange={e=>set('speciality')(e.target.value)} style={inp} placeholder="e.g. UEFA A Licence, MSc Sports Science" onFocus={e=>e.target.style.borderColor='var(--blue)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/></div>

              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
                <div><label style={lbl}>Years Experience</label><input type="number" min="0" max="50" value={form.experience_years} onChange={e=>set('experience_years')(e.target.value)} style={inp} onFocus={e=>e.target.style.borderColor='var(--blue)'} onBlur={e=>e.target.style.borderColor='var(--border)'}  /></div>
                <div><label style={lbl}>Phone</label><input value={form.phone} onChange={e=>set('phone')(e.target.value)} style={inp} placeholder="+233 24 000 0000" onFocus={e=>e.target.style.borderColor='var(--blue)'} onBlur={e=>e.target.style.borderColor='var(--border)'}  /></div>
              </div>

              <div><label style={lbl}>Email Address</label><input type="email" value={form.email} onChange={e=>set('email')(e.target.value)} style={inp} placeholder="staff@club.gh" onFocus={e=>e.target.style.borderColor='var(--blue)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/></div>

              <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'var(--surface2)',borderRadius:'var(--r-md)',border:'1px solid var(--border)' }}>
                <input type="checkbox" id="isactive" checked={form.is_active} onChange={e=>set('is_active')(e.target.checked)} style={{ width:16,height:16,cursor:'pointer',accentColor:'var(--blue)' }}/>
                <label htmlFor="isactive" style={{ fontSize:13,fontWeight:600,color:'var(--text)',cursor:'pointer' }}>Active staff member</label>
                <span style={{ fontSize:11,color:'var(--text3)',marginLeft:'auto' }}>{form.is_active?'● Visible':'○ Hidden'}</span>
              </div>

              {currentUser&&(
                <div style={{ background:'linear-gradient(135deg,rgba(74,144,226,0.08),rgba(74,144,226,0.03))',borderRadius:'var(--r-md)',padding:'12px 16px',border:'1px solid rgba(74,144,226,0.2)',position:'relative',overflow:'hidden' }}>
                  <div style={{ position:'absolute',top:0,left:0,width:3,height:'100%',background:'linear-gradient(180deg,#4A90E2,#9B59B6)',borderRadius:'3px 0 0 3px' }}/>
                  <div style={{ fontSize:11,color:'var(--blue-dark)',fontWeight:700,marginBottom:5 }}>📋 Record will be stamped:</div>
                  <div style={{ display:'inline-flex',alignItems:'center',gap:6,background:'rgba(74,144,226,0.12)',borderRadius:99,padding:'4px 12px' }}>
                    <span style={{ fontSize:13 }}>🖊</span>
                    <span style={{ fontSize:12,fontWeight:700,color:'#2E6FC4' }}>{currentUser.full_name}</span>
                    <span style={{ fontSize:11,color:'#7A9CC4' }}>· {nowStr}</span>
                  </div>
                </div>
              )}

              <div style={{ display:'flex',gap:10,paddingTop:8 }}>
                <button onClick={()=>{setShowForm(false);setFormError('')}} style={{ flex:1,background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text2)',padding:'12px',borderRadius:'var(--r-md)',fontSize:14,cursor:'pointer',fontWeight:600,fontFamily:'var(--font)' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-blue" style={{ flex:2,padding:'12px',opacity:saving?0.7:1,fontSize:14 }}>{saving?'Saving…':editId?'Save Changes':'Add Staff Member'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}