import { type Metadata } from "next";
import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { TemplateCanvas } from "@/components/invitation/TemplateCanvas";
import { StatePanel } from "@/components/ui/Card";
import { isLocale } from "@/i18n/routing";
import { requireAdmin } from "@/features/admin/sessions";
import { previewInvitationForGuest } from "@/features/invitations/public";

/**
 * "Preview as this guest."
 *
 * The operator has to be able to see exactly what one person will receive — the name on it, the
 * personal line, the language — without opening a real link and without disturbing the counts. So
 * this renders through the same loader the public page uses, minus the open recording.
 *
 * The distinction is not cosmetic: a preview that ran the public code path would inflate
 * `open_count` and make the RSVP dashboard lie about who has opened their invitation.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PreviewAsGuestPage({
  params: { locale, id, guestId },
}: {
  params: { locale: string; id: string; guestId: string };
}) {
  if (!isLocale(locale)) return null;
  unstable_setRequestLocale(locale);
  await requireAdmin(locale);

  const invitation = await previewInvitationForGuest(guestId);
  if (!invitation) notFound();

  const g = await getTranslations("admin.guests");

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="mb-6">
        <StatePanel
          kind="empty"
          message={`${g("previewBanner")} — ${invitation.guestName} · ${invitation.language.toUpperCase()} · ${
            invitation.personalLine ? g("hasPersonalLine") : g("noPersonalLine")
          }`}
        />
      </div>

      <div
        dir={invitation.language === "ar" ? "rtl" : "ltr"}
        lang={invitation.language}
        className="mx-auto w-full max-w-[420px]"
      >
        <TemplateCanvas
          design={invitation.design}
          blocks={invitation.blocks}
          locale={invitation.language}
          label={g("previewBanner")}
        />
        {invitation.personalLine ? (
          <p className="mt-4 text-center text-sm italic text-ink-muted">{invitation.personalLine}</p>
        ) : null}
      </div>

      <p className="mt-6 text-center text-xs text-ink-muted">
        <a className="underline underline-offset-4" href={`/${locale}/admin/events/${id}`}>
          {g("backToEvent")}
        </a>
      </p>
    </main>
  );
}
