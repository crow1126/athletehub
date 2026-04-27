'use client'
import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import { supabase } from '@/lib/supabase'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const REPORT_CARDS = [
  { id:'athletes',    icon:'👥', title:'Athletes Report',         desc:'Full squad roster — positions, clubs, regions, coaches, and status',                   color:'#4A90E2', sheets:'1 sheet'  },
  { id:'injuries',    icon:'🩺', title:'Injury Report',           desc:'Complete injury records with severity, dates, recovery notes and status',               color:'#E74C3C', sheets:'1 sheet'  },
  { id:'performance', icon:'📊', title:'Performance Report',      desc:'Match stats per athlete — goals, assists, xG, xA, pass accuracy, distance, ratings',   color:'#9B59B6', sheets:'1 sheet'  },
  { id:'sessions',    icon:'📅', title:'Training Sessions',       desc:'All scheduled training sessions with venue, coach, type and duration',                  color:'#27AE60', sheets:'1 sheet'  },
  { id:'coaches',     icon:'🎽', title:'Staff Report',            desc:'Technical, medical, analytics and scouting staff roster with roles',                    color:'#E67E22', sheets:'1 sheet'  },
  { id:'contracts',   icon:'💰', title:'Contracts & Finance',     desc:'Player contracts, wages, bonuses and automatic wage bill summary sheet',                color:'#1B7A3E', sheets:'2 sheets' },
  { id:'summary',     icon:'📋', title:'Full Summary Report',     desc:'Everything in one workbook — all 6 modules combined with an overview cover sheet',      color:'#E67E22', sheets:'7 sheets', featured: true },
]

export default function ReportsPage() {
  const [athletes,     setAthletes]     = useState([])
  const [injuries,     setInjuries]     = useState([])
  const [performance,  setPerformance]  = useState([])
  const [sessions,     setSessions]     = useState([])
  const [coaches,      setCoaches]      = useState([])
  const [contracts,    setContracts]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [generating,   setGenerating]   = useState(null)
  const [statusMsg,    setStatusMsg]    = useState({ text:'', type:'' })

  const [reportType, setReportType] = useState('monthly')
  const [selMonth,   setSelMonth]   = useState(new Date().getMonth())
  const [selYear,    setSelYear]    = useState(new Date().getFullYear())

  const years = []
  for (let y = 2022; y <= new Date().getFullYear() + 1; y++) years.push(y)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [
          { data: a }, { data: i }, { data: p },
          { data: s }, { data: c }, { data: ct },
        ] = await Promise.all([
          supabase.from('athletes').select('*, coaches(name)'),
          supabase.from('injuries').select('*, athletes(name, club, position)'),
          supabase.from('performance_stats').select('*, athletes(name, position, club)').order('match_date', { ascending: false }),
          supabase.from('training_sessions').select('*'),
          supabase.from('coaches').select('*'),
          supabase.from('contracts').select('*, athletes(name, position, club)'),
        ])
        setAthletes(a   || [])
        setInjuries(i   || [])
        setPerformance(p|| [])
        setSessions(s   || [])
        setCoaches(c    || [])
        setContracts(ct || [])
      } catch (err) {
        setStatusMsg({ text: 'Failed to load data: ' + err.message, type: 'error' })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function generateReport(reportId) {
    setGenerating(reportId)
    setStatusMsg({ text: '', type: '' })

    try {
      const payload = {
        type:        reportId,
        month:       selMonth,
        year:        selYear,
        reportType:  reportType,   // 'monthly' or 'yearly'
        athletes,
        injuries,
        performance,
        sessions,
        coaches,
        contracts,
      }

      const res = await fetch('/api/reports', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      if (!res.ok) {
        let errMsg = `Server error ${res.status}`
        try { const j = await res.json(); errMsg = j.error || errMsg } catch {}
        throw new Error(errMsg)
      }

      const blob   = await res.blob()
      const url    = URL.createObjectURL(blob)
      const link   = document.createElement('a')
      const period = reportType === 'yearly' ? `Year_${selYear}` : `${MONTHS[selMonth]}_${selYear}`
      link.href     = url
      link.download = `GhanaFootball_${period}_${reportId}_report.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      const cardTitle = REPORT_CARDS.find(r => r.id === reportId)?.title || 'Report'
      setStatusMsg({ text: `✅ "${cardTitle}" downloaded successfully!`, type: 'success' })
      setTimeout(() => setStatusMsg({ text: '', type: '' }), 5000)
    } catch (err) {
      setStatusMsg({ text: '❌ ' + err.message, type: 'error' })
    }
    setGenerating(null)
  }

  const activeAthletes  = athletes.filter(a => a.status === 'Active').length
  const activeContracts = contracts.filter(c => c.status === 'Active')
  const weeklyWage      = activeContracts.reduce((s, c) => s + parseFloat(c.weekly_wage || 0), 0)
  const period          = reportType === 'monthly' ? `${MONTHS[selMonth]} ${selYear}` : `Full Year ${selYear}`

  return (
    <Layout>
      <style>{`
  @media(max-width:768px){
    div[style*="32px 40px 60px"]{padding:14px 12px 40px!important}
    div[style*="repeat(5,1fr)"]{grid-template-columns:repeat(2,1fr)!important}
    div[style*="repeat(3,1fr)"]{grid-template-columns:1fr!important}
  }
`}</style>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 40px 60px' }}>
        <PageHeader label="Analytics & Exports" title="Reports" subtitle="Generate and download Excel reports for any time period" />

        {/* Stats row */}
        <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 28 }}>
          {[
            { label:'Total Athletes',    value: loading ? '…' : athletes.length,         icon:'👥', color:'#4A90E2' },
            { label:'Active Athletes',   value: loading ? '…' : activeAthletes,          icon:'✅', color:'#27AE60' },
            { label:'Injury Records',    value: loading ? '…' : injuries.length,         icon:'🩺', color:'#E74C3C' },
            { label:'Performance Logs',  value: loading ? '…' : performance.length,      icon:'📊', color:'#9B59B6' },
            { label:'Active Contracts',  value: loading ? '…' : activeContracts.length,  icon:'💰', color:'#1B7A3E' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, transition: 'var(--transition)' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='var(--shadow-md)' }}
              onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)';    e.currentTarget.style.boxShadow='var(--shadow-sm)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: s.color+'18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, marginTop: 4 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Period selector */}
        <div className="card fade-up fade-up-1" style={{ padding: '22px 26px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Report Period</h2>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 18 }}>All reports filter data based on your selected period.</p>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Toggle */}
            <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 4 }}>
              {['monthly','yearly'].map(t => (
                <button key={t} onClick={() => setReportType(t)} style={{ padding: '8px 22px', background: reportType === t ? 'var(--blue)' : 'transparent', border: 'none', borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 600, color: reportType === t ? '#fff' : 'var(--text2)', cursor: 'pointer', transition: 'var(--transition)', textTransform: 'capitalize', fontFamily: 'var(--font)' }}>
                  {t}
                </button>
              ))}
            </div>
            {/* Month (monthly only) */}
            {reportType === 'monthly' && (
              <select value={selMonth} onChange={e => setSelMonth(parseInt(e.target.value))}
                style={{ padding: '9px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text)', background: 'var(--surface2)', outline: 'none', fontFamily: 'var(--font)', cursor: 'pointer' }}>
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            )}
            {/* Year */}
            <select value={selYear} onChange={e => setSelYear(parseInt(e.target.value))}
              style={{ padding: '9px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text)', background: 'var(--surface2)', outline: 'none', fontFamily: 'var(--font)', cursor: 'pointer' }}>
              {years.map(y => <option key={y}>{y}</option>)}
            </select>
            <div style={{ fontSize: 14, color: 'var(--text2)' }}>
              Reporting on: <strong style={{ color: 'var(--blue)' }}>{period}</strong>
            </div>
          </div>
        </div>

        {/* Status message */}
        {statusMsg.text && (
          <div style={{ background: statusMsg.type === 'error' ? 'var(--danger-light)' : '#E8F8EE', border: `1px solid ${statusMsg.type === 'error' ? 'rgba(231,76,60,0.25)' : 'rgba(39,174,96,0.25)'}`, borderRadius: 'var(--r-md)', padding: '14px 18px', marginBottom: 20, fontSize: 13, color: statusMsg.type === 'error' ? 'var(--danger)' : '#1B7A3E', fontWeight: 600 }}>
            {statusMsg.text}
          </div>
        )}

        {/* Report cards */}
        <h2 className="fade-up" style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>
          Available Reports <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text3)', marginLeft: 8 }}>{REPORT_CARDS.length} report types</span>
        </h2>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ width: 36, height: 36, border: '4px solid var(--blue-light)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text3)', fontSize: 13 }}>Loading data…</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {REPORT_CARDS.map((card, idx) => {
              const isGenerating = generating === card.id
              return (
                <div key={card.id} className={`card fade-up fade-up-${idx % 4}`}
                  style={{ padding: 0, overflow: 'hidden', transition: 'var(--transition)', border: card.featured ? `2px solid ${card.color}` : '1px solid var(--border)' }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='var(--shadow-lg)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)';    e.currentTarget.style.boxShadow='var(--shadow-sm)' }}>

                  {card.featured && (
                    <div style={{ background: card.color, padding: '5px 16px', fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>
                      ⭐ Most Comprehensive
                    </div>
                  )}

                  <div style={{ padding: '20px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                      <div style={{ width: 50, height: 50, borderRadius: 14, background: card.color+'18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0, border: `1px solid ${card.color}25` }}>
                        {card.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 5 }}>{card.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.55 }}>{card.desc}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--surface2)', padding: '3px 10px', borderRadius: 99, border: '1px solid var(--border)' }}>📅 {period}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--surface2)', padding: '3px 10px', borderRadius: 99, border: '1px solid var(--border)' }}>📋 {card.sheets}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--surface2)', padding: '3px 10px', borderRadius: 99, border: '1px solid var(--border)' }}>Excel .xlsx</span>
                    </div>

                    <button
                      onClick={() => generateReport(card.id)}
                      disabled={isGenerating || loading}
                      style={{
                        width: '100%', padding: '11px 18px',
                        background: isGenerating ? 'var(--surface3)' : `linear-gradient(135deg, ${card.color}EE, ${card.color}BB)`,
                        color: isGenerating ? 'var(--text3)' : '#fff',
                        border: 'none', borderRadius: 'var(--r-md)',
                        fontSize: 13, fontWeight: 700,
                        cursor: isGenerating ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        transition: 'var(--transition)', fontFamily: 'var(--font)',
                        boxShadow: isGenerating ? 'none' : `0 3px 12px ${card.color}40`,
                      }}>
                      {isGenerating ? (
                        <>
                          <div style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.15)', borderTopColor: 'var(--text3)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                          Generating…
                        </>
                      ) : <>⬇ Download Excel</>}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Finance snapshot */}
        {!loading && contracts.length > 0 && (
          <div className="card fade-up" style={{ padding: '22px 26px', marginTop: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>💰 Financial Snapshot</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {[
                ['Weekly Wage Bill',  `GHS ${weeklyWage.toFixed(2)}`],
                ['Monthly Estimate',  `GHS ${(weeklyWage * 4.33).toFixed(2)}`],
                ['Annual Projection', `GHS ${(weeklyWage * 52).toFixed(2)}`],
              ].map(([label, value]) => (
                <div key={label} style={{ background: 'var(--surface2)', borderRadius: 'var(--r-md)', padding: '14px 18px', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#1B7A3E' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}