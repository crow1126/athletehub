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

  return (
    <Layout>
      {/* ── Hero banner — lighter, softer gradient ── */}
      <div style={{ background:'linear-gradient(135deg,#3D6A9E 0%,#5B9BD5 50%,#7BB3E0 80%,#9FCBE8 100%)',padding:'32px 40px 26px',position:'relative',overflow:'hidden' }}>
        {/* Soft decorative shapes */}
        <div style={{ position:'absolute',top:-60,right:-60,width:280,height:280,borderRadius:'50%',background:'rgba(255,255,255,0.08)' }}/>
        <div style={{ position:'absolute',bottom:-40,right:180,width:180,height:180,borderRadius:'50%',background:'rgba(255,255,255,0.05)' }}/>
        <div style={{ position:'absolute',top:'30%',left:'40%',width:120,height:120,borderRadius:'50%',background:'rgba(255,255,255,0.04)' }}/>

        <div style={{ position:'relative',maxWidth:1280,margin:'0 auto' }}>
          <div style={{ fontSize:13,color:'rgba(255,255,255,0.7)',fontWeight:500,marginBottom:5 }}>
            {greet} · {today.toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
          </div>
          <h1 style={{ fontSize:26,fontWeight:800,color:'#fff',marginBottom:16,letterSpacing:'-0.02em',textShadow:'0 1px 4px rgba(0,0,0,0.15)' }}>
            Welcome back, <span style={{ color:'#D4EEFF' }}>{profile?.full_name||'Admin'}</span>
          </h1>

          {todaySess.length>0 && (
            <div style={{ display:'inline-flex',alignItems:'center',gap:8,background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:99,padding:'6px 16px',marginBottom:18,backdropFilter:'blur(8px)' }}>
              <span style={{ fontSize:14 }}>📅</span>
              <span style={{ fontSize:13,color:'rgba(255,255,255,0.95)',fontWeight:600 }}>{todaySess.length} session{todaySess.length>1?'s':''} scheduled today</span>
            </div>
          )}

          {/* Stat cards — softer white glass */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12 }}>
            {[
              { label:'Total Athletes',  value:athletes.length,              note:`${athletes.filter(a=>a.status==='Active').length} active`,  icon:'👥', accent:'rgba(255,255,255,0.9)' },
              { label:'Staff Members',   value:coaches.length,               note:'on team',          icon:'🎽', accent:'rgba(255,255,255,0.9)' },
              { label:'Upcoming Events', value:upcoming.length,              note:'next 7 days',      icon:'📅', accent:'rgba(255,255,255,0.9)' },
              { label:'Active Injuries', value:activeInj.length,             note:'needs attention',  icon:'🩺', accent:'rgba(255,255,255,0.9)' },
              { label:"Today's Sessions",value:todaySess.length,             note:'scheduled',        icon:'⚡', accent:'rgba(255,255,255,0.9)' },
            ].map(s=>(
              <div key={s.label} style={{ background:'rgba(255,255,255,0.18)',backdropFilter:'blur(12px)',borderRadius:14,padding:'16px 18px',border:'1px solid rgba(255,255,255,0.28)',transition:'var(--transition)' }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.25)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.18)'}>
                <div style={{ fontSize:22,marginBottom:8 }}>{s.icon}</div>
                <div style={{ fontSize:28,fontWeight:900,color:'#fff',lineHeight:1,marginBottom:4,textShadow:'0 1px 3px rgba(0,0,0,0.1)' }}>{s.value}</div>
                <div style={{ fontSize:11,color:'rgba(255,255,255,0.85)',fontWeight:600 }}>{s.label}</div>
                <div style={{ fontSize:10,color:'rgba(255,255,255,0.55)',marginTop:2 }}>{s.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div style={{ maxWidth:1280,margin:'0 auto',padding:'24px 40px 0' }}>
        <div style={{ display:'grid',gridTemplateColumns:'65% 35%',gap:22,alignItems:'start' }}>

          {/* Left */}
          <div style={{ display:'flex',flexDirection:'column',gap:20 }}>

            {/* Recent Athletes */}
            <div className="card fade-up" style={{ padding:0,overflow:'hidden' }}>
              <div style={{ padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                <h2 style={{ fontSize:16,fontWeight:700 }}>Recent Athletes</h2>
                <Link href="/athletes" style={{ fontSize:13,color:'var(--blue)',fontWeight:600,padding:'6px 14px',borderRadius:8,background:'var(--blue-light)',textDecoration:'none' }}>View All</Link>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'2.2fr 1fr 0.9fr 1fr 0.8fr',gap:8,padding:'10px 20px',background:'var(--surface2)',borderBottom:'1px solid var(--border)' }}>
                {['Athlete','Position','Status','Club','Action'].map(h=>(
                  <div key={h} style={{ fontSize:11,fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase' }}>{h}</div>
                ))}
              </div>
              {recent.length===0?(
                <div style={{ padding:'40px',textAlign:'center',color:'var(--text3)',fontSize:13 }}>No athletes registered yet.</div>
              ):recent.map((ath,i)=>(
                <div key={ath.id} style={{ display:'grid',gridTemplateColumns:'2.2fr 1fr 0.9fr 1fr 0.8fr',gap:8,alignItems:'center',padding:'12px 20px',borderBottom:'1px solid var(--border)',transition:'var(--transition)',cursor:'pointer' }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                  onMouseLeave={e=>e.currentTarget.style.background=''}>
                  <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                    <AthleteAvatar ath={ath} size={38} index={i}/>
                    <div>
                      <Link href={`/athletes/${ath.id}`} style={{ fontSize:13,fontWeight:700,color:'var(--text)',display:'block',textDecoration:'none' }}>{ath.name}</Link>
                      <span style={{ fontSize:11,color:'var(--text3)' }}>{ath.region||'—'}</span>
                    </div>
                  </div>
                  <div style={{ fontSize:12,color:'var(--text2)' }}>{ath.position||'—'}</div>
                  <Badge status={ath.status}/>
                  <div style={{ fontSize:12,color:'var(--text2)' }}>{ath.club||'—'}</div>
                  <Link href={`/athletes/${ath.id}`} style={{ fontSize:11,color:'var(--blue)',fontWeight:700,background:'var(--blue-light)',padding:'4px 10px',borderRadius:6,textDecoration:'none' }}>View →</Link>
                </div>
              ))}
            </div>

            {/* Upcoming Sessions */}
            <div className="card fade-up fade-up-1" style={{ padding:0,overflow:'hidden' }}>
              <div style={{ padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                <h2 style={{ fontSize:16,fontWeight:700 }}>Upcoming Training Sessions</h2>
                <Link href="/schedule" style={{ fontSize:13,color:'var(--blue)',fontWeight:600,padding:'6px 14px',borderRadius:8,background:'var(--blue-light)',textDecoration:'none' }}>View Schedule</Link>
              </div>
              {upcoming.length===0?(
                <div style={{ padding:'28px 20px',textAlign:'center',color:'var(--text3)',fontSize:13 }}>
                  No sessions in the next 7 days.
                  <Link href="/schedule" style={{ display:'block',marginTop:8,color:'var(--blue)',fontWeight:600,fontSize:13,textDecoration:'none' }}>+ Schedule a session</Link>
                </div>
              ):upcoming.map(s=>{
                const isToday=s.date===todayStr
                return(
                  <div key={s.id} style={{ display:'flex',alignItems:'center',gap:16,padding:'13px 20px',borderBottom:'1px solid var(--border)',transition:'var(--transition)',cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                    onMouseLeave={e=>e.currentTarget.style.background=''}>
                    <div style={{ minWidth:84,textAlign:'center',padding:'8px 10px',borderRadius:10,background:isToday?'#EEF6FF':'var(--surface2)',border:isToday?'1px solid rgba(91,155,213,0.35)':'1px solid var(--border)',flexShrink:0 }}>
                      <div style={{ fontSize:13,fontWeight:800,color:isToday?'#3D6A9E':'var(--text)',lineHeight:1.2 }}>{s.time}</div>
                      <div style={{ fontSize:10,fontWeight:600,color:isToday?'#3D6A9E':'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em',marginTop:2 }}>{isToday?'TODAY':s.date}</div>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:3 }}>
                        <span style={{ fontSize:14,fontWeight:700,color:'var(--text)' }}>{s.title}</span>
                        <span style={{ fontSize:10,fontWeight:700,background:(SESSION_COLORS[s.type]||'#5B9BD5')+'20',color:SESSION_COLORS[s.type]||'#5B9BD5',padding:'2px 8px',borderRadius:6 }}>{s.type}</span>
                      </div>
                      <div style={{ fontSize:12,color:'var(--text3)' }}>📍 {s.venue} · ⏱ {s.duration}min{s.coaches?' · 👤 '+s.coaches.name.replace('Coach ',''):''}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right */}
          <div style={{ display:'flex',flexDirection:'column',gap:16 }}>

            {/* Performance chart */}
            <div className="card fade-up" style={{ padding:'18px 20px' }}>
              <h2 style={{ fontSize:15,fontWeight:700,marginBottom:4 }}>Performance Overview</h2>
              <p style={{ fontSize:12,color:'var(--text3)',marginBottom:12 }}>Squad trends — last 10 matches</p>
              <MiniChart data={[45,52,48,60,55,68,64,72,70,78]} color="#5B9BD5"/>
              <MiniChart data={[30,38,35,42,50,44,56,52,60,58]} color="#4CAF82"/>
              <MiniChart data={[60,55,62,58,52,65,60,68,65,72]} color="#FFA726"/>
              <div style={{ display:'flex',gap:14,marginTop:10,flexWrap:'wrap' }}>
                {[['#5B9BD5','Performance'],['#4CAF82','Endurance'],['#FFA726','Strength']].map(([c,l])=>(
                  <div key={l} style={{ display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text2)',fontWeight:600 }}>
                    <span style={{ width:12,height:3,borderRadius:2,background:c,display:'inline-block' }}/>{l}
                  </div>
                ))}
              </div>
            </div>

            {/* Medical alerts */}
            <div className="card fade-up fade-up-1" style={{ padding:0,overflow:'hidden' }}>
              <div style={{ background:'linear-gradient(90deg,#C0392B,#E74C3C)',padding:'13px 16px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                <h3 style={{ fontSize:14,fontWeight:700,color:'#fff' }}>🩺 Medical Alerts</h3>
                <Link href="/injuries" style={{ fontSize:11,color:'rgba(255,255,255,0.85)',fontWeight:600,background:'rgba(255,255,255,0.15)',padding:'3px 10px',borderRadius:99,textDecoration:'none' }}>View all</Link>
              </div>
              <div style={{ padding:'8px 0' }}>
                {activeInj.length===0?(
                  <p style={{ padding:'18px 16px',color:'var(--text3)',fontSize:13,textAlign:'center' }}>No active injuries 🎉</p>
                ):activeInj.slice(0,4).map((inj,i)=>(
                  <div key={inj.id} style={{ padding:'10px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10 }}>
                    <AthleteAvatar ath={inj.athletes} size={34} index={i}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12,fontWeight:700,color:'var(--text)' }}>{inj.athletes?.name}</div>
                      <div style={{ fontSize:11,color:'var(--text3)' }}>{inj.injury_type} · Return: {inj.expected_return||'TBD'}</div>
                    </div>
                    <Badge status={inj.severity}/>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions — admin only */}
            {isAdmin && (
              <div className="card fade-up fade-up-2" style={{ padding:'16px 18px' }}>
                <h3 style={{ fontSize:15,fontWeight:700,marginBottom:14 }}>Quick Actions</h3>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
                  {[
                    { icon:'➕', label:'Add Athlete',  href:'/athletes',  bg:'#EEF6FF', color:'#3D6A9E' },
                    { icon:'📅', label:'Schedule',     href:'/schedule',  bg:'#E8F8EE', color:'#1B7A3E' },
                    { icon:'🔍', label:'Scout Player', href:'/scouting',  bg:'#F3E5F5', color:'#6A1B9A' },
                    { icon:'📄', label:'Reports',      href:'/reports',   bg:'#FEF9E7', color:'#B36200' },
                    { icon:'💰', label:'Contracts',    href:'/contracts', bg:'#E0F7F5', color:'#0E8A7E' },
                    { icon:'⚙️', label:'Settings',    href:'/settings',  bg:'#F5F5F5', color:'#5A6778' },
                  ].map(({ icon,label,href,bg,color })=>(
                    <Link key={label} href={href} style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:5,padding:'12px 8px',borderRadius:10,background:bg,border:'1px solid var(--border)',transition:'var(--transition)',textAlign:'center',textDecoration:'none' }}
                      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='var(--shadow-md)'}}
                      onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}>
                      <span style={{ fontSize:22 }}>{icon}</span>
                      <span style={{ fontSize:11,fontWeight:700,color,lineHeight:1.2 }}>{label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ height:40 }}/>
    </Layout>
  )
}