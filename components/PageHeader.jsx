export default function PageHeader({ label, title, subtitle, action }) {
  return (
    <div className="fade-up" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
      <div>
        {label && (
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--blue)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, height: 2, background: 'var(--blue)', display: 'inline-block', borderRadius: 1 }} />
            {label}
          </div>
        )}
        <h1 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: subtitle ? 5 : 0 }}>{title}</h1>
        {subtitle && <p style={{ color: 'var(--text2)', fontSize: 14, fontWeight: 400 }}>{subtitle}</p>}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}