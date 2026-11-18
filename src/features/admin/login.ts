/**
 * Credentials login, with lockout and rate limiting.
 *
 * The policy is deliberately written down as constants, because every number here is a trade-off
 * between an operator locked out of their own tool and an attacker who gets unlimited guesses.
 *
 *   - 5 consecutive failures against one account  → that account is locked for 15 minutes;
 *   - 20 failures from one address in 15 minutes  → that address is refused;
 *   - every attempt, successful or not, is logged with a hashed address.
 *
 * Two details that are easy to get wrong and are therefore explicit:
 *
 *   - an unknown email is verified against a dummy hash, so it takes the same time as a real one
 *     and cannot be used to discover the operator's address;
 *   - the same generic message is returned for a wrong password and an unknown email. "Locked" is
 *     answered differently, because the person who is locked out is usually the operator.
 */
import { getSql } from "@/lib/db";
import { spendPasswordTime, verifyPassword } from "./credentials";

export const POLICY = {
  maxFailuresBeforeLock: 5,
  lockMinutes: 15,
  maxIpFailuresPerWindow: 20,
  ipWindowMinutes: 15,
} as const;

/**
 * The database handle is injectable so the policy can be tested against a real PostgreSQL without
 * a running server: `tests/db/admin-auth.mjs` drives these exact functions over PGlite. Testing a
 * re-implementation of the lockout rule would prove nothing about the code that ships.
 */
type Sql = ReturnType<typeof getSql>;

export type LoginOutcome =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "locked" | "rate_limited" };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function recordAttempt(
  sql: Sql,
  email: string,
  ipHash: string,
  succeeded: boolean,
): Promise<void> {
  await sql`
    insert into public.admin_login_attempts (email_normalized, ip_hash, succeeded)
    values (${email}, ${ipHash}, ${succeeded})`;
}

export async function recentIpFailures(ipHash: string, options: { sql?: Sql } = {}): Promise<number> {
  const sql = options.sql ?? getSql();
  const rows = await sql<{ n: number }[]>`
    select count(*)::int as n from public.admin_login_attempts
     where ip_hash = ${ipHash}
       and succeeded = false
       and attempted_at > now() - (${POLICY.ipWindowMinutes} || ' minutes')::interval`;
  return rows[0]?.n ?? 0;
}

/** Exported for the settings screen: an operator should be able to see this, not guess it. */
export async function recentAttempts(limit = 20, options: { sql?: Sql } = {}) {
  const sql = options.sql ?? getSql();
  return sql<{ attempted_at: Date; succeeded: boolean; email_normalized: string }[]>`
    select attempted_at, succeeded, email_normalized
      from public.admin_login_attempts order by attempted_at desc limit ${limit}`;
}

export async function authenticate(
  input: { email: string; password: string; ipHash: string },
  options: { sql?: Sql } = {},
): Promise<LoginOutcome> {
  const email = normalizeEmail(input.email);
  const sql = options.sql ?? getSql();

  if ((await recentIpFailures(input.ipHash, { sql })) >= POLICY.maxIpFailuresPerWindow) {
    await recordAttempt(sql, email, input.ipHash, false);
    return { ok: false, reason: "rate_limited" };
  }

  const rows = await sql<
    { id: string; password_hash: string; failed_attempts: number; locked_until: Date | null }[]
  >`select id, password_hash, failed_attempts, locked_until
      from public.admin_users where lower(email) = ${email} limit 1`;

  const user = rows[0];

  if (!user) {
    await spendPasswordTime(input.password);
    await recordAttempt(sql, email, input.ipHash, false);
    return { ok: false, reason: "invalid" };
  }

  if (user.locked_until && user.locked_until.getTime() > Date.now()) {
    await recordAttempt(sql, email, input.ipHash, false);
    return { ok: false, reason: "locked" };
  }

  if (!(await verifyPassword(user.password_hash, input.password))) {
    const failures = user.failed_attempts + 1;
    const shouldLock = failures >= POLICY.maxFailuresBeforeLock;
    await sql`
      update public.admin_users
         set failed_attempts = ${failures},
             locked_until = ${
               shouldLock ? new Date(Date.now() + POLICY.lockMinutes * 60_000) : user.locked_until
             }
       where id = ${user.id}`;
    await recordAttempt(sql, email, input.ipHash, false);
    return { ok: false, reason: shouldLock ? "locked" : "invalid" };
  }

  await sql`
    update public.admin_users
       set failed_attempts = 0, locked_until = null, last_login_at = now()
     where id = ${user.id}`;
  await recordAttempt(sql, email, input.ipHash, true);
  return { ok: true, userId: user.id };
}
