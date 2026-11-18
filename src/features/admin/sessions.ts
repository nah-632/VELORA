/**
 * Sessions.
 *
 * A database row per login, addressed by a random token that exists only in the cookie. That is
 * more work than a signed cookie, and it buys the two properties a signed cookie cannot have:
 * a session can be revoked before it expires, and "who is logged in, from where" is answerable.
 *
 * The cookie is `httpOnly` (JavaScript cannot read it), `secure` in production, `sameSite: "strict"`
 * (so a cross-site form cannot make the browser send it — that is this application's CSRF control,
 * alongside the origin check in the actions), and path-scoped.
 */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSql } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { ADMIN_SESSION_COOKIE } from "./cookie";
import { hashIp, hashSessionToken, newSessionToken } from "./credentials";

const COOKIE_NAME = ADMIN_SESSION_COOKIE;
const ABSOLUTE_TTL_DAYS = 14;
/** A session used within this window is not written to again. */
const TOUCH_AFTER_HOURS = 12;

export interface AdminUser {
  id: string;
  email: string;
  lastLoginAt: string | null;
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function requestIp(): string {
  const h = headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

export function requestUserAgent(): string {
  return (headers().get("user-agent") ?? "unknown").slice(0, 200);
}

/**
 * Origin check for state-changing requests.
 *
 * `sameSite: strict` already stops a cross-site form from carrying the session; this is the second
 * lock on the same door, because the cookie attribute is a browser's promise and the check is ours.
 */
export function assertSameOrigin(): boolean {
  const h = headers();
  const origin = h.get("origin");
  if (!origin) return true; // same-origin form posts and curl do not always send one
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  try {
    return new URL(origin).origin === new URL(site).origin;
  } catch {
    return false;
  }
}

export async function createSession(userId: string): Promise<void> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + ABSOLUTE_TTL_DAYS * 86_400_000);
  const ip = requestIp();
  const secret = serverEnv().SESSION_SECRET;

  await getSql()`
    insert into public.admin_sessions (user_id, token_hash, expires_at, ip_hash, user_agent)
    values (${userId}, ${hashSessionToken(token)}, ${expiresAt},
            ${hashIp(ip, secret)}, ${requestUserAgent()})`;

  cookies().set(COOKIE_NAME, token, cookieOptions(ABSOLUTE_TTL_DAYS * 86_400));
}

/** The current administrator, or null. Never throws for an absent or stale cookie. */
export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  const rows = await getSql()<{ id: string; email: string; last_login_at: Date | null; last_seen_at: Date }[]>`
    select u.id, u.email, u.last_login_at, s.last_seen_at
      from public.admin_sessions s
      join public.admin_users u on u.id = s.user_id
     where s.token_hash = ${hashSessionToken(token)}
       and s.revoked_at is null
       and s.expires_at > now()
     limit 1`;

  const row = rows[0];
  if (!row) return null;

  // Sliding "last seen", written at most every TOUCH_AFTER_HOURS so that reading a page does not
  // cost a write. The absolute expiry never moves: activity extends awareness, not the session.
  const staleSince = Date.now() - TOUCH_AFTER_HOURS * 3_600_000;
  if (row.last_seen_at.getTime() < staleSince) {
    await getSql()`
      update public.admin_sessions set last_seen_at = now()
       where token_hash = ${hashSessionToken(token)} and revoked_at is null`;
  }

  return {
    id: row.id,
    email: row.email,
    lastLoginAt: row.last_login_at ? row.last_login_at.toISOString() : null,
  };
}

/**
 * The guard every admin page and every admin server action calls.
 *
 * Middleware also redirects an unauthenticated `/admin` request, but that check is a convenience
 * for the reader — it runs at the edge, it cannot see the database, and a missing cookie is not the
 * same thing as a revoked session. This is the check that decides.
 */
export async function requireAdmin(locale: string): Promise<AdminUser> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect(`/${locale}/admin/login`);
  return admin;
}

export async function destroyCurrentSession(): Promise<void> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (token) {
    await getSql()`
      update public.admin_sessions set revoked_at = now()
       where token_hash = ${hashSessionToken(token)} and revoked_at is null`;
  }
  cookies().delete(COOKIE_NAME);
}

/** Housekeeping, called on login: expired rows are noise, and noise hides a live session. */
export async function pruneExpiredSessions(): Promise<void> {
  await getSql()`delete from public.admin_sessions where expires_at < now() - interval '30 days'`;
}
