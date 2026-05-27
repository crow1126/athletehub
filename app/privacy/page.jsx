import LegalPage from '@/components/LegalPage'

export const metadata = {
  title: 'Privacy Policy | Apex Track',
  description: 'How Apex Track collects, uses, and protects athlete and club data.',
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="How we handle personal data, including sensitive athlete health and performance information."
      lastUpdated="27 May 2026"
    >
      <p>
        Apex Track (&quot;we&quot;, &quot;us&quot;, &quot;Apex Track&quot;) provides a football performance and squad management platform.
        This policy explains what data we process, why, and your rights — especially where UK GDPR and EU GDPR apply to your club or players.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Apex Track is operated as a software service for football clubs and organisations. For data protection enquiries,
        contact <a href="mailto:privacy@apextrack.app">privacy@apextrack.app</a>.
      </p>

      <h2>2. Data we collect</h2>
      <p>Depending on how your club uses the platform, we may process:</p>
      <ul>
        <li><strong>Account data:</strong> name, email, username, role, club affiliation, authentication logs.</li>
        <li><strong>Athlete records:</strong> identity, position, physical metrics, contract notes, scouting data.</li>
        <li><strong>Health &amp; injury data:</strong> injury reports, treatment notes, recovery timelines, return-to-play status (special category data where applicable).</li>
        <li><strong>Performance data:</strong> match stats, training sessions, analytics (e.g. xG/xA), reports.</li>
        <li><strong>Club assets:</strong> logos and documents you upload.</li>
        <li><strong>Technical data:</strong> IP address, browser type, session identifiers, and usage necessary to operate and secure the service.</li>
      </ul>

      <h2>3. Why we use your data</h2>
      <ul>
        <li>To provide and maintain the platform (contract / legitimate interests).</li>
        <li>To authenticate users and enforce club-scoped access controls.</li>
        <li>To support injury tracking, performance analysis, and reporting requested by your club.</li>
        <li>To send service emails (e.g. account verification, security notices).</li>
        <li>To improve reliability, prevent abuse, and meet legal obligations.</li>
      </ul>
      <p>
        Where we process health-related data, your club is typically the <strong>data controller</strong> for athlete information;
        Apex Track acts as a <strong>data processor</strong> on the club&apos;s instructions. Clubs must ensure they have a lawful basis
        (e.g. consent, employment/contract, or legitimate interests with appropriate safeguards) before entering sensitive data.
      </p>

      <h2>4. Sub-processors</h2>
      <p>We use trusted infrastructure providers, including:</p>
      <ul>
        <li><strong>Supabase</strong> — database, authentication, and file storage (EU West region, London).</li>
        <li><strong>Vercel</strong> — application hosting and analytics.</li>
        <li><strong>Resend</strong> — transactional email delivery.</li>
      </ul>
      <p>
        These providers process data only to deliver the service and under contractual terms consistent with GDPR requirements.
        See our <a href="/security">Security &amp; Data Protection</a> page for more detail.
      </p>

      <h2>5. International transfers</h2>
      <p>
        Primary hosting is in the United Kingdom / EU where configured. If data is transferred outside the UK/EEA,
        we rely on appropriate safeguards (e.g. Standard Contractual Clauses or UK International Data Transfer Agreement mechanisms)
        offered by our sub-processors.
      </p>

      <h2>6. Retention</h2>
      <p>
        We retain data while your club&apos;s account is active and as needed to provide the service. After account closure,
        we delete or anonymise data within a reasonable period unless law requires longer retention. Clubs may export reports
        before closure. Backup copies may persist for a limited period per our provider&apos;s backup schedule (see Security page).
      </p>

      <h2>7. Security</h2>
      <p>
        We apply encryption in transit (TLS), role-based access, and database row-level security so each club&apos;s users only access
        their organisation&apos;s records. No system is perfectly secure; we continuously improve controls and respond to incidents.
      </p>

      <h2>8. Your rights (UK / EU GDPR)</h2>
      <p>Where GDPR applies, individuals may have the right to:</p>
      <ul>
        <li>Access, rectify, or erase personal data.</li>
        <li>Restrict or object to certain processing.</li>
        <li>Data portability (where processing is automated and based on consent or contract).</li>
        <li>Withdraw consent where processing is consent-based.</li>
        <li>Lodge a complaint with the ICO (UK) or your local supervisory authority.</li>
      </ul>
      <p>
        Athletes and staff should contact their <strong>club administrator</strong> first for data held on behalf of the club.
        You may also email <a href="mailto:privacy@apextrack.app">privacy@apextrack.app</a> and we will assist or redirect to the controller as appropriate.
      </p>

      <h2>9. Children</h2>
      <p>
        The platform may hold data on youth players managed by clubs. Clubs are responsible for parental/guardian consent and safeguarding policies.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update this policy. Material changes will be reflected on this page with an updated date. Continued use after changes constitutes notice.
      </p>
    </LegalPage>
  )
}
