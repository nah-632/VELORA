# Spec: VELORA Premium MVP (Phase 1)

Status: **DRAFT — awaiting owner approval**
Date: 2026-11-17 · Author: agent, on the owner's 971-line master prompt
Skill route: `spec-driven-development` (Phase 1) → `planning-and-task-breakdown` → `incremental-implementation`
Companion: `CAPABILITY-MAP.md` (approved before any module spec is written)

---

## 1. Objective

Build and deliver the first production-ready version of **VELORA**: a bilingual (Arabic RTL /
English LTR) premium digital wedding-invitation platform, launching in **Bahrain**, with data,
money and permissions handled server-side.

**User.** A bride, groom or family member in Bahrain who is buying a *premium stationery
product* — not using a form builder. They arrive on a phone, in Arabic or English, look at
designs, and either (a) customise a template themselves in the Wedding Studio or (b) buy the
professional design service.

**What success looks like.** The journey
`Homepage → Browse → Select template → Wedding Studio → Customise → Live preview → Save →
Pricing → Place order → Payment workflow → Order confirmation → WhatsApp contact`
works end to end, with persisted data, correct Arabic and English rendering, and an
administrator who can run the business without touching code.

**What success does not look like.** Decorative buttons, seeded fake testimonials, a "live
preview" that is a different renderer from the real invitation, prices computed in the browser,
a payment marked paid because a button was pressed.

### 1.1 Repository audit (master prompt §2, rule 1 — executed, not assumed)

| Check | Result |
|---|---|
| Existing VELORA repo on GitHub (`nah-632`) | **None.** 24 repos listed; no VELORA, no invitation project. |
| Existing local clone | **None.** No `/tmp` or workspace clone matches `velora`. |
| `/var/minis/workspace/` | **Empty** — wiped since the previous session (a known hazard here). |
| `/var/minis/mounts/` | **Empty** — no external folder mounted. |
| `/var/minis/shared/` | Contains `ssms/`, `lumora-*`, `landing-qa`, `scanner-qa`. No VELORA. |

**Conclusion: this is a greenfield build.** Nothing is being rebuilt, so nothing can be broken,
and the "do not replace the technology stack" rule has no object. This also means **no code
exists yet to inspect for stack decisions** — the stack below is my proposal, not a discovery.

### 1.2 Environment audit (verified this session)

- Node `v22.23.4`, npm `10.9.1`, Python `3.12.16`, git `2.47.3`, Supabase CLI `2.122.0`.
- Dijk 65 GB free; **RAM 5.8 GB total / ~2.6 GB available** — the device OOMs under
  whole-project type-checking or a local production build. This shapes the verification
  strategy (§7) rather than being a footnote.
- `GITHUB_TOKEN` present and authenticated as `nah-632` (repo + workflow scopes).
- `SUPABASE_ACCESS_TOKEN` present. One project exists: `hkbamfwviadxxteeibbi`,
  **Tokyo `ap-northeast-1`**, Postgres 17.12, created today, healthy. Note: Supabase offers
  **no Middle East region** — the nearest are `ap-south-1` (Mumbai) and `eu-central-1`.
- **No payment-gateway credentials** of any kind are present in the environment.

---

## 2. Tech Stack

Proposed. Every choice here is reversible except `database` + `identity`, which are expensive.

| Concern | Choice | Why this, not the alternative |
|---|---|---|
| Framework | **Next.js 14.2 (App Router) + TypeScript 5 (strict)** | The owner's last four products are Next (`lumora`, `Cheetah`, `dj-sukara`, `speed-laundry`). Server Components make *server-side* authorization and pricing the default rather than a discipline. |
| Database / Auth / Storage | **Supabase** (Postgres 17, Auth, Storage, RLS) | The brief demands five things in one place: authentication, role-based access, private file storage with signed URLs, per-customer data isolation, and an audit trail. Supabase supplies all five managed, and the owner's account is already authenticated here. Hand-rolling these is where MVPs leak. |
| Access control | **Postgres RLS + explicit roles**, policies in migrations | The brief: "No reliance on hiding UI elements as a security mechanism." RLS makes customer isolation a database property that a UI bug cannot bypass. |
| i18n | **next-intl 3.26** — locale-prefixed routes, `ar-BH` default | Handles routing + message catalogues + RTL plumbing. Already proven in `lumora`. |
| Styling | **Tailwind 3.4 + CSS custom properties** for brand tokens | Tokens must survive a redesign; utilities keep the design system honest. No CSS-in-JS (runtime cost, RSC friction). |
| Validation | **zod 3.25**, shared between client hints and server enforcement | Server is authoritative; one schema, two uses. |
| Data access | **Raw versioned SQL migrations** + generated TypeScript types | The brief §4 wants constraints, indexes, transactions and a safe migration strategy — clearest in SQL. Matches the approach that produced audit-survivable results in `ssms`. **No ORM.** |
| Editor state | **`useReducer` + immutable history stack** | No state library. The editor holds one document and a pointer; that is a reducer, not a framework. |
| Money | **integer minor units** (fils; 1 BHD = 1000) | Never floats for currency. Formatting via `Intl.NumberFormat('ar-BH'/'en-BH', BHD)`. |
| Fonts | **Self-hosted, subset, woff2** | No third-party font CDN: privacy, latency, and control over Arabic shaping. |
| Deploy | **Vercel** (app) + **Supabase** (data/storage) | Documented in `docs/DEPLOYMENT.md`; no local production build required. |
| Tests | **`node --test`** (unit/integration) + **PGlite** (real Postgres, in-process) + **Playwright** (browser) | PGlite runs the real migrations and real RLS policies on this device — the strongest verification available without a server. |

> **ADDENDUM E (2026-11-18) supersedes four rows of this table.** Hosting and backend move to
> **CranL**: one Next.js app deployed from GitHub, **CranL managed PostgreSQL in `riyadh-1` (MENA)**,
> **S3-compatible object storage** for assets, **application-layer authorization instead of Postgres
> RLS**, a single-admin credentials login (argon2/bcrypt, httpOnly session cookies, rate limiting,
> optional TOTP), and a **Drizzle/Prisma** data layer with versioned migrations. Supabase and Vercel
> are out; `docs/DEPLOYMENT.md` is superseded by `docs/CRANL.md`. The deployment path was verified
> against this repository (`preflight_deploy` → `ready: true`, framework Next.js, `next start`,
> port 3000), and the plan requirement it exposes — MENA regions, object storage and custom domains
> are all paid features — is recorded there.

**Deliberately not used:** a component library (`shadcn`/MUI — the brief forbids "generic dashboard
templates" and the design is the product), a state-management library, a CSS-in-JS runtime, any "AI"
feature (out of scope, §9). An ORM was on this list until ADDENDUM E; it is now **Drizzle** as a
typed access layer over the same committed SQL migrations (AD-14 in `tasks/plan.md`).

### 2.1 Brand tokens (proposed by the owner, pending measured validation)

`Obsidian #191A19` · `Warm Ivory #F5F0E8` · `Champagne Gold #B99B6C` · `Soft Taupe #B9ADA0` ·
`Deep Emerald #263E35`.

The master prompt says these "must be validated for accessibility, contrast, and practical use."
They will be — as a gate, with a written report, before they are frozen. Prior experience on
this device says at least one will fail: a light gold on an ivory ground is the classic case
(`#B99B6C` on `#F5F0E8` measures ≈2.0:1, far below the 3:1 WCAG requires for a UI affordance).
Expect `--gold` to end up **decoration-only**, with a darkened `--gold-deep` for anything
interactive, exactly as happened in the owner's last two projects.

---

## 3. Commands

```bash
npm run dev            # next dev — local development
npm run build          # next build — CI ONLY (hangs/OOMs on this device; see §7)
npm run type-check     # scoped tsc via tsconfig.check.json (never whole-project)
npm run lint           # eslint + next lint
npm run test           # node --test tests/unit tests/integration
npm run test:db        # PGlite: replay all migrations from zero + RLS isolation assertions
npm run test:security  # cross-customer access, admin authz, price tampering, upload validation
npm run test:ui        # contrast gate + RTL logical-property guard + responsive measurements
npm run test:e2e       # playwright (browser-level; see the honesty note in §7)
npm run db:types       # supabase gen types typescript → src/lib/database.types.ts
npm run verify         # type-check + test + test:db + test:ui
```

## 4. Project Structure

```
tasks/                    plan.md + todo.md (task list target)
docs/                     DEPLOYMENT.md · BRAND.md · SECURITY.md · adr/NNNN-*.md
supabase/migrations/      NNNN_description.sql — the schema source of truth
src/app/[locale]/
  (site)/                 homepage, templates, pricing, about, contact, faq, legal
  (studio)/studio/        Wedding Studio
  (admin)/admin/          dashboard + management modules
  api/                    route handlers (webhooks, uploads, provider callbacks)
src/features/<module>/    one folder per capability: schema.ts, queries.ts, components/
src/components/ui/        design-system primitives (no feature logic)
src/lib/                  supabase clients, money.ts, i18n, result types, audit
messages/ar.json en.json  user-facing strings (none hardcoded in components)
public/fonts/ brand/ templates/
scripts/                  check-contrast.py · check-rtl.mjs · check-design.mjs
tests/{unit,integration,db,security,ui,e2e}/
```

`src/features/<module>/` mirrors the capability map deliberately: a module from
`CAPABILITY-MAP.md` should be findable in one directory.

## 5. Code Style

```ts
// src/features/commerce/pricing.ts
import { z } from "zod";

/** Money is integer fils. 1 BHD = 1000 fils. Never a float, never a string. */
export type Fils = number;

export const OrderDraftSchema = z.object({
  templateId: z.string().uuid(),
  quantity: z.number().int().min(1).max(1000),
  addOnIds: z.array(z.string().uuid()).max(20),
  promoCode: z.string().trim().toUpperCase().max(32).optional(),
});

/** Authoritative totals. Called on the server inside the order transaction. */
export async function priceOrder(
  db: Db,
  draft: z.infer<typeof OrderDraftSchema>,
  locale: "ar" | "en",
): Promise<Result<PriceBreakdown>> { /* ... */ }
```

Conventions:
- **Server Components by default.** `"use client"` is a deliberate, justified act.
- **Every mutation is validated with zod at the boundary**, in the server, regardless of
  what the client already checked.
- **Logical CSS properties only** — `ps-`/`pe-`/`ms-`/`me-`/`text-start`/`text-end`.
  A guard script fails the build on physical `pl- pr- ml- mr- left- right- text-left border-l`.
  This is the single highest-yield RTL rule; it is enforced, not documented.
- **No user-facing string literal in a component.** All copy comes from `messages/*.json`.
- **Money as integer fils**; formatting through `Intl`, never string concatenation.
- **Direction-boundary rule:** interface chrome takes the *interface* direction and font;
  user-authored content (an Arabic invitation inside an English UI) takes its own
  `dir="auto"` and its own typeface. These are separate concerns and must never be conflated.
- Errors returned as typed results at boundaries, not thrown strings.

## 6. Boundaries

**Always:** authorize every read and write on the server · use parameterised queries ·
compute prices server-side · validate file type/size before accepting an upload ·
`npm run verify` green before a commit · keep every user-facing string in the catalogues.

**Ask first:** any schema change to a table that holds data · adding a dependency ·
changing a price, a policy, or a legal text · enabling a real payment provider ·
introducing any public-by-default resource.

**Never:** commit secrets · store card numbers, CVVs, or provider credentials ·
mark an order paid without a verified provider response or a recorded manual action ·
claim a WhatsApp message was sent, delivered or read · fabricate testimonials, customers,
ratings, or statistics · run a destructive migration without written authorization ·
present draft legal text or an unresolved `[PLACEHOLDER]` as publishable ·
ship an AI-generated concept image as the production logo.

## 7. Testing strategy

| Level | Tool | What it proves | Runs on this device |
|---|---|---|---|
| Unit | `node --test` | pricing arithmetic, money rounding, zod schemas, design-config versioning | ✅ |
| Database | **PGlite** (real Postgres, WASM) | migrations replay from zero and are re-runnable; constraints fire; **RLS actually isolates customers** | ✅ |
| Security | PGlite + assertions | cross-customer order/draft access, admin authorization, client price tampering, upload validation, sensitive-data exposure | ✅ |
| UI | guard scripts + browser | contrast ratios, RTL logical-property compliance, responsive layout at 3 widths, AR/EN rendering | ✅ |
| E2E | Playwright | the full customer journey in a real browser | ⚠️ limited — see below |
| Build | `next build` | production compile, server/client boundaries, route types | ❌ local — **CI only** |

Three honesty rules for this project, learned the hard way on this device:

1. **`next build` is not run locally.** A local production build exhausts this device's memory.
   Type errors are caught with a *scoped* `tsc` (`tsconfig.check.json` listing touched files);
   the real build runs in CI. When reporting, state exactly which of the two happened.
2. **PGlite tests must `set role`.** PGlite connects as a superuser, which bypasses RLS
   *and* column privileges. A suite that only sets a JWT claim reports green while testing
   nothing. Every isolation assertion sets the role, and resets it in `finally`.
3. **RTL cannot be verified from computed style.** In RTL, `ps-6` resolves to `padding-right`;
   asserting on computed `padding-left` fails a correct component. The real test is the
   *directional flip*: same markup, `dir` changed, column moves edge to edge.

The Definition of Done for the project is the master prompt's §12, quoted as the acceptance
list in `tasks/plan.md` so it cannot drift.

---

## 8. Milestones → modules → gates

The master prompt's nine milestones are kept as the schedule. Each gate is a stop-and-report
point; work does not continue past a failed gate.

| # | Milestone | Modules | Gate evidence required |
|---|---|---|---|
| 1 | Foundation | `foundation`, `database`, `identity` | migrations replay clean from zero on PGlite; RLS isolation suite green; scoped `tsc` clean |
| 2 | Brand & public website | `brand`, `i18n`, `design-system` | contrast report with measured ratios; logo rendered at 16→160px on light/dark; fonts subset-verified for Arabic shaping; rendered AR + EN at 390px and 1280px |
| 3 | Template system | `catalogue` | templates read from the database, not from code; admin can create/publish without a deploy |
| 4 | Wedding Studio | `studio` | edit → autosave → reload restores the exact design configuration; undo/redo verified |
| 5 | Live preview | `renderer` | proof that preview and final output call the **same** renderer (not two implementations) |
| 6 | Orders & pricing | `commerce` | server-side total recomputed and compared against a tampered client total → mismatch rejected |
| 7 | Administration | `admin` | every dashboard metric traced to a real query; non-admin request to each admin route returns 403 |
| 8 | WhatsApp & payments | `payments`, `commerce` | click-to-chat URL encoded and validated; provider boundary documented; no simulated success anywhere |
| 9 | Testing & release | `quality` | the honest test table: what ran, what passed, what could not run and why |

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Device OOM (5.8 GB RAM) on any whole-project build/type-check | High | scoped `tsc`; PGlite over a server DB; production build in CI; split long encodes/analysis into separate invocations |
| `/var/minis/workspace/` was wiped between sessions | High | the repo lives in git with a remote from Milestone 1 hour one; nothing important only on the device |
| No payment gateway credentials | Medium | the brief already prescribes the answer: provider abstraction + manual transaction recording + documented activation requirements. Nothing is simulated. |
| Arabic display face (Aref Ruqaa) is a calligraphic face | Medium | legibility test before adoption; fallback to a Naskh companion; never used below heading sizes |
| `next build` unverifiable locally | Medium | CI as the real gate; a scoped type-check locally; reported honestly every time |
| Legal pages (terms, privacy) | High | content is the owner's; the build ships with a **gate that refuses to publish while placeholders remain**, and never invents legal text |
| Supabase region latency from Bahrain | Medium | see decision D2 below |

### 9.1 Brand and name findings (checked, not assumed)

- **`velora.com` is live** — "Velora, a digital product design and development studio".
  Not a wedding competitor, but it is an exact-match brand and it will own generic search.
- **`velora.sa` and `velora.ae` resolve** (a Salla storefront and a Cloudflare-fronted site).
- **`velora.bh`, `velora.co` and `theartofinviting.com` return no DNS** — *absence of DNS is
  not evidence a domain is available*; only a registrar lookup is. **Bahrain trademark register
  not searched** (that needs the Ministry of Industry & Commerce), and app-store names unchecked.
- **Confusion risk with the owner's own portfolio:** VELORA sits one vowel away from **LUMORA**,
  another product in the same organisation with a similar gold-and-dark luxury palette. They are
  different businesses; if both ever ship publicly, the marks must be visually separable.
- **The attached logo is an exploratory AI-generated concept**, and the master prompt says not to
  treat such an image as production artwork. It shows a serif **V** carrying a botanical spray
  whose stem loops into a closed curve, above a high-contrast letterspaced serif wordmark and
  the tagline `THE ART OF INVITING`.
  ⚠️ **It conflicts with the brief.** §1 asks the monogram to explore *"the letter V and the
  abstract concept of a folded invitation or refined paper geometry"* and to *avoid generic
  wedding symbols and excessive flourishes*. A leaf spray is the conventional wedding-floral
  vocabulary. This is decision **D4** below — it needs the owner, not a guess.

## 10. Open Questions — owner decisions required

| id | Decision | Why it blocks |
|---|---|---|
| **D1** | Where does the repository live? | Every subsequent task writes code somewhere. Recommended: a new **private** GitHub repo under `nah-632`. |
| **D2** | Which Supabase project? | Auth, storage and RLS all live there. A fresh project currently exists in **Tokyo**; Supabase has **no Middle East region**, so the realistic choices are `ap-south-1` (Mumbai) or `eu-central-1`. Customer wedding data + PDPL considerations make this worth one question. |
| **D3** | Do Phase 1 customers have accounts? | The brief says "Registration and login, **if customer accounts are implemented**" — genuinely ambiguous. It changes auth, RLS, the save/resume journey, and the order-access model. |
| **D4** | Which logo direction? | The attached concept and the written brief point in different directions. |

Non-blocking questions that do **not** stop Milestone 1, and are recorded for later:
the professional-design service fee and pricing structure · discount/tax policy ·
WhatsApp business number · who authors the legal texts (terms, privacy) · whether the
professional design service needs its own intake form in Phase 1.

## 11. Success Criteria (Phase 1)

The master prompt's §12 Definition of Done, adopted verbatim as the acceptance list, plus:

- Every price shown to a customer is reproducible from the database by a server-side function.
- A second customer cannot read or mutate the first customer's draft, order or invitation.
- An Arabic invitation renders correctly inside an English interface, and vice versa.
- No dashboard number exists that is not traceable to a query.
- The test report states what ran, what passed, and what could not run — with reasons.
