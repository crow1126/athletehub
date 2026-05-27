import LegalPage from '@/components/LegalPage'

export const metadata = {
  title: 'Terms of Service | Apex Track',
  description: 'Terms governing use of the Apex Track football management platform.',
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      subtitle="Please read these terms before creating an account or using Apex Track on behalf of a club."
      lastUpdated="27 May 2026"
    >
      <p>
        By registering for or using Apex Track, you agree to these Terms of Service (&quot;Terms&quot;) on behalf of yourself
        and, where applicable, the club or organisation you represent.
      </p>

      <h2>1. The service</h2>
      <p>
        Apex Track provides tools for squad management, performance analytics, injury tracking, scheduling, scouting, and related reporting.
        Features may change as we develop the product. We do not guarantee uninterrupted access (see Section 8).
      </p>

      <h2>2. Accounts &amp; responsibilities</h2>
      <ul>
        <li>You must provide accurate registration information and keep credentials confidential.</li>
        <li>Club administrators are responsible for inviting staff, assigning roles, and deactivating users who leave the organisation.</li>
        <li>You must not share accounts or use the platform for unlawful, abusive, or unauthorised purposes.</li>
        <li>You are responsible for data you enter, including ensuring you have permission to store athlete personal and health information.</li>
      </ul>

      <h2>3. Medical &amp; professional disclaimer</h2>
      <p>
        Apex Track is <strong>not</strong> a medical device and does not provide clinical diagnosis or treatment advice.
        Injury and health fields are for club operational records only. Clinical decisions remain the responsibility of qualified medical professionals.
        Clubs must comply with applicable medical confidentiality, safeguarding, and sports-medicine regulations in their jurisdiction.
      </p>

      <h2>4. Data protection</h2>
      <p>
        Use of personal data is described in our <a href="/privacy">Privacy Policy</a>. Clubs using the service for EU/UK players or staff
        should ensure appropriate data processing agreements and lawful bases are in place. Our <a href="/security">Security &amp; Data Protection</a> page
        describes technical safeguards.
      </p>

      <h2>5. Subscription &amp; billing</h2>
      <p>
        Some features may require a paid plan or trial. Fees, renewal, and cancellation terms are shown at checkout or in your club billing area.
        Failure to pay may result in restricted access after notice.
      </p>

      <h2>6. Intellectual property</h2>
      <p>
        Apex Track software, branding, and documentation remain our property. You retain ownership of data you upload. You grant us a limited licence
        to host and process that data solely to operate the service.
      </p>

      <h2>7. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Attempt to access another club&apos;s data or bypass security controls.</li>
        <li>Reverse engineer, scrape, or overload the platform.</li>
        <li>Upload malware or unlawful content.</li>
        <li>Misrepresent affiliation with Apex Track or other clubs.</li>
      </ul>

      <h2>8. Availability &amp; support</h2>
      <p>
        We aim for reliable operation but do not publish a formal uptime SLA on standard plans. Scheduled maintenance and third-party outages may occur.
        Support is provided on a reasonable-efforts basis via <a href="mailto:privacy@apextrack.app">privacy@apextrack.app</a> (general enquiries).
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Apex Track is provided &quot;as is&quot;. We are not liable for indirect, consequential, or lost-profit damages
        arising from use of the platform, including decisions made from injury or performance data. Our total liability for any claim is limited to fees
        paid by your organisation in the twelve months preceding the claim, or £100 if no fees were paid, whichever is greater where law allows.
      </p>

      <h2>10. Termination</h2>
      <p>
        You may stop using the service at any time. We may suspend or terminate accounts that violate these Terms or pose a security risk.
        Upon termination, access ends and data is handled per our Privacy Policy.
      </p>

      <h2>11. Governing law</h2>
      <p>
        These Terms are governed by the laws of England and Wales, without regard to conflict-of-law principles. Courts in England shall have exclusive jurisdiction,
        subject to mandatory consumer protections in your country of residence where applicable.
      </p>

      <h2>12. Changes</h2>
      <p>
        We may update these Terms. The &quot;Last updated&quot; date will change when we do. Material changes may be communicated by email or in-app notice.
      </p>
    </LegalPage>
  )
}
