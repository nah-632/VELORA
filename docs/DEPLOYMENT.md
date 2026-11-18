# Deploying VELORA

Status: **not yet deployed.** This document records exactly what is required, and what has been
verified, so the remaining step is mechanical.

## What is already in place

| Thing | State |
|---|---|
| Repository | `github.com/nah-632/VELORA`, pushed |
| Vercel account | `waaaiss98-3067` (team `lumora-b4e1`), token verified working |
| Database | **not provisioned** — see below |
| Build | never run in production. `next build` exhausts this device's memory, so the build is verified by the platform, not locally |

## The one blocker

**The application requires a PostgreSQL database in production, and it refuses to start without
one.** That is deliberate: `src/lib/data-source.ts` throws if no data source is configured and
`NODE_ENV` is production, rather than quietly serving an empty catalogue or falling back to a
local file. A deployment without a database shows an error, on purpose.

The planned database is **Supabase, region `ap-south-1` (Mumbai)** — the closest region to Bahrain,
since Supabase has no Middle East region. It cannot be created from here: the configured access
token is scoped without `organizations_read`, so `supabase projects create` returns `Forbidden`.

### What the owner must do (about one minute)

1. Open <https://supabase.com/dashboard/new> and create a project:
   - name: `velora`
   - region: **South Asia (Mumbai) `ap-south-1`**
   - database password: generate one and keep it
2. From **Project Settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server only; never `NEXT_PUBLIC_`)
3. From **Project Settings → Database**, copy the **connection pooler** string → `DATABASE_URL`

Then say so, and the remaining steps below are automatic.

> A new token with the `organizations_read` permission would also work, and would let the project
> be created from here.

## Environment variables

Set on the Vercel project, for Production and Preview:

| Variable | Kind | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Safe in the browser by design. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | An anon key is not a secret; row-level security is what protects the data. |
| `NEXT_PUBLIC_SITE_URL` | public | The deployment's own URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | Server only. Must never carry the `NEXT_PUBLIC_` prefix. |
| `DATABASE_URL` | **secret** | Used by the migration tooling, not by the running app. |
| `PAYMENT_PROVIDER` | config | `none` until a gateway is chosen. |

## Steps once the database exists

```bash
# 1. Apply the schema. Nine migrations, replayable, safe to re-run.
npm run db:migrate -- --url "$DATABASE_URL"

# 2. Confirm the schema arrived and the policies are real.
npm run db:verify -- --url "$DATABASE_URL"

# 3. Build and deploy.
vercel --prod
```

## What will be verified after the first deploy

The list is short because most of it has already been verified locally, and the point of a
deployment checklist is to name what has *not*:

- [ ] the production build succeeds on the platform
- [ ] the catalogue renders from the hosted database
- [ ] an unpublished design stays invisible at the hosted URL — the single most important check,
      because row-level security has only ever been exercised against a local database
- [ ] the draft round trip works end to end over the network
- [ ] `/ar` and `/en` render correctly from the deployed origin
- [ ] the brand assets and fonts resolve from the deployed origin

## Deliberately not included

- **Public invitation pages.** The brief forbids introducing them in Phase 1 unless explicitly
  scoped and protected. `/invitation` is private to the browser that owns the draft and is
  `noindex`.
- **A custom domain.** None has been chosen; `*.vercel.app` is enough to review.
- **A payment gateway.** None has been chosen, and the order flow is not built yet.

## Note on an existing Vercel project named `velora`

The account already holds a project named `velora`, created 2026-11-16, with its own environment
variables (`DATABASE_URL`, `TOKEN_PEPPER`, `VELORA_TENANT_SLUG`) and deployment protection enabled.
Those variables do not match this codebase and its deployments are not publicly reachable.

**This document does not use that project, and nothing in it has been changed.** Deploying this
repository into it would replace another application's deployments and point this application at
a database belonging to something else.
