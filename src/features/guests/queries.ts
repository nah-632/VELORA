/**
 * Guest queries, and the two links that get them an invitation.
 *
 * The token is the whole security model for a guest: possessing it is the only thing that opens an
 * invitation, so it is generated server-side (160 random bits), never derived from the guest's name
 * or phone, and unique in the database. Nothing here ever returns another guest's row.
 *
 * The links are built from `NEXT_PUBLIC_SITE_URL` rather than the request host: a link built from a
 * header can be made to point somewhere else, and these links are pasted into WhatsApp and kept.
 */
import { getSql } from "@/lib/db";
import { publicEnv } from "@/lib/env";
import { newGuestToken } from "@/features/admin/credentials";
import {
  DEFAULT_WHATSAPP,
  renderTemplate,
  resolveAudience,
  type WhatsappPurpose,
} from "@/features/invitations/messages";
import { venueVariables, venuesForGuest, type Venue } from "@/features/invitations/venues";
import { type GccCode } from "@/lib/phone";
import { type ParsedGuest } from "./import";

export interface GuestRow {
  id: string;
  full_name: string;
  phone: string;
  category: string;
  language: string;
  max_companions: number;
  token: string;
  send_status: string;
  sent_at: Date | null;
  first_opened_at: Date | null;
  open_count: number;
  personal_line_ar: string | null;
  personal_line_en: string | null;
  gender: string;
  audience: string | null;
  response: string | null;
  companions_count: number | null;
}

export async function listGuests(eventId: string): Promise<GuestRow[]> {
  return getSql()<GuestRow[]>`
    select g.id, g.full_name, g.phone, g.category, g.language, g.max_companions, g.token,
           g.send_status, g.sent_at, g.first_opened_at, g.open_count,
           g.personal_line_ar, g.personal_line_en, g.gender, g.audience,
           r.response, r.companions_count
      from public.guests g
      left join public.rsvps r on r.guest_id = g.id
     where g.event_id = ${eventId}
     order by g.created_at, g.full_name`;
}

export async function countGuests(eventId: string): Promise<number> {
  const rows = await getSql()<{ n: number }[]>`
    select count(*)::int as n from public.guests where event_id = ${eventId}`;
  return rows[0]?.n ?? 0;
}

/**
 * Insert a batch. Every row gets its own token, generated here and stored with the row.
 *
 * `on conflict` is deliberately absent: the schema makes the token unique but allows the same phone
 * number twice, because two guests in one household legitimately share a number and the operator
 * may want two links. Duplicates are reported by the importer instead of being merged silently.
 */
export async function addGuests(
  eventId: string,
  rows: ParsedGuest[],
  options: { language?: "ar" | "en" } = {},
): Promise<number> {
  if (rows.length === 0) return 0;
  let inserted = 0;
  for (const row of rows) {
    await getSql()`
      insert into public.guests (event_id, full_name, phone, category, language, max_companions,
                                 token, personal_line_ar, personal_line_en, gender, audience)
      values (${eventId}, ${row.fullName}, ${row.phone}, ${row.category},
              ${options.language ?? "ar"}, ${row.maxCompanions},
              ${newGuestToken()}, ${row.personalLineAr}, ${row.personalLineEn},
              ${row.gender ?? "neutral"}, ${row.audience ?? null})`;
    inserted += 1;
  }
  return inserted;
}

export async function markGuestsSent(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await getSql()<{ id: string }[]>`
    update public.guests set send_status = 'sent', sent_at = now()
     where id = any(${ids}::uuid[]) and send_status <> 'sent'
    returning id`;
  return rows.length;
}

export async function updateGuest(
  id: string,
  fields: {
    category?: string;
    maxCompanions?: number;
    personalLineAr?: string | null;
    personalLineEn?: string | null;
    gender?: string;
    audience?: string | null;
  },
): Promise<void> {
  await getSql()`
    update public.guests set
      category = coalesce(${fields.category ?? null}, category),
      max_companions = coalesce(${fields.maxCompanions ?? null}, max_companions),
      personal_line_ar = ${fields.personalLineAr ?? null},
      personal_line_en = ${fields.personalLineEn ?? null},
      gender = coalesce(${fields.gender ?? null}, gender),
      audience = ${fields.audience ?? null}
    where id = ${id}`;
}

export async function deleteGuest(id: string): Promise<void> {
  await getSql()`delete from public.guests where id = ${id}`;
}

// ---------------------------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------------------------

export function inviteUrl(token: string): string {
  return `${publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/i/${token}`;
}

/** Only the digits, because wa.me takes no punctuation. */
export function whatsappUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(message)}`;
}

/**
 * The WhatsApp deep link for one guest.
 *
 * Three things it knows that the first version did not:
 *
 *   - **which hall**, from the guest's audience. `{venue_name_for_guest}` is the guest's own hall, and
 *     both halls only for a household — a message addressed to one person should say where that
 *     person is expected, not offer them a choice.
 *   - **which message**, from Settings, falling back to the shipped default for that purpose and that
 *     language. The operator edits four messages once and all 50 sends use them.
 *   - **the guest's language**, from their row.
 */
export function whatsappForGuest(input: {
  guest: { full_name: string; phone: string; token: string; language: string; gender: string; audience: string | null };
  event: {
    bride_name_ar: string | null; bride_name_en: string | null;
    groom_name_ar: string | null; groom_name_en: string | null;
    event_datetime: Date; timezone: string;
  };
  venues: Venue[];
  purpose?: WhatsappPurpose;
  overrides?: Record<string, Record<string, string>> | null;
}): string {
  const { guest, event } = input;
  const locale: "ar" | "en" = guest.language === "en" ? "en" : "ar";
  const purpose = input.purpose ?? "invite";

  const view = venuesForGuest(
    input.venues,
    resolveAudience((guest.gender as "male" | "female" | "neutral") ?? "neutral", guest.audience),
  );
  const hallVars = venueVariables(view, locale);

  // The couple's names, preferring the guest's own script and falling back to the other.
  const first = (ar: string | null, en: string | null) => (locale === "ar" ? ar ?? en ?? "" : en ?? ar ?? "");
  const date = new Intl.DateTimeFormat(locale === "ar" ? "ar-BH" : "en-BH", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: event.timezone || "Asia/Bahrain",
  }).format(event.event_datetime);

  const template = input.overrides?.[purpose]?.[locale]?.trim() || DEFAULT_WHATSAPP[purpose][locale];

  return whatsappUrl(
    guest.phone,
    renderTemplate(template, {
      guest_name: guest.full_name,
      groom: first(event.groom_name_ar, event.groom_name_en),
      bride: first(event.bride_name_ar, event.bride_name_en),
      date,
      link: inviteUrl(guest.token),
      ...hallVars,
    }),
  );
}
