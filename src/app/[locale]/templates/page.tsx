import { getTranslations } from "next-intl/server";

import { TemplateCanvas } from "@/components/invitation/TemplateCanvas";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, StatePanel } from "@/components/ui/Card";
import { NotConfigured } from "@/components/shell/NotConfigured";
import { tryGetCatalogue } from "@/features/catalogue/repository";
import { blocksFromPreview, fallbackBlocks } from "@/features/studio/blocks";
import { Link } from "@/i18n/navigation";
import { isLocale, locales } from "@/i18n/routing";
import { notFound } from "next/navigation";

/**
 * Rendered per request, not pre-built.
 *
 * The catalogue comes from a database that lives elsewhere, so prerendering it would make every
 * deployment depend on the database being reachable *at build time* — and would bake one day's
 * catalogue into the build. It is also the honest model: a template published an hour ago must
 * appear without a redeploy.
 */
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/**
 * The template library.
 *
 * Filtering and search are ordinary GET parameters, so the whole catalogue works without
 * JavaScript, every view has an address that can be shared, and the back button behaves. The
 * catalogue is public data, so there is nothing here worth hiding behind a client-side filter.
 */
export default async function TemplateLibraryPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { category?: string; q?: string };
}) {
  if (!isLocale(locale)) notFound();

  const t = await getTranslations({ locale, namespace: "catalogue" });
  const catalogue = await tryGetCatalogue();
  if (!catalogue) return <NotConfigured locale={locale} />;

  const category = searchParams.category?.trim() || null;
  const search = searchParams.q?.trim() || null;

  const [{ items, total }, categories] = await Promise.all([
    catalogue.list({ locale, category, search, limit: 48, offset: 0 }),
    catalogue.categories(locale),
  ]);

  const activeCategory = categories.find((entry) => entry.slug === category);

  // Formatted here rather than by the message, so the plural category comes from the number while
  // the digits stay Latin: an Arabic-locale `#` in an ICU message renders Arabic-Indic numerals,
  // and the product shows Latin digits in both languages.
  const totalText = new Intl.NumberFormat(locale === "ar" ? "ar-BH" : "en-BH", {
    numberingSystem: "latn",
  }).format(total);

  return (
    <div className="mx-auto flex max-w-shell flex-col gap-10 px-6 py-14">
      <header className="flex flex-col gap-3">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="text-4xl text-ink">{t("title")}</h1>
        <p className="max-w-prose text-ink-muted">{t("intro")}</p>
      </header>

      <form
        method="get"
        action={`/${locale}/templates`}
        className="flex flex-col gap-4 rounded-lg border border-line bg-ground-paper p-5"
      >
        <label htmlFor="catalogue-search" className="text-sm font-medium text-ink">
          {t("search")}
        </label>
        <div className="flex flex-wrap gap-3">
          <input
            id="catalogue-search"
            name="q"
            type="search"
            dir="auto"
            defaultValue={search ?? ""}
            placeholder={t("searchPlaceholder")}
            className="min-h-11 flex-1 rounded-md border border-line bg-ground px-3 py-2 text-base text-ink"
          />
          {category ? <input type="hidden" name="category" value={category} /> : null}
          <Button type="submit">{t("searchAction")}</Button>
        </div>

        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">{t("allCategories")}</legend>
          <Link
            href="/templates"
            className={buttonClass(category === null ? "primary" : "secondary")}
            aria-current={category === null ? "page" : undefined}
          >
            {t("allCategories")}
          </Link>
          {categories.map((entry) => (
            <Link
              key={entry.slug}
              href={{
                pathname: "/templates",
                query: { category: entry.slug, ...(search ? { q: search } : {}) },
              }}
              className={buttonClass(category === entry.slug ? "primary" : "secondary")}
              aria-current={category === entry.slug ? "page" : undefined}
            >
              {entry.name}
              <span className="ltr-token text-xs opacity-70">{entry.total}</span>
            </Link>
          ))}
        </fieldset>

        {search || category ? (
          <p className="text-sm text-ink-muted">
            <Link href="/templates" className="underline hover:text-gold-deep">
              {t("clear")}
            </Link>
          </p>
        ) : null}
      </form>

      <p className="text-sm text-ink-muted" aria-live="polite">
        {t("count", {
          total,
          totalText,
          category: activeCategory?.name ?? t("allCategories"),
        })}
      </p>

      {items.length === 0 ? (
        <StatePanel
          kind="empty"
          message={t("empty")}
          action={
            <Link href="/templates" className={buttonClass("secondary")}>
              {t("clear")}
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((template) => (
            <li key={template.id}>
              <Link
                href={`/templates/${template.slug}`}
                className="group block overflow-hidden rounded-lg border border-line bg-ground-paper transition-colors hover:border-gold-deep"
              >
                {template.invalid ? (
                  <div className="flex aspect-[5/7] items-center justify-center bg-ground-recipe p-6 text-center text-sm text-danger">
                    {t("invalidDesign")}
                  </div>
                ) : (
                  <TemplateCanvas
                    design={template.design}
                    blocks={
                      template.preview ? blocksFromPreview(template.preview, locale) : fallbackBlocks(locale)
                    }
                    locale={locale}
                    label={template.name}
                  />
                )}
                <div className="flex flex-col gap-1 border-t border-line p-4">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display text-lg text-ink">{template.name}</span>
                    {template.isFeatured ? (
                      <span className="eyebrow">{t("featured")}</span>
                    ) : null}
                  </span>
                  <span className="text-xs text-ink-muted">{template.categoryName}</span>
                  <span className="text-sm text-ink-muted">
                    {template.basePriceFils === null ? t("priceTbc") : null}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Card tone="recipe">
        <p className="eyebrow mb-2">{t("priceTbc")}</p>
        <p className="max-w-prose text-sm text-ink-muted">{t("priceTbcNote")}</p>
      </Card>
    </div>
  );
}
