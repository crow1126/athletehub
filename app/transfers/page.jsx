'use client'
import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import Badge from '@/components/Badge'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const TRANSFER_TYPES = ['All','sold','bought','free_agent','loan_out','loan_in','return_from_loan']

const TYPE_META = {
  sold:              { label:'Sold',              icon:'💰', color:'#C0392B', bg:'#FDEDEC' },
  bought:            { label:'Bought',            icon:'✅', color:'#1B7A3E', bg:'#E8F8EE' },
  free_agent:        { label:'Free Agent',        icon:'🔓', color:'#B7770D', bg:'#FEF9E7' },
  loan_out:          { label:'Loan Out',          icon:'➡️', color:'#065A82', bg:'#E6F0F8' },
  loan_in:           { label:'Loan In',           icon:'⬅️', color:'#6A1B9A', bg:'#F3E5F5' },
  return_from_loan:  { label:'Return from Loan',  icon:'🔄', color:'#2D6B6B', bg:'#E0F0F0' },
}

const AV_COLORS = ['#006A6A','#008080','#2D6B6B','#004F4F','#5A9494','#003D3D']
function initials(n){ return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }

function Avatar({ athlete, size=38, index=0 }) {
  const [err, setErr] = useState(false)

  // Build a stable URL; append cache-buster only once to avoid infinite re-renders
  const photoUrl = athlete?.photo_url || null

  if (photoUrl && !err) {
    return (
      <img
        src={photoUrl}
        alt={athlete?.name || ''}
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
        onError={() => setErr(true)}
        style={{
          width: size, height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          border: '2px solid var(--border)',
          background: AV_COLORS[index % AV_COLORS.length],
        }}
      />
    )
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: AV_COLORS[index % AV_COLORS.length],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.32, fontWeight: 800, color: '#FFFCF6',
    }}>
      {initials(athlete?.name)}
    </div>
  )
}

function fmtDate(d){ if(!d)return'—'; return new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) }
function fmtFee(ghs, isFree){
  if(isFree) return <span style={{color:'var(--text3)',fontSize:12}}>Free transfer</span>
  if(!ghs||ghs===0) return <span style={{color:'var(--text3)',fontSize:12}}>Undisclosed</span>
  return <span style={{fontWeight:700,color:'var(--text)'}}>GHS {Number(ghs).toLocaleString()}</span>
}

const lbl = { display:'block', fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text3)', marginBottom:6 }
const inp = { width:'100%', padding:'10px 14px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', fontSize:14, outline:'none', color:'var(--text)', fontFamily:'var(--font)' }
const onF = e => e.target.style.borderColor='var(--blue)'
const onB = e => e.target.style.borderColor='var(--border)'

const EMPTY_FORM = { athlete_id:'', transfer_type:'bought', from_club:'', to_club:'', fee_ghs:'', fee_usd:'', is_free:false, transfer_date:'', contract_start:'', contract_end:'', notes:'' }

export default function TransfersPage() {
  const [transfers, setTransfers] = useState([])
  const [athletes,  setAthletes]  = useState([])
  const [profile,   setProfile]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState('All')
  const [search,    setSearch]    = useState('')
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState({text:'',type:''})
  const [isAdmin,   setIsAdmin]   = useState(false)

  useEffect(()=>{ load() },[])

  async function load() {
    setLoading(true)
    try {
      const {data:{session}} = await supabase.auth.getSession()
      if (!session) return
      const {data:p} = await supabase.from('profiles').select('*,teams(id,name)').eq('id',session.user.id).single()
      setProfile(p)
      setIsAdmin(p?.role==='admin'||p?.role==='superadmin'||p?.role==='coach')

      const { data:t, error:tErr } = await supabase
        .from('transfers')
        .select('*')
        .order('transfer_date', {ascending:false})

      console.log('Transfers raw:', t, 'Error:', tErr)

      let transfersWithAthletes = t || []

      if (t && t.length > 0) {
        const athleteIds = [...new Set(t.map(tr => tr.athlete_id).filter(Boolean))]
        const { data:athData } = await supabase
          .from('athletes')
          .select('id,name,photo_url,position,nationality,club')
          .in('id', athleteIds)

        console.log('Athlete data for transfer log:', athData)

        const athMap = {}
        ;(athData||[]).forEach(a => { athMap[a.id] = a })
        transfersWithAthletes = t.map(tr => ({ ...tr, athletes: athMap[tr.athlete_id] || null }))
      }

      setTransfers(transfersWithAthletes)

      const { data:a } = await supabase
        .from('athletes').select('id,name,photo_url,position,club').order('name')
      setAthletes(a||[])
    } catch(e){ console.error(e) }
    setLoading(false)
  }

  const flash=(text,type='success')=>{ setMsg({text,type}); setTimeout(()=>setMsg({text:'',type:''}),7000) }

  async function handleSave() {
    if (!form.athlete_id)    { flash('Select an athlete.','error'); return }
    if (!form.from_club.trim()) { flash('Enter the selling/releasing club.','error'); return }
    if (!form.to_club.trim())   { flash('Enter the destination club.','error'); return }
    if (!form.transfer_date) { flash('Enter the transfer date.','error'); return }

    setSaving(true)
    try {
      const payload = {
        athlete_id:    form.athlete_id,
        team_id:       profile.team_id,
        transfer_type: form.transfer_type,
        from_club:     form.from_club.trim(),
        to_club:       form.to_club.trim(),
        fee_ghs:       form.is_free ? 0 : (parseFloat(form.fee_ghs)||0),
        fee_usd:       form.is_free ? 0 : (parseFloat(form.fee_usd)||0),
        is_free:       form.is_free,
        transfer_date: form.transfer_date,
        contract_start:form.contract_start||null,
        contract_end:  form.contract_end||null,
        notes:         form.notes.trim()||null,
        recorded_by:   profile.id,
      }

      const {error} = await supabase.from('transfers').insert(payload)
      if (error) { flash(error.message,'error'); setSaving(false); return }

      const statusMap = {
        sold:'sold', bought:'contracted', free_agent:'free_agent',
        loan_out:'on_loan', loan_in:'contracted', return_from_loan:'contracted',
      }
      await supabase.from('athletes').update({
        current_club:    form.to_club.trim(),
        transfer_status: statusMap[form.transfer_type] || 'contracted',
      }).eq('id', form.athlete_id)

      flash('✅ Transfer recorded successfully.')
      setForm(EMPTY_FORM)
      setShowForm(false)
      await load()
    } catch(e){ flash('Error: '+e.message,'error') }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this transfer record?')) return
    await supabase.from('transfers').delete().eq('id',id)
    await load()
  }

  function handleTypeChange(type) {
    const teamName = profile?.teams?.name || ''
    let from = '', to = ''
    if (type==='sold')    { from=teamName; to='' }
    if (type==='bought')  { from=''; to=teamName }
    if (type==='loan_out'){ from=teamName; to='' }
    if (type==='loan_in') { from=''; to=teamName }
    if (type==='return_from_loan') { from=''; to=teamName }
    setForm(f=>({...f, transfer_type:type, from_club:from, to_club:to}))
  }

  const filtered = transfers.filter(t => {
    const matchFilter = filter==='All' || t.transfer_type===filter
    const matchSearch = !search || t.athletes?.name?.toLowerCase().includes(search.toLowerCase()) || t.from_club?.toLowerCase().includes(search.toLowerCase()) || t.to_club?.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const totalSold   = transfers.filter(t=>t.transfer_type==='sold').length
  const totalBought = transfers.filter(t=>t.transfer_type==='bought').length
  const totalFee    = transfers.filter(t=>t.transfer_type==='sold'&&!t.is_free).reduce((s,t)=>s+(t.fee_ghs||0),0)
  const totalSpent  = transfers.filter(t=>t.transfer_type==='bought'&&!t.is_free).reduce((s,t)=>s+(t.fee_ghs||0),0)

  if (loading) return (
    <Layout>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
        <div style={{width:36,height:36,border:'4px solid var(--border)',borderTopColor:'var(--blue)',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div style={{maxWidth:1200,margin:'0 auto',padding:'32px 40px'}}>

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:28,flexWrap:'wrap',gap:12}}>
          <PageHeader label="Club Operations" title="Transfer History" subtitle="Player movements — bought, sold, loans and free agents"/>
          {isAdmin && (
            <button onClick={()=>setShowForm(v=>!v)} className="btn-blue" style={{padding:'10px 22px',fontSize:13,flexShrink:0}}>
              {showForm?'✕ Cancel':'+ Record Transfer'}
            </button>
          )}
        </div>

        {msg.text && (
          <div style={{padding:'12px 16px',borderRadius:'var(--r-md)',fontSize:13,fontWeight:600,marginBottom:20,background:msg.type==='error'?'var(--danger-light)':'var(--success-light)',color:msg.type==='error'?'var(--danger)':'var(--success)',border:`1px solid ${msg.type==='error'?'rgba(192,57,43,0.2)':'rgba(27,122,62,0.2)'}`}}>
            {msg.text}
          </div>
        )}

        {/* Stats row */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:24}}>
          {[
            {icon:'💰',label:'Players Sold',    value:totalSold,   color:'#C0392B'},
            {icon:'✅',label:'Players Bought',  value:totalBought, color:'#1B7A3E'},
            {icon:'📈',label:'Fees Received',   value:totalFee>0?`GHS ${totalFee.toLocaleString()}`:'—', color:'#006A6A'},
            {icon:'📉',label:'Fees Spent',      value:totalSpent>0?`GHS ${totalSpent.toLocaleString()}`:'—', color:'#B7770D'},
          ].map(s=>(
            <div key={s.label} className="card" style={{padding:'16px 18px'}}>
              <div style={{fontSize:20,marginBottom:6}}>{s.icon}</div>
              <div style={{fontSize:22,fontWeight:800,color:s.color,lineHeight:1,marginBottom:3}}>{s.value}</div>
              <div style={{fontSize:11,color:'var(--text3)',fontWeight:600}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Record Transfer Form */}
        {showForm && (
          <div className="card" style={{padding:24,marginBottom:24,borderLeft:'4px solid var(--blue)'}}>
            <h3 style={{fontSize:16,fontWeight:700,color:'var(--text)',marginBottom:20}}>📋 Record New Transfer</h3>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16}}>

              <div>
                <label style={lbl}>Athlete *</label>
                <select value={form.athlete_id} onChange={e=>setForm(f=>({...f,athlete_id:e.target.value}))} style={inp} onFocus={onF} onBlur={onB}>
                  <option value="">— Select athlete —</option>
                  {athletes.map(a=><option key={a.id} value={a.id}>{a.name} {a.position?`(${a.position})`:''}</option>)}
                </select>
              </div>

              <div>
                <label style={lbl}>Transfer Type *</label>
                <select value={form.transfer_type} onChange={e=>handleTypeChange(e.target.value)} style={inp} onFocus={onF} onBlur={onB}>
                  {Object.entries(TYPE_META).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>

              <div>
                <label style={lbl}>From Club *</label>
                <input value={form.from_club} onChange={e=>setForm(f=>({...f,from_club:e.target.value}))} style={inp} placeholder="e.g. Asante Kotoko" onFocus={onF} onBlur={onB}/>
              </div>

              <div>
                <label style={lbl}>To Club *</label>
                <input value={form.to_club} onChange={e=>setForm(f=>({...f,to_club:e.target.value}))} style={inp} placeholder="e.g. Hearts of Oak" onFocus={onF} onBlur={onB}/>
              </div>

              <div>
                <label style={lbl}>Transfer Date *</label>
                <input type="date" value={form.transfer_date} onChange={e=>setForm(f=>({...f,transfer_date:e.target.value}))} style={inp} onFocus={onF} onBlur={onB}/>
              </div>

              <div>
                <label style={lbl}>Contract Start</label>
                <input type="date" value={form.contract_start} onChange={e=>setForm(f=>({...f,contract_start:e.target.value}))} style={inp} onFocus={onF} onBlur={onB}/>
              </div>

              <div>
                <label style={lbl}>Contract End</label>
                <input type="date" value={form.contract_end} onChange={e=>setForm(f=>({...f,contract_end:e.target.value}))} style={inp} onFocus={onF} onBlur={onB}/>
              </div>

              <div>
                <label style={lbl}>Transfer Fee (GHS)</label>
                <input type="number" value={form.fee_ghs} onChange={e=>setForm(f=>({...f,fee_ghs:e.target.value}))} style={{...inp,opacity:form.is_free?0.4:1}} placeholder="0" disabled={form.is_free} onFocus={onF} onBlur={onB}/>
              </div>

              <div>
                <label style={lbl}>Fee (USD equivalent)</label>
                <input type="number" value={form.fee_usd} onChange={e=>setForm(f=>({...f,fee_usd:e.target.value}))} style={{...inp,opacity:form.is_free?0.4:1}} placeholder="0" disabled={form.is_free} onFocus={onF} onBlur={onB}/>
              </div>

              <div style={{display:'flex',alignItems:'center',gap:10,paddingTop:22}}>
                <input type="checkbox" id="is_free" checked={form.is_free} onChange={e=>setForm(f=>({...f,is_free:e.target.checked,fee_ghs:'',fee_usd:''}))} style={{width:16,height:16,cursor:'pointer'}}/>
                <label htmlFor="is_free" style={{fontSize:13,fontWeight:600,color:'var(--text)',cursor:'pointer'}}>Free Transfer / Release</label>
              </div>

              <div style={{gridColumn:'1 / -1'}}>
                <label style={lbl}>Notes</label>
                <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={inp} placeholder="e.g. Sold after contract expiry, mutual agreement..." onFocus={onF} onBlur={onB}/>
              </div>
            </div>

            <div style={{display:'flex',gap:10,marginTop:20}}>
              <button onClick={handleSave} disabled={saving} className="btn-blue" style={{padding:'11px 28px',opacity:saving?0.7:1}}>
                {saving?'Saving…':'✅ Save Transfer'}
              </button>
              <button onClick={()=>{setShowForm(false);setForm(EMPTY_FORM)}} style={{padding:'11px 20px',background:'var(--surface2)',color:'var(--text2)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'var(--font)'}}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filters + Search */}
        <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search player, club..." style={{...inp,width:220,padding:'8px 14px',fontSize:13}}/>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {TRANSFER_TYPES.map(t=>(
              <button key={t} onClick={()=>setFilter(t)}
                style={{padding:'7px 14px',borderRadius:99,fontSize:12,fontWeight:filter===t?700:500,border:`1px solid ${filter===t?'var(--blue)':'var(--border)'}`,background:filter===t?'var(--blue)':'transparent',color:filter===t?'#FFFCF6':'var(--text2)',cursor:'pointer',fontFamily:'var(--font)',whiteSpace:'nowrap'}}>
                {t==='All'?'All':TYPE_META[t]?.icon+' '+TYPE_META[t]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transfer list */}
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          {/* Header */}
          <div style={{display:'grid',gridTemplateColumns:'2fr 1.2fr 1.8fr 1.2fr 1fr 0.8fr',gap:8,padding:'11px 20px',background:'var(--surface2)',borderBottom:'1px solid var(--border)'}}>
            {['Player','Type','Movement','Date','Fee',''].map(h=>(
              <div key={h} style={{fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase'}}>{h}</div>
            ))}
          </div>

          {filtered.length===0?(
            <div style={{padding:'40px',textAlign:'center',color:'var(--text3)',fontSize:13}}>
              {search||filter!=='All'?'No transfers match your filter.':'No transfer records yet. Click "+ Record Transfer" to add one.'}
            </div>
          ):filtered.map((t,i)=>{
            const meta = TYPE_META[t.transfer_type]||TYPE_META.bought
            return (
              <div key={t.id} style={{display:'grid',gridTemplateColumns:'2fr 1.2fr 1.8fr 1.2fr 1fr 0.8fr',gap:8,alignItems:'center',padding:'13px 20px',borderBottom:'1px solid var(--border)',background:i%2===0?'#fff':'var(--surface2)',transition:'var(--transition)'}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--blue-light)'}
                onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'var(--surface2)'}>

                {/* Player — photo + name */}
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <Avatar athlete={t.athletes} size={36} index={i}/>
                  <div>
                    <Link href={`/athletes/${t.athlete_id}`} style={{fontSize:13,fontWeight:700,color:'var(--text)',textDecoration:'none',display:'block'}}>
                      {t.athletes?.name||'—'}
                    </Link>
                    <span style={{fontSize:11,color:'var(--text3)'}}>{t.athletes?.position||'—'}</span>
                  </div>
                </div>

                {/* Type badge */}
                <div>
                  <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:99,background:meta.bg,color:meta.color,whiteSpace:'nowrap'}}>
                    {meta.icon} {meta.label}
                  </span>
                </div>

                {/* Movement: from → to */}
                <div style={{fontSize:12,color:'var(--text2)'}}>
                  <span style={{fontWeight:600}}>{t.from_club}</span>
                  <span style={{color:'var(--text3)',margin:'0 6px'}}>→</span>
                  <span style={{fontWeight:600}}>{t.to_club}</span>
                </div>

                {/* Date */}
                <div style={{fontSize:12,color:'var(--text2)'}}>{fmtDate(t.transfer_date)}</div>

                {/* Fee */}
                <div style={{fontSize:12}}>{fmtFee(t.fee_ghs,t.is_free)}</div>

                {/* Actions */}
                <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                  <Link href={`/athletes/${t.athlete_id}`}
                    style={{fontSize:11,fontWeight:700,color:'var(--blue)',background:'var(--blue-light)',padding:'4px 10px',borderRadius:6,textDecoration:'none',whiteSpace:'nowrap'}}>
                    Profile →
                  </Link>
                  {isAdmin && (
                    <button onClick={()=>handleDelete(t.id)}
                      style={{fontSize:11,fontWeight:600,color:'var(--danger)',background:'var(--danger-light)',border:'none',padding:'4px 8px',borderRadius:6,cursor:'pointer',fontFamily:'var(--font)'}}>
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{marginTop:16,padding:'12px 16px',background:'var(--blue-light)',borderRadius:'var(--r-md)',border:'1px solid var(--border)',fontSize:12,color:'var(--text2)',lineHeight:1.7}}>
          💡 <strong>Historical records are preserved.</strong> When a player is sold or transferred, their full performance history, injury records, and stats from your club remain in the system and are still visible on their athlete profile page.
        </div>

      </div>
    </Layout>
  )
}