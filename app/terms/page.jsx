import LegalPage from '@/components/LegalPage'

export const metadata = {
  title: 'Terms of Service | ApexTrack',
  description: 'Terms and conditions governing the use of ApexTrack, including squad management and ApexPay features.',
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      subtitle="Please read these terms carefully before registering your club or using ApexTrack."
      lastUpdated="21 July 2026"
    >
      <p>
        By creating an account, initiating a trial, or using ApexTrack, you agree to be bound by these Terms of Service (&quot;Terms&quot;) on behalf of yourself and the sports club or organization you represent.
      </p>

      <h2>1. Services Offered</h2>
      <p>
        ApexTrack provides an integrated sports management platform covering squad analytics, injury logs, training schedules, scouting registries, contract tracking, performance reporting, and the <strong>ApexPay</strong> payroll disbursement system.
      </p>

      <h2>2. Account Registration &amp; Responsibilities</h2>
      <ul>
        <li>You must provide accurate, complete registration details and maintain updated contact information.</li>
        <li>Club administrators are responsible for managing user invitations, role assignments (Admin, Coach, Physio, Analyst), and promptly removing access for departing staff.</li>
        <li>You are responsible for ensuring that all data entered into the system—including athlete personal details and medical notes—has been collected legally with proper consent.</li>
        <li>You must keep account credentials strictly confidential and notify us immediately of any suspected unauthorized access.</li>
      </ul>

      <h2>3. Subscription, ApexPay &amp; Billing Terms</h2>
      <ul>
        <li><strong>Plans:</strong> ApexTrack offers tier-based plans including <em>Starting XI</em> (GHS 199/month) and <em>Captain</em> (GHS 499/month).</li>
        <li><strong>ApexPay Payroll:</strong> ApexPay features (wallet top-ups and Mobile Money payouts) are exclusively available on the Captain plan. Clubs are solely responsible for ensuring sufficient wallet funds and verifying correct MoMo recipient numbers prior to executing payroll disbursements.</li>
        <li><strong>Renewals &amp; Cancellations:</strong> Subscriptions renew automatically unless cancelled before the renewal date. Payments processed via Paystack or Moolre are non-refundable except where required by law.</li>
      </ul>

      <h2>4. Medical Disclaimer</h2>
      <p>
        ApexTrack is an operational management tool and does <strong>not</strong> provide medical diagnoses, treatment plans, or clinical decision making. Injury tracking records are for organizational coordination only. Medical decisions remain the sole responsibility of qualified medical professionals.
      </p>

      <h2>5. Acceptable Use Policy</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Attempt to access data belonging to other clubs or breach system security controls.</li>
        <li>Use the service for fraudulent financial transfers or unauthorized payment operations.</li>
        <li>Scrape, reverse engineer, or introduce malicious code into the platform.</li>
      </ul>

      <h2>6. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, ApexTrack is provided &quot;as is&quot; without warranties of any kind. We are not liable for indirect, incidental, or consequential damages resulting from platform downtime or incorrect data entries. Our total liability for any claim shall not exceed the fees paid by your club in the preceding 12 months.
      </p>

      <h2>7. Governing Law</h2>
      <p>
        These Terms shall be governed by and construed in accordance with the laws of the Republic of Ghana. Any disputes arising out of these Terms shall be subject to the jurisdiction of the courts of Ghana.
      </p>

      <h2>8. Contact &amp; Enquiries</h2>
      <p>
        For legal or support inquiries, contact us at <a href="mailto:admin@apextrackgh.com">admin@apextrackgh.com</a>.
      </p>
    </LegalPage>
  )
}
