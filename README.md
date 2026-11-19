# VELORA — The Art of Inviting

Bilingual (Arabic RTL / English LTR) premium digital wedding-invitation platform.
Launching in Bahrain; architected for later GCC expansion.

> **Status: Milestone 1 — foundation in progress.** This README states what exists, not what is
> planned. Planned work lives in `tasks/plan.md` and `tasks/todo.md`.

## Start here

| File | What it is |
|---|---|
| `SPEC.md` | The specification — objective, stack and its justification, commands, testing strategy, boundaries, risks |
| `CAPABILITY-MAP.md` | The twelve modules, their dependency order, and the interfaces between them |
| `tasks/plan.md` | Architecture decisions, task breakdown, risks |
| `tasks/todo.md` | The live checklist, plus current blockers |
| `docs/CRANL.md` | **Hosting.** Verified CranL capability map, plan requirements, and the deployment path — supersedes `docs/DEPLOYMENT.md` (Vercel + Supabase) |

## Owner decisions already locked

| Decision | Answer |
|---|---|
| Repository | Public, `nah-632/VELORA` |
| Supabase region | ~~Mumbai `ap-south-1`~~ **superseded** — data moves to CranL managed PostgreSQL, region **`riyadh-1`** (MENA, closest to Bahrain). Needs the Pro plan: `netherlands-1` is the only region the account can use today |
| Customer accounts | Full accounts — saved drafts, order history |
| Monogram direction | Folded-invitation / paper geometry (the brief's direction, not the attached botanical concept) |

## Stack

Next.js 14.2 (App Router) · TypeScript strict · **CranL** (application + managed PostgreSQL
`riyadh-1` + S3-compatible object storage) · **authorization in the application layer** ·
next-intl · Tailwind with CSS custom-property tokens · zod · **Drizzle** as the typed access layer
over versioned SQL migrations · money as integer fils.

> Supabase, Vercel and Postgres RLS are **out** — ADDENDUM E replaced them on 2026-11-18. See
> `docs/CRANL.md` for what CranL actually provides, what it does not, and what the plan requires.

## Commands

```bash
npm install
npm run dev          # local development
npm run type-check   # scoped tsc — never whole-project (this device OOMs)
npm run test         # unit + integration
npm run test:db      # local Postgres: migrations replay + RLS isolation
npm run test:ui      # contrast gate + RTL logical-property guard
npm run verify       # type-check + test + test:db + test:ui
```

Tests import TypeScript directly, so they run through the `tsx` loader: this device's Node
build reports `ERR_NO_TYPESCRIPT` (no built-in type stripping compiled in). `--experimental-strip-types`
will not work here.

`npm run build` is **CI-only**. A production build exhausts this device's memory; the local
gate is a scoped type-check plus the test suites. Any report of "build verified" will say
which of the two actually ran.

## Developing in a Codespace

The device this project was built on cannot run `next build` (it exhausts the memory) and cannot run
a PostgreSQL server (`shmget` is unimplemented in its sandbox). Both of those are limits of that
device, not of the project.

`.devcontainer/` fixes both: a Node 22 container with a real `postgres:16` beside it, wired together
so `DATABASE_URL` points at something that actually accepts a connection.

```bash
gh codespace create -R nah-632/VELORA -b main    # or Code → Codespaces → Create
npm ci
npm run db:migrate                               # applies db/migrations to the real PostgreSQL
npm run verify                                   # the full gate
npm run build                                    # the production build — finally verifiable here
npm run seed:admin                               # ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run seed:admin
npm run dev
```

What this buys, concretely, in order of how much time it saves:

| | This device | A Codespace |
|---|---|---|
| `next build` | impossible — memory | runs, ~15 s |
| PostgreSQL server | impossible — `shmget` | real, `npm run db:migrate` |
| The full `verify` | mostly, with PRoot interruptions | clean |
| Iterating on a deploy | ~4 minutes each | build first, deploy once |

The suite still runs on PGlite too, and that stays: it is what makes `npm run test:db:*` work on a
phone. The Codespace adds the server rather than replacing the harness.

## Layout

```
src/app/[locale]/     locale-prefixed routes: (site) · (studio) · (admin)
src/features/<module>/  one folder per capability module
src/lib/              cross-cutting: supabase clients, money, i18n, results
src/components/ui/    design-system primitives
supabase/migrations/  the schema source of truth
messages/{ar,en}.json user-facing strings — none hardcoded in components
tests/                unit · integration · db · security · ui · e2e
docs/                 DEPLOYMENT · BRAND · SECURITY · adr/
```

## Security posture

Customer wedding data is private data. Isolation is enforced in the database with row-level
security, not by hiding interface elements; prices are computed server-side only; no card data is
ever stored; nothing is marked paid without a verified provider response or a recorded manual
action; no message is ever claimed as delivered when it was only opened.
