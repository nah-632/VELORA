-- 0006_event_details.sql
--
-- The details an operator actually has and the invitation was not carrying: a full address, where
-- to park, which entrance, whether the hall is separated, and the running order of the evening.
--
-- All of it bilingual, because the guest chooses their language and the operator is holding both
-- versions anyway — the couple sends them in Arabic and the venue's own name is usually Latin.
--
-- `schedule` is a jsonb array rather than a table. It is not related to anything, it is read only
-- with its event, and it has no lifecycle of its own: a normalised `event_schedule` table would add
-- a join, an ordering column and a cascade to every read and every delete, to store six lines that
-- are always fetched together. The trade is stated rather than hidden: the database can tell you it
-- is an array, and the *shape* of each item is enforced by zod at the boundary
-- (`ScheduleItemSchema`), because a CHECK constraint cannot hold a subquery.

alter table public.events add column if not exists venue_address_ar text;
alter table public.events add column if not exists venue_address_en text;
alter table public.events add column if not exists parking_ar text;
alter table public.events add column if not exists parking_en text;
alter table public.events add column if not exists entrance_ar text;
alter table public.events add column if not exists entrance_en text;
alter table public.events add column if not exists sections_ar text;
alter table public.events add column if not exists sections_en text;
alter table public.events add column if not exists schedule jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_schedule_is_array') then
    alter table public.events add constraint events_schedule_is_array
      check (jsonb_typeof(schedule) = 'array');
  end if;
end
$$;

comment on column public.events.schedule is
  'Ordered [{time, title_ar, title_en, detail_ar, detail_en}]. Shape enforced by zod, not by a CHECK
   constraint: a constraint cannot hold a subquery over the elements.';
