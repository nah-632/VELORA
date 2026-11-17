# Implementation Plan: VELORA Premium MVP

Companion to `SPEC.md` and `CAPABILITY-MAP.md`. Owner-approved decisions: **public repo**,
**Mumbai region**, **full customer accounts**, **folded-paper monogram**.

Task list target: `tasks/todo.md` (checklist form).

## Overview

Deliver the master prompt's Phase 1 Premium MVP as twelve capability modules in dependency
order, one vertical slice at a time. Every milestone ends at a gate with evidence, not a claim.

## Architecture Decisions

| id | Decision | Rationale |
|---|---|---|
| AD-1 | Next.js 14.2 App Router + TypeScript strict | Owner's portfolio standard; Server Components make server-side authorization the default |
| AD-2 | Supabase (Postgres 17 + Auth + Storage + RLS) | Auth, RBAC, private storage and isolation in one managed service; token already present |
| AD-3 | No ORM — versioned SQL migrations are the schema source of truth | §4 of the brief wants constraints, indexes, transactions; clearest in SQL |
| AD-4 | Postgres RLS for customer isolation | "No reliance on hiding UI elements as a security mechanism" — a UI bug must not leak data |
| AD-5 | One renderer for preview and final output | The brief forbids a separate "fake preview" |
| AD-6 | Money as integer fils; totals computed server-side only | 1 BHD = 1000 fils; never floats; never trust the client |
| AD-7 | Prices computed in the same transaction that creates the order | Prevents a price/order race and stale-rule drift |
| AD-8 | Locale-prefixed routes, `ar` default, logical CSS properties enforced by a guard script | RTL is architecture, not translation |
| AD-9 | Aref Ruqaa restricted to display headings; Naskh companion for body | Calligraphic face; legibility is a risk, not a preference |
| AD-10 | Payment provider abstraction + manual recording; nothing simulated | No gateway selected; the brief forbids pretending one exists |
| AD-11 | Scoped `tsc` locally, `next build` in CI | This device OOMs on whole-project builds — stated, not hidden |

## Task List

### Phase 1 — Foundation (Milestone 1)

**Task 1.1 — Repository scaffold**
Description: package.json, `tsconfig.json` + `tsconfig.check.json` (scoped), `next.config.mjs`,
eslint/prettier, `.env.example`, `.gitignore`, README, `scripts/`.
Acceptance: `npm install` resolves; `npm run type-check` executes against the scoped config.
Verify: run both commands; paste real output. Files: 8 · **S** · Deps: none.

**Task 1.2 — Environment validation**
Description: `src/lib/env.ts` — zod-parsed, server/public split. Missing variables fail loudly at
startup rather than producing a runtime `undefined` in a payment path.
Acceptance: a missing server variable throws a named error listing it; no secret is ever imported
into a client component.
Verify: deliberate-missing-variable test + grep that `SERVICE_ROLE` never appears outside server
modules. Files: 2 · **S** · Deps: 1.1.

**Task 1.3 — Migration harness (local Postgres)**
Description: `scripts/db-replay.mjs` on **PGlite** — applies every `supabase/migrations/*.sql` in
order from zero, then applies the set a **second time** to prove re-runnability, then reports
table/function counts.
Acceptance: runs green on an empty migrations directory (0 migrations) and on a real one.
Verify: `npm run test:db` with real output. Files: 3 · **M** · Deps: 1.1.

**Task 1.4 — RLS test harness with role discipline**
Description: assertion runner that wraps every user-context query in `set role authenticated`
and resets in `finally`. Without this, PGlite's superuser connection makes RLS tests pass
vacuously.
Acceptance: a deliberately-broken policy is *detected* (the harness proves it can fail).
Verify: run the harness against a known-bad policy and show it failing, then against the real one.
Files: 3 · **M** · Deps: 1.3.

**Task 1.5 — Brand tokens + measured contrast gate**
Description: `src/styles/tokens.css` with the owner's five colours, and `scripts/check-contrast.py`
computing WCAG ratios for every foreground/background pair actually used.
Acceptance: the report is produced from measurement; any pair below threshold is either fixed or
explicitly marked decoration-only.
Verify: run the gate; show the table. Files: 3 · **M** · Deps: 1.1.

**Task 1.6 — Locale routing + RTL guard**
Description: next-intl wiring, `messages/{ar,en}.json` skeletons, `app/[locale]/layout.tsx`
setting `dir`/`lang`/font per locale, and `scripts/check-rtl.mjs` failing on physical utilities.
Acceptance: `/ar` renders RTL in the Arabic face, `/en` renders LTR in the Latin face, switch works;
the guard fails on a planted `pl-4`.
Verify: both locales rendered + the guard proven to fail on the planted violation. Files: 6 · **M** · Deps: 1.1.

**Task 1.7 — Design-system primitives + page shell**
Description: button, input, select, textarea, field-error, card, section heading, badge, dialog,
toast, and header/nav/footer shell with language switch. Includes loading/empty/error states.
Acceptance: every primitive renders in both directions; no raw hex in a component; focus states
meet the contrast gate.
Verify: rendered component gallery in a browser at 390px and 1280px, both directions. Files: ~12 → split into 1.7a (form primitives) and 1.7b (shell + overlays). **M** each.

### Checkpoint A — after Tasks 1.1–1.7
- [ ] `npm run verify` green (scoped type-check + unit + db + ui gates)
- [ ] repo pushed; a fresh clone installs and runs
- [ ] Arabic and English render correctly in a real browser
- [ ] **Report to owner before Phase 2**

### Phase 2 — Database & Identity (Milestone 1)

**Task 2.1 — Migration 0001: baseline, helpers, no extensions** — schemas `public`/`app_private`,
`app_private.uid()` reading the JWT claim, `bahrain_today()`, updated-at trigger. Verify: replay twice.
**Task 2.2 — Identity schema** — `profiles`, `roles`, `user_roles`, `admin_activity_log`,
customer-account flags; FK to `auth.users`. Verify: constraint tests.
**Task 2.3 — RLS baseline + isolation suite** — a customer can read only their own rows; asserted
per table with role discipline and a proven-failure check.
**Task 2.4 — Auth flows** — sign-up, sign-in, password reset, email confirmation, session refresh in
middleware. Verify: e2e-able paths + server-side route protection on `/admin/*`.
**Task 2.5 — Audit log writer** — a database function that records sensitive admin actions;
asserted to be non-deletable by ordinary roles.

### Checkpoint B
- [ ] isolation suite green with role discipline proven
- [ ] `/admin` unreachable by a customer account (403, not a hidden link)
- [ ] **Report to owner**

### Phases 3–9 (expanded at each gate, per `planning-and-task-breakdown` §Step 4)

| Milestone | Modules | Tasks (index — expanded at the gate) |
|---|---|---|
| 3 Template system | `catalogue` | categories + templates + assets schema · catalogue queries · library grid/filter/search · template detail · selection → studio · admin template CRUD |
| 4 Wedding Studio | `studio` | design-config schema (versioned) · invitation content model · three-panel layout · content forms · style controls · undo/redo history · autosave + explicit save · validation |
| 5 Live preview | `renderer` | renderer component · preview viewport modes · AR/EN rendering · empty-optional-field handling · proof that preview and final share one code path |
| 6 Orders & pricing | `commerce` | pricing rules + add-ons + discounts schema · server-side pricing function · price breakdown UI · order creation in one transaction · order lifecycle transitions · customer order views · WhatsApp click-to-chat |
| 7 Administration | `admin` | dashboard metrics from real queries · orders module · pricing module · customers module · transactions module · CMS (homepage/FAQ/contact) · settings · audit views |
| 8 WhatsApp & payments | `payments` | provider abstraction interface · transaction records · manual recording · refunds/adjustments · reconciliation view · activation requirements doc |
| 9 Testing & release | `quality` | functional suite · security suite · RTL/a11y/responsive pass · bug fixes · production configuration · deployment documentation |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Device OOM (5.8 GB) on any whole-project build | High | scoped `tsc`; PGlite; production build only in CI |
| Public repo exposes work in progress | Medium | no secrets in the repo by construction (`.env.example` only); `.secrets/` gitignored |
| Supabase project not yet provisioned | Medium | local Postgres first; cloud wiring is a thin adapter |
| Legal texts (terms/privacy) absent | High | publish gate refuses while placeholders remain; never invent legal text |
| Arabic display face legibility | Medium | measured test before adoption |
| Scope creep into Phase 2 features | Medium | §9 out-of-scope list is in `SPEC.md`; new features go to a backlog file, not into the build |

## Open Questions

Answered: repository location (public) · Supabase region (Mumbai) · customer accounts (full) ·
logo direction (folded paper).

Still open, none blocking Milestone 1:
the professional-design service price and structure · discount policy · VAT applicability ·
WhatsApp business number · who authors terms and privacy · whether the design service needs its
own intake form in Phase 1.
