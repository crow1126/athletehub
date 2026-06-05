export default function PageHeader({ label, title, subtitle, action }) {
  return (
    <div className="fade-up page-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
      <div>
        {label && (
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#381932', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, height: 2, background: '#381932', display: 'inline-block', borderRadius: 1 }} />
            {label}
          </div>
        )}
        <h1 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 800, color: '#381932', letterSpacing: '-0.02em', marginBottom: subtitle ? 5 : 0 }}>{title}</h1>
        {subtitle && <p style={{ color: '#7A4E6A', fontSize: 14, fontWeight: 400 }}>{subtitle}</p>}
      </div>
      {action && <div className="page-header-action" style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}