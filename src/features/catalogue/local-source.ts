import { type Locale } from "@/i18n/routing";
import { getLocalDatabase } from "@/lib/data-source";

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
 * Development transport: the same SQL functions as production, against a local PostgreSQL.
 *
 * The connection is the shared one from lib/data-source, so the catalogue and the draft editor
 * see the same database — two instances would mean a saved draft landing somewhere the rest of
 * the application cannot read.
 *
 * It connects as a superuser, so it does **not** exercise row-level security. That is verified by
 * tests/db/*, which set a role for every query.
 */
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
      const db = await getLocalDatabase();
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
      const db = await getLocalDatabase();
      const result = await db.query<CatalogueRow>("select * from public.catalogue_get($1, $2)", [
        slug,
        locale,
      ]);
      const row = result.rows[0];
      if (!row) return null;
      return {
        ...toSummary(row),
        customizationOptions: (row.customization_options as Record<string, unknown>) ?? {},
        publishedAt: row.published_at ?? null,
      };
    },

    async categories(locale: Locale): Promise<CategorySummary[]> {
      const db = await getLocalDatabase();
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
