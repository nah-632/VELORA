/**
 * Event queries.
 *
 * SQL, not an ORM's query builder, for the parts where the shape of the query is the point: the
 * list carries three counts per event, and expressing that as three correlated sub-selects in one
 * statement is clearer here than three round trips assembled in TypeScript.
 */
import { getSql } from "@/lib/db";
import { type EventInput } from "./schema";

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
  template_name: string | null;
  guests: number;
  confirmed: number;
  declined: number;
  no_response: number;
}

export async function listEvents(): Promise<EventListRow[]> {
  return getSql()<EventListRow[]>`
    select e.id, e.slug, e.status,
           e.bride_name_ar, e.bride_name_en, e.groom_name_ar, e.groom_name_en,
           e.event_datetime, e.timezone, e.venue_name_ar, e.venue_name_en,
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
  quote_ar: string | null;
  quote_en: string | null;
  notes_ar: string | null;
  notes_en: string | null;
  dress_code_ar: string | null;
  dress_code_en: string | null;
  thank_you_confirmed_ar: string | null;
  thank_you_confirmed_en: string | null;
  thank_you_declined_ar: string | null;
  thank_you_declined_en: string | null;
  template_id: string | null;
  monogram_text: string | null;
  design_config: unknown;
}

export async function getEvent(id: string): Promise<EventDetail | null> {
  const rows = await getSql()<EventDetail[]>`
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

export async function listTemplateOptions(): Promise<TemplateOption[]> {
  return getSql()<TemplateOption[]>`
    select id, slug, name_ar, name_en from public.templates order by sort_order, slug`;
}

export async function createEvent(input: EventInput, slug: string): Promise<string> {
  const rows = await getSql()<{ id: string }[]>`
    insert into public.events (
      slug, bride_name_ar, bride_name_en, groom_name_ar, groom_name_en,
      event_datetime, timezone, hijri_date_text,
      venue_name_ar, venue_name_en, venue_map_url,
      quote_ar, quote_en, notes_ar, notes_en,
      dress_code_ar, dress_code_en,
      thank_you_confirmed_ar, thank_you_confirmed_en,
      thank_you_declined_ar, thank_you_declined_en,
      template_id, monogram_text, status
    ) values (
      ${slug}, ${input.bride_name_ar ?? null}, ${input.bride_name_en ?? null},
      ${input.groom_name_ar ?? null}, ${input.groom_name_en ?? null},
      ${input.event_datetime || new Date().toISOString()}, ${input.timezone}, ${input.hijri_date_text ?? null},
      ${input.venue_name_ar ?? null}, ${input.venue_name_en ?? null}, ${input.venue_map_url ?? null},
      ${input.quote_ar ?? null}, ${input.quote_en ?? null},
      ${input.notes_ar ?? null}, ${input.notes_en ?? null},
      ${input.dress_code_ar ?? null}, ${input.dress_code_en ?? null},
      ${input.thank_you_confirmed_ar ?? null}, ${input.thank_you_confirmed_en ?? null},
      ${input.thank_you_declined_ar ?? null}, ${input.thank_you_declined_en ?? null},
      ${input.template_id ?? null}, ${input.monogram_text ?? null}, ${input.status}
    ) returning id`;
  return rows[0]!.id;
}

export async function updateEvent(id: string, input: EventInput): Promise<void> {
  await getSql()`
    update public.events set
      bride_name_ar = ${input.bride_name_ar ?? null},
      bride_name_en = ${input.bride_name_en ?? null},
      groom_name_ar = ${input.groom_name_ar ?? null},
      groom_name_en = ${input.groom_name_en ?? null},
      event_datetime = ${input.event_datetime ? new Date(input.event_datetime) : new Date()},
      timezone = ${input.timezone},
      hijri_date_text = ${input.hijri_date_text ?? null},
      venue_name_ar = ${input.venue_name_ar ?? null},
      venue_name_en = ${input.venue_name_en ?? null},
      venue_map_url = ${input.venue_map_url ?? null},
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
