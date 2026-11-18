/**
 * The database client.
 *
 * One connection pool for the process, created lazily so that a page which never touches the
 * database never opens one. `postgres` (postgres.js) is deliberately the raw driver for now: the
 * schema is SQL and the next slice introduces Drizzle on top of this same client (AD-14).
 *
 * This module is server-only by construction — it is imported from route handlers and server
 * components, never from a client component, and it reads a variable that is never prefixed
 * `NEXT_PUBLIC_`.
 */
import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

declare global {
  // eslint-disable-next-line no-var
  var __veloraSql: Sql | undefined;
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL is not set. Locally it lives in .env.local; on CranL it is injected into the " +
        "application when the database is connected. Nothing is being served from a fallback.",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

/**
 * The pool is held on `globalThis`, not in a module variable.
 *
 * A module-level cache is a *new* cache on every hot reload in development, and four pools against
 * one database is exactly the failure that cost a 276-second save in Milestone 4. Held here, there
 * is one pool per process, hot reload or not.
 */
export function getSql(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseNotConfiguredError();
  if (!globalThis.__veloraSql) {
    globalThis.__veloraSql = postgres(url, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      // TLS only when the connection string asks for it. The managed database's URL carries no
      // sslmode, and forcing a TLS handshake onto a socket that does not speak it fails with
      // "socket disconnected before secure TLS connection was established" — which is exactly what
      // the first health check reported from inside the container.
      ssl:
        /sslmode=(require|verify-ca|verify-full)/.test(url)
          ? { rejectUnauthorized: /sslmode=verify-(ca|full)/.test(url) }
          : false,
      onnotice: () => {},
    });
  }
  return globalThis.__veloraSql;
}

/**
 * A message that is safe to show or log: a connection string must never appear in an error, a log
 * line, or an HTTP response, and driver errors are capable of carrying one.
 */
export function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/postgres(ql)?:\/\/[^\s"']+/gi, "postgresql://<redacted>")
    .replace(/password=[^\s&"']+/gi, "password=<redacted>")
    .slice(0, 300);
}

/** The class of failure, so a health check can say something useful without saying too much. */
export function classifyDatabaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof DatabaseNotConfiguredError) return "not_configured";
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)) return "host_not_resolved";
  if (/ECONNREFUSED/i.test(message)) return "connection_refused";
  if (/ETIMEDOUT|timeout/i.test(message)) return "timeout";
  if (/password authentication|role .* does not exist|28P01|28000/i.test(message)) return "auth_failed";
  if (/does not exist|42P01/i.test(message)) return "schema_missing";
  return "unreachable";
}

export async function checkDatabase(): Promise<{ ok: boolean; error?: string; latencyMs?: number }> {
  const started = Date.now();
  try {
    const sql = getSql();
    await sql`select 1 as ok`;
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, error: classifyDatabaseError(error) };
  }
}
