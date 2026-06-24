export default function NotFound() {
  return (
    <div style={containerStyle}>
      <div style={cardStyle} className="fade-up">
        <div style={iconContainerStyle}>
          <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 style={titleStyle}>Page Not Found</h1>
        <p style={descriptionStyle}>
          The page you are looking for does not exist or has been moved.
        </p>
        <div style={buttonContainerStyle}>
          <a href="/dashboard" style={btnStyle}>
            Return to Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}

const containerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: '24px',
  background: 'linear-gradient(135deg, #C8EDCE 0%, #E4F7E8 30%, #F0FBF4 60%, #FFFFFF 100%)',
  fontFamily: 'var(--font-jakarta), system-ui, sans-serif',
}

const cardStyle = {
  background: 'rgba(255, 255, 255, 0.95)',
  border: '1px solid #D4EDDE',
  borderRadius: '16px',
  padding: '40px 32px',
  maxWidth: '480px',
  width: '100%',
  textAlign: 'center',
  boxShadow: '0 10px 25px -5px rgba(13, 100, 60, 0.1)',
  backdropFilter: 'blur(8px)',
}

const iconContainerStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '64px',
  height: '64px',
  borderRadius: '50%',
  backgroundColor: '#FEF3C7',
  color: '#D97706',
  marginBottom: '24px',
}

const iconStyle = {
  width: '32px',
  height: '32px',
}

const titleStyle = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#0F2218',
  marginBottom: '12px',
}

const descriptionStyle = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#5A7A68',
  marginBottom: '32px',
}

const buttonContainerStyle = {
  display: 'flex',
  justifyContent: 'center',
}

const btnStyle = {
  textDecoration: 'none',
  backgroundColor: '#0D9488',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '12px',
  padding: '12px 28px',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  boxShadow: '0 4px 12px rgba(13, 148, 136, 0.2)',
  display: 'inline-block',
}
