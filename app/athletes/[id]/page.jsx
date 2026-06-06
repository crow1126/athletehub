'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getTenantProfile, scopeTeam } from '@/lib/tenant'
import { useParams, useRouter } from 'next/navigation'

const AV_COLORS = ['#1A365D','#2B6CB0','#1B7A3E','#553C9A']
function initials(n) { return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }

function AthletePhoto({ ath, size=80 }) {
  const [err, setErr] = useState(false)
  if (ath?.photo_url && !err) {
    return (
      <img
        src={ath.photo_url}
        alt={ath?.name || ''}
        onError={() => setErr(true)}
        style={{
          width: size, height: size,
          borderRadius: 6,
          objectFit: 'cover',
          border: '3px solid rgba(255,255,255,0.4)',
          flexShrink: 0,
          background: '#1A365D',
        }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 6, flexShrink: 0,
      background: 'rgba(255,255,255,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.3, fontWeight: 800, color: '#fff',
      border: '3px solid rgba(255,255,255,0.3)',
      letterSpacing: '0.05em',
    }}>
      {initials(ath?.name)}
    </div>
  )
}

const TRANSFER_TYPE_LABELS = {
  sold: 'Sold', bought: 'Bought', free_agent: 'Free Agent',
  loan_out: 'Loan Out', loan_in: 'Loan In', return_from_loan: 'Return from Loan',
}
const TRANSFER_TYPE_COLORS = {
  sold:            { bg:'#FED7D7', color:'#742A2A' },
  bought:          { bg:'#C6F6D5', color:'#276749' },
  free_agent:      { bg:'#FEFCBF', color:'#744210' },
  loan_out:        { bg:'#BEE3F8', color:'#1A365D' },
  loan_in:         { bg:'#E9D8FD', color:'#44337A' },
  return_from_loan:{ bg:'#B2F5EA', color:'#234E52' },
}

const SEVERITY_COLORS = {
  Mild:     { bg:'#C6F6D5', color:'#276749' },
  Moderate: { bg:'#FEFCBF', color:'#744210' },
  Severe:   { bg:'#FED7D7', color:'#742A2A' },
}

export default function AthleteReport() {
  const { id }  = useParams()
  const router  = useRouter()
  const [ath,       setAth]       = useState(null)
  const [injuries,  setInjuries]  = useState([])
  const [perf,      setPerf]      = useState([])
  const [contracts, setContracts] = useState([])
  const [transfers, setTransfers] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const { teamId } = await getTenantProfile()
      const [{ data:a },{ data:i },{ data:p },{ data:c },{ data:tr }] = await Promise.all([
        scopeTeam(supabase.from('athletes').select('*,coaches(name)').eq('id',id), teamId).single(),
        scopeTeam(supabase.from('injuries').select('*').eq('athlete_id',id), teamId).order('date_of_injury',{ ascending:false }),
        scopeTeam(supabase.from('performance_stats').select('*').eq('athlete_id',id), teamId).order('match_date',{ ascending:false }),
        scopeTeam(supabase.from('contracts').select('*').eq('athlete_id',id), teamId).order('created_at',{ ascending:false }),
        scopeTeam(supabase.from('transfers').select('*').eq('athlete_id',id), teamId).order('transfer_date',{ ascending:false }),
      ])
      setAth(a)
      setInjuries(i||[])
      setPerf(p||[])
      setContracts(c||[])
      setTransfers(tr||[])
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!loading && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('print') === 'true') {
        const timer = setTimeout(() => {
          window.print()
        }, 1000)
        return () => clearTimeout(timer)
      }
    }
  }, [loading])

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#f0f0f0' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:40,height:40,border:'3px solid #E2E8F0',borderTopColor:'#2B6CB0',borderRadius:'50%',animation:'spin 0.7s linear infinite',margin:'0 auto 12px' }}/>
        <p style={{ fontFamily:'sans-serif',fontSize:13,color:'#718096' }}>Loading athlete report…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!ath) return (
    <div style={{ padding:40, fontFamily:'sans-serif' }}>
      <p>Athlete not found.</p>
      <button onClick={()=>router.back()} style={{ marginTop:12,color:'#2B6CB0',background:'none',border:'none',cursor:'pointer',fontSize:14 }}>← Back</button>
    </div>
  )

  // Derived stats
  const totalGoals   = perf.reduce((s,p)=>s+(p.goals||0),0)
  const totalAssists = perf.reduce((s,p)=>s+(p.assists||0),0)
  const totalMatches = perf.length
  const avgRating    = totalMatches ? (perf.reduce((s,p)=>s+parseFloat(p.rating||0),0)/totalMatches).toFixed(1) : '—'
  const totalXG      = perf.reduce((s,p)=>s+parseFloat(p.xg||0),0).toFixed(2)
  const totalXA      = perf.reduce((s,p)=>s+parseFloat(p.xa||0),0).toFixed(2)
  const totalDist    = perf.reduce((s,p)=>s+parseFloat(p.distance_km||0),0).toFixed(0)
  const avgPass      = totalMatches ? (perf.reduce((s,p)=>s+parseFloat(p.pass_accuracy||0),0)/totalMatches).toFixed(0) : '—'

  const activeCont  = contracts.find(c=>c.status==='Active')
  const activeInj   = injuries.filter(i=>i.status==='Active')

  const today     = new Date().toLocaleDateString('en-GB',{ day:'numeric',month:'long',year:'numeric' })
  const reportNum = `ATH-${(id||'').slice(0,8).toUpperCase()}-${new Date().getFullYear()}`

  // Transfer fee totals
  const totalTransferFeeIn  = transfers.filter(t=>['bought','loan_in','return_from_loan'].includes(t.transfer_type)&&!t.is_free).reduce((s,t)=>s+(t.fee_ghs||0),0)
  const totalTransferFeeOut = transfers.filter(t=>['sold','loan_out'].includes(t.transfer_type)&&!t.is_free).reduce((s,t)=>s+(t.fee_ghs||0),0)

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Georgia', 'Times New Roman', serif;
          background: #dde3ec;
          color: #1A202C;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* ── Toolbar ── */
        .print-toolbar {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 54px;
          background: #1A365D;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          z-index: 9999;
          box-shadow: 0 2px 12px rgba(0,0,0,0.3);
        }

        /* ── A4 wrapper ── */
        .a4-document {
          width: 210mm;
          margin: 70px auto 48px;
          background: #fff;
          box-shadow: 0 6px 40px rgba(0,0,0,0.22);
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
            margin: 12mm 14mm 14mm;
          }
          .page-break { page-break-before: always; }
          .no-break    { page-break-inside: avoid; }
        }

        /* ══ COVER HEADER ══ */
        .doc-header {
          background: linear-gradient(160deg, #0D2340 0%, #1A365D 45%, #2B6CB0 100%);
          color: #fff;
          padding: 30px 32px 26px;
          position: relative;
          overflow: hidden;
        }
        .doc-header::after {
          content: '';
          position: absolute;
          right: -60px; bottom: -60px;
          width: 220px; height: 220px;
          border-radius: 50%;
          background: rgba(255,255,255,0.04);
        }

        /* ══ BODY ══ */
        .doc-body {
          padding: 24px 32px 28px;
        }

        /* ══ SECTION TITLES ══ */
        .section-title {
          font-family: 'Arial', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #fff;
          background: #1A365D;
          padding: 6px 14px;
          margin-bottom: 10px;
          margin-top: 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .section-title:first-child { margin-top: 0; }
        .section-badge {
          font-size: 9px;
          font-weight: 700;
          padding: 2px 10px;
          border-radius: 2px;
          background: rgba(255,255,255,0.2);
          letter-spacing: 0.06em;
        }

        /* ══ TABLES ══ */
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10.5px;
          font-family: 'Arial', sans-serif;
        }
        th {
          background: #EBF4FF;
          color: #1A365D;
          font-size: 8.5px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 6px 9px;
          text-align: left;
          border: 1px solid #CBD5E0;
        }
        td {
          padding: 6px 9px;
          border: 1px solid #E2E8F0;
          vertical-align: middle;
          font-size: 10.5px;
          color: #2D3748;
        }
        tr:nth-child(even) td { background: #F7FAFC; }
        tr:last-child td { border-bottom: 2px solid #CBD5E0; }

        /* ══ STAT BOXES ══ */
        .stat-row {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
          margin-bottom: 10px;
        }
        .stat-box {
          border: 1px solid #CBD5E0;
          border-top: 3px solid #2B6CB0;
          padding: 10px 8px 8px;
          text-align: center;
          background: #fff;
        }
        .stat-value {
          font-family: 'Arial', sans-serif;
          font-size: 22px;
          font-weight: 900;
          color: #1A365D;
          line-height: 1;
          margin-bottom: 5px;
        }
        .stat-label {
          font-family: 'Arial', sans-serif;
          font-size: 7.5px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #718096;
        }

        /* ══ INFO GRID ══ */
        .info-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border: 1px solid #CBD5E0;
          border-right: none;
          border-bottom: none;
        }
        .info-cell {
          padding: 9px 12px;
          border-right: 1px solid #CBD5E0;
          border-bottom: 1px solid #CBD5E0;
        }
        .info-label {
          font-family: 'Arial', sans-serif;
          font-size: 7.5px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #718096;
          margin-bottom: 3px;
        }
        .info-value {
          font-family: 'Arial', sans-serif;
          font-size: 11px;
          font-weight: 700;
          color: #1A365D;
        }

        /* ══ BADGE ══ */
        .badge {
          display: inline-block;
          padding: 2px 9px;
          border-radius: 2px;
          font-family: 'Arial', sans-serif;
          font-size: 8.5px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        /* ══ ALERT ══ */
        .alert-banner {
          background: #FFF5F5;
          border: 1px solid #FC8181;
          border-left: 5px solid #E53E3E;
          padding: 10px 16px;
          margin-bottom: 18px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          font-family: 'Arial', sans-serif;
        }

        /* ══ CONTRACT BOX ══ */
        .contract-card {
          border: 1px solid #CBD5E0;
          border-top: 3px solid #1B7A3E;
          padding: 12px 16px 10px;
          margin-bottom: 8px;
          background: #F7FAFC;
        }

        /* ══ PERF SUMMARY ══ */
        .perf-summary {
          background: #EBF4FF;
          border: 1px solid #BEE3F8;
          border-left: 4px solid #2B6CB0;
          padding: 10px 16px;
          margin-bottom: 10px;
          display: flex;
          gap: 22px;
          flex-wrap: wrap;
          font-family: 'Arial', sans-serif;
          font-size: 10.5px;
        }

        /* ══ FOOTER ══ */
        .doc-footer {
          border-top: 2px solid #1A365D;
          padding: 10px 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: 'Arial', sans-serif;
          font-size: 8.5px;
          color: #718096;
          letter-spacing: 0.04em;
          margin-top: 12px;
          background: #F7FAFC;
        }

        /* ══ SIG BLOCK ══ */
        .sig-block {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 24px;
          margin-top: 28px;
          padding-top: 16px;
          border-top: 1px dashed #CBD5E0;
        }
        .sig-line {
          border-bottom: 1px solid #2D3748;
          height: 34px;
          margin-bottom: 5px;
        }
        .sig-label {
          font-family: 'Arial', sans-serif;
          font-size: 8px;
          color: #718096;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Toolbar ── */}
      <div className="print-toolbar">
        <div style={{ display:'flex',alignItems:'center',gap:14 }}>
          <button onClick={()=>router.back()} style={{ background:'rgba(255,255,255,0.12)',color:'#fff',border:'1px solid rgba(255,255,255,0.25)',padding:'7px 14px',borderRadius:5,fontSize:12,cursor:'pointer',fontFamily:'sans-serif' }}>
            ← Back
          </button>
          <span style={{ color:'rgba(255,255,255,0.65)',fontSize:12,fontFamily:'sans-serif' }}>
            Athlete Report · <strong style={{ color:'#fff' }}>{ath.name}</strong>
          </span>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <span style={{ color:'rgba(255,255,255,0.5)',fontSize:11,fontFamily:'monospace' }}>{reportNum}</span>
          <button onClick={()=>window.print()} style={{ background:'#fff',color:'#1A365D',border:'none',padding:'9px 24px',borderRadius:5,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'sans-serif',boxShadow:'0 2px 10px rgba(0,0,0,0.2)' }}>
            🖨 Print / Save PDF
          </button>
        </div>
      </div>

      {/* ── A4 Document ── */}
      <div className="a4-document">

        {/* ══════════ COVER HEADER ══════════ */}
        <div className="doc-header">
          {/* Org + Report title */}
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20 }}>
            <div>
              <div style={{ fontFamily:'Arial',fontSize:9,letterSpacing:'0.22em',color:'rgba(255,255,255,0.45)',textTransform:'uppercase',marginBottom:4 }}>
                Apex Track · Football Performance Platform
              </div>
              <div style={{ fontFamily:'Arial',fontSize:24,fontWeight:900,letterSpacing:'0.01em',lineHeight:1.1,marginBottom:3 }}>
                ATHLETE PERFORMANCE REPORT
              </div>
              <div style={{ fontFamily:'Arial',fontSize:10,color:'rgba(255,255,255,0.5)',letterSpacing:'0.1em',textTransform:'uppercase' }}>
                Confidential · For Official Use Only
              </div>
            </div>
            <div style={{ textAlign:'right',flexShrink:0 }}>
              <div style={{ fontFamily:'Arial',fontSize:8,color:'rgba(255,255,255,0.4)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:3 }}>Report Reference</div>
              <div style={{ fontFamily:'monospace',fontSize:13,fontWeight:700,color:'#fff',letterSpacing:'0.08em',marginBottom:10 }}>{reportNum}</div>
              <div style={{ fontFamily:'Arial',fontSize:8,color:'rgba(255,255,255,0.4)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:3 }}>Date Issued</div>
              <div style={{ fontFamily:'Arial',fontSize:11,color:'rgba(255,255,255,0.85)' }}>{today}</div>
            </div>
          </div>

          {/* Athlete identity card */}
          <div style={{ display:'flex',alignItems:'center',gap:20,background:'rgba(255,255,255,0.08)',borderRadius:5,padding:'16px 20px',border:'1px solid rgba(255,255,255,0.14)' }}>
            <AthletePhoto ath={ath} size={76}/>

            <div style={{ flex:1 }}>
              <div style={{ fontFamily:'Arial',fontSize:21,fontWeight:900,letterSpacing:'-0.01em',marginBottom:7,lineHeight:1 }}>{ath.name}</div>
              <div style={{ display:'flex',gap:16,flexWrap:'wrap',alignItems:'center' }}>
                {[
                  ['Position',  ath.position || '—'],
                  ['Club',      ath.club      || '—'],
                  ['Region',    ath.region    || '—'],
                  ['Status',    ath.status    || '—'],
                  ['Nationality',ath.nationality||'—'],
                ].map(([label,value]) => (
                  <div key={label}>
                    <div style={{ fontFamily:'Arial',fontSize:7.5,color:'rgba(255,255,255,0.4)',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:2 }}>{label}</div>
                    <div style={{ fontFamily:'Arial',fontSize:11.5,fontWeight:700,color:
                      label==='Status'&&value==='Injured'?'#FC8181':
                      label==='Status'&&value==='Active'?'#68D391':
                      'rgba(255,255,255,0.92)'
                    }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right panel: contract + transfer summary */}
            <div style={{ borderLeft:'1px solid rgba(255,255,255,0.15)',paddingLeft:20,flexShrink:0,minWidth:130 }}>
              {activeCont ? (
                <>
                  <div style={{ fontFamily:'Arial',fontSize:7.5,color:'rgba(255,255,255,0.4)',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:3 }}>Contract Status</div>
                  <div style={{ fontFamily:'Arial',fontSize:11,fontWeight:700,color:'#68D391',marginBottom:4 }}>● Active Contract</div>
                  <div style={{ fontFamily:'Arial',fontSize:9.5,color:'rgba(255,255,255,0.6)',marginBottom:1 }}>{activeCont.contract_start}</div>
                  <div style={{ fontFamily:'Arial',fontSize:9.5,color:'rgba(255,255,255,0.6)' }}>↳ {activeCont.contract_end}</div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily:'Arial',fontSize:7.5,color:'rgba(255,255,255,0.4)',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:3 }}>Contract Status</div>
                  <div style={{ fontFamily:'Arial',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.45)' }}>No Active Contract</div>
                </>
              )}
              {transfers.length > 0 && (
                <div style={{ marginTop:10 }}>
                  <div style={{ fontFamily:'Arial',fontSize:7.5,color:'rgba(255,255,255,0.4)',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:3 }}>Transfer Record</div>
                  <div style={{ fontFamily:'Arial',fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.85)' }}>{transfers.length} movement{transfers.length!==1?'s':''}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══════════ DOCUMENT BODY ══════════ */}
        <div className="doc-body">

          {/* Active injury alert */}
          {activeInj.length > 0 && (
            <div className="alert-banner">
              <span style={{ fontSize:18,lineHeight:1 }}>⚠</span>
              <div>
                <div style={{ fontSize:11,fontWeight:700,color:'#C53030',marginBottom:2 }}>ACTIVE INJURY ALERT</div>
                <div style={{ fontSize:10.5,color:'#742A2A' }}>
                  {activeInj.map(i=>i.injury_type).join(', ')} · Expected Return: {activeInj[0]?.expected_return||'TBD'}
                </div>
              </div>
            </div>
          )}

          {/* ── CAREER PERFORMANCE STATISTICS ── */}
          <div className="section-title no-break">
            Career Performance Statistics
            <span className="section-badge">{totalMatches} Matches</span>
          </div>
          <div className="stat-row">
            {[
              { label:'Matches Played', value:totalMatches,  accent:'#2B6CB0' },
              { label:'Goals',          value:totalGoals,    accent:'#276749' },
              { label:'Assists',        value:totalAssists,  accent:'#553C9A' },
              { label:'Avg Rating',     value:avgRating,     accent:'#C05621' },
              { label:'Total xG',       value:totalXG,       accent:'#C53030' },
              { label:'Dist (km)',      value:totalDist,     accent:'#2C7A7B' },
            ].map(s => (
              <div key={s.label} className="stat-box" style={{ borderTopColor:s.accent }}>
                <div className="stat-value" style={{ color:s.accent }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:4 }}>
            {[
              { label:'Total xA',        value:totalXA,             accent:'#6B46C1' },
              { label:'Avg Pass %',      value:avgPass==='—'?'—':`${avgPass}%`, accent:'#1B7A3E' },
              { label:'Total Shots',     value:perf.reduce((s,p)=>s+(p.shots||0),0), accent:'#C05621' },
              { label:'Career Minutes',  value:perf.reduce((s,p)=>s+(p.minutes_played||0),0)+"'", accent:'#2D6B6B' },
            ].map(s => (
              <div key={s.label} className="stat-box" style={{ borderTopColor:s.accent }}>
                <div className="stat-value" style={{ fontSize:17,color:s.accent }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── PERSONAL INFORMATION ── */}
          <div className="no-break">
            <div className="section-title">Personal Information</div>
            <div className="info-grid">
              {[
                ['Full Name',       ath.name            || '—'],
                ['First Name',      ath.first_name      || '—'],
                ['Last Name',       ath.last_name       || '—'],
                ['Membership No.',  ath.membership_number|| '—'],
                ['Date of Birth',   ath.date_of_birth   || '—'],
                ['Age',             ath.age ? `${ath.age} years` : '—'],
                ['Place of Birth',  ath.place_of_birth  || '—'],
                ['Nationality',     ath.nationality     || '—'],
                ['Country',         ath.country         || '—'],
                ['Address',         ath.address         || '—'],
                ['Height',          ath.height ? `${ath.height} cm` : '—'],
                ['Weight',          ath.weight ? `${ath.weight} kg` : '—'],
                ['Preferred Foot',  { right: 'Right Foot (RF)', left: 'Left Foot (LF)', both: 'Both Feet' }[ath.strong_foot] || ath.strong_foot || ath.preferred_foot || '—'],
                ['Position',        ath.position        || '—'],
                ['Current Club',    ath.club || ath.current_club || '—'],
                ['Region',          ath.region          || '—'],
                ['Assigned Coach',  ath.coaches?.name   || '—'],
              ].map(([label,value]) => (
                <div key={label} className="info-cell">
                  <div className="info-label">{label}</div>
                  <div className="info-value">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── CONTACT INFORMATION ── */}
          <div className="no-break" style={{ marginTop: 22 }}>
            <div className="section-title">Contact Details</div>
            <div className="info-grid">
              {[
                ['E-mail',        ath.email           || '—'],
                ['Mobile Phone',  ath.phone           || '—'],
                ['Landline',      ath.landline        || '—'],
                ['Homepage',      ath.homepage        || '—'],
                ['Facebook',      ath.facebook        || '—'],
                ['Instagram',     ath.instagram       || '—'],
                ['Snapchat',      ath.snapchat        || '—'],
              ].map(([label,value]) => (
                <div key={label} className="info-cell">
                  <div className="info-label">{label}</div>
                  <div className="info-value">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── SPORTS DATA & ELIGIBILITY ── */}
          <div className="no-break" style={{ marginTop: 22 }}>
            <div className="section-title">Sports Data & Eligibility</div>
            <div className="info-grid">
              {[
                ['Team Section',      ath.team_section      || '—'],
                ['Back Number',       ath.back_number       || '—'],
                ['Passport Number',   ath.passport_number   || '—'],
                ['Wrist Measurement', ath.wrist_measurement || '—'],
                ['Last Club',         ath.last_club         || '—'],
                ['In Club Since',     ath.in_club_since     || '—'],
                ['Contract Until',    ath.contract_until    || '—'],
                ['Contract Option',   ath.contract_option_until|| '—'],
              ].map(([label,value]) => (
                <div key={label} className="info-cell">
                  <div className="info-label">{label}</div>
                  <div className="info-value">{value}</div>
                </div>
              ))}
            </div>
            {ath.contract_details && (
              <div style={{ border:'1px solid #CBD5E0', borderTop:'none', padding:'9px 12px', background:'#F7FAFC', fontSize:'10px', fontFamily:'Arial', color:'#4A5568' }}>
                <strong>Eligibility / Contract Details:</strong> {ath.contract_details}
              </div>
            )}
          </div>

          {/* ── EQUIPMENT DETAILS ── */}
          <div className="no-break" style={{ marginTop: 22 }}>
            <div className="section-title">Equipment Details</div>
            <div className="info-grid">
              {[
                ['Clothing Size',     ath.clothing_size     || '—'],
                ['Shoe Size',         ath.shoe_size         || '—'],
                ['Number/Lettering',  ath.number_lettering  || '—'],
              ].map(([label,value]) => (
                <div key={label} className="info-cell">
                  <div className="info-label">{label}</div>
                  <div className="info-value">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── FINANCIAL & TAX DETAILS ── */}
          <div className="no-break" style={{ marginTop: 22 }}>
            <div className="section-title">Financial & Tax Details</div>
            <div className="info-grid">
              {[
                ['IBAN',              ath.iban              || '—'],
                ['BIC / RIC',         ath.bic               || '—'],
                ['Tax ID Number',     ath.tax_id            || '—'],
              ].map(([label,value]) => (
                <div key={label} className="info-cell">
                  <div className="info-label">{label}</div>
                  <div className="info-value">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── CONTRACT INFORMATION ── */}
          <div className="section-title no-break">
            Contract Information
            <span className="section-badge">{contracts.length} Contract{contracts.length!==1?'s':''}</span>
          </div>
          {contracts.length === 0 ? (
            <p style={{ fontFamily:'Arial',fontSize:11,color:'#718096',fontStyle:'italic',padding:'8px 0' }}>No contract records on file.</p>
          ) : contracts.map((c,ci) => (
            <div key={c.id} className="contract-card no-break">
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
                <div style={{ fontFamily:'Arial',fontSize:12.5,fontWeight:700,color:'#1A365D' }}>
                  {c.contract_start||'—'} → {c.contract_end||'—'}
                </div>
                <div style={{ display:'flex',gap:8,alignItems:'center' }}>
                  {ci===0&&c.status==='Active'&&(
                    <span style={{ fontFamily:'Arial',fontSize:9,fontWeight:700,color:'#276749' }}>● CURRENT</span>
                  )}
                  <span className="badge" style={{ background:c.status==='Active'?'#C6F6D5':'#E2E8F0',color:c.status==='Active'?'#276749':'#718096' }}>
                    {c.status}
                  </span>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Weekly Wage (GHS)</th>
                    <th>Signing Fee (GHS)</th>
                    <th>Release Clause</th>
                    <th>Goal Bonus</th>
                    <th>Appearance Bonus</th>
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
              {c.notes && <div style={{ fontFamily:'Arial',fontSize:9.5,color:'#718096',marginTop:6,fontStyle:'italic' }}>Note: {c.notes}</div>}
            </div>
          ))}

          {/* ── TRANSFER HISTORY ── */}
          <div className="section-title no-break" style={{ background:'#2D6B6B' }}>
            Transfer History
            <span className="section-badge">{transfers.length} Record{transfers.length!==1?'s':''}</span>
          </div>
          {transfers.length === 0 ? (
            <p style={{ fontFamily:'Arial',fontSize:11,color:'#718096',fontStyle:'italic',padding:'8px 0' }}>No transfer records on file.</p>
          ) : (
            <div className="no-break">
              {/* Transfer summary */}
              {(totalTransferFeeIn > 0 || totalTransferFeeOut > 0) && (
                <div style={{ display:'flex',gap:24,marginBottom:10,padding:'8px 14px',background:'#E6F0F0',border:'1px solid #B2D8D8',borderLeft:'4px solid #2D6B6B',fontFamily:'Arial',fontSize:10.5 }}>
                  {totalTransferFeeOut>0 && <span><strong>Fees Received:</strong> GHS {totalTransferFeeOut.toLocaleString()}</span>}
                  {totalTransferFeeIn>0  && <span><strong>Fees Paid:</strong> GHS {totalTransferFeeIn.toLocaleString()}</span>}
                  <span><strong>Total Movements:</strong> {transfers.length}</span>
                </div>
              )}
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>From Club</th>
                    <th>To Club</th>
                    <th>Fee (GHS)</th>
                    <th>Contract Period</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map(tr => {
                    const tc = TRANSFER_TYPE_COLORS[tr.transfer_type] || { bg:'#E2E8F0',color:'#4A5568' }
                    return (
                      <tr key={tr.id}>
                        <td style={{ whiteSpace:'nowrap',fontWeight:600 }}>
                          {tr.transfer_date ? new Date(tr.transfer_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—'}
                        </td>
                        <td>
                          <span className="badge" style={{ background:tc.bg,color:tc.color }}>
                            {TRANSFER_TYPE_LABELS[tr.transfer_type]||tr.transfer_type}
                          </span>
                        </td>
                        <td style={{ fontWeight:600 }}>{tr.from_club||'—'}</td>
                        <td style={{ fontWeight:600 }}>{tr.to_club||'—'}</td>
                        <td>
                          {tr.is_free
                            ? <span style={{ color:'#718096',fontStyle:'italic' }}>Free</span>
                            : tr.fee_ghs
                              ? <span style={{ fontWeight:700,color:'#276749' }}>GHS {Number(tr.fee_ghs).toLocaleString()}</span>
                              : <span style={{ color:'#718096',fontStyle:'italic' }}>Undisclosed</span>
                          }
                        </td>
                        <td style={{ fontSize:9.5,color:'#4A5568' }}>
                          {tr.contract_start||tr.contract_end
                            ? `${tr.contract_start||'—'} → ${tr.contract_end||'—'}`
                            : '—'}
                        </td>
                        <td style={{ color:'#718096',fontStyle:'italic',fontSize:9.5 }}>{tr.notes||'—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── MEDICAL / INJURY HISTORY ── */}
          <div className="section-title no-break" style={{ marginTop:22 }}>
            Medical & Injury History
            {activeInj.length > 0 && (
              <span className="section-badge" style={{ background:'#FC8181',color:'#fff' }}>
                {activeInj.length} ACTIVE
              </span>
            )}
          </div>
          {injuries.length === 0 ? (
            <p style={{ fontFamily:'Arial',fontSize:11,color:'#276749',fontStyle:'italic',padding:'8px 0' }}>
              ✓ No injury records on file. Clean medical history.
            </p>
          ) : (
            <table className="no-break">
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
                  const sc = SEVERITY_COLORS[inj.severity] || SEVERITY_COLORS.Mild
                  const isAct = inj.status==='Active'
                  return (
                    <tr key={inj.id} style={{ background:isAct?'#FFF5F5':'inherit' }}>
                      <td style={{ fontWeight:600 }}>{inj.injury_type}</td>
                      <td><span className="badge" style={{ background:sc.bg,color:sc.color }}>{inj.severity}</span></td>
                      <td>{inj.date_of_injury||'—'}</td>
                      <td>{inj.expected_return||'TBD'}</td>
                      <td>
                        <span className="badge" style={{ background:isAct?'#FED7D7':'#C6F6D5',color:isAct?'#742A2A':'#276749' }}>
                          {inj.status}
                        </span>
                      </td>
                      <td style={{ color:'#718096',fontStyle:'italic',fontSize:9.5 }}>{inj.notes||'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* ── MATCH PERFORMANCE HISTORY ── */}
          <div className="section-title page-break" style={{ marginTop:22 }}>
            Match Performance History
            <span className="section-badge">{totalMatches} Matches</span>
          </div>
          {perf.length === 0 ? (
            <p style={{ fontFamily:'Arial',fontSize:11,color:'#718096',fontStyle:'italic',padding:'8px 0' }}>No performance records logged yet.</p>
          ) : (
            <>
              <div className="perf-summary">
                <span><strong>Goals:</strong> {totalGoals}</span>
                <span><strong>Assists:</strong> {totalAssists}</span>
                <span><strong>Avg Rating:</strong> {avgRating}/10</span>
                <span><strong>xG:</strong> {totalXG}</span>
                <span><strong>xA:</strong> {totalXA}</span>
                <span><strong>Avg Pass%:</strong> {avgPass}{avgPass!=='—'?'%':''}</span>
                <span><strong>Total Dist:</strong> {totalDist} km</span>
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
                  {perf.slice(0,30).map(p => {
                    const rating = parseFloat(p.rating||0)
                    const rColor = rating>=7?'#276749':rating>=5?'#744210':'#742A2A'
                    return (
                      <tr key={p.id}>
                        <td style={{ whiteSpace:'nowrap' }}>{p.match_date||'—'}</td>
                        <td style={{ fontWeight:500 }}>{p.opponent||'—'}</td>
                        <td>{p.minutes_played||0}'</td>
                        <td style={{ fontWeight:700,color:'#276749',textAlign:'center' }}>{p.goals||0}</td>
                        <td style={{ fontWeight:700,color:'#553C9A',textAlign:'center' }}>{p.assists||0}</td>
                        <td>{parseFloat(p.xg||0).toFixed(2)}</td>
                        <td>{parseFloat(p.xa||0).toFixed(2)}</td>
                        <td style={{ textAlign:'center' }}>{p.shots||0}</td>
                        <td>{p.pass_accuracy||0}%</td>
                        <td>{p.distance_km||0} km</td>
                        <td style={{ fontWeight:700,color:rColor,textAlign:'center' }}>{p.rating||0}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {perf.length > 30 && (
                <p style={{ fontFamily:'Arial',fontSize:9.5,color:'#718096',marginTop:6,fontStyle:'italic',textAlign:'center' }}>
                  Showing most recent 30 of {perf.length} records. Full history available in the system.
                </p>
              )}
            </>
          )}

          {/* ── SIGNATURE BLOCK ── */}
          <div className="sig-block">
            {['Prepared By','Reviewed By','Authorised By'].map(label => (
              <div key={label}>
                <div className="sig-line"/>
                <div className="sig-label">{label}</div>
                <div style={{ fontFamily:'Arial',fontSize:8.5,color:'#A0AEC0',marginTop:2 }}>Name · Title · Date</div>
              </div>
            ))}
          </div>

        </div>

        {/* ══ DOCUMENT FOOTER ══ */}
        <div className="doc-footer">
          <span>Apex Track · Football Performance Platform</span>
          <span>Report Ref: {reportNum}</span>
          <span>Generated: {today} · CONFIDENTIAL — Do Not Distribute</span>
        </div>

      </div>
    </>
  )
}
