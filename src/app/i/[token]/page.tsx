import { notFound } from "next/navigation";

import { TemplateCanvas } from "@/components/invitation/TemplateCanvas";
import { loadInvitationOnce } from "@/features/invitations/cache";

/**
 * A guest's invitation.
 *
 * What is here: their name, the couple's names in the design the operator chose, the date, the
 * venue with a map link, the verse, any notes, their personal line, and a footer that reaches the
 * operator. What is not here, and will not be: any other guest, any phone number, any count, any id.
 *
 * The page deliberately does not cache (see next.config.mjs: `no-store` for `/i/:path*` and an
 * `X-Robots-Tag`), and the loading of the row records the open. Everything else the brief asks for
 * on this page — the envelope, the countdown, the RSVP, the calendar file — belongs to the next
 * phase and is listed in tasks/todo.md rather than faked here.
 */
export const dynamic = "force-dynamic";

export default async function InvitationPage({ params: { token } }: { params: { token: string } }) {
  const invitation = await loadInvitationOnce(token);

  // An unknown, malformed or revoked token is a 404 — the same response for every kind of "no",
  // so the route cannot be used to test whether a token exists.
  if (!invitation) notFound();

  const isArabic = invitation.language === "ar";
  const { event } = invitation;
  const venueName = isArabic ? event.venueNameAr : event.venueNameEn;

  const dateLabel = new Intl.DateTimeFormat(isArabic ? "ar-BH" : "en-BH", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: event.timezone || "Asia/Bahrain",
  }).format(event.eventDatetime);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-5 py-10">
      <p className="text-center text-sm text-ink-muted">
        {isArabic ? "أهلاً" : "Welcome"}, <span className="font-medium text-ink">{invitation.guestName}</span>
      </p>

      {invitation.personalLine ? (
        <p className="mt-2 text-center text-sm italic text-ink-muted">{invitation.personalLine}</p>
      ) : null}

      <div className="mt-6">
        <TemplateCanvas
          design={invitation.design}
          blocks={invitation.blocks}
          locale={invitation.language}
          label={isArabic ? `دعوة ${invitation.guestName}` : `Invitation for ${invitation.guestName}`}
        />
      </div>

      <dl className="mt-6 flex flex-col gap-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">{isArabic ? "التاريخ" : "Date"}</dt>
          {/* Latin digits in both languages, following the decision already made for money. */}
          <dd className="ltr-token text-end" dir="ltr">
            {dateLabel}
          </dd>
        </div>
        {event.hijriDateText ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{isArabic ? "التاريخ الهجري" : "Hijri date"}</dt>
            <dd className="text-end">{event.hijriDateText}</dd>
          </div>
        ) : null}
        {venueName ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{isArabic ? "المكان" : "Venue"}</dt>
            <dd className="text-end">{venueName}</dd>
          </div>
        ) : null}
      </dl>

      {event.venueMapUrl ? (
        <a
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-ground-paper px-5 text-sm font-medium text-ink"
          href={event.venueMapUrl}
          rel="noreferrer noopener"
          target="_blank"
        >
          {isArabic ? "افتح الموقع في الخرائط" : "Open in Maps"}
        </a>
      ) : null}

      {invitation.blocks.notes ? (
        <p className="mt-4 text-sm text-ink-muted">{invitation.blocks.notes}</p>
      ) : null}

      <footer className="mt-auto pt-10 text-center text-xs text-ink-muted">
        <p>{isArabic ? "صلوا معنا" : "With love"}</p>
        <p className="mt-1">VELORA — {isArabic ? "فنّ الدعوة" : "The Art of Inviting"}</p>
      </footer>
    </main>
  );
}
