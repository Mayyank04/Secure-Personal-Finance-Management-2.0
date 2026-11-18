# CipherLedger AI — Secure Personal Finance Management System

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=flat-square&logo=typescript)
![React](https://img.shields.io/badge/React-19.0-61dafb?style=flat-square&logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791?style=flat-square&logo=postgresql)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square&logo=vercel)
![Security Tests](https://img.shields.io/badge/Acceptance%20Tests-35%2F35%20PASS-emerald?style=flat-square)
![CRUD Tests](https://img.shields.io/badge/CRUD%20Tests-79%2F79%20PASS-emerald?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-gray?style=flat-square)

**Production-grade, privacy-first personal finance platform combining multi-account net worth tracking, predictive AI financial analytics, and a zero-PII cryptographic SHA-256 Merkle-tree blockchain audit log.**

[Live Application](https://secure-personal-finance-management-eight.vercel.app/) • [API Documentation (Swagger)](https://secure-personal-finance-management-eight.vercel.app/api/docs) • [Technical Note](./TECHNICAL_NOTE.md) • [Design System](./DESIGN.md)

</div>

---

## Table of Contents
1. [Visual Showcase](#visual-showcase)
2. [Executive Overview](#executive-overview)
3. [Architecture Overview](#architecture-overview)
4. [Database Provider & Serverless Persistence](#database-provider--serverless-persistence)
5. [Core Features](#core-features)
6. [Security & Cryptography Hardening](#security--cryptography-hardening)
7. [Prerequisites & Local Installation](#prerequisites--local-installation)
8. [Production Deployment (Vercel & Supabase)](#production-deployment-vercel--supabase)
9. [Automated Verification Bench](#automated-verification-bench)
10. [Legal & Compliance](#legal--compliance)

---

## Visual Showcase

Every screenshot below is captured from the running application using synthetic demonstration data.

### 1. Unified Net Worth & Liquidity Dashboard
Aggregated multi-account financial telemetry, portfolio asset allocation, monthly cash-flow pacing, and quick actions.
![CipherLedger AI Operational Dashboard](docs/screenshots/dashboard.png)

### 2. Transaction Management & Ledger Anchoring
Categorized expense and income tracking with real-time balance calculations and cryptographic hash generation.
![Transactions Ledger Table](docs/screenshots/transactions.png)

### 3. Category Budgets & Savings Goals
Progress indicators, automated spend pacing, dynamic limits, and goal contribution tracking.
![Category Budgets and Savings Goals](docs/screenshots/budgets-goals.png)

### 4. Predictive AI Financial Advisor
Burn-rate optimization, automated anomaly detection, smart category confidence scores, and cash-flow forecasting.
![Predictive AI Financial Advisor](docs/screenshots/ai-insights.png)

### 5. Cryptographic Blockchain Audit Log
Tamper-proof SHA-256 Merkle chain verification, block height tracking, and real-time ledger consistency proof.
![Cryptographic Blockchain Audit Ledger](docs/screenshots/audit-ledger.png)

### 6. Responsive Mobile Experience
Tested at 390×844 and 360×800 with an on-demand slide-out drawer, touch targets, and zero horizontal overflow.
![Responsive Mobile Viewport](docs/screenshots/mobile-view.png)

---

## Executive Overview

Personal financial data is typically fragmented across banking portals, budgeting spreadsheets, and third-party apps, making it difficult to maintain a reliable overview while preserving data privacy.

**CipherLedger AI** solves this by delivering an institutional-grade personal finance platform that guarantees:
- **Zero-PII On-Chain Hashing:** Transactions are anchored into an immutable SHA-256 block ledger with Merkle tree verification without exposing personal names or raw financial identifiers.
- **Durable Serverless Persistence:** Managed PostgreSQL connection pooling eliminates auto-logout and session desynchronization across Vercel cold starts.
- **Client-Side Privacy:** Financial receipt processing is executed entirely in-browser using client-side Tesseract.js OCR.
- **Predictive Intelligence:** Explainable AI forecasting and risk detection that alerts users before budget thresholds are breached.

---

## Architecture Overview

CipherLedger AI decouples frontend presentation, stateless API routing, and transactional persistence:

```
┌────────────────────────────────────────────────────────┐
│               Vite + React 19 Client                   │
│   (Tailwind CSS v4, Recharts, Lucide, Web Workers)     │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS / REST / JSON
┌──────────────────────────▼─────────────────────────────┐
│          Express / Vercel Serverless API               │
│   (Auth Middleware, Tenant Scoping, Rate Limiting)     │
└──────────────────────────┬─────────────────────────────┘
                           │ IDatabaseAdapter
        ┌──────────────────┴──────────────────┐
        ▼                                     ▼
┌──────────────────────────┐     ┌──────────────────────────┐
│  PostgreSQL (Supabase)   │     │    SQLite (sql.js)       │
│ • Production & Vercel    │     │ • Local dev & unit tests │
│ • Transaction Pooler     │     │ • Zero-setup in-memory   │
│ • 4 Versioned Migrations │     │   test execution         │
└──────────────────────────┘     └──────────────────────────┘
```

- **Repository Abstraction (`IDatabaseAdapter`)**: All application entities (users, accounts, transactions, budgets, goals, bills, subscriptions, loans, tokens) operate through a typed interface.
- **Cryptographic Audit Layer**: Transactions generate a SHA-256 block entry linked to the previous block's digest, providing mathematical tamper evidence if database records are modified out of band.
- **OpenAPI 3.1 & Swagger**: Interactive OpenAPI documentation is served natively at `/api/docs`.

---

## Database Provider & Serverless Persistence

### Actual Production Provider: Supabase PostgreSQL
Production environments use **PostgreSQL hosted on Supabase** (using the AWS ap-south-1 Transaction/Session Pooler with SSL connection pooling via `pg.Pool`).

- **Root Cause of Ephemeral Disconnections:** Standard serverless functions on Vercel spin down between requests; relying on local SQLite under `/tmp` causes state loss on cold starts.
- **The Production Fix:** All user sessions, revoked token blacklists, accounts, and financial entities persist durably in PostgreSQL with indexed lookups (`WHERE user_id = $1`).
- **Development Fallback:** Local development automatically uses in-memory/disk SQLite when `DATABASE_URL` is omitted, enabling instant offline development.

---

## Core Features

| Module | Functional Capability |
| :--- | :--- |
| **Accounts** | Unified multi-account tracking across Checking, Savings, Credit, Investment, and Crypto with real-time net worth calculation. |
| **Transactions** | Complete CRUD with category filters, sort controls, and atomic balance updates. |
| **Budgets** | Period-based spending allocations with derived actual spending and progress bars. |
| **Savings Goals** | Milestone targets with atomic contribution cascade and completion estimates. |
| **Bills & Subscriptions** | Recurring liability calendar with atomic one-click settlement and pause/resume lifecycle. |
| **Debt Tracker & Loans** | Principal reduction tracking, interest rate recording, and payment amortization. |
| **Blockchain Audit** | Merkle root validation, SHA-256 block chain integrity checks, and tamper simulation laboratory. |
| **AI Advisor** | Cognitive cash-flow forecasting, risk analysis, and burn-rate telemetry. |
| **KYC Verification** | Identity document validation with role-based privilege controls preventing self-approval. |
| **Product Walkthrough** | 5-step interactive tour guiding users through operational application workflows. |

---

## Security & Cryptography Hardening

- **Password Hashing:** PBKDF2 with HMAC-SHA512, 100,000 iterations, unique 16-byte cryptographically secure salt, and constant-time `crypto.timingSafeEqual` comparison.
- **Session Durability:** 64-character HMAC-signed session tokens verified against PostgreSQL with explicit revocation tracking in `revoked_tokens`.
- **Tenant Isolation (IDOR):** Every query enforces parameterized tenant scoping (`WHERE user_id = $1`). User B cannot read or modify User A's financial records.
- **Security Headers:** Strict Content Security Policy (`CSP`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and strict CORS origin reflection.
- **Zero-PII Merkle Audit:** Only transaction hash digests and timestamp anchors are written to the cryptographic block log.

---

## Prerequisites & Local Installation

### Prerequisites
- **Node.js**: `v20.x` or later (tested on `v24.15.0`)
- **npm**: `v9.x` or later
- **FFmpeg**: Required only for generating launch videos (`brew install ffmpeg` on macOS)

### Quickstart
```bash
# 1. Clone the repository
git clone https://github.com/Mayyank04/Secure-Personal-Finance-Management-2.0.git
cd Secure-Personal-Finance-Management-2.0

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env

# 4. Start local development server (SQLite default)
npm run dev
```

The application will be accessible at `http://localhost:3002`.

---

## Production Deployment (Vercel & Supabase)

### 1. Database Migrations
Set your Supabase PostgreSQL connection string and execute versioned schema migrations:
```bash
export DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require"
npm run db:migrate
```

### 2. Vercel Environment Variables
In your Vercel Project Settings, add:
- `DATABASE_URL`: Your pooled Supabase PostgreSQL connection string.
- `SESSION_SECRET`: A 32+ character random secret (generated via `openssl rand -hex 32`).
- `NODE_ENV`: `production`
- `ALLOWED_ORIGINS`: `https://your-deployment.vercel.app`
- `DEMO_MODE`: `false` (or `true` for public staging demos)

---

## Automated Verification Bench

Execute the full suite of deterministic automated tests:

```bash
# 1. Type Checking & Static Linting (0 errors)
npm run lint

# 2. Production Readiness Acceptance Bench (35/35 checks)
npm test

# 3. Comprehensive CRUD & API Acceptance Tests (79/79 checks)
npm run test:crud

# 4. Vercel Serverless Registration & Session Test (8/8 checks)
npm run test:vercel

# 5. Production Build (Vite + esbuild)
npm run build

# 6. Generate 20-Second Promotional Launch Video (BRAG Automation)
npm run brag
```

---

## Legal & Compliance

CipherLedger AI includes dedicated transparency and legal pages accessible via the navigation bar and footer:
- **[Terms of Service](src/components/legal/TermsOfServiceView.tsx):** Explicit disclaimers noting the academic demonstration context and non-fiduciary status.
- **[Privacy Policy](src/components/legal/PrivacyPolicyView.tsx):** Comprehensive explanation of local OCR processing, zero-PII on-chain hashing, and data deletion rights.

---

## License

This project is licensed under the [MIT License](LICENSE).
