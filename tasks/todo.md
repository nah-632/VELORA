# VELORA — task list

Companion: `tasks/plan.md` · Spec: `SPEC.md` · Modules: `CAPABILITY-MAP.md`
Convention: a task is done only when its verification evidence exists. No claim without evidence.

## Phase 1 — Foundation (Milestone 1)

- [x] **1.1 Repository scaffold** — package.json, scoped tsconfig, next.config, lint, README
  - ✅ `npm install` → 420 packages; `npm run type-check` → clean
- [x] **1.2 Environment validation** — `src/lib/env.ts`, server/public split
  - ✅ zod-parsed, public/server split, `serverEnv()` throws in a browser context
  - ⏳ the deliberate-missing-variable test is not written yet
- [x] **1.3 Migration harness** — PGlite replay from zero, then a second time
  - ✅ `npm run test:db` → 1 migration applied twice, 4 functions, helpers present, PASS
- [x] **1.4 RLS harness with role discipline** — `set role` inside a transaction, committed variants for writes
  - ✅ 27/27 isolation assertions, ending in a **negative control** that disables RLS and requires
    the same query to return 3 rows instead of 1 — so the suite proves it can fail
- [x] **1.5 Brand tokens + contrast gate** — owner palette, measured WCAG report
  - ✅ 21 pairs measured, 0 required failures. Champagne gold `#B99B6C` = **2.32:1 on ivory**
    → decoration-only; every interactive use draws from a measured `--gold-deep` (5.26:1)
- [x] **1.6 Locale routing + RTL guard** — next-intl, `dir`/`lang`/font per locale
  - ✅ `/` → 307 → `/ar`; `/ar` renders `lang="ar" dir="rtl"` in the Arabic face, `/en` renders
    `lang="en" dir="ltr"` in the Latin face; no cross-locale string leakage; guard PASS
  - ⏳ the guard has **not** yet been proven to fail on a planted physical utility
- [x] **1.7a Form primitives** — button, input, textarea, field error, card, state panel
  - ✅ rendered in both directions; error announced via `aria-describedby` + `role="alert"`
- [x] **1.7b Shell** — header, nav, footer, language switch
  - ⏳ dialog and toast are not built yet; nav destinations render disabled until their pages exist

### Checkpoint A
- [x] `npm run verify` green — type-check clean, 9/9 unit, 27/27 isolation, replay idempotent,
      21/21 contrast pairs, RTL guard PASS, CSS guard PASS
- [x] fresh clone installs and runs — cloned, `npm ci` (425 packages), `npm run verify` **PASS**
      end to end: 9/9 unit, 27/27 isolation, 21/21 contrast, RTL and CSS guards
- [x] AR + EN rendered in a real browser at 390×844 and 1280×800
- [x] report to owner

## Defects found by rendering (none of these were visible in the source)

1. **`tokens.css` opened with `#`-prefixed comment lines.** `#` is not a CSS comment; the parser's
   error recovery swallowed the entire `:root` block. Every `var()` then resolved to nothing while
   the utilities further down still worked — so the page looked "mostly styled" with no colour and
   fallback fonts. Silent, total, and invisible to grep. Now guarded by `scripts/check-css.mjs`.
2. **`--obsidian` rendered as `obsidian--`.** Inside an RTL line the bidi algorithm moves the
   leading direction-neutral hyphens to the end of the run. Fixed with `.ltr-token`
   (`direction: ltr; unicode-bidi: isolate`) — the identical fix will be needed for order
   references, version numbers, file paths and API keys shown in Arabic.
3. **`.As it should appear`** — a trailing neutral character landing at the wrong end, because
   demo strings were hardcoded English inside the Arabic page. Fixed at the source: every
   user-facing string now comes from the catalogue.
4. **`/` returned 404.** With a `src/` directory, Next looks for middleware at `src/middleware.ts`,
   not at the project root.

Deferred to Milestone 2 and stated plainly: **no font files are loaded yet**. The token stacks end
at `Times New Roman` / `system-ui`, so every screenshot above is a fallback render. Self-hosted,
subset Arabic subsets with shaping verification are `brand` work.

## Phase 2 — Database & Identity (Milestone 1)

- [ ] **2.1 Migration 0001** — schemas, `app_private.uid()`, `bahrain_today()`, updated-at trigger
- [ ] **2.2 Identity schema** — profiles, roles, user_roles, admin_activity_log
- [ ] **2.3 RLS baseline + isolation suite**
- [ ] **2.4 Auth flows** — sign-up, sign-in, reset, confirmation, middleware route protection
- [ ] **2.5 Audit log writer** — non-deletable by ordinary roles

### Checkpoint B
- [ ] isolation suite green with role discipline proven
- [ ] `/admin` returns 403 to a customer account
- [ ] report to owner

## Phase 3 — Template system (Milestone 3)
- [ ] 3.1 categories + templates + assets schema
- [ ] 3.2 catalogue queries (filter, search, featured)
- [ ] 3.3 library grid + filters + search
- [ ] 3.4 template detail
- [ ] 3.5 select → studio handoff
- [ ] 3.6 admin template CRUD

## Phase 4 — Wedding Studio (Milestone 4)
- [ ] 4.1 versioned design-configuration schema
- [ ] 4.2 invitation content model + validation
- [ ] 4.3 three-panel layout
- [ ] 4.4 content forms
- [ ] 4.5 style controls (colour/type/layout/decoration/background)
- [ ] 4.6 undo/redo history
- [ ] 4.7 autosave + explicit save + save status
- [ ] 4.8 destructive-action confirmation

## Phase 5 — Live preview (Milestone 5)
- [ ] 5.1 renderer component (single source of truth)
- [ ] 5.2 desktop / mobile / full viewport modes
- [ ] 5.3 AR + EN rendering inside the correct direction context
- [ ] 5.4 empty-optional-field resilience
- [ ] 5.5 proof of shared code path with final output

## Phase 6 — Orders & pricing (Milestone 6)
- [ ] 6.1 pricing rules, add-ons, discounts schema
- [ ] 6.2 server-side pricing function
- [ ] 6.3 price breakdown UI
- [ ] 6.4 order creation in a single transaction
- [ ] 6.5 order lifecycle transitions
- [ ] 6.6 customer order views
- [ ] 6.7 WhatsApp click-to-chat with correct encoding

## Phase 7 — Administration (Milestone 7)
- [ ] 7.1 dashboard metrics from real queries
- [ ] 7.2 orders module
- [ ] 7.3 pricing module
- [ ] 7.4 customers module
- [ ] 7.5 transactions module
- [ ] 7.6 content management (homepage, FAQ, contact, bilingual)
- [ ] 7.7 settings
- [ ] 7.8 audit log views

## Phase 8 — WhatsApp & payments (Milestone 8)
- [ ] 8.1 provider abstraction interface
- [ ] 8.2 transaction records
- [ ] 8.3 manual payment recording
- [ ] 8.4 refunds and adjustments
- [ ] 8.5 reconciliation view
- [ ] 8.6 activation-requirements documentation

## Phase 9 — Testing & release (Milestone 9)
- [ ] 9.1 functional suite
- [ ] 9.2 security suite
- [ ] 9.3 RTL / accessibility / responsive pass
- [ ] 9.4 bug fixes
- [ ] 9.5 production configuration
- [ ] 9.6 deployment documentation

## Blockers

- **B1 — Supabase project not provisioned.** The configured access token is scoped and lacks
  `organizations_read`, so `supabase projects create` returns `Forbidden`. Work around: the owner
  creates the project in the dashboard (Mumbai / `ap-south-1`), or issues a token with org scope.
  Does **not** block Phase 1 or Phase 2 — the schema and isolation tests run on local Postgres.

- **B2 — Payment provider not selected** (by design). Phase 1 ships the abstraction and manual
  recording; activation requirements are documented.
