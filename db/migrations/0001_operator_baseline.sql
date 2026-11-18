-- 0001_operator_baseline.sql
--
-- VELORA, operator model. This is a NEW baseline, not a continuation of supabase/migrations/:
-- that set described a different product (customer accounts, orders, drafts) and leaned on
-- Supabase's `auth` schema for identity, which does not exist on CranL.
--
-- Authorization is NOT in this file. ADDENDUM E removes Row Level Security from the architecture
-- (tasks/plan.md AD-13): the application connects as the database owner, so a policy here would be
-- decorative. Every admin read and write is gated in the application layer instead, and the only
-- public surface is the token route. That is a weaker guarantee than RLS and it is accepted
-- deliberately — isolation is a test obligation now, not a database property.
--
-- No extensions are required: gen_random_uuid() is built in from PostgreSQL 13.

-- ---------------------------------------------------------------------------------------------
-- settings — exactly one row, enforced by the schema rather than by convention.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.settings (
  id                boolean primary key default true,
  whatsapp_number   text not null default '+97366661238',
  message_templates jsonb not null default '{}'::jsonb,
  logo_url          text,
  default_timezone  text not null default 'Asia/Bahrain',
  updated_at        timestamptz not null default now(),
  constraint settings_single_row check (id),
  constraint settings_whatsapp_e164 check (whatsapp_number ~ '^\+[1-9][0-9]{6,14}$')
);

comment on column public.settings.message_templates is
  'AR/EN message bodies with {guest_name} and {link} placeholders, keyed by language and purpose.';

-- ---------------------------------------------------------------------------------------------
-- templates — the design presets an event is built from.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.templates (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique,
  name_ar                text not null,
  name_en                text not null,
  description_ar         text,
  description_en         text,
  palette                jsonb not null default '{}'::jsonb,
  fonts                  jsonb not null default '{}'::jsonb,
  opening_animation_type text not null default 'wax_seal',
  layout_config          jsonb not null default '{}'::jsonb,
  sort_order             integer not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint templates_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint templates_animation_known check (
    opening_animation_type in ('wax_seal', 'curtain', 'none')
  )
);

-- ---------------------------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------------------------
create table if not exists public.events (
  id                          uuid primary key default gen_random_uuid(),
  slug                        text not null unique,
  -- Bilingual by schema, not by translation: the invitation is shown in the guest's language.
  groom_name_ar               text,
  groom_name_en               text,
  bride_name_ar               text,
  bride_name_en               text,
  monogram_text               text,
  event_datetime              timestamptz not null,
  timezone                    text not null default 'Asia/Bahrain',
  hijri_date_text             text,
  venue_name_ar               text,
  venue_name_en               text,
  venue_map_url               text,
  quote_ar                    text,
  quote_en                    text,
  notes_ar                    text,
  notes_en                    text,
  dress_code_ar               text,
  dress_code_en               text,
  thank_you_confirmed_ar      text,
  thank_you_confirmed_en      text,
  thank_you_declined_ar       text,
  thank_you_declined_en       text,
  template_id                 uuid references public.templates (id) on delete set null,
  theme_overrides             jsonb not null default '{}'::jsonb,
  -- Per-event switches for the signature features (ADDENDUM C/D). Absent key = default.
  features                    jsonb not null default '{}'::jsonb,
  status                      text not null default 'draft',
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint events_status_known check (status in ('draft', 'active', 'ended')),
  constraint events_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- A draft may be half-empty on purpose (a half-filled draft must be saveable — that lesson was
  -- learned the hard way in Milestone 4). What is never allowed is an event with no name at all,
  -- because that is not a half-filled form, it is not an event.
  constraint events_at_least_one_name check (
    coalesce(groom_name_ar, groom_name_en, bride_name_ar, bride_name_en) is not null
  )
);

create index if not exists events_status_datetime_idx on public.events (status, event_datetime);
create index if not exists events_template_idx on public.events (template_id);

-- ---------------------------------------------------------------------------------------------
-- guests — one row per invitation link.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.guests (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events (id) on delete cascade,
  full_name        text not null,
  phone            text not null,
  category         text not null default 'other',
  language         text not null default 'ar',
  max_companions   integer not null default 0,
  -- The capability: possession of this token is the only thing that reaches an invitation.
  -- 160 bits of base64url, generated server-side. Never derived from the guest row.
  token            text not null unique,
  send_status      text not null default 'not_sent',
  sent_at          timestamptz,
  first_opened_at  timestamptz,
  open_count       integer not null default 0,
  personal_line_ar text,
  personal_line_en text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint guests_phone_e164 check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  constraint guests_category_known check (category in ('family', 'friends', 'work', 'other')),
  constraint guests_language_known check (language in ('ar', 'en')),
  constraint guests_send_status_known check (send_status in ('not_sent', 'sent')),
  constraint guests_max_companions_range check (max_companions between 0 and 20),
  constraint guests_open_count_non_negative check (open_count >= 0),
  constraint guests_token_length check (length(token) between 22 and 128),
  constraint guests_personal_line_length check (
    coalesce(length(personal_line_ar), 0) <= 140 and coalesce(length(personal_line_en), 0) <= 140
  ),
  -- Injectable text is stored as written; the application escapes it on the way out and the
  -- length limit is enforced here as well as in the form, so a client cannot bypass it.
  constraint guests_personal_line_no_control check (
    coalesce(personal_line_ar, '') !~ '[[:cntrl:]]' and coalesce(personal_line_en, '') !~ '[[:cntrl:]]'
  )
);

create index if not exists guests_event_idx on public.guests (event_id);
create index if not exists guests_event_category_idx on public.guests (event_id, category);
create index if not exists guests_send_status_idx on public.guests (event_id, send_status);

-- ---------------------------------------------------------------------------------------------
-- rsvps — one row per guest, updated in place (a guest may change their answer).
-- ---------------------------------------------------------------------------------------------
create table if not exists public.rsvps (
  id               uuid primary key default gen_random_uuid(),
  guest_id         uuid not null unique references public.guests (id) on delete cascade,
  response         text not null,
  companions_count integer not null default 0,
  responded_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint rsvps_response_known check (response in ('confirmed', 'declined')),
  constraint rsvps_companions_range check (companions_count between 0 and 20),
  -- Declining with companions is a contradiction, not a rounding error.
  constraint rsvps_declined_has_no_companions check (
    response <> 'declined' or companions_count = 0
  )
);

create index if not exists rsvps_response_idx on public.rsvps (response);

-- ---------------------------------------------------------------------------------------------
-- updated_at, maintained by the database so it cannot drift from the row it describes.
-- ---------------------------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['settings', 'templates', 'events', 'guests', 'rsvps'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I
         for each row execute function public.touch_updated_at()', t, t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- The one row of data this migration owns: the operator's WhatsApp sending number.
-- ADDENDUM E names it as a seed default. It is editable in Settings and used as the "from"
-- identity everywhere (message templates, footer contact link, wa.me links).
-- ---------------------------------------------------------------------------------------------
insert into public.settings (whatsapp_number)
values ('+97366661238')
on conflict (id) do nothing;
