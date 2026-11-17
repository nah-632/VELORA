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

## Owner decisions already locked

| Decision | Answer |
|---|---|
| Repository | Public, `nah-632/VELORA` |
| Supabase region | Mumbai `ap-south-1` (no Middle East region exists) |
| Customer accounts | Full accounts — saved drafts, order history |
| Monogram direction | Folded-invitation / paper geometry (the brief's direction, not the attached botanical concept) |

## Stack

Next.js 14.2 (App Router) · TypeScript strict · Supabase (Postgres 17, Auth, Storage, RLS) ·
next-intl · Tailwind with CSS custom-property tokens · zod · **no ORM** (versioned SQL migrations
are the schema source of truth) · money as integer fils.

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

`npm run build` is **CI-only**. A production build exhausts this device's memory; the local
gate is a scoped type-check plus the test suites. Any report of "build verified" will say
which of the two actually ran.

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
