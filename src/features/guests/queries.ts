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
  response: string | null;
  companions_count: number | null;
}

export async function listGuests(eventId: string): Promise<GuestRow[]> {
  return getSql()<GuestRow[]>`
    select g.id, g.full_name, g.phone, g.category, g.language, g.max_companions, g.token,
           g.send_status, g.sent_at, g.first_opened_at, g.open_count,
           g.personal_line_ar, g.personal_line_en,
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
                                 token, personal_line_ar, personal_line_en)
      values (${eventId}, ${row.fullName}, ${row.phone}, ${row.category},
              ${options.language ?? "ar"}, ${row.maxCompanions},
              ${newGuestToken()}, ${row.personalLineAr}, ${row.personalLineEn})`;
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
  fields: { category?: string; maxCompanions?: number; personalLineAr?: string | null; personalLineEn?: string | null },
): Promise<void> {
  await getSql()`
    update public.guests set
      category = coalesce(${fields.category ?? null}, category),
      max_companions = coalesce(${fields.maxCompanions ?? null}, max_companions),
      personal_line_ar = ${fields.personalLineAr ?? null},
      personal_line_en = ${fields.personalLineEn ?? null}
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

export interface MessageContext {
  guestName: string;
  link: string;
  coupleNames: string;
  date: string;
  venue: string;
}

/**
 * The message the operator sends. `{guest_name}` and `{link}` are the brief's variables; the rest
 * are conveniences so the operator does not retype the couple's names into 50 messages.
 */
export const DEFAULT_MESSAGES = {
  ar: "أهلاً {guest_name}،\nيسعدنا دعوتكم إلى حفل زفاف {couple_names}.\nالدعوة الخاصة بكم:\n{link}",
  en: "Dear {guest_name},\nWe would be delighted to have you at the wedding of {couple_names}.\nYour invitation:\n{link}",
} as const;

export function buildMessage(template: string, context: MessageContext): string {
  return template
    .replaceAll("{guest_name}", context.guestName)
    .replaceAll("{couple_names}", context.coupleNames)
    .replaceAll("{date}", context.date)
    .replaceAll("{venue}", context.venue)
    .replaceAll("{link}", context.link);
}

/** The WhatsApp deep link for one guest, in the language that guest's invitation opens in. */
export function guestWhatsappLink(
  guest: { full_name: string; phone: string; token: string; language: string },
  event: { bride_name_ar: string | null; bride_name_en: string | null; groom_name_ar: string | null; groom_name_en: string | null; event_datetime: Date; venue_name_ar: string | null; venue_name_en: string | null },
  options: { template?: string; locale?: "ar" | "en"; defaultCountry?: GccCode } = {},
): string {
  const locale = options.locale ?? (guest.language === "en" ? "en" : "ar");
  const couple =
    locale === "ar"
      ? [event.groom_name_ar, event.bride_name_ar].filter(Boolean).join(" و ")
      : [event.groom_name_en, event.bride_name_en].filter(Boolean).join(" & ");
  const venue = (locale === "ar" ? event.venue_name_ar : event.venue_name_en) ?? "";
  const date = new Intl.DateTimeFormat(locale === "ar" ? "ar-BH" : "en-BH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Bahrain",
  }).format(event.event_datetime);

  const message = buildMessage(options.template ?? DEFAULT_MESSAGES[locale], {
    guestName: guest.full_name,
    link: inviteUrl(guest.token),
    coupleNames: couple,
    date,
    venue,
  });

  return whatsappUrl(guest.phone, message);
}
