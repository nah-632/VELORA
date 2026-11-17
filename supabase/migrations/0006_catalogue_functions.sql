-- 0006_catalogue_functions.sql
--
-- The catalogue queries, defined once, in SQL.
--
-- Why functions rather than query builders in the application: the same query then serves the
-- public site, the administrator's screens and the test suite, and row-level security applies to
-- it automatically because these are SECURITY INVOKER. It also means the local test database and
-- any hosted database run byte-identical query logic — there is no second implementation to drift.

-- ---------------------------------------------------------------------------
-- Literal escaping for ILIKE
-- ---------------------------------------------------------------------------
-- A customer typing `%` should search for a percent sign, not match the entire catalogue. The
-- parameter is already bound (so there is no injection risk); this is about the search meaning
-- what it says.

create or replace function app_private.like_literal(value text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(coalesce(value, ''), '\', '\\'), '%', '\%'), '_', '\_')
$$;

comment on function app_private.like_literal(text) is
  'Escapes LIKE metacharacters so a literal search string means itself.';

-- ---------------------------------------------------------------------------
-- Categories, with a count of what is actually visible
-- ---------------------------------------------------------------------------

create or replace function public.catalogue_categories(p_locale text default 'ar')
returns table (
  slug    text,
  name    text,
  total   bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.slug,
    case when p_locale = 'ar' then c.name_ar else c.name_en end as name,
    count(t.id) as total
  from public.template_categories c
  -- LEFT JOIN so a category with nothing published still appears, with a truthful zero.
  left join public.templates t
    on t.category_id = c.id
   and t.status = 'published'
  where c.is_active
  group by c.slug, c.name_ar, c.name_en, c.sort_order
  order by c.sort_order
$$;

-- ---------------------------------------------------------------------------
-- The catalogue listing
-- ---------------------------------------------------------------------------

create or replace function public.catalogue_list(
  p_locale   text default 'ar',
  p_category text default null,
  p_search   text default null,
  p_featured boolean default null,
  p_limit    integer default 48,
  p_offset   integer default 0
)
returns table (
  id                uuid,
  slug              text,
  name              text,
  description       text,
  category_slug     text,
  category_name     text,
  design_config     jsonb,
  preview_content   jsonb,
  supported_locales text[],
  base_price_fils   integer,
  is_featured       boolean,
  total_count       bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered as (
    select
      t.id,
      t.slug,
      case when p_locale = 'ar' then t.name_ar else t.name_en end as name,
      case when p_locale = 'ar' then t.description_ar else t.description_en end as description,
      c.slug as category_slug,
      case when p_locale = 'ar' then c.name_ar else c.name_en end as category_name,
      t.design_config,
      t.preview_content,
      t.supported_locales,
      t.base_price_fils,
      t.is_featured,
      t.sort_order,
      t.created_at
    from public.templates t
    join public.template_categories c on c.id = t.category_id
    where t.status = 'published'
      and c.is_active
      and (p_category is null or c.slug = p_category)
      and (p_featured is null or t.is_featured = p_featured)
      and (
        coalesce(btrim(p_search), '') = ''
        or t.name_en ilike '%' || app_private.like_literal(p_search) || '%'
        or t.name_ar ilike '%' || app_private.like_literal(p_search) || '%'
        or coalesce(t.description_en, '') ilike '%' || app_private.like_literal(p_search) || '%'
        or coalesce(t.description_ar, '') ilike '%' || app_private.like_literal(p_search) || '%'
        or c.name_en ilike '%' || app_private.like_literal(p_search) || '%'
        or c.name_ar ilike '%' || app_private.like_literal(p_search) || '%'
      )
  )
  select
    f.id, f.slug, f.name, f.description, f.category_slug, f.category_name,
    f.design_config, f.preview_content, f.supported_locales, f.base_price_fils, f.is_featured,
    -- Window function: evaluated before LIMIT, so a caller learns the total for paging without
    -- issuing a second query that could disagree with this one.
    count(*) over () as total_count
  from filtered f
  order by f.is_featured desc, f.sort_order, f.created_at desc
  limit greatest(1, least(coalesce(p_limit, 48), 96))
  offset greatest(0, coalesce(p_offset, 0))
$$;

-- ---------------------------------------------------------------------------
-- A single template
-- ---------------------------------------------------------------------------

create or replace function public.catalogue_get(
  p_slug   text,
  p_locale text default 'ar'
)
returns table (
  id                uuid,
  slug              text,
  name              text,
  description       text,
  category_slug     text,
  category_name     text,
  design_config     jsonb,
  preview_content   jsonb,
  customization_options jsonb,
  supported_locales text[],
  base_price_fils   integer,
  is_featured       boolean,
  published_at      timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.id, t.slug,
    case when p_locale = 'ar' then t.name_ar else t.name_en end,
    case when p_locale = 'ar' then t.description_ar else t.description_en end,
    c.slug,
    case when p_locale = 'ar' then c.name_ar else c.name_en end,
    t.design_config, t.preview_content, t.customization_options,
    t.supported_locales, t.base_price_fils, t.is_featured, t.published_at
  from public.templates t
  join public.template_categories c on c.id = t.category_id
  where t.slug = p_slug
    and t.status = 'published'
  limit 1
$$;

grant execute on function public.catalogue_list(text, text, text, boolean, integer, integer)
  to anon, authenticated;
grant execute on function public.catalogue_get(text, text) to anon, authenticated;
grant execute on function public.catalogue_categories(text) to anon, authenticated;
