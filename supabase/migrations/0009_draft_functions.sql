-- 0009_draft_functions.sql
--
-- Saving and loading a draft.
--
-- Why these are SECURITY DEFINER rather than policies: an anonymous visitor is not a role with
-- an identity, so there is nothing for a row-level policy to compare against. The draft token
-- *is* the identity — a 128-bit value the server generated and stores in an httpOnly cookie, and
-- a caller can only reach a draft by presenting it. That is a capability, and a capability has to
-- be checked in code, not in a `using` clause.
--
-- What they deliberately do **not** do is accept a customer id from the caller. Claiming a draft
-- is a separate, authenticated operation.
--
-- Idempotent: safe to apply twice.

-- ---------------------------------------------------------------------------
-- Load
-- ---------------------------------------------------------------------------

create or replace function public.draft_load(p_token uuid)
returns table (
  id            uuid,
  template_id   uuid,
  template_slug text,
  locale        text,
  content       jsonb,
  design_config jsonb,
  revision      integer,
  updated_at    timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_token is null then
    raise exception 'a draft token is required' using errcode = '22023';
  end if;

  return query
    select i.id, i.template_id, t.slug, i.locale, i.content, i.design_config, i.revision, i.updated_at
      from public.invitations i
      join public.templates t on t.id = i.template_id
     where i.draft_token = p_token;
end
$$;

comment on function public.draft_load(uuid) is
  'Returns the draft identified by the token, or nothing. The token is the capability.';

-- ---------------------------------------------------------------------------
-- Save
-- ---------------------------------------------------------------------------

create or replace function public.draft_save(
  p_token             uuid,
  p_template_id       uuid,
  p_locale            text,
  p_content           jsonb,
  p_design_config     jsonb,
  p_expected_revision integer default null,
  p_snapshot          boolean default false
)
returns table (id uuid, revision integer, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id        uuid;
  v_revision  integer;
  v_updated   timestamptz;
begin
  if p_token is null then
    raise exception 'a draft token is required' using errcode = '22023';
  end if;
  if p_content is null or jsonb_typeof(p_content) <> 'object' then
    raise exception 'content must be a JSON object' using errcode = '22023';
  end if;
  if p_design_config is null or jsonb_typeof(p_design_config) <> 'object'
     or not (p_design_config ? 'version') then
    raise exception 'a versioned design configuration is required' using errcode = '22023';
  end if;
  if p_locale not in ('ar', 'en') then
    raise exception 'unsupported locale: %', p_locale using errcode = '22023';
  end if;

  select i.id, i.revision into v_id, v_revision
    from public.invitations i
   where i.draft_token = p_token;

  if v_id is null then
    insert into public.invitations (template_id, draft_token, locale, content, design_config, revision)
    values (p_template_id, p_token, p_locale, p_content, p_design_config, 0)
    returning invitations.id, invitations.revision, invitations.updated_at
      into v_id, v_revision, v_updated;
  else
    -- Optimistic concurrency. Two tabs, or a stale autosave landing after a manual save, would
    -- otherwise silently overwrite newer work with older.
    if p_expected_revision is not null and p_expected_revision <> v_revision then
      raise exception
        'this invitation changed since it was last read: expected revision %, found %',
        p_expected_revision, v_revision
        using errcode = '40001';
    end if;

    update public.invitations i
       set locale        = p_locale,
           content       = p_content,
           design_config = p_design_config,
           revision      = i.revision + 1
     where i.id = v_id
     returning i.revision, i.updated_at into v_revision, v_updated;
  end if;

  -- A version is written on an explicit save, never on an autosave. A history that records every
  -- keystroke is a log, not a history.
  if p_snapshot then
    insert into public.invitation_versions (invitation_id, revision, content, design_config)
    values (v_id, v_revision, p_content, p_design_config)
    -- Named constraint, not a column list: a bare `revision` here is ambiguous with this
    -- function's own output column of the same name.
    on conflict on constraint invitation_versions_revision_key do nothing;
  end if;

  return query select v_id, v_revision, v_updated;
end
$$;

comment on function public.draft_save(uuid, uuid, text, jsonb, jsonb, integer, boolean) is
  'Creates or updates the draft identified by the token. Rejects a stale expected_revision.';

-- Anonymous visitors must be able to design, so anon holds execute. The token is what limits them.
grant execute on function public.draft_load(uuid) to anon, authenticated;
grant execute on function public.draft_save(uuid, uuid, text, jsonb, jsonb, integer, boolean)
  to anon, authenticated;
