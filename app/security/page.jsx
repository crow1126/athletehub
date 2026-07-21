import LegalPage from '@/components/LegalPage'

export const metadata = {
  title: 'Security & Data Protection | ApexTrack',
  description: 'How ApexTrack safeguards squad data, medical logs, and ApexPay payroll transactions.',
}

export default function SecurityPage() {
  return (
    <LegalPage
      title="Security & Data Protection"
      subtitle="Comprehensive overview of our data security architecture, PostgreSQL tenant isolation, and ApexPay disbursement safeguards."
      lastUpdated="21 July 2026"
    >
      <p>
        At ApexTrack, protecting athlete health records, performance data, and financial payroll transactions is our highest technical priority. This document outlines our security architecture and operational controls.
      </p>

      <h2>1. Multi-Tenant Data Isolation</h2>
      <p>
        ApexTrack enforces strict multi-tenant isolation at the database layer using PostgreSQL <strong>Row Level Security (RLS)</strong>.
        Every database query is bound to the user&apos;s authenticated <code>team_id</code> session token. This ensures that coaches, physios, and administrators can only view or mutate records belonging to their specific club.
      </p>

      <h2>2. ApexPay Payroll &amp; Financial Security</h2>
      <p>
        The ApexPay disbursement engine incorporates institutional security checks:
      </p>
      <ul>
        <li><strong>Deposit Entitlement Checks:</strong> Wallet balances and spending caps are continuously reconciled against verified MoMo top-up deposits to detect and prevent balance discrepancies.</li>
        <li><strong>Automated Disbursement Freezes:</strong> In the event of an entitlement drift or transaction mismatch, disbursement routes are automatically locked until administrator review.</li>
        <li><strong>Encrypted Payment Gateways:</strong> Top-ups and payouts are executed via PCI-DSS compliant providers (Moolre &amp; Paystack) over TLS encrypted channels.</li>
      </ul>

      <h2>3. Data Encryption Standards</h2>
      <ul>
        <li><strong>In Transit:</strong> All HTTP traffic is strictly encrypted using TLS 1.3 encryption.</li>
        <li><strong>At Rest:</strong> Databases and file attachments are stored with AES-256 encryption hosted on Supabase cloud infrastructure.</li>
        <li><strong>Authentication:</strong> Session management utilizes secure JSON Web Tokens (JWT) with salted password hashing.</li>
      </ul>

      <h2>4. Backup &amp; Disaster Recovery</h2>
      <p>
        Automated daily backups are performed on all PostgreSQL databases, with point-in-time recovery (PITR) enabled to safeguard against data loss.
      </p>

      <h2>5. Incident Response &amp; Reporting</h2>
      <p>
        If you suspect a security vulnerability or unauthorized access attempt on your club account, please report it immediately to our security team at <a href="mailto:admin@apextrackgh.com">admin@apextrackgh.com</a>.
      </p>

      <h2>Related Documents</h2>
      <p>
        <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a>
      </p>
    </LegalPage>
  )
}
