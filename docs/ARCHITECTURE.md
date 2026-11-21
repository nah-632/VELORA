# ARCHITECTURE.md — Velora's system as it is, and what the decision log says it should be

Written 2026-11-21 in response to `/replica-architect`.

**Why this file is here and not `replica/architecture.md`:** `replica/` holds the study of *other
people's products* — Greenvelope, ChungDoi, Koroty. Velora is not a clone of them: it is the owner's
own product with an 18-entry decision log, a decided stack, eight applied migrations and a quality
bar that explicitly overrides every reference in that study. Filing Velora's own architecture inside
`replica/` would say the opposite, and the next reader would believe it.

---

## 1. What `replica-architect` would do here, and why only step 1 applies

| Skill step | Applies to Velora? | Why |
|---|---|---|
| 1 · pick a stack | **yes — already decided** | The skill's own rule is "use what the user already knows if they have a stack". Velora has one, and it is recorded in `SPEC.md` §2 and `tasks/plan.md` AD-1…AD-18. This file verifies it against the code rather than restating it |
| 2 · turn the inferred model into SQL | **no** | The recon's inferred model (Event · Ceremony · Guest · Wish · TimelineItem · OpeningStyle · Track) describes **the references**, not Velora. Velora's real schema is `db/migrations/0001–0008`. Writing a second SQL description would create a third source of truth next to two that already exist — see §3 |
| 3 · list every route by flow | **not yet** | The recon's flows include the wishes wall, QR check-in and per-guest font, which the owner has ruled out of scope until G3 closes. Route design for them is design for frozen features |
| 4 · the parts that bite | **partly — and one bit** | The timezone, idempotency and race items are already handled (`src/lib/time.ts`, the first-open statement, `rate-limit.ts`). The one that actually bit is §3 below |
| 5 · build order | **already exists** | `tasks/plan.md` milestones + `tasks/todo.md` phases, both with per-task evidence. A second build order would compete with them |

**Steps 2, 3 and 5 are not run.** They are blocked by the owner's instruction of the same day:
the reference study is parked, no feature from it starts until G3 closes, and no schema is to be
designed yet.

---

## 2. Step 1, executed: the stack, verified against the code

Checked in `package.json` and the source tree on 2026-11-21, not copied from `SPEC.md`.

| Concern | What is actually installed / built | ADR |
|---|---|---|
| Framework | `next 14.2.35` (App Router), `react 18.3.1`, `typescript 5.6.3` | AD-1 |
| i18n | `next-intl 3.26.3`, locale-prefixed routes, `ar-BH` default | AD-8 |
| Validation | `zod 3.25.76`, one schema shared by client hint and server enforcement | — |
| Data access | `postgres ^3.4.5` (raw driver) + committed SQL migrations + SQL functions | AD-3, AD-14 |
| Migrations | `db/migrations/0001–0008`, applied by `scripts/db-migrate.mjs` | AD-3 |
| Auth | `@node-rs/argon2`, httpOnly session cookie, login rate limiting, TOTP | AD-15 |
| Hosting / DB | CranL — one Next.js app from GitHub, managed Postgres, `netherlands-1` on the free plan | AD-12 |
| Authorization | Application layer, per route and per server action — **no RLS in production** | AD-13 (supersedes AD-4) |
| Storage | Interface with a CranL S3 driver in production, filesystem locally | AD-16 |
| Scheduled work | A CranL Schedule **command inside the container**, not a public HTTP endpoint | AD-17 |
| Tests | `node --test`, PGlite in-process for SQL, Playwright for browser measurements | — |
| Styling | Tailwind 3.4 + CSS custom properties (`src/styles/tokens.css`) | — |

**Superseded, and still visible in the repository:** AD-2 (Supabase) and AD-4 (RLS) were replaced by
ADDENDUM E. Their code has not all been removed — see §3.

---

## 3. What the verification is actually verifying

Found while checking step 1. Three facts, each with the command that proves it. They are not
opinions about style; each one affects whether "green" means what it appears to mean.

### 3.1 There are two migration trees, and the test suites build from the superseded one

```
db/migrations/          8 files   ←  applied to production by scripts/db-migrate.mjs
supabase/migrations/    9 files   ←  what tests/db/setup.mjs loads
```

`db/migrations/0001_operator_baseline.sql` says so itself, in its header:

> "This is a NEW baseline, **not a continuation** of supabase/migrations/: that set described a
> different product (customer accounts, orders, drafts) and leaned on Supabase's `auth` schema for
> identity, which does not exist on CranL."

But `tests/db/setup.mjs` still points the other way:

```js
const MIGRATIONS_DIR = join(ROOT, "supabase/migrations");   // line 18
export function migrationFiles() { … }                       // reads MIGRATIONS_DIR
export async function createTestDatabase() { … migrationFiles() … }
```

So every suite that calls `createTestDatabase()` builds its database from the tree production does
not use:

| Suite | Assertions (last recorded) | Builds from |
|---|---|---|
| `tests/db/operator-schema.mjs` | 32 | **db/migrations** ✓ |
| `tests/db/security.mjs` | 26 | **db/migrations** ✓ |
| `tests/db/invitations.mjs` | 36 | **db/migrations** ✓ |
| `tests/db/admin-auth.mjs` | 36 | **db/migrations** ✓ |
| `tests/db/catalogue.mjs` | 57 | **supabase/migrations** ✗ |
| `tests/db/isolation.mjs` | 27 | **supabase/migrations** ✗ |
| `tests/db/drafts.mjs` | 26 | **supabase/migrations** ✗ |
| `scripts/db-replay.mjs` (the migration replay gate) | — | **supabase/migrations** ✗ |

The four suites in the top half set their own `DIR = join(ROOT, "db/migrations")`; the four in the
bottom half go through `createTestDatabase()`. `npm run verify` runs all eight and prints one green
bar.

**So the split is by feature, not by quality: 130 assertions verify the shipped schema, and 110 plus
the replay gate verify the superseded one.** The 110 cover the **catalogue** and the **Studio's draft
editor** — shipped features, not dead code. Everything the operator, the invitations, the admin auth
and the security suite assert is measured against the tree production actually runs. The first draft
of this section said "a green verify does not cover the shipped schema"; that was wrong, and this
table is what correcting it looks like.

### 3.2 The isolation suite proves a control that production no longer has

```
db/migrations/        policies: 0    enable row level security: 0
supabase/migrations/  policies: 18   enable row level security: 9
```

AD-13 accepted this deliberately — "This is a *weaker* architecture than RLS and the cost is accepted
explicitly: isolation is now a test obligation, not a database guarantee."

`isolation.mjs`'s 27 assertions are RLS assertions. They pass against a tree with 9 policies enabled,
while the shipped tree enables none — so they are **not evidence about production**, whatever the
green bar suggests. The obligation AD-13 accepted does appear to be carried elsewhere:
`security.mjs` (26 assertions) runs against `db/migrations` and is the suite that tests the
application-layer checks. The finding is therefore not "the obligation is unmet" but **"the suite
whose name says *isolation* is not the suite that proves it, and a reader has no way to tell."**

### 3.3 AD-14's access layer is not installed

`rg -c drizzle package.json` → **0**. AD-14 records "**Drizzle** as the typed access layer; the
committed SQL migrations remain the source of truth". What is installed is `postgres ^3.4.5`, the raw
driver, and the data layer is hand-written SQL. That may be perfectly fine — it is what AD-3 asked
for — but the decision log and the lockfile disagree, and a future agent will read the log.

Also present and not accounted for: `@supabase/supabase-js` and `@supabase/ssr` are **runtime**
dependencies, `src/lib/data-source.ts` still chooses a Supabase transport when the Supabase
environment variables are set, and `src/features/catalogue/{supabase-source,local-source,repository}.ts`
and `src/features/studio/drafts.ts` still import it. ADDENDUM E says Supabase is out.

---

## 4. The riskiest parts, from what is on disk rather than from the recon

1. **Two shipped features verified against a schema production does not use** — the catalogue and
   the Studio's draft editor, 110 assertions (§3.1). Their tests are real tests; they are simply
   pointed at the wrong tree, and nothing in the output says so.
2. **A second, superseded migration tree still wired into the test harness** (§3.1). Any test added
   today to `catalogue.mjs` inherits the wrong schema silently.
3. **Two live data-source transports** while the decision log names one target (§3.3). The failure
   mode is a deployment where the Supabase variables are set and the application reads a database
   nobody migrated.
4. Handled already, and worth recording as done rather than as risk: timezone conversion
   (`src/lib/time.ts`), the first-open race (one statement, no read-modify-write), rate limiting on
   the public routes, and the `.ics` route's separate `recordOpen: false` path.

---

## 5. What I did not do

- **No schema was designed.** No `replica/schema.sql`, no migration, no table, no column.
- **No route was designed** for the wishes wall, QR check-in or per-guest font.
- **No file in `replica/` was touched**, and the study stays parked.
- **G3 was not paused**: this document is reading and checking only. `git status` after it is a new
  untracked file and nothing else.

## 6. Next step — the owner's decision, not mine

Three repairs are implied by §3 and none of them is a feature. They are listed in the order I would
do them, but the choice is the owner's: repair the verification first, or close G3 first.
