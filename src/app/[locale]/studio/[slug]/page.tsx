import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DesignConfigSchema } from "@/features/catalogue/design-config";
import { getCatalogue } from "@/features/catalogue/repository";
import { loadCurrentDraft } from "@/features/studio/actions";
import { EMPTY_CONTENT, parseContent, type InvitationContent } from "@/features/studio/content";
import { Studio } from "@/features/studio/Studio";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";

/**
 * The Studio.
 *
 * The server resolves three things and hands them to the editor: the template the customer chose,
 * the draft this browser already owns (if any), and the locale. Everything after that is the
 * editor's own state.
 *
 * The design is taken from the **draft** when there is one, and from the template otherwise — a
 * customer who has changed their colours must not have them reset by reloading the page.
 */
export default async function StudioPage({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}) {
  if (!isLocale(locale)) notFound();

  const t = await getTranslations({ locale, namespace: "editor" });
  const catalogue = await getCatalogue();
  const template = await catalogue.get(slug, locale);

  if (!template) notFound();

  const draft = await loadCurrentDraft();
  const draftMatchesTemplate = draft?.templateSlug === slug;

  const design =
    (draftMatchesTemplate && DesignConfigSchema.safeParse(draft.designConfig).success
      ? DesignConfigSchema.parse(draft.designConfig)
      : null) ?? template.design;

  const content: InvitationContent = draftMatchesTemplate
    ? parseContent(draft.content)
    : EMPTY_CONTENT;

  return (
    <div className="flex flex-col">
      <p className="mx-auto w-full max-w-[1500px] px-4 pt-6 text-sm lg:px-6">
        <Link href={`/templates/${slug}`} className="text-ink-muted underline hover:text-gold-deep">
          {t("backToDesign")}
        </Link>
      </p>
      <Studio
        templateId={template.id}
        templateSlug={template.slug}
        templateName={template.name}
        locale={locale}
        initialContent={content}
        initialDesign={design}
        initialRevision={draftMatchesTemplate ? (draft?.revision ?? 0) : 0}
        initialSavedAt={draftMatchesTemplate ? (draft?.updatedAt ?? null) : null}
      />
    </div>
  );
}
