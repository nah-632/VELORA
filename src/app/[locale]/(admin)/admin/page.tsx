import { type Metadata } from "next";
import { getTranslations, unstable_setRequestLocale } from "next-intl/server";

import { Button, buttonClass } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { isLocale } from "@/i18n/routing";
import { getSql } from "@/lib/db";
import { logoutAction } from "@/features/admin/actions";
import { recentAttempts } from "@/features/admin/login";
import { requireAdmin } from "@/features/admin/sessions";

/**
 * The operator's home.
 *
 * Every number on this page is a query against the real database — there is no seeded example and
 * no placeholder that looks like data. On a fresh installation the counts are zeroes and the page
 * says so, which is a true statement about a new installation rather than a broken one.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "admin.meta" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

interface Counts {
  events: number;
  guests: number;
  confirmed: number;
  declined: number;
  no_response: number;
}

export default async function AdminDashboardPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  if (!isLocale(locale)) return null;
  unstable_setRequestLocale(locale);

  // The guard, not the middleware: this is the check that decides. Middleware only saves the
  // reader a redirect.
  const admin = await requireAdmin(locale);

  const t = await getTranslations("admin.dashboard");

  const settings = await getSql()<{ whatsapp_number: string }[]>`
    select whatsapp_number from public.settings limit 1`;

  const counts = await getSql()<Counts[]>`
    select
      (select count(*)::int from public.events) as events,
      (select count(*)::int from public.guests) as guests,
      (select count(*)::int from public.rsvps where response = 'confirmed') as confirmed,
      (select count(*)::int from public.rsvps where response = 'declined') as declined,
      (select count(*)::int from public.guests g
        where not exists (select 1 from public.rsvps r where r.guest_id = g.id)) as no_response`;

  const attempts = await recentAttempts(5);
  const numbers = counts[0] ?? {
    events: 0,
    guests: 0,
    confirmed: 0,
    declined: 0,
    no_response: 0,
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <SectionHeading eyebrow={t("eyebrow")} title={t("title")}>
        {`${t("signedInAs")} ${admin.email}`}
      </SectionHeading>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="text-sm font-medium text-ink-muted">{t("whatsappSender")}</h2>
          {/* A phone number is a Latin-direction run inside an Arabic paragraph: without the
              isolation the leading `+` is reordered to the end of the line. */}
          <p className="ltr-token mt-2 text-2xl text-ink" dir="ltr">
            {settings[0]?.whatsapp_number ?? "—"}
          </p>
          <p className="mt-2 text-xs text-ink-muted">{t("senderNote")}</p>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-ink-muted">{t("counts.events")}</h2>
          <dl className="mt-2 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-muted">{t("counts.events")}</dt>
            <dd>{numbers.events}</dd>
            <dt className="text-ink-muted">{t("counts.guests")}</dt>
            <dd>{numbers.guests}</dd>
            <dt className="text-ink-muted">{t("counts.confirmed")}</dt>
            <dd>{numbers.confirmed}</dd>
            <dt className="text-ink-muted">{t("counts.declined")}</dt>
            <dd>{numbers.declined}</dd>
            <dt className="text-ink-muted">{t("counts.noResponse")}</dt>
            <dd>{numbers.no_response}</dd>
          </dl>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="text-sm font-medium text-ink-muted">{t("recentAttempts")}</h2>
        {attempts.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">{t("attemptsEmpty")}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {attempts.map((attempt) => (
              <li key={`${attempt.attempted_at.toISOString()}-${attempt.email_normalized}`}>
                <span className="ltr-token text-ink-muted" dir="ltr">
                  {attempt.attempted_at.toISOString().replace("T", " ").slice(0, 19)}
                </span>{" "}
                — {attempt.succeeded ? t("succeeded") : t("failed")}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-6 text-xs text-ink-muted">{t("sessionNote")}</p>
      <p className="mt-2 text-xs text-ink-muted">{t("nextStep")}</p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <a className={buttonClass("secondary")} href={`/${locale}/admin/events`}>
          {t("events")}
        </a>
        <a className={buttonClass("secondary")} href={`/${locale}/admin/settings`}>
          {t("settings")}
        </a>
        <form action={logoutAction}>
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" variant="quiet">
            {t("signOut")}
          </Button>
        </form>
      </div>
    </main>
  );
}
