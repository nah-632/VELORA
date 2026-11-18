# Hosting VELORA on CranL

This document supersedes the Vercel + Supabase plan in `docs/DEPLOYMENT.md` for everything it
covers. It records **what was verified against the live CranL API on 2026-11-18**, what ADDENDUM E
requires, and where CranL differs from the addendum's assumptions.

Source of truth for every claim below: the CranL REST API (`https://app.cranl.com/api/v1`) called
with this account's credential, plus the official docs at <https://docs.cranl.com>. Nothing here is
inferred from memory.

---

## 1. Account state (verified)

| Thing | State |
|---|---|
| CranL account | `Velora` (id `13072abc-6fb9-4efe-adff-4b32ff4ae4ed`) |
| Project | `Velora` (id `0bce9469-54d2-4c3d-88db-7cb007203a24`) |
| Plan | **`free`** |
| Apps / databases / buckets / domains | 0 / 0 / 0 / 0 |
| GitHub integration | **not connected** (`list_github_repos` → `connected: false`) |

Free-plan limits, as returned by `get_account`:

| Limit | Free | Addendum E needs |
|---|---|---|
| Apps + databases (combined) | 2 | 1 app + 1 Postgres = 2 — **exactly at the limit** |
| Custom domains | **0** | ≥1 (public invitation links must use the custom domain) |
| Storage buckets | **0** (`features.storage: false`) | 1 (logo, monogram, previews, venue/gallery photos, exports) |
| MENA regions | **`features.mena_regions: false`** | Riyadh |
| Regions available to this account | `netherlands-1` only | `riyadh-1` |

**Therefore: ADDENDUM E cannot be satisfied on the current plan.** The three capabilities it
requires — a MENA database region, S3 object storage, and a custom domain — are all gated:
plus a fourth, headroom on the 2-resource limit. `Basic` ($4.99) does not fix it either (it excludes
`riyadh-1`/`jeddah-1`/`egypt-1` and has no buckets). **Pro ($9.99/mo) is the minimum plan that
satisfies the addendum**: all regions, 1 bucket, 10 custom domains, 20 resources.
Upgrade: <https://app.cranl.com/dashboard/billing>.

## 2. The deployment path works — verified against this repository

`preflight_deploy` was run on an archive of this working tree (excluding `node_modules`, `.git`,
`.local-db`, `.env.local`):

```json
{ "ready": true, "framework": "Next.js", "build": "auto",
  "start_command": "npm start (next start)",
  "port": { "configured": 3000, "detected": 3000, "source": "address string" },
  "files": 123, "bytes": 3565682 }
```

Two things this settles:

1. **CranL's Railpack detects Next.js and runs `next start` on port 3000 with no Dockerfile and no
   build flags.** The `Dockerfile` the addendum makes optional is therefore not needed.
2. **The production build that has never run anywhere now has a validated target.** This device
   cannot run `next build` (memory), so until now "builds" was an assertion. CranL builds it on
   their infrastructure; the first real build log will be the first real evidence.
   It also confirms a CranL cron command can be `bash`, and that build-time env vars
   (`NEXT_PUBLIC_*`) must be set **before** the build, not after.

Remaining preflight warnings are only missing environment variables — expected, since none are set
on the account yet.

## 3. Requirement → capability map (ADDENDUM E)

| Addendum E requirement | CranL capability | Note / deviation |
|---|---|---|
| One Next.js app, Git deploys, auto-build on push | Application from a GitHub repo, branch `main` | Needs the GitHub connection (one dashboard step). Without it, `create_app` accepts a **public `git_url`** and deploys on demand instead — no auto-deploy on push |
| Backend inside Next.js | — | No change: Route Handlers / Server Actions |
| Managed PostgreSQL, MENA, same region as app | `create_database --type postgresql --region riyadh-1` | Pro. Riyadh is the closest available region to Bahrain. `cranl db create` cannot take `riyadh-1`; use the `create_database` operation |
| Private/internal connection string | `DATABASE_URL` injected into the app at creation | Databases and apps in the same region share the private network |
| Prisma or Drizzle + versioned migrations applied on deploy | App code + `cranl run -- node scripts/db-migrate.mjs` | See AD-15. `query_database` (API) can also execute SQL directly, so migrations can be applied from this device without a local Postgres |
| App-layer authorization (no RLS) | — | Architectural: every admin route/server action verifies the session; the token route returns the minimum |
| Single-admin credentials auth, argon2/bcrypt, httpOnly cookies, rate limiting, TOTP | App code | Nothing in the addendum changes the runtime model: CranL gives no auth service, by design |
| S3 object storage, signed URLs, CDN-served images | Storage buckets (S3-compatible) | **Pro only.** Endpoint + credentials on the bucket page; secret is shown once. Default domain already sits behind BunnyCDN |
| Cron jobs | Application **Schedules** | **Deviation:** a schedule runs a *shell command inside the app container* (`bash`, TZ defaults to UTC), not an HTTP callback. So the entrypoint is `node scripts/cron.mjs <job>` — no public endpoint needed, no secret to leak. If an HTTP route is preferred, point the command at `curl -H "x-cron-secret: $CRON_SECRET" localhost:3000/api/cron/<job>` |
| Custom domain + automatic SSL, HTTPS, HSTS, CSP | Domains tab + automatic certificates | Free plan allows **0** domains. Certificates issue 1–5 min after DNS. Subdomain: CNAME to `<app>-<id>.cranl.net`; apex needs ALIAS/ANAME |
| Secrets in environment variables, `.env.example` in the repo | App environment variables (form or raw `KEY=VALUE`) | Changing a variable does **not** restart the app — redeploy or reload |
| Health check, structured logging, error reporting, traffic analytics | `/api/health` + runtime logs + Analytics tab + `get_app_metrics` | Logs read from here with `get_app_logs` / `follow_app_logs`; no third-party APM needed |
| Automated database backups + documented restore | `snapshot_database`, `list_database_snapshots`, `restore_database_snapshot` | Document the exact restore command in the README (still to be written) |
| Public pages cacheable, per-guest data never cached publicly | — | App-level: static assets `immutable`, the token route `no-store` |
| Staging environment if the plan allows | A second app in the same project | Pro allows 20 resources → app + db (prod) + app + db (staging) = 4 |

### Safety controls worth using deliberately

CranL gives agents guardrails the addendum did not ask for but that belong in this project:

- `configure_app {protect: true}` and `protect_database` — once set, **no agent (including this one)
  can delete or reconfigure the resource. Only a person in the dashboard can lift it.**
- Deletes made through the API are recoverable for 7 days (`restore_app` / `restore_database`);
  dashboard deletes are immediate and permanent.
- Every mutating call supports `plan: true` (dry run), `Idempotency-Key`, owner-approval requests,
  and `undo_action` from the activity log (`list_activity`).

Plan: protect the production app and database as soon as they exist.

## 4. The `cranl` CLI cannot run in this sandbox — and does not need to

```text
$ cranl version
ld-linux-aarch64.so.1: /usr/local/bin/cranl: Not a valid dynamic program
```

The official CLI is a 100 MB **glibc-linked** ARM64 binary (`interpreter /lib/ld-linux-aarch64.so.1`);
this sandbox is Alpine/musl under PRoot, whose loader rejects it. Installing `gcompat` did not help
and re-downloading the binary reproduced it byte-for-byte (checksum verified by the installer).

**Workaround, committed to the device:** `/usr/local/bin/cranl-api` — a ~180-line stdlib Python
client that speaks the same REST API, discovers operations from `/api/v1/manifest`, and mirrors
`cranl call` semantics (path params, JSON inputs, `--dry-run` → `plan:true`, `--yes` handling the
`confirmation_required` → `confirm_token` retry). It reads `CRANL_API_KEY` and never prints it.

```bash
cranl-api whoami                 # account + credential scopes
cranl-api ops databases          # operations in a toolset, with inputs
cranl-api list_regions --json
cranl-api query_database --database_id <id> --query "select 1" --json
```

This is a workaround for the *sandbox*, not for the project: on any normal machine, or in CI,
`curl -fsSL https://cranl.com/install.sh | sh` installs the real CLI. Documented here so nobody
re-discovers it, and so the README can say what was actually used.

## 5. What the owner must do (nothing below is possible without these)

1. **Upgrade to Pro** — <https://app.cranl.com/dashboard/billing>. Unlocks `riyadh-1`, object
   storage, custom domains and the resource headroom.
2. **Connect GitHub** — <https://app.cranl.com/dashboard/github>, granting access to `nah-632/VELORA`.
   This is what makes "automatic builds on push" true. Can be skipped: the app can be created from
   the public clone URL and deployed on demand instead, but then pushes do not deploy.
3. **Decide the custom domain** for the public invitation links (the addendum requires one; a
   domain must exist and be pointed by CNAME/ALIAS at `<app>-<id>.cranl.net`).

## 6. What happens next (after the three items above)

1. `create_database` — PostgreSQL, `riyadh-1`, inject `DATABASE_URL` into the app.
2. `create_app` — from the GitHub repo, branch `main`, region `riyadh-1`, `port: 3000`, with the
   full environment set *before* the first build.
3. `create_bucket` + `create_bucket_key` — store the access/secret pair as app environment
   variables (the secret is shown once).
4. `create_cron_job` × N — the scheduled tasks (mark-ended, reminder lists, temp-file cleanup).
5. `add_domain` — the chosen hostname; wait for the certificate.
6. `configure_app {protect:true}` + `protect_database`.
7. Migrations + seed, then the first real build log, then the first real page.

Steps 1–7 are all performed through `cranl-api` from this device; none of them need a browser.

README additions the addendum asks for (CranL setup, migrations, admin-password rotation, backup
restore, enabling WhatsApp Business API later) are written **with** the migration, not before it —
a setup guide for code that does not exist yet is fiction.
