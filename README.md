# 🥊 Fighters Token — Production Web Platform

A production-ready token-booking web platform (similar in UX to movie seat booking) built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Prisma ORM**, **PostgreSQL** (Supabase / Neon), **WhatsApp OTP Auth**, and **Razorpay Checkout**.

Matched to the dark-green header, numbered token grid, member name collection, live seat reservation hold mechanism, and comprehensive admin controls.

---

## 🌟 Key Features

1. **Movie-Seat Style Token Grid**:
   - Numbered 1 to N (default 80, configurable in Admin).
   - Clear visual statuses with accessible keyboard navigation:
     - 🟩 **AVAILABLE** (light green): Free to select.
     - 🟧 **SELECTED / HELD** (orange): Held in member's cart with an active **180-second** live countdown.
     - 🟥 **BOOKED** (red, unpaid): Confirmed by a member, pending payment.
     - 🟢 **PAID** (bright green): Verified and captured payment.
     - ⬜ **FROZEN** (grey): Blocked by admin; excluded from counts and random picks.
     - 🟪 **ADMIN-ASSIGNED** (purple badge): Assigned to a named person or patron.

2. **Timeout & Concurrency Engine**:
   - **Selection Hold**: 180 seconds server-side hold (`expires_at` timestamp). If not confirmed, server automatically releases the tokens back to AVAILABLE.
   - **Payment Window**: 240 seconds from when checkout is opened. Tokens remain locked to that member during checkout.
   - **Grace Extension**: If a Razorpay checkout is in progress at expiry, window extends by 600 seconds (once per attempt). Never extends if the member abandons the page.
   - **Race-Condition Safety**: Transactional atomic verification with row-level locking checks (`SELECT ... FOR UPDATE` / atomic version increment) prevents double-booking. Returns friendly *"just taken, please pick another"* message on conflicts.

3. **Payment Gating (Core Business Rule)**:
   - Payments are **DISABLED** by default until unlocked by the admin.
   - Automatically prompts unlock when all non-frozen tokens are booked (`X of N done`).
   - Admin can also manually open payments with a confirmation dialog and warning if opened early.
   - Live member status: *"Booked — payment opens when all tokens are booked (X of N done)."*

4. **Payments & Verified Refunds**:
   - Razorpay Checkout (UPI, PhonePe, GPay, Paytm, Cards, Netbanking).
   - Server-side HMAC SHA-256 cryptographic signature validation (both webhook & checkout return). Client is never trusted for payment status.
   - Admin can issue full Razorpay API refunds with automatic audit logging and instant release of tokens back to Available.

5. **Member Portal & Receipts**:
   - WhatsApp phone login with **India (+91)** and **UAE (+971)** country toggle and E.164 normalization.
   - Real-time grid updates (polled every 3 seconds for instant synchronization across all active viewers).
   - "My Tokens" page with booking breakdown, payment triggers, and cancel buttons for unpaid tokens.
   - Printable & downloadable **PDF Booking Receipt / Certificate** generated using `jspdf`.

6. **Admin Portal (`/admin`)**:
   - Protected with Email + Password + **TOTP 2FA** (Authenticator app with QR code).
   - **Live Stats Panel** with mathematical formulas and tooltips:
     $$\text{percentage\_booked} = \frac{\text{booked\_plus\_assigned}}{\text{total\_live} - \text{frozen}} \times 100$$
     - 10% threshold check: *"10% of N = X tokens required; currently Y booked (Z%); threshold met: yes/no"*.
     - Revenue expected vs. collected vs. pending.
     - Total refunds issued.
   - **Token Management**:
     - Dynamically set live token count (e.g. 80 to 100). Protects existing bookings.
     - Freeze / Unfreeze individual tokens or ranges (`1-10, 15, 20`).
     - Book on behalf of someone: enters name and picks $N$ tokens using cryptographically secure RNG (`crypto.randomInt`), logging entropy for audit.
     - 10% auto-assignment trigger rule.
   - **Member List & Export**:
     - Search and filter by status (All, Paid, Pending, Admin Assigned).
     - Export to CSV format.
   - **Audit Log Trail**: Complete ledger of every admin action, booking, payment, and refund.

---

## 🏗️ Folder Structure

```
├── .env.example              # Documented environment template
├── .gitignore                # Git ignore configuration
├── next.config.mjs           # Next.js configuration
├── package.json              # Project dependencies & scripts
├── postcss.config.mjs        # PostCSS configuration
├── prisma/
│   └── schema.prisma         # PostgreSQL schema (Sale, Token, Member, Booking, Payment, Refund, AuditLog)
├── scripts/
│   └── seed.mjs              # Seed script (Super admin + 80 tokens + default sale)
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── login/page.tsx # Admin 2FA login page
│   │   │   └── page.tsx       # Admin Portal dashboard & management
│   │   ├── api/
│   │   │   ├── admin/         # Admin API routes (tokens, freeze, assign, refund, stats, settings)
│   │   │   ├── auth/          # WhatsApp OTP auth & session management
│   │   │   ├── cron/cleanup/  # Auto-release expired holds & payment window cron
│   │   │   ├── payments/      # Razorpay order, verify, heartbeat, and webhook
│   │   │   └── tokens/        # Public token grid, hold, confirm, and cancel routes
│   │   ├── layout.tsx         # Root layout with "Fighters Token" metadata
│   │   ├── my-tokens/page.tsx # Member bookings, Razorpay checkout, PDF receipt download
│   │   └── page.tsx           # Main token grid landing page matching reference UI
│   ├── components/
│   │   ├── AdminStatsTooltip.tsx # Transparent calculation formula popup
│   │   ├── BookingSidebar.tsx    # Member name input, selection summary, confirm button
│   │   ├── Header.tsx            # Dark green header matching reference UI
│   │   ├── HoldCountdown.tsx     # 180s live selection hold timer
│   │   ├── Legend.tsx            # Status badge legend (Available, Selected, Booked, Paid, etc.)
│   │   ├── OtpModal.tsx          # WhatsApp OTP modal with India/UAE toggle
│   │   └── TokenGrid.tsx         # Responsive 80-token movie-seat style grid
│   ├── lib/
│   │   ├── auth.ts            # JWT session signing & cookie handlers (jose)
│   │   ├── db.ts              # PrismaClient singleton
│   │   ├── otp.ts             # E.164 normalization & OTP delivery (DEMO/MSG91/Twilio)
│   │   ├── pdf.ts             # PDF receipt generator (jsPDF)
│   │   └── razorpay.ts        # Razorpay API client & webhook signature verifier
│   └── services/
│       ├── stats.ts           # Transparent stats formulas & threshold calculations
│       └── token-engine.ts    # Concurrency, holds, crypto.randomInt RNG assignment
├── tests/
│   ├── concurrency.test.ts    # Unit tests for holds & conflict safety
│   ├── rng.test.ts            # Unit tests for cryptographic random token allocation
│   └── stats.test.ts          # Unit tests for percentage & 10% threshold formulas
├── vercel.json               # Vercel build command & cron schedules
└── vitest.config.ts          # Vitest unit test configuration
```

---

## 🚀 Local Development Setup

### 1. Prerequisites
- **Node.js**: v18.17+ (v20+ recommended)
- **PostgreSQL**: Local Postgres OR Supabase / Neon database URL

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `DATABASE_URL`, `JWT_SECRET`, and `ADMIN_SESSION_SECRET` are set.
> **Note**: In local development, `OTP_PROVIDER="DEMO"` provides test OTP code `123456` and displays the code on screen so you can test phone login immediately without SMS provider setup.

### 4. Database Setup & Seeding
Push the schema to your database:
```bash
npx prisma db push
```
Run the seed script to create the initial admin and 80 tokens:
```bash
npm run db:seed
```

### 5. Run Unit Tests
```bash
npm test
```
All 14 tests for formulas, cryptographic RNG, and concurrency conflicts will execute and pass.

### 6. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the Fighters Token platform.

---

## 💳 Razorpay Setup & Payment Flow

### Razorpay Test Mode
1. Sign in to your [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Navigate to **Settings → API Keys**.
3. Generate a Test Key pair (`rzp_test_...` and Key Secret).
4. Add them to `.env`:
   ```env
   NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_test_YOUR_KEY"
   RAZORPAY_KEY_SECRET="YOUR_SECRET"
   ```

### Webhook Configuration
1. Go to **Settings → Webhooks → Add New Webhook**.
2. **Webhook URL**: `https://your-domain.vercel.app/api/payments/webhook`
3. **Secret**: Enter a secure random string and add to `.env` as `RAZORPAY_WEBHOOK_SECRET`.
4. **Active Events**:
   - `order.paid`
   - `payment.captured`
   - `payment.failed`
   - `refund.processed`

---

## ☁️ Deploying to Vercel + Supabase

### Step 1: Create Supabase PostgreSQL Database
1. Go to [Supabase](https://supabase.com) and create a new project.
2. Under **Project Settings → Database → Connection String**, copy:
   - **Transaction Pooler** (port 6543) for `DATABASE_URL`
   - **Session Direct Connection** (port 5432) for `DIRECT_URL`

### Step 2: Push Schema to Supabase
```bash
DATABASE_URL="postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true" npx prisma db push
DATABASE_URL="postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true" npm run db:seed
```

### Step 3: Deploy to Vercel
1. Push your Git repository to GitHub.
2. In [Vercel Dashboard](https://vercel.com), click **Add New → Project** and import the repository.
3. In **Environment Variables**, add:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `JWT_SECRET` (generate with `openssl rand -hex 32`)
   - `ADMIN_SESSION_SECRET` (generate with `openssl rand -hex 32`)
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_WEBHOOK_SECRET`
   - `OTP_PROVIDER` (`DEMO`, `MSG91`, or `TWILIO`)
   - `ADMIN_INITIAL_EMAIL` (default: `admin@fighterstoken.com`)
   - `ADMIN_INITIAL_PASSWORD`
4. Click **Deploy**. Vercel will run `prisma generate && next build` and deploy your app.

---

## 🔐 Creating the First Admin & 2FA Setup

1. The initial admin is created by `npm run db:seed`:
   - **Email**: `admin@fighterstoken.com`
   - **Password**: `AdminFighters@2026!` (or value configured in `ADMIN_INITIAL_PASSWORD`)
2. Go to `/admin/login` and log in with the credentials.
3. In `/admin`, you can set up TOTP Two-Factor Authentication using Google Authenticator, Authy, or 1Password via the setup endpoint (`/api/admin/totp/setup`).

---

## ✅ Go-Live Checklist

Before accepting real payments from members:
- [ ] **Switch Razorpay to Live**: In Razorpay Dashboard, switch to Live mode, generate Live Key ID (`rzp_live_...`) and Secret, and update Vercel environment variables.
- [ ] **Configure Live Webhook**: Set the webhook URL to `https://[your-app].vercel.app/api/payments/webhook` with secret.
- [ ] **Verify Cron Job**: Check Vercel Dashboard → Project → Settings → Cron Jobs to ensure `/api/cron/cleanup` runs every minute to release expired holds.
- [ ] **Test Real Small Payment**: Set token price to ₹1 in Admin Portal settings, complete a real payment with UPI / GPay, verify that status changes to PAID and PDF receipt is downloadable.
- [ ] **Verify Refund Flow**: In Admin Portal → Members, click "Refund" on the test payment and verify funds are refunded in Razorpay.
- [ ] **Reset Campaign**: Freeze any reserved test tokens or re-seed the sale with final token count and price.
