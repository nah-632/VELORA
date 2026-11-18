import { type Metadata } from "next";
import { getTranslations, unstable_setRequestLocale } from "next-intl/server";

import { Button } from "@/components/ui/Button";
import { Card, SectionHeading, StatePanel } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { isLocale } from "@/i18n/routing";
import { createEventAction } from "@/features/events/actions";
import { listEvents, listTemplateOptions } from "@/features/events/queries";
import { requireAdmin } from "@/features/admin/sessions";

/**
 * The events list.
 *
 * Every number is a count from the database. An event with no guests shows zero, which is the truth
 * about an event that was created a minute ago.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "admin.events" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function EventsPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { error?: string };
}) {
  if (!isLocale(locale)) return null;
  unstable_setRequestLocale(locale);
  await requireAdmin(locale);

  const t = await getTranslations("admin.events");
  const [events, templates] = await Promise.all([listEvents(), listTemplateOptions()]);

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-BH" : "en-BH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Bahrain",
    }).format(date);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <SectionHeading eyebrow={t("eyebrow")} title={t("title")}>
        {t("intro")}
      </SectionHeading>

      {searchParams.error ? (
        <div className="mb-6">
          <StatePanel kind="error" message={searchParams.error} />
        </div>
      ) : null}

      <Card>
        <h2 className="text-sm font-medium text-ink">{t("new")}</h2>
        <form action={createEventAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          <Field label={t("groomAr")} name="groom_name_ar" dir="rtl" />
          <Field label={t("brideAr")} name="bride_name_ar" dir="rtl" />
          <Field label={t("groomEn")} name="groom_name_en" dir="ltr" className="ltr-token" />
          <Field label={t("brideEn")} name="bride_name_en" dir="ltr" className="ltr-token" />
          <Field label={t("date")} name="event_datetime" type="datetime-local" dir="ltr" className="ltr-token" />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">{t("template")}</span>
            <select
              name="template_id"
              defaultValue={templates[0]?.id ?? ""}
              className="min-h-11 rounded-md border border-line bg-ground-paper px-3 text-sm text-ink"
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {locale === "ar" ? template.name_ar : template.name_en}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">{t("create")}</Button>
          </div>
        </form>
      </Card>

      {events.length === 0 ? (
        <div className="mt-6">
          <StatePanel kind="empty" message={t("none")} />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {events.map((event) => {
            const couple =
              locale === "ar"
                ? [event.groom_name_ar, event.bride_name_ar].filter(Boolean).join(" و ")
                : [event.groom_name_en, event.bride_name_en].filter(Boolean).join(" & ");
            return (
              <Card key={event.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <a className="text-lg font-medium text-ink underline-offset-4 hover:underline" href={`/${locale}/admin/events/${event.id}`}>
                    {couple || t("untitled")}
                  </a>
                  <span className="text-xs text-ink-muted">{event.status}</span>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  <span className="ltr-token" dir="ltr">
                    {formatDate(event.event_datetime)}
                  </span>
                  {event.template_name ? ` · ${event.template_name}` : ""}
                </p>
                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-ink-muted">{t("guests")}</dt>
                    <dd>{event.guests}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-ink-muted">{t("confirmed")}</dt>
                    <dd>{event.confirmed}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-ink-muted">{t("declined")}</dt>
                    <dd>{event.declined}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-ink-muted">{t("noResponse")}</dt>
                    <dd>{event.no_response}</dd>
                  </div>
                </dl>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
