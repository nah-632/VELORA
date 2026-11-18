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
