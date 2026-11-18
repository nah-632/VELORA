/**
 * Two-factor enrolment, and the challenge between the password and the session.
 *
 * The shape of the login flow when TOTP is enrolled:
 *
 *   password verified → createLoginChallenge() → /admin/totp → verifyTotpAction()
 *     → consumeLoginChallenge() → createSession() → /admin
 *
 * Nothing half-authenticated is ever a session. The challenge is its own row with its own cookie,
 * five minutes long, single-use, and it cannot be turned into a session without a valid code.
 */
import { cookies } from "next/headers";

import { getSql } from "@/lib/db";
import { generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";
import { hashSessionToken, newSessionToken } from "./credentials";

/** The database handle, injectable so the flow can be driven against PGlite in tests. */
type Sql = ReturnType<typeof getSql>;

const CHALLENGE_COOKIE = "velora_admin_challenge";
const CHALLENGE_TTL_MINUTES = 5;
/** A six-digit code has a million values; five tries is generous for a mistyped one and useless to guess with. */
export const MAX_TOTP_ATTEMPTS = 5;

function challengeCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

// ---------------------------------------------------------------------------------------------
// Enrolment
// ---------------------------------------------------------------------------------------------

/**
 * Starts an enrolment.
 *
 * The secret is stored immediately but stays **unconfirmed**: `totp_confirmed_at` is NULL until a
 * code generated from that secret has been verified. An enrolment that was started and abandoned
 * grants nothing, which is why the column and the secret are two different pieces of state.
 */
export async function startTotpEnrolment(userId: string, email: string): Promise<{ secret: string; uri: string }> {
  return startTotpEnrolmentFor(userId, email);
}

export async function pendingTotpSecret(userId: string): Promise<string | null> {
  const rows = await getSql()<{ totp_secret: string | null; totp_confirmed_at: Date | null }[]>`
    select totp_secret, totp_confirmed_at from public.admin_users where id = ${userId} limit 1`;
  const row = rows[0];
  if (!row?.totp_secret || row.totp_confirmed_at) return null;
  return row.totp_secret;
}

export async function confirmTotpEnrolment(
  userId: string,
  code: string,
  options: { sql?: Sql } = {},
): Promise<{ ok: boolean; reason?: string }> {
  const sql = options.sql ?? getSql();
  const rows = await sql<{ totp_secret: string | null }[]>`
    select totp_secret from public.admin_users where id = ${userId} limit 1`;
  const secret = rows[0]?.totp_secret;
  if (!secret) return { ok: false, reason: "no_enrolment" };

  const result = verifyTotp(secret, code, { lastUsedCounter: null });
  if (!result.ok) return { ok: false, reason: "bad_code" };

  await sql`
    update public.admin_users
       set totp_confirmed_at = now(), totp_last_counter = ${result.counter ?? null}
     where id = ${userId}`;
  return { ok: true };
}

export async function disableTotp(userId: string, options: { sql?: Sql } = {}): Promise<void> {
  const sql = options.sql ?? getSql();
  await sql`
    update public.admin_users
       set totp_secret = null, totp_confirmed_at = null, totp_last_counter = null
     where id = ${userId}`;
}

export async function startTotpEnrolmentFor(
  userId: string,
  email: string,
  options: { sql?: Sql } = {},
): Promise<{ secret: string; uri: string }> {
  const sql = options.sql ?? getSql();
  const secret = generateTotpSecret();
  await sql`
    update public.admin_users
       set totp_secret = ${secret}, totp_confirmed_at = null, totp_last_counter = null
     where id = ${userId}`;
  return { secret, uri: otpauthUri({ secret, account: email }) };
}

export interface TotpState {
  enrolled: boolean;
  pendingSecret: string | null;
}

export async function totpState(userId: string, options: { sql?: Sql } = {}): Promise<TotpState> {
  const sql = options.sql ?? getSql();
  const rows = await sql<{ totp_secret: string | null; totp_confirmed_at: Date | null }[]>`
    select totp_secret, totp_confirmed_at from public.admin_users where id = ${userId} limit 1`;
  const row = rows[0];
  return {
    enrolled: Boolean(row?.totp_confirmed_at),
    pendingSecret: row?.totp_secret && !row.totp_confirmed_at ? row.totp_secret : null,
  };
}

export async function totpRequiredFor(email: string): Promise<boolean> {
  const rows = await getSql()<{ n: number }[]>`
    select count(*)::int as n from public.admin_users
     where lower(email) = ${email.trim().toLowerCase()} and totp_confirmed_at is not null`;
  return (rows[0]?.n ?? 0) > 0;
}

export async function verifyLoginCode(
  userId: string,
  code: string,
  options: { sql?: Sql } = {},
): Promise<boolean> {
  const sql = options.sql ?? getSql();
  const rows = await sql<{ totp_secret: string | null; totp_last_counter: number | null }[]>`
    select totp_secret, totp_last_counter from public.admin_users where id = ${userId} limit 1`;
  const row = rows[0];
  if (!row?.totp_secret) return false;

  const result = verifyTotp(row.totp_secret, code, { lastUsedCounter: row.totp_last_counter });
  if (!result.ok) return false;

  // Remember the counter: the same code is not accepted twice inside its own 30-second step.
  await sql`
    update public.admin_users set totp_last_counter = ${result.counter ?? null} where id = ${userId}`;
  return true;
}

// ---------------------------------------------------------------------------------------------
// The challenge
// ---------------------------------------------------------------------------------------------

/**
 * The database half, separated from the cookie half so it can be tested without an HTTP request.
 * `cookies()` only exists inside a request, which is exactly the kind of thing that makes a security
 * flow untestable and therefore untested.
 */
export async function insertChallenge(
  userId: string,
  options: { sql?: Sql; ttlMinutes?: number } = {},
): Promise<{ id: string; token: string }> {
  const sql = options.sql ?? getSql();
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + (options.ttlMinutes ?? CHALLENGE_TTL_MINUTES) * 60_000);
  const rows = await sql<{ id: string }[]>`
    insert into public.admin_login_challenges (user_id, token_hash, expires_at)
    values (${userId}, ${hashSessionToken(token)}, ${expiresAt}) returning id`;
  return { id: rows[0]!.id, token };
}

export async function findChallengeByToken(
  token: string,
  options: { sql?: Sql } = {},
): Promise<{ id: string; userId: string; attempts: number } | null> {
  const sql = options.sql ?? getSql();
  const rows = await sql<{ id: string; user_id: string; attempts: number }[]>`
    select id, user_id, attempts from public.admin_login_challenges
     where token_hash = ${hashSessionToken(token)}
       and consumed_at is null
       and expires_at > now()
     limit 1`;
  const row = rows[0];
  return row ? { id: row.id, userId: row.user_id, attempts: row.attempts } : null;
}

export async function markChallengeConsumed(id: string, options: { sql?: Sql } = {}): Promise<void> {
  const sql = options.sql ?? getSql();
  await sql`update public.admin_login_challenges set consumed_at = now() where id = ${id}`;
}

export async function markChallengeAttempt(id: string, options: { sql?: Sql } = {}): Promise<number> {
  const sql = options.sql ?? getSql();
  const rows = await sql<{ attempts: number }[]>`
    update public.admin_login_challenges set attempts = attempts + 1 where id = ${id} returning attempts`;
  return rows[0]?.attempts ?? 0;
}

export async function createLoginChallenge(userId: string): Promise<void> {
  const { token } = await insertChallenge(userId);
  cookies().set(CHALLENGE_COOKIE, token, challengeCookieOptions(CHALLENGE_TTL_MINUTES * 60));
}

export interface Challenge {
  id: string;
  userId: string;
  attempts: number;
}

export async function readLoginChallenge(): Promise<Challenge | null> {
  const token = cookies().get(CHALLENGE_COOKIE)?.value;
  if (!token) return null;
  return findChallengeByToken(token);
}

export async function recordChallengeAttempt(id: string): Promise<number> {
  return markChallengeAttempt(id);
}

export async function consumeLoginChallenge(id: string): Promise<void> {
  await markChallengeConsumed(id);
  cookies().delete(CHALLENGE_COOKIE);
}

export async function clearLoginChallenge(): Promise<void> {
  const token = cookies().get(CHALLENGE_COOKIE)?.value;
  if (token) {
    await getSql()`
      update public.admin_login_challenges set consumed_at = now()
       where token_hash = ${hashSessionToken(token)} and consumed_at is null`;
  }
  cookies().delete(CHALLENGE_COOKIE);
}

/** Housekeeping on login, alongside the session prune. */
export async function pruneExpiredChallenges(): Promise<void> {
  await getSql()`delete from public.admin_login_challenges where expires_at < now() - interval '7 days'`;
}
