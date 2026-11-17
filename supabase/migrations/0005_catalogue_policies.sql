-- 0005_catalogue_policies.sql
--
-- Row-level security for the catalogue.
--
-- The rule the catalogue needs: **an unpublished template must be invisible to the public, and
-- the draft must still be reachable by the administrator who is working on it.** That is one
-- condition, written once per table, rather than a filter in an application query that somebody
-- will eventually forget.

alter table public.template_categories enable row level security;
alter table public.templates enable row level security;
alter table public.template_assets enable row level security;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

drop policy if exists template_categories_select on public.template_categories;
create policy template_categories_select
  on public.template_categories for select
  to anon, authenticated
  using (is_active or app_private.is_admin());

drop policy if exists template_categories_admin_write on public.template_categories;
create policy template_categories_admin_write
  on public.template_categories for all
  to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- ---------------------------------------------------------------------------
-- templates
-- ---------------------------------------------------------------------------
-- Anonymous visitors see published templates only. An administrator sees everything, including
-- their own drafts — and `with check` stops a non-administrator inserting or promoting one.

drop policy if exists templates_select on public.templates;
create policy templates_select
  on public.templates for select
  to anon, authenticated
  using (status = 'published' or app_private.is_admin());

drop policy if exists templates_admin_write on public.templates;
create policy templates_admin_write
  on public.templates for all
  to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- ---------------------------------------------------------------------------
-- assets
-- ---------------------------------------------------------------------------
-- An asset is visible exactly when its template is. Expressed as a subquery against templates
-- rather than a duplicated status column, so the two can never disagree.

drop policy if exists template_assets_select on public.template_assets;
create policy template_assets_select
  on public.template_assets for select
  to anon, authenticated
  using (
    app_private.is_admin()
    or exists (
      select 1 from public.templates t
       where t.id = template_assets.template_id
         and t.status = 'published'
    )
  );

drop policy if exists template_assets_admin_write on public.template_assets;
create policy template_assets_admin_write
  on public.template_assets for all
  to authenticated
  using (app_private.is_admin())
  with check (app_private.is_admin());

-- ---------------------------------------------------------------------------
-- Assert the invariants that would silently defeat the policies above
-- ---------------------------------------------------------------------------

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
     and c.relname in ('template_categories', 'templates', 'template_assets')
     and not c.relrowsecurity;

  if v_missing is not null then
    raise exception 'RLS is not enabled on: %', v_missing;
  end if;
end
$$;
