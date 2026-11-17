import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { TemplateCanvas } from "@/components/invitation/TemplateCanvas";
import { buttonClass } from "@/components/ui/Button";
import { Card, StatePanel } from "@/components/ui/Card";
import { getCatalogue } from "@/features/catalogue/repository";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";

/**
 * Where a selected design lands.
 *
 * This route exists because the alternative — a call-to-action that goes nowhere — is precisely
 * the dead end the brief forbids. Selecting a design genuinely works: the design is resolved from
 * the database by slug, and the page shows exactly what was selected, in both languages.
 *
 * What it does **not** do is pretend the editor is finished. The Studio itself is the next
 * milestone, and saying so is better than a canvas that cannot yet be edited.
 */
export default async function StudioPage({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}) {
  if (!isLocale(locale)) notFound();

  const t = await getTranslations({ locale, namespace: "studio" });
  const catalogue = await getCatalogue();
  const template = await catalogue.get(slug, locale);

  if (!template) notFound();

  const otherLocale = locale === "ar" ? "en" : "ar";

  return (
    <div className="mx-auto flex max-w-shell flex-col gap-10 px-6 py-14">
      <header className="flex flex-col gap-3">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="text-4xl text-ink">{t("title")}</h1>
        <p className="max-w-prose text-ink-muted">{t("intro")}</p>
      </header>

      <StatePanel kind="empty" message={t("notYet")} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <p className="eyebrow">{t("selected")}</p>
          <div className="overflow-hidden rounded-lg border border-line">
            <TemplateCanvas
              design={template.design}
              content={template.preview}
              locale={locale}
              label={template.name}
            />
          </div>
          <p className="text-sm text-ink-muted">
            {template.name} · {template.categoryName}
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <p className="eyebrow mb-2">{t("selectionTitle")}</p>
            <ul className="flex flex-col gap-1 text-sm text-ink-muted">
              <li>
                <span className="text-ink">{t("selectionDesign")}: </span>
                <span className="ltr-token">{template.slug}</span>
              </li>
              <li>
                <span className="text-ink">{t("selectionCanvas")}: </span>
                <span className="ltr-token">{template.design.canvas.ratio}</span>
              </li>
              <li>
                <span className="text-ink">{t("selectionLayout")}: </span>
                <span className="ltr-token">{template.design.layout}</span>
              </li>
              <li>
                <span className="text-ink">{t("selectionVersion")}: </span>
                <span className="ltr-token">{template.design.version}</span>
              </li>
            </ul>
          </Card>

          <Card tone="recipe">
            <p className="eyebrow mb-2">{t("sameRendererTitle")}</p>
            <p className="text-sm text-ink-muted">{t("sameRendererBody")}</p>
          </Card>

          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-muted">{t("otherLanguage")}</p>
            <div className="overflow-hidden rounded-lg border border-line">
              <TemplateCanvas
                design={template.design}
                content={template.preview}
                locale={otherLocale}
                label={template.name}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={`/templates/${template.slug}`} className={buttonClass("secondary")}>
              {t("back")}
            </Link>
            <Link href="/templates" className={buttonClass("quiet")}>
              {t("browseAll")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
