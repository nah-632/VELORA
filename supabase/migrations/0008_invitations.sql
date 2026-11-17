-- 0008_invitations.sql
--
-- The customer's own work: an invitation being designed, and the versions of it that were saved.
--
-- Three decisions worth stating:
--
--   1. **A draft belongs to a session before it belongs to a person.** Designing happens before
--      anyone wants to create an account, so a draft is reachable by an unguessable token held in
--      an httpOnly cookie, with `customer_id` left NULL until the draft is claimed. The column is
--      there from the start, so claiming is an UPDATE rather than a migration of live data.
--
--   2. **The design configuration is copied in, not referenced.** `template_id` records which
--      design was chosen; `design_config` records exactly how it looked. Editing a template next
--      month must not silently redraw an invitation that is already sold — this is the whole
--      reason the configuration is versioned.
--
--   3. **Content and design stay in separate columns.** The brief requires the customer's words to
--      be separable from the visual rendering, and a schema that merges them is a schema that will
--      be merged in practice.
--
-- Idempotent: safe to apply twice.

create table if not exists public.invitations (
  id           uuid primary key default gen_random_uuid(),

  template_id  uuid not null references public.templates (id) on delete restrict,

  -- Exactly one of these identifies the owner. A draft has a token; a claimed draft has a customer.
  customer_id  uuid references auth.users (id) on delete set null,
  draft_token  uuid not null default gen_random_uuid(),

  locale       text not null default 'ar',

  content      jsonb not null default '{}'::jsonb,
  design_config jsonb not null,

  status       text not null default 'draft',
  revision     integer not null default 0,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  claimed_at   timestamptz,

  constraint invitations_locale_valid check (locale in ('ar', 'en')),
  constraint invitations_status_valid check (status in ('draft', 'ordered', 'archived')),
  constraint invitations_content_is_object check (jsonb_typeof(content) = 'object'),
  constraint invitations_config_is_object check (jsonb_typeof(design_config) = 'object'),
  constraint invitations_config_versioned check (
    design_config ? 'version' and (design_config ->> 'version') ~ '^[0-9]+$'
  ),
  constraint invitations_revision_non_negative check (revision >= 0),
  constraint invitations_claim_consistent check (
    (customer_id is null and claimed_at is null)
    or (customer_id is not null and claimed_at is not null)
  )
);

alter table public.invitations
  drop column if exists design_config_version;
alter table public.invitations
  add column design_config_version integer
  generated always as ((design_config ->> 'version')::integer) stored;

-- The token is a capability, so it must be unique: two drafts sharing one would be two customers
-- sharing one invitation.
create unique index if not exists invitations_draft_token_key on public.invitations (draft_token);
create index if not exists invitations_customer_idx on public.invitations (customer_id, updated_at desc);

drop trigger if exists invitations_set_updated_at on public.invitations;
create trigger invitations_set_updated_at
  before update on public.invitations
  for each row execute function app_private.set_updated_at();

comment on column public.invitations.draft_token is
  'Unguessable capability held in an httpOnly cookie. Reachable through app_private only.';
comment on column public.invitations.design_config is
  'A snapshot taken when the design was chosen, so later template edits cannot redraw this invitation.';

-- ---------------------------------------------------------------------------
-- Versions
-- ---------------------------------------------------------------------------
-- Written on an explicit save, not on every autosave: a version history that records every
-- keystroke is not a history, it is a log.

create table if not exists public.invitation_versions (
  id            uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  revision      integer not null,
  content       jsonb not null,
  design_config jsonb not null,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  -- Named rather than left to the default, because draft_save() has to refer to it as a conflict
  -- target: inside a PL/pgSQL function that returns a `revision` column, a bare column list in
  -- `on conflict (...)` is ambiguous between the variable and the column.
  constraint invitation_versions_revision_key unique (invitation_id, revision)
);

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
-- Row-level security admits a signed-in customer to their own invitations and nothing else.
-- Anonymous drafts are reached only through the SECURITY DEFINER functions below, which require
-- the caller to present the token. A capability, not a policy loophole: the function compares the
-- token it was given with the one on the row.

alter table public.invitations enable row level security;
alter table public.invitation_versions enable row level security;

grant select, insert, update on public.invitations to authenticated;
grant select on public.invitation_versions to authenticated;

drop policy if exists invitations_select_own on public.invitations;
create policy invitations_select_own
  on public.invitations for select
  to authenticated
  using (customer_id = app_private.uid() or app_private.is_admin());

drop policy if exists invitations_update_own on public.invitations;
create policy invitations_update_own
  on public.invitations for update
  to authenticated
  using (customer_id = app_private.uid())
  with check (customer_id = app_private.uid());

drop policy if exists invitations_insert_own on public.invitations;
create policy invitations_insert_own
  on public.invitations for insert
  to authenticated
  with check (customer_id = app_private.uid());

drop policy if exists invitation_versions_select_own on public.invitation_versions;
create policy invitation_versions_select_own
  on public.invitation_versions for select
  to authenticated
  using (
    app_private.is_admin()
    or exists (
      select 1 from public.invitations i
       where i.id = invitation_versions.invitation_id
         and i.customer_id = app_private.uid()
    )
  );

-- Deliberately absent: a DELETE policy. A customer's work is archived, never removed by them.
