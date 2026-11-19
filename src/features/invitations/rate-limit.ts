/**
 * Rate limiting for the public routes.
 *
 * Two properties decided the design:
 *
 *   - **It survives a redeploy.** Counters in a table, not in the process: CranL replaces the
 *     container on every deploy, and an in-memory limiter would be cleared by anybody who can push.
 *   - **The key is hashed, not stored raw.** An IP address is personal data; the table holds an HMAC
 *     of it with the server secret, which is enough to count and useless to read.
 *
 * The limits are deliberately generous. This is not protecting against a determined attacker — the
 * token already makes guessing hopeless — it is bounding the damage a leaked link can do and
 * stopping a loop from writing thousands of RSVP rows. Numbers chosen to be invisible to a guest and
 * obvious to a script.
 */
import { createHmac } from "node:crypto";
import { headers } from "next/headers";

import { getSql } from "@/lib/db";

export interface Limit {
  /** Requests allowed inside the window. */
  limit: number;
  windowMinutes: number;
}

export const LIMITS = {
  /** Opening the invitation: a guest refreshing, or a family passing a phone around. */
  invitation: { limit: 120, windowMinutes: 10 },
  /** The calendar file is fetched once or twice per guest, but a client may retry. */
  calendar: { limit: 60, windowMinutes: 10 },
  /** Answering for one guest. Changing your mind three times is normal; thirty is not. */
  rsvpPerGuest: { limit: 10, windowMinutes: 10 },
  /** Answering across many invitations from one address. */
  rsvpPerAddress: { limit: 40, windowMinutes: 10 },
} satisfies Record<string, Limit>;

type Sql = ReturnType<typeof getSql>;

export interface Decision {
  allowed: boolean;
  used: number;
  limit: number;
}

/**
 * The caller's address, as far as the platform will admit. Behind CranL's proxy this is the
 * forwarded address; `x-real-ip` is the fallback, and "unknown" is a bucket of its own rather than
 * an error — a rate limiter that throws when it cannot identify a caller is a rate limiter that
 * takes the page down.
 */
export function clientAddress(): string {
  const h = headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * `scope:token:addressHash` — one shape for every public limit.
 *
 * The address is HMACed rather than stored: an IP address is personal data, and this table exists to
 * count, not to keep a log of who visited. The token is truncated — it is already unguessable, and
 * the table has no need for the whole of it. `-` stands in for whatever a given limit does not use,
 * so the shape stays the same and a key can be read without knowing which caller wrote it.
 *
 * The token part is what makes the per-guest limits per-guest: a household behind one address, each
 * with their own link, is not one caller hammering the server.
 *
 * Written with `node:crypto` here rather than reusing the admin module's helper, because that module
 * imports argon2 — a native binary that the public route has no business loading.
 */
export function requestKey(scope: string, parts: { token?: string; address?: string }): string {
  const secret = process.env.SESSION_SECRET ?? "no-secret-configured";
  const addressHash = parts.address
    ? createHmac("sha256", secret).update(parts.address).digest("hex").slice(0, 32)
    : "-";
  const token = parts.token ? parts.token.slice(0, 12) : "-";
  return `${scope}:${token}:${addressHash}`;
}

/**
 * Counts the window, refuses if full, otherwise records the attempt.
 *
 * Counting before recording means a refused request still costs a query but does not extend its own
 * window — otherwise a client that keeps hammering would never be let back in, which is a denial of
 * service dressed as a defence.
 */
export async function consume(
  key: string,
  limit: Limit,
  options: { sql?: Sql } = {},
): Promise<Decision> {
  const sql = options.sql ?? getSql();

  const rows = await sql<{ used: number }[]>`
    select count(*)::int as used from public.rate_limit_events
     where key = ${key}
       and at > now() - (${limit.windowMinutes} || ' minutes')::interval`;

  const used = rows[0]?.used ?? 0;
  if (used >= limit.limit) {
    return { allowed: false, used, limit: limit.limit };
  }

  await sql`insert into public.rate_limit_events (key) values (${key})`;
  return { allowed: true, used: used + 1, limit: limit.limit };
}

/**
 * Housekeeping, called from the same paths that write. Cheap, bounded, and enough: the oldest rows
 * are the ones nobody is counting any more.
 */
export async function pruneRateLimits(options: { sql?: Sql; olderThanHours?: number } = {}): Promise<void> {
  const sql = options.sql ?? getSql();
  await sql`delete from public.rate_limit_events where at < now() - (${options.olderThanHours ?? 24} || ' hours')::interval`;
}
