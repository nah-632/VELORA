# Releasing a migration and a deployment together

The container and the schema arrive separately: CranL replaces the container on deploy, while the
migration is applied by a command. Get the order wrong and the new container is running code that
queries tables which do not exist — which shows up as a 500 on the page a guest opened, not as a
failed deployment.

**Order: migrate first, then deploy.**

```bash
# 1. Apply any migration the new code needs, against production, before the container changes.
#    From this device, with external access enabled:
#      POST /databases/{id}/query  { "query": "<the migration file>", "write": true }
#    and record it, so the runner does not apply it twice:
#      insert into public.schema_migrations (name, checksum)
#      values ('0007_dual_venues.sql', '<sha256 of the file, first 16 hex>')
#      on conflict (name) do nothing;
#
# 2. Deploy.
#      POST /apps/{id}/deploy
#
# 3. Confirm both, from outside — this is the check that would have caught the 0007 failure:
#      GET /api/health  →  checks.schema.ok === true
#                      →  checks.migrations.applied === the new file
```

## Why the release step is not optional

A missing **table** can sometimes be guarded with `to_regclass`. A missing **column** cannot:
Postgres resolves column references when it parses the statement, so
`case when exists (…) then g.gender end` still fails to parse. The answer is the order of the release,
not a cleverer query.

## The migrations, in order

Every file in `db/migrations/`, applied in filename order. `npm run check:release-order` fails if a
file exists here and is not named below.

| # | Migration | Adds | Read by | Apply before deploy? |
|---|---|---|---|---|
| 0001 | `0001_operator_baseline.sql` | `events`, `guests`, `rsvps`, `templates`, `settings`, `schema_migrations`, and the touch triggers | the whole operator product: every query in `src/features/{events,guests,invitations}` selects from these tables | **Yes** — nothing works without it |
| 0002 | `0002_admin_auth.sql` | `admin_users`, `admin_sessions`, `admin_login_attempts` | `src/features/admin/{credentials,sessions,login}.ts` — every sign-in, and `requireAdmin()` on every console page | **Yes** |
| 0003 | `0003_templates.sql` | the eight designs, and `templates.design_config` / `preview_content` made required | `src/features/invitations/public.ts` and the catalogue; `/i/<token>` cannot render without a design row | **Yes** |
| 0004 | `0004_admin_totp.sql` | `admin_login_challenges`, `admin_users.totp_last_counter`, `totp_confirmed_at` | `src/features/admin/totp.ts` — the second step of sign-in | **Yes** |
| 0005 | `0005_rate_limits.sql` | `rate_limit_events` | `src/features/invitations/rate-limit.ts` — the public routes' limiter | **Yes** |
| 0006 | `0006_event_details.sql` | `venue_address_*`, `parking_*`, `entrance_*`, `sections_*`, `schedule` on `events` | the event editor, the public page and the `.ics` generator | **Yes** |
| 0007 | `0007_dual_venues.sql` | `event_venues`, `guests.gender`, `guests.audience`, `events.copy_templates` | `/i/<token>` (selects the halls), the event console (`listVenues`, `saveVenues`), the WhatsApp sender | **Yes** — see below |

| 0008 | `0008_theme_override.sql` | `events.theme_override` (jsonb, default `{}`), and the Golden Palace row in `templates` | the invitation page reads the slug and the override; the editor's template picker lists the row | **Yes** |
| 0009 | `0009_token_config.sql` | `templates.token_config` (jsonb, nullable), plus the `emerald-envelope` and `velora-classic` rows and a backfill of Golden Palace's | `src/features/invitations/public.ts` selects `t.token_config` for `/i/<token>`; the catalogue and studio continue to read `design_config` from the same row | **Yes** |

0009 is additive and nullable, so the previous container keeps rendering against the migrated database
— a row without a token document falls back to `getTemplateBySlug` in the code, which is exactly what
every row did before it.

## The 0007 case, which is why this file exists

`0007_dual_venues.sql` was additive — it creates a table, adds two columns with defaults, and moves
existing venue rows into the new table — so the *previous* container kept working against the
migrated database. That is what makes "migrate first" safe in either direction.

The reverse was not true. The new code reads the new objects on two dynamic routes:

| Reader | When it runs | If 0007 is missing |
|---|---|---|
| `/i/<token>` — the guest's invitation | on request | **500** — the guest sees an error page |
| `/admin/events/<id>` — the operator console | on request | **500** |
| `/api/health` | on request | reports `schema.ok: false`, keeps serving |
| anything at boot | never | — |

A deployment went out with the code and without the migration, and the rollout failed for an unrelated
reason before anyone saw it. That is luck, not process. The process is now: this file, the guard that
keeps it complete, and `checks.schema` in health for the case where the order is missed anyway.

## If the order is missed

`/api/health` names it: `checks.schema.objects` lists exactly which of the objects are absent, and
`checks.schema.ok` is false. The site keeps serving; the two pages above error until the migration is
applied.