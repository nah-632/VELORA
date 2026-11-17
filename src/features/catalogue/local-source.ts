import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Type-only: the runtime module is imported dynamically inside openDatabase(), and only on the
// development branch.
import { type PGlite } from "@electric-sql/pglite";

import { type Locale } from "@/i18n/routing";

import {
  type CataloguePage,
  type CatalogueQuery,
  type CatalogueRow,
  type CatalogueSource,
  type CategorySummary,
  type TemplateDetail,
  toSummary,
} from "./repository";

/**
 * Development transport: a genuine PostgreSQL, in process.
 *
 * This device cannot run a PostgreSQL server — `shmget` is unimplemented in the sandbox, so
 * `initdb` cannot even bootstrap a cluster. PGlite is a real PostgreSQL compiled to WebAssembly,
 * which makes it the only way to develop against the actual schema and the actual seed rows.
 *
 * It executes the **same SQL functions** as production, so the query logic is not duplicated.
 *
 * Two honest limitations, both deliberate:
 *   1. PGlite connects as a superuser, so this transport **does not exercise row-level security**.
 *      RLS is verified by tests/db/*, which set a role for every query.
 *   2. It refuses to load when NODE_ENV is production, so it cannot become an accidental
 *      production database.
 */

let database: PGlite | null = null;

async function openDatabase(): Promise<PGlite> {
  if (database) return database;

  const root = process.cwd();
  const { PGlite } = await import("@electric-sql/pglite");
  const db = await PGlite.create({ dataDir: join(root, ".local-db") });

  const stub = join(root, "tests", "db", "supabase-stub.sql");
  if (existsSync(stub)) {
    await db.exec(readFileSync(stub, "utf8"));
  }

  const migrationsDir = join(root, "supabase", "migrations");
  const files = existsSync(migrationsDir)
    ? readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()
    : [];

  for (const name of files) {
    await db.exec(readFileSync(join(migrationsDir, name), "utf8"));
  }

  console.log(`[catalogue] local PostgreSQL ready — ${files.length} migrations applied from supabase/migrations`);
  database = db;
  return db;
}

export async function createLocalCatalogue(): Promise<CatalogueSource> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "The local development catalogue must not be used in production. Set NEXT_PUBLIC_SUPABASE_URL " +
        "and NEXT_PUBLIC_SUPABASE_ANON_KEY instead.",
    );
  }

  return {
    name: "local-postgres",

    async list(query: CatalogueQuery): Promise<CataloguePage> {
      const db = await openDatabase();
      const result = await db.query<CatalogueRow>(
        "select * from public.catalogue_list($1, $2, $3, $4, $5, $6)",
        [
          query.locale,
          query.category ?? null,
          query.search ?? null,
          query.featured ?? null,
          query.limit ?? 48,
          query.offset ?? 0,
        ],
      );
      const rows = result.rows;
      return { items: rows.map(toSummary), total: Number(rows[0]?.total_count ?? 0) };
    },

    async get(slug: string, locale: Locale): Promise<TemplateDetail | null> {
      const db = await openDatabase();
      const result = await db.query<CatalogueRow>(
        "select * from public.catalogue_get($1, $2)",
        [slug, locale],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        ...toSummary(row),
        customizationOptions: (row.customization_options as Record<string, unknown>) ?? {},
        publishedAt: row.published_at ?? null,
      };
    },

    async categories(locale: Locale): Promise<CategorySummary[]> {
      const db = await openDatabase();
      const result = await db.query<{ slug: string; name: string; total: number | string }>(
        "select * from public.catalogue_categories($1)",
        [locale],
      );
      return result.rows.map((row) => ({
        slug: row.slug,
        name: row.name,
        total: Number(row.total),
      }));
    },
  };
}
