'use client'
import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import Badge from '@/components/Badge'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const AV_COLORS = ['#4A90E2','#27AE60','#E67E22','#9B59B6']

const POSITION_CATEGORY = {
  GK:  'Goalkeeper',
  CB:  'Defender',  RB:  'Defender',  LB:  'Defender',
  RWB: 'Defender',  LWB: 'Defender',
  CDM: 'Midfielder', CM: 'Midfielder', CAM: 'Midfielder',
  RM:  'Midfielder', LM: 'Midfielder',
  RW:  'Forward',   LW:  'Forward',   CF:  'Forward',
  SS:  'Forward',   ST:  'Forward',
}

function initials(n) { return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }

export default function AthleteDetail() {
  const { id } = useParams()
  const [ath,      setAth]      = useState(null)
  const [injuries, setInjuries] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: a }, { data: i }] = await Promise.all([
        supabase.from('athletes').select('*, coaches(name)').eq('id', id).single(),
        supabase.from('injuries').select('*').eq('athlete_id', id).order('date_of_injury', { ascending: false }),
      ])
      setAth(a); setInjuries(i || []); setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <Layout>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
        <div style={{ width:36, height:36, border:'4px solid var(--blue-light)', borderTopColor:'var(--blue)', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
      </div>
    </Layout>
  )

  if (!ath) return (
    <Layout>
      <div style={{ maxWidth:1280, margin:'0 auto', padding:'32px 40px' }}>
        <p style={{ color:'var(--danger)', marginBottom:12 }}>Athlete not found.</p>
        <Link href="/athletes" style={{ color:'var(--blue)', fontWeight:600 }}>← Back to Athletes</Link>
      </div>
    </Layout>
  )

  const showPhoto    = ath.photo_url && !imgError
  const posCategory  = POSITION_CATEGORY[ath.position] || null

  const strongFootLabel = ath.strong_foot
    ? ath.strong_foot === 'both' ? '🦶 Both Feet'
    : ath.strong_foot === 'left' ? '🦶 Left Foot'
    : '🦶 Right Foot'
    : '—'

  const fields = [
    ['Position',    ath.position ? `${ath.position}${posCategory ? ` — ${posCategory}` : ''}` : '—'],
    ['Strong Foot', strongFootLabel],
    ['Club',        ath.club         || '—'],
    ['Region',      ath.region       || '—'],
    ['Age',         ath.age          ? `${ath.age} yrs`   : '—'],
    ['Height',      ath.height       ? `${ath.height} cm` : '—'],
    ['Weight',      ath.weight       ? `${ath.weight} kg` : '—'],
    ['Phone',       ath.phone        || '—'],
    ['Coach',       ath.coaches?.name || '—'],
    ['Joined',      ath.joined_date  || '—'],
  ]

  return (
    <Layout>
      <style>{`
        .ath-detail-outer{max-width:1280px;margin:0 auto;padding:32px 40px}
        .ath-detail-grid{display:grid;grid-template-columns:1fr 1.8fr;gap:20px;align-items:start}
        .ath-detail-bar{margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}
        @media(max-width:768px){
          .ath-detail-outer{padding:16px 12px!important}
          .ath-detail-grid{grid-template-columns:1fr!important}
          .ath-detail-bar{flex-wrap:wrap;gap:10px}
        }
      `}</style>

      <div className="ath-detail-outer">

        <div className="ath-detail-bar">
          <Link href="/athletes" style={{ fontSize:13, color:'var(--blue)', fontWeight:600 }}>← Back to Athletes</Link>
          <Link href={`/athletes/${id}/report`} style={{ background:'linear-gradient(135deg,#2E6FC4,#4A90E2)', color:'#fff', padding:'9px 20px', borderRadius:'var(--r-md)', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:6, boxShadow:'var(--shadow-blue)', textDecoration:'none' }}>
            📄 Generate Report
          </Link>
        </div>

        {/* Hero card */}
        <div className="card fade-up" style={{ background:'linear-gradient(135deg,#1A3A6C 0%,#2E6FC4 50%,#4A90E2 100%)', borderRadius:'var(--r-xl)', padding:'28px 32px', marginBottom:22, display:'flex', gap:24, alignItems:'center', flexWrap:'wrap' }}>
          {showPhoto ? (
            <img src={ath.photo_url} alt={ath.name} onError={()=>setImgError(true)}
              style={{ width:90, height:90, borderRadius:'50%', objectFit:'cover', border:'4px solid rgba(255,255,255,0.4)', flexShrink:0 }}/>
          ) : (
            <div style={{ width:90, height:90, borderRadius:'50%', flexShrink:0, background:AV_COLORS[0], display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:800, color:'#fff', border:'4px solid rgba(255,255,255,0.3)' }}>
              {initials(ath.name)}
            </div>
          )}
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:6 }}>Athlete Profile</div>
            <h1 style={{ fontSize:'clamp(22px,4vw,36px)', fontWeight:800, color:'#fff', marginBottom:10, letterSpacing:'-0.02em' }}>{ath.name}</h1>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              {ath.position && (
                <span style={{ fontSize:14, fontWeight:800, color:'#fff', background:'rgba(255,255,255,0.2)', padding:'3px 12px', borderRadius:99, border:'1px solid rgba(255,255,255,0.3)' }}>
                  {ath.position}
                </span>
              )}
              {posCategory && (
                <span style={{ fontSize:12, color:'rgba(255,255,255,0.7)' }}>{posCategory}</span>
              )}
              {ath.club && (
                <><span style={{ color:'rgba(255,255,255,0.4)' }}>·</span>
                <span style={{ fontSize:13, color:'rgba(255,255,255,0.8)' }}>{ath.club}</span></>
              )}
              {ath.strong_foot && (
                <span style={{ fontSize:12, color:'rgba(255,255,255,0.75)', background:'rgba(255,255,255,0.12)', padding:'2px 10px', borderRadius:99 }}>
                  {ath.strong_foot === 'left' ? '🦶 Left' : ath.strong_foot === 'right' ? '🦶 Right' : '🦶 Both'}
                </span>
              )}
              <Badge status={ath.status}/>
            </div>
          </div>
        </div>

        <div className="ath-detail-grid">

          {/* Profile details */}
          <div className="card fade-up fade-up-1" style={{ padding:24 }}>
            <h2 style={{ fontSize:16, fontWeight:700, marginBottom:18, paddingBottom:12, borderBottom:'1px solid var(--border)' }}>Profile Details</h2>
            <dl>
              {fields.map(([label, value]) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border)', fontSize:14, gap:12 }}>
                  <dt style={{ color:'var(--text3)', fontWeight:500, fontSize:13, flexShrink:0 }}>{label}</dt>
                  <dd style={{ fontWeight:600, color:'var(--text)', textAlign:'right' }}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Injury history */}
          <div className="card fade-up fade-up-2" style={{ padding:24 }}>
            <h2 style={{ fontSize:16, fontWeight:700, marginBottom:18, paddingBottom:12, borderBottom:'1px solid var(--border)' }}>Injury History</h2>
            {injuries.length===0 ? (
              <p style={{ color:'var(--text3)', fontSize:13, fontStyle:'italic' }}>No injury records on file.</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {injuries.map(inj => (
                  <div key={inj.id} style={{ background:inj.status==='Active'?'var(--danger-light)':'var(--surface2)', border:`1px solid ${inj.status==='Active'?'rgba(231,76,60,0.2)':'var(--border)'}`, borderLeft:`4px solid ${inj.status==='Active'?'var(--danger)':'var(--success)'}`, borderRadius:'0 var(--r-md) var(--r-md) 0', padding:'14px 18px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8, gap:10 }}>
                      <span style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{inj.injury_type}</span>
                      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                        <Badge status={inj.severity}/>
                        <Badge status={inj.status}/>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:inj.notes?10:0 }}>
                      <div style={{ fontSize:12, color:'var(--text2)' }}>📅 Injured: {inj.date_of_injury}</div>
                      <div style={{ fontSize:12, color:'var(--text2)' }}>🏃 Return: {inj.expected_return||'TBD'}</div>
                    </div>
                    {inj.notes && <p style={{ fontSize:12, color:'var(--text2)', fontStyle:'italic', borderTop:'1px solid rgba(0,0,0,0.06)', paddingTop:8, margin:0 }}>{inj.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}