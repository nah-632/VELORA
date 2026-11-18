import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { TemplateCanvas } from "@/components/invitation/TemplateCanvas";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DesignConfigSchema } from "@/features/catalogue/design-config";
import { getCatalogue } from "@/features/catalogue/repository";
import { loadCurrentDraft } from "@/features/studio/actions";
import { blocksFromContent } from "@/features/studio/blocks";
import { parseContent } from "@/features/studio/content";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";

/**
 * The finished invitation — what the customer is actually buying.
 *
 * This page exists to make a claim true rather than to add a feature. The brief requires that the
 * live preview use **the same rendering logic as the eventual customer-facing invitation**, and
 * without a customer-facing invitation there was nothing for the preview to agree with. Both
 * surfaces now render `TemplateCanvas` from the same design configuration and the same content,
 * so they cannot drift apart.
 *
 * **Private, and deliberately so.** The brief forbids introducing public invitation pages in
 * Phase 1 unless explicitly scoped and protected. This one is reachable only by the browser that
 * owns the draft — the token is an httpOnly cookie and is never taken from the URL — and it is
 * marked `noindex`. Sharing an invitation with guests is a later, separate decision.
 */
export const metadata: Metadata = {
  title: "Invitation",
  robots: { index: false, follow: false },
};

export default async function InvitationPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  if (!isLocale(locale)) notFound();

  const t = await getTranslations({ locale, namespace: "invitation" });
  const draft = await loadCurrentDraft();

  if (!draft) return <Nothing yet={t("nothingTitle")} body={t("nothingBody")} cta={t("browse")} />;

  const parsedDesign = DesignConfigSchema.safeParse(draft.designConfig);
  const template = await (await getCatalogue()).get(draft.templateSlug, locale);

  if (!parsedDesign.success) {
    return <Broken title={t("brokenTitle")} body={t("brokenBody")} />;
  }

  const content = parseContent(draft.content);
  // The same adapter the Studio uses. If this differed, the two surfaces would be two renderers
  // wearing the same name, which is exactly what the brief rules out.
  const blocks = blocksFromContent(content, locale);

  return (
    <div className="mx-auto flex max-w-shell flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="text-2xl text-ink">{t("title")}</h1>
          <p className="text-sm text-ink-muted">{template?.name ?? draft.templateSlug}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/studio/${draft.templateSlug}`} className={buttonClass("secondary")}>
            {t("backToStudio")}
          </Link>
          <Link href="/templates" className={buttonClass("quiet")}>
            {t("browse")}
          </Link>
        </div>
      </header>

      <div className="flex justify-center">
        <div className="w-full max-w-[520px] overflow-hidden rounded-lg border border-line shadow-sm">
          <TemplateCanvas
            design={parsedDesign.data}
            blocks={blocks}
            locale={locale}
            label={t("label")}
          />
        </div>
      </div>

      <Card tone="recipe">
        <p className="text-sm text-ink-muted">{t("privateNote")}</p>
      </Card>
    </div>
  );
}

function Nothing({ yet, body, cta }: { yet: string; body: string; cta: string }) {
  return (
    <div className="mx-auto flex max-w-prose flex-col gap-4 px-6 py-20">
      <h1 className="text-3xl text-ink">{yet}</h1>
      <p className="text-ink-muted">{body}</p>
      <Link href="/templates" className={buttonClass("primary")}>
        {cta}
      </Link>
    </div>
  );
}

function Broken({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex max-w-prose flex-col gap-4 px-6 py-20">
      <h1 className="text-3xl text-ink">{title}</h1>
      <p className="text-ink-muted">{body}</p>
    </div>
  );
}
