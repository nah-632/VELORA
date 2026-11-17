-- 0003_identity_policies.sql
--
-- Row-level security for the identity tables.
--
-- Kept apart from 0002 so the schema and the access rules can be read, reviewed and diffed
-- separately — and so a policy can be changed without touching a table definition.
--
-- The rule these policies encode: a customer may see and edit themselves and nothing else.
-- Administrative reach is a separate, explicit policy on every table; there is no "staff sees
-- everything" shortcut, so each grant of reach is visible in this file.
--
-- Idempotent: every policy is dropped before it is created.

-- ---------------------------------------------------------------------------
-- roles
-- ---------------------------------------------------------------------------

alter table public.roles enable row level security;

drop policy if exists roles_read_all on public.roles;
create policy roles_read_all
  on public.roles for select
  to anon, authenticated
  using (true);

drop policy if exists roles_admin_write on public.roles;
create policy roles_admin_write
  on public.roles for all
  to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- Everyone may read their own profile; an administrator may read any.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select
  on public.profiles for select
  to authenticated
  using (user_id = app_private.uid() or app_private.is_admin());

-- A customer may edit their own profile. `with check` repeats the condition on the new row,
-- so the update cannot move the row to another user.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (user_id = app_private.uid())
  with check (user_id = app_private.uid());

-- An administrator may edit any profile: the business needs to correct a misspelt name or
-- deactivate an account.
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
  on public.profiles for update
  to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- Deliberately absent: an INSERT policy, because profiles are created by the auth trigger;
-- and a DELETE policy, because an account is deactivated, never removed.

-- ---------------------------------------------------------------------------
-- user_roles
-- ---------------------------------------------------------------------------

alter table public.user_roles enable row level security;

drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select
  on public.user_roles for select
  to authenticated
  using (user_id = app_private.uid() or app_private.is_admin());

-- The single most sensitive write in the schema. Only an administrator may grant or revoke,
-- and `with check` prevents a grant from being smuggled in as an update to someone else's row.
drop policy if exists user_roles_admin_write on public.user_roles;
create policy user_roles_admin_write
  on public.user_roles for all
  to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- ---------------------------------------------------------------------------
-- admin_activity_log
-- ---------------------------------------------------------------------------

alter table public.admin_activity_log enable row level security;

drop policy if exists admin_activity_log_select on public.admin_activity_log;
create policy admin_activity_log_select
  on public.admin_activity_log for select
  to authenticated
  using (app_private.is_admin());

-- Deliberately absent: insert, update and delete policies. Rows arrive through
-- app_private.log_admin_action() only, and no role holds an UPDATE or DELETE grant.
-- An audit trail that can be edited is not an audit trail.

-- ---------------------------------------------------------------------------
-- Assert the invariants that would silently defeat the policies above
-- ---------------------------------------------------------------------------
-- A table with policies but no RLS enabled is fully open to every grant holder; the policies
-- are simply inert. This is a real and quiet failure mode, so it fails loudly here instead.

do $$
declare
  v_missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into v_missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relname in ('profiles', 'user_roles', 'roles', 'admin_activity_log')
     and not c.relrowsecurity;

  if v_missing is not null then
    raise exception 'RLS is not enabled on: %', v_missing;
  end if;
end
$$;
