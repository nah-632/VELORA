/**
 * Which database is behind this request.
 *
 * Both the catalogue and the draft editor need the same answer, and — more importantly — the same
 * **instance**. Two PGlite databases in one server process would mean a customer saving a draft
 * into one and the catalogue reading templates from the other, which is exactly the kind of bug
 * that looks like data loss.
 *
 * The decision itself is one thing: are the Supabase public variables configured? If they are,
 * every caller talks to Supabase. If they are not, and this is not production, every caller talks
 * to a local PostgreSQL. If they are not and this *is* production, callers fail loudly rather than
 * quietly serving an empty catalogue.
 */
import { type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type DataSourceKind = "supabase" | "local";

/**
 * Thrown when the deployment has no data source at all — a configuration problem, as distinct
 * from a database being unreachable or a query failing.
 *
 * The distinction matters: a page can tell the reader "this deployment is not connected to a
 * database yet", but it must not say that when the real problem is a timeout, because then a
 * genuine outage would be reported as a setup step.
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function dataSourceKind(): DataSourceKind {
  const configured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return configured ? "supabase" : "local";
}

export function assertDataSourceAvailable(): void {
  if (dataSourceKind() === "local" && process.env.NODE_ENV === "production") {
    throw new ConfigurationError(
      "No data source is configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "The local development database is deliberately refused in production.",
    );
  }
}

// ---------------------------------------------------------------------------
// Local: a real PostgreSQL, in process
// ---------------------------------------------------------------------------

type LocalDatabase = Awaited<ReturnType<typeof openLocal>>;

/**
 * Held on `globalThis`, not in a module variable.
 *
 * In development every hot reload creates a fresh module instance, and a module-level cache is
 * therefore a *new* cache — which opened four separate PostgreSQL instances against the same data
 * directory, each re-running all nine migrations and contending for the same files. A write that
 * should take milliseconds took four and a half minutes. `globalThis` survives the reload, so one
 * process has one database.
 *
 * The promise is cached rather than the resolved value, so two concurrent callers cannot both
 * start opening it.
 */
const LOCAL_DB_KEY = "__veloraLocalDatabase";

/**
 * This device cannot run a PostgreSQL server — `shmget` is unimplemented in the sandbox, so
 * `initdb` cannot bootstrap a cluster. PGlite is a real PostgreSQL compiled to WebAssembly, which
 * makes it the only way to develop against the actual schema on this machine.
 *
 * It connects as a superuser and therefore does **not** exercise row-level security. RLS is
 * verified by tests/db/*, which set a role for every query — never by running the app.
 */
export async function getLocalDatabase(): Promise<LocalDatabase> {
  const holder = globalThis as unknown as Record<string, Promise<LocalDatabase> | undefined>;
  holder[LOCAL_DB_KEY] ??= openLocalDatabase();
  return holder[LOCAL_DB_KEY] as Promise<LocalDatabase>;
}

async function openLocalDatabase(): Promise<LocalDatabase> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = await openLocal(PGlite);
  console.log("[data] local PostgreSQL ready");
  return db;
}

async function openLocal(PGlite: new (options: { dataDir: string }) => unknown) {
  const root = process.cwd();
  const db = new PGlite({ dataDir: join(root, ".local-db") }) as {
    exec(sql: string): Promise<unknown>;
    query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  };

  const stub = join(root, "tests", "db", "supabase-stub.sql");
  if (existsSync(stub)) await db.exec(readFileSync(stub, "utf8"));

  const migrationsDir = join(root, "supabase", "migrations");
  const files = existsSync(migrationsDir)
    ? readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()
    : [];

  for (const name of files) {
    await db.exec(readFileSync(join(migrationsDir, name), "utf8"));
  }

  return db;
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

let supabaseClient: SupabaseClient | null = null;

/** The anon key, never the service role: every call should pass through row-level security. */
export async function getSupabaseClient(): Promise<SupabaseClient> {
  const holder = globalThis as unknown as Record<string, SupabaseClient | undefined>;
  if (holder.__veloraSupabaseClient) return holder.__veloraSupabaseClient;
  if (supabaseClient) return supabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");

  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  holder.__veloraSupabaseClient = client;
  supabaseClient = client;
  return client;
}
