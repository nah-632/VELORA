/**
 * RSVP.
 *
 * The guest's answer, and the two rules that make it trustworthy:
 *
 *   - **the companion cap is the guest's own**, enforced against the row the token belongs to, not
 *     against a number the browser sent. A guest allowed two companions cannot answer with five by
 *     editing the form;
 *   - **the answer can change**, because people do. One row per guest (`unique(guest_id)`), updated
 *     in place, so the count the operator reads is always the latest answer and never a sum of
 *     revisions.
 *
 * The token is the whole authorization, exactly as it is for reading the invitation: possessing it
 * lets you answer for that guest and nobody else. Nothing here returns another guest's data.
 */
import { getSql } from "@/lib/db";
import { looksLikeToken } from "./public";

export type RsvpResponse = "confirmed" | "declined";

export interface RsvpState {
  response: RsvpResponse | null;
  companions: number;
  maxCompanions: number;
  respondedAt: string | null;
  updatedAt: string | null;
}

export type RsvpOutcome =
  | { ok: true; state: RsvpState }
  | { ok: false; reason: "invalid_token" | "bad_response" | "too_many_companions" };

type Sql = ReturnType<typeof getSql>;

interface GuestRow {
  id: string;
  max_companions: number;
  response: string | null;
  companions_count: number | null;
  responded_at: Date | null;
  updated_at: Date | null;
}

async function guestForToken(token: string, sql: Sql): Promise<GuestRow | null> {
  const rows = await sql<GuestRow[]>`
    select g.id, g.max_companions,
           r.response, r.companions_count, r.responded_at, r.updated_at
      from public.guests g
      left join public.rsvps r on r.guest_id = g.id
     where g.token = ${token}
     limit 1`;
  return rows[0] ?? null;
}

function toState(row: GuestRow): RsvpState {
  const response = row.response === "confirmed" || row.response === "declined" ? row.response : null;
  return {
    response,
    companions: row.companions_count ?? 0,
    maxCompanions: row.max_companions,
    respondedAt: row.responded_at ? row.responded_at.toISOString() : null,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
  };
}

/** The current answer, for rendering the form in the right state. */
export async function rsvpForToken(
  token: string,
  options: { sql?: Sql } = {},
): Promise<RsvpState | null> {
  if (!looksLikeToken(token)) return null;
  const sql = options.sql ?? getSql();
  const row = await guestForToken(token, sql);
  return row ? toState(row) : null;
}

export async function submitRsvp(
  token: string,
  input: { response: string; companions?: number },
  options: { sql?: Sql } = {},
): Promise<RsvpOutcome> {
  if (!looksLikeToken(token)) return { ok: false, reason: "invalid_token" };
  const sql = options.sql ?? getSql();

  const row = await guestForToken(token, sql);
  if (!row) return { ok: false, reason: "invalid_token" };

  const response = input.response === "confirmed" || input.response === "declined" ? input.response : null;
  if (!response) return { ok: false, reason: "bad_response" };

  // A decline that claims companions is a contradiction, and the database refuses it too. Turning it
  // into zero here means a guest who declines after having confirmed does not have to notice the
  // number field.
  const requested = response === "declined" ? 0 : Number(input.companions ?? 0);
  const companions = Number.isFinite(requested) ? Math.max(0, Math.trunc(requested)) : 0;

  if (companions > row.max_companions) return { ok: false, reason: "too_many_companions" };

  await sql`
    insert into public.rsvps (guest_id, response, companions_count)
    values (${row.id}, ${response}, ${companions})
    on conflict (guest_id) do update
      set response = excluded.response,
          companions_count = excluded.companions_count,
          updated_at = now()`;

  const after = await guestForToken(token, sql);
  return { ok: true, state: after ? toState(after) : { response, companions, maxCompanions: row.max_companions, respondedAt: null, updatedAt: null } };
}

/**
 * The thank-you the guest reads.
 *
 * The operator's own words when they wrote some, and a short default when they did not — an
 * invitation that answers a confirmation with an empty line is worse than one that says something
 * plain.
 */
export function thankYou(
  event: { thankYouConfirmedAr: string | null; thankYouConfirmedEn: string | null; thankYouDeclinedAr: string | null; thankYouDeclinedEn: string | null },
  response: RsvpResponse,
  locale: "ar" | "en",
): string {
  const written =
    locale === "ar"
      ? response === "confirmed"
        ? event.thankYouConfirmedAr
        : event.thankYouDeclinedAr
      : response === "confirmed"
        ? event.thankYouConfirmedEn
        : event.thankYouDeclinedEn;

  if (written) return written;

  if (locale === "ar") {
    return response === "confirmed"
      ? "شكرًا لتأكيدكم. سعادتنا بحضوركم لا توصف."
      : "شكرًا لإخبارنا. ستفقدنا حضوركم، ونقدّر صراحتكم.";
  }
  return response === "confirmed"
    ? "Thank you for confirming. We are delighted you will be with us."
    : "Thank you for letting us know. You will be missed, and we are grateful you told us.";
}
