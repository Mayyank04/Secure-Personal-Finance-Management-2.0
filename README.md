<div align="center">
  <h1>🛡️ AegisFinance</h1>
  <p><strong>Production-Ready, Enterprise-Grade Personal Finance Management & Ledger System</strong></p>
  <p>Engineered for high-security zero-trust finance tracking with durable PostgreSQL persistence, PBKDF2 authentication, RFC 6238 TOTP 2FA, explainable AI analytics, and a Fabric-Compatible Enterprise Ledger Simulation.</p>
</div>

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Root Cause & Auto-Logout Resolution](#root-cause--auto-logout-resolution)
3. [Prerequisites & Local Development](#prerequisites--local-development)
4. [Neon PostgreSQL & Vercel Production Setup](#neon-postgresql--vercel-production-setup)
   - [Step 1: Create a Neon PostgreSQL Project](#step-1-create-a-neon-postgresql-project)
   - [Step 2: Run Versioned Migrations](#step-2-run-versioned-migrations)
   - [Step 3: Configure Vercel Environment Variables](#step-3-configure-vercel-environment-variables)
   - [Step 4: Deploy to Vercel](#step-4-deploy-to-vercel)
   - [Step 5: Verify Liveness & Readiness Endpoints](#step-5-verify-liveness--readiness-endpoints)
   - [Step 6: Run Production Readiness Acceptance Tests](#step-6-run-production-readiness-acceptance-tests)
5. [End-to-End Manual Guide-Demo Walkthrough](#end-to-end-manual-guide-demo-walkthrough)
6. [Security & Cryptography Hardening](#security--cryptography-hardening)
7. [Automated Test Suites](#automated-test-suites)

---

## Architecture Overview

AegisFinance provides a dual-runtime persistence architecture:

```
┌────────────────────────────────────────────────────────┐
│                   Vite + React 19 Frontend             │
│        (Tailwind CSS, Recharts, Lucide, Web Workers)   │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS / REST API
┌──────────────────────────▼─────────────────────────────┐
│                 Express / Vercel API                   │
│  (Auth Middleware, Rate Limiting, Input Validation)    │
└──────────────────────────┬─────────────────────────────┘
                           │ IDatabaseAdapter
        ┌──────────────────┴──────────────────┐
        ▼                                     ▼
┌──────────────────────────┐     ┌──────────────────────────┐
│   PostgreSQL (Neon)      │     │    SQLite (sql.js)       │
│  • Production & Vercel   │     │  • Local dev & tests     │
│  • Connection Pooling    │     │  • Fully in-memory test  │
│  • Versioned Migrations  │     │    bench support         │
└──────────────────────────┘     └──────────────────────────┘
```

- **Database Abstraction (`IDatabaseAdapter`)**: All persistent application features (users, sessions, accounts, transactions, budgets, goals, bills, subscriptions, loans, receipts, notifications, audit events, tokens, rate limits) route through a repository abstraction layer.
- **Production Mode**: Driven exclusively by managed PostgreSQL (such as [Neon](https://neon.tech)). In-memory caches and ephemeral storage (`/tmp`) are never treated as authoritative data sources.
- **Ledger Audit**: Features a **Fabric-Compatible Enterprise Ledger Simulation** that hashes transactions into SHA-256 blocks with Merkle tree verification, detecting unauthorized off-chain database mutations without requiring external Hyperledger peer nodes.

---

## Root Cause & Auto-Logout Resolution

### Root Cause Analysis
Previously, when deployed to Vercel Serverless, the application stored its SQLite database file under `/tmp/data/aegis_finance.sqlite` and mirrored state in local JavaScript `Map` objects (`db.users`, `db.sessions`). 

Because Vercel serverless functions are ephemeral:
1. Serverless instances are spun down between invocations or scaled out horizontally.
2. A cold start on a new container spawned with an empty `/tmp` directory.
3. Even though the client presented a cryptographically valid HMAC session token, the authentication middleware looked up the user in the instance-local `db.users` map.
4. When the user was missing on the fresh worker, the API returned HTTP 401 `User account not found`.
5. The frontend's `api.ts` received this 401, emitted an unauthorized event, and `AuthContext.tsx` purged `fintech_session_token` from local storage, causing the user to be kicked to the login screen immediately upon refreshing or navigating.

### The Production Fix
- **Managed PostgreSQL Driver**: Added `@neondatabase/serverless` and `pg` with SSL connection pooling.
- **Durable Sessions & Tokens**: All sessions, user profiles, MFA tickets, email verification tokens, and password reset tokens are stored directly in PostgreSQL with indexed lookups and transactional updates.
- **Resilient Cold Starts**: `api/index.ts` initializes PostgreSQL with an idempotent, cached connection promise that safely recovers from transient network drops and prevents concurrent initialization races.
- **Targeted Auth Error Handling**: `AuthContext.tsx` and `src/lib/api.ts` only clear the session token on confirmed HTTP 401 Unauthorized responses with valid authentication rejection reasons, ignoring temporary 503 database reconnects or network interruptions.

---

## Prerequisites & Local Development

### Prerequisites
- **Node.js**: v18.x or later (v20+ recommended)
- **npm**: v9.x or later

### Local Setup
```bash
# 1. Clone repository
git clone https://github.com/Mayyank04/PABl-2CSE13-2410031570.git
cd Secure-Personal-Finance-Management-main

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env

# 4. Start local development server (runs with local SQLite by default)
npm run dev
```

The application is served at `http://localhost:3002`.

---

## Neon PostgreSQL & Vercel Production Setup

### Step 1: Create a Neon PostgreSQL Project
1. Log in to [Neon Console](https://console.neon.tech).
2. Click **New Project** and name it `aegisfinance-prod`.
3. Select your preferred cloud region (e.g., `AWS us-east-1` or `eu-central-1`).
4. In the Project Dashboard, copy your connection string. Ensure the **Pooled connection** toggle is checked (recommended for serverless environments):
   ```text
   postgresql://[user]:[password]@[host]-pooler.neon.tech/[dbname]?sslmode=require
   ```

### Step 2: Run Versioned Migrations
Apply versioned migrations to create the required schema, tables, foreign keys, and indexes:

```bash
# Set your Neon connection string in your shell or .env
export DATABASE_URL="postgresql://[user]:[password]@[host]-pooler.neon.tech/[dbname]?sslmode=require"

# Run migrations
npm run db:migrate
```

You will see:
```text
🚀 Running database migrations for AegisFinance...
Target: postgresql://[user]:****@[host]-pooler.neon.tech/[dbname]?sslmode=require
✅ Connected to PostgreSQL database.
[Migrations] Applying PostgreSQL migration: 001_initial_schema...
[Migrations] Applying PostgreSQL migration: 002_blockchain_ledger...
[Migrations] Applying PostgreSQL migration: 003_revoked_tokens...
[Migrations] Applying PostgreSQL migration: 004_auth_security_hardening...
✅ Successfully applied 4 migration(s): 001, 002, 003, 004
Current migration version: 004
```

> **Note**: Migrations are strictly non-destructive. Existing data will not be dropped or reset.

### Step 3: Configure Vercel Environment Variables
In your Vercel Project Dashboard under **Settings > Environment Variables**, add:

| Variable Name | Value Description | Example / Recommendations |
| :--- | :--- | :--- |
| `DATABASE_URL` | Neon pooled connection string | `postgresql://user:pass@ep-xyz-pooler.neon.tech/neondb?sslmode=require` |
| `SESSION_SECRET` | Strong random secret (≥ 32 chars) | Generate via `openssl rand -hex 32` |
| `NODE_ENV` | Environment identifier | `production` |
| `ALLOWED_ORIGINS` | Permitted browser origins | `https://your-domain.vercel.app` |
| `DEMO_MODE` | Sandbox data generator | `false` (set `true` only for staging sandboxes) |
| `GEMINI_API_KEY` | Optional: Gemini Cognitive Insights | Your Google AI Studio API key |

> ⚠️ **Critical Security Warning**: Never prefix server secrets with `VITE_`. Variables prefixed with `VITE_` are compiled into browser bundles.

### Step 4: Deploy to Vercel
```bash
# Using Vercel CLI:
vercel --prod

# Or push your changes to your linked GitHub repository:
git push origin main
```

### Step 5: Verify Liveness & Readiness Endpoints
Once deployed, verify the endpoints using `curl`:

#### 1. Liveness Probe (`/api/live`)
Confirms that the Vercel function runtime is active and responsive:
```bash
curl -i https://your-domain.vercel.app/api/live
```
```json
{
  "status": "ok",
  "uptime": 12.4,
  "timestamp": "2026-10-21T21:45:00.000Z"
}
```

#### 2. Readiness Probe (`/api/ready`)
Strictly tests the live connection to PostgreSQL and verifies schema migration status:
```bash
curl -i https://your-domain.vercel.app/api/ready
```
```json
{
  "status": "ok",
  "provider": "postgresql",
  "connected": true,
  "migrationVersion": "004",
  "timestamp": "2026-10-21T21:45:00.000Z"
}
```

> If `DATABASE_URL` is missing or the database is unreachable, `/api/ready` immediately returns **HTTP 503 Service Unavailable** with a diagnostic message without exposing database credentials.

---

## End-to-End Manual Guide-Demo Walkthrough

Follow this step-by-step verification script to test every core workflow in production:

1. **User Registration**:
   - Navigate to `https://your-domain.vercel.app`.
   - Click **Create Account** / **Register**.
   - Enter `john.doe@enterprise.com`, a secure password (e.g. `AegisSecure#2026!`), and your name.
   - Click **Sign Up**. Verify seamless transition to the Onboarding Dashboard.

2. **Browser Refresh Test (Cold Start / Auto-Logout Check)**:
   - Perform a hard refresh (`Cmd + Shift + R` or `Ctrl + F5`).
   - **Expected Outcome**: The user remains authenticated; no redirect to the login page occurs, and profile state persists smoothly without UI flickering.

3. **Add Account & Record Transaction**:
   - Navigate to **Accounts** > **Add Account**.
   - Create a Checking account (e.g., `Chase Premier Checking`, balance: `$10,000`).
   - Navigate to **Transactions** > **Add Expense**.
   - Add a transaction: `Client Business Dinner`, Amount: `$185.50`, Category: `Dining`.
   - **Expected Outcome**: The transaction is saved to PostgreSQL, account balance updates to `$9,814.50`, and a SHA-256 block hash is generated.

4. **Verify Budget & Dashboard Analytics**:
   - Navigate to **Budgets**. Observe the category allocation for `Dining` automatically reflects the `$185.50` spend.
   - Open **Dashboard**. Confirm that total spend, monthly cash flow, and net worth display the updated figures.

5. **AI Insights & Anomaly Detection**:
   - Click **AI Assistant** or **Cognitive Insights**.
   - Review the financial health composite score, cash flow forecast, and automated category confidence metric.

6. **Audit Trail & Blockchain Verification**:
   - Navigate to **Security & Audit**.
   - Inspect the Fabric-Compatible Ledger block list.
   - Confirm that the `Client Business Dinner` transaction appears with its block height, Merkle root, and SHA-256 digest.
   - Click **Verify Integrity** to confirm that the off-chain database record matches the cryptographically sealed ledger anchor.

7. **Logout & Session Revocation**:
   - Click the user profile icon > **Sign Out**.
   - Verify immediate redirection to the public Landing page.
   - Using browser dev tools or cURL, attempt to hit `/api/auth/me` with the previous token.
   - **Expected Outcome**: Returns HTTP 401 with `Token has been revoked`.

8. **Log In Again & Confirm Data Durability**:
   - Sign in using `john.doe@enterprise.com` and `AegisSecure#2026!`.
   - **Expected Outcome**: Login succeeds; previous accounts, transactions, budget tracking, and audit ledger entries are fully intact from PostgreSQL.

---

## Security & Cryptography Hardening

| Component | Implementation Standard |
| :--- | :--- |
| **Password Hashing** | PBKDF2 with HMAC-SHA512, 100,000 iterations, unique 16-byte random salt, constant-time `crypto.timingSafeEqual` comparison. |
| **Multi-Factor Auth (MFA)** | RFC 6238 TOTP (30-second window, ±1 timestep drift tolerance, single-use recovery codes, 100% offline SVG QR code generation). |
| **Session Control** | 64-character cryptographic tokens HMAC-signed with `SESSION_SECRET`, stored in PostgreSQL with indexed lookup and explicit revocation tracking. |
| **Multi-Tenant Isolation (IDOR)** | Every database query scopes `WHERE user_id = $1` to the authenticated caller's identity; prevents cross-tenant access. |
| **Rate Limiting** | Sliding window rate limiter tracking request keys (`ip:route` or `user:route`) stored directly in PostgreSQL. |
| **CORS Policy** | Whitelist-based origin reflection via `ALLOWED_ORIGINS`; prevents credential leaks to untrusted origins. |
| **Security Headers** | Strict `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy: camera=(self), microphone=(self), geolocation=()`. |

---

## Automated Test Suites

The repository contains automated test suites covering cryptography, persistence, IDOR isolation, and cold starts:

```bash
# 1. Run Production Readiness Acceptance Test Bench (35 Checks)
npm test

# 2. Run Comprehensive Enterprise Test Bench (20 Checks across Cryptography, SQLite, AI/ML, Blockchain)
npx tsx server/test_suite.ts

# 3. Run Full 55-Step End-to-End Acceptance Test
npx tsx server/e2e_acceptance_test.ts

# 4. Type Checking & Production Build Validation
npm run lint
npm run build
```

---

## License

This project is licensed under the MIT License.