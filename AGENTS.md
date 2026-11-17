# AGENTS.md — Antigravity Engineering & Design System Standards

This repository adheres to the **Antigravity Human-Quality Design Engineering Standards**.
Every agent operating in this repository must apply these principles whenever generating, modifying, reviewing, or styling code.

---

## The Four Core Tenets

### 1. Design & Art Direction (`taste-skill` + `impeccable`)
- **Intentional Art Direction First:** Before writing or changing frontend components, consult `DESIGN.md`. Do not default to arbitrary card grids, floating blurred backdrop blobs, or centered generic heroes.
- **Reference-Led Precision:** Ground layouts in verified financial design references (Mercury, Wise, Stripe, Revolut). Balance high-density numeric data with comfortable typography and clear hierarchy.
- **One System, Equal Edges:** Keep padding, margin steps, border radii, and visual weights consistent across every screen.
- **Craft-Floor Visual Standards:** Ensure explicit tactile states for every interactive component (`default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`).
- **No Hallucinated Visual Verification:** Never declare a UI polished, balanced, or responsive without inspecting the actual rendered output in a real browser session across mobile, tablet, and desktop viewports.

### 2. Engineering Restraint (`ponytail`)
- **Smallest Complete Change:** The best code is the code that never needed to be written. Implement the simplest, cleanest solution that fully satisfies requirements.
- **No Speculative Bloat:** Avoid unnecessary wrappers, nested abstractions, premature hook extractions, or duplicate helper utilities.
- **Strict Architecture Preservation:** Never replace working database, cryptographic, blockchain, or financial CRUD logic with placeholders, mocks, or demo shortcuts.
- **Maintain Production Security:** Keep SQL queries parameterized, preserve multi-tenant IDOR access checks, enforce strict password hashing and session revocation, and never expose secrets or credentials in logs or client-facing responses.

### 3. Natural Product Copy (`humanizer`)
- **Direct & Authentic Tone:** Use plain, precise, and domain-appropriate financial language.
- **Zero AI Clichés:** Eliminate robotic tells including:
  - Not-X-but-Y contrast formulas ("It's not just a budget, it's financial freedom")
  - Dramatic one-line closers and stage-setting openers
  - Forced rule-of-three adjective triads ("Fast, secure, and seamless")
  - Inflated marketing claims and unverified metric badges (e.g. "99.9% faster", "loved by 10M+ users")
  - Superficial filler and unnecessary introductory text
- **Preserve Technical & Financial Precision:** Keep cryptographic terminology (Merkle root, SHA-256, Ed25519, PBKDF2) and accounting semantics (reconciliation, liability, ledger balance, amortization) exact.

### 4. Verification & Quality Gates
Before concluding any frontend deliverable:
1. `npm run lint` (`tsc --noEmit`) must exit with code 0.
2. `npm test` (`tsx server/acceptance_production_readiness.ts`) must pass 100%.
3. `npm run test:crud` (`tsx server/tests/comprehensive_crud_acceptance_test.ts`) must pass 100%.
4. `npm run test:vercel` (`tsx server/test_vercel_registration_flow.ts`) must pass 100%.
5. `npm run build` (`vite build && esbuild server.ts ...`) must build cleanly.
6. Verify live in the browser across 6 target viewports:
   - Desktop: `1440×900`, `1280×800`
   - Tablet: `1024×768`, `768×1024`
   - Mobile: `390×844`, `360×800`
