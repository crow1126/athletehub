'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { payFetch } from '@/lib/payFetch'

const C = {
  text:      '#0B1E14',
  text2:     '#102A1C',
  text3:     '#243E30',
  teal:      '#0B7A70',
  tealDeep:  '#0A5C54',
  tealAlpha: 'rgba(11,122,112,0.10)',
  border:    '#82C29A',
  muted:     '#E2F5E9',
  bg:        '#F0FBF4',
  card:      'rgba(255,255,255,0.92)',
  success:   '#047857',
  successBg: '#D1FAE5',
  danger:    '#B91C1C',
  dangerBg:  '#FEE2E2',
  warning:   '#B45309',
  warningBg: '#FEF3C7',
  info:      '#1D4ED8',
  infoBg:    '#DBEAFE',
  purple:    '#6D28D9',
  purpleBg:  '#F3E8FF',
}

const fmt = n => `GHS ${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function TxTypeBadge({ type }) {
  const map = {
    top_up: { label: 'Top Up', bg: C.successBg,  color: C.success, icon: '⬆' },
    payout: { label: 'Payout', bg: C.tealAlpha,  color: C.teal, icon: '' },
    fee:    { label: 'Fee',    bg: C.warningBg,  color: C.warning, icon: '' },
  }
  const s = map[type] || { label: type, bg: 'rgba(36,62,48,0.10)', color: C.text3, icon: '•' }
  return <span className="pay-badge" style={{ background: s.bg, color: s.color }}>{s.icon} {s.label}</span>
}

function StatusDot({ status }) {
  const map = {
    success:    C.success,
    pending:    C.warning,
    processing: C.info,
    failed:     C.danger,
  }
  const color = map[status] || C.text3
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color, fontWeight: 700, textTransform: 'capitalize' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', boxShadow: `0 0 5px ${color}`, flexShrink: 0 }} />
      {status}
    </span>
  )
}

/* ── Mobile transaction card ── */
function TxCard({ t }) {
  const isCredit = t.type === 'top_up'
  return (
    <div style={{ background: C.muted, borderRadius: 12, padding: '13px 14px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: isCredit ? C.successBg : C.tealAlpha, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, border: `1px solid ${C.border}` }}>
        {t.type === 'top_up' ? '⬆' : t.type === 'fee' ? '' : ''}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
          <TxTypeBadge type={t.type} />
          <StatusDot status={t.status} />
          {t.type === 'top_up' && t.status === 'pending' && (
            <button
              onClick={() => onVerify(t.reference)}
              disabled={verifying}
              style={{
                background: 'none', border: 'none', color: C.teal, fontSize: 11, fontWeight: 'bold',
                cursor: 'pointer', padding: '0 4px', textDecoration: 'underline', fontFamily: 'inherit'
              }}
            >
              {verifying ? '...' : 'Verify'}
            </button>
          )}
        </div>
        <div style={{ fontSize: 11, color: C.text3 }}>
          {new Date(t.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
        {(t.metadata?.recipient || t.metadata?.email) && (
          <div style={{ fontSize: 11, color: C.text2, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.metadata?.recipient || t.metadata?.email}
            {t.metadata?.simulated && <span style={{ marginLeft: 5, fontSize: 9, color: C.warning, fontWeight: 'bold' }}>sim</span>}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: isCredit ? C.success : t.type === 'fee' ? C.warning : C.teal }}>
          {isCredit ? '+' : '-'}{fmt(t.amount)}
        </div>
      </div>
    </div>
  )
}

export default function TransactionsPage() {
  const [teamId,  setTeamId]  = useState(null)
  const [txns,    setTxns]    = useState([])
  const [filter,  setFilter]  = useState('all')
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [verifying, setVerifying] = useState({}) // { [ref]: boolean }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const load = useCallback(async (tid) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('pay_transactions')
      .select('*')
      .eq('team_id', tid)
      .order('created_at', { ascending: false })
      .limit(200)
    setLoading(false)
    if (!error) setTxns(data || [])
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: profile } = await supabase.from('profiles').select('team_id').eq('id', session.user.id).single()
      if (profile?.team_id) { setTeamId(profile.team_id); load(profile.team_id) }
    }
    init()
  }, [load])

  const handleVerify = async (ref) => {
    if (verifying[ref]) return
    setVerifying(prev => ({ ...prev, [ref]: true }))
    try {
      const { res, data } = await payFetch('/api/pay/topup/verify', {
        method: 'POST',
        body: JSON.stringify({ reference: ref }),
      })
      if (res.ok && data.ok) {
        alert(data.message || 'Payment successfully verified and wallet credited!')
        load(teamId)
      } else {
        alert(data.message || data.error || 'Payment status check returned pending. Please try again in a moment.')
      }
    } catch (e) {
      alert('Network error verifying payment: ' + e.message)
    } finally {
      setVerifying(prev => ({ ...prev, [ref]: false }))
    }
  }

  const filtered = txns.filter(t => {
    if (filter !== 'all' && t.type !== filter) return false
    if (search && !JSON.stringify(t).toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totals = {
    top_up: txns.filter(t => t.type === 'top_up' && t.status === 'success').reduce((s, t) => s + Number(t.amount), 0),
    payout: txns.filter(t => t.type === 'payout' && t.status === 'success').reduce((s, t) => s + Number(t.amount), 0),
    fee:    txns.filter(t => t.type === 'fee'    && t.status === 'success').reduce((s, t) => s + Number(t.amount), 0),
  }

  const FILTERS = [
    { key: 'all',    label: 'All' },
    { key: 'top_up', label: 'Top-Ups' },
    { key: 'payout', label: 'Payouts' },
    { key: 'fee',    label: 'Fees' },
  ]

  return (
    <div className="pay-page" style={{ animation: 'fadeUp 0.35s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isMobile ? 16 : 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: C.text, letterSpacing: '-0.04em', marginBottom: 3 }}>Transaction Ledger</h1>
          <p style={{ fontSize: 13, color: C.text3 }}>Full audit trail of wallet top-ups, payouts, and fees.</p>
        </div>
        <button className="pay-btn-ghost" style={{ padding: '9px 14px', fontSize: 13 }} onClick={() => load(teamId)}>↺ Refresh</button>
      </div>

      {/* Summary — 3-col on desktop, horizontal scroll chips on mobile */}
      {isMobile ? (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, marginBottom: 16, scrollbarWidth: 'none' }}>
          {[
            { label: 'Top-Ups',  value: fmt(totals.top_up), color: C.success, icon: '⬆' },
            { label: 'Payouts',  value: fmt(totals.payout), color: C.teal, icon: '' },
            { label: 'Fees',     value: fmt(totals.fee),    color: C.warning, icon: '' },
          ].map(c => (
            <div key={c.label} style={{ flexShrink: 0, background: C.muted, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', minWidth: 140 }}>
              <div style={{ fontSize: 10, color: C.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{c.icon} {c.label}</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Top-Ups', value: fmt(totals.top_up), color: C.success, icon: '⬆' },
            { label: 'Total Payouts', value: fmt(totals.payout), color: C.teal, icon: '' },
            { label: 'Platform Fees', value: fmt(totals.fee),    color: C.warning, icon: '' },
          ].map(c => (
            <div key={c.label} className="pay-card" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: `1px solid ${C.border}`, color: c.color }}>{c.icon}</div>
              <div>
                <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: c.color, letterSpacing: '-0.03em', marginTop: 2 }}>{c.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filter */}
      <div style={{ marginBottom: 14 }}>
        <input
          className="pay-inp"
          placeholder="Search reference, name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 10, fontSize: 14 }}
        />
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                flexShrink: 0, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${filter === f.key ? C.teal : C.border}`,
                background: filter === f.key ? C.teal : C.muted,
                color: filter === f.key ? '#FFFFFF' : C.text3,
                transition: 'all 0.15s'
              }}
            >{f.label}</button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.text3, flexShrink: 0, alignSelf: 'center', paddingLeft: 8, whiteSpace: 'nowrap', fontWeight: 'bold' }}>
            {filtered.length} txn{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="pay-card" style={{ padding: 48, textAlign: 'center', color: C.text3 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="pay-card" style={{ padding: 56, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}></div>
          <div style={{ color: C.text3, fontSize: 14 }}>No transactions found</div>
        </div>
      ) : isMobile ? (
        /* Mobile: card list */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((t, i) => (
            <div key={t.id} style={{ animation: `fadeUp 0.2s ease ${Math.min(i, 12) * 0.03}s both` }}>
              <TxCard t={t} onVerify={handleVerify} verifying={verifying[t.reference]} />
            </div>
          ))}
        </div>
      ) : (
        /* Desktop: full table */
        <div className="pay-card pay-table-scroll" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
            <thead style={{ background: C.muted }}>
              <tr>
                {['Date', 'Type', 'Amount', 'Status', 'Reference', 'Recipient / Note'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: C.text3, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}`, animation: `fadeUp 0.25s ease ${Math.min(i, 15) * 0.02}s both` }}>
                  <td style={{ padding: '11px 18px', color: C.text3, fontSize: 11 }}>{new Date(t.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={{ padding: '11px 18px' }}><TxTypeBadge type={t.type} /></td>
                  <td style={{ padding: '11px 18px', fontWeight: 800, color: t.type === 'top_up' ? C.success : t.type === 'fee' ? C.warning : C.teal }}>
                    {t.type === 'top_up' ? '+' : '-'}{fmt(t.amount)}
                  </td>
                  <td style={{ padding: '11px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusDot status={t.status} />
                      {t.type === 'top_up' && t.status === 'pending' && (
                        <button
                          onClick={() => handleVerify(t.reference)}
                          disabled={verifying[t.reference]}
                          style={{
                            background: 'none', border: 'none', color: C.teal, fontSize: 11, fontWeight: 'bold',
                            cursor: 'pointer', padding: 0, textDecoration: 'underline', fontFamily: 'inherit'
                          }}
                        >
                          {verifying[t.reference] ? '...' : 'Verify'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '11px 18px' }}>
                    <code style={{ fontSize: 10, color: C.text, background: C.muted, border: `1px solid ${C.border}`, borderRadius: 5, padding: '3px 7px' }}>
                      {t.reference?.slice(0, 24)}…
                    </code>
                  </td>
                  <td style={{ padding: '11px 18px', color: C.text2, fontSize: 12 }}>
                    {t.metadata?.recipient || t.metadata?.email || '—'}
                    {t.metadata?.simulated && <span style={{ marginLeft: 6, fontSize: 10, color: C.warning, fontWeight: 'bold' }}>sim</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
