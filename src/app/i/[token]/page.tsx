import { notFound } from "next/navigation";

import { TemplateCanvas } from "@/components/invitation/TemplateCanvas";
import { buttonClass } from "@/components/ui/Button";
import { loadInvitationOnce } from "@/features/invitations/cache";
import { Countdown } from "@/features/invitations/Countdown";
import { WaxSeal } from "@/features/invitations/WaxSeal";
import { copyFor, fill } from "@/features/invitations/copy";
import { DEFAULT_DURATION_MINUTES, remaining } from "@/features/invitations/countdown";
import { googleCalendarUrl } from "@/features/invitations/ics";
import { submitRsvpAction } from "@/features/invitations/actions";
import { rsvpForToken, thankYou } from "@/features/invitations/rsvp";
import { classifyMapUrl, mapButtonLabel } from "@/lib/maps";
import { LIMITS, clientAddress, consume, pruneRateLimits, requestKey } from "@/features/invitations/rate-limit";

/**
 * A guest's invitation.
 *
 * The order on the page is the order a guest experiences it: the seal, their name, the couple, when
 * and where, how long is left, and the question. The answer comes back to the same page rather than
 * to a thank-you screen, so a guest who wants to change it can — which the brief requires and which
 * is also how people behave.
 *
 * What is not here, and will not be: any other guest, any phone number, any count, any id. The
 * loader returns one guest's row and nothing else, and the assertions in tests/db/invitations.mjs
 * check that by looking for the other guest's name in the rendered data.
 */
export const dynamic = "force-dynamic";

const RSVP_KEYS = ["confirmed", "declined", "bad_response", "too_many_companions", "invalid_token", "rate_limited"] as const;

export default async function InvitationPage({
  params: { token },
  searchParams,
}: {
  params: { token: string };
  searchParams: { rsvp?: string };
}) {
  // Before anything is read: a link that has been leaked can still be hammered, and this is the
  // cheapest place to stop it. A refused request records no open, so the operator's counts stay true.
  const decision = await consume(requestKey("invite", { token, address: clientAddress() }), LIMITS.invitation);
  if (!decision.allowed) {
    const copy = copyFor("ar");
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold text-ink">{copy.busy.title}</h1>
        <p className="mt-3 text-sm text-ink-muted">{copy.busy.body}</p>
      </main>
    );
  }
  if (decision.used % 20 === 0) await pruneRateLimits();

  const invitation = await loadInvitationOnce(token);

  // An unknown, malformed or revoked token is a 404 — the same response for every kind of "no".
  if (!invitation) notFound();

  const copy = copyFor(invitation.language);
  const isArabic = invitation.language === "ar";
  const { event, design } = invitation;

  // The answer, and the thank-you. Read without recording an open — the guest already opened the
  // page to get here, and counting this query would double every visit.
  const rsvp = await rsvpForToken(token);
  const answerFromUrl = RSVP_KEYS.includes((searchParams.rsvp ?? "") as (typeof RSVP_KEYS)[number])
    ? searchParams.rsvp
    : undefined;
  const answered = rsvp?.response ?? null;

  const pick = (ar: string | null, en: string | null) => ((isArabic ? ar : en) ?? ar ?? en ?? "").trim();
  const venue = pick(event.venueNameAr, event.venueNameEn);
  const address = pick(event.venueAddressAr, event.venueAddressEn);
  const notes = pick(event.notesAr, event.notesEn);
  const dressCode = pick(event.dressCodeAr, event.dressCodeEn);
  const parking = pick(event.parkingAr, event.parkingEn);
  const entrance = pick(event.entranceAr, event.entranceEn);
  const sections = pick(event.sectionsAr, event.sectionsEn);
  const map = classifyMapUrl(event.venueMapUrl);
  const schedule = (Array.isArray(event.schedule) ? event.schedule : []) as Record<string, string | undefined>[];
  // A line the operator filled in one language only still shows, in that language: a guest reading
  // an empty row would think the evening has no programme rather than that one column was skipped.
  const line = (item: Record<string, string | undefined>, field: "title" | "detail") => {
    const preferred = item[`${field}_${isArabic ? "ar" : "en"}`];
    const other = item[`${field}_${isArabic ? "en" : "ar"}`];
    return (preferred ?? other ?? "").trim();
  };
  const dateLabel = new Intl.DateTimeFormat(isArabic ? "ar-BH" : "en-BH", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: event.timezone || "Asia/Bahrain",
  }).format(event.eventDatetime);

  const initial = remaining(Date.now(), event.eventDatetime.getTime());
  const couple =
    isArabic
      ? [event.groomNameAr, event.brideNameAr].filter(Boolean).join(" و ")
      : [event.groomNameEn, event.brideNameEn].filter(Boolean).join(" & ");

  const calendarTitle = isArabic ? `زفاف ${couple}` : `Wedding of ${couple}`;
  const calendarEnd = new Date(event.eventDatetime.getTime() + DEFAULT_DURATION_MINUTES * 60_000);
  const googleUrl = googleCalendarUrl({
    start: event.eventDatetime,
    end: calendarEnd,
    title: calendarTitle,
    location: venue,
    description: isArabic ? event.quoteAr : event.quoteEn,
  });

  return (
    <WaxSeal
      guestName={invitation.guestName}
      monogram={event.monogramText}
      coupleNames={{ groom: isArabic ? event.groomNameAr : event.groomNameEn, bride: isArabic ? event.brideNameAr : event.brideNameEn }}
      palette={design.palette}
      locale={invitation.language}
      animation={invitation.animation}
      labels={copy.seal}
      sessionKey={`velora-seal-${token.slice(0, 12)}`}
    >
      <main className="mx-auto flex w-full max-w-[520px] flex-col px-5 py-10">
        <p className="text-center text-sm text-ink-muted">
          {isArabic ? "أهلاً" : "Welcome"},{" "}
          <span className="font-medium text-ink">{invitation.guestName}</span>
        </p>

        {invitation.personalLine ? (
          <p className="mt-2 text-center text-sm italic text-ink-muted">{invitation.personalLine}</p>
        ) : null}

        <div className="mt-6">
          <TemplateCanvas
            design={design}
            blocks={invitation.blocks}
            locale={invitation.language}
            label={isArabic ? `دعوة ${invitation.guestName}` : `Invitation for ${invitation.guestName}`}
          />
        </div>

        <div className="mt-8">
          <Countdown
            targetIso={event.eventDatetime.toISOString()}
            initial={initial}
            labels={copy.countdown}
            finishedMessage={copy.countdownFinished}
          />
        </div>

        <dl className="mt-8 flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{copy.details.date}</dt>
            {/* Latin digits in both languages, in the event's zone. */}
            <dd className="ltr-token text-end" dir="ltr">
              {dateLabel}
            </dd>
          </div>
          {event.hijriDateText ? (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">{copy.details.hijri}</dt>
              <dd className="text-end">{event.hijriDateText}</dd>
            </div>
          ) : null}
          {venue ? (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">{copy.details.venue}</dt>
              <dd className="text-end">{venue}</dd>
            </div>
          ) : null}
          {address ? (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">{copy.details.address}</dt>
              <dd className="text-end">{address}</dd>
            </div>
          ) : null}
          {dressCode ? (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">{copy.details.dressCode}</dt>
              <dd className="text-end">{dressCode}</dd>
            </div>
          ) : null}
        </dl>

        {parking || entrance || sections || notes ? (
          <section className="mt-6 flex flex-col gap-3 text-sm">
            {notes ? <p className="text-ink">{notes}</p> : null}
            {parking ? (
              <p className="text-ink-muted">
                <span className="text-ink">{copy.details.parking}: </span>
                {parking}
              </p>
            ) : null}
            {entrance ? (
              <p className="text-ink-muted">
                <span className="text-ink">{copy.details.entrance}: </span>
                {entrance}
              </p>
            ) : null}
            {sections ? (
              <p className="text-ink-muted">
                <span className="text-ink">{copy.details.sections}: </span>
                {sections}
              </p>
            ) : null}
          </section>
        ) : null}

        {schedule.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-4 text-center text-sm font-medium text-ink">{copy.details.schedule}</h2>
            <ol className="timeline">
              {schedule.map((item, index) => {
                const title = line(item, "title");
                const detail = line(item, "detail");
                if (!title && !detail) return null;
                return (
                  <li className="timeline__item" key={index}>
                    <span className="timeline__marker" aria-hidden="true" />
                    <div className="timeline__body">
                      {item.time ? (
                        <span className="timeline__time ltr-token" dir="ltr">
                          {item.time}
                        </span>
                      ) : null}
                      {title ? <p className="timeline__title">{title}</p> : null}
                      {detail ? <p className="timeline__detail">{detail}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {map.ok ? (
            <a
              className={buttonClass("secondary")}
              href={map.href}
              rel="noreferrer noopener"
              target="_blank"
            >
              {mapButtonLabel(map.kind ?? "other", invitation.language)}
            </a>
          ) : null}
          <a className={buttonClass("secondary")} href={`/i/${token}/calendar`}>
            {copy.calendar.ics}
          </a>
          <a className={buttonClass("quiet")} href={googleUrl} rel="noreferrer noopener" target="_blank">
            {copy.calendar.google}
          </a>
        </div>

        <section className="mt-10 border-t border-line pt-6">
          {answerFromUrl === "bad_response" ||
          answerFromUrl === "too_many_companions" ||
          answerFromUrl === "invalid_token" ||
          answerFromUrl === "rate_limited" ? (
            <p role="alert" className="mb-3 text-sm text-danger">
              {copy.rsvp.errors[answerFromUrl]}
            </p>
          ) : null}

          {answered && answerFromUrl !== "update" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink">{thankYou(event, answered, invitation.language)}</p>
              <p className="text-xs text-ink-muted">
                {fill(copy.rsvp.current, { answer: copy.rsvp.answers[answered] })}
              </p>
              <a className={buttonClass("quiet")} href={`/i/${token}?rsvp=update`}>
                {copy.rsvp.update}
              </a>
            </div>
          ) : (
            <form action={submitRsvpAction} className="flex flex-col gap-4">
              <h2 className="text-sm font-medium text-ink">{copy.rsvp.title}</h2>
              <input type="hidden" name="token" value={token} />

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3 text-sm text-ink">
                  <input type="radio" name="response" value="confirmed" required defaultChecked={answered !== "declined"} />
                  {copy.rsvp.confirmed}
                </label>
                <label className="flex items-center gap-3 text-sm text-ink">
                  <input type="radio" name="response" value="declined" defaultChecked={answered === "declined"} />
                  {copy.rsvp.declined}
                </label>
              </div>

              {rsvp && rsvp.maxCompanions > 0 ? (
                <label className="flex flex-col gap-1.5 text-sm text-ink">
                  <span>
                    {copy.rsvp.companions}{" "}
                    <span className="text-xs text-ink-muted">
                      ({fill(copy.rsvp.companionHint, { max: rsvp.maxCompanions })})
                    </span>
                  </span>
                  <select
                    name="companions"
                    defaultValue={String(rsvp.companions)}
                    className="min-h-11 rounded-md border border-line bg-ground-paper px-3 text-sm text-ink"
                  >
                    {Array.from({ length: rsvp.maxCompanions + 1 }, (_, n) => (
                      <option key={n} value={n}>
                        {String(n)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div>
                <button type="submit" className={buttonClass("primary")}>
                  {answered ? copy.rsvp.update : copy.rsvp.submit}
                </button>
              </div>
            </form>
          )}
        </section>

        <p className="mt-8 text-center text-xs text-ink-muted">{copy.privacy}</p>

        <footer className="mt-10 text-center text-xs text-ink-muted">
          <p>{copy.footer.withLove}</p>
          <p className="mt-1">{copy.footer.brand}</p>
        </footer>
      </main>
    </WaxSeal>
  );
}
