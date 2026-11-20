/**
 * GET /api/health
 *
 * ADDENDUM E asks for a health-check endpoint; this is also the only honest way to see what the
 * database looks like *from inside the deployed container*, where the connection is real and the
 * network is the platform's.
 *
 * Two levels of detail, on purpose:
 *   - always: overall status, the class of any database failure, the schema version applied, and
 *     how long the check took;
 *   - only when `HEALTH_VERBOSE=1` is set in the environment: the sanitized driver message. That is
 *     for a deployment that is being diagnosed; a normal production response says "unreachable"
 *     and which kind, not why in the driver's words.
 *
 * Nothing here is ever cached, and no connection string is ever part of the response.
 */
import { NextResponse } from "next/server";
import { checkDatabase, getSql, sanitizeError } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const started = Date.now();
  const database = await checkDatabase();

  let migrations: { applied: string | null; pendingCheck: string } = {
    applied: null,
    pendingCheck: "not_checked",
  };
  /**
   * The schema the running code needs, checked explicitly.
   *
   * A deployment is a code change and a schema change, and they arrive separately: the container is
   * replaced on deploy, the migration is applied by a release step. If the release step is skipped,
   * the container is running code that queries tables which do not exist — and the first sign of it
   * is a 500 on the page a guest opened. This reports the mismatch by name while everything else
   * carries on serving.
   *
   * It never changes the status code: a database that is up and a schema that is behind is a
   * *deployment* state, not an outage, and a health endpoint that fails for it would take the whole
   * site down over a missing column.
   */
  let schema: {
    lastApplied: string | null;
    expects: string;
    objects: Record<string, boolean>;
    ok: boolean;
  } | null = null;

  const REQUIRED = {
    event_venues: "0007_dual_venues.sql",
  };
  let adminAccounts: number | null = null;
  let adminSessions: number | null = null;
  let totpEnrolled: boolean | null = null;

  if (database.ok) {
    try {
      const rows = await getSql()<{ name: string }[]>`
        select name from public.schema_migrations order by name`;
      migrations = { applied: rows.at(-1)?.name ?? "none", pendingCheck: "ok" };
    } catch {
      // The table not existing yet is a normal state for a fresh database, not a failure of the
      // service. Saying so beats reporting the application as broken.
      migrations = { applied: null, pendingCheck: "no_migration_table" };
    }

    try {
      const rows = await getSql()<{ n: number }[]>`select count(*)::int as n from public.admin_users`;
      adminAccounts = rows[0]?.n ?? 0;
    } catch {
      adminAccounts = null;
    }

    try {
      const rows = await getSql()<{ halls: boolean; guest_gender: boolean; guest_audience: boolean }[]>`
        select
          to_regclass('public.event_venues') is not null as halls,
          exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'guests' and column_name = 'gender') as guest_gender,
          exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'guests' and column_name = 'audience') as guest_audience`;
      const row = rows[0];
      const objects = {
        event_venues: row?.halls ?? false,
        "guests.gender": row?.guest_gender ?? false,
        "guests.audience": row?.guest_audience ?? false,
      };
      schema = {
        lastApplied: migrations.applied,
        expects: REQUIRED.event_venues,
        objects,
        ok: Object.values(objects).every(Boolean),
      };
    } catch {
      schema = null;
    }

    // Counts and a boolean, never a name or an address. This is what makes an authentication
    // problem diagnosable from outside the container, where the logs carry only the server's own
    // stdout: "a session was created" and "the second factor is on" are the two facts that decide
    // whether a failed sign-in is the cookie, the code, or the session row.
    try {
      const rows = await getSql()<{ sessions: number; enrolled: number }[]>`
        select
          (select count(*)::int from public.admin_sessions
            where revoked_at is null and expires_at > now()) as sessions,
          (select count(*)::int from public.admin_users where totp_confirmed_at is not null) as enrolled`;
      adminSessions = rows[0]?.sessions ?? 0;
      totpEnrolled = (rows[0]?.enrolled ?? 0) > 0;
    } catch {
      adminSessions = null;
      totpEnrolled = null;
    }
  }

  const body: Record<string, unknown> = {
    status: database.ok ? "ok" : "degraded",
    checks: {
      database: {
        ok: database.ok,
        ...(database.error ? { error: database.error } : {}),
        ...(database.latencyMs !== undefined ? { latencyMs: database.latencyMs } : {}),
      },
      migrations,
      // Names, not rows: the objects the code needs and whether they are there.
      schema,
      // Tells an operator whether this installation has been seeded yet. A number, not a name:
      // a health endpoint should never become a way to enumerate accounts.
      admin: { accounts: adminAccounts, sessions: adminSessions, totpEnrolled },
    },
    checkedInMs: Date.now() - started,
  };

  if (!database.ok && process.env.HEALTH_VERBOSE === "1") {
    try {
      await getSql()`select 1`;
    } catch (error) {
      body.detail = sanitizeError(error);
    }
  }

  return NextResponse.json(body, {
    status: database.ok ? 200 : 503,
    headers: NO_STORE,
  });
}
