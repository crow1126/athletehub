# ApexTrack Ghana 🇬🇭⚽

ApexTrack is a brand new, pioneering football club management and athlete performance platform designed specifically for the Ghanaian football ecosystem. As the first-of-its-kind digital solution in Ghana, ApexTrack empowers grassroots academies, semi-pro clubs, and professional teams to digitize their operations, optimize player performance, track medical lifecycles, and handle local financial transactions.

---

## 🌟 Core Features

- **Squad & Athlete Registry:** Complete player profiles including tactical positions, physical measurements, contract statuses, and coach assignments.
- **Injury Hub & Medical Lifecycle:** Track injuries from onset through treatment milestones, rehabilitation, and final medical/return-to-play clearance.
- **Performance Analytics:** Professional-grade match performance ratings, stats tracking (xG, xA, pass completion, etc.), and trend charts.
- **Scouting & Trial Module:** Track trialists, build scout sheets, and manage potential transfers and historical registry information.
- **Training & Match Scheduler:** Schedule team sessions with categorized types, venue bookings, duration tracking, and custom training notes.
- **Automated Reporting:** Generate comprehensive performance sheets, medical summaries, and transfer history reports for the club board and technical staff.

---

## 🔌 Moolre API Integration

To thrive in the Ghanaian environment, ApexTrack is deeply integrated with the **Moolre API**, providing essential local payment, notification, and interactive channels:

### 1. Mobile Money (MoMo) Billing
- **MTN MoMo, Telecel Cash, and Card Processing:** Clubs can easily upgrade or renew subscription tiers (Starting XI and Captain packages) directly via local mobile money wallets, ensuring a smooth and native checkout experience.

### 2. disbursements & Payouts (ApexPay)
- **Direct Wallet Transfers:** Club administrators can disburse funds, bonuses, or player support packages directly to coaches, staff, and athletes' MoMo wallets via Moolre's disbursement endpoint.

### 3. USSD Interactive Portal (`*920*...#`)
- **Offline Player Access:** Bridges the digital divide for players and academy students without stable internet. By dialing a shortcode routed to the `/api/webhooks/moolre-ussd` webhook, players can query:
  - Upcoming training details (Type, Date, Time, Venue)
  - Recent team session logs
  - Squad info

### 4. SMS Alerts & Notifications (VAS Gateway)
- **Automated Reminders:** Uses Moolre's VAS/SMS gateway (`ApexTrack` sender ID) to broadcast schedule updates, training call-ups, and recovery status messages to players and staff automatically.

---

## 🛠️ Technology Stack

- **Framework:** Next.js (App Router)
- **Database & Auth:** Supabase (PostgreSQL with Row Level Security)
- **Payment & Messaging Gateway:** Moolre API
- **Deployment:** Vercel

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Supabase project and credentials
- Moolre developer account credentials

### Installation
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env.local` file with the following variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

   MOOLRE_API_USER=your_moolre_user
   MOOLRE_PUBLIC_KEY=your_moolre_public_key
   MOOLRE_SECRET_KEY=your_moolre_secret_key
   MOOLRE_VAS_KEY=your_moolre_vas_key
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) to view the application.
