# DESIGN.md — CipherLedger AI Design System Specification

> Institutional cryptographic security meets high-precision personal finance.
> Benchmarked against **Mercury**, **Stripe**, **Wise**, and **Linear** design architectures from `awesome-design-md`.

---

## 1. Brand Positioning
CipherLedger AI is an institutional-grade, personal financial operating system backed by cryptographic blockchain auditability (Merkle tree integrity, Ed25519 signatures) and explainable AI intelligence. The visual identity conveys authority, mathematical precision, transparent auditability, and quiet confidence.

---

## 2. Visual Design Philosophy
1. **Precision Over Decoration:** Data is the primary interface. Every pixel serves numeric comprehension, asset tracking, or cryptographic verification.
2. **Tabular Numerics First:** Every financial amount, percentage, rate, and timestamp uses monospaced tabular figures (`tabular-nums`) to prevent optical wobble during calculations.
3. **Restrained Color Vocabulary:** Color indicates financial polarity (positive/asset vs negative/liability) or cryptographic state (anchored vs pending). Backgrounds and structural panels remain neutral slates and dark canvases.
4. **Equal Edges and Spatial Rhythm:** Spacing follows a strict 4px/8px modular scale. Component paddings, card insets, and table cell heights are consistent across every view.
5. **No AI Gimmicks:** Strict prohibition of floating glowing blur blobs, ornamental Lucide icon clutter, fake metric badges, and cartoonish 3D illustrations.

---

## 3. Typography System
- **Display & Headings:** `Inter`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `sans-serif`
  - Font weights: Medium (`500`) for headers, Semi-Bold (`600`) for structural labels.
  - Tracking: Tight letter-spacing on display headers (`-0.02em` to `-0.01em`).
- **Body & Controls:** `Inter`, `system-ui`, `sans-serif`
  - Font weights: Regular (`400`) and Medium (`500`).
  - Leading: `1.5` for editorial reading, `1.2` for compact data labels.
- **Financial Numbers & Code/Hashes:** `JetBrains Mono`, `ui-monospace`, `SFMono-Regular`, `Menlo`, `monospace`
  - Always rendered with `font-variant-numeric: tabular-nums lining-nums`.

---

## 4. Font Sizes & Hierarchy

| Token | Size | Line Height | Weight | Tracking | Usage |
|---|---|---|---|---|---|
| `text-display` | `32px` (`2rem`) | `1.15` | `600` | `-0.025em` | Hero metrics & top net balance |
| `text-h1` | `24px` (`1.5rem`) | `1.2` | `600` | `-0.02em` | View titles & primary drawer heads |
| `text-h2` | `18px` (`1.125rem`)| `1.25` | `600` | `-0.015em` | Section headers & modal titles |
| `text-h3` | `15px` (`0.9375rem`)| `1.3` | `600` | `-0.01em` | Panel titles & table category groups |
| `text-body` | `14px` (`0.875rem`)| `1.5` | `400` | `0` | Standard body prose, inputs, table cells |
| `text-body-sm`| `13px` (`0.8125rem`)| `1.4` | `400` | `0` | Secondary descriptions, helper text |
| `text-caption`| `11px` (`0.6875rem`)| `1.3` | `500` | `+0.04em` | Uppercase table headers, badges, hashes |

---

## 5. Spacing Scale
Based on an 8pt grid with 4pt half-steps:
- `space-1`: `4px` (inline tag gaps, icon-to-label spacing)
- `space-2`: `8px` (button vertical padding, tight item stacks)
- `space-3`: `12px` (input padding, compact table cell padding)
- `space-4`: `16px` (standard card padding, grid gutters)
- `space-6`: `24px` (section gaps, modal interior margins)
- `space-8`: `32px` (view-level section divisions)
- `space-12`: `48px` (primary view page gutters on desktop)

---

## 6. Color Palette & Semantic Tokens

### Canvas & Surfaces (Dark-First FinTech Theme)
- `bg-canvas`: `#0a0d14` (Deep obsidian dark base)
- `bg-surface`: `#111622` (Primary card and panel surface)
- `bg-surface-raised`: `#182030` (Modals, popovers, dropdown menus)
- `bg-surface-hover`: `#1e293b` (Hover state for rows and clickable cards)
- `border-subtle`: `#1e293b` (Hairline component and table borders)
- `border-strong`: `#334155` (Active inputs, focused cards, emphasized dividers)

### Text & Foregrounds
- `text-primary`: `#f8fafc` (Slate 50 — primary metrics and active headers)
- `text-secondary`: `#94a3b8` (Slate 400 — descriptive copy and labels)
- `text-muted`: `#64748b` (Slate 500 — timestamps, unit indicators, table headers)
- `text-disabled`: `#475569` (Slate 600 — inactive toggles, disabled inputs)

### Brand & Interactive Accents
- `accent-primary`: `#4f46e5` (Indigo 600 — primary actions)
- `accent-primary-hover`: `#4338ca` (Indigo 700)
- `accent-primary-subtle`: `rgba(79, 70, 229, 0.12)` (Pill backgrounds, active tabs)

### Financial Polarity Tokens
- `finance-positive`: `#10b981` (Emerald 500 — Income, Asset growth, Merkle Verified)
- `finance-positive-bg`: `rgba(16, 185, 129, 0.1)`
- `finance-negative`: `#f43f5e` (Rose 500 — Expense, Liabilities, Overdraft alert)
- `finance-negative-bg`: `rgba(244, 63, 94, 0.1)`
- `finance-warning`: `#f59e0b` (Amber 500 — Upcoming bills, budget at 85%)
- `finance-warning-bg`: `rgba(245, 158, 11, 0.1)`
- `finance-info`: `#0ea5e9` (Sky 500 — AI forecast trajectories)
- `finance-info-bg`: `rgba(14, 165, 233, 0.1)`

---

## 7. Background & Surface Treatment
- Solid matte surfaces with low-contrast structural borders (`1px solid #1e293b`).
- Zero generic glassmorphic blur stacks (`backdrop-blur-md bg-white/5` removed).
- No radial gradient background glow spotlights behind data metrics.

---

## 8. Borders & Shadows
- **Corner Radii:**
  - Micro (`rounded-sm`): `4px` (tags, badge pills, table chips)
  - Element (`rounded-md`): `6px` (buttons, inputs, select triggers)
  - Surface (`rounded-lg`): `8px` (cards, modals, dropdown panels)
  - Never exceed `8px` on financial tables and dense numeric panels.
- **Shadows:**
  - `shadow-subtle`: `0 1px 2px 0 rgba(0, 0, 0, 0.4)`
  - `shadow-elevated`: `0 4px 16px -2px rgba(0, 0, 0, 0.6), 0 0 0 1px #1e293b` (modals only)

---

## 9. Button Specifications
- **Primary:** `bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3.5 py-1.5 rounded-md transition-colors text-sm`
- **Secondary:** `bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm px-3.5 py-1.5 rounded-md`
- **Ghost:** `hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 text-sm px-2.5 py-1.5 rounded-md`
- **Destructive:** `bg-rose-950/40 text-rose-300 border border-rose-800/50 hover:bg-rose-900/40 text-sm px-3.5 py-1.5 rounded-md`
- **Focus Rings:** `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900`

---

## 10. Input & Form Specifications
- Height: `36px` (`h-9`) for compact desktop speed.
- Padding: `px-3 py-1.5`.
- Background: `#0e131f`, Border: `1px solid #1e293b`.
- Typography: `text-sm text-slate-100 placeholder:text-slate-500`.
- Active/Focus: `border-indigo-500 ring-1 ring-indigo-500 bg-[#111726]`.
- Currency Prefix: Built-in fixed currency symbol badge (`₹` or `$`) at `text-slate-400 text-xs select-none`.

---

## 11. Navigation Patterns
- Left persistent vertical sidebar (`w-60` desktop, slide-out drawer on mobile).
- Icon + Label lockup: 16px functional icon paired with 13px medium label.
- Active Nav Item: Left indicator border or solid subtle background fill (`bg-indigo-950/40 text-indigo-300 border-l-2 border-indigo-500`).
- Top Bar: System status pills (Database sync, Merkle Ledger height, Active user, Currency selector).

---

## 12. Dashboard Layout Rules
- **Header:** Date range context + Quick action triggers (Add Transaction, Import CSV, Run AI Scan).
- **Metric Row (KPI Ribbon):** 4 standardized cards: Net Worth / Liquid Assets / Monthly Outflow / Financial Health Score.
- **Main Split Grid:**
  - Left Column (65% width): Primary Cash Flow Chart & Recent Ledger Transactions.
  - Right Column (35% width): AI Anomaly Feeds, Upcoming Obligations, and Budget Utilization.

---

## 13. Chart & Data Visualization Rules
- Color Palette: Monochrome grid lines (`#1e293b`), muted axis labels (`#64748b`), single-accent area curves (`#4f46e5` with 0.1 alpha fill).
- Tooltips: Dark opaque rectangular popover (`bg-slate-900 border border-slate-700 shadow-xl px-3 py-2 text-xs rounded`).
- Always show absolute currency values in tooltips, never raw unformatted numbers.

---

## 14. Table Design
- Headers: `h-8 text-[11px] uppercase tracking-wider font-semibold text-slate-400 bg-slate-900/60 border-b border-slate-800 px-3`.
- Cell Heights: Compact `40px` (`h-10`) rows.
- Alternating/Hover: Subtle row highlight on hover (`hover:bg-slate-800/40`).
- Currency Columns: **Always right-aligned** with tabular figures (`text-right font-mono text-sm`).
- Date Columns: Standard ISO/Compact formatting (`YYYY-MM-DD` or `MMM DD, YYYY`).

---

## 15. Modal & Dialog Behavior
- Backdrop: Deep solid overlay (`bg-black/75`).
- Positioning: Centered on desktop, bottom-sheet on screens `< 640px`.
- Max Widths: `max-w-md` for quick confirm / delete, `max-w-xl` for complex financial forms.
- Keyboard support: Escape closes, Tab traps focus inside modal.

---

## 16. Responsive Breakpoints
- `sm`: `640px` (single-column cards stack, mobile navbar triggers)
- `md`: `768px` (2-column grids, bottom navigation available)
- `lg`: `1024px` (standard desktop sidebar pinned)
- `xl`: `1280px` (wide desktop multi-column analytics)
- `2xl`: `1536px` (maximum content container lock at `1440px` with centered auto-margins)

---

## 17. Accessibility Requirements
- Text contrast ratios exceed WCAG AA (`4.5:1` for regular text, `3:1` for large numbers).
- Fully accessible focus states (`focus-visible:ring-2`).
- Semantic HTML tags (`<main>`, `<nav>`, `<aside>`, `<header>`, `<table>`, `<th>`, `<td>`).
- Aria labels for icon-only action buttons.

---

## 18. Motion & Interaction Principles
- Transition Duration: Quick, crisp micro-interactions (`150ms` to `200ms ease-out`).
- No bouncy, playful spring animations.
- Fade and subtle 2px Y-translation on modal entrances.

---

## 19. Component Conventions
- Stateless presentation components separated from data queries.
- Consistent empty state template: Minimal SVG icon, 14px bold title, 13px helper explanation, primary CTA button.
- Strict badge status component: `Verified` (Emerald), `Pending` (Amber), `Overdue` (Rose), `Simulated` (Indigo).

---

## 20. Explicit Anti-Patterns (Slop Checklist)
❌ No glowing radial blur circles behind containers.  
❌ No centered generic heroes ("All-in-one AI platform to supercharge your finances").  
❌ No arbitrary 3-card marketing features on operational software screens.  
❌ No rounded pill tags with 5 different arbitrary neon colors.  
❌ No decorative icons before every single sentence.  
❌ No ungrounded statistics or fabricated testimonial avatars.  
❌ No low-contrast gray text on dark surfaces failing accessibility checks.  

---

## 21. Asynchronous Loading States & Skeleton Specifications
- **No Flashing Blank Screens:** Views must never flash empty white canvases or raw lone spinners during data resolution.
- **Geometric Matching:** Skeleton blocks must replicate the exact aspect ratios and grid spans of incoming content (`MetricCardSkeleton`, `TableSkeleton`, `ChartCardSkeleton`).
- **Pulse Animation:** Skeletons use subtle opacity pulsing (`animate-pulse bg-slate-200/80`) with rounded corners matching component radius tokens.

---

## 22. Product Walkthrough & Interactive Demo Architecture
- **Real Working Flows:** Walkthrough modals must navigate real operational application routes (`accounts`, `transactions`, `blockchain`, `insights`, `budgets`) rather than displaying static screenshot mockups.
- **Explicit Demo Labels:** Synthetic banking connectors and demonstration states must clearly state: "SYNTHETIC / DEMO ENVIRONMENT: Zero live banking credentials or real money."

---

## 23. Legal, Compliance & Privacy Architecture
- **Persistent Compliance Navigation:** Terms of Service and Privacy Policy must be accessible from the landing page, application footer, sidebar, and user dropdown.
- **Zero-PII On-Chain Guarantee:** Distributed ledger blocks contain solely cryptographic hashes (`SHA-256`) and numerical amounts. Identifiable personal data resides exclusively off-chain in encrypted storage.
- **Transparent Placeholders:** Items requiring jurisdiction-specific legal review must be explicitly identified without inventing fictional certifications.

---

## 24. Cross-Viewport Responsiveness & Accessibility Specifications
- **Target Viewports:** Certified for `1440×900` (desktop wide), `1280×800` (laptop), `1024×768` (desktop compact), `768×1024` (tablet portrait), `390×844` (mobile iPhone), and `360×800` (mobile Android).
- **Responsive Drawer Breakpoint:** `< 1024px` transitions the persistent sidebar into an overlay slide-out drawer, preserving full canvas width for data tables and preventing horizontal overflow.
- **Zero Horizontal Overflow:** `scrollWidth` must never exceed `innerWidth` across any supported device resolution.  
