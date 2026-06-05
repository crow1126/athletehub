'use client'
import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import Badge from '@/components/Badge'
import { supabase } from '@/lib/supabase'
import { getTenantProfile, scopeTeam } from '@/lib/tenant'
import Link from 'next/link'

const POSITION_GROUPS = {
  'Goalkeeper':  ['GK'],
  'Defenders':   ['CB','RB','LB','RWB','LWB'],
  'Midfielders': ['CDM','CM','CAM','RM','LM'],
  'Forwards':    ['RW','LW','CF','SS','ST'],
}

const REGIONS   = ['Greater Accra','Ashanti','Western','Eastern','Volta','Brong-Ahafo','Northern','Upper East','Upper West','Central']
const AV_COLORS = ['#0D9488','#059669','#0F766E','#14B8A6','#047857','#065F46']
const EMPTY     = {
  name: '',
  date_of_birth: '',
  age: '',
  position: '',
  strong_foot: '',
  region: '',
  club: '',
  phone: '',
  height: '',
  weight: '',
  coach_id: '',
  // New fields:
  first_name: '',
  last_name: '',
  membership_number: '',
  place_of_birth: '',
  nationality: '',
  address: '',
  country: '',
  email: '',
  landline: '',
  homepage: '',
  facebook: '',
  instagram: '',
  snapchat: '',
  team_section: '',
  back_number: '',
  passport_number: '',
  wrist_measurement: '',
  clothing_size: '',
  shoe_size: '',
  number_lettering: '',
  last_club: '',
  in_club_since: '',
  contract_until: '',
  contract_option_until: '',
  contract_details: '',
  iban: '',
  bic: '',
  tax_id: ''
}

function initials(n) { return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }

function AthleteAvatar({ athlete, size=40, index=0 }) {
  const [imgError, setImgError] = useState(false)
  if (athlete?.photo_url && !imgError) {
    return <img src={athlete.photo_url} alt={athlete.name} onError={() => setImgError(true)}
      style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--border)', flexShrink:0 }}/>
  }
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', flexShrink:0, background:AV_COLORS[index%AV_COLORS.length], display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.32, fontWeight:800, color:'#fff', border:'2px solid rgba(255,255,255,0.25)' }}>
      {initials(athlete?.name)}
    </div>
  )
}

const inp = { width:'100%', padding:'10px 14px', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:'12px', fontSize:14, outline:'none', color:'#0F172A', fontFamily:'var(--font)', transition:'border-color 0.2s' }
const lbl = { display:'block', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#64748B', marginBottom:6 }

export default function AthletesPage() {
  const [athletes,     setAthletes]     = useState([])
  const [coaches,      setCoaches]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [deleting,     setDeleting]     = useState(null)
  const [showForm,     setShowForm]     = useState(false)
  const [editId,       setEditId]       = useState(null)
  const [form,         setForm]         = useState(EMPTY)
  const [photoFile,    setPhotoFile]    = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [search,       setSearch]       = useState('')
  const [posFilter,    setPosFilter]    = useState('')
  const [statFilter,   setStatFilter]   = useState('')
  const [formError,    setFormError]    = useState('')
  const [teamId,       setTeamId]       = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { teamId: currentTeamId } = await getTenantProfile()
    setTeamId(currentTeamId)
    const [{ data:a }, { data:c }] = await Promise.all([
      scopeTeam(supabase.from('athletes').select('*, coaches(name)'), currentTeamId).order('created_at', { ascending:false }),
      scopeTeam(supabase.from('coaches').select('id, name'), currentTeamId).order('name'),
    ])
    setAthletes(a||[]); setCoaches(c||[]); setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const set = k => v => setForm(f => ({ ...f, [k]:v }))

  function openAdd() { setEditId(null); setForm(EMPTY); setPhotoFile(null); setPhotoPreview(null); setFormError(''); setShowForm(true) }

  function openEdit(ath) {
    setEditId(ath.id)
    setForm({
      name: ath.name||'',
      date_of_birth: ath.date_of_birth||'',
      age: ath.age||'',
      position: ath.position||'',
      strong_foot: ath.strong_foot||'',
      region: ath.region||'',
      club: ath.club||'',
      phone: ath.phone||'',
      height: ath.height||'',
      weight: ath.weight||'',
      coach_id: ath.coach_id||'',
      first_name: ath.first_name||'',
      last_name: ath.last_name||'',
      membership_number: ath.membership_number||'',
      place_of_birth: ath.place_of_birth||'',
      nationality: ath.nationality||'',
      address: ath.address||'',
      country: ath.country||'',
      email: ath.email||'',
      landline: ath.landline||'',
      homepage: ath.homepage||'',
      facebook: ath.facebook||'',
      instagram: ath.instagram||'',
      snapchat: ath.snapchat||'',
      team_section: ath.team_section||'',
      back_number: ath.back_number||'',
      passport_number: ath.passport_number||'',
      wrist_measurement: ath.wrist_measurement||'',
      clothing_size: ath.clothing_size||'',
      shoe_size: ath.shoe_size||'',
      number_lettering: ath.number_lettering||'',
      last_club: ath.last_club||'',
      in_club_since: ath.in_club_since||'',
      contract_until: ath.contract_until||'',
      contract_option_until: ath.contract_option_until||'',
      contract_details: ath.contract_details||'',
      iban: ath.iban||'',
      bic: ath.bic||'',
      tax_id: ath.tax_id||''
    })
    setPhotoFile(null); setPhotoPreview(ath.photo_url||null); setFormError(''); setShowForm(true)
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file))
  }

  async function uploadPhoto(athleteId) {
    if (!photoFile) return null
    const ext = photoFile.name.split('.').pop()
    const path = `${athleteId}.${ext}`
    const { error } = await supabase.storage.from('athlete-photos').upload(path, photoFile, { upsert:true })
    if (error) { console.error('Upload error:', error); return null }
    const { data } = supabase.storage.from('athlete-photos').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSave() {
    setFormError('')
    let fName = form.first_name.trim()
    let lName = form.last_name.trim()
    let fullName = form.name.trim()

    // Sync first name + last name to name
    if (fName || lName) {
      fullName = (fName + ' ' + lName).trim()
    } else if (fullName) {
      const parts = fullName.split(' ')
      fName = parts[0] || ''
      lName = parts.slice(1).join(' ') || ''
    }

    if (!fullName) { setFormError('Name is required.'); return }
    if (!form.position)    { setFormError('Position is required.'); return }
    if (!teamId)           { setFormError('Your account is not assigned to a team.'); return }
    setSaving(true)
    const payload = {
      name: fullName,
      first_name: fName || null,
      last_name: lName || null,
      date_of_birth: form.date_of_birth || null,
      age: parseInt(form.age) || null,
      position: form.position || null,
      strong_foot: form.strong_foot || null,
      region: form.region || null,
      club: form.club || null,
      phone: form.phone || null,
      height: parseFloat(form.height) || null,
      weight: parseFloat(form.weight) || null,
      coach_id: form.coach_id || null,
      team_id: teamId,
      // New fields:
      membership_number: form.membership_number.trim() || null,
      place_of_birth: form.place_of_birth.trim() || null,
      nationality: form.nationality.trim() || null,
      address: form.address.trim() || null,
      country: form.country.trim() || null,
      email: form.email.trim() || null,
      landline: form.landline.trim() || null,
      homepage: form.homepage.trim() || null,
      facebook: form.facebook.trim() || null,
      instagram: form.instagram.trim() || null,
      snapchat: form.snapchat.trim() || null,
      team_section: form.team_section.trim() || null,
      back_number: form.back_number.trim() || null,
      passport_number: form.passport_number.trim() || null,
      wrist_measurement: form.wrist_measurement.trim() || null,
      clothing_size: form.clothing_size.trim() || null,
      shoe_size: form.shoe_size.trim() || null,
      number_lettering: form.number_lettering.trim() || null,
      last_club: form.last_club.trim() || null,
      in_club_since: form.in_club_since || null,
      contract_until: form.contract_until || null,
      contract_option_until: form.contract_option_until || null,
      contract_details: form.contract_details.trim() || null,
      iban: form.iban.trim() || null,
      bic: form.bic.trim() || null,
      tax_id: form.tax_id.trim() || null,
    }
    if (editId) {
      const url = await uploadPhoto(editId)
      if (url) payload.photo_url = url
      const { error } = await scopeTeam(supabase.from('athletes').update(payload).eq('id', editId), teamId)
      if (error) { setFormError('Update failed: '+error.message); setSaving(false); return }
      setShowForm(false); fetchData()
    } else {
      const { data, error } = await supabase.from('athletes').insert([{ ...payload, status:'Active' }]).select().single()
      if (error) { setFormError('Save failed: '+error.message); setSaving(false); return }
      const url = await uploadPhoto(data.id)
      if (url) await scopeTeam(supabase.from('athletes').update({ photo_url:url }).eq('id', data.id), teamId)
      setShowForm(false); setForm(EMPTY); fetchData()
    }
    setSaving(false)
  }

  async function handleDelete(id, name) {
    if (!confirm(`Remove ${name} from the roster? This cannot be undone.`)) return
    setDeleting(id)
    await scopeTeam(supabase.from('injuries').delete().eq('athlete_id', id), teamId)
    const { error } = await scopeTeam(supabase.from('athletes').delete().eq('id', id), teamId)
    if (error) alert('Delete failed: '+error.message)
    else fetchData()
    setDeleting(null)
  }

  const filtered = athletes.filter(a => {
    const q = search.toLowerCase()
    return (
      (!search     || a.name?.toLowerCase().includes(q) || a.club?.toLowerCase().includes(q) || a.region?.toLowerCase().includes(q)) &&
      (!posFilter  || a.position === posFilter) &&
      (!statFilter || a.status   === statFilter)
    )
  })

  return (
    <Layout>
      <style>{`
        .ath-outer{max-width:1280px;margin:0 auto;padding:32px 40px;min-width:0}
        .ath-filters{display:flex;gap:10px;margin-bottom:22px;flex-wrap:wrap}
        .ath-th{display:grid;grid-template-columns:2.2fr 1fr 1.1fr 1fr 1fr 0.5fr 1fr 1fr;gap:8px;padding:12px 20px;background:#F8FAFC;border-bottom:1px solid #E2E8F0}
        .ath-tr{display:grid;grid-template-columns:2.2fr 1fr 1.1fr 1fr 1fr 0.5fr 1fr 1fr;gap:8px;align-items:center;padding:12px 20px;border-bottom:1px solid #E2E8F0;transition:background 0.15s}
        .ath-tr:hover{background:#F0FDFA}
        .modal-g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .form-inp:focus{border-color:#0D9488!important;box-shadow:0 0 0 3px rgba(13,148,136,0.1)}
        @media(max-width:768px){
          .ath-filters input,.ath-filters select{max-width:100%!important;width:100%!important}
          .ath-th{display:none!important}
          .ath-tr{grid-template-columns:auto 1fr auto!important;gap:10px!important;padding:12px 14px!important}
          .ath-hide{display:none!important}
          .modal-g2{grid-template-columns:1fr!important}
          .modal-inner{padding:16px!important}
        }
      `}</style>

      <div className="ath-outer">
        <PageHeader
          label="Squad Registry" title="Athletes"
          subtitle={`${filtered.length} of ${athletes.length} athlete${athletes.length!==1?'s':''} registered`}
          action={<button className="btn-blue" onClick={openAdd}>+ Register Athlete</button>}
        />

        <div className="ath-filters fade-up">
          <input placeholder="🔍 Search name, club, region…" value={search} onChange={e=>setSearch(e.target.value)}
            className="form-inp"
            style={{ ...inp, maxWidth:300 }} />
          <select value={posFilter} onChange={e=>setPosFilter(e.target.value)} className="form-inp" style={{ ...inp, maxWidth:180 }}>
            <option value="">All Positions</option>
            {Object.entries(POSITION_GROUPS).map(([group, positions]) => (
              <optgroup key={group} label={group}>
                {positions.map(p=><option key={p} value={p}>{p}</option>)}
              </optgroup>
            ))}
          </select>
          <select value={statFilter} onChange={e=>setStatFilter(e.target.value)} className="form-inp" style={{ ...inp, maxWidth:140 }}>
            <option value="">All Statuses</option>
            {['Active','Injured','Suspended'].map(s=><option key={s}>{s}</option>)}
          </select>
          {(search||posFilter||statFilter) && (
            <button onClick={()=>{setSearch('');setPosFilter('');setStatFilter('')}}
              style={{ ...inp, width:'auto', cursor:'pointer', background:'#F1F5F9', fontWeight:600, color:'#334155' }}>
              ✕ Clear
            </button>
          )}
        </div>

        <div className="card fade-up fade-up-1" style={{ overflow:'hidden' }}>
          <div className="ath-th">
            {['Athlete','Position','Club','Region','Coach','Age','Status','Actions'].map(h=>(
              <div key={h} style={{ fontSize:11, fontWeight:700, color:'#64748B', letterSpacing:'0.08em', textTransform:'uppercase' }}>{h}</div>
            ))}
          </div>
          {loading ? (
            <div style={{ padding:'60px', textAlign:'center' }}>
              <div style={{ width:30, height:30, border:'4px solid #CCFBF1', borderTopColor:'#0D9488', borderRadius:'50%', animation:'spin 0.7s linear infinite', margin:'0 auto 10px' }}/>
              <p style={{ color:'#64748B', fontSize:13 }}>Loading athletes…</p>
            </div>
          ) : filtered.length===0 ? (
            <div style={{ padding:'48px', textAlign:'center', color:'#64748B', fontSize:14 }}>
              {athletes.length===0 ? 'No athletes registered yet. Click "+ Register Athlete" to start.' : 'No athletes match your search.'}
            </div>
          ) : filtered.map((ath,i) => (
            <div key={ath.id} className="ath-tr">
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <AthleteAvatar athlete={ath} size={38} index={i}/>
                <div>
                  <Link href={`/athletes/${ath.id}`} style={{ fontSize:13, fontWeight:700, color:'#0F766E', display:'block', marginBottom:1 }}>{ath.name}</Link>
                  <span style={{ fontSize:11, color:'#64748B' }}>{ath.club||'—'}</span>
                </div>
              </div>
              <div className="ath-hide" style={{ fontSize:12, fontWeight:700, color:'#0F766E', background:'#F0FDFA', border:'1px solid #CCFBF1', padding:'3px 8px', borderRadius:6, width:'fit-content' }}>{ath.position||'—'}</div>
              <div className="ath-hide" style={{ fontSize:13, color:'#0F172A' }}>{ath.club||'—'}</div>
              <div className="ath-hide" style={{ fontSize:13, color:'#334155' }}>{ath.region||'—'}</div>
              <div className="ath-hide" style={{ fontSize:12, color:'#334155' }}>{ath.coaches?.name?.replace('Coach ','')||'—'}</div>
              <div className="ath-hide" style={{ fontSize:13, fontWeight:600, color:'#334155' }}>{ath.age||'—'}</div>
              <div><Badge status={ath.status}/></div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={()=>openEdit(ath)} style={{ background:'#F0FDFA', color:'#0F766E', border:'1px solid #CCFBF1', padding:'5px 11px', borderRadius:'8px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>Edit</button>
                <button onClick={()=>handleDelete(ath.id,ath.name)} disabled={deleting===ath.id} style={{ background:'#FFE4E6', color:'#E11D48', border:'none', padding:'5px 11px', borderRadius:'8px', fontSize:12, fontWeight:600, cursor:'pointer', opacity:deleting===ath.id?0.5:1, fontFamily:'var(--font)' }}>
                  {deleting===ath.id?'…':'Del'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modal ── */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#FFFFFF', borderRadius:'20px', width:'100%', maxWidth:580, maxHeight:'92vh', overflow:'auto', boxShadow:'0 25px 60px -10px rgba(0,0,0,0.25)', border:'1px solid #E2E8F0' }}>

            {/* Modal Header */}
            <div style={{ background:'linear-gradient(135deg,#0F766E,#0D9488)', padding:'20px 24px', display:'flex', justifyContent:'space-between', alignItems:'center', borderRadius:'20px 20px 0 0' }}>
              <div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.65)', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:3 }}>{editId?'Edit Record':'New Registration'}</div>
                <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', margin:0 }}>{editId?'Edit Athlete':'Register Athlete'}</h2>
              </div>
              <button onClick={()=>setShowForm(false)} style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', width:36, height:36, borderRadius:'50%', fontSize:20, cursor:'pointer', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>×</button>
            </div>

            {/* Modal Body */}
            <div className="modal-inner" style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>
              {formError && (
                <div style={{ background:'#FFE4E6', border:'1px solid rgba(225,29,72,0.2)', borderRadius:'10px', padding:'10px 14px', fontSize:13, color:'#E11D48', fontWeight:600 }}>⚠ {formError}</div>
              )}

              {/* Photo */}
              <div>
                <label style={lbl}>Profile Photo</label>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ width:72, height:72, borderRadius:'50%', background:'#F0FDFA', border:'3px dashed #99F6E4', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {photoPreview ? <img src={photoPreview} alt="Preview" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:28 }}>👤</span>}
                  </div>
                  <div>
                    <label htmlFor="photo-upload" style={{ display:'inline-block', background:'#F0FDFA', color:'#0F766E', border:'1px solid #CCFBF1', padding:'7px 16px', borderRadius:'8px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      {photoPreview?'Change Photo':'Upload Photo'}
                    </label>
                    <input id="photo-upload" type="file" accept="image/*" onChange={handlePhotoChange} style={{ display:'none' }}/>
                    {photoPreview && <button onClick={()=>{setPhotoFile(null);setPhotoPreview(null)}} style={{ marginLeft:8, background:'#FFE4E6', color:'#E11D48', border:'none', padding:'6px 12px', borderRadius:'8px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'var(--font)' }}>Remove</button>}
                  </div>
                </div>
              </div>

              {/* Master Data Header */}
              <div style={{ borderBottom:'2px solid #0D9488', paddingBottom:4, marginTop:8, fontSize:12, fontWeight:800, color:'#0F766E', letterSpacing:'0.05em' }}>MASTER DATA</div>

              {/* First Name + Last Name */}
              <div className="modal-g2">
                <div>
                  <label style={lbl}>First Name</label>
                  <input className="form-inp" value={form.first_name} onChange={e=>set('first_name')(e.target.value)} style={inp} placeholder="e.g. Richard"/>
                </div>
                <div>
                  <label style={lbl}>Last Name / Family Name</label>
                  <input className="form-inp" value={form.last_name} onChange={e=>set('last_name')(e.target.value)} style={inp} placeholder="e.g. Agyen"/>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label style={lbl}>Full Name *</label>
                <input className="form-inp" value={form.name} onChange={e=>set('name')(e.target.value)} style={inp} placeholder="e.g. Kwame Asante (Automatically synced if First/Last Name is filled)"/>
              </div>

              {/* Membership Number + Place of Birth */}
              <div className="modal-g2">
                <div>
                  <label style={lbl}>Membership Number</label>
                  <input className="form-inp" value={form.membership_number} onChange={e=>set('membership_number')(e.target.value)} style={inp} placeholder="e.g. MEM-1234"/>
                </div>
                <div>
                  <label style={lbl}>Place of Birth</label>
                  <input className="form-inp" value={form.place_of_birth} onChange={e=>set('place_of_birth')(e.target.value)} style={inp} placeholder="e.g. Kumasi"/>
                </div>
              </div>

              {/* Nationality + Country */}
              <div className="modal-g2">
                <div>
                  <label style={lbl}>Nationality</label>
                  <input className="form-inp" value={form.nationality} onChange={e=>set('nationality')(e.target.value)} style={inp} placeholder="e.g. Ghanaian"/>
                </div>
                <div>
                  <label style={lbl}>Country</label>
                  <input className="form-inp" value={form.country} onChange={e=>set('country')(e.target.value)} style={inp} placeholder="e.g. Ghana"/>
                </div>
              </div>

              {/* Date of Birth + Age */}
              <div className="modal-g2">
                <div>
                  <label style={lbl}>Date of Birth</label>
                  <input type="date" className="form-inp" value={form.date_of_birth} onChange={e=>set('date_of_birth')(e.target.value)} style={inp}/>
                </div>
                <div>
                  <label style={lbl}>Age</label>
                  <input type="number" min="14" max="50" className="form-inp" value={form.age} onChange={e=>set('age')(e.target.value)} style={inp}/>
                </div>
              </div>

              {/* Address */}
              <div>
                <label style={lbl}>Address</label>
                <input className="form-inp" value={form.address} onChange={e=>set('address')(e.target.value)} style={inp} placeholder="e.g. Abokobi Clubhouse"/>
              </div>

              {/* Contact Info Header */}
              <div style={{ borderBottom:'2px solid #0D9488', paddingBottom:4, marginTop:16, fontSize:12, fontWeight:800, color:'#0F766E', letterSpacing:'0.05em' }}>CONTACT INFORMATION</div>

              {/* E-mail + Phone */}
              <div className="modal-g2">
                <div>
                  <label style={lbl}>E-mail</label>
                  <input type="email" className="form-inp" value={form.email} onChange={e=>set('email')(e.target.value)} style={inp} placeholder="e.g. richard@example.com"/>
                </div>
                <div>
                  <label style={lbl}>Mobile Phone</label>
                  <input className="form-inp" value={form.phone} onChange={e=>set('phone')(e.target.value)} style={inp} placeholder="e.g. +233 55 201 3946"/>
                </div>
              </div>

              {/* Landline + Homepage */}
              <div className="modal-g2">
                <div>
                  <label style={lbl}>Landline</label>
                  <input className="form-inp" value={form.landline} onChange={e=>set('landline')(e.target.value)} style={inp} placeholder="e.g. +233 30 200 0000"/>
                </div>
                <div>
                  <label style={lbl}>Homepage</label>
                  <input className="form-inp" value={form.homepage} onChange={e=>set('homepage')(e.target.value)} style={inp} placeholder="e.g. https://richardagyen.com"/>
                </div>
              </div>

              {/* Social Media Links */}
              <div>
                <label style={lbl}>Social Media Links (Usernames)</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
                  <div>
                    <input className="form-inp" value={form.facebook} onChange={e=>set('facebook')(e.target.value)} style={inp} placeholder="Facebook"/>
                  </div>
                  <div>
                    <input className="form-inp" value={form.instagram} onChange={e=>set('instagram')(e.target.value)} style={inp} placeholder="Instagram"/>
                  </div>
                  <div>
                    <input className="form-inp" value={form.snapchat} onChange={e=>set('snapchat')(e.target.value)} style={inp} placeholder="Snapchat"/>
                  </div>
                </div>
              </div>

              {/* Sports & Eligibility Header */}
              <div style={{ borderBottom:'2px solid #0D9488', paddingBottom:4, marginTop:16, fontSize:12, fontWeight:800, color:'#0F766E', letterSpacing:'0.05em' }}>SPORTS DATA & ELIGIBILITY</div>

              {/* Playing Position + Strong Foot */}
              <div className="modal-g2">
                <div>
                  <label style={lbl}>Playing Position *</label>
                  <select className="form-inp" value={form.position} onChange={e=>set('position')(e.target.value)} style={inp}>
                    <option value="">Select position…</option>
                    {Object.entries(POSITION_GROUPS).map(([group, positions]) => (
                      <optgroup key={group} label={`── ${group} ──`}>
                        {positions.map(p=><option key={p} value={p}>{p}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Strong Foot</label>
                  <select className="form-inp" value={form.strong_foot} onChange={e=>set('strong_foot')(e.target.value)} style={inp}>
                    <option value="">Select…</option>
                    <option value="right">🦶 Right Foot (RF)</option>
                    <option value="left">🦶 Left Foot (LF)</option>
                    <option value="both">🦶 Both Feet</option>
                  </select>
                </div>
              </div>

              {/* Team Section + Back Number */}
              <div className="modal-g2">
                <div>
                  <label style={lbl}>Team Section</label>
                  <input className="form-inp" value={form.team_section} onChange={e=>set('team_section')(e.target.value)} style={inp} placeholder="e.g. Defense inside"/>
                </div>
                <div>
                  <label style={lbl}>Back Number</label>
                  <input className="form-inp" value={form.back_number} onChange={e=>set('back_number')(e.target.value)} style={inp} placeholder="e.g. 21"/>
                </div>
              </div>

              {/* Passport Number + Wrist Measurement */}
              <div className="modal-g2">
                <div>
                  <label style={lbl}>Passport Number</label>
                  <input className="form-inp" value={form.passport_number} onChange={e=>set('passport_number')(e.target.value)} style={inp} placeholder="e.g. GHA-9827362"/>
                </div>
                <div>
                  <label style={lbl}>Wrist Measurement Info</label>
                  <input className="form-inp" value={form.wrist_measurement} onChange={e=>set('wrist_measurement')(e.target.value)} style={inp} placeholder="e.g. Normal / Detailed"/>
                </div>
              </div>

              {/* Height + Weight */}
              <div className="modal-g2">
                <div>
                  <label style={lbl}>Height (cm)</label>
                  <input type="number" step="0.1" className="form-inp" value={form.height} onChange={e=>set('height')(e.target.value)} style={inp} placeholder="e.g. 190.3"/>
                </div>
                <div>
                  <label style={lbl}>Weight (kg)</label>
                  <input type="number" step="0.1" className="form-inp" value={form.weight} onChange={e=>set('weight')(e.target.value)} style={inp} placeholder="e.g. 81.2"/>
                </div>
              </div>

              {/* Assign Coach + Club/Team */}
              <div className="modal-g2">
                <div>
                  <label style={lbl}>Assign Coach</label>
                  <select className="form-inp" value={form.coach_id} onChange={e=>set('coach_id')(e.target.value)} style={inp}>
                    <option value="">No coach assigned</option>
                    {coaches.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Current Club / Team</label>
                  <input className="form-inp" value={form.club} onChange={e=>set('club')(e.target.value)} style={inp} placeholder="e.g. Asante Kotoko SC"/>
                </div>
              </div>

              {/* Last Club + In Club Since */}
              <div className="modal-g2">
                <div>
                  <label style={lbl}>Last Club</label>
                  <input className="form-inp" value={form.last_club} onChange={e=>set('last_club')(e.target.value)} style={inp} placeholder="e.g. Great Warriors SC"/>
                </div>
                <div>
                  <label style={lbl}>In Club Since</label>
                  <input type="date" className="form-inp" value={form.in_club_since} onChange={e=>set('in_club_since')(e.target.value)} style={inp}/>
                </div>
              </div>

              {/* Contract Until + Contract Option Until */}
              <div className="modal-g2">
                <div>
                  <label style={lbl}>Contract Until</label>
                  <input type="date" className="form-inp" value={form.contract_until} onChange={e=>set('contract_until')(e.target.value)} style={inp}/>
                </div>
                <div>
                  <label style={lbl}>Contract Option Until</label>
                  <input type="date" className="form-inp" value={form.contract_option_until} onChange={e=>set('contract_option_until')(e.target.value)} style={inp}/>
                </div>
              </div>

              {/* Contract Details */}
              <div>
                <label style={lbl}>Contract Details / Notes</label>
                <textarea className="form-inp" value={form.contract_details} onChange={e=>set('contract_details')(e.target.value)} style={{ ...inp, height:'70px', resize:'vertical' }} placeholder="Additional contract terms, bonuses, etc."/>
              </div>

              {/* Equipment Header */}
              <div style={{ borderBottom:'2px solid #0D9488', paddingBottom:4, marginTop:16, fontSize:12, fontWeight:800, color:'#0F766E', letterSpacing:'0.05em' }}>EQUIPMENT</div>

              {/* Clothing Size + Shoe Size */}
              <div className="modal-g2">
                <div>
                  <label style={lbl}>Clothing Size</label>
                  <input className="form-inp" value={form.clothing_size} onChange={e=>set('clothing_size')(e.target.value)} style={inp} placeholder="e.g. L-XL"/>
                </div>
                <div>
                  <label style={lbl}>Shoe Size</label>
                  <input className="form-inp" value={form.shoe_size} onChange={e=>set('shoe_size')(e.target.value)} style={inp} placeholder="e.g. 45"/>
                </div>
              </div>

              {/* Number or Lettering */}
              <div>
                <label style={lbl}>Number or Lettering</label>
                <input className="form-inp" value={form.number_lettering} onChange={e=>set('number_lettering')(e.target.value)} style={inp} placeholder="e.g. Name printing or lettering details"/>
              </div>

              {/* Financial & Tax Header */}
              <div style={{ borderBottom:'2px solid #0D9488', paddingBottom:4, marginTop:16, fontSize:12, fontWeight:800, color:'#0F766E', letterSpacing:'0.05em' }}>FINANCIAL & TAX DETAILS</div>

              {/* IBAN + BIC */}
              <div className="modal-g2">
                <div>
                  <label style={lbl}>IBAN</label>
                  <input className="form-inp" value={form.iban} onChange={e=>set('iban')(e.target.value)} style={inp} placeholder="IBAN Number"/>
                </div>
                <div>
                  <label style={lbl}>BIC / RIC</label>
                  <input className="form-inp" value={form.bic} onChange={e=>set('bic')(e.target.value)} style={inp} placeholder="BIC Code"/>
                </div>
              </div>

              {/* Tax ID */}
              <div>
                <label style={lbl}>Tax Identification Number</label>
                <input className="form-inp" value={form.tax_id} onChange={e=>set('tax_id')(e.target.value)} style={inp} placeholder="Tax ID / Identification Number"/>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:10, paddingTop:4 }}>
                <button onClick={()=>setShowForm(false)} style={{ flex:1, background:'#F8FAFC', border:'1px solid #E2E8F0', color:'#334155', padding:'12px', borderRadius:'10px', fontSize:14, cursor:'pointer', fontWeight:600, fontFamily:'var(--font)' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ flex:2, background:'linear-gradient(135deg,#0F766E,#0D9488)', color:'#fff', border:'none', padding:'12px', borderRadius:'10px', fontSize:14, fontWeight:700, cursor:saving?'not-allowed':'pointer', opacity:saving?0.7:1, fontFamily:'var(--font)', boxShadow:'0 4px 12px rgba(13,148,136,0.25)' }}>
                  {saving?'Saving…':editId?'Save Changes':'Register Athlete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
