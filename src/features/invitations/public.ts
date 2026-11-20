/**
 * The public side of an invitation: the /i/[token] route.
 *
 * Everything in this file is written on the assumption that the request comes from a stranger's
 * phone, and that the only thing it is allowed to learn is what is on *their* invitation.
 *
 * Three rules govern it:
 *
 *  1. **The minimum.** A token returns one guest's greeting, one event's wording, and one design.
 *     No phone numbers, no other guests, no counts, no ids. The brief is explicit, and so is the
 *     reason: an invitation link is forwarded, screenshotted and logged.
 *  2. **Counted, not tracked.** The first open is recorded, and a counter goes up. No address, no
 *     device, no per-visit history — the operator needs to know whether the invitation arrived,
 *     not where the guest was standing.
 *  3. **Never cached.** `no-store`, plus `noindex`, because a cached invitation in a shared proxy is
 *     a private letter left on a table in a public room.
 */
import { getSql } from "@/lib/db";
import { DesignConfigSchema, type DesignConfig } from "@/features/catalogue/design-config";
import { resolveAudience, resolveCopy } from "./messages";
import { type InvitationBlocks } from "@/features/studio/blocks";

export interface PublicInvitation {
  guestName: string;
  language: "ar" | "en";
  /** What the copy and the Arabic buttons inflect for. */
  gender: "male" | "female" | "neutral";
  /** Which hall this guest is expected in: what the operator set, or what the gender implies. */
  audience: "women" | "men" | "both";
  copyByLocale: { ar: Record<string, string>; en: Record<string, string> };
  venues: import("./venues").Venue[];
  /** How this design opens. 'none' still renders the invitation, just without an entrance. */
  animation: "wax_seal" | "curtain" | "none";
  personalLine: string | null;
  blocks: InvitationBlocks;
  design: DesignConfig;
  event: {
    brideNameAr: string | null;
    brideNameEn: string | null;
    groomNameAr: string | null;
    groomNameEn: string | null;
    eventDatetime: Date;
    timezone: string;
    hijriDateText: string | null;
    venueNameAr: string | null;
    venueNameEn: string | null;
    venueAddressAr: string | null;
    venueAddressEn: string | null;
    venueMapUrl: string | null;
    parkingAr: string | null;
    parkingEn: string | null;
    entranceAr: string | null;
    entranceEn: string | null;
    sectionsAr: string | null;
    sectionsEn: string | null;
    dressCodeAr: string | null;
    dressCodeEn: string | null;
    schedule: unknown;
    quoteAr: string | null;
    quoteEn: string | null;
    notesAr: string | null;
    notesEn: string | null;
    monogramText: string | null;
    thankYouConfirmedAr: string | null;
    thankYouConfirmedEn: string | null;
    thankYouDeclinedAr: string | null;
    thankYouDeclinedEn: string | null;
  };
}

interface Row {
  guest_id: string;
  full_name: string;
  language: string;
  personal_line_ar: string | null;
  personal_line_en: string | null;
  first_opened_at: Date | null;
  gender: string;
  audience: string | null;
  bride_name_ar: string | null;
  bride_name_en: string | null;
  groom_name_ar: string | null;
  groom_name_en: string | null;
  event_datetime: Date;
  timezone: string;
  hijri_date_text: string | null;
  venue_name_ar: string | null;
  venue_name_en: string | null;
  venue_address_ar: string | null;
  venue_address_en: string | null;
  venue_map_url: string | null;
  parking_ar: string | null;
  parking_en: string | null;
  entrance_ar: string | null;
  entrance_en: string | null;
  sections_ar: string | null;
  sections_en: string | null;
  dress_code_ar: string | null;
  dress_code_en: string | null;
  schedule: unknown;
  quote_ar: string | null;
  quote_en: string | null;
  notes_ar: string | null;
  notes_en: string | null;
  monogram_text: string | null;
  thank_you_confirmed_ar: string | null;
  thank_you_confirmed_en: string | null;
  thank_you_declined_ar: string | null;
  thank_you_declined_en: string | null;
  design_config: unknown;
  opening_animation_type: string | null;
  copy_templates: unknown;
  venues: unknown;
}

/**
 * A token is opaque, so anything that is not the right *shape* is rejected before it reaches SQL.
 * That keeps a malformed URL from being a database error, and keeps the response time for junk
 * indistinguishable from the response time for a token that simply does not exist.
 */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{22,128}$/;

/**
 * The database handle is injectable so the public route can be tested against a real PostgreSQL
 * without a server — the same seam `login.ts` uses. What these tests assert is not that the SQL runs
 * but that it counts an open exactly once and returns nothing it should not.
 */
type Sql = ReturnType<typeof getSql>;

export function looksLikeToken(value: string): boolean {
  return TOKEN_SHAPE.test(value);
}

/**
 * Records the open, once, and returns the invitation.
 *
 * The open is counted in the same statement that reads the row, so a guest who opens the link twice
 * in a second produces one write and a counter of two — rather than a read-modify-write race that
 * loses one of them.
 */
export async function loadInvitation(
  token: string,
  options: { sql?: Sql; recordOpen?: boolean } = {},
): Promise<PublicInvitation | null> {
  if (!looksLikeToken(token)) return null;
  const sql = options.sql ?? getSql();

  /**
   * `recordOpen` is true for the page and false for everything else. The calendar file and the
   * operator's preview are not the guest opening their invitation, and counting them would make the
   * RSVP dashboard's "has not opened it yet" column a lie — which is exactly the number the operator
   * uses to decide who to chase.
   */
  if (options.recordOpen === false) {
    const rows = await sql<Row[]>`
      select g.id as guest_id, g.full_name, g.language, g.personal_line_ar, g.personal_line_en, g.gender, g.audience, g.gender, g.audience,
             g.first_opened_at,
             e.bride_name_ar, e.bride_name_en, e.groom_name_ar, e.groom_name_en,
             e.event_datetime, e.timezone, e.hijri_date_text,
             e.venue_name_ar, e.venue_name_en, e.venue_address_ar, e.venue_address_en, e.venue_map_url,
           e.parking_ar, e.parking_en, e.entrance_ar, e.entrance_en, e.sections_ar, e.sections_en,
           e.dress_code_ar, e.dress_code_en, e.schedule, e.copy_templates,
             coalesce((select jsonb_agg(to_jsonb(v) order by v.sort_order, v.kind)
                         from public.event_venues v where v.event_id = e.id), '[]'::jsonb) as venues, e.copy_templates,
           coalesce((select jsonb_agg(to_jsonb(v) order by v.sort_order, v.kind)
                       from public.event_venues v where v.event_id = e.id), '[]'::jsonb) as venues,
             e.quote_ar, e.quote_en, e.notes_ar, e.notes_en, e.monogram_text,
             e.thank_you_confirmed_ar, e.thank_you_confirmed_en,
             e.thank_you_declined_ar, e.thank_you_declined_en,
             t.design_config, t.opening_animation_type
        from public.guests g
        join public.events e on e.id = g.event_id
        left join public.templates t on t.id = e.template_id
       where g.token = ${token}
       limit 1`;
    return rows[0] ? toInvitation(rows[0]) : null;
  }

  const rows = await sql<Row[]>`
    with opened as (
      update public.guests
         set first_opened_at = coalesce(first_opened_at, now()),
             open_count = open_count + 1
       where token = ${token}
       returning id, full_name, language, personal_line_ar, personal_line_en, gender, audience, first_opened_at, event_id
    )
    select o.id as guest_id, o.full_name, o.language, o.personal_line_ar, o.personal_line_en,
           o.gender, o.audience, o.first_opened_at,
           e.bride_name_ar, e.bride_name_en, e.groom_name_ar, e.groom_name_en,
           e.event_datetime, e.timezone, e.hijri_date_text,
           e.venue_name_ar, e.venue_name_en, e.venue_address_ar, e.venue_address_en, e.venue_map_url,
           e.parking_ar, e.parking_en, e.entrance_ar, e.entrance_en, e.sections_ar, e.sections_en,
           e.dress_code_ar, e.dress_code_en, e.schedule, e.copy_templates,
             coalesce((select jsonb_agg(to_jsonb(v) order by v.sort_order, v.kind)
                         from public.event_venues v where v.event_id = e.id), '[]'::jsonb) as venues, e.copy_templates,
           coalesce((select jsonb_agg(to_jsonb(v) order by v.sort_order, v.kind)
                       from public.event_venues v where v.event_id = e.id), '[]'::jsonb) as venues,
           e.quote_ar, e.quote_en, e.notes_ar, e.notes_en, e.monogram_text,
           e.thank_you_confirmed_ar, e.thank_you_confirmed_en,
           e.thank_you_declined_ar, e.thank_you_declined_en,
           t.design_config, t.opening_animation_type
      from opened o
      join public.events e on e.id = o.event_id
      left join public.templates t on t.id = e.template_id
     limit 1`;

  return rows[0] ? toInvitation(rows[0]) : null;
}

/** One place that turns a row into an invitation, so the counting and non-counting paths cannot drift. */
function toInvitation(row: Row): PublicInvitation | null {
  const design = DesignConfigSchema.safeParse(row.design_config);
  if (!design.success) {
    // A design that cannot be parsed is a stored bug. Rendering "something close" would put a
    // stranger in front of a broken invitation; the route renders a plain apology instead.
    return null;
  }

  const language: "ar" | "en" = row.language === "en" ? "en" : "ar";
  const animation =
    row.opening_animation_type === "curtain" || row.opening_animation_type === "none"
      ? row.opening_animation_type
      : "wax_seal";

  const gender: "male" | "female" | "neutral" =
    row.gender === "male" || row.gender === "female" ? row.gender : "neutral";
  const audience = resolveAudience(gender, row.audience);
  const venues = (Array.isArray(row.venues) ? row.venues : []) as import("./venues").Venue[];
  const overrides = (row.copy_templates ?? {}) as { ar?: Record<string, string>; en?: Record<string, string> };
  const copyByLocale = {
    ar: resolveCopy("ar", overrides, gender) as unknown as Record<string, string>,
    en: resolveCopy("en", overrides, gender) as unknown as Record<string, string>,
  };

  return {
    guestName: row.full_name,
    language,
    animation,
    gender,
    audience,
    copyByLocale,
    venues,
    personalLine: language === "ar" ? row.personal_line_ar : row.personal_line_en,
    design: design.data,
    blocks: blocksFromEvent(row, language),
    event: {
      brideNameAr: row.bride_name_ar,
      brideNameEn: row.bride_name_en,
      groomNameAr: row.groom_name_ar,
      groomNameEn: row.groom_name_en,
      eventDatetime: row.event_datetime,
      timezone: row.timezone,
      hijriDateText: row.hijri_date_text,
      venueNameAr: row.venue_name_ar,
      venueNameEn: row.venue_name_en,
      venueAddressAr: row.venue_address_ar,
      venueAddressEn: row.venue_address_en,
      venueMapUrl: row.venue_map_url,
      parkingAr: row.parking_ar,
      parkingEn: row.parking_en,
      entranceAr: row.entrance_ar,
      entranceEn: row.entrance_en,
      sectionsAr: row.sections_ar,
      sectionsEn: row.sections_en,
      dressCodeAr: row.dress_code_ar,
      dressCodeEn: row.dress_code_en,
      schedule: Array.isArray(row.schedule) ? row.schedule : [],
      quoteAr: row.quote_ar,
      quoteEn: row.quote_en,
      notesAr: row.notes_ar,
      notesEn: row.notes_en,
      monogramText: row.monogram_text,
      thankYouConfirmedAr: row.thank_you_confirmed_ar,
      thankYouConfirmedEn: row.thank_you_confirmed_en,
      thankYouDeclinedAr: row.thank_you_declined_ar,
      thankYouDeclinedEn: row.thank_you_declined_en,
    },
  };
}

/**
 * The event as invitation blocks — the same seam the Studio uses, so the renderer cannot tell the
 * difference between a customer's preview and a guest's invitation. `details` stays a list: a
 * missing venue produces fewer lines, never an empty one or a dangling separator.
 */
export function blocksFromEvent(row: Row, locale: "ar" | "en"): InvitationBlocks {
  const pick = (ar: string | null, en: string | null) => (locale === "ar" ? ar : en) ?? "";
  const names =
    locale === "ar"
      ? [row.groom_name_ar, row.bride_name_ar].filter(Boolean).join(" و ")
      : [row.groom_name_en, row.bride_name_en].filter(Boolean).join(" & ");

  const date = new Intl.DateTimeFormat(locale === "ar" ? "ar-BH" : "en-BH", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: row.timezone || "Asia/Bahrain",
  }).format(row.event_datetime);

  const details = [date, pick(row.venue_name_ar, row.venue_name_en)].filter((value) => value.length > 0);

  return {
    eyebrow: locale === "ar" ? "دعوة زفاف" : "Wedding Invitation",
    names: names || (locale === "ar" ? "الأسماء" : "Names"),
    details,
    footer: pick(row.venue_name_ar, row.venue_name_en) ? date.split(",").at(-1)?.trim() ?? "" : "",
    verse: pick(row.quote_ar, row.quote_en) || undefined,
    notes: pick(row.notes_ar, row.notes_en) || undefined,
  };
}

/** Admin-side preview of the same page, without counting an open. */
export async function previewInvitationForGuest(
  guestId: string,
  options: { sql?: Sql } = {},
): Promise<PublicInvitation | null> {
  const sql = options.sql ?? getSql();
  const rows = await sql<Row[]>`
    select g.id as guest_id, g.full_name, g.language, g.personal_line_ar, g.personal_line_en, g.gender, g.audience, g.gender, g.audience,
           g.first_opened_at,
           e.bride_name_ar, e.bride_name_en, e.groom_name_ar, e.groom_name_en,
           e.event_datetime, e.timezone, e.hijri_date_text,
           e.venue_name_ar, e.venue_name_en, e.venue_address_ar, e.venue_address_en, e.venue_map_url,
           e.parking_ar, e.parking_en, e.entrance_ar, e.entrance_en, e.sections_ar, e.sections_en,
           e.dress_code_ar, e.dress_code_en, e.schedule, e.copy_templates,
             coalesce((select jsonb_agg(to_jsonb(v) order by v.sort_order, v.kind)
                         from public.event_venues v where v.event_id = e.id), '[]'::jsonb) as venues, e.copy_templates,
           coalesce((select jsonb_agg(to_jsonb(v) order by v.sort_order, v.kind)
                       from public.event_venues v where v.event_id = e.id), '[]'::jsonb) as venues,
           e.quote_ar, e.quote_en, e.notes_ar, e.notes_en, e.monogram_text,
           e.thank_you_confirmed_ar, e.thank_you_confirmed_en,
           e.thank_you_declined_ar, e.thank_you_declined_en,
           t.design_config, t.opening_animation_type
      from public.guests g
      join public.events e on e.id = g.event_id
      left join public.templates t on t.id = e.template_id
     where g.id = ${guestId}
     limit 1`;
  return rows[0] ? toInvitation(rows[0]) : null;
}
