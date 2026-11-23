# Velora — Brief Delta

**Source:** the revised project brief supplied 2026-11-23 (`Pasted_20261123-180916.txt`, 20,025 B) plus two
HTML mockups (envelope 15,723 B · invitation 15,545 B).

**Base tree:** `invitation-v2` @ `c4318a3` (35 commits ahead of `main`). Origin: `github.com/nah-632/VELORA`.

**Why this file exists.** The brief reads as a greenfield build. The tree is not greenfield. Building to
the brief as written would re-derive measurements that are already recorded and would re-introduce three
defects that were found by rendering and fixed. This file states, per requirement, what is FACT in the
tree and what is genuinely absent, so the remaining work is the absence rather than the whole brief.

Status values are `DONE` (implemented and verified), `PARTIAL` (exists, incomplete against the brief),
`MISSING` (no implementation found), `CONFLICT` (brief and tree disagree, needs a decision).

---

## Decisions recorded this session

| # | Question | Decision | Consequence |
|---|---|---|---|
| 1 | Which tree | **`invitation-v2`** | The 35 verified commits are the base; the brief is applied as a delta onto them, not as a re-build. |
| 2 | Default template | **Emerald Envelope** (from the mockups) | The attachment palette becomes the default *registry* template, not only the implemented page's own tokens. |
| 3 | Fonts | **The self-hosted set as-is** | `Aref Ruqaa` (400/700) · `Amiri` · `Reem Kufi` · `Cormorant Garamond` · `Cinzel`, all OFL, already in `public/fonts/` with licenses in `public/fonts/licenses/`. No new faces. |

---

## What the mockups actually specify (measured, not read)

| Property | Envelope mockup | Invitation mockup |
|---|---|---|
| Direction | `lang="ar" dir="rtl"` | `lang="ar" dir="rtl"` |
| Arabic faces | `Aref Ruqaa 400/700`, `Amiri` | `Aref Ruqaa`, `Amiri`, `Reem Kufi 400/600` |
| Latin faces | none | `Cormorant Garamond`, `Cinzel` |
| Emerald family | `#192A21` `#14231D` `#2E4539` `#0F1913` | `#192A21` `#2E4539` `#0F1913` |
| Gold | `#BE925E` (×8) `#DCB27F` | `#BE925E` `#DCB27F` `#F0CD97` `#C99A58` `#7A5220` |
| Wax | `#650E18` `#5B0211` `#B85055` | — |

The brief's "the envelope uses deep emerald (#192A21)" is **confirmed** — the hex is present in both files.

The attachment emerald/gold palette **is already implemented** as the guest page's own design tokens in
`src/styles/luxe.css` (scoped to `.vi`), with one constraint recorded in that file and worth keeping:

> `--vi-gold` (#BE925E) is decoration only. It is 2.4:1 on this paper and can never carry text.

That is a contrast decision that must survive any template work built on this palette.

---

## Requirement status

### Brand identity

| Requirement | Status | Evidence |
|---|---|---|
| Logo / mark | **DONE** | `assets/brand/velora-logo-original.jpg` + traced `velora-mark.svg`; lockups ×4 and monograms ×5 in `public/brand/`; `brand/archive/monogram.mjs` retired |
| Palette blend gold/brown + emerald/gold | **DONE** | `src/styles/luxe.css` holds the measured attachment palette; `docs/BRAND.md` holds the brand side |
| Emerald Envelope as a selectable template | **PARTIAL** | Defined as a token template this session; **inert** until `public.templates` carries a matching slug. See the two-system section below |
| Velora Classic as a selectable template | **PARTIAL** | Same |
| Typography, Arabic first, tashkeel, no Arabic letter-spacing, Arabic line-height ≥ 1.9 | **DONE** | `docs/TEMPLATES.md` §1; `.vi` face scope; fonts self-hosted + subset + preloaded |

### Templates — two systems, and the first version of this note got it wrong

`docs/TEMPLATES.md` documents **24 templates** (T1–T24) with palettes, ornament recipes, seal specs and
motion. There are **two** implementations of a template in the tree, with different schemas:

| | Design config (database) | Template tokens (code) |
|---|---|---|
| File | `src/features/catalogue/design-config.ts` | `src/lib/templates/{schema,registry,css-vars}.ts` |
| Shape | `DesignConfig` v1 — `palette {ground, ink, accent}`, `canvas.ratio`, `typography`, `ornament`, `layout` | `TemplateTokens` v1 — 5 roles `{ivory, gold, emerald, burgundy, ink}`, `fonts`, `seal`, `envelope`, `opening`, `layout` |
| Lives in | `public.templates.design_config` (jsonb) | the file itself |
| Seeded | **8 presets** in `0003_templates.sql`: `ivory-classic`, `emerald-royal`, `sand-editorial`, `paper-minimal`, `rose-letterpress`, `sage-botanical`, `naskh-heritage`, `ink-noir` | 1 → now 3 (this session) |
| Consumed by | catalogue, studio, `[locale]/invitation` preview, the guest loader (`public.ts:246` → `templateSlug: row.template_slug`) | **only** `src/app/i/[token]/page.tsx:168` |

**The first version of this note said "1 wired against 24 documented". That was wrong** — it counted only
the code registry and missed the eight database presets. The correct statement is 8 + 3, in two schemas.

**How they relate.** The guest route resolves its template by `public.templates.slug`, and its own comment
says the template supplies the **entrance** (seal imprint, envelope paper, wax, liner) and the accent the
venue icons draw from — "if this event uses one of the token-system designs". Verified: a database preset
slug returns `undefined` from `getTemplateBySlug`, so the eight presets render the luxe default and the
token designs are an overlay, not a replacement.

**So the real gap is not "templates are missing". It is that the attachment's design is in neither
system's list.** `emerald-royal` in the database is `#263E35` ground with a `#D8C49B` accent — not the
mockups' `#192A21` / `#BE925E` / `#650E18`. That palette exists only as the hard-coded `.vi` tokens in
`src/styles/luxe.css`. The brief's "ship at least 6 templates" is met at the database level and the two
canonical designs the owner just chose are not selectable in either.

**Answered 2026-11-23 — the second document moves into the row.** `0009_token_config.sql` adds
`templates.token_config` (nullable), backfills Golden Palace, and seeds `emerald-envelope` and
`velora-classic` with both documents, following 0008's precedent of mapping the five token roles onto
the three the catalogue renderer understands. One row, two documents, both versioned. The nullable
column is the point: the eight 0003 presets keep falling back to `getTemplateBySlug`, so the previous
container renders unchanged against the migrated database.

Nullability creates one risk — two copies of one document drifting — so `tests/db/token-config.mjs`
asserts the code registry and the stored document are structurally identical, field by field. It found
a real disagreement on its first run: `sort_order` was `0/1/2` in the registry and `4/5/6` in the rows.
The rows' values won (that ordering is what the operator's picker uses beside the eight presets).
It also reported three agreeing documents as different, because `JSON.stringify` is key-order-sensitive
and jsonb does not preserve key order. Both were fixed; it is now 13/13 and runs in `verify`.

### Public page `/i/[token]`

| Requirement | Status | Evidence |
|---|---|---|
| Envelope + wax seal entrance | **DONE** | `WaxSeal.tsx`, `seal.ts`, entrance layers 1–2; `cd6ace6` fixed the fold apex to a measured 54.8% |
| Greeting, couple names, verse | **DONE** | `src/app/i/[token]/page.tsx` header, `MihrabArch.tsx` |
| Countdown, timezone-based, fixed cell size | **DONE** | `Countdown.tsx`, `countdown.ts`, `tests/browser/countdown-stability.mjs` |
| Hijri + Gregorian | **DONE** | 9 `hijri` references |
| Venue + Open in Maps | **DONE** | `VenuesSection.tsx`, `venues.ts`, `src/lib/maps.ts` |
| Notes / dress code | **DONE** | migration `0006_event_details.sql` |
| Personal line (D2) | **DONE** | `guests` schema + invitation render + CSV column |
| RSVP with companions cap, changeable | **DONE** | `actions.ts`, `rsvp.ts`, `submitRsvpAction` |
| Differing thank-you for confirm vs decline | **DONE** | `messages.ts` copy slots |
| `.ics` + Google Calendar link | **DONE** | `ics.ts`, `googleCalendarUrl`, `src/app/i/[token]/calendar/route.ts` |
| Open count, non-invasive | **DONE** | `loadInvitationOnce`, `cache.ts` |
| Bilingual toggle, no animation restart | **DONE** | `?lang=` soft navigation; documented in the route's own header comment |
| noindex + robots + unguessable token | **DONE** | `src/app/robots.ts`, middleware, token generation |
| Open Graph preview | **PARTIAL** | Needs verification against the "does not leak sensitive details" requirement |
| WhatsApp contact footer | **DONE** | footer + `whatsapp` feature |

### Admin dashboard

| Requirement | Status | Evidence |
|---|---|---|
| Events list, Active/Upcoming/Ended, counts | **DONE** | `admin/events/page.tsx` |
| Event editor + phone-frame preview + preview link | **DONE** | `admin/events/[id]/page.tsx`, `admin/events/[id]/preview/[guestId]/page.tsx` |
| Guest add / paste / CSV import with preview + dupes | **DONE** | `features/guests`, 4 `csv` references |
| WhatsApp send + sequential mode + provider interface | **DONE** | `features/whatsapp`, `SendQueue.tsx` (`purposes: invite \| reminder \| beforeEvent \| afterEvent`) |
| RSVP dashboard + charts | **PARTIAL** | `admin/events/[id]/rsvps/page.tsx` exists; charts not verified |
| Excel `.xlsx` attendance export | **PARTIAL** | `admin/events/[id]/export/route.ts` exists; single `xlsx` reference — needs verification it emits real xlsx and is print-friendly |
| Templates CRUD | **MISSING** | Blocked by the registry gap |
| Settings: WhatsApp number, templates AR/EN, logo, timezone | **DONE** | `admin/settings/page.tsx`; operator number default is `+97366661238` |

### Addendum C — signature features

| # | Feature | Status | Evidence |
|---|---|---|---|
| C1 | Wax-seal envelope opening | **DONE** | Entrance layers 1–2, `WaxSeal.tsx`, `tests/visual/` |
| C2 | Couple monogram generator (3 styles + custom upload) | **DONE** | 9 `monogram` references incl. `seal.ts`, `WaxSeal.tsx`, `schema.ts`, `form-fields.ts`; 5 monogram SVGs |
| C3 | Event schedule timeline | **DONE** | Programme section from the event's own schedule (`c16fdfd`) |
| C4 | Dress code + venue notes + parking + sections | **DONE** | `0006_event_details.sql` |
| C5 | Personal QR entry pass + scan screen | **MISSING** | 2 incidental `qr` matches, no implementation |
| C6 | Guest wishes wall (opt-in, moderated, exportable) | **MISSING** | 0 matches for `wishes` / `تهنئة` |
| C7 | Gentle reminders, per-segment, one-click | **DONE** | `SendQueue.tsx` reminder purposes |
| C8 | Optional ambient music, tap-to-play, no autoplay | **MISSING** | 0 matches for `music` / `audio` |
| C9 | Couple story / gallery, 3–6 photos | **MISSING** | 0 matches for `gallery`; 4 for `story` are unrelated |
| C10 | After-event page | **PARTIAL** | `afterEvent` message purpose exists; no page state for `status = ended` verified |
| C11 | Ambient gold particles / leaf shadows | **MISSING** | 1 match each for `particle` / `ambient` — needs verification |
| C12 | Per-guest personal line | **DONE** | Same as D2 above |

**Genuinely new work in Addendum C: C5, C6, C8, C9, plus C10 and C11 to finish.**

---

## Conflicts

| # | Brief says | Tree has | Needs |
|---|---|---|---|
| 1 | "Create a brand-new repository from scratch" | `nah-632/VELORA` exists, 35 commits of verified measurement | The brief's warning is aimed at *third-party* repos named Velora (`zyvorai/velora`, `sushilk1991/velora`). Reading it as "do not start from someone else's Velora" — satisfied. **ASSUMPTION**; correct if wrong. |
| 2 | "Deploy on Vercel" | Live on **CranL**; `docs/CRANL.md`, deployment IDs recorded, rollbacks audited | Pick the deploy target. Both are documented in-tree. |
| 3 | "Ship at least 6 templates" | 24 specified, 8 seeded in the database, 3 defined as token templates | Not a template-count problem. The two designs the owner chose are in neither list — see the two-system section. |

---

## Ordered next tasks

1. **Apply 0009 to production, migrate-first, then deploy.** The migration and its wiring are committed
   and proved on PGlite; it is **not applied to production and not deployed**. Per `db/RELEASE.md`:
   apply the migration, record it in `schema_migrations`, deploy, then confirm `checks.schema.ok` on
   `/api/health`. Until it is applied, the row's `token_config` is absent and the code falls back to the
   registry — which is the intended state, not a broken one.
2. **Excel export verification** — confirm real `.xlsx`, print-friendly, sortable.
3. **Open Graph leak audit** — assert no guest name, phone, or token appears in preview metadata.
4. **C5 QR entry pass** — the only new feature with a schema dependency (`rsvps` → check-in state).
5. **C11 ambient motion, then C8 music, then C9 gallery** — in that order, because C11 is the only one the
   brief's own performance rule puts in the critical path. Each behind a per-event toggle.
6. **C6 wishes wall** — needs moderation state and a new table; last because it adds an untrusted-input
   surface (guest-written text) that must go through sanitisation and an approval gate.

## Verification discipline carried over

`tests/ui/real-defect-replay.mjs` replays the three defects that actually occurred and asserts the guards
go red — 3/3. `guard-canary` 11/11. Any template work must keep both green, and `check-rtl` / `check-css`
must stay at PASS. A guard that fails on correct source is worse than a blind one; the CSS-comment check
taught that lesson by firing 51 times on clean input before it was placed correctly.
