-- 0004_catalogue.sql
--
-- The template catalogue: categories, templates, and their assets.
--
-- Design notes:
--   * A template is **data**, not a component. The brief requires that an administrator can add,
--     edit, publish and unpublish a template without changing application code, so everything
--     that varies lives in a row.
--   * `design_config` is a **versioned document**, and the version is lifted into a generated
--     column. The Studio will store a snapshot of the exact configuration an invitation was made
--     from, so a template edited later cannot silently change an invitation already sold.
--   * `preview_content` is deliberately a **separate column** from `design_config`. The brief is
--     explicit that invitation content must be separable from its visual rendering; keeping the
--     sample text in its own column means the thumbnail uses the same separation the Studio will.
--   * `base_price_fils` is **nullable on purpose**. Prices are a business decision and the brief
--     forbids inventing them, so the catalogue ships unpriced and says so in the interface rather
--     than showing a number somebody guessed.
--
-- Idempotent: safe to apply twice.

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

create table if not exists public.template_categories (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name_en        text not null,
  name_ar        text not null,
  description_en text,
  description_ar text,
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint template_categories_slug_shape check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

drop trigger if exists template_categories_set_updated_at on public.template_categories;
create trigger template_categories_set_updated_at
  before update on public.template_categories
  for each row execute function app_private.set_updated_at();

-- The seven categories named in the brief.
insert into public.template_categories (slug, name_en, name_ar, sort_order) values
  ('classic-royal',      'Classic Royal',      'ملكي كلاسيكي',  10),
  ('modern-minimal',     'Modern Minimal',     'حديث بسيط',     20),
  ('floral',             'Floral',             'زهري',          30),
  ('romantic',           'Romantic',           'رومانسي',       40),
  ('contemporary',       'Contemporary',       'معاصر',         50),
  ('traditional-arabic', 'Traditional Arabic', 'عربي تقليدي',   60),
  ('luxury-editorial',   'Luxury Editorial',   'فخامة تحريرية', 70)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------

create table if not exists public.templates (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  category_id       uuid not null references public.template_categories (id) on delete restrict,
  name_en           text not null,
  name_ar           text not null,
  description_en    text,
  description_ar    text,

  -- The visual definition. Never contains the customer's words.
  design_config     jsonb not null,
  -- The sample words used in the catalogue thumbnail. Never contains design decisions.
  preview_content   jsonb not null default '{}'::jsonb,

  supported_locales text[] not null default array['ar', 'en'],
  customization_options jsonb not null default '{}'::jsonb,

  -- NULL means "not priced yet". The interface must say so rather than show a guess.
  base_price_fils   integer,

  status            text not null default 'draft',
  is_featured       boolean not null default false,
  sort_order        integer not null default 0,
  published_at      timestamptz,
  created_by        uuid references auth.users (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint templates_slug_shape check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint templates_status_valid check (status in ('draft', 'published', 'archived')),
  constraint templates_price_positive check (base_price_fils is null or base_price_fils >= 0),
  constraint templates_config_is_object check (jsonb_typeof(design_config) = 'object'),
  -- A design configuration without a version cannot be migrated later, so it is not allowed in.
  constraint templates_config_versioned check (
    design_config ? 'version' and (design_config ->> 'version') ~ '^[0-9]+$'
  ),
  constraint templates_preview_is_object check (jsonb_typeof(preview_content) = 'object'),
  constraint templates_locales_known check (supported_locales <@ array['ar', 'en']::text[]),
  -- A published template must record when it was published; an unpublished one must not.
  constraint templates_published_consistency check (
    (status = 'published' and published_at is not null)
    or (status <> 'published' and published_at is null)
  )
);

-- Lifted out of the document so it can be indexed and filtered, and so it cannot disagree with
-- the document it is derived from.
alter table public.templates
  drop column if exists design_config_version;
alter table public.templates
  add column design_config_version integer
  generated always as ((design_config ->> 'version')::integer) stored;

drop trigger if exists templates_set_updated_at on public.templates;
create trigger templates_set_updated_at
  before update on public.templates
  for each row execute function app_private.set_updated_at();

create index if not exists templates_status_sort_idx
  on public.templates (status, is_featured desc, sort_order, created_at desc);
create index if not exists templates_category_idx
  on public.templates (category_id, status);

comment on column public.templates.design_config is
  'Versioned visual definition. Contains no customer content — see preview_content.';
comment on column public.templates.base_price_fils is
  'NULL until the owner sets a price. The interface must render an unpriced state, never a guess.';

-- ---------------------------------------------------------------------------
-- Assets
-- ---------------------------------------------------------------------------

create table if not exists public.template_assets (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.templates (id) on delete cascade,
  kind         text not null,
  storage_path text not null,
  alt_en       text,
  alt_ar       text,
  width        integer,
  height       integer,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  constraint template_assets_kind_valid check (kind in ('thumbnail', 'preview', 'background')),
  constraint template_assets_path_shape check (storage_path <> '')
);

create index if not exists template_assets_template_idx
  on public.template_assets (template_id, sort_order);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select on public.template_categories to anon, authenticated;
grant insert, update, delete on public.template_categories to authenticated;

grant select on public.templates to anon, authenticated;
grant insert, update, delete on public.templates to authenticated;

grant select on public.template_assets to anon, authenticated;
grant insert, update, delete on public.template_assets to authenticated;
