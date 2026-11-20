-- 0007_dual_venues.sql
--
-- Weddings here usually have two halls, and the single-venue model could not express that: one set
-- of venue columns on `events`, which meant the operator either typed both halls into one name or
-- sent guests to the wrong one.
--
-- So venues become rows. Each event has one of:
--   * a women's hall and a men's hall (the common case),
--   * a single 'shared' venue,
--   * or only one of the two, which is legal and needs no special handling.
--
-- Existing data is migrated to a 'shared' venue rather than being left behind: an event that had a
-- venue name and an address keeps them, and nobody has to re-enter anything.

create table if not exists public.event_venues (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events (id) on delete cascade,
  kind         text not null,
  sort_order   integer not null default 0,
  name_ar      text,
  name_en      text,
  address_ar   text,
  address_en   text,
  map_url      text,
  -- Free text, because halls do not start on the same clock and "after the zaffa" is a real answer.
  start_time   text,
  entrance_ar  text,
  entrance_en  text,
  parking_ar   text,
  parking_en   text,
  dress_code_ar text,
  dress_code_en text,
  notes_ar     text,
  notes_en     text,
  contact_phone text,
  created_at   timestamptz not null default now(),
  constraint event_venues_kind_known check (kind in ('women', 'men', 'shared')),
  -- One of each kind per event: two "women's halls" is not a configuration, it is a mistake.
  constraint event_venues_unique_kind unique (event_id, kind)
);

create index if not exists event_venues_event_idx on public.event_venues (event_id, sort_order);

-- ---------------------------------------------------------------------------------------------
-- Migrate the single-venue data.
-- ---------------------------------------------------------------------------------------------
insert into public.event_venues (
  event_id, kind, sort_order, name_ar, name_en, address_ar, address_en, map_url,
  entrance_ar, entrance_en, parking_ar, parking_en, dress_code_ar, dress_code_en, notes_ar, notes_en
)
select
  e.id, 'shared', 0,
  e.venue_name_ar, e.venue_name_en, e.venue_address_ar, e.venue_address_en, e.venue_map_url,
  e.entrance_ar, e.entrance_en, e.parking_ar, e.parking_en,
  e.dress_code_ar, e.dress_code_en, e.notes_ar, e.notes_en
from public.events e
where coalesce(
  e.venue_name_ar, e.venue_name_en, e.venue_address_ar, e.venue_address_en,
  e.venue_map_url, e.entrance_ar, e.entrance_en, e.parking_ar, e.parking_en
) is not null
on conflict (event_id, kind) do nothing;

comment on column public.events.venue_name_ar is
  'Superseded by event_venues. Kept until every reader has moved: dropping a column the moment its '
  'replacement exists is how a migration becomes an outage.';

-- ---------------------------------------------------------------------------------------------
-- Who the guest is, and which hall they are being welcomed to.
-- ---------------------------------------------------------------------------------------------
alter table public.guests add column if not exists gender text not null default 'neutral';
-- Nullable on purpose: null means "work it out from the gender", and an explicit value means the
-- operator overrode it — a family, a couple, or a guest who is neither of the two.
alter table public.guests add column if not exists audience text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'guests_gender_known') then
    alter table public.guests add constraint guests_gender_known
      check (gender in ('male', 'female', 'neutral'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'guests_audience_known') then
    alter table public.guests add constraint guests_audience_known
      check (audience is null or audience in ('women', 'men', 'both'));
  end if;
end
$$;

comment on column public.guests.gender is
  'Drives the Arabic inflection of buttons and verbs. neutral uses wording that is correct for anyone.';
comment on column public.guests.audience is
  'Which hall this guest is expected in. NULL derives from gender: female → women, male → men, '
  'neutral → both. The operator can set it directly for a family or a couple.';

-- ---------------------------------------------------------------------------------------------
-- The per-event wording.
-- ---------------------------------------------------------------------------------------------
alter table public.events add column if not exists copy_templates jsonb not null default '{}'::jsonb;
comment on column public.events.copy_templates is
  'Overrides for the invitation wording, per language and slot. Empty means "use the default text".';
