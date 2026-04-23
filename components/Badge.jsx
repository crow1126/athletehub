const SPORT_COLORS = {
  Forward:    { bg: '#FFF3E0', color: '#B36200' },
  Midfielder: { bg: '#E8F4FF', color: '#1565C0' },
  Defender:   { bg: '#E8F8EE', color: '#1B5E20' },
  Goalkeeper: { bg: '#F3E5F5', color: '#6A1B9A' },
}

const STATUS_COLORS = {
  Active:    { bg: '#E8F8EE', color: '#1B7A3E', border: 'rgba(39,174,96,0.25)'  },
  Injured:   { bg: '#FDEDEC', color: '#C0392B', border: 'rgba(231,76,60,0.25)'  },
  Suspended: { bg: '#FEF9E7', color: '#B7770D', border: 'rgba(243,156,18,0.25)' },
  Recovered: { bg: '#E8F8EE', color: '#1B7A3E', border: 'rgba(39,174,96,0.25)'  },
  Mild:      { bg: '#E8F8EE', color: '#1B7A3E', border: 'rgba(39,174,96,0.25)'  },
  Moderate:  { bg: '#FEF9E7', color: '#B7770D', border: 'rgba(243,156,18,0.25)' },
  Severe:    { bg: '#FDEDEC', color: '#C0392B', border: 'rgba(231,76,60,0.25)'  },
}

export default function Badge({ status, type = 'status' }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.Active
  if (type === 'sport') {
    const sp = SPORT_COLORS[status] || { bg: '#E8F4FF', color: '#1565C0' }
    return (
      <span style={{ background: sp.bg, color: sp.color, padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block' }}>
        {status}
      </span>
    )
  }
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {(status === 'Active' || status === 'Recovered' || status === 'Mild') && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#27AE60', display: 'inline-block', flexShrink: 0 }} />
      )}
      {status}
    </span>
  )
}