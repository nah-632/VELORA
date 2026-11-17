import { type Locale } from "@/i18n/routing";
import { getSupabaseClient } from "@/lib/data-source";

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
 * Production transport: the same SQL functions, reached through PostgREST.
 *
 * The shared client uses the **anon key**, never the service role. Every call therefore runs as
 * `anon` and passes through row-level security — which is the whole reason drafts stay invisible
 * without the application having to remember to filter them out.
 */
export function createSupabaseCatalogue(): CatalogueSource {
  function fail(operation: string, message: string): never {
    throw new Error(`catalogue ${operation} failed: ${message}`);
  }

  return {
    name: "supabase",

    async list(query: CatalogueQuery): Promise<CataloguePage> {
      const client = await getSupabaseClient();
      const { data, error } = await client.rpc("catalogue_list", {
        p_locale: query.locale,
        p_category: query.category ?? null,
        p_search: query.search ?? null,
        p_featured: query.featured ?? null,
        p_limit: query.limit ?? 48,
        p_offset: query.offset ?? 0,
      });
      if (error) fail("list", error.message);

      const rows = (data ?? []) as CatalogueRow[];
      return { items: rows.map(toSummary), total: Number(rows[0]?.total_count ?? 0) };
    },

    async get(slug: string, locale: Locale): Promise<TemplateDetail | null> {
      const client = await getSupabaseClient();
      const { data, error } = await client.rpc("catalogue_get", { p_slug: slug, p_locale: locale });
      if (error) fail("get", error.message);

      const row = ((data ?? []) as CatalogueRow[])[0];
      if (!row) return null;

      return {
        ...toSummary(row),
        customizationOptions: (row.customization_options as Record<string, unknown>) ?? {},
        publishedAt: row.published_at ?? null,
      };
    },

    async categories(locale: Locale): Promise<CategorySummary[]> {
      const client = await getSupabaseClient();
      const { data, error } = await client.rpc("catalogue_categories", { p_locale: locale });
      if (error) fail("categories", error.message);

      return ((data ?? []) as { slug: string; name: string; total: number | string }[]).map((row) => ({
        slug: row.slug,
        name: row.name,
        total: Number(row.total),
      }));
    },
  };
}
