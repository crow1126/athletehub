'use client'

export default function StatCard({ label, value, note, icon, accent, trend }) {
  return (
    <div className="fade-up card" style={{ padding: '20px 22px', transition: 'var(--transition)', cursor: 'default', position: 'relative', overflow: 'hidden' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: accent ? `${accent}15` : 'var(--blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, border: `1px solid ${accent ? `${accent}25` : 'rgba(74,144,226,0.15)'}` }}>
          {icon}
        </div>
        {trend && (
          <div style={{ fontSize: 11, fontWeight: 700, color: trend.startsWith('+') ? 'var(--success)' : 'var(--danger)', background: trend.startsWith('+') ? 'var(--success-light)' : 'var(--danger-light)', padding: '3px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
            {trend.startsWith('+') ? '↑' : '↓'} {trend}
          </div>
        )}
      </div>

      <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', lineHeight: 1, marginBottom: 6, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, marginBottom: note ? 4 : 0 }}>{label}</div>
      {note && <div style={{ fontSize: 11, color: accent || 'var(--blue)', fontWeight: 600 }}>{note}</div>}
    </div>
  )
}