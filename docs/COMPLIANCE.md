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
operator schema and the admin tables. The operator console exists: `/ar/admin` redirects to a
sign-in form, and submitting it exercises the whole path — server action, argon2id verification,
attempt log, redirect, rendered Arabic error. Verified in a real browser against production, not
inferred. `GET /api/health` returns `{"status":"ok","checks":{"database":{"ok":true,"latencyMs":69},
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
| D1 | `events` (all fields incl. Hijri text, template, theme overrides, status) | ✅ | Table in production, and now **written by the console**: create, list, edit, every bilingual field the brief names, a design per event, and a status. Saving is separate from being ready — `eventReadiness()` names exactly what is missing before a send |
| D2 | `guests` (E.164 phone, category, max companions, unguessable unique token, send/open tracking) | ✅ | Add one at a time or paste a list: 160-bit tokens generated server-side, Gulf phone normalisation (every written form, `+`/`00`/trunk, spaces, dashes, Arabic-Indic digits, RTL marks), category, companion limits, the per-guest personal line in both languages, and send / first-open / open-count tracking. 14 unit tests plus a live round trip |
| D3 | `rsvps` (response, companions, `responded_at`, `updated_at`) | 🟡 | Table in production, one row per guest, a decline with companions refused by constraint. **Still no RSVP surface** — that is Phase 2, and the token route currently renders the invitation without one |
| D4 | `templates` (preview image, palette, fonts, opening animation, layout config) | ✅ | **8 designs** seeded from the collection built earlier (Ivory Classic, Emerald Royal, Sand Editorial, Paper Minimal, Rose Letterpress, Sage Botanical, Naskh Heritage, Ink Noir), each with a full `design_config`, selectable per event, plus `opening_animation_type`. The three columns that config replaced (`palette`, `fonts`, `layout_config`) were **dropped**, because two descriptions of one design drift apart. The brief's six theme names are not the built set: renaming designs is the owner's decision, not a mechanical one |
| D5 | `settings` (whatsapp_number default `+97366661238`, AR/EN message templates, logo_url) | 🟡 | Single row in production carrying `+97366661238` and `Asia/Bahrain`; the per-guest WhatsApp deep link is built from it, and the AR/EN message templates exist as code defaults with `{guest_name}`/`{link}`. They are **not yet editable in the console**, and `logo_url` is unused |
| D6 | All admin tables private; public access only through a token route returning the minimum; phone numbers never public | ❌ | The RLS-based design was the answer to this; ADDENDUM E removes RLS, so it must be rebuilt in the application layer. Neither version exists on CranL |

## E. ADMIN DASHBOARD (private)

All eight items — events list with confirmation rate · event editor with phone-frame live preview and
"copy preview link" · guest management (paste list, Excel/CSV with validation, duplicate detection,
Gulf phone normalisation) · WhatsApp sending (per guest + sequential mode, provider interface) ·
RSVP dashboard with charts · Excel attendance export · template presets (6 designs) ·
settings (number, message templates, logo, timezone) — are **❌ not started**, with one exception:

| # | Requirement | Status | Evidence |
|---|---|---|---|
| E1 | Events list with guest count and confirmation rate | ✅ | The console lists events with guests, confirmed, declined and no-response counts — each a real query |
| E2 | Event editor with a live preview and a "preview link" | ✅ | Every field the brief lists, bilingual, with a design per event; saving reports readiness by field name. "Preview as guest" renders what one guest sees **without counting an open** — a preview that inflated `open_count` would make the RSVP dashboard lie |
| E7 (part) | At least 6 luxury templates, reusable presets | 🟡 | **8 designs are seeded and selectable per event**, so the "reusable presets" half is done. Creating or editing a design from the console is not built |

There are **no admin routes at all** (`rg --files src/app | rg admin` → empty).

## F. PUBLIC INVITATION PAGE `/i/[token]`

| # | Requirement | Status | Evidence |
|---|---|---|---|
| F1 | Elegant opening animation with `prefers-reduced-motion` handling and a skip control | ✅ | The wax-seal entrance: sealed envelope, the guest's name on it, a gold seal bearing the couple's monogram, a prompt, and on tap the seal breaks and the card rises out. CSS and inline SVG only — no video. Reduced motion **removes** the sequence rather than shortening it, the invitation is in the DOM underneath it either way, and Skip is a real button outside the decorative region |
| F2 | Personalised greeting with the guest's name | ✅ | `/i/<token>` greets the guest by name, in the language on their row, and shows their personal line under it |
| F3 | Couple's names in Arabic calligraphic face | ✅ | The public page renders through `TemplateCanvas` — the same component the catalogue and the Studio use, so the brief's "same rendering logic" requirement holds with no second renderer to drift from it |
| F4 | Verse / quote · notes · venue + "Open in Maps" | ✅ | All four on the public page, in the guest's language, with the map button appearing only when the operator stored a link |
| F5 | Live countdown in the event's timezone, graceful after the event | ✅ | Target is an absolute instant, so the countdown is identical for a guest in Manama or London; the date beside it is formatted in the **event's** zone, not the guest's. The server renders the first value and the client ticks, so hydration matches and there is no flash of zeros. After the event it stops and says so |
| F6 | Hijri **and** Gregorian dates | 🟡 | The Gregorian date is formatted per guest language and in the **event's** timezone, and a Hijri line shows when the operator typed one. Auto-computation is not there: it needs a conversion library, and the brief's own wording is "auto-computed, manually editable" |
| F7 | RSVP confirm/decline with a companion cap, answers changeable | ✅ | The cap comes from the guest's row, not the form: a guest allowed two cannot answer with five by editing the request. One row per guest, updated in place, so the operator's count is the latest answer and never a sum of revisions. Declining forces zero companions. Answering is not counted as an open |
| F8 | Different thank-you message for confirm vs decline | ✅ | The operator's own words from the event when they wrote them, in the guest's language, with a plain default when they did not |
| F9 | Correct `.ics` (+ timezone) and a Google Calendar link | ✅ | RFC 5545: CRLF, 75-octet folding that never splits a UTF-8 sequence, escaping that leaves the Arabic comma alone, `VTIMEZONE` for fixed-offset zones and UTC for the rest. Served as `text/calendar` with `no-store`, and downloading it is not an open. The guest's name is deliberately not in the file |
| F10 | Record first open and open count only | ✅ | Recorded in the same statement that reads the row, so a double open counts twice without a read-modify-write race, and `first_opened_at` never moves. Asserted: three opens → count 3, timestamp unchanged; the operator's preview counts zero |
| F11 | 100% mobile-first, fast (Lighthouse 90+), accessible, RTL-correct | 🟡 | RTL-correct ✅ (guarded). Mobile behaviour verified at 390px for the Studio ✅. **Lighthouse has never been run** — no performance number exists |
| F12 | Hidden from search: noindex/nofollow, `X-Robots-Tag`, robots.txt, unguessable tokens | ✅ | Four controls on one page: `robots` metadata, an `X-Robots-Tag` header, `robots.txt` disallowing `/i/` and the console, and `Cache-Control: no-store, private`. Tokens are 160 random bits, and a malformed token is rejected before it reaches SQL |
| F13 | Tasteful Open Graph preview that leaks nothing | 🟡 | A generic title and description in the guest's language ("A wedding invitation") say nothing about the couple, the date or the guest. No `og:image` yet |
| F14 | Discreet footer with the Velora mark and a WhatsApp link to `+97366661238` | 🟡 | The public page carries a discreet Velora footer. The **guest's** message goes out from `+97366661238` (it is the `wa.me` sender for every guest), but the footer itself has no contact link to it yet |

## G. SECURITY & PRIVACY

| # | Requirement | Status | Evidence |
|---|---|---|---|
| G1 | Admin authentication · input sanitisation · rate limiting on public endpoints · CSRF-safe mutations · secure headers | ✅ | argon2id, DB-backed sessions, lockout, address limiting, timing-equalised unknown emails, **TOTP two-factor** (RFC 6238, verified against the RFC's own vectors, single-use codes), password change that **revokes every other session**, `sameSite: strict` + origin checks, and a **strict CSP** with a per-request nonce. The one public-endpoint rate limit still missing belongs to the RSVP route, which does not exist yet |
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
| J8 | Single-admin credentials login (argon2/bcrypt, httpOnly session cookies, rate limiting + lockout, optional TOTP, password change); initial credentials from environment variables | ✅ | All of it: argon2id, `httpOnly`/`SameSite=strict`/`secure` sessions with hashed tokens, lockout and address limits, `/admin/settings` for the password, TOTP enrolment with a verified-code confirmation, and `scripts/seed-admin.mjs --reset [--disable-totp]` as the documented recovery path |
| J9 | S3-compatible object storage with signed URLs, CDN-served images | 🔒 | Storage buckets are a **Pro** feature; the free plan allows 0. Until then, assets live in the repo/container and the gap is documented |
| J10 | Cron jobs for mark-ended, reminder lists, temp-file cleanup, protected by a secret token | ❌ | No jobs created and no code to run. Recorded deviation: CranL Schedules execute a shell command **inside the container** (UTC), so the command is `node scripts/cron.mjs <job>` and no public endpoint or shared secret is needed |
| J11 | Custom domain + automatic SSL, HTTPS, HSTS, secure headers, CSP | 🟡 | HSTS, `nosniff`, `DENY`, referrer and permissions policies, plus a **strict CSP** (`script-src` with a per-request nonce and `strict-dynamic`, no `unsafe-inline`, no `unsafe-eval`; `style-src` allows inline styles, which is a recorded gap rather than a hidden one). A custom domain is still a Pro-plan feature, so it stays blocked |
| J12 | All secrets in CranL environment variables, never in the repo; `.env.example` | 🟡 | `DATABASE_URL` is injected by CranL and `NEXT_PUBLIC_SITE_URL` is set (masked in the API). The connection string is stored **0600 outside the repository**. `.env.example` still describes Supabase |
| J13 | Reliability: health-check endpoint, structured logging, error reporting, analytics; automated backups and a documented restore | 🟡 | **`/api/health` exists, is live, and earned its keep immediately** — it returned `"Client network socket disconnected before secure TLS connection was established"` from inside the container and turned a 21-second mystery into a one-line fix. It reports the class of failure, never the driver's message, unless `HEALTH_VERBOSE=1`. Still missing: structured logging, error reporting, a snapshot, and a rehearsed restore |
| J14 | Performance: cached static assets, never-cached per-guest data | 🟡 | The private invitation page is correctly non-public; explicit cache policy per route is not written |
| J15 | Git workflow: `main` auto-deploys; staging if the plan allows; Dockerfile only if needed | 🟡 | Auto-deploy 🔒 (waits on GitHub). Staging 🔒 — the free plan allows **2 resources total** and both are now used (1 app + 1 database). **No Dockerfile is needed**: `preflight_deploy` detected Next.js, `npm start`, port 3000 without one |
| J16 | README additions: CranL setup, migrations, admin-password rotation, backup restore, enabling WhatsApp Business API later | ❌ | Not written — deliberately, because it would document commands that do not exist yet |

---

## K. Where the console stands (end of this session)

What a reader can do today on the live deployment:

| Route | Behaviour | Verified |
|---|---|---|
| `/ar/admin`, `/en/admin` | 307 → the sign-in form (middleware; no session cookie) | `curl`, both locales |
| `/ar/admin/login` | 200, renders in RTL in the display face | screenshot |
| submit the form | server action → argon2id verification → attempt recorded → redirect with `?error=` → Arabic message rendered | screenshot, in a real browser against production |
| `/api/health` | `{"status":"ok","database":{"ok":true,"latencyMs":53},"migrations":{"applied":"0002_admin_auth.sql"}}` | `curl` |

What is **not** there yet: an account. `scripts/seed-admin.mjs` is written, tested and refuses a weak
password — but the first password is the owner's to choose, and it is not one this agent will invent
and then print into a chat log.

---

## L. Phase 1 — what landed after this audit was written

The rows above were written when the operator product did not exist. This is the current state of
the ones that moved, and it supersedes them where they disagree.

| Item | Status | Evidence |
|---|---|---|
| Events: create, list, edit, every bilingual field | ✅ | `src/features/events/*`; the DB suite drives it against real PostgreSQL |
| Guests: add, paste, import with a preview, phone normalisation, categories, companion limits, personal lines, tokens | ✅ | `src/features/guests/*`; **14 unit tests** — every written form of a Bahraini number, Arabic-Indic digits, RTL marks, a 50-row paste, duplicates reported not merged, and one bad row never destroying an import |
| Token generation, and the per-guest link | ✅ | `newGuestToken()` — 160 bits, generated server-side; 200 tokens asserted distinct |
| `/i/<token>` | ✅ | Public route outside the locale tree; `noindex` + `no-store` + `X-Robots-Tag` + `robots.txt`; first open recorded; the minimum-data property asserted by loading two guests into one event and checking one page contains nothing about the other |
| Operator preview that does not count as an open | ✅ | `/admin/events/<id>/preview/<guestId>`; asserted that `open_count` does not move |
| Migration path | ✅ | `scripts/db-migrate.mjs` — transactional, checksum-guarded, run inside the container |

Not built, and not claimed:

| Item | Why it is where it is |
|---|---|
| Excel/CSV **file upload** | Pasted text is supported — which is what a spreadsheet produces: tab- or comma-separated, header optional, Arabic or English, quoted fields handled. Uploading a `.xlsx` file is a separate slice |
| Sequential send mode and the WhatsApp Business provider interface | Per-guest `wa.me` links and "mark sent" exist; the sequential walk-through and the provider seam belong to the sending slice |
| RSVP, the RSVP dashboard, the Excel export | Phase 2 |
| Change-password screen, TOTP, strict CSP | **Next, and before any real guest data** — an operator who cannot rotate their own password should not be putting 50 people into this |

---

## M. The hardening slice — password, second factor, CSP

Written before the console takes on a single real guest. An operator who cannot rotate their own
password, and who has no second factor available, is one borrowed laptop away from a list of
Bahraini phone numbers in somebody else's hands.

| Item | Status | Evidence |
|---|---|---|
| Change-password screen | ✅ | `/admin/settings`; the current password is required, the policy is enforced server-side, and **every other session is revoked** — a change that leaves the other person's session alive is theatre. 26/26 assertions |
| TOTP 2FA | ✅ | `src/lib/totp.ts` — RFC 6238 on `node:crypto`, **verified against all six of the RFC's own test vectors**, ±1 step of clock drift, codes single-use within their step. Enrolment is unconfirmed until a code from the device proves it can produce one |
| The two-step login | ✅ | A 5-minute, single-use challenge between the password and the session. Nothing half-authenticated ever becomes a session; five wrong codes end the challenge and require the password again |
| Strict CSP | ✅ | Per-request nonce, `script-src 'self' 'nonce-…' 'strict-dynamic'`, no `unsafe-inline` or `unsafe-eval` for scripts, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`, `upgrade-insecure-requests` in production. Asserted as text in `tests/unit/csp.test.mjs` |
| Recovery when the phone is lost | ✅ | `scripts/seed-admin.mjs --reset --disable-totp` — a shell on the container, not a route. A recovery path reachable from the internet is the way in |
| `style-src 'unsafe-inline'` | 🟡 | Still allowed: React and the invitation renderer both write inline styles. Inline *style* injection can misdraw a page; it cannot read a session. Recorded as a gap |
| CSP violation reporting | ❌ | No `report-to` endpoint, so a blocked script is visible only in a browser console. Worth adding |
| QR code on the enrolment screen | ❌ | The secret and the `otpauth://` URI are shown as text, which can be typed. A scannable QR needs one more dependency and is a convenience, not a control |

### Verified against production, in a browser

Not assertions this time — the live deployment, performed as an operator would:

| Step | Result |
|---|---|
| Start enrolment | the secret is shown; `/api/health` reports `totpEnrolled: false` while it is pending |
| Confirm with a code from the secret | `?totp=on`, and health reports `totpEnrolled: true` |
| Sign out, then sign in | the password lands on `/admin/totp`, **not** the dashboard — the challenge is real |
| Enter a fresh code | the dashboard renders, and the attempt log records a successful sign-in |
| Disable with the password | `?totp=off`; a wrong password refuses it |
| The password-change label | renders `سيتم إلغاء 1 جلسة أخرى`, not the raw key |

**One caution worth recording, because it cost an hour.** The first attempts at the enrolment confirmation
were refused as "wrong code" — three times, with codes that the RFC's own vectors say are correct, from a
secret read back out of the database, with the sandbox and the server agreeing on the time to within a
second. The app was never wrong. The scripted interactions were: `input.value = …` followed by
`button.click()` does not reliably drive React's server-action forms, so what arrived at the server was
not what had been typed. A trusted click — a real one — worked first time. When a browser test and the
server disagree, suspect the harness before the product.


---

## N. Phase 2 — the guest's experience

| Item | Status | Evidence |
|---|---|---|
| Wax-seal entrance | ✅ | `styles/invitation.css`, `WaxSeal.tsx`. Once per session (`sessionStorage`), reduced motion removes it, invitation always in the DOM |
| Countdown | ✅ | 5 unit assertions on the arithmetic, live on the page |
| RSVP | ✅ | 14 new assertions: the cap, the change of mind on one row, declines forcing zero, bad answers, unknown and malformed tokens, and that answering is not an open |
| Calendar file | ✅ | 8 assertions on the format, plus a live fetch: `text/calendar`, `no-store, private`, `DTSTART;TZID=Asia/Bahrain:20270214T183000` |
| Google Calendar link | ✅ | Built from the same instants; the test asserts the URL's `dates` parameter |
| **A real calendar client opening the file** | ❌ | The structure is asserted and the file is served correctly, but no iPhone, Outlook or Google has actually imported it. That check needs a device |
| QR code on the enrolment screen | ❌ | Still text-only |

### Where Phase 2 was verified, and why it matters

Not on the device the rest of this project was built on. That device cannot run `next build` (memory)
and cannot run a PostgreSQL server (`shmget`), so from the first commit to this one, every production
build was discovered on CranL minutes after a push, and every migration had only ever been applied to
a WebAssembly PostgreSQL.

In a Codespace, all of that is available:

| | Sandbox device | Codespace |
|---|---|---|
| `next build` | impossible | **exit 0**, all routes including `/i/[token]` and `/i/[token]/calendar` |
| PostgreSQL server | impossible | **PostgreSQL 17**, 4 migrations applied, 10 tables |
| Full gate | yes, with PRoot interruptions | **exit 0** |
| Invitation page | via the deployed site | served by the built app, from the real database |

`.devcontainer/` now reproduces it: Node 22, PostgreSQL installed and initialised as the workspace
user, `python3-fonttools` for the font gate. The first attempt at this used compose and produced a
bare Alpine container with no Node and no PostgreSQL — `devcontainer_path` was recorded, which made it
look configured until `node -v` said otherwise.

---

## O. The operator's fix pass — real-device feedback

The operator opened the console and the invitation on a phone and reported what they saw. Everything
below is fixed at the source; the measurements are in section P.

### Root causes found

| # | Reported | Root cause | Fix |
|---|---|---|---|
| 1 | Wedding details missing | The event model was built from the brief's data model, which stopped at venue name and a quote. Address, parking, entrances, sections, dress code and a programme were never columns | `0006_event_details.sql` + editor + checklist + public page + `.ics` |
| 2 | The seal looks flat and generic | It was one SVG path filled with a flat colour and a two-stop gradient — a sticker, not wax. There was no ring, no emboss, no highlight, no shadow, and the monogram sat *on* the surface instead of in it | `seal.ts` (generated edge, wedges, six wax palettes) and a rebuilt `WaxSeal` |
| 3 | The screen shakes every second | Four causes, none of them in the number: every tick re-rendered (React), the cells were sized by their content (proportional digits), `setInterval` drifted off the second, and it ticked while hidden | `Countdown.tsx` writes `textContent` on refs; fixed cell sizes; boundary-aligned timer; paused when hidden |
| 4 | Jitter after the envelope opens | The entrance was `absolute` inside a container as tall as the invitation, so it centred in the document — the envelope sat low with a void above it. Scroll-lock, an infinite pulse on an invisible element, `100vh` on the admin screens and `font-display: swap` all added shifts on top | `position: fixed`; no overflow change; `scrollbar-gutter: stable`; the pulse stops when it is no longer an invitation to touch; `dvh`; the four preloaded faces no longer swap and the Latin fallbacks are metric-matched |
| 5 | — | **Missing security control**: the two public routes had no rate limit at all | `0005_rate_limits.sql` and `rate-limit.ts`, wired into the invitation page, the RSVP action and the `.ics` |

### What the details work changed

| Where | Before | After |
|---|---|---|
| `events` columns | 29 | 38 |
| Editor fields | 24 | 32 + a schedule editor with add/remove/reorder |
| Completeness checklist | none | 11 items, weighted: ✗ blocks a send, ○ does not |
| Guest-visible detail rows | venue only | venue, address, dress code, parking, entrance, sections, notes, programme |
| `.ics` DESCRIPTION | couple + verse | couple + verse + address + notes + dress code + programme |
| `.ics` LOCATION | venue | venue, address |
| Map button | "Open in Maps" for everything | Google / Apple / generic, and `javascript:`/`data:` refused |

---

## P. Measurements, before and after

Taken in a browser against **production**, at the viewports the operator's phone actually uses.
Deploy IDs are CranL's, and every number below is from a run against a specific one.

### The countdown

| What | Before | After |
|---|---|---|
| Wrapper bounding box across a tick | changed | **0.00 px** in x, y, width and height |
| Each of the four unit cells | changed | **0.00 px** in x, y, width and height |
| Cell size | content-sized | fixed **44 × 54.4 px** |
| DOM work per tick | full React render | `textContent` on four text nodes |
| Timer | `setInterval(1000)`, drifting | aligned to the second boundary, re-aligned after every pause |
| Background tabs | ticking | paused, recomputed from the absolute target on return |

Measured on the **built app in the Codespace**, not only on production — a controlled environment, and
the same code that ships.

| Configuration | Ticks | Max box delta | Ticks that moved anything |
|---|---|---|---|
| 320×800, Arabic (production) | 130 | 0 px | **0** |
| 320×800, English (production) | 130 | 0 px | **0** |
| 320×800, default (production) | 130 | 0 px | **0** |
| 390×844 (built app) | 2 | 0.00 px | **0** |

`tests/browser/countdown-stability.mjs` is in the repository and runs from the Codespace with
`npm run test:browser:stability`. The 390×844 row is short because the Codespace lost its connection
to GitHub mid-run and the longer configurations could not be restarted — the 320×800 rows were
produced by a second, independently written harness (the one described in the commit history as
replaced) and agree with it. That is stated rather than smoothed over: three of four configurations
have a 130-tick number, and the fourth has a two-tick one.

### Layout shift

| What | Before | After |
|---|---|---|
| Cumulative Layout Shift across load **and** the seal opening | not captured before the fix shipped | **0.00013** |
| Shift during the seal break and reveal | — | **0** |
| Long animation frames (>50 ms) | — | **3**, longest **141 ms** (all during load, on a 4×-throttled CPU) |

Measured with `tests/browser/layout-shift.mjs` against the built app at 390×844, CPU throttled 4×,
over a 12-second window that includes the entrance. 0.00013 is three orders of magnitude below the
0.1 that Google calls "good"; the three long animation frames are the initial hydration and the
reveal on a deliberately slow CPU, and are reported because they are real.

The "before" number is missing and that is stated rather than papered over: the measurement harness
was still running when the fix was deployed, and the previous build is no longer on production. What
is known about the before is mechanical rather than numeric — each of the four causes in section O is
a specific mechanism that produces a shift, and the operator saw the result of them.

### The seal, before and after

| | Before | After |
|---|---|---|
| Edge | one smooth blob path | irregular, generated from a fixed seed, with three soft drips |
| Depth | flat fill + two-stop gradient | radial gradient, raised outer ring, embossed inner ring, off-centre specular, drop shadow |
| Monogram | text drawn *on* the wax | pressed *into* it, with an inner shadow |
| Colours | the palette accent only | six named wax colours, with the lit/shadowed/embossed tones mixed from the template's accent |
| The break | the whole seal scaled away | three wedges, each with its own rotation and delay, clipped from one drawing so the rings stay continuous |
| The name on the envelope | plain text | revealed by a wipe in the writing direction, in the calligraphic face |
| Position | in the document flow at the top, prompt clipped behind the card | a fixed overlay, centred in the viewport, prompt below the envelope |

Both screenshots at 375 px are in the run above; the before is
`screenshot_1795123660.jpg` and the after `screenshot_1795135544.jpg`.

---

## Q. Warmer copy, and two halls

### The wording (Part A)

| Item | Status | Evidence |
|---|---|---|
| Every text editable per event, with `{guest_name}` `{groom}` `{bride}` `{date}` `{venue}` `{map_url}` `{link}` | ✅ | `messages.ts` (defaults + `renderTemplate` + `resolveCopy`) and `CopyEditor`; 14 unit assertions |
| Reset to default means *delete the override* | ✅ | Asserted: an empty override falls back to the default; overriding one slot leaves the others |
| The operator's Arabic texts, verbatim | ✅ | Asserted character-for-character on the greeting, the opening, the body, the RSVP line and both buttons |
| Guest gender (male / female / neutral, default neutral) with correct Arabic inflection | ✅ | `guests.gender` + a constraint; the confirm button has three forms and `confirmLabel` picks by the row |
| Guest audience, derived from gender unless the operator overrides it | ✅ | `resolveAudience`; a family set to "both" stays "both" whatever its members are |
| Import columns `gender` and `audience`, in Arabic or English | ✅ | `GENDER_WORDS` / `AUDIENCE_WORDS` in the importer; an empty audience cell means "work it out", not "both" |
| Four WhatsApp messages, both languages, editable in Settings | ✅ | `DEFAULT_WHATSAPP` + `WhatsappEditor`; the sender resolves Settings → default per guest language |

### The halls (Part B)

| Item | Status | Evidence |
|---|---|---|
| `event_venues` with the fields asked for, and a unique kind per event | ✅ | `0007_dual_venues.sql`; 18 columns; two women's halls is refused by the database |
| Existing single-venue data migrated to a shared hall | ✅ | Tested by putting the database back into its pre-migration state, re-running the migration, and asserting the name, address, map and parking note survived — and that a second run does not duplicate the row |
| `{venue}` still works | ✅ | Resolves to the guest's hall, or both for a household |
| Guest assignment: audience per guest, overridable, families "both" | ✅ | `guests.audience`, NULL meaning "derive"; shown and editable per row |
| Both halls shown to every guest, the guest's own emphasised | ✅ | `venuesForGuest`; asserted that the other hall is never removed and that "both" emphasises neither |
| Line-art icons in the template's idiom, no emoji, no raster | ✅ | `VenueIcons.tsx` — arched window with rose and crescent; majlis arch with dallah and eight-point star; four variants from `design.ornament`/`layout` |
| Sheet: focus trap, `aria-modal`, labelled title, Escape, focus returns, reduced-motion fade | ✅ in code | Native `<dialog>` + `showModal()`, so the platform provides all five; `tests/browser/venue-dialog.mjs` asserts them |
| Zero layout shift on open and close | ✅ in code | The top layer is outside the flow; `showModal()` prevents background scroll; `scrollbar-gutter: stable` is already on `html`; only transform and opacity animate |
| Language switch with the sheet open | ✅ in code | `?lang=` soft-navigates; the sheet is a client component whose state survives it |
| Schedule tagged by hall, filtered for the guest, with a "show all" toggle | ✅ | Items carry `audience`; the page filters and offers the toggle |
| `.ics` uses the guest's own hall | ✅ | `venueForCalendar`; the address and both hall links go in the description, one address in LOCATION |

### The failure, diagnosed

The four failed rollouts were **not** a health-check timeout, a crash on boot, an OOM, a port problem
or a missing environment variable. Two of them recorded the reason on the deployment itself:

| Deployment | `error_message` / `first_error` |
|---|---|
| `E0Z_B6U5677lkCiDQEKU` | none recorded |
| `eI8fZZVdoi6SW99qVhyKU` | **"SSH connection error: Timed out while waiting for handshake"** |
| `RLOOb6zKgyWdAnnkNg3nB` | **"SSH connection error: Timed out while waiting for handshake"** |
| `yc3TmWDa1I0zAMwqDrpMG` | **`npm error Missing: playwright@1.65.1 from lock file`** |

The first three never reached the application: the platform's rollout agent could not open its
handshake to the new container, so the app was never asked to start. The fourth is the real one, and it
is mine: I added `playwright` to `devDependencies` by editing `package.json` as text and never installed
it, so `package-lock.json` never learned about it and `npm ci` refused to run. Every deployment since
that commit died at the install step.

Two further findings, both now fixed:

* **The code does read 0007's schema** — `/i/<token>` and the event console query `event_venues` and
  `guests.gender`. So even a successful rollout against an unmigrated database would have served 500s.
  Fixed by applying 0007 to production **before** any rollout, with the runner's own
  `schema_migrations` bookkeeping so it is not applied twice, and documented in `db/RELEASE.md`.
* **`/api/health` would have hidden it.** It counted `admin_users` and stopped there. It now reports
  `checks.schema`: each object the code needs, whether it exists, and the migration expected — without
  ever failing the process, because a database that is up with a schema that is behind is a deployment
  state, not an outage.

There is also **nothing configurable** for a health-check path, port or timeout: the app descriptor
exposes `port` only, `configure_app` accepts `auto_rollback` and `pr_previews`, and the platform's own
probe is a call you make rather than a setting. Measured against the running container, both paths pass:
`/` → 307 in 305 ms, `/api/health` → 200 in 620 ms. Boot is 492 ms, so a readiness timeout is not
plausible.

### Live, and verified in a browser

| | |
|---|---|
| Successful deployment | **`O9WzIZXfDI_M5JZyzhTgq`** (the change), **`VT7o8T3nGQk1osid0jlmn`** (the dialog fixes) |
| `/api/health` | `schema.ok: true`, all three objects present, `migrations.applied: 0007_dual_venues.sql` |
| Both halls on the guest's page | ✅ `قاعة اللؤلؤة` and `قاعة الخليج`, with `موقع قاعة النساء` / `موقع قاعة الرجال` and `قاعتك` on the guest's own |
| The sheet | ✅ opens with address, time, entrance, parking, a **Waze**-labelled button, copy-address |
| CLS opening the sheet | **0** — and `scrollY` unchanged, so the page behind did not move |
| Focus on open | inside the dialog |
| Focus on close | **back on the card that opened it** (measured: `activeIsVenueCard: true`) |
| Language switch with the sheet open | ✅ stays open, content re-renders — and the dialog's own box moves **`[0,0,0,0]`** |
| CLS across a language switch | **0.00098** — not zero. The shift is the *page behind* reflowing, because Arabic and English prose differ in length; the dialog itself does not move |

### Still not verified

* **Escape with a real key press.** A synthetic `KeyboardEvent` does not trigger the browser's native
  dialog dismissal, and this harness has no keyboard action. `tests/browser/venue-dialog.mjs` asserts it
  with `page.keyboard.press("Escape")`; it has not been run, because the Codespace became unreachable.
* **A physical iPhone or Android.** Everything above is Chromium at 320–390 px.
* **Screen-reader output.** The dialog is `aria-modal` with a labelled title and the icons are
  `aria-hidden` inside labelled buttons, but no VoiceOver or TalkBack has read it.

---

## R. Deployment guards

Two failures this session came from editing a configuration file rather than the application, and
neither was visible to `npm run verify`:

| Failure | What it cost | Now caught by |
|---|---|---|
| `playwright` added to `devDependencies` by hand, never installed, so `package-lock.json` never learned about it → `npm ci` refused to run | **four** dead deployments, all of them after a green build | `npm run check:lockfile` |
| `0007_dual_venues.sql` needed by the new code but not applied before the rollout | a 500 waiting to happen on `/i/<token>` and the event console — the rollouts failed first, by luck | `npm run check:release-order` |

Both run **first** in `verify`, before the type-check, so a broken install or an unrecorded migration
stops the run in a second rather than after the slow suites.

### `check:lockfile`

Structural rather than `npm ci --dry-run`: deterministic, offline, and seconds instead of minutes on
this device. It compares each declared dependency against the lockfile's `node_modules/<name>`, and
each declared range against the lockfile's own root block — which is the comparison `npm ci` itself
makes.

**The rule, and it is the whole point: never edit `package.json` by hand.** `npm install <pkg>` writes
both files; only one of them is guessable.

Proven to fail: adding an invented dependency to `devDependencies` makes it exit 1, naming it.

### `check:release-order`

Checks that `db/RELEASE.md` exists, states "migrate first, then deploy", names **every** migration
file in `db/migrations/`, and — for each migration whose objects the code actually reads — says so.

It derives the readers rather than trusting a list: it parses each migration for
`create table if not exists` and `add column if not exists`, then searches `src/` for those names.
Written today, it found immediately that only `0007` had been recorded and six migrations had not —
which is exactly the gap it exists to close. `db/RELEASE.md` now documents all seven, in order, with
what each adds and who reads it.

Proven to fail: removing `0006` from the document makes it exit 1, naming it.

### What these do not cover

* **That the migration was actually applied.** That is `/api/health`'s job — `checks.schema` reports
  each object the code needs and whether it exists — and it is a runtime fact, not a repository one.
* **Migrations applied out of order by hand.** The guard checks that the knowledge is written down;
  the runner (`scripts/db-migrate.mjs`) enforces the order when it applies them.
* **Which is why `db/RELEASE.md` has the three-step release command in it**, including the
  `schema_migrations` insert that stops the runner applying a hand-applied migration twice.
