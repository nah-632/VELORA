# Releasing a migration and a deployment together

The container and the schema arrive separately: CranL replaces the container on deploy, while the
migration is applied by a command. Get the order wrong and the new container is running code that
queries tables which do not exist — which shows up as a 500 on the page a guest opened, not as a
failed deployment.

**Order: migrate first, then deploy.**

```bash
# 1. Apply the migrations that are already in the repository the old container was built from,
#    plus any new one, against production. From this device, with external access enabled:
#      POST /databases/{id}/query  { "query": "<the migration file>" , "write": true }
#    and record it, so the runner does not apply it twice:
#      insert into public.schema_migrations (name, checksum) values ('0007_dual_venues.sql', '<sha256[:16]>')
#
# 2. Deploy.
#      POST /apps/{id}/deploy
#
# 3. Confirm both, from outside:
#      GET /api/health  →  checks.schema.ok === true   and   checks.migrations.applied === the new file
```

## Why the release step is not optional

`0007_dual_venues.sql` is **additive**: it creates a table, adds two columns with defaults, and moves
existing venue rows into the new table. Nothing is dropped, so the *previous* container keeps working
against the migrated database — which is what makes migrating first safe.

The reverse is not true. The new code reads `event_venues` and `guests.gender`:

| Reader | When it runs | If 0007 is missing |
|---|---|---|
| `/i/<token>` (the guest's invitation) | on request | **500** — the guest sees an error page |
| `/admin/events/<id>` | on request | **500** |
| `/api/health` | on request | reports `schema.ok: false`, keeps serving |
| anything at boot | never | — |

A missing *table* can be guarded with `to_regclass`, but a missing *column* cannot: Postgres resolves
column references when it parses the statement, so `case when exists (…) then g.gender end` still
fails to parse. That is why the answer is the order of the release rather than a cleverer query.

## If the order is ever missed

`/api/health` names it: `checks.schema.objects` lists exactly which of the three objects are absent,
and `checks.schema.ok` is false. The site keeps serving; the two pages above will error until the
migration is applied.
