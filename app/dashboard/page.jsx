'use client'
import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import Badge from '@/components/Badge'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Users, Shield, Calendar, Activity, Zap, TrendingUp, TrendingDown, ChevronRight, Plus, Search, Bell, Settings } from 'lucide-react'

const AV_COLORS = ['#006A6A','#008080','#2D6B6B','#5A9494','#004F4F','#5C3058']
function initials(n) { return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }

function AthleteAvatar({ ath, size=36, index=0 }) {
  const [err, setErr] = useState(false)
  if (ath?.photo_url && !err) {
    return <img src={ath.photo_url} alt={ath?.name} onError={()=>setErr(true)} style={{ width:size,height:size,borderRadius:'50%',objectFit:'cover',border:'2px solid #E8F0EE',flexShrink:0 }}/>
  }
  return (
    <div style={{ width:size,height:size,borderRadius:'50%',flexShrink:0,background:AV_COLORS[index%AV_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.32,fontWeight:800,color:'#FFFCF6',flexShrink:0 }}>
      {initials(ath?.name)}
    </div>
  )
}

const SESSION_COLORS = {
  'Squad Training':'#008080','Strength & Conditioning':'#27AE60','Tactical Drills':'#2D6B6B',
  'Recovery Session':'#26C6DA','Match Preparation':'#006A6A','Friendly Match':'#EF5350',
  'Fitness Test':'#B7770D','Video Analysis':'#5A9494',
}

function SparkLine({ data=[40,55,48,62,58,72,68,75,70,80], color='#006A6A', height=40 }) {
  const max=Math.max(...data), min=Math.min(...data)
  const w=120, h=height, pad=4
  const pts=data.map((v,i)=>{
    const x=pad+(i/(data.length-1))*(w-pad*2)
    const y=h-pad-((v-min)/(max-min||1))*(h-pad*2)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow:'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  )
}

function StatCard({ label, value, note, trend, color='#006A6A', spark, href }) {
  const up = trend >= 0
  const card = (
    <div style={{ background:'#fff', border:'1px solid #EEF2F2', borderRadius:14, padding:'16px 18px', cursor:href?'pointer':'default', transition:'all 0.18s', position:'relative', overflow:'hidden' }}
      onMouseEnter={e=>{ if(href){ e.currentTarget.style.boxShadow='0 4px 16px rgba(0,106,106,0.1)'; e.currentTarget.style.borderColor='#C8E0E0' }}}
      onMouseLeave={e=>{ e.currentTarget.style.boxShadow='none'; e.currentTarget.style.borderColor='#EEF2F2' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:11, color:'#8AA8A8', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{label}</div>
          <div style={{ fontSize:28, fontWeight:800, color:'#0D2B2B', letterSpacing:'-0.03em', lineHeight:1 }}>{value}</div>
          <div style={{ fontSize:11, color:'#8AA8A8', marginTop:5, fontWeight:500 }}>{note}</div>
        </div>
        {spark && <div style={{ width:80, opacity:0.8 }}><SparkLine data={spark} color={color}/></div>}
      </div>
      {trend !== undefined && (
        <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:10 }}>
          {up ? <TrendingUp size={12} color="#27AE60"/> : <TrendingDown size={12} color="#E74C3C"/>}
          <span style={{ fontSize:11, fontWeight:700, color: up?'#27AE60':'#E74C3C' }}>{Math.abs(trend)}% from last month</span>
        </div>
      )}
      <div style={{ position:'absolute', top:0, right:0, width:3, height:'100%', background:color, borderRadius:'0 14px 14px 0' }}/>
    </div>
  )
  return href ? <Link href={href} style={{ textDecoration:'none' }}>{card}</Link> : card
}

export default function Dashboard() {
  const [athletes, setAthletes] = useState([])
  const [injuries, setInjuries] = useState([])
  const [coaches,  setCoaches]  = useState([])
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [profile,  setProfile]  = useState(null)
  const [isAdmin,  setIsAdmin]  = useState(false)
  const [search,   setSearch]   = useState('')

  useEffect(() => {
    async function load() {
      const { data:{ session } } = await supabase.auth.getSession()
      if (session) {
        const { data:p } = await supabase
          .from('profiles')
          .select('*, club_name, club_logo_url, teams(id,name,short_name,primary_color,logo_url)')
          .eq('id', session.user.id)
          .single()
        setProfile(p)
        setIsAdmin(p?.role==='admin'||p?.role==='superadmin')
      }
      const [{ data:a },{ data:i },{ data:c },{ data:s }] = await Promise.all([
        supabase.from('athletes').select('*').order('created_at',{ascending:false}),
        supabase.from('injuries').select('*,athletes(name,club,position,photo_url)'),
        supabase.from('coaches').select('*'),
        supabase.from('training_sessions').select('*,coaches(name)').order('date',{ascending:true}),
      ])
      setAthletes(a||[]); setInjuries(i||[]); setCoaches(c||[]); setSessions(s||[])
      setLoading(false)
    }
    load()
  }, [])

  const today    = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const next7    = new Date(); next7.setDate(next7.getDate()+7)
  const activeInj   = injuries.filter(i=>i.status==='Active')
  const todaySess   = sessions.filter(s=>s.date===todayStr)
  const upcoming    = sessions.filter(s=>s.date>=todayStr&&new Date(s.date)<=next7).sort((a,b)=>a.date.localeCompare(b.date)||a.time?.localeCompare(b.time||'')).slice(0,5)
  const greet       = today.getHours()<12?'Good morning':today.getHours()<17?'Good afternoon':'Good evening'
  const clubName    = profile?.club_name || profile?.teams?.name || null
  const clubLogo    = (profile?.club_logo_url && !profile.club_logo_url.startsWith('data:')) ? profile.club_logo_url : (profile?.teams?.logo_url || null)

  const filteredAthletes = athletes.filter(a =>
    !search || [a.name, a.position, a.club].some(v=>v?.toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 8)

  if (loading) return (
    <Layout>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh' }}>
        <div style={{ width:36,height:36,border:'3px solid #E0EEEE',borderTopColor:'#006A6A',borderRadius:'50%',animation:'spin 0.7s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </Layout>
  )

  const activeAth = athletes.filter(a=>a.status==='Active').length

  return (
    <Layout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .dash-root { font-family:'Plus Jakarta Sans',sans-serif; background:#F4F7F7; min-height:100vh; }
        .dash-topbar { background:#fff; border-bottom:1px solid #EEF2F2; padding:0 32px; height:60px; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:50; }
        .dash-content { padding:24px 32px; max-width:1400px; margin:0 auto; }
        .stats-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:14px; margin-bottom:24px; }
        .main-grid { display:grid; grid-template-columns:1fr 340px; gap:20px; align-items:start; }
        .search-inp { border:1px solid #E0EEEE; border-radius:10px; padding:8px 14px 8px 36px; font-size:13px; font-family:inherit; outline:none; color:#0D2B2B; background:#F8FCFC; width:260px; transition:all 0.18s; }
        .search-inp:focus { border-color:#006A6A; background:#fff; box-shadow:0 0 0 3px rgba(0,106,106,0.08); }
        .card { background:#fff; border:1px solid #EEF2F2; border-radius:16px; overflow:hidden; }
        .card-hdr { padding:14px 18px; border-bottom:1px solid #EEF2F2; display:flex; align-items:center; justify-content:space-between; }
        .card-title { font-size:14px; font-weight:700; color:#0D2B2B; }
        .view-all { font-size:12px; font-weight:600; color:#006A6A; background:#F0FAF9; padding:5px 12px; border-radius:8px; text-decoration:none; display:flex; align-items:center; gap:4px; transition:all 0.15s; }
        .view-all:hover { background:#E0F5F3; }
        .ath-row { display:grid; grid-template-columns:2fr 1fr 1fr 1fr 80px; gap:8px; align-items:center; padding:11px 18px; border-bottom:1px solid #F5F9F9; transition:background 0.15s; cursor:pointer; }
        .ath-row:hover { background:#F8FCFC; }
        .ath-row:last-child { border-bottom:none; }
        .th { font-size:10px; font-weight:700; color:#8AA8A8; text-transform:uppercase; letter-spacing:0.08em; }
        .sess-row { display:flex; align-items:center; gap:12px; padding:12px 18px; border-bottom:1px solid #F5F9F9; transition:background 0.15s; }
        .sess-row:hover { background:#F8FCFC; }
        .sess-row:last-child { border-bottom:none; }
        .quick-btn { display:flex; flex-direction:column; align-items:center; gap:5px; padding:12px 8px; border-radius:12px; border:1px solid #EEF2F2; background:#F8FCFC; text-decoration:none; transition:all 0.18s; cursor:pointer; }
        .quick-btn:hover { background:#F0FAF9; border-color:#C8E8E4; transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,106,106,0.1); }
        .inj-row { display:flex; align-items:center; gap:10px; padding:10px 16px; border-bottom:1px solid #F5F9F9; transition:background 0.15s; }
        .inj-row:hover { background:#F8FCFC; }
        .inj-row:last-child { border-bottom:none; }
        .donut-ring { transform:rotate(-90deg); transform-origin:center; }
        @media(max-width:1100px) { .main-grid{grid-template-columns:1fr!important} .stats-grid{grid-template-columns:repeat(3,1fr)!important} }
        @media(max-width:768px) { .dash-content{padding:16px!important} .stats-grid{grid-template-columns:repeat(2,1fr)!important} .ath-row{grid-template-columns:1fr auto!important} }
      `}</style>

      <div className="dash-root">

        {/* Top bar */}
        <div className="dash-topbar">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {clubLogo && <img src={clubLogo} alt={clubName||''} style={{ width:32, height:32, borderRadius:8, objectFit:'contain', border:'1px solid #EEF2F2' }} onError={e=>e.target.style.display='none'}/>}
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#0D2B2B' }}>{clubName || 'Apex Track'}</div>
              <div style={{ fontSize:11, color:'#8AA8A8', fontWeight:500 }}>{greet}, {profile?.full_name?.split(' ')[0] || 'Admin'}</div>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ position:'relative' }}>
              <Search size={14} color="#8AA8A8" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)' }}/>
              <input className="search-inp" placeholder="Search athletes..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <button style={{ width:36, height:36, border:'1px solid #EEF2F2', borderRadius:10, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', position:'relative' }}>
              <Bell size={16} color="#5A8A8A"/>
              {activeInj.length>0 && <span style={{ position:'absolute', top:6, right:6, width:7, height:7, borderRadius:'50%', background:'#E74C3C', border:'1.5px solid #fff' }}/>}
            </button>
            {isAdmin && (
              <Link href="/settings" style={{ width:36, height:36, border:'1px solid #EEF2F2', borderRadius:10, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none' }}>
                <Settings size={16} color="#5A8A8A"/>
              </Link>
            )}
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#004F4F,#008080)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#FFFCF6' }}>
              {initials(profile?.full_name)}
            </div>
          </div>
        </div>

        <div className="dash-content">

          {/* Stats row */}
          <div className="stats-grid">
            <StatCard label="Total Athletes" value={athletes.length} note={`${activeAth} active`} trend={5.1} color="#008080" spark={[60,65,58,70,68,75,72,78,76,82]} href="/athletes"/>
            <StatCard label="Active Injuries" value={activeInj.length} note="requiring attention" trend={-15.5} color="#E74C3C" spark={[8,6,9,7,5,8,6,4,5,activeInj.length]}/>
            <StatCard label="Sessions" value={upcoming.length} note="next 7 days" trend={8.3} color="#27AE60" spark={[3,4,2,5,3,4,6,4,5,upcoming.length]} href="/schedule"/>
            <StatCard label="Staff" value={coaches.length} note="coaches & staff" color="#4A90E2" spark={[4,4,5,5,6,6,7,7,coaches.length,coaches.length]} href="/coaches"/>
            <StatCard label="Today" value={todaySess.length} note={todaySess.length===1?'session':'sessions'} color="#B7770D" spark={[1,2,1,3,2,1,2,3,2,todaySess.length]}/>
          </div>

          {/* Main grid */}
          <div className="main-grid">

            {/* LEFT COLUMN */}
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

              {/* Athletes table */}
              <div className="card">
                <div className="card-hdr">
                  <span className="card-title">Squad</span>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{ fontSize:11, color:'#8AA8A8', fontWeight:500 }}>{athletes.length} total</span>
                    {isAdmin && (
                      <Link href="/athletes" style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:700, color:'#fff', background:'#006A6A', padding:'5px 12px', borderRadius:8, textDecoration:'none' }}>
                        <Plus size={12}/> Add
                      </Link>
                    )}
                    <Link href="/athletes" className="view-all">All <ChevronRight size={12}/></Link>
                  </div>
                </div>

                {/* Table header */}
                <div className="ath-row" style={{ background:'#F8FCFC', borderBottom:'1px solid #EEF2F2', cursor:'default' }}>
                  {['Athlete','Position','Status','Club',''].map(h=><div key={h} className="th">{h}</div>)}
                </div>

                {filteredAthletes.length===0 ? (
                  <div style={{ padding:'32px', textAlign:'center', color:'#8AA8A8', fontSize:13 }}>
                    {search ? 'No athletes match your search.' : 'No athletes yet.'}
                  </div>
                ) : filteredAthletes.map((ath,i)=>(
                  <Link key={ath.id} href={`/athletes/${ath.id}`} style={{ textDecoration:'none' }}>
                    <div className="ath-row">
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <AthleteAvatar ath={ath} size={34} index={i}/>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:'#0D2B2B' }}>{ath.name}</div>
                          <div style={{ fontSize:11, color:'#8AA8A8' }}>{ath.position||'—'}</div>
                        </div>
                      </div>
                      <div style={{ fontSize:12, color:'#5A8A8A' }}>{ath.position||'—'}</div>
                      <div>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:99,
                          background: ath.status==='Active'?'#E8F8EE':ath.status==='Injured'?'#FEE8E8':'#FEF9E7',
                          color: ath.status==='Active'?'#1B6B3A':ath.status==='Injured'?'#8B2020':'#B7770D' }}>
                          <span style={{ width:5, height:5, borderRadius:'50%', background:'currentColor' }}/>
                          {ath.status||'Active'}
                        </span>
                      </div>
                      <div style={{ fontSize:12, color:'#5A8A8A' }}>{ath.club||'—'}</div>
                      <div style={{ display:'flex', justifyContent:'flex-end' }}>
                        <span style={{ fontSize:11, color:'#006A6A', fontWeight:700, background:'#F0FAF9', padding:'3px 10px', borderRadius:6 }}>View →</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Sessions */}
              <div className="card">
                <div className="card-hdr">
                  <span className="card-title">Upcoming Sessions</span>
                  <Link href="/schedule" className="view-all">Schedule <ChevronRight size={12}/></Link>
                </div>
                {upcoming.length===0 ? (
                  <div style={{ padding:'24px', textAlign:'center', color:'#8AA8A8', fontSize:13 }}>
                    No sessions in the next 7 days.
                    <Link href="/schedule" style={{ display:'block', marginTop:8, color:'#006A6A', fontWeight:600, fontSize:13, textDecoration:'none' }}>+ Add session</Link>
                  </div>
                ) : upcoming.map(s=>{
                  const isToday = s.date===todayStr
                  const typeColor = SESSION_COLORS[s.type]||'#006A6A'
                  return (
                    <div key={s.id} className="sess-row">
                      <div style={{ width:52, textAlign:'center', padding:'6px 8px', borderRadius:10, background:isToday?'#F0FAF9':'#F8FCFC', border:`1px solid ${isToday?'#C8E8E4':'#EEF2F2'}`, flexShrink:0 }}>
                        <div style={{ fontSize:12, fontWeight:800, color:'#006A6A', lineHeight:1.2 }}>{s.time}</div>
                        <div style={{ fontSize:9, fontWeight:700, color: isToday?'#006A6A':'#8AA8A8', textTransform:'uppercase', marginTop:2 }}>{isToday?'TODAY':s.date?.slice(5)}</div>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                          <span style={{ fontSize:13, fontWeight:700, color:'#0D2B2B' }}>{s.title}</span>
                          <span style={{ fontSize:10, fontWeight:700, background:typeColor+'18', color:typeColor, padding:'2px 7px', borderRadius:5 }}>{s.type}</span>
                        </div>
                        <div style={{ fontSize:11, color:'#8AA8A8' }}>{s.venue} · {s.duration}min{s.coaches?.name?' · '+s.coaches.name:''}</div>
                      </div>
                      {isToday && <span style={{ fontSize:10, fontWeight:700, color:'#27AE60', background:'#E8F8EE', padding:'3px 8px', borderRadius:99, flexShrink:0 }}>TODAY</span>}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

              {/* Squad health donut */}
              <div className="card" style={{ padding:'18px' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#0D2B2B', marginBottom:3 }}>Squad Health</div>
                <div style={{ fontSize:11, color:'#8AA8A8', marginBottom:16 }}>Current fitness status</div>
                <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                  <svg width="80" height="80" viewBox="0 0 80 80">
                    {(() => {
                      const total = athletes.length || 1
                      const active = athletes.filter(a=>a.status==='Active').length
                      const injured = athletes.filter(a=>a.status==='Injured').length
                      const other = total - active - injured
                      const r = 28, cx = 40, cy = 40, circ = 2*Math.PI*r
                      const pA = active/total, pI = injured/total, pO = other/total
                      let offset = 0
                      const segs = [
                        { pct:pA, color:'#27AE60' },
                        { pct:pI, color:'#E74C3C' },
                        { pct:pO, color:'#F0FAF9' },
                      ]
                      return segs.map((seg,i)=>{
                        const dash = seg.pct*circ
                        const gap  = circ - dash
                        const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="10" strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset*circ} className="donut-ring" style={{ transformOrigin:`${cx}px ${cy}px` }}/>
                        offset += seg.pct
                        return el
                      })
                    })()}
                    <text x="40" y="44" textAnchor="middle" style={{ fontSize:14, fontWeight:800, fill:'#0D2B2B', fontFamily:'inherit' }}>
                      {athletes.length > 0 ? Math.round(athletes.filter(a=>a.status==='Active').length/athletes.length*100) : 0}%
                    </text>
                  </svg>
                  <div style={{ flex:1 }}>
                    {[['Active', athletes.filter(a=>a.status==='Active').length, '#27AE60'],
                      ['Injured', athletes.filter(a=>a.status==='Injured').length, '#E74C3C'],
                      ['Other', athletes.filter(a=>a.status!=='Active'&&a.status!=='Injured').length, '#8AA8A8']
                    ].map(([label,val,color])=>(
                      <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ width:8, height:8, borderRadius:'50%', background:color, display:'inline-block' }}/>
                          <span style={{ fontSize:12, color:'#5A8A8A', fontWeight:500 }}>{label}</span>
                        </div>
                        <span style={{ fontSize:12, fontWeight:700, color:'#0D2B2B' }}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Medical alerts */}
              <div className="card">
                <div className="card-hdr">
                  <span className="card-title">Medical Alerts</span>
                  <Link href="/injuries" className="view-all">All <ChevronRight size={12}/></Link>
                </div>
                {activeInj.length===0 ? (
                  <div style={{ padding:'20px', textAlign:'center', color:'#8AA8A8', fontSize:13 }}>No active injuries</div>
                ) : activeInj.slice(0,4).map((inj,i)=>(
                  <div key={inj.id} className="inj-row">
                    <AthleteAvatar ath={inj.athletes} size={32} index={i}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#0D2B2B', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inj.athletes?.name}</div>
                      <div style={{ fontSize:11, color:'#8AA8A8' }}>{inj.injury_type} · {inj.expected_return||'TBD'}</div>
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:99, flexShrink:0,
                      background: inj.severity==='Severe'?'#FEE8E8':inj.severity==='Moderate'?'#FEF9E7':'#FFF3E0',
                      color: inj.severity==='Severe'?'#8B2020':inj.severity==='Moderate'?'#B7770D':'#E65100' }}>
                      {inj.severity||'Mild'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Performance mini chart */}
              <div className="card" style={{ padding:'16px 18px' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#0D2B2B', marginBottom:3 }}>Performance Trend</div>
                <div style={{ fontSize:11, color:'#8AA8A8', marginBottom:12 }}>Last 10 matches</div>
                {[{ data:[45,52,48,60,55,68,64,72,70,78], color:'#006A6A', label:'Performance' },
                  { data:[30,38,35,42,50,44,56,52,60,58], color:'#27AE60', label:'Endurance' },
                  { data:[60,55,62,58,52,65,60,68,65,72], color:'#B7770D', label:'Strength' }
                ].map(({ data,color,label })=>(
                  <div key={label} style={{ marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontSize:11, color:'#5A8A8A', fontWeight:600 }}>{label}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:'#0D2B2B' }}>{data[data.length-1]}</span>
                    </div>
                    <div style={{ height:28 }}><SparkLine data={data} color={color} height={28}/></div>
                  </div>
                ))}
              </div>

              {/* Quick actions — admin only */}
              {isAdmin && (
                <div className="card" style={{ padding:'14px 16px' }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#0D2B2B', marginBottom:12 }}>Quick Actions</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                    {[
                      { icon:'⚽', label:'Athletes', href:'/athletes' },
                      { icon:'📅', label:'Schedule',  href:'/schedule' },
                      { icon:'🔍', label:'Scout',     href:'/scouting' },
                      { icon:'📄', label:'Reports',   href:'/reports' },
                      { icon:'📋', label:'Contracts', href:'/contracts' },
                      { icon:'⚙️', label:'Settings',  href:'/settings' },
                    ].map(({ icon,label,href })=>(
                      <Link key={label} href={href} className="quick-btn">
                        <span style={{ fontSize:20 }}>{icon}</span>
                        <span style={{ fontSize:11, fontWeight:700, color:'#2D6B6B', lineHeight:1.2 }}>{label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}