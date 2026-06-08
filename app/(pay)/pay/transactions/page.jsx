'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const fmt = n => `GHS ${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function TxTypeBadge({ type }) {
  const map = {
    top_up: { label: 'Top Up', bg: 'rgba(16,185,129,0.12)', color: '#34D399', icon: '⬆' },
    payout: { label: 'Payout', bg: 'rgba(99,102,241,0.12)', color: '#818CF8', icon: '💸' },
    fee:    { label: 'Fee',    bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', icon: '📊' },
  }
  const s = map[type] || { label: type, bg: 'rgba(100,116,139,0.1)', color: '#94A3B8', icon: '•' }
  return <span className="pay-badge" style={{ background: s.bg, color: s.color }}>{s.icon} {s.label}</span>
}

function StatusDot({ status }) {
  const map = {
    success:    '#10B981',
    pending:    '#F59E0B',
    processing: '#8B5CF6',
    failed:     '#EF4444',
  }
  const color = map[status] || '#64748B'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color, fontWeight: 700, textTransform: 'capitalize' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', boxShadow: `0 0 6px ${color}` }} />
      {status}
    </span>
  )
}

export default function TransactionsPage() {
  const [teamId, setTeamId] = useState(null)
  const [txns,   setTxns]   = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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

  return (
    <div style={{ padding: '32px', animation: 'fadeUp 0.35s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#F1F5F9', letterSpacing: '-0.04em', marginBottom: 4 }}>Transaction Ledger</h1>
          <p style={{ fontSize: 14, color: '#475569' }}>Full audit trail of wallet top-ups, payouts, and fees.</p>
        </div>
        <button className="pay-btn-ghost" onClick={() => load(teamId)}>↺ Refresh</button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Top-Ups',  value: fmt(totals.top_up), color: '#34D399', icon: '⬆' },
          { label: 'Total Payouts',  value: fmt(totals.payout), color: '#818CF8', icon: '💸' },
          { label: 'Platform Fees',  value: fmt(totals.fee),    color: '#F59E0B', icon: '📊' },
        ].map(c => (
          <div key={c.label} className="pay-card" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{c.icon}</div>
            <div>
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: c.color, letterSpacing: '-0.03em', marginTop: 2 }}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <input
          className="pay-inp"
          placeholder="Search reference, name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 260, padding: '8px 14px' }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'top_up', 'payout', 'fee'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                background: filter === f ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                color: filter === f ? '#F59E0B' : '#64748B',
              }}
            >
              {f === 'all' ? 'All' : f === 'top_up' ? 'Top-Ups' : f === 'payout' ? 'Payouts' : 'Fees'}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#475569' }}>{filtered.length} transaction{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="pay-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#334155' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📒</div>
            <div style={{ color: '#475569', fontSize: 14 }}>No transactions found</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
              <tr>
                {['Date', 'Type', 'Amount', 'Status', 'Reference', 'Recipient / Note'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 18px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#334155', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', animation: `fadeUp 0.25s ease ${Math.min(i, 15) * 0.02}s both` }}>
                  <td style={{ padding: '11px 18px', color: '#64748B', fontSize: 11 }}>{new Date(t.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={{ padding: '11px 18px' }}><TxTypeBadge type={t.type} /></td>
                  <td style={{ padding: '11px 18px', fontWeight: 800, color: t.type === 'top_up' ? '#34D399' : t.type === 'fee' ? '#F59E0B' : '#818CF8' }}>
                    {t.type === 'top_up' ? '+' : '-'}{fmt(t.amount)}
                  </td>
                  <td style={{ padding: '11px 18px' }}><StatusDot status={t.status} /></td>
                  <td style={{ padding: '11px 18px' }}>
                    <code style={{ fontSize: 10, color: '#475569', background: 'rgba(255,255,255,0.04)', borderRadius: 5, padding: '3px 7px' }}>
                      {t.reference?.slice(0, 24)}…
                    </code>
                  </td>
                  <td style={{ padding: '11px 18px', color: '#64748B', fontSize: 12 }}>
                    {t.metadata?.recipient || t.metadata?.email || '—'}
                    {t.metadata?.simulated && <span style={{ marginLeft: 6, fontSize: 10, color: '#F59E0B' }}>⚡sim</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
