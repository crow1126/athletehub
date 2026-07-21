import LegalPage from '@/components/LegalPage'

export const metadata = {
  title: 'Privacy Policy | ApexTrack',
  description: 'How ApexTrack collects, uses, and protects athlete, club, and payroll data in compliance with relevant privacy regulations.',
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="How we handle personal data, sensitive athlete performance metrics, injury records, and ApexPay payroll details."
      lastUpdated="21 July 2026"
    >
      <p>
        ApexTrack (&quot;we&quot;, &quot;us&quot;, &quot;ApexTrack&quot;) provides a comprehensive football performance, squad management, and payroll platform built for clubs across Ghana and Africa.
        This policy outlines what information we collect, why, and how we protect your club&apos;s data, in alignment with the Data Protection Act, 2012 (Act 843) of Ghana as well as applicable international standards (including UK/EU GDPR where applicable).
      </p>

      <h2>1. Who We Are</h2>
      <p>
        ApexTrack is operated as a cloud-based software service for sports clubs, academies, and professional sports organisations. For privacy and data protection inquiries, contact our Data Protection Officer at <a href="mailto:admin@apextrackgh.com">admin@apextrackgh.com</a>.
      </p>

      <h2>2. Data We Process</h2>
      <p>Depending on your club&apos;s active modules, we process:</p>
      <ul>
        <li><strong>Account &amp; User Data:</strong> Name, work email, phone number, user role (Superadmin, Admin, Coach, Physio, Analyst), login credentials, and session logs.</li>
        <li><strong>Athlete &amp; Squad Profiles:</strong> Player identity, age, position, match performance statistics (goals, assists, xG, xA, ratings), contract details, and transfer histories.</li>
        <li><strong>Medical &amp; Injury Logs:</strong> Injury type, recovery progress, treatment notes, return-to-play clearance dates, and rehab logs.</li>
        <li><strong>ApexPay Payroll &amp; Wallet Data:</strong> Staff salary amounts, Mobile Money (MoMo) account details, transaction reference numbers, wallet balances, and disbursement logs.</li>
        <li><strong>Club Assets &amp; Documents:</strong> Official logos, contract PDFs, and generated executive reports.</li>
        <li><strong>Technical Data:</strong> IP addresses, browser types, device identifiers, and system diagnostic logs.</li>
      </ul>

      <h2>3. Purpose and Legal Basis for Processing</h2>
      <ul>
        <li><strong>Service Delivery:</strong> Managing club rosters, generating performance reports, executing squad management workflows, and processing Mobile Money disbursements via ApexPay.</li>
        <li><strong>Security &amp; Access Control:</strong> Enforcing strict tenant isolation (PostgreSQL Row Level Security) to prevent unauthorized access across clubs.</li>
        <li><strong>Administrative Communications:</strong> Sending service notifications, email verification links, and billing alerts.</li>
        <li><strong>Compliance:</strong> Fulfilling financial record-keeping requirements for payroll transactions and meeting legal obligations under local laws.</li>
      </ul>
      <p>
        For athlete and injury data, your club acts as the <strong>Data Controller</strong>, while ApexTrack serves as the <strong>Data Processor</strong> acting on the club&apos;s instructions.
      </p>

      <h2>4. Sub-Processors &amp; Service Providers</h2>
      <p>We work with trusted third-party providers to deliver high availability and secure transactions:</p>
      <ul>
        <li><strong>Supabase</strong> — Cloud database, user authentication, and encrypted file storage.</li>
        <li><strong>Vercel</strong> — Web application hosting, serverless execution, and edge routing.</li>
        <li><strong>Paystack &amp; Moolre</strong> — Mobile Money (MTN MoMo, Telecel Cash, AT Money) and card payment processing for club subscriptions and wallet top-ups.</li>
        <li><strong>Resend</strong> — Transactional email delivery for notifications and verification emails.</li>
      </ul>

      <h2>5. Data Security</h2>
      <p>
        We employ multi-layer security measures, including HTTPS/TLS 1.3 encryption in transit, AES-256 encryption at rest, role-based access controls (RBAC), and Row Level Security (RLS) policies at the database layer to guarantee complete isolation of club databases.
      </p>

      <h2>6. Data Retention &amp; Deletion</h2>
      <p>
        Club data is maintained for the duration of your active subscription or trial. Upon account termination or written deletion request, records are securely deleted or anonymized within 30 days, except where financial or legal obligations mandate longer retention.
      </p>

      <h2>7. Your Rights</h2>
      <p>
        Individuals have the right to request access to, correction of, or deletion of their personal information. Athletes and staff should contact their club administrator directly for records managed by the club, or email <a href="mailto:admin@apextrackgh.com">admin@apextrackgh.com</a> for platform assistance.
      </p>
    </LegalPage>
  )
}
