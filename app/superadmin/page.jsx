'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const STATUS_STYLES = {
  pending:  { bg:'#FEF9E7', color:'#B7770D', border:'rgba(183,119,13,0.25)',  dot:'#F59E0B' },
  approved: { bg:'#E8F8EE', color:'#1B6B3A', border:'rgba(27,107,58,0.25)',   dot:'#27AE60' },
  rejected: { bg:'#F9E8E8', color:'#8B2020', border:'rgba(139,32,32,0.25)',   dot:'#E74C3C' },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:s.bg, color:s.color, border:`1px solid ${s.border}`, borderRadius:99, padding:'3px 10px', fontSize:11, fontWeight:700, textTransform:'capitalize' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:s.dot }}/>
      {status || 'pending'}
    </span>
  )
}

function Avatar({ name, size=38 }) {
  const i = (name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:'linear-gradient(135deg,#004F4F,#008080)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.32, fontWeight:800, color:'#FFFCF6', flexShrink:0 }}>
      {i}
    </div>
  )
}

export default function SuperadminPage() {
  const [profiles,    setProfiles]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState(null)
  const [logoFile,    setLogoFile]    = useState(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [logoUrl,     setLogoUrl]     = useState('')
  const [rejReason,   setRejReason]   = useState('')
  const [acting,      setActing]      = useState(false)
  const [toast,       setToast]       = useState(null)
  const [filter,      setFilter]      = useState('pending')
  const [search,      setSearch]      = useState('')
  const [authOk,      setAuthOk]      = useState(false)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data:{ session } }) => {
      if (!session) { router.replace('/login'); return }
      const { data:p } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      if (p?.role !== 'superadmin') { router.replace('/dashboard'); return }
      setAuthOk(true)
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id,full_name,email,club_name,role,is_active,registration_status,created_at,club_logo_url,phone')
      .order('created_at', { ascending:false })
    setProfiles(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { if (authOk) load() }, [authOk, load])

  function toast_(msg, type='success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function openReview(p) {
    setSelected(p)
    setLogoUrl(p.club_logo_url || '')
    setLogoPreview(p.club_logo_url || '')
    setLogoFile(null)
    setRejReason('')
  }

  function handleLogoFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setLogoFile(f)
    setLogoPreview(URL.createObjectURL(f))
  }

  async function uploadLogo(id) {
    if (!logoFile) return logoUrl || null
    const ext  = logoFile.name.split('.').pop()
    const path = `club-logos/${id}.${ext}`
    const { error } = await supabase.storage.from('athlete-photos').upload(path, logoFile, { upsert:true })
    if (error) { console.error(error); return logoUrl || null }
    return supabase.storage.from('athlete-photos').getPublicUrl(path).data.publicUrl
  }

  async function handleApprove() {
    if (!selected) return
    setActing(true)
    try {
      const finalLogo = await uploadLogo(selected.id)
      const { error } = await supabase.from('profiles').update({
        is_active: true,
        registration_status: 'approved',
        approved_at: new Date().toISOString(),
        club_logo_url: finalLogo || null,
      }).eq('id', selected.id)
      if (error) throw error

      // Call send-welcome edge function
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-welcome`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          full_name:     selected.full_name,
          email:         selected.email,
          club_name:     selected.club_name,
          club_logo_url: finalLogo || null,
        }),
      })

      toast_(`✅ ${selected.full_name} approved — welcome email sent!`)
      setSelected(null)
      load()
    } catch (err) {
      toast_('❌ ' + (err.message || 'Approval failed'), 'error')
    }
    setActing(false)
  }

  async function handleReject() {
    if (!selected) return
    if (!rejReason.trim()) { toast_('Enter a rejection reason first', 'error'); return }
    setActing(true)
    try {
      const { error } = await supabase.from('profiles').update({
        registration_status: 'rejected',
        is_active: false,
        rejection_reason: rejReason.trim(),
      }).eq('id', selected.id)
      if (error) throw error
      toast_(`Rejected — ${selected.full_name}`)
      setSelected(null); load()
    } catch (err) { toast_('❌ ' + (err.message || 'Failed'), 'error') }
    setActing(false)
  }

  async function toggleActive(p) {
    await supabase.from('profiles').update({ is_active: !p.is_active }).eq('id', p.id)
    toast_(`${p.full_name} ${!p.is_active ? 'activated' : 'deactivated'}`)
    load()
  }

  const counts = {
    all:      profiles.length,
    pending:  profiles.filter(p=>p.registration_status==='pending').length,
    approved: profiles.filter(p=>p.registration_status==='approved').length,
    rejected: profiles.filter(p=>p.registration_status==='rejected').length,
  }

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase()
    const matchQ = !search || [p.full_name,p.email,p.club_name].some(v=>v?.toLowerCase().includes(q))
    const matchF = filter==='all' || p.registration_status===filter
    return matchQ && matchF
  })

  const btn = (onClick, label, style={}) => (
    <button onClick={onClick} style={{ border:'none', borderRadius:8, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all 0.18s', ...style }}
      onMouseEnter={e=>{ e.currentTarget.style.opacity='0.82'; e.currentTarget.style.transform='translateY(-1px)' }}
      onMouseLeave={e=>{ e.currentTarget.style.opacity='1';    e.currentTarget.style.transform='translateY(0)' }}>
      {label}
    </button>
  )

  if (!authOk) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#002828' }}>
      <div style={{ width:36,height:36,border:'4px solid rgba(0,128,128,0.3)',borderTopColor:'#008080',borderRadius:'50%',animation:'spin 0.7s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Plus Jakarta Sans',sans-serif;background:#F2F7F7}
        @keyframes spin   {to{transform:rotate(360deg)}}
        @keyframes fadeUp {from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:translateX(0)}}
        .row-hover:hover{background:#EEF8F8 !important}
        textarea,input{font-family:'Plus Jakarta Sans',sans-serif}
        @media(max-width:768px){
          .hide-mob{display:none !important}
          .grid-mob{grid-template-columns:1fr !important}
          .pad-mob{padding:16px !important}
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed',top:20,right:20,zIndex:999,background:toast.type==='error'?'#8B2020':'#006A6A',color:'#FFFCF6',padding:'12px 20px',borderRadius:12,fontSize:13,fontWeight:600,boxShadow:'0 8px 24px rgba(0,0,0,0.18)',animation:'fadeUp 0.2s ease',maxWidth:340 }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#002828,#004F4F)',borderBottom:'1px solid rgba(255,252,246,0.08)' }}>
        <div style={{ maxWidth:1200,margin:'0 auto',padding:'18px 32px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12 }}>
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            <div style={{ width:38,height:38,borderRadius:10,background:'rgba(255,252,246,0.1)',border:'1px solid rgba(255,252,246,0.18)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18 }}>⚙️</div>
            <div>
              <div style={{ fontSize:17,fontWeight:800,color:'#FFFCF6',letterSpacing:'-0.02em' }}>Superadmin Panel</div>
              <div style={{ fontSize:11,color:'rgba(255,252,246,0.4)',fontWeight:500 }}>Registration Management · Apex Track</div>
            </div>
          </div>
          <div style={{ display:'flex',gap:8 }}>
            {btn(()=>router.push('/dashboard'),'← Dashboard',{ background:'rgba(255,252,246,0.08)',color:'#FFFCF6',border:'1px solid rgba(255,252,246,0.14)' })}
            {btn(load,'↻ Refresh',{ background:'rgba(0,128,128,0.25)',color:'#7ECACA',border:'1px solid rgba(0,128,128,0.35)' })}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1200,margin:'0 auto',padding:'24px 32px' }}>

        {/* Stat cards */}
        <div className="grid-mob" style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:22 }}>
          {[
            ['Total','all',      counts.all,      '👥','#008080'],
            ['Pending','pending',counts.pending,  '⏳','#B7770D'],
            ['Approved','approved',counts.approved,'✅','#27AE60'],
            ['Rejected','rejected',counts.rejected,'❌','#E74C3C'],
          ].map(([label,f,val,icon,color])=>(
            <div key={label} onClick={()=>setFilter(f)}
              style={{ background:'#fff',border:`1px solid ${color}22`,borderRadius:14,padding:'16px 18px',cursor:'pointer',transition:'all 0.18s',boxShadow:filter===f?`0 4px 18px ${color}22`:'0 2px 8px rgba(0,0,0,0.04)',outline:filter===f?`2px solid ${color}55`:'none' }}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)'}}>
              <div style={{ fontSize:20,marginBottom:8 }}>{icon}</div>
              <div style={{ fontSize:26,fontWeight:900,color:'#111',letterSpacing:'-0.03em',lineHeight:1,marginBottom:4 }}>{val}</div>
              <div style={{ fontSize:11,color:'#777',fontWeight:500 }}>{label} Registrations</div>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div style={{ display:'flex',gap:10,marginBottom:14,flexWrap:'wrap',alignItems:'center' }}>
          <input placeholder="🔍 Search name, club, email…" value={search} onChange={e=>setSearch(e.target.value)}
            style={{ flex:1,minWidth:200,padding:'10px 14px',border:'1px solid #D0E8E8',borderRadius:10,fontSize:13,outline:'none',color:'#003D3D',background:'#fff' }}
            onFocus={e=>e.target.style.borderColor='#006A6A'} onBlur={e=>e.target.style.borderColor='#D0E8E8'}/>
          <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
            {['all','pending','approved','rejected'].map(f=>(
              <button key={f} onClick={()=>setFilter(f)}
                style={{ border:`1px solid ${filter===f?'#006A6A':'#D0E8E8'}`,borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',background:filter===f?'#006A6A':'#fff',color:filter===f?'#FFFCF6':'#5A9494',textTransform:'capitalize',transition:'all 0.18s' }}>
                {f} <span style={{ marginLeft:3,fontSize:10,opacity:0.75 }}>({counts[f]})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ background:'#fff',borderRadius:16,border:'1px solid #E0EEEE',overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,0.05)' }}>
          {/* Header */}
          <div className="hide-mob" style={{ display:'grid',gridTemplateColumns:'2fr 1.6fr 1fr 1fr 0.7fr 1.2fr',gap:8,padding:'10px 20px',background:'#F0FAF9',borderBottom:'1px solid #E0EEEE' }}>
            {['Name / Club','Email','Role','Status','Active','Actions'].map(h=>(
              <div key={h} style={{ fontSize:10,fontWeight:700,color:'#5A9494',letterSpacing:'0.08em',textTransform:'uppercase' }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding:56,textAlign:'center' }}>
              <div style={{ width:26,height:26,border:'3px solid #E0EEEE',borderTopColor:'#008080',borderRadius:'50%',animation:'spin 0.7s linear infinite',margin:'0 auto 10px' }}/>
              <p style={{ color:'#5A9494',fontSize:13 }}>Loading…</p>
            </div>
          ) : filtered.length===0 ? (
            <div style={{ padding:44,textAlign:'center',color:'#5A9494',fontSize:14 }}>
              {search?'No results found.':filter==='pending'?'🎉 No pending registrations.':'No records.'}
            </div>
          ) : filtered.map((p,i) => (
            <div key={p.id} className="row-hover" style={{ display:'grid',gridTemplateColumns:'2fr 1.6fr 1fr 1fr 0.7fr 1.2fr',gap:8,alignItems:'center',padding:'12px 20px',borderBottom:'1px solid #F0F8F8',transition:'background 0.15s' }}>
              <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                {p.club_logo_url
                  ? <img src={p.club_logo_url} alt="" style={{ width:36,height:36,borderRadius:'50%',objectFit:'cover',border:'2px solid #E0EEEE',flexShrink:0 }}/>
                  : <Avatar name={p.full_name} size={36}/>
                }
                <div>
                  <div style={{ fontSize:13,fontWeight:700,color:'#003D3D' }}>{p.full_name}</div>
                  <div style={{ fontSize:11,color:'#5A9494' }}>{p.club_name||'—'}</div>
                </div>
              </div>
              <div className="hide-mob" style={{ fontSize:12,color:'#5A9494',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{p.email}</div>
              <div className="hide-mob" style={{ fontSize:12,color:'#2D6B6B',fontWeight:600,textTransform:'capitalize' }}>{p.role||'admin'}</div>
              <StatusBadge status={p.registration_status||'pending'}/>
              <div>
                <button onClick={()=>toggleActive(p)}
                  style={{ border:`1px solid ${p.is_active?'rgba(27,107,58,0.2)':'rgba(139,32,32,0.2)'}`,borderRadius:7,padding:'4px 10px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',background:p.is_active?'#E8F8EE':'#F9E8E8',color:p.is_active?'#1B6B3A':'#8B2020',transition:'all 0.18s' }}>
                  {p.is_active?'On':'Off'}
                </button>
              </div>
              <div style={{ display:'flex',gap:6 }}>
                {btn(()=>openReview(p),'Review',{ background:'#E8F0FA',color:'#1A4A8A',border:'1px solid rgba(26,74,138,0.18)' })}
                {(p.registration_status==='pending'||!p.registration_status) && btn(()=>openReview(p),'✓',{ background:'#E8F8EE',color:'#1B6B3A',border:'1px solid rgba(27,107,58,0.2)',padding:'7px 10px' })}
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize:11,color:'#5A9494',marginTop:10,textAlign:'right' }}>{filtered.length} of {profiles.length} shown</p>
      </div>

      {/* ══ REVIEW MODAL ══ */}
      {selected && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,20,20,0.7)',backdropFilter:'blur(8px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
          onClick={e=>{ if(e.target===e.currentTarget) setSelected(null) }}>
          <div style={{ background:'#FFFCF6',borderRadius:22,width:'100%',maxWidth:500,maxHeight:'92vh',overflow:'auto',boxShadow:'0 32px 80px rgba(0,20,20,0.45)',animation:'slideIn 0.26s ease' }}>

            {/* Modal header */}
            <div style={{ background:'linear-gradient(135deg,#004F4F,#008080)',padding:'18px 24px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <div>
                <div style={{ fontSize:9,color:'rgba(255,252,246,0.5)',fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase',marginBottom:3 }}>Registration Review</div>
                <h2 style={{ fontSize:17,fontWeight:800,color:'#FFFCF6' }}>{selected.full_name}</h2>
              </div>
              <button onClick={()=>setSelected(null)} style={{ background:'rgba(255,252,246,0.15)',border:'none',width:32,height:32,borderRadius:'50%',fontSize:18,cursor:'pointer',color:'#FFFCF6',display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
            </div>

            <div className="pad-mob" style={{ padding:24,display:'flex',flexDirection:'column',gap:16 }}>

              {/* Profile row */}
              <div style={{ display:'flex',alignItems:'center',gap:14 }}>
                {selected.club_logo_url ? <img src={selected.club_logo_url} alt="" style={{ width:52,height:52,borderRadius:'50%',objectFit:'cover',border:'2px solid #E0EEEE' }}/> : <Avatar name={selected.full_name} size={52}/>}
                <div>
                  <div style={{ fontSize:15,fontWeight:800,color:'#003D3D' }}>{selected.full_name}</div>
                  <div style={{ fontSize:13,color:'#006A6A',fontWeight:600 }}>{selected.club_name||'No club specified'}</div>
                  <div style={{ fontSize:12,color:'#5A9494' }}>{selected.email}</div>
                </div>
              </div>

              {/* Info grid */}
              <div style={{ background:'#F0FAF9',border:'1px solid #C8E8E4',borderRadius:12,padding:16,display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
                {[['Role',selected.role||'admin'],['Phone',selected.phone||'—'],['Status',selected.registration_status||'pending'],['Registered',new Date(selected.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})],['Account',selected.is_active?'✅ Active':'❌ Inactive'],['Club Logo',selected.club_logo_url?'✅ Set':'⚠️ Missing']].map(([k,v])=>(
                  <div key={k}>
                    <div style={{ fontSize:10,fontWeight:700,color:'#5A9494',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:2 }}>{k}</div>
                    <div style={{ fontSize:13,fontWeight:600,color:'#003D3D',textTransform:'capitalize' }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Logo upload */}
              <div>
                <div style={{ fontSize:11,fontWeight:700,color:'#2D6B6B',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8 }}>Club Logo</div>
                <div style={{ display:'flex',alignItems:'center',gap:14 }}>
                  <div style={{ width:60,height:60,borderRadius:'50%',background:'#E8F5F5',border:'2px dashed #B8D8D8',overflow:'hidden',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center' }}>
                    {logoPreview ? <img src={logoPreview} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/> : <span style={{ fontSize:22 }}>🏟️</span>}
                  </div>
                  <div style={{ flex:1,display:'flex',flexDirection:'column',gap:7 }}>
                    <label htmlFor="logo-up" style={{ display:'inline-block',background:'#E8F0FA',color:'#1A4A8A',border:'1px solid rgba(26,74,138,0.2)',padding:'7px 14px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',width:'fit-content' }}>
                      {logoPreview?'Change Logo':'Upload Logo'}
                    </label>
                    <input id="logo-up" type="file" accept="image/*" onChange={handleLogoFile} style={{ display:'none' }}/>
                    <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                      <span style={{ fontSize:11,color:'#5A9494',flexShrink:0 }}>or URL:</span>
                      <input value={logoUrl} onChange={e=>{ setLogoUrl(e.target.value); setLogoPreview(e.target.value); setLogoFile(null) }} placeholder="https://…"
                        style={{ flex:1,padding:'6px 10px',border:'1px solid #D0E8E8',borderRadius:8,fontSize:12,outline:'none',color:'#003D3D' }}/>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rejection reason */}
              {selected.registration_status !== 'approved' && (
                <div>
                  <div style={{ fontSize:11,fontWeight:700,color:'#8B2020',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6 }}>Rejection Reason (required to reject)</div>
                  <textarea value={rejReason} onChange={e=>setRejReason(e.target.value)} rows={3}
                    placeholder="e.g. Could not verify club affiliation. Please resubmit with documentation."
                    style={{ width:'100%',padding:'10px 14px',border:'1px solid #E0C0C0',borderRadius:10,fontSize:13,outline:'none',color:'#003D3D',resize:'vertical',background:'#FFF8F8' }}/>
                </div>
              )}

              {/* Buttons */}
              <div style={{ display:'flex',gap:10,paddingTop:4 }}>
                {btn(()=>setSelected(null),'Cancel',{ flex:1,background:'#F0F8F8',color:'#5A9494',border:'1px solid #D0E8E8',padding:'12px' })}
                {selected.registration_status !== 'rejected' && btn(()=>handleReject(), acting?'…':'✕ Reject', { flex:1,background:'#F9E8E8',color:'#8B2020',border:'1px solid rgba(139,32,32,0.2)',padding:'12px',opacity:acting?0.6:1 })}
                {btn(()=>handleApprove(), acting?'Processing…':`✓ ${selected.registration_status==='approved'?'Update & Resend':'Approve & Email'}`, { flex:2,background:'linear-gradient(135deg,#006A6A,#008080)',color:'#FFFCF6',padding:'12px',opacity:acting?0.6:1,boxShadow:'0 4px 14px rgba(0,106,106,0.28)' })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}