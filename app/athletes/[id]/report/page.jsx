'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const AV_COLORS = ['#4A90E2','#27AE60','#E67E22','#9B59B6']
function initials(n) { return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }

function AthletePhoto({ ath, size=80 }) {
  const [err, setErr] = useState(false)
  if (ath?.photo_url && !err) {
    return <img src={ath.photo_url} alt={ath?.name} onError={()=>setErr(true)} style={{ width:size,height:size,borderRadius:6,objectFit:'cover',border:'2px solid #CBD5E0',flexShrink:0 }}/>
  }
  return (
    <div style={{ width:size,height:size,borderRadius:6,flexShrink:0,background:AV_COLORS[0],display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.3,fontWeight:800,color:'#fff',border:'2px solid #CBD5E0' }}>
      {initials(ath?.name)}
    </div>
  )
}

const SEVERITY_STYLES = {
  Mild:     { color:'#276749' },
  Moderate: { color:'#744210' },
  Severe:   { color:'#742A2A' },
}

export default function AthleteReport() {
  const { id }  = useParams()
  const router  = useRouter()
  const [ath,      setAth]      = useState(null)
  const [injuries, setInjuries] = useState([])
  const [perf,     setPerf]     = useState([])
  const [contracts,setContracts]= useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data:a },{ data:i },{ data:p },{ data:c }] = await Promise.all([
        supabase.from('athletes').select('*,coaches(name)').eq('id',id).single(),
        supabase.from('injuries').select('*').eq('athlete_id',id).order('date_of_injury',{ ascending:false }),
        supabase.from('performance_stats').select('*').eq('athlete_id',id).order('match_date',{ ascending:false }),
        supabase.from('contracts').select('*').eq('athlete_id',id).order('created_at',{ ascending:false }),
      ])
      setAth(a); setInjuries(i||[]); setPerf(p||[]); setContracts(c||[])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Georgia,serif' }}>
      <div style={{ width:36,height:36,border:'3px solid #E2E8F0',borderTopColor:'#2B6CB0',borderRadius:'50%',animation:'spin 0.7s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!ath) return (
    <div style={{ padding:40, fontFamily:'Georgia,serif' }}>
      <p>Athlete not found.</p>
      <button onClick={()=>router.back()} style={{ marginTop:12, color:'#2B6CB0', background:'none', border:'none', cursor:'pointer', fontSize:14 }}>← Back</button>
    </div>
  )

  const totalGoals   = perf.reduce((s,p)=>s+(p.goals||0),0)
  const totalAssists = perf.reduce((s,p)=>s+(p.assists||0),0)
  const totalMatches = perf.length
  const avgRating    = totalMatches ? (perf.reduce((s,p)=>s+parseFloat(p.rating||0),0)/totalMatches).toFixed(1) : '—'
  const totalXG      = perf.reduce((s,p)=>s+parseFloat(p.xg||0),0).toFixed(2)
  const activeCont   = contracts.find(c=>c.status==='Active')
  const activeInj    = injuries.filter(i=>i.status==='Active')

  const today     = new Date().toLocaleDateString('en-GB',{ day:'numeric',month:'long',year:'numeric' })
  const reportNum = `ATH-${id?.slice(0,8).toUpperCase()}-${new Date().getFullYear()}`

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Times New Roman', Times, serif;
          background: #f0f0f0;
          color: #1A202C;
        }

        /* Print toolbar — hidden when printing */
        .print-toolbar {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 56px;
          background: #2B6CB0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          z-index: 1000;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }

        /* The A4 document */
        .a4-document {
          width: 210mm;
          margin: 76px auto 40px;
          background: #fff;
          box-shadow: 0 4px 32px rgba(0,0,0,0.18);
        }

        @media print {
          .print-toolbar { display: none !important; }
          body { background: white; }
          .a4-document {
            width: 100%;
            margin: 0;
            box-shadow: none;
          }
          @page {
            size: A4 portrait;
            margin: 14mm 16mm;
          }
        }

        /* Page sections */
        .doc-header {
          background: #1A365D;
          color: #fff;
          padding: 24px 28px 20px;
        }

        .doc-body {
          padding: 22px 28px;
        }

        /* Typography */
        .section-title {
          font-size: 11px;
          font-weight: bold;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #1A365D;
          border-bottom: 2px solid #1A365D;
          padding-bottom: 4px;
          margin-bottom: 12px;
          margin-top: 22px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }

        th {
          background: #EBF4FF;
          color: #1A365D;
          font-size: 9px;
          font-weight: bold;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 6px 8px;
          text-align: left;
          border: 1px solid #CBD5E0;
        }

        td {
          padding: 6px 8px;
          border: 1px solid #E2E8F0;
          vertical-align: top;
          font-size: 11px;
          color: #2D3748;
        }

        tr:nth-child(even) td { background: #F7FAFC; }

        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 3px;
          font-size: 9px;
          font-weight: bold;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .stat-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
          margin-bottom: 8px;
        }

        .stat-box {
          border: 1px solid #CBD5E0;
          border-top: 3px solid #2B6CB0;
          padding: 8px 6px;
          text-align: center;
        }

        .stat-value {
          font-size: 20px;
          font-weight: bold;
          color: #1A365D;
          line-height: 1;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 8px;
          font-weight: bold;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #718096;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
          border: 1px solid #CBD5E0;
        }

        .info-cell {
          padding: 8px 10px;
          border-right: 1px solid #CBD5E0;
          border-bottom: 1px solid #CBD5E0;
        }

        .info-label {
          font-size: 8px;
          font-weight: bold;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #718096;
          margin-bottom: 3px;
        }

        .info-value {
          font-size: 11px;
          font-weight: bold;
          color: #1A365D;
        }

        .watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-35deg);
          font-size: 80px;
          font-weight: 900;
          color: rgba(0,0,0,0.04);
          white-space: nowrap;
          pointer-events: none;
          z-index: 0;
          letter-spacing: 0.15em;
        }

        .page-footer {
          border-top: 2px solid #1A365D;
          padding: 10px 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 9px;
          color: #718096;
          letter-spacing: 0.04em;
          margin-top: 10px;
        }

        .contract-box {
          border: 1px solid #CBD5E0;
          padding: 12px 14px;
          margin-bottom: 8px;
          background: #F7FAFC;
        }

        .alert-row {
          background: #FFF5F5;
          border-left: 3px solid #E53E3E;
          padding: 6px 10px;
          margin-bottom: 4px;
          font-size: 11px;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Toolbar */}
      <div className="print-toolbar">
        <div style={{ display:'flex',alignItems:'center',gap:14 }}>
          <button onClick={()=>router.back()} style={{ background:'rgba(255,255,255,0.15)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',padding:'7px 14px',borderRadius:6,fontSize:13,cursor:'pointer',fontFamily:'sans-serif' }}>
            ← Back
          </button>
          <span style={{ color:'rgba(255,255,255,0.7)',fontSize:13,fontFamily:'sans-serif' }}>
            Athlete Report · {ath.name}
          </span>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <span style={{ color:'rgba(255,255,255,0.6)',fontSize:12,fontFamily:'sans-serif' }}>
            {reportNum}
          </span>
          <button onClick={()=>window.print()} style={{ background:'#fff',color:'#2B6CB0',border:'none',padding:'9px 22px',borderRadius:6,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'sans-serif',boxShadow:'0 2px 8px rgba(0,0,0,0.15)' }}>
            🖨 Print / Save PDF
          </button>
        </div>
      </div>

      {/* A4 Document */}
      <div className="a4-document">

        {/* ── Document Header ── */}
        <div className="doc-header">
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18 }}>
            <div>
              <div style={{ fontSize:10,letterSpacing:'0.2em',color:'rgba(255,255,255,0.5)',textTransform:'uppercase',marginBottom:4 }}>AthleteHub — Ghana Football Operating System</div>
              <div style={{ fontSize:22,fontWeight:900,letterSpacing:'0.02em',marginBottom:2 }}>ATHLETE PERFORMANCE REPORT</div>
              <div style={{ fontSize:11,color:'rgba(255,255,255,0.6)',letterSpacing:'0.06em' }}>CONFIDENTIAL · FOR OFFICIAL USE ONLY</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:9,color:'rgba(255,255,255,0.45)',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:4 }}>Report No.</div>
              <div style={{ fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.9)',letterSpacing:'0.06em',fontFamily:'monospace' }}>{reportNum}</div>
              <div style={{ fontSize:9,color:'rgba(255,255,255,0.45)',letterSpacing:'0.06em',marginTop:8,textTransform:'uppercase' }}>Date Issued</div>
              <div style={{ fontSize:12,color:'rgba(255,255,255,0.8)',marginTop:2 }}>{today}</div>
            </div>
          </div>

          {/* Athlete identity row */}
          <div style={{ display:'flex',alignItems:'center',gap:18,background:'rgba(255,255,255,0.1)',borderRadius:6,padding:'14px 18px',border:'1px solid rgba(255,255,255,0.15)' }}>
            <AthletePhoto ath={ath} size={72}/>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:20,fontWeight:900,letterSpacing:'-0.01em',marginBottom:5 }}>{ath.name}</div>
              <div style={{ display:'flex',gap:16,flexWrap:'wrap' }}>
                {[
                  ['Position',  ath.position || '—'],
                  ['Club',      ath.club      || '—'],
                  ['Region',    ath.region    || '—'],
                  ['Status',    ath.status    || '—'],
                ].map(([label,value]) => (
                  <div key={label}>
                    <div style={{ fontSize:8,color:'rgba(255,255,255,0.45)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:2 }}>{label}</div>
                    <div style={{ fontSize:12,fontWeight:700,color:label==='Status'&&value==='Injured'?'#FC8181':label==='Status'&&value==='Active'?'#68D391':'rgba(255,255,255,0.9)' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
            {activeCont && (
              <div style={{ textAlign:'right',borderLeft:'1px solid rgba(255,255,255,0.15)',paddingLeft:18 }}>
                <div style={{ fontSize:8,color:'rgba(255,255,255,0.45)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:4 }}>Contract Status</div>
                <div style={{ fontSize:11,fontWeight:700,color:'#68D391' }}>● Active</div>
                <div style={{ fontSize:10,color:'rgba(255,255,255,0.6)',marginTop:3 }}>{activeCont.contract_start} →</div>
                <div style={{ fontSize:10,color:'rgba(255,255,255,0.6)' }}>{activeCont.contract_end}</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Document Body ── */}
        <div className="doc-body">

          {/* Active injury alert */}
          {activeInj.length > 0 && (
            <div style={{ background:'#FFF5F5',border:'1px solid #FC8181',borderLeft:'4px solid #E53E3E',borderRadius:4,padding:'10px 14px',marginBottom:16,display:'flex',alignItems:'center',gap:10 }}>
              <span style={{ fontSize:16 }}>⚠</span>
              <div>
                <div style={{ fontSize:11,fontWeight:700,color:'#C53030' }}>ACTIVE INJURY ALERT</div>
                <div style={{ fontSize:11,color:'#742A2A' }}>
                  {activeInj.map(i=>i.injury_type).join(', ')} — Return: {activeInj[0]?.expected_return||'TBD'}
                </div>
              </div>
            </div>
          )}

          {/* ── Career Stats ── */}
          <div className="section-title">Career Performance Statistics</div>
          <div className="stat-grid">
            {[
              { label:'Matches',    value:totalMatches,                              accent:'#2B6CB0' },
              { label:'Goals',      value:totalGoals,                                accent:'#276749' },
              { label:'Assists',    value:totalAssists,                              accent:'#553C9A' },
              { label:'Avg Rating', value:avgRating,                                 accent:'#C05621' },
              { label:'Total xG',   value:totalXG,                                   accent:'#C53030' },
              { label:'Dist (km)',  value:perf.reduce((s,p)=>s+parseFloat(p.distance_km||0),0).toFixed(0), accent:'#2C7A7B' },
            ].map(s => (
              <div key={s.label} className="stat-box" style={{ borderTopColor:s.accent }}>
                <div className="stat-value" style={{ color:s.accent }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Personal Details ── */}
          <div className="section-title">Personal Information</div>
          <div className="info-grid">
            {[
              ['Full Name',      ath.name          || '—'],
              ['Date of Birth',  ath.dob           || '—'],
              ['Age',            ath.age ? `${ath.age} years` : '—'],
              ['Nationality',    ath.nationality   || '—'],
              ['Height',         ath.height ? `${ath.height} cm` : '—'],
              ['Weight',         ath.weight ? `${ath.weight} kg` : '—'],
              ['Preferred Foot', ath.preferred_foot|| '—'],
              ['Phone',          ath.phone         || '—'],
              ['Position',       ath.position      || '—'],
              ['Club',           ath.club          || '—'],
              ['Region',         ath.region        || '—'],
              ['Coach',          ath.coaches?.name || '—'],
            ].map(([label,value]) => (
              <div key={label} className="info-cell">
                <div className="info-label">{label}</div>
                <div className="info-value">{value}</div>
              </div>
            ))}
          </div>

          {/* ── Contract ── */}
          <div className="section-title">Contract Information</div>
          {contracts.length === 0 ? (
            <p style={{ fontSize:11,color:'#718096',fontStyle:'italic',padding:'8px 0' }}>No contract records on file.</p>
          ) : contracts.map(c => (
            <div key={c.id} className="contract-box">
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
                <div style={{ fontSize:13,fontWeight:700,color:'#1A365D' }}>
                  {c.contract_start||'—'} → {c.contract_end||'—'}
                </div>
                <span className="badge" style={{ background:c.status==='Active'?'#C6F6D5':'#FED7D7',color:c.status==='Active'?'#276749':'#742A2A' }}>
                  {c.status}
                </span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Weekly Wage</th>
                    <th>Signing Fee</th>
                    <th>Release Clause</th>
                    <th>Goal Bonus</th>
                    <th>App Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight:700,color:'#276749' }}>GHS {parseFloat(c.weekly_wage||0).toLocaleString()}</td>
                    <td>GHS {parseFloat(c.signing_fee||0).toLocaleString()}</td>
                    <td>{c.release_clause?`GHS ${parseFloat(c.release_clause).toLocaleString()}`:'—'}</td>
                    <td>GHS {parseFloat(c.bonus_goals||0).toLocaleString()}</td>
                    <td>GHS {parseFloat(c.bonus_appearances||0).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
              {c.notes && <div style={{ fontSize:10,color:'#718096',marginTop:6,fontStyle:'italic' }}>Note: {c.notes}</div>}
            </div>
          ))}

          {/* ── Medical History ── */}
          <div className="section-title">
            Medical History
            {activeInj.length > 0 && <span style={{ marginLeft:8,fontSize:9,background:'#FED7D7',color:'#C53030',padding:'2px 8px',borderRadius:3,fontWeight:700 }}>{activeInj.length} ACTIVE</span>}
          </div>
          {injuries.length === 0 ? (
            <p style={{ fontSize:11,color:'#48BB78',fontStyle:'italic',padding:'8px 0' }}>✓ No injury records on file. Clean medical history.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Injury Type</th>
                  <th>Severity</th>
                  <th>Date of Injury</th>
                  <th>Expected Return</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {injuries.map(inj => {
                  const ss = SEVERITY_STYLES[inj.severity] || { color:'#276749' }
                  const isAct = inj.status==='Active'
                  return (
                    <tr key={inj.id} style={{ background:isAct?'#FFF5F5':'inherit' }}>
                      <td style={{ fontWeight:600 }}>{inj.injury_type}</td>
                      <td><span className="badge" style={{ background:isAct?'#FED7D7':inj.severity==='Moderate'?'#FEFCBF':'#C6F6D5', color:ss.color }}>{inj.severity}</span></td>
                      <td>{inj.date_of_injury||'—'}</td>
                      <td>{inj.expected_return||'TBD'}</td>
                      <td><span className="badge" style={{ background:isAct?'#FED7D7':'#C6F6D5', color:isAct?'#742A2A':'#276749' }}>{inj.status}</span></td>
                      <td style={{ color:'#718096',fontStyle:'italic' }}>{inj.notes||'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* ── Performance History ── */}
          <div className="section-title">Match Performance History ({totalMatches} matches)</div>
          {perf.length === 0 ? (
            <p style={{ fontSize:11,color:'#718096',fontStyle:'italic',padding:'8px 0' }}>No performance records logged yet.</p>
          ) : (
            <>
              {/* Summary row */}
              <div style={{ background:'#EBF4FF',border:'1px solid #BEE3F8',padding:'10px 14px',marginBottom:10,display:'flex',gap:24,fontSize:11 }}>
                <span><strong>Total Goals:</strong> {totalGoals}</span>
                <span><strong>Total Assists:</strong> {totalAssists}</span>
                <span><strong>Avg Rating:</strong> {avgRating}/10</span>
                <span><strong>Total xG:</strong> {totalXG}</span>
                <span><strong>Total xA:</strong> {perf.reduce((s,p)=>s+parseFloat(p.xa||0),0).toFixed(2)}</span>
                <span><strong>Matches:</strong> {totalMatches}</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Opponent</th>
                    <th>Min</th>
                    <th>G</th>
                    <th>A</th>
                    <th>xG</th>
                    <th>xA</th>
                    <th>Shots</th>
                    <th>Pass%</th>
                    <th>Dist</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {perf.slice(0,25).map(p => (
                    <tr key={p.id}>
                      <td>{p.match_date||'—'}</td>
                      <td style={{ fontWeight:500 }}>{p.opponent||'—'}</td>
                      <td>{p.minutes_played||0}'</td>
                      <td style={{ fontWeight:700,color:'#276749' }}>{p.goals||0}</td>
                      <td style={{ fontWeight:700,color:'#553C9A' }}>{p.assists||0}</td>
                      <td>{parseFloat(p.xg||0).toFixed(2)}</td>
                      <td>{parseFloat(p.xa||0).toFixed(2)}</td>
                      <td>{p.shots||0}</td>
                      <td>{p.pass_accuracy||0}%</td>
                      <td>{p.distance_km||0}km</td>
                      <td style={{ fontWeight:700, color:parseFloat(p.rating||0)>=7?'#276749':parseFloat(p.rating||0)>=5?'#744210':'#742A2A' }}>{p.rating||0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {perf.length > 25 && (
                <p style={{ fontSize:10,color:'#718096',marginTop:6,fontStyle:'italic',textAlign:'center' }}>
                  Showing most recent 25 of {perf.length} records.
                </p>
              )}
            </>
          )}

          {/* ── Signature block ── */}
          <div style={{ marginTop:28,paddingTop:16,borderTop:'1px solid #CBD5E0',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:24 }}>
            {['Prepared By','Reviewed By','Authorised By'].map(label => (
              <div key={label}>
                <div style={{ borderBottom:'1px solid #2D3748',marginBottom:4,height:32 }}/>
                <div style={{ fontSize:9,color:'#718096',letterSpacing:'0.08em',textTransform:'uppercase' }}>{label}</div>
                <div style={{ fontSize:9,color:'#A0AEC0',marginTop:2 }}>Name / Date</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Document Footer ── */}
        <div className="page-footer">
          <span>AthleteHub FOS · Ghana Football Operating System</span>
          <span>Report Ref: {reportNum}</span>
          <span>Generated: {today} · CONFIDENTIAL</span>
        </div>

      </div>
    </>
  )
}