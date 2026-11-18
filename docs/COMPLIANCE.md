# Compliance audit — the brief vs. the repository

**Date:** 2026-11-18 · **Commit:** `55b6f34` + the live CranL deployment
**Method:** every row was checked against the code, the tests, or the running deployment in this
session. Nothing here is recalled from earlier reports. Where a claim could not be checked, the
status says so instead of guessing.

Status key: ✅ done and verified · 🟡 partial · ❌ not started · 🔒 blocked on the owner or the plan ·
⤵️ superseded by ADDENDUM E

**Headline: the brief is not complete.** What exists is the *brand, type, catalogue and rendering*
half of the product, plus a live deployment and, as of this session, the operator database. The
operator workflow the brief describes — events, guests, per-guest links, RSVP — has a **schema in
production and no application behind it**. That is not a surprise: the owner ruled on 2026-11-18 that
the pasted brief (and not the self-service product built over the previous five milestones) is the
spec. This audit is the starting line for that pivot, itemised.

**Live now, verified:** `https://velora-lnurqz.cranl.net` (app) and a managed PostgreSQL carrying the
operator schema. `GET /api/health` returns `{"status":"ok","checks":{"database":{"ok":true,"latencyMs":69},
"migrations":{"applied":"0001_operator_baseline.sql","pendingCheck":"ok"}}}`. The tables, the trigger
set and the seeded `+97366661238` were read back out of the production database, not inferred.

---

## A. PRODUCT MODEL

| # | Requirement | Status | Evidence |
|---|---|---|---|
| A1 | One user only — the operator. No public sign-up, no customer accounts, no roles, no multi-tenancy | ❌ | The repository implements the opposite: `profiles`, `roles`, `user_roles`, and a locked decision "full customer accounts". Nothing of the operator model exists |
| A2 | Couple → WhatsApp → operator logs in → creates an Event → adds guests → unique link per guest | ❌ | No `events` table, no `guests` table, no `/admin` route of any kind (`rg --files src/app` → 5 pages, all public) |
| A3 | Guest opens the link → luxury invitation + countdown → confirm/decline → operator tracks it | ❌ | No `/i/[token]` route, no RSVP, no countdown, no open tracking |
| A4 | `+97366661238` stored in Settings as the default sender, used as the "from" identity everywhere (templates, footer, wa.me) | ❌ | `rg '97366661238'` over the whole repository returns **zero hits**. The number does not appear anywhere in the code |

## B. BRAND IDENTITY

| # | Requirement | Status | Evidence |
|---|---|---|---|
| B1 | The supplied logo used as the brand mark (header, favicon, loading, share preview) | 🟡 | The **owner's earlier decision** replaced the supplied botanical artwork with a folded-paper monogram; it is built, tested (35 brand expectations) and emitted as `src/app/icon.svg`. The favicon is verified; the loading screen and OG image do not exist |
| B2 | Palette: warm gold `~#B08D57`, deep brown `~#5A3E2B`, cream `~#FAF3EA`, soft tonal variations | 🟡 | Tokens exist and are measured (21/21 contrast pairs, one required failure fixed by deriving `--gold-deep`). The brief's exact three values are not the measured set — the owner's palette won in Milestone 1 and is documented in `docs/BRAND.md` |
| B3 | Mood: quiet luxury, generous whitespace, translucent leaf-shadow backgrounds, thin gold hairlines, star/diamond divider | 🟡 | Whitespace and restraint: yes. `rg` for `leaf-shadow`, `divider`, `hairline ornament`, `particle` → **no matches in `src/`**. The ornament vocabulary (hairline frame, short rule) exists *inside template design configs*, not as page furniture |
| B4 | Typography: Arabic calligraphic display (Aref Ruqaa / Mirza / Katibeh), Amiri/Naskh for verses, Latin serif display, light sans for small caps | ✅ | Four families, 7 faces, 341 KB total, OFL licences bundled, Arabic shaping verified by `npm run test:fonts` (joining features intact, no dangling glyph refs) |
| B5 | Full RTL, Arabic default, English via toggle | ✅ | Live check: `https://velora-lnurqz.cranl.net/ar` returns `<html lang="ar" dir="rtl">`; `npm run test:rtl` guard; logical CSS properties enforced |
| B6 | Avoid generic template looks | 🟡 | Judgement, not a gate. The catalogue renders through a shared, custom renderer rather than a component-library template — that is the structural half of the requirement |

## C. TECH STACK

| # | Requirement | Status | Evidence |
|---|---|---|---|
| C1 | Next.js (App Router) + TypeScript + Tailwind | ✅ | Next 14.2, TS strict, Tailwind with CSS custom-property tokens |
| C2 | Supabase (Postgres, Auth, RLS) + Vercel | ⤵️ | Superseded by ADDENDUM E. CranL application **and** database now exist (see §J) |
| C3 | `next/font`, image optimisation, server rendering | 🟡 | Fonts are **self-hosted subsets** (a deliberate deviation, justified by Arabic shaping control) rather than `next/font`; `images.remotePatterns` still points at `*.supabase.co` and must be repointed; server rendering is in use |
| C4 | `.env.example` and clear setup docs | 🟡 | `.env.example` exists but documents the **old** stack (Supabase keys); it has not been rewritten for CranL, and the README's CranL section does not exist yet |
| C5 | Prefer free, commercially-licensed resources; verify licences | ✅ | Licences bundled under `public/fonts/licenses`; the wordmark is outlined from the shipped subset, so no commercial font is redistributed |

## D. DATA MODEL

| # | Requirement | Status | Evidence |
|---|---|---|---|
| D1 | `events` (all fields incl. Hijri text, template, theme overrides, status) | 🟡 | **Table is live in production** (verified by query): every field in the brief, bilingual names/venue/quote/notes/thank-yous/dress code, `features` for the per-event switches, plus constraints. **No application code reads or writes it yet** |
| D2 | `guests` (E.164 phone, category, max companions, unguessable unique token, send/open tracking) | 🟡 | Table live in production with all of the above plus `language` and the ADDENDUM D2 personal line. The E.164 check refuses a phone with Arabic-Indic digits; the token check refuses anything under 22 characters. **No token generation code yet** |
| D3 | `rsvps` (response, companions, `responded_at`, `updated_at`) | 🟡 | Table live in production, one row per guest (`unique(guest_id)`), so changing an answer updates rather than duplicates. A decline that still claims companions is refused by constraint. **No code yet** |
| D4 | `templates` (preview image, palette, fonts, opening animation, layout config) | 🟡 | The **new** `templates` table is live with `palette`, `fonts`, `opening_animation_type` and `layout_config`, and is **empty** — the 6 designs that exist in `supabase/migrations` are the *other* product's seeds (Ivory Classic, Emerald Royal, Sand Editorial, …) and have not been carried across. The brief names six themes (classic gold, marble, floral, desert/palm, minimal, royal dark); reconciling names and designs is a design decision, not a mechanical one |
| D5 | `settings` (whatsapp_number default `+97366661238`, AR/EN message templates, logo_url) | 🟡 | Table live in production as a **single row enforced by a check constraint**, already carrying `+97366661238` and `Asia/Bahrain` — read back out of the database. The AR/EN message bodies and `logo_url` are still empty |
| D6 | All admin tables private; public access only through a token route returning the minimum; phone numbers never public | ❌ | The RLS-based design was the answer to this; ADDENDUM E removes RLS, so it must be rebuilt in the application layer. Neither version exists on CranL |

## E. ADMIN DASHBOARD (private)

All eight items — events list with confirmation rate · event editor with phone-frame live preview and
"copy preview link" · guest management (paste list, Excel/CSV with validation, duplicate detection,
Gulf phone normalisation) · WhatsApp sending (per guest + sequential mode, provider interface) ·
RSVP dashboard with charts · Excel attendance export · template presets (6 designs) ·
settings (number, message templates, logo, timezone) — are **❌ not started**, with one exception:

| # | Requirement | Status | Evidence |
|---|---|---|---|
| E2 (part) | Live preview inside a phone frame | 🟡 | The Wedding Studio built in Milestone 4 **does** render through the same renderer as the final invitation, in a device frame, with viewport modes (390px / 720px / full). It has no event editor, no "copy preview link" |
| E7 (part) | At least 6 luxury templates, reusable presets | 🟡 | 6 template rows exist with distinct palettes and layouts; they are **read-only seeds** — there is no create/edit UI |

There are **no admin routes at all** (`rg --files src/app | rg admin` → empty).

## F. PUBLIC INVITATION PAGE `/i/[token]`

| # | Requirement | Status | Evidence |
|---|---|---|---|
| F1 | Elegant opening animation with `prefers-reduced-motion` handling and a skip control | ❌ | Absent (and the wax-seal entrance of ADDENDUM D is the specified form of it) |
| F2 | Personalised greeting with the guest's name | ❌ | The private preview page renders "Bride and Groom" sample content, not a guest |
| F3 | Couple's names in Arabic calligraphic face | 🟡 | The renderer draws names in the display face; the page itself is a *private draft preview* keyed to an httpOnly draft cookie, not a public per-guest route |
| F4 | Verse / quote · notes · venue + "Open in Maps" | 🟡 | Verse, venue and notes are supported by the template content model and rendered; no Maps action, no public route |
| F5 | Live countdown in the event's timezone, graceful after the event | ❌ | No countdown code anywhere |
| F6 | Hijri **and** Gregorian dates | ❌ | Absent (`Intl` is used for money and dates in the catalogue only) |
| F7 | RSVP confirm/decline with a companion cap, answers changeable | ❌ | Absent |
| F8 | Different thank-you message for confirm vs decline | ❌ | Absent |
| F9 | Correct `.ics` (+ timezone) and a Google Calendar link | ❌ | Absent |
| F10 | Record first open and open count only | ❌ | Absent |
| F11 | 100% mobile-first, fast (Lighthouse 90+), accessible, RTL-correct | 🟡 | RTL-correct ✅ (guarded). Mobile behaviour verified at 390px for the Studio ✅. **Lighthouse has never been run** — no performance number exists |
| F12 | Hidden from search: noindex/nofollow, `X-Robots-Tag`, robots.txt, unguessable tokens | 🟡 | The invitation preview already sets `robots: noindex` (verified in Milestone 5) and the app returns security headers. No `X-Robots-Tag` header, no `robots.txt`, no tokens yet |
| F13 | Tasteful Open Graph preview that leaks nothing | ❌ | No `og:image` or OG tags in the codebase |
| F14 | Discreet footer with the Velora mark and a WhatsApp link to `+97366661238` | ❌ | A footer exists; the number is nowhere in the repository |

## G. SECURITY & PRIVACY

| # | Requirement | Status | Evidence |
|---|---|---|---|
| G1 | Admin authentication · input sanitisation · rate limiting on public endpoints · CSRF-safe mutations · secure headers | 🟡 | Secure headers ✅ (`next.config.mjs`: HSTS, nosniff, DENY frame, referrer policy, permissions policy). Sanitisation ✅ via zod schemas. **Admin auth, rate limiting, CSRF: absent** — and ADDENDUM E specifies exactly how they must be built |
| G2 | Short AR/EN privacy notice on the public page | ❌ | Absent |
| G3 | Ability to permanently delete an event and all its guest data | ❌ | Absent |
| G4 | Backup guidance in the README | ❌ | CranL exposes `snapshot_database` / `restore_database_snapshot`; nothing is documented yet |

## H. ACCEPTANCE CRITERIA

| # | Criterion | Status |
|---|---|---|
| H1 | Full event + 50 guests from Excel + links + manual WhatsApp send in under 10 minutes | ❌ cannot be attempted — none of it exists |
| H2 | Flawless rendering on iPhone and Android in AR/RTL and EN | 🟡 Arabic RTL verified in a real browser at 390×844 and 1280×800 by geometry measurement; **no physical iOS/Android device has ever opened it** |
| H3 | Accurate countdown · `.ics` opens · RSVP appears immediately | ❌ |
| H4 | No invitation page is indexable | 🟡 true for the one invitation page that exists (noindex + private cookie), untested for the public route that does not exist |
| H5 | WhatsApp messages and `wa.me` links consistently use `+97366661238` | ❌ no such code exists |

## I. ADDENDA A–D

**ADDENDUM A (ultra-luxury typography)** — 🟡
Done: Arabic calligraphic display in place (Aref Ruqaa) verified in context; Latin display
(Cormorant Garamond) variable, pinned and subset; generous Arabic line-height; letter-spacing
correctly scoped to Latin only (`[dir="ltr"]` guard, because attaching it to Arabic breaks joins);
OFL, self-hosted, subset, preloaded.
Not started: 3 named pairing presets per template; the delicate script (Pinyon/Great Vibes) for
flourishes; the **gold-foil gradient with shimmer**; thin gold hairline + star/diamond dividers as
page furniture; tashkeel/kashida handling for the couple's names; the **Arabic-Indic vs Western
numeral toggle** — and here the repository currently *contradicts* the addendum: `src/lib/money.ts`
enforces Latin digits unconditionally, so the addendum's "default Arabic-Indic in Arabic mode"
would be a behaviour change, not an addition.

**ADDENDUM B (bilingual invitation with a guest language switch)** — 🟡
Done: the page is genuinely bilingual at the routing level (`/ar`, `/en`, `dir`/`lang`/font per
locale), strings are externalised in `messages/{ar,en}.json`, and a language switch exists.
Not started: bilingual **event fields**; per-guest default language; instant switch that does not
restart the opening animation, persisted in a cookie and via `?lang=`; flipping number style and
date format; bilingual WhatsApp message templates; per-language Open Graph text; "Auto-translate
draft" for operator review.

**ADDENDUM C (signature experience, 12 features)** — ❌ all twelve
1 wax-seal envelope · 2 monogram generator from the couple's initials · 3 schedule timeline ·
4 dress code & venue notes · 5 personal QR entry pass + scan screen · 6 wishes wall ·
7 gentle reminders for non-responders · 8 optional ambient music · 9 couple story/gallery ·
10 after-event page · 11 ambient gold particles / leaf shadows · 12 per-guest personal line.
`rg` for each concept's vocabulary returns nothing. The only related asset is the brand monogram
(a fixed mark, not a generator).

**ADDENDUM D (core features)** — ❌
D1 wax-seal opening (sequence, calligraphy on the envelope, monogram seal, tap prompt, crack and
reveal, per-template seal colours, skip control, reduced-motion fallback, first-open-only,
preview-replay button, monogram generator with upload) and D2 personal line (per-guest AR/EN field,
dashboard inline editing, CSV column, bulk apply by category, "preview as guest", private to the
guest, length limits enforced on both sides) are **entirely absent**.

## J. ADDENDUM E (hosting & backend on CranL)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| J1 | Read the CranL docs before building (quickstart, platform, databases, storage, cron, domains, CLI) | ✅ | 28 pages fetched and read; recorded in `docs/CRANL.md`. Four deviations found and documented rather than guessed |
| J2 | Use the CranL MCP/CLI to provision | 🟡 | The CLI **cannot run here** — glibc ARM64 binary under musl+PRoot (`Not a valid dynamic program`). Replaced by `/usr/local/bin/cranl-api`, a REST client over the same 289 documented operations. Everything below was provisioned with it |
| J3 | One Next.js app deployed from a GitHub repository, automatic build on push | 🟡 | App **created and running**: `velora` (`b579fd2e`), https://velora-lnurqz.cranl.net. Four deployments have built successfully on CranL's builders (the first production builds this project has ever had — this device cannot run `next build`), `/ar` serving `<html lang="ar" dir="rtl">`. It is created from the public clone URL, so pushes do not yet deploy: deploys are triggered through the API until the owner connects GitHub 🔒, after which `update_app_source` switches it |
| J4 | Backend logic inside Next.js — no separate service | ✅ | Only one application exists |
| J5 | Managed PostgreSQL in MENA, same region as the app, private connection string | 🔒 | **Deviation, owner-chosen:** the account is on the free plan, which cannot use `riyadh-1`. Database `velora` (`10ca540d`) runs in `netherlands-1`, same region as the app, internal host `velora-q2hbtb`, `DATABASE_URL` injected; the app reaches it in **69 ms** (`/api/health`). Riyadh needs Pro |
| J6 | Prisma or Drizzle + versioned migrations applied on deploy + seed script | 🟡 | Versioned migrations **exist and have run in production**: `db/migrations/0001_operator_baseline.sql`, applied 13:51:31Z, checksum `3b3e42d444d319c3`, driven by `scripts/db-migrate.mjs` (transactional, refuses a changed applied migration) and verified by `tests/db/operator-schema.mjs` — 32/32 on real PostgreSQL. **Drizzle is not installed yet** (AD-14's access layer), and seeding stops at the settings row |
| J7 | Application-layer authorization; the only public surface is a token route returning the minimum | ❌ | Not started |
| J8 | Single-admin credentials login (argon2/bcrypt, httpOnly session cookies, rate limiting + lockout, optional TOTP, password change); initial credentials from environment variables | ❌ | Not started |
| J9 | S3-compatible object storage with signed URLs, CDN-served images | 🔒 | Storage buckets are a **Pro** feature; the free plan allows 0. Until then, assets live in the repo/container and the gap is documented |
| J10 | Cron jobs for mark-ended, reminder lists, temp-file cleanup, protected by a secret token | ❌ | No jobs created and no code to run. Recorded deviation: CranL Schedules execute a shell command **inside the container** (UTC), so the command is `node scripts/cron.mjs <job>` and no public endpoint or shared secret is needed |
| J11 | Custom domain + automatic SSL, HTTPS, HSTS, secure headers, CSP | 🔒 | HSTS and the other security headers are in `next.config.mjs` ✅; **CSP is not** defined yet; a custom domain is a Pro feature (0 allowed on free) and no domain has been chosen |
| J12 | All secrets in CranL environment variables, never in the repo; `.env.example` | 🟡 | `DATABASE_URL` is injected by CranL and `NEXT_PUBLIC_SITE_URL` is set (masked in the API). The connection string is stored **0600 outside the repository**. `.env.example` still describes Supabase |
| J13 | Reliability: health-check endpoint, structured logging, error reporting, analytics; automated backups and a documented restore | 🟡 | **`/api/health` exists, is live, and earned its keep immediately** — it returned `"Client network socket disconnected before secure TLS connection was established"` from inside the container and turned a 21-second mystery into a one-line fix. It reports the class of failure, never the driver's message, unless `HEALTH_VERBOSE=1`. Still missing: structured logging, error reporting, a snapshot, and a rehearsed restore |
| J14 | Performance: cached static assets, never-cached per-guest data | 🟡 | The private invitation page is correctly non-public; explicit cache policy per route is not written |
| J15 | Git workflow: `main` auto-deploys; staging if the plan allows; Dockerfile only if needed | 🟡 | Auto-deploy 🔒 (waits on GitHub). Staging 🔒 — the free plan allows **2 resources total** and both are now used (1 app + 1 database). **No Dockerfile is needed**: `preflight_deploy` detected Next.js, `npm start`, port 3000 without one |
| J16 | README additions: CranL setup, migrations, admin-password rotation, backup restore, enabling WhatsApp Business API later | ❌ | Not written — deliberately, because it would document commands that do not exist yet |
