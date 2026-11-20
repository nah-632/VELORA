/**
 * Event queries.
 *
 * SQL, not an ORM's query builder, for the parts where the shape of the query is the point: the
 * list carries three counts per event, and expressing that as three correlated sub-selects in one
 * statement is clearer here than three round trips assembled in TypeScript.
 */
import { getSql } from "@/lib/db";
import { zonedToUtc } from "@/lib/time";

/** The database handle, injectable so the writers can be driven against PGlite in tests. */
type Sql = ReturnType<typeof getSql>;
import { type EventInput, type VenueInput } from "./schema";

export interface EventListRow {
  id: string;
  slug: string;
  status: string;
  bride_name_ar: string | null;
  bride_name_en: string | null;
  groom_name_ar: string | null;
  groom_name_en: string | null;
  event_datetime: Date;
  timezone: string;
  venue_name_ar: string | null;
  venue_name_en: string | null;
  venue_address_ar: string | null;
  venue_address_en: string | null;
  schedule: unknown;
  template_name: string | null;
  guests: number;
  confirmed: number;
  declined: number;
  no_response: number;
}

/**
 * The programme is written as JSON *text* with the cast in the SQL, never as a jsonb parameter.
 *
 * Two driver behaviours had to be satisfied at once, and both bit before this line settled:
 *
 *   1. `::jsonb` on a value the client already JSON-encoded makes postgres.js serialise it a second
 *      time — `"[]"` arrives as the jsonb **string** `"[]"`, `jsonb_typeof` answers `string`, and the
 *      array constraint refuses the row.
 *   2. Putting the cast in the *value* (`${"[]" + "::jsonb"}`) sends `[]::jsonb` as data, and the
 *      parser reports "Expected end of input, but found ':'".
 *
 * `::text::jsonb` in the SQL text pins the parameter as text first and lets Postgres parse the JSON
 * itself. Same expression, same result, in the tests and in production.
 */

export async function listEvents(): Promise<EventListRow[]> {
  return getSql()<EventListRow[]>`
    select e.id, e.slug, e.status,
           e.bride_name_ar, e.bride_name_en, e.groom_name_ar, e.groom_name_en,
           e.event_datetime, e.timezone, e.venue_name_ar, e.venue_name_en,
           e.venue_address_ar, e.venue_address_en, e.schedule,
           t.name_en as template_name,
           (select count(*)::int from public.guests g where g.event_id = e.id) as guests,
           (select count(*)::int from public.rsvps r
              join public.guests g2 on g2.id = r.guest_id
             where g2.event_id = e.id and r.response = 'confirmed') as confirmed,
           (select count(*)::int from public.rsvps r
              join public.guests g3 on g3.id = r.guest_id
             where g3.event_id = e.id and r.response = 'declined') as declined,
           (select count(*)::int from public.guests g4
             where g4.event_id = e.id
               and not exists (select 1 from public.rsvps r where r.guest_id = g4.id)) as no_response
      from public.events e
      left join public.templates t on t.id = e.template_id
     order by e.event_datetime desc`;
}

export interface EventDetail extends EventListRow {
  hijri_date_text: string | null;
  venue_map_url: string | null;
  parking_ar: string | null;
  parking_en: string | null;
  entrance_ar: string | null;
  entrance_en: string | null;
  sections_ar: string | null;
  sections_en: string | null;
  dress_code_ar: string | null;
  dress_code_en: string | null;
  copy_templates: unknown;
  theme_override: unknown;
  quote_ar: string | null;
  quote_en: string | null;
  notes_ar: string | null;
  notes_en: string | null;
  thank_you_confirmed_ar: string | null;
  thank_you_confirmed_en: string | null;
  thank_you_declined_ar: string | null;
  thank_you_declined_en: string | null;
  template_id: string | null;
  monogram_text: string | null;
  design_config: unknown;
}

export async function getEvent(id: string, options: { sql?: Sql } = {}): Promise<EventDetail | null> {
  const sql = options.sql ?? getSql();
  const rows = await sql<EventDetail[]>`
    select e.*, t.name_en as template_name, t.design_config
      from public.events e
      left join public.templates t on t.id = e.template_id
     where e.id = ${id}
     limit 1`;
  // A malformed uuid reaches this as a Postgres cast error, which is not the caller's question.
  return rows[0] ?? null;
}

export interface TemplateOption {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
}

export interface VenueRow {
  id: string;
  kind: string;
  sort_order: number;
  name_ar: string | null;
  name_en: string | null;
  address_ar: string | null;
  address_en: string | null;
  map_url: string | null;
  start_time: string | null;
  entrance_ar: string | null;
  entrance_en: string | null;
  parking_ar: string | null;
  parking_en: string | null;
  dress_code_ar: string | null;
  dress_code_en: string | null;
  notes_ar: string | null;
  notes_en: string | null;
  contact_phone: string | null;
}

export async function listVenues(eventId: string, options: { sql?: Sql } = {}): Promise<VenueRow[]> {
  const sql = options.sql ?? getSql();
  return sql<VenueRow[]>`
    select * from public.event_venues where event_id = ${eventId}
     order by sort_order, kind`;
}

/**
 * Replace the halls of an event with exactly this set.
 *
 * Delete-then-insert rather than a diff: there are at most three rows, they are edited as a set (the
 * mode switch can remove a hall entirely), and a diff would have to decide what to do with a row whose
 * kind no longer exists. In one transaction, so a failure leaves the previous set in place.
 */
export async function saveVenues(
  eventId: string,
  venues: VenueInput[],
  options: { sql?: Sql } = {},
): Promise<void> {
  const sql = options.sql ?? getSql();
  await sql.begin(async (tx) => {
    await tx`delete from public.event_venues where event_id = ${eventId}`;
    let order = 0;
    for (const venue of venues) {
      await tx`
        insert into public.event_venues (
          event_id, kind, sort_order, name_ar, name_en, address_ar, address_en, map_url, start_time,
          entrance_ar, entrance_en, parking_ar, parking_en, dress_code_ar, dress_code_en,
          notes_ar, notes_en, contact_phone
        ) values (
          ${eventId}, ${venue.kind}, ${order},
          ${venue.name_ar ?? null}, ${venue.name_en ?? null},
          ${venue.address_ar ?? null}, ${venue.address_en ?? null},
          ${venue.map_url ?? null}, ${venue.start_time ?? null},
          ${venue.entrance_ar ?? null}, ${venue.entrance_en ?? null},
          ${venue.parking_ar ?? null}, ${venue.parking_en ?? null},
          ${venue.dress_code_ar ?? null}, ${venue.dress_code_en ?? null},
          ${venue.notes_ar ?? null}, ${venue.notes_en ?? null},
          ${venue.contact_phone ?? null}
        )`;
      order += 1;
    }
  });
}

export async function listTemplateOptions(): Promise<TemplateOption[]> {
  return getSql()<TemplateOption[]>`
    select id, slug, name_ar, name_en from public.templates order by sort_order, slug`;
}

export async function createEvent(
  input: EventInput,
  slug: string,
  options: { sql?: Sql } = {},
): Promise<string> {
  // The form sends a wall clock and the event carries a zone; the conversion is here, once, rather
  // than in three places that could disagree.
  const sql = options.sql ?? getSql();
  const startsAt = input.event_datetime
    ? zonedToUtc(input.event_datetime, input.timezone)
    : new Date();
  const rows = await sql<{ id: string }[]>`
    insert into public.events (
      slug, bride_name_ar, bride_name_en, groom_name_ar, groom_name_en,
      event_datetime, timezone, hijri_date_text,
      venue_name_ar, venue_name_en, venue_map_url,
      venue_address_ar, venue_address_en, parking_ar, parking_en,
      entrance_ar, entrance_en, sections_ar, sections_en, schedule,
      quote_ar, quote_en, notes_ar, notes_en,
      dress_code_ar, dress_code_en,
      thank_you_confirmed_ar, thank_you_confirmed_en,
      thank_you_declined_ar, thank_you_declined_en,
      template_id, monogram_text, status
    ) values (
      ${slug}, ${input.bride_name_ar ?? null}, ${input.bride_name_en ?? null},
      ${input.groom_name_ar ?? null}, ${input.groom_name_en ?? null},
      ${startsAt}, ${input.timezone}, ${input.hijri_date_text ?? null},
      ${input.venue_name_ar ?? null}, ${input.venue_name_en ?? null}, ${input.venue_map_url ?? null},
      ${input.venue_address_ar ?? null}, ${input.venue_address_en ?? null},
      ${input.parking_ar ?? null}, ${input.parking_en ?? null},
      ${input.entrance_ar ?? null}, ${input.entrance_en ?? null},
      ${input.sections_ar ?? null}, ${input.sections_en ?? null},
      ${JSON.stringify(input.schedule ?? [])}::text::jsonb,
      ${input.quote_ar ?? null}, ${input.quote_en ?? null},
      ${input.notes_ar ?? null}, ${input.notes_en ?? null},
      ${input.dress_code_ar ?? null}, ${input.dress_code_en ?? null},
      ${input.thank_you_confirmed_ar ?? null}, ${input.thank_you_confirmed_en ?? null},
      ${input.thank_you_declined_ar ?? null}, ${input.thank_you_declined_en ?? null},
      ${input.template_id ?? null}, ${input.monogram_text ?? null}, ${input.status}
    ) returning id`;
  return rows[0]!.id;
}

export async function updateEvent(
  id: string,
  input: EventInput,
  options: { sql?: Sql } = {},
): Promise<void> {
  const sql = options.sql ?? getSql();
  const startsAt = input.event_datetime
    ? zonedToUtc(input.event_datetime, input.timezone)
    : new Date();
  await sql`
    update public.events set
      bride_name_ar = ${input.bride_name_ar ?? null},
      bride_name_en = ${input.bride_name_en ?? null},
      groom_name_ar = ${input.groom_name_ar ?? null},
      groom_name_en = ${input.groom_name_en ?? null},
      event_datetime = ${startsAt},
      timezone = ${input.timezone},
      hijri_date_text = ${input.hijri_date_text ?? null},
      venue_name_ar = ${input.venue_name_ar ?? null},
      venue_name_en = ${input.venue_name_en ?? null},
      venue_map_url = ${input.venue_map_url ?? null},
      venue_address_ar = ${input.venue_address_ar ?? null},
      venue_address_en = ${input.venue_address_en ?? null},
      parking_ar = ${input.parking_ar ?? null},
      parking_en = ${input.parking_en ?? null},
      entrance_ar = ${input.entrance_ar ?? null},
      entrance_en = ${input.entrance_en ?? null},
      sections_ar = ${input.sections_ar ?? null},
      sections_en = ${input.sections_en ?? null},
      schedule = ${JSON.stringify(input.schedule ?? [])}::text::jsonb,
      quote_ar = ${input.quote_ar ?? null},
      quote_en = ${input.quote_en ?? null},
      notes_ar = ${input.notes_ar ?? null},
      notes_en = ${input.notes_en ?? null},
      dress_code_ar = ${input.dress_code_ar ?? null},
      dress_code_en = ${input.dress_code_en ?? null},
      thank_you_confirmed_ar = ${input.thank_you_confirmed_ar ?? null},
      thank_you_confirmed_en = ${input.thank_you_confirmed_en ?? null},
      thank_you_declined_ar = ${input.thank_you_declined_ar ?? null},
      thank_you_declined_en = ${input.thank_you_declined_en ?? null},
      template_id = ${input.template_id ?? null},
      monogram_text = ${input.monogram_text ?? null},
      status = ${input.status}
    where id = ${id}`;
}
