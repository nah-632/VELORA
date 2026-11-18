/**
 * The catalogue data source.
 *
 * **Why the queries are SQL functions and not query builders.** This device cannot run a
 * PostgreSQL server (`shmget` is unimplemented in the sandbox), so the only genuine Postgres
 * available locally is PGlite, running in-process. Meanwhile production talks to Supabase over
 * PostgREST. Rather than maintain two implementations of "list the catalogue" — which is how a
 * test suite and a production site quietly start disagreeing — the query itself lives in the
 * database, and only the *transport* differs:
 *
 *   - Supabase:  supabase.rpc("catalogue_list", params)
 *   - PGlite:    select * from public.catalogue_list($1, ...)
 *
 * Both call the same function, written once in migration 0006, and both are SECURITY INVOKER so
 * row-level security applies to whichever role is asking.
 *
 * **The development transport is a convenience, and it has a real limitation**: PGlite connects
 * as a superuser, so it does not exercise RLS. RLS is verified by tests/db/catalogue.mjs, which
 * sets a role for every query. The dev transport is refused outright in production.
 */
import { type Locale } from "@/i18n/routing";
import {
  ConfigurationError,
  assertDataSourceAvailable,
  dataSourceKind,
} from "@/lib/data-source";

import {
  type DesignConfig,
  type PreviewContent,
  parseDesignConfig,
  parsePreviewContent,
} from "./design-config";

export interface CatalogueQuery {
  locale: Locale;
  category?: string | null;
  search?: string | null;
  featured?: boolean | null;
  limit?: number;
  offset?: number;
}

export interface TemplateSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  categorySlug: string;
  categoryName: string;
  design: DesignConfig;
  preview: PreviewContent | null;
  supportedLocales: string[];
  basePriceFils: number | null;
  isFeatured: boolean;
  /** True when the design configuration could not be parsed — shown as unavailable, never guessed at. */
  invalid: boolean;
}

export interface TemplateDetail extends TemplateSummary {
  customizationOptions: Record<string, unknown>;
  publishedAt: string | null;
}

export interface CategorySummary {
  slug: string;
  name: string;
  total: number;
}

export interface CataloguePage {
  items: TemplateSummary[];
  total: number;
}

export interface CatalogueSource {
  readonly name: string;
  list(query: CatalogueQuery): Promise<CataloguePage>;
  get(slug: string, locale: Locale): Promise<TemplateDetail | null>;
  categories(locale: Locale): Promise<CategorySummary[]>;
}

/** Raw row shape returned by the SQL functions. */
export interface CatalogueRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category_slug: string;
  category_name: string;
  design_config: unknown;
  preview_content: unknown;
  supported_locales: string[] | null;
  base_price_fils: number | null;
  is_featured: boolean;
  total_count?: number | string | null;
  customization_options?: unknown;
  published_at?: string | null;
}

export function toSummary(row: CatalogueRow): TemplateSummary {
  const design = parseDesignConfig(row.design_config);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    // A design that will not parse is reported, not replaced with a default. Rendering a broken
    // configuration as "roughly this" would hide a real defect behind plausible pixels.
    design: design ?? EMPTY_DESIGN,
    preview: parsePreviewContent(row.preview_content),
    supportedLocales: row.supported_locales ?? [],
    basePriceFils: row.base_price_fils,
    isFeatured: row.is_featured,
    invalid: design === null,
  };
}

const EMPTY_DESIGN: DesignConfig = {
  version: 1,
  canvas: { ratio: "5:7" },
  palette: { ground: "#F5F0E8", ink: "#191A19", accent: "#7A5F38" },
  typography: {
    displayLatn: "cormorant",
    displayArab: "aref",
    bodyLatn: "manrope",
    bodyArab: "plex",
    align: "center",
    uppercaseEyebrow: true,
  },
  ornament: { frame: "hairline", rule: "short" },
  layout: "classic",
};

// ---------------------------------------------------------------------------
// Transport selection
// ---------------------------------------------------------------------------

let cached: CatalogueSource | null = null;

export async function getCatalogue(): Promise<CatalogueSource> {
  if (cached) return cached;

  assertDataSourceAvailable();

  if (dataSourceKind() === "supabase") {
    const { createSupabaseCatalogue } = await import("./supabase-source");
    cached = createSupabaseCatalogue();
  } else {
    const { createLocalCatalogue } = await import("./local-source");
    cached = await createLocalCatalogue();
  }

  return cached;
}

/**
 * The catalogue, or `null` when this deployment has no data source at all.
 *
 * Only a *configuration* problem returns null. A database that is unreachable, slow or erroring
 * still throws, so an outage is never reported to a reader as a setup step.
 */
export async function tryGetCatalogue(): Promise<CatalogueSource | null> {
  try {
    return await getCatalogue();
  } catch (error) {
    if (error instanceof ConfigurationError) return null;
    throw error;
  }
}
