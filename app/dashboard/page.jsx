'use client'
import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import Badge from '@/components/Badge'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const AV_COLORS = ['#4A90E2','#27AE60','#E67E22','#9B59B6','#E74C3C','#1ABC9C']
function initials(n) { return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }

function AthleteAvatar({ ath, size=40, index=0 }) {
  const [err, setErr] = useState(false)
  if (ath?.photo_url && !err) {
    return <img src={ath.photo_url} alt={ath?.name} onError={()=>setErr(true)} style={{ width:size,height:size,borderRadius:'50%',objectFit:'cover',border:'2px solid rgba(255,255,255,0.3)',flexShrink:0 }}/>
  }
  return (
    <div style={{ width:size,height:size,borderRadius:'50%',flexShrink:0,background:AV_COLORS[index%AV_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.32,fontWeight:800,color:'#fff',border:'2px solid rgba(255,255,255,0.2)' }}>
      {initials(ath?.name)}
    </div>
  )
}

const SESSION_COLORS = {
  'Squad Training':'#5B9BD5','Strength & Conditioning':'#4CAF82','Tactical Drills':'#9B59B6',
  'Recovery Session':'#26C6DA','Match Preparation':'#FF8A65','Friendly Match':'#EF5350',
  'Fitness Test':'#FFA726','Video Analysis':'#90A4AE',
}

function MiniChart({ data=[40,55,48,62,58,72,68,75,70,80], color='#5B9BD5' }) {
  const max=Math.max(...data), min=Math.min(...data)
  const w=280, h=70, pad=8
  const pts=data.map((v,i)=>{
    const x=pad+(i/(data.length-1))*(w-pad*2)
    const y=h-pad-((v-min)/(max-min||1))*(h-pad*2)
    return `${x},${y}`
  }).join(' ')
  const gid=`g${color.replace('#','')}`
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow:'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={`${pad},${h} ${pts} ${w-pad},${h}`} fill={`url(#${gid})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {data.map((v,i)=>{
        if (i!==data.length-1) return null
        const x=pad+(i/(data.length-1))*(w-pad*2)
        const y=h-pad-((v-min)/(max-min||1))*(h-pad*2)
        return <circle key={i} cx={x} cy={y} r="4" fill={color} stroke="white" strokeWidth="2"/>
      })}
    </svg>
  )
}

export default function Dashboard() {
  const [athletes, setAthletes] = useState([])
  const [injuries, setInjuries] = useState([])
  const [coaches,  setCoaches]  = useState([])
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [profile,  setProfile]  = useState(null)
  const [isAdmin,  setIsAdmin]  = useState(false)

  useEffect(() => {
    async function load() {
      const { data:{ session } } = await supabase.auth.getSession()
      if (session) {
        const { data:p } = await supabase.from('profiles').select('*,teams(id,name,short_name,primary_color)').eq('id',session.user.id).single()
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

  const today     = new Date()
  const todayStr  = today.toISOString().split('T')[0]
  const next7     = new Date(); next7.setDate(next7.getDate()+7)
  const activeInj = injuries.filter(i=>i.status==='Active')
  const recent    = athletes.slice(0,6)
  const todaySess = sessions.filter(s=>s.date===todayStr)
  const upcoming  = sessions.filter(s=>s.date>=todayStr&&new Date(s.date)<=next7).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)).slice(0,4)
  const greet     = today.getHours()<12?'Good morning':today.getHours()<17?'Good afternoon':'Good evening'

  if (loading) return (
    <Layout>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh' }}>
        <div style={{ width:40,height:40,border:'4px solid #E0ECFF',borderTopColor:'#5B9BD5',borderRadius:'50%',animation:'spin 0.7s linear infinite' }}/>
      </div>
    </Layout>
  )

  const stats = [
    { label:'Athletes',  value:athletes.length, note:`${athletes.filter(a=>a.status==='Active').length} active`, icon:'👥' },
    { label:'Staff',     value:coaches.length,  note:'on team',        icon:'🎽' },
    { label:'Events',    value:upcoming.length, note:'next 7 days',    icon:'📅' },
    { label:'Injuries',  value:activeInj.length,note:'active',         icon:'🩺' },
    { label:'Today',     value:todaySess.length,note:'sessions',       icon:'⚡' },
  ]

  return (
    <Layout>
      <style>{`
        .dash-hero { padding:32px 40px 26px; }
        .dash-stats { grid-template-columns:repeat(5,1fr); }
        .dash-grid { grid-template-columns:65% 35%; }
        .dash-athletes-cols { grid-template-columns:2.2fr 1fr 0.9fr 1fr 0.8fr; }
        .dash-athletes-header { display:grid !important; }
        @media(max-width:900px) {
          .dash-stats { grid-template-columns:repeat(3,1fr) !important; }
          .dash-grid { grid-template-columns:1fr !important; }
        }
        @media(max-width:768px) {
          .dash-hero { padding:20px 16px 18px !important; }
          .dash-stats { grid-template-columns:repeat(2,1fr) !important; gap:8px !important; }
          .dash-grid { gap:14px !important; padding:14px 12px 0 !important; }
          .dash-athletes-cols { grid-template-columns:1fr auto !important; }
          .dash-athletes-header { display:none !important; }
          .dash-hide-mobile { display:none !important; }
          .dash-session-date { min-width:64px !important; }
        }
      `}</style>

      {/* Hero banner */}
      <div className="dash-hero" style={{ background:'linear-gradient(135deg,#3D6A9E 0%,#5B9BD5 50%,#7BB3E0 80%,#9FCBE8 100%)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute',top:-60,right:-60,width:280,height:280,borderRadius:'50%',background:'rgba(255,255,255,0.08)' }}/>
        <div style={{ position:'absolute',bottom:-40,right:180,width:180,height:180,borderRadius:'50%',background:'rgba(255,255,255,0.05)' }}/>

        <div style={{ position:'relative', maxWidth:1280, margin:'0 auto' }}>
          <div style={{ fontSize:12,color:'rgba(255,255,255,0.7)',fontWeight:500,marginBottom:4 }}>
            {greet} · {today.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}
          </div>
          <h1 style={{ fontSize:22,fontWeight:800,color:'#fff',marginBottom:14,letterSpacing:'-0.02em' }}>
            Welcome, <span style={{ color:'#D4EEFF' }}>{profile?.full_name||'Admin'}</span>
          </h1>

          {todaySess.length>0 && (
            <div style={{ display:'inline-flex',alignItems:'center',gap:8,background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:99,padding:'6px 14px',marginBottom:14,backdropFilter:'blur(8px)' }}>
              <span style={{ fontSize:13 }}>📅</span>
              <span style={{ fontSize:12,color:'rgba(255,255,255,0.95)',fontWeight:600 }}>{todaySess.length} session{todaySess.length>1?'s':''} today</span>
            </div>
          )}

          <div className="dash-stats" style={{ display:'grid', gap:10 }}>
            {stats.map(s=>(
              <div key={s.label} style={{ background:'rgba(255,255,255,0.18)',backdropFilter:'blur(12px)',borderRadius:12,padding:'14px 16px',border:'1px solid rgba(255,255,255,0.28)' }}>
                <div style={{ fontSize:20,marginBottom:6 }}>{s.icon}</div>
                <div style={{ fontSize:24,fontWeight:900,color:'#fff',lineHeight:1,marginBottom:3 }}>{s.value}</div>
                <div style={{ fontSize:11,color:'rgba(255,255,255,0.85)',fontWeight:600 }}>{s.label}</div>
                <div style={{ fontSize:10,color:'rgba(255,255,255,0.55)',marginTop:1 }}>{s.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="dash-grid" style={{ maxWidth:1280,margin:'0 auto',padding:'24px 40px 0',display:'grid',gap:22,alignItems:'start' }}>

        {/* Left column */}
        <div style={{ display:'flex',flexDirection:'column',gap:20 }}>

          {/* Recent Athletes */}
          <div className="card fade-up" style={{ padding:0,overflow:'hidden' }}>
            <div style={{ padding:'14px 16px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <h2 style={{ fontSize:15,fontWeight:700 }}>Recent Athletes</h2>
              <Link href="/athletes" style={{ fontSize:12,color:'var(--blue)',fontWeight:600,padding:'5px 12px',borderRadius:8,background:'var(--blue-light)',textDecoration:'none' }}>View All</Link>
            </div>
            <div className="dash-athletes-header dash-athletes-cols" style={{ gap:8,padding:'8px 16px',background:'var(--surface2)',borderBottom:'1px solid var(--border)' }}>
              {['Athlete','Position','Status','Club',''].map(h=>(
                <div key={h} style={{ fontSize:10,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase' }}>{h}</div>
              ))}
            </div>
            {recent.length===0?(
              <div style={{ padding:'32px',textAlign:'center',color:'var(--text3)',fontSize:13 }}>No athletes yet.</div>
            ):recent.map((ath,i)=>(
              <div key={ath.id} className="dash-athletes-cols" style={{ display:'grid',gap:8,alignItems:'center',padding:'11px 16px',borderBottom:'1px solid var(--border)',transition:'var(--transition)',cursor:'pointer' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                onMouseLeave={e=>e.currentTarget.style.background=''}>
                <div style={{ display:'flex',alignItems:'center',gap:9 }}>
                  <AthleteAvatar ath={ath} size={34} index={i}/>
                  <div>
                    <Link href={`/athletes/${ath.id}`} style={{ fontSize:13,fontWeight:700,color:'var(--text)',display:'block',textDecoration:'none' }}>{ath.name}</Link>
                    <span style={{ fontSize:11,color:'var(--text3)' }}>{ath.position||'—'}</span>
                  </div>
                </div>
                <div className="dash-hide-mobile" style={{ fontSize:12,color:'var(--text2)' }}>{ath.position||'—'}</div>
                <Badge status={ath.status}/>
                <div className="dash-hide-mobile" style={{ fontSize:12,color:'var(--text2)' }}>{ath.club||'—'}</div>
                <Link href={`/athletes/${ath.id}`} style={{ fontSize:11,color:'var(--blue)',fontWeight:700,background:'var(--blue-light)',padding:'4px 10px',borderRadius:6,textDecoration:'none',whiteSpace:'nowrap' }}>View →</Link>
              </div>
            ))}
          </div>

          {/* Upcoming Sessions */}
          <div className="card fade-up fade-up-1" style={{ padding:0,overflow:'hidden' }}>
            <div style={{ padding:'14px 16px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <h2 style={{ fontSize:15,fontWeight:700 }}>Upcoming Sessions</h2>
              <Link href="/schedule" style={{ fontSize:12,color:'var(--blue)',fontWeight:600,padding:'5px 12px',borderRadius:8,background:'var(--blue-light)',textDecoration:'none' }}>Schedule</Link>
            </div>
            {upcoming.length===0?(
              <div style={{ padding:'24px 16px',textAlign:'center',color:'var(--text3)',fontSize:13 }}>
                No sessions in next 7 days.
                <Link href="/schedule" style={{ display:'block',marginTop:8,color:'var(--blue)',fontWeight:600,fontSize:13,textDecoration:'none' }}>+ Add session</Link>
              </div>
            ):upcoming.map(s=>{
              const isToday=s.date===todayStr
              return(
                <div key={s.id} style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom:'1px solid var(--border)',transition:'var(--transition)' }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                  onMouseLeave={e=>e.currentTarget.style.background=''}>
                  <div className="dash-session-date" style={{ minWidth:80,textAlign:'center',padding:'7px 10px',borderRadius:10,background:isToday?'#EEF6FF':'var(--surface2)',border:isToday?'1px solid rgba(91,155,213,0.35)':'1px solid var(--border)',flexShrink:0 }}>
                    <div style={{ fontSize:12,fontWeight:800,color:isToday?'#3D6A9E':'var(--text)',lineHeight:1.2 }}>{s.time}</div>
                    <div style={{ fontSize:10,fontWeight:600,color:isToday?'#3D6A9E':'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em',marginTop:2 }}>{isToday?'TODAY':s.date}</div>
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:2,flexWrap:'wrap' }}>
                      <span style={{ fontSize:13,fontWeight:700,color:'var(--text)' }}>{s.title}</span>
                      <span style={{ fontSize:10,fontWeight:700,background:(SESSION_COLORS[s.type]||'#5B9BD5')+'20',color:SESSION_COLORS[s.type]||'#5B9BD5',padding:'2px 7px',borderRadius:6,whiteSpace:'nowrap' }}>{s.type}</span>
                    </div>
                    <div style={{ fontSize:11,color:'var(--text3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>📍 {s.venue} · ⏱ {s.duration}min</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display:'flex',flexDirection:'column',gap:16 }}>

          {/* Performance chart */}
          <div className="card fade-up" style={{ padding:'16px 18px' }}>
            <h2 style={{ fontSize:14,fontWeight:700,marginBottom:3 }}>Performance Overview</h2>
            <p style={{ fontSize:11,color:'var(--text3)',marginBottom:10 }}>Squad trends — last 10 matches</p>
            <MiniChart data={[45,52,48,60,55,68,64,72,70,78]} color="#5B9BD5"/>
            <MiniChart data={[30,38,35,42,50,44,56,52,60,58]} color="#4CAF82"/>
            <MiniChart data={[60,55,62,58,52,65,60,68,65,72]} color="#FFA726"/>
            <div style={{ display:'flex',gap:12,marginTop:8,flexWrap:'wrap' }}>
              {[['#5B9BD5','Performance'],['#4CAF82','Endurance'],['#FFA726','Strength']].map(([c,l])=>(
                <div key={l} style={{ display:'flex',alignItems:'center',gap:4,fontSize:11,color:'var(--text2)',fontWeight:600 }}>
                  <span style={{ width:10,height:3,borderRadius:2,background:c,display:'inline-block' }}/>{l}
                </div>
              ))}
            </div>
          </div>

          {/* Medical alerts */}
          <div className="card fade-up fade-up-1" style={{ padding:0,overflow:'hidden' }}>
            <div style={{ background:'linear-gradient(90deg,#C0392B,#E74C3C)',padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <h3 style={{ fontSize:14,fontWeight:700,color:'#fff' }}>🩺 Medical Alerts</h3>
              <Link href="/injuries" style={{ fontSize:11,color:'rgba(255,255,255,0.85)',fontWeight:600,background:'rgba(255,255,255,0.15)',padding:'3px 10px',borderRadius:99,textDecoration:'none' }}>View all</Link>
            </div>
            <div style={{ padding:'6px 0' }}>
              {activeInj.length===0?(
                <p style={{ padding:'16px',color:'var(--text3)',fontSize:13,textAlign:'center' }}>No active injuries 🎉</p>
              ):activeInj.slice(0,4).map((inj,i)=>(
                <div key={inj.id} style={{ padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10 }}>
                  <AthleteAvatar ath={inj.athletes} size={32} index={i}/>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:12,fontWeight:700,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{inj.athletes?.name}</div>
                    <div style={{ fontSize:11,color:'var(--text3)' }}>{inj.injury_type} · {inj.expected_return||'TBD'}</div>
                  </div>
                  <Badge status={inj.severity}/>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions — admin only */}
          {isAdmin && (
            <div className="card fade-up fade-up-2" style={{ padding:'14px 16px' }}>
              <h3 style={{ fontSize:14,fontWeight:700,marginBottom:12 }}>Quick Actions</h3>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
                {[
                  { icon:'➕', label:'Add Athlete',  href:'/athletes',  bg:'#EEF6FF', color:'#3D6A9E' },
                  { icon:'📅', label:'Schedule',     href:'/schedule',  bg:'#E8F8EE', color:'#1B7A3E' },
                  { icon:'🔍', label:'Scout',        href:'/scouting',  bg:'#F3E5F5', color:'#6A1B9A' },
                  { icon:'📄', label:'Reports',      href:'/reports',   bg:'#FEF9E7', color:'#B36200' },
                  { icon:'💰', label:'Contracts',    href:'/contracts', bg:'#E0F7F5', color:'#0E8A7E' },
                  { icon:'⚙️', label:'Settings',    href:'/settings',  bg:'#F5F5F5', color:'#5A6778' },
                ].map(({ icon,label,href,bg,color })=>(
                  <Link key={label} href={href} style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'11px 8px',borderRadius:10,background:bg,border:'1px solid var(--border)',textAlign:'center',textDecoration:'none',transition:'var(--transition)' }}
                    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='var(--shadow-md)'}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}>
                    <span style={{ fontSize:20 }}>{icon}</span>
                    <span style={{ fontSize:11,fontWeight:700,color,lineHeight:1.2 }}>{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ height:40 }}/>
    </Layout>
  )
}