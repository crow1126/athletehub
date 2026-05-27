import LegalPage from '@/components/LegalPage'

export const metadata = {
  title: 'Security & Data Protection | Apex Track',
  description: 'How Apex Track protects club and athlete data, including GDPR posture and infrastructure practices.',
}

export default function SecurityPage() {
  return (
    <LegalPage
      title="Security & Data Protection"
      subtitle="Transparent overview of how we protect sensitive athlete and club data — without overpromising enterprise guarantees we have not independently certified."
      lastUpdated="27 May 2026"
    >
      <p>
        Apex Track handles performance metrics and, in many clubs, injury and medical notes. We take that responsibility seriously.
        This page explains our approach in plain language. It is not a contractual SLA unless separately agreed in writing.
      </p>

      <h2>Club data isolation</h2>
      <p>
        Apex Track uses a <strong>shared PostgreSQL database</strong> with <strong>Row Level Security (RLS)</strong> policies tied to each user&apos;s club (<code>team_id</code>).
        Every query from the application is scoped so staff only see athletes, injuries, and records belonging to their organisation — unless they hold a platform superadmin role.
      </p>
      <p>
        This is <strong>logical isolation</strong> enforced at the database layer, not separate physical databases per club. It is a proven pattern on Supabase/PostgreSQL,
        but like all software it depends on correct policy design, testing, and secure application code. We do not claim &quot;military-grade&quot; or &quot;zero-risk&quot; isolation.
        Clubs with exceptional regulatory needs should discuss custom arrangements with us.
      </p>

      <h2>Encryption &amp; access control</h2>
      <ul>
        <li><strong>In transit:</strong> All web traffic uses HTTPS (TLS).</li>
        <li><strong>At rest:</strong> Database and storage encryption is provided by our cloud host (Supabase).</li>
        <li><strong>Authentication:</strong> Supabase Auth with JWT sessions; passwords hashed by the auth provider.</li>
        <li><strong>Authorisation:</strong> Role-based access (superadmin, admin, coach, analyst) plus RLS on tenant tables.</li>
        <li><strong>Staff accounts:</strong> Password changes for staff are managed by club administrators to reduce credential sprawl.</li>
      </ul>

      <h2>GDPR &amp; UK data protection</h2>
      <p>We support clubs operating under UK GDPR and EU GDPR by:</p>
      <ul>
        <li>Hosting primary infrastructure in <strong>EU West (London)</strong> where configured.</li>
        <li>Providing a <a href="/privacy">Privacy Policy</a> describing processing, sub-processors, and individual rights.</li>
        <li>Acting as a <strong>processor</strong> for athlete data entered by clubs (who act as <strong>controllers</strong>).</li>
        <li>Responding to data subject requests via <a href="mailto:privacy@apextrack.app">privacy@apextrack.app</a> and coordinating with club admins.</li>
      </ul>
      <p>
        We do not replace your club&apos;s obligation to maintain lawful bases, privacy notices to players, or Data Processing Agreements where required.
        Enterprise clubs may request a DPA template by email.
      </p>

      <h2>Backups &amp; recovery</h2>
      <p>
        Database backups are managed by <strong>Supabase</strong> as part of hosted PostgreSQL. Backup frequency and point-in-time recovery depend on the Supabase project plan.
        We recommend clubs export critical reports periodically. In a disaster scenario, recovery timelines depend on provider status and the nature of the incident — we do not guarantee a specific RPO/RTO on standard plans.
      </p>

      <h2>Uptime &amp; monitoring</h2>
      <p>
        The application is deployed on <strong>Vercel</strong>; the database on <strong>Supabase</strong>. We monitor for errors and aim to restore service quickly after outages.
        We do <strong>not</strong> currently publish a public status page or financially backed uptime SLA for all customers. Planned maintenance will be communicated when practicable.
      </p>

      <h2>Security reviews &amp; audits</h2>
      <p>
        Our underlying infrastructure providers (e.g. Supabase, Vercel) maintain their own security certifications and audits.
        Apex Track as an application has <strong>not</strong> completed an independent SOC 2 or ISO 27001 certification at this time.
        We follow secure development practices, review access to production systems, and prioritise fixes for reported vulnerabilities.
      </p>

      <h2>Incident response</h2>
      <p>
        If you suspect unauthorised access to your club account or a data breach, contact{' '}
        <a href="mailto:privacy@apextrack.app">privacy@apextrack.app</a> immediately with &quot;Security incident&quot; in the subject line.
        We will investigate, contain, and notify affected controllers where legally required.
      </p>

      <h2>Your role as a club</h2>
      <ul>
        <li>Use strong, unique passwords and remove access for departing staff promptly.</li>
        <li>Only enter health data you are authorised to store.</li>
        <li>Review role assignments regularly.</li>
        <li>Report suspected issues without delay.</li>
      </ul>

      <h2>Related documents</h2>
      <p>
        <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a>
      </p>
    </LegalPage>
  )
}
