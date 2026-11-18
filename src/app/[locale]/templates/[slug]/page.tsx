import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { TemplateCanvas } from "@/components/invitation/TemplateCanvas";
import { buttonClass } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { NotConfigured } from "@/components/shell/NotConfigured";
import { tryGetCatalogue } from "@/features/catalogue/repository";
import { blocksFromPreview, fallbackBlocks } from "@/features/studio/blocks";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

/**
 * A single design.
 *
 * The page shows the design at a size where it can actually be judged, states plainly that its
 * price is not set, and hands off to the Studio with the design already selected. It does not
 * claim the design is available for purchase, because nothing has been priced yet.
 */
export async function generateMetadata({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}) {
  if (!isLocale(locale)) return {};
  const catalogue = await tryGetCatalogue();
  if (!catalogue) return {};
  const template = await catalogue.get(slug, locale);
  if (!template) return {};
  return { title: template.name, description: template.description ?? undefined };
}

export default async function TemplateDetailPage({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}) {
  if (!isLocale(locale)) notFound();

  const t = await getTranslations({ locale, namespace: "template" });
  const catalogue = await tryGetCatalogue();
  if (!catalogue) return <NotConfigured locale={locale} />;
  const template = await catalogue.get(slug, locale);

  if (!template) notFound();

  const arabicOnly =
    template.supportedLocales.length === 1 && template.supportedLocales[0] === "ar";

  return (
    <div className="mx-auto flex max-w-shell flex-col gap-10 px-6 py-14">
      <p className="text-sm">
        <Link href="/templates" className="text-ink-muted underline hover:text-gold-deep">
          {t("back")}
        </Link>
      </p>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-lg border border-line">
          {template.invalid ? (
            <div className="flex aspect-[5/7] items-center justify-center bg-ground-recipe p-6 text-center text-sm text-danger">
              {t("invalid")}
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
        </div>

        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <p className="eyebrow">{template.categoryName}</p>
            <h1 className="text-4xl text-ink">{template.name}</h1>
            {template.description ? (
              <p className="max-w-prose text-ink-muted">{template.description}</p>
            ) : null}
          </header>

          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-ink-muted">{t("style")}</dt>
              <dd className="text-ink">{template.categoryName}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">{t("languages")}</dt>
              <dd className="text-ink">{arabicOnly ? t("arabicOnly") : t("bothLanguages")}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">{t("price")}</dt>
              <dd className="text-ink">
                {template.basePriceFils === null ? t("priceTbc") : null}
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">{t("canvas")}</dt>
              <dd className="text-ink ltr-token">{template.design.canvas.ratio}</dd>
            </div>
          </dl>

          {template.basePriceFils === null ? (
            <Card tone="recipe">
              <p className="text-sm text-ink-muted">{t("priceTbcNote")}</p>
            </Card>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Link href={`/studio/${template.slug}`} className={buttonClass("primary", "lg")}>
              {t("create")}
            </Link>
            <Link href="/templates" className={buttonClass("secondary", "lg")}>
              {t("browse")}
            </Link>
          </div>

          <section>
            <SectionHeading title={t("customisation")} />
            <ul className="flex flex-wrap gap-2">
              {Object.entries(template.customizationOptions).map(([key, value]) => (
                <li
                  key={key}
                  className="rounded-md border border-line px-3 py-1 text-xs text-ink-muted"
                >
                  <span className="ltr-token">{key}</span>
                  <span className="mx-1">·</span>
                  <span className="ltr-token">{Array.isArray(value) ? value.length : 0}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-ink-muted">{t("customisationNote")}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
