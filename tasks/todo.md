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

- [x] 3.1 categories + templates + assets schema — versioned `design_config` with the version
      lifted into a generated column; content in a separate `preview_content`; **prices nullable**
- [x] 3.2 catalogue queries — in SQL functions, so the public site, the admin screens and the test
      suite run the same query and RLS applies to all of them
- [x] 3.3 library grid + category filter + search + paging (plain GET, works without JavaScript)
- [x] 3.4 template detail — canvas, metadata, honest unpriced state
- [x] 3.5 select → studio handoff — the design resolves from the database by slug
- [ ] 3.6 admin template CRUD — belongs with Milestone 7, where the admin surface lives

### Architecture decision taken in this milestone
**L1 — catalogue queries live in SQL functions, with two transports.** This device cannot run a
PostgreSQL server (`shmget` is unimplemented), so development uses PGlite in-process while
production uses Supabase over PostgREST. Putting the query in the database means there is one
implementation, not two that drift. The PGlite transport is refused in production, and it does
**not** exercise RLS — the test suites do, by setting a role for every query.

## Phase 4 — Wedding Studio (Milestone 4)

- [x] 4.1 versioned design-configuration schema — `DesignConfigSchema`, plus the snapshot column on
      `invitations` so a template edited later cannot redraw an invitation already sold
- [x] 4.2 invitation content model + validation — storage shape and order readiness are
      **two different questions** (see the defect below), with a real calendar check for dates
- [x] 4.3 three-panel layout — design controls, canvas, properties. Mirrored in RTL, as it should be
- [x] 4.4 content forms — names, date/time, venue, map, message, verse; per-field errors
- [x] 4.5 style controls — palette, typography, ornament, layout
- [x] 4.6 undo/redo — history in the reducer, coalescing a run of typing into one step, with
      keyboard shortcuts
- [x] 4.7 autosave + explicit save + visible save status — autosave debounces; only the explicit
      save writes a version
- [x] 4.8 destructive-action confirmation — resetting the design is confirmed and still undoable

### Defects found by using it, not by reading it
1. **A half-filled draft could not be saved at all.** Validation of *format* ran on save, so a
   customer who had typed two names and not yet chosen a date got `expected a date` — and autosave
   failed exactly when it mattered most. Split into a permissive storage schema and a strict
   readiness check.
2. **`Date.parse("2027-02-31")` does not fail** — it rolls over to 3 March and returns a valid
   timestamp, so a mistyped day would have been shown as a different date, silently. Dates are now
   checked by comparing the parsed components back.
3. **Four PostgreSQL instances against one data directory.** Module-level caches are new caches on
   every hot reload; each instance re-ran all migrations and contended for the same files. A save
   took **276 seconds**. Moved to `globalThis`: one process, one database, ~10s.

### Checkpoint
- [x] `npm run verify` green — 23 unit · 27 isolation · 57 catalogue · 26 draft · 7 fonts ·
      35 brand · 21/21 contrast · RTL · CSS · canary
- [x] round trip verified in a browser: type → live preview → autosave → reload → restored
- [ ] mobile editing has not been exercised below `lg` yet

## Phase 5 — Live preview (Milestone 5)

- [x] 5.1 the renderer — one component, used by the catalogue, the Studio and the finished
      invitation. The claim is now provable rather than asserted
- [x] 5.2 desktop / mobile / full viewport modes, plus an edit↔preview switch that steps the
      panels aside
- [x] 5.3 Arabic and English rendering through the same content, localised at the block adapter
- [x] 5.4 empty optional fields — unit-tested for the cases customers actually hit: names only, a
      half-typed date, a venue without an address, one name without a dangling "و"
- [x] 5.5 **the customer-facing invitation** at `/[locale]/invitation`, private to the browser that
      owns the draft and marked `noindex`

### Why the invitation page was the real gap
The brief requires the preview to "use the same rendering logic as the eventual customer-facing
invitation". Without such a page there was nothing for the preview to agree with, so the claim was
untestable. It now exists, renders from the saved draft, and is reached through the same
`blocksFromContent` adapter the Studio uses.

Not built, and deliberately: sharing an invitation with guests. The brief forbids introducing
public invitation pages in Phase 1 unless explicitly scoped and protected.

### Guard
`tests/ui/check-renderer.mjs` — 11 expectations asserting there is exactly **one** renderer:
one file sizes an invitation canvas, one file applies a design's colours to a surface, and every
surface that shows an invitation imports `TemplateCanvas`. A second renderer would fail the build.
Its first version was too crude — it flagged the Studio's palette swatches, which *display*
colours rather than *painting* an invitation — so it now checks the act of painting.

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

## Phase 1 — remaining gaps (closed)

- [x] **1.2b Environment failure test** — child process with a closed environment
  - ✅ 13/13 unit tests: missing variable fails naming itself, public-only still fails, secret never echoed
- [x] **1.6b Guard negative control** — `tests/ui/guard-canary.mjs`
  - ✅ 11/11: each of the three UI gates is pointed at a planted violation and must exit non-zero

## Milestone 2 — Brand (in progress)

- [x] **2.1 Monogram** — folded-strip V, generated from one source by `npm run brand:build`
  - ✅ six SVG variants + app icon, deterministic build; rendered 16→160px on ivory and obsidian
- [x] **2.2 Brand guidelines** — `docs/BRAND.md`
  - ✅ including the record of the first attempt that failed on render
- [x] **2.3 Fonts** — self-hosted, subset, Arabic shaping verified
  - ✅ four families, 7 faces, **341 KB total**, OFL licences bundled, rebuilt by `npm run fonts:build`
  - ✅ verified by `npm run test:fonts`: nothing requested lost, joining features intact,
    no dangling glyph references. Aref Ruqaa `init/medi/fina/isol`; Plex Arabic `init/medi/fina/rlig`
  - ✅ **legibility test done, and it changed the CSS**: Aref Ruqaa is legible from ~24px up and
    turns into ornament below it, so `h3` was removed from the automatic display-face rule
- [x] **2.4 Outlined wordmark** — converted from the shipped Cormorant subset at weight 400
  - ✅ `scripts/build-wordmark.py` outlines V E L O R A via fontTools; no `<text>`, no font family
  - ✅ lockup + 3 lockup variants composed in `scripts/build-brand.mjs`
  - ✅ `npm run test:brand` (35 expectations) asserts no font dependency and that the lockup
    reuses the mark's and wordmark's **exact** path data
- [x] **2.5 Favicon and app icon** — verified
  - ✅ served at `/icon.svg` (`image/svg+xml`, 200); Next emits `<link rel="icon">` automatically
  - ✅ rendered and inspected: the ivory tile with the folded mark, fold visible at icon scale
- [x] **2.6 Direction-aware eyebrow** — `uppercase` and `letter-spacing` are Latin devices; attaching
  them to Arabic breaks the joins. Fixed with a `.eyebrow` class scoped to `[dir="ltr"]`

## Phase 10 — Hosting migration to CranL (ADDENDUM E) — **blocked on C0**

Source: reverse-engineered from the pasted ADDENDUM E only — no CranL docs were read when it was
written. Everything below is now verified against the live API; see `docs/CRANL.md`.

- [x] **C-1 Read the CranL docs** — quickstart, platform, applications, databases, storage,
      schedules, domains & SSL, environment variables, deployments, GitHub integration, monitoring,
      analytics, volumes, billing, CLI, regions, MCP, safety controls
  - ✅ pages fetched and read (a Sphinx site; text extracted, not skimmed)
- [x] **C-2 Verify capability against the live account, not the docs**
  - ✅ `get_account` → plan **free**: 1 project, **2 apps+databases**, **0 custom domains**,
    **0 buckets**, `mena_regions: false`, only `netherlands-1` available
  - ✅ `preflight_deploy` on this working tree → `ready: true`, **Next.js**, `npm start`,
    port 3000 detected, 123 files/3.4 MB — the production build finally has a real target
  - ✅ `cranl` CLI **cannot run here** (glibc ARM64 binary vs musl+PRoot). Replaced by
    `/usr/local/bin/cranl-api`, a REST client over the same operations. Nothing is blocked by it
- [x] **C1 Provision what the free plan allows** — done: database `velora` (`10ca540d`,
      `netherlands-1`) + app `velora` (`b579fd2e`, `https://velora-lnurqz.cranl.net`), `DATABASE_URL`
      injected, `NEXT_PUBLIC_SITE_URL` set, four green builds
  - ✅ deferred: bucket, cron jobs, custom domain — all need Pro (see the blocker below)
- [ ] **C0 Owner: upgrade to Pro · connect GitHub · name the domain** — hard prerequisite for the rest
  - Pro is the **minimum** plan that satisfies the addendum (`riyadh-1` MENA + 1 bucket + custom
    domains). `Basic` does not; `Free` cannot
- [x] **C2a The operator schema, in production** — `db/migrations/0001_operator_baseline.sql`
  - ✅ applied 2026-11-18 13:51:31Z (checksum `3b3e42d444d319c3`); tables, 5 `updated_at` triggers
    and the seeded `+97366661238` **read back out of the live database**
  - ✅ `tests/db/operator-schema.mjs` → **32/32** on real PostgreSQL (PGlite/WASM): structure, the
    seeded row, the round trip, 11 named constraint refusals, cascade delete
  - ✅ `scripts/db-migrate.mjs` — transactional, refuses a changed applied migration, run inside the
    container via `run_command` (no port opened to migrate)
- [x] **C6a Health endpoint** — `/api/health` live; reports failure *class*, latency and the applied
      migration, and never the driver's message unless `HEALTH_VERBOSE=1`
  - ✅ it found the first real deployment bug in 66 ms: TLS was being forced on a socket that does
    not speak it. `ssl` is now enabled only when the connection string asks for it
- [ ] C2b Drizzle as the typed access layer (AD-14) · carry the 6 designs into `templates` · seed
- [ ] C3 Authorization into the application layer; the token route is the only public read
- [ ] C3 Authorization into the application layer; the token route is the only public read
- [ ] C4 Single-admin credentials auth (argon2id, sessions, rate limiting, optional TOTP)
- [ ] C5 Storage interface + CranL S3 driver (signed URLs)
- [ ] C6 Cron as container commands · health endpoint · logging · documented snapshot/restore
- [ ] C7 README: setup, migrations, password rotation, backup restore, WhatsApp API later

## Blockers

- **B1 — Supabase project not provisioned.** ~~The configured access token is scoped and lacks
  `organizations_read`...~~ **Superseded 2026-11-18 by ADDENDUM E**: Supabase is no longer part of
  the architecture and this blocker is closed with it. Kept as a record.
- **B3 — CranL plan limits (new).** The account is on the **free** plan, which cannot provide the
  MENA database region, object storage or a custom domain that ADDENDUM E requires. Waiting on the
  owner to upgrade to Pro. This is the only thing standing between the current code and a live
  deployment on CranL.
- **B2 — Payment provider not selected** (by design). Phase 1 ships the abstraction and manual
  recording; activation requirements are documented.

## Out of scope for the envelope work — features that need database and policy changes

Recorded 2026-11-21 from the reference study (`replica/recon.md`). These are the rows of that map
that touch **guest data**, and guest data is not the envelope's business. They are **not** in G3, no
migration has been written, and no schema is proposed below — this is a statement of what each one
would reach, so that "small feature" is not mistaken for "small change" when it is scheduled.

The test for landing in this list: does it write guest data, read guest data belonging to one guest
back to other guests, or attach a new public surface to the token route? If yes, it needs a
migration, a policy, and a decision about retention — three things an envelope layer must not smuggle
in.

| Feature | What it would touch | Why it is not envelope work |
| --- | --- | --- |
| **Wishes wall / guestbook** | a new relation for the wishes themselves, keyed to the event and to the guest who wrote it; a write path reachable by a guest who has **no account** (the token is the only credential); a read path that shows one guest's words to **every other guest**, which is a different disclosure from anything currently in the product; a moderation/removal path for the operator; a policy question the product does not yet answer — can a guest delete their own wish, and does deleting the guest delete the wish | It creates a public read surface over guest-authored content. Every existing public surface reads the *host's* content and one guest's own row. This is the first one where guests read each other |
| **QR entry pass + check-in** | a per-guest credential (the pass) that must be unguessable and revocable; a check-in event with a timestamp and an actor (who scanned); an operator surface that works at a door, on a phone, possibly offline; a decision about what the scanner may see (a name? a hall? a party size?) because the person holding the scanner is not the host; a retention rule for arrival data | It adds a second credential per guest and a second actor (the door) to the data model. It also has a physical-world failure mode — no signal at the venue — which is a design constraint nothing else here has |
| **Per-guest personal font** | a per-guest style preference; a rule that a guest's chosen face must still carry legible text (Aref Ruqaa is display-only below ~24px, per the 2.3 legibility test); if the guest picks it, an unauthenticated write, and if the host picks it, an operator surface over a per-guest field | It is a per-guest field that changes typography — so it collides with the fixed type scale (names 44–52px, DESIGN.md §6) that exists to keep the invitation legible. It is a design-system question before it is a database question. **No reference product implements it** — see recon §2 |
| **Per-guest personal line** | **already exists** — `guests.personal_line_ar` / `personal_line_en`, read by the token route and rendered under the greeting (T1 E2) | Listed only because the brief grouped it with the others. No new migration, no new policy. The work that remains is the per-guest *font*, above, not the line |

### The rule this list is protecting

The envelope, the seal and the invitation canvas are **presentation**. A feature that writes guest
data, or lets one guest see another's, changes the product's privacy surface — and that decision
belongs with the owner, in front of a migration, not inside a commit that was nominally about a
flap.
