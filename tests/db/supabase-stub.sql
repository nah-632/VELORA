-- Minimal stand-in for the parts of a Supabase database that VELORA's migrations depend on.
--
-- Only two things are stubbed: the three API roles and the `auth` schema. Everything else the
-- tests exercise is the real PostgreSQL that the migrations will meet in production. This keeps
-- the local suite meaningful instead of testing a mock of itself.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    -- Supabase's service role bypasses RLS by design; tests must never assume otherwise.
    create role service_role nologin bypassrls;
  end if;
end
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table auth.users is 'Supabase-managed table. Stubbed locally; never written by VELORA code.';
