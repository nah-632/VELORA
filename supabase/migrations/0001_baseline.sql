-- 0001_baseline.sql
--
-- VELORA schema baseline.
--
-- Deliberately dependency-free: this project uses **no PostgreSQL extensions**. UUIDs come from
-- the core `gen_random_uuid()` (PostgreSQL 13+), so no pgcrypto, and there is no citext, no
-- pgvector, no pg_cron. Every migration must remain replayable on a stock PostgreSQL 17 —
-- which is exactly what the local test harness runs.
--
-- Idempotent: the harness applies the whole migration set twice in a row.

create schema if not exists app_private;

-- Nothing outside the database's own functions should be able to poke at app_private.
revoke all on schema app_private from public;
grant usage on schema app_private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Caller identity
-- ---------------------------------------------------------------------------
-- Read from the JWT claim that PostgREST sets on the session. Never from a function argument:
-- a caller-supplied identity is a claim, not an identity.

create or replace function app_private.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

comment on function app_private.uid() is
  'Authenticated caller id from the JWT claim. NULL when anonymous.';

create or replace function app_private.role_name()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

comment on function app_private.role_name() is
  'API role from the JWT claim: anon, authenticated or service_role.';

-- ---------------------------------------------------------------------------
-- Business calendar
-- ---------------------------------------------------------------------------
-- The business operates on Gulf time. A date computed in UTC would be wrong for roughly three
-- hours every day, which is exactly when a wedding is being looked at.

create or replace function app_private.bahrain_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Bahrain')::date
$$;

comment on function app_private.bahrain_today() is
  'Current date in Asia/Bahrain. Use for anything a customer calls "today".';

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
-- Set by trigger rather than by application code: an UPDATE that forgets the column is a silent
-- data-quality bug, and the application is not the only writer.

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

comment on function app_private.set_updated_at() is
  'BEFORE UPDATE trigger. Attach to every table carrying updated_at.';

grant execute on function app_private.uid() to anon, authenticated, service_role;
grant execute on function app_private.role_name() to anon, authenticated, service_role;
grant execute on function app_private.bahrain_today() to anon, authenticated, service_role;
