import { type Metadata } from "next";
import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import Link from "next/link";

import { Card, SectionHeading } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { isLocale } from "@/i18n/routing";
import { requireAdmin } from "@/features/admin/sessions";
import { getEvent } from "@/features/events/queries";
import { listGuests } from "@/features/guests/queries";
import { resolveAudience } from "@/features/invitations/messages";

/**
 * The RSVP dashboard: the numbers the operator needs before the venue asks for them.
 *
 * The question a wedding dashboard answers is not "how many rows" — it is **how many seats, in which
 * hall, and who is bringing whom**. So the table is grouped by hall, and the seat count includes
 * companions, because a venue charges per seat and a guest who brings two is three.
 *
 * Everything is computed from one query, server-side. No client state: this is a page an operator
 * opens on a phone at a venue, and it must be right on the first paint.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "admin.rsvp" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function RsvpDashboard({
  params: { locale, id },
}: {
  params: { locale: string; id: string };
}) {
  if (!isLocale(locale)) return null;
  unstable_setRequestLocale(locale);
  await requireAdmin(locale);

  const event = await getEvent(id);
  if (!event) return null;

  const guests = await listGuests(id);
  const t = await getTranslations("admin.rsvp");

  const responded = guests.filter((guest) => guest.response === "confirmed" || guest.response === "declined");
  const confirmed = guests.filter((guest) => guest.response === "confirmed");
  const declined = guests.filter((guest) => guest.response === "declined");
  const waiting = guests.filter((guest) => !guest.response);

  /** Seats, per hall. A guest who has not answered holds no seat, and may yet. */
  const seats = { women: 0, men: 0, both: 0 };
  for (const guest of confirmed) {
    const audience = resolveAudience((guest.gender as "male" | "female" | "neutral") ?? "neutral", guest.audience);
    seats[audience] += 1 + (guest.companions_count ?? 0);
  }

  const rate = guests.length === 0 ? 0 : Math.round((responded.length / guests.length) * 100);

  const rows = [
    { key: "guests", label: t("guests"), value: guests.length },
    { key: "confirmed", label: t("confirmed"), value: confirmed.length },
    { key: "declined", label: t("declined"), value: declined.length },
    { key: "waiting", label: t("waiting"), value: waiting.length },
    { key: "rate", label: t("rate"), value: `${rate}%` },
    { key: "seatsWomen", label: t("seatsWomen"), value: seats.women },
    { key: "seatsMen", label: t("seatsMen"), value: seats.men },
    { key: "seatsBoth", label: t("seatsBoth"), value: seats.both },
  ];

  const exportHref = `/${locale}/admin/events/${id}/export`;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <SectionHeading eyebrow={t("eyebrow")} title={t("title")}>
        {[event.groom_name_ar, event.bride_name_ar].filter(Boolean).join(" و ") || event.slug}
      </SectionHeading>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows.map((row) => (
          <div key={row.key} className="rounded-md border border-line p-3">
            <dt className="text-xs text-ink-muted">{row.label}</dt>
            <dd className="mt-1 text-xl text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-wrap gap-2">
        <a className={buttonClass("secondary")} href={exportHref}>
          {t("exportShort")}
        </a>
        <a className={buttonClass("quiet")} href={`${exportHref}?phone=1`}>
          {t("exportWithPhone")}
        </a>
        <Link className={buttonClass("quiet")} href={`/${locale}/admin/events/${id}`}>
          {t("back")}
        </Link>
      </div>

      <Card className="mt-8">
        <h2 className="text-sm font-medium text-ink">{t("waitingTitle")}</h2>
        <p className="mt-1 text-xs text-ink-muted">{t("waitingHint")}</p>
        {waiting.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">{t("nobodyWaiting")}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {waiting.slice(0, 30).map((guest) => (
              <li key={guest.id} className="flex justify-between gap-3 border-b border-line/60 py-1 last:border-0">
                <span className="text-ink">{guest.full_name}</span>
                <span className="text-xs text-ink-muted ltr-token" dir="ltr">
                  {guest.phone}
                </span>
              </li>
            ))}
            {waiting.length > 30 ? (
              <li className="pt-1 text-xs text-ink-muted">{t("andMore", { count: waiting.length - 30 })}</li>
            ) : null}
          </ul>
        )}
      </Card>
    </main>
  );
}