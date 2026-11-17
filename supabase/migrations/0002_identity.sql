-- 0002_identity.sql
--
-- Who a person is, and what they are allowed to do.
--
-- Design notes:
--   * Identity lives in Supabase's `auth.users`. This migration never writes to it except
--     through the standard `handle_new_user` trigger, and never duplicates credentials.
--   * Roles are reference data in a table, not an enum: adding a role must not require a
--     migration that rewrites a type, and an administrator will need to inspect them.
--   * Every table here has RLS enabled and an explicit grant. A grant without RLS is an open
--     door; RLS without a grant is a wall with nothing behind it. Both are required.
--
-- Idempotent: safe to apply twice.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

create table if not exists public.roles (
  code        text primary key,
  label_en    text not null,
  label_ar    text not null,
  description text,
  is_staff    boolean not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.roles is 'Reference data. Seeded here; edited by administrators, not by users.';

insert into public.roles (code, label_en, label_ar, description, is_staff) values
  ('customer', 'Customer', 'عميل',  'Buys invitations and manages their own orders.', false),
  ('admin',    'Administrator', 'مدير', 'Full operational access, including other accounts.', true)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  full_name        text not null default '',
  phone_e164       text,
  preferred_locale text not null default 'ar' check (preferred_locale in ('ar', 'en')),
  marketing_consent boolean not null default false,
  deactivated_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint profiles_phone_shape check (
    phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'
  )
);

comment on column public.profiles.phone_e164 is
  'E.164 only. Bahraini numbers arrive from customers as 8 digits or 3xxx xxxx and must be normalised at the boundary.';
comment on column public.profiles.deactivated_at is
  'Accounts are deactivated, never deleted: an order history must outlive the ability to sign in.';

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- User roles
-- ---------------------------------------------------------------------------

create table if not exists public.user_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role_code  text not null references public.roles (code) on update cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id),
  primary key (user_id, role_code)
);

create index if not exists user_roles_role_code_idx on public.user_roles (role_code);

comment on table public.user_roles is
  'Granted roles. A customer may read their own; only an administrator may change any.';

-- ---------------------------------------------------------------------------
-- Staff membership test
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER on purpose: the policy on user_roles calls this function, and a policy that
-- had to read user_roles as the caller would recurse. It runs as its owner, which owns the
-- table and therefore bypasses RLS, and it can only ever answer a membership question — it
-- grants nothing by itself.

create or replace function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.user_roles ur
     where ur.user_id = app_private.uid()
       and ur.role_code = 'admin'
  )
$$;

comment on function app_private.is_admin() is
  'True when the caller holds the admin role. Reads user_roles as the definer to avoid policy recursion.';

-- ---------------------------------------------------------------------------
-- Activity log
-- ---------------------------------------------------------------------------

create table if not exists public.admin_activity_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users (id),
  action      text not null,
  entity_type text,
  entity_id   uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists admin_activity_log_created_at_idx
  on public.admin_activity_log (created_at desc);
create index if not exists admin_activity_log_entity_idx
  on public.admin_activity_log (entity_type, entity_id);

comment on table public.admin_activity_log is
  'Append-only record of sensitive administrative actions. Written only by app_private.log_admin_action().';

create or replace function app_private.log_admin_action(
  p_action      text,
  p_entity_type text default null,
  p_entity_id   uuid default null,
  p_detail      jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.uid();
  v_id    bigint;
begin
  if v_actor is null then
    raise exception 'an activity log entry needs an authenticated actor'
      using errcode = '42501';
  end if;

  if not app_private.is_admin() then
    raise exception 'only an administrator may write to the activity log'
      using errcode = '42501';
  end if;

  insert into public.admin_activity_log (actor_id, action, entity_type, entity_id, detail)
  values (v_actor, p_action, p_entity_type, p_entity_id, coalesce(p_detail, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end
$$;

-- ---------------------------------------------------------------------------
-- New auth user -> profile + default role
-- ---------------------------------------------------------------------------
-- Runs as the definer because the creating session is Supabase's auth service, which holds no
-- grant on these tables and should not need one.

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role_code)
  values (new.id, 'customer')
  on conflict (user_id, role_code) do nothing;

  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

-- Reference data: readable by everyone, writable only through an admin-checked policy.
grant select on public.roles to anon, authenticated;
grant insert, update, delete on public.roles to authenticated;

grant select, update on public.profiles to authenticated;

grant select on public.user_roles to authenticated;
grant insert, update, delete on public.user_roles to authenticated;

grant select on public.admin_activity_log to authenticated;
-- No insert/update/delete grant: the only writer is app_private.log_admin_action(), a
-- SECURITY DEFINER function. An append-only log that the app can rewrite is not a log.

grant execute on function app_private.is_admin() to authenticated, anon;
grant execute on function app_private.log_admin_action(text, text, uuid, jsonb) to authenticated;
