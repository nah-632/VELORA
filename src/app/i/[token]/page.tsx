import Link from "next/link";
import { notFound } from "next/navigation";

import { MihrabArch } from "@/features/invitations/MihrabArch";
import { loadInvitationOnce } from "@/features/invitations/cache";
import { Countdown } from "@/features/invitations/Countdown";
import { WaxSeal } from "@/features/invitations/WaxSeal";
import { copyFor, fill } from "@/features/invitations/copy";
import { DEFAULT_DURATION_MINUTES, remaining } from "@/features/invitations/countdown";
import { googleCalendarUrl } from "@/features/invitations/ics";
import { confirmLabel, renderTemplate, resolveCopy } from "@/features/invitations/messages";
import { submitRsvpAction } from "@/features/invitations/actions";
import { rsvpForToken } from "@/features/invitations/rsvp";
import { VenuesSection, type VenueCardData } from "@/features/invitations/VenuesSection";
import { iconVariantFor } from "@/features/invitations/VenueIcons";
import {
  venueForCalendar,
  venueLabel,
  venueMapLink,
  venueText,
  venueVariables,
  venuesForGuest,
} from "@/features/invitations/venues";
import { mapsButtonLabel } from "@/lib/maps";
import { getTemplateBySlug } from "@/lib/templates/registry";

/**
 * A guest's invitation.
 *
 * The order is the order a guest experiences it: the seal, their name, the couple, when and where,
 * how long is left, the halls, and the question.
 *
 * Three things about this page are load-bearing.
 *
 *   **The wording is data.** Every text comes from `resolveCopy` — the operator's override if there is
 *   one, the default otherwise — and every text is rendered through `renderTemplate`, so `{guest_name}`
 *   is the guest's name and not a placeholder somebody forgot to replace.
 *
 *   **The language is a query parameter over the guest's stored choice.** `?lang=en` re-renders the
 *   page; nothing is translated on the client and nothing has to be kept in sync. The sheet stays open
 *   across it because it is a client component whose state survives the soft navigation — which is the
 *   behaviour that matters: a guest reading the address does not want the dialog to close under them.
 *
 *   **Both halls are shown to everyone.** The icons are never filtered; the guest's own carries the
 *   ring. See `venuesForGuest`.
 */
export const dynamic = "force-dynamic";

const RSVP_KEYS = ["confirmed", "declined", "bad_response", "too_many_companions", "invalid_token", "rate_limited"] as const;

export default async function InvitationPage({
  params: { token },
  searchParams,
}: {
  params: { token: string };
  searchParams: { rsvp?: string; lang?: string; schedule?: string };
}) {
  const invitation = await loadInvitationOnce(token);

  // An unknown, malformed or revoked token is a 404 — the same response for every kind of "no".
  if (!invitation) notFound();

  const language: "ar" | "en" =
    searchParams.lang === "ar" || searchParams.lang === "en" ? searchParams.lang : invitation.language;
  const isArabic = language === "ar";
  const base = copyFor(language);
  const copy = (invitation.copyByLocale[language] ?? resolveCopy(language, null, invitation.gender)) as Record<string, string>;
  const { event, design } = invitation;

  // What the guest reads, in their language, with their name in it.
  const groom = isArabic ? event.groomNameAr ?? event.groomNameEn : event.groomNameEn ?? event.groomNameAr;
  const bride = isArabic ? event.brideNameAr ?? event.brideNameEn : event.brideNameEn ?? event.brideNameAr;

  const view = venuesForGuest(invitation.venues, invitation.audience);
  const venueVars = venueVariables(view, language);
  const calendarVenue = venueForCalendar(view, language);

  const dateLabel = new Intl.DateTimeFormat(isArabic ? "ar-BH" : "en-BH", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: event.timezone || "Asia/Bahrain",
  }).format(event.eventDatetime);

  const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/i/${token}`;
  const variables = {
    guest_name: invitation.guestName,
    groom: groom ?? "",
    bride: bride ?? "",
    date: dateLabel,
    venue: calendarVenue.name || view.own.map((venue) => venueLabel(venue, language)).join(" · "),
    map_url: calendarVenue.map,
    link,
    venue_name_for_guest: venueVars.venue_name_for_guest,
    venue_map_url_for_guest: venueVars.venue_map_url_for_guest,
  };

  const text = (slot: string) => renderTemplate(copy[slot] ?? "", variables);

  /**
   * The thank-you: the operator's own words on the event first, then the copy slot.
   *
   * Two places hold the same sentence because the thank-you existed before the copy system did. The
   * event's own column wins, because it is the more specific of the two — somebody typed it for this
   * wedding.
   */
  const thankYouFor = (answered: "confirmed" | "declined") => {
    const written = isArabic
      ? answered === "confirmed"
        ? event.thankYouConfirmedAr
        : event.thankYouDeclinedAr
      : answered === "confirmed"
        ? event.thankYouConfirmedEn
        : event.thankYouDeclinedEn;
    return renderTemplate(written ?? copy[answered === "confirmed" ? "thankConfirmed" : "thankDeclined"] ?? "", variables);
  };

  const rsvp = await rsvpForToken(token);
  const answerFromUrl = RSVP_KEYS.includes((searchParams.rsvp ?? "") as (typeof RSVP_KEYS)[number])
    ? searchParams.rsvp
    : undefined;
  const answered = rsvp?.response ?? null;
  const showAllSchedule = searchParams.schedule === "all";

  const schedule = (Array.isArray(event.schedule) ? event.schedule : []) as Record<string, string | undefined>[];
  const relevant = schedule.filter((item) => {
    const tag = item.audience ?? "all";
    if (tag === "all") return true;
    if (invitation.audience === "both") return true;
    return tag === invitation.audience;
  });
  const hiddenByFilter = schedule.length - relevant.length;
  const shown = showAllSchedule ? schedule : relevant;

  const line = (item: Record<string, string | undefined>, field: "title" | "detail") =>
    ((item[`${field}_${isArabic ? "ar" : "en"}`] ?? item[`${field}_${isArabic ? "en" : "ar"}`] ?? "") as string).trim();

  // Every guest sees every hall. The card carries what the sheet needs, already localised.
  const venueCards: VenueCardData[] = view.own.concat(view.other).map((venue) => ({
    id: venue.id,
    kind: venue.kind,
    name: venueLabel(venue, language),
    iconLabel:
      venue.kind === "women"
        ? base.venues.womenLocation
        : venue.kind === "men"
          ? base.venues.menLocation
          : base.venues.location,
    emphasis: view.emphasis !== null && venue.kind === view.emphasis,
    address: venueText(venue, "address", language),
    time: (venue.start_time ?? "").trim(),
    mapUrl: venueMapLink(venue, language),
    mapLabel: mapsButtonLabel(language),
    entrance: venueText(venue, "entrance", language),
    parking: venueText(venue, "parking", language),
    dressCode: venueText(venue, "dress_code", language),
    notes: venueText(venue, "notes", language),
    phone: venue.contact_phone,
  }));

  /**
   * The template, if this event uses one of the token-system designs.
   *
   * Since B2 the template supplies the **entrance** — the seal's imprint, the envelope's paper, the
   * wax colour, the liner — and the palette the venue icons draw their accent from. It no longer
   * renders its own card: the luxe hero below is the invitation for every event, and the card was
   * what printed the couple's names, the date and the verse a second time.
   */
  /*
   * The template: the row's own token document wins, the code registry is the fallback.
   *
   * The document lives in the row (`templates.token_config`, 0009) because two rows can share a
   * palette and differ only in the seal, the envelope and the opening — which only the token document
   * describes. The registry lookup stays for rows seeded before 0009, and for the Golden Palace row
   * whose document has not been attached yet.
   */
  const template = invitation.tokenConfig ?? getTemplateBySlug(invitation.templateSlug);

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
    location: [calendarVenue.name, calendarVenue.address].filter(Boolean).join(", "),
    description: [isArabic ? event.quoteAr : event.quoteEn, event.notesAr && isArabic ? event.notesAr : event.notesEn]
      .filter(Boolean)
      .join("\n\n"),
  });

  const question = (value: string) => {
    const params = new URLSearchParams();
    if (value) params.set(value === "all" ? "schedule" : "rsvp", value);
    if (language !== invitation.language) params.set("lang", language);
    const query = params.toString();
    return query ? `?${query}` : "";
  };

  /**
   * The other language, as a client-side transition.
   *
   * A plain `<a>` would be a full document load: the sheet would close and the guest would lose their
   * place. A soft navigation re-renders the server component and reconciles it, so the sheet stays
   * open and its state survives — which is the behaviour the brief asks for.
   */
  const languageHref = (() => {
    const params = new URLSearchParams();
    params.set("lang", isArabic ? "en" : "ar");
    if (searchParams.rsvp) params.set("rsvp", searchParams.rsvp);
    if (searchParams.schedule) params.set("schedule", searchParams.schedule);
    return `/i/${token}?${params.toString()}`;
  })();

  return (
    <WaxSeal
      guestName={invitation.guestName}
      monogram={event.monogramText}
      coupleNames={{ groom: groom ?? null, bride: bride ?? null }}
      palette={design.palette}
      locale={language}
      animation={invitation.animation}
      labels={base.seal}
      sessionKey={`velora-seal-${token.slice(0, 12)}`}
      sealImprint={template?.seal.imprint}
      envelopeColor={template ? (template.envelope.paper === "emerald" ? template.palette.emerald : undefined) : undefined}
      sealColor={template ? (template.palette as unknown as Record<string, string>)[
        template.seal.wax === "burgundy" ? "burgundy" : template.seal.wax === "emerald" ? "emerald" : "gold"
      ] : undefined}
      liner={template?.envelope.liner}
    >
      <main
        className="vi"
        lang={language}
        dir={isArabic ? "rtl" : "ltr"}
      >
        <header className="vi-hero">
          {/* The language switch: a link, so nothing is translated on the client and the sheet below
              survives the soft navigation. Inside the hero, because it belongs to the hero's own
              background — outside it, the paper shows a strip above the gradient that reads as the
              top edge of a card. */}
          <nav className="vi-langrow" aria-label={base.language.label}>
            <Link className="vi-lang" href={languageHref} hrefLang={isArabic ? "en" : "ar"} scroll={false}>
              {isArabic ? "English" : "العربية"}
            </Link>
          </nav>

          <p className="vi-kicker">{isArabic ? "دعوة زفاف" : "A wedding invitation"}</p>
          <p className="vi-greeting">{text("greeting")}</p>

          <div className="vi-arch">
            <MihrabArch />
            <h1 className="vi-names">
              <span className="vi-names__name">{groom}</span>
              <span className="vi-names__amp" aria-hidden="true">
                {isArabic ? "و" : "&"}
              </span>
              <span className="vi-names__name">{bride}</span>
            </h1>
          </div>

          <p className="vi-lead">{text("opening")}</p>
          <p className="vi-body">{text("body")}</p>
          <p className="vi-date">{dateLabel}</p>
          {invitation.personalLine ? <p className="vi-personal">{invitation.personalLine}</p> : null}

          <div className="vi-zel" aria-hidden="true" />

          {copy.verse && copy.verse.trim() ? (
            <p className="vi-verse">{renderTemplate(copy.verse, variables)}</p>
          ) : null}
        </header>

        <section className="vi-band vi-band--top" aria-labelledby="vi-countdown-title">
          <h2 className="vi-band__title" id="vi-countdown-title">
            {isArabic ? "العدّ التنازلي" : "The countdown"}
          </h2>
          <p className="vi-band__sub">
            {isArabic ? "حتى اليوم الذي نفرح فيه معاً" : "Until the day we celebrate together"}
          </p>
          <Countdown
            targetIso={event.eventDatetime.toISOString()}
            initial={initial}
            labels={base.countdown}
            finishedMessage={base.countdownFinished}
          />
        </section>

        <p className="vi-when">{text("datetimeLine")}</p>

        {shown.length > 0 ? (
          <section className="vi-programme" aria-labelledby="vi-programme-title">
            <h2 className="vi-section-title" id="vi-programme-title">
              {base.details.schedule}
            </h2>
            <ol className="timeline vi-tl">
              {shown.map((item, index) => {
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
            {hiddenByFilter > 0 ? (
              <p className="vi-more">
                <a className="vi-more__link" href={question(showAllSchedule ? "back" : "all")}>
                  {showAllSchedule ? base.schedule.onlyMine : base.schedule.showAll(hiddenByFilter)}
                </a>
              </p>
            ) : null}
          </section>
        ) : null}

        {/* Both halls, always, with the guest's own marked. */}
        <VenuesSection
          venues={venueCards}
          variant={iconVariantFor(design)}
          labels={{ ...base.venues, venueOne: base.venues.venueOne }}
          accent={design.palette.accent}
          languageHref={languageHref}
          languageLabel={isArabic ? "English" : "العربية"}
        />

        {/* Adding it to a calendar belongs with the halls: the calendar entry carries the address,
            and a guest who has just read the address is the one who wants it. Both routes are the v1
            ones — the .ics the server builds, and the Google link it builds from the same data. */}
        <div className="vi-actions">
          <a className="vi-btn vi-btn--fill" href={`/i/${token}/calendar`}>
            {base.calendar.ics}
          </a>
          <a className="vi-btn" href={googleUrl} rel="noreferrer noopener" target="_blank">
            {base.calendar.google}
          </a>
        </div>

        {/* The RSVP band. The endpoint, the validation, the rate limit and the companion limit are
            the v1 ones and are not touched by this order; only the surface is. */}
        <section className="vi-band vi-band--rsvp" aria-labelledby="vi-rsvp-title">
          <h2 className="vi-band__title" id="vi-rsvp-title">
            {base.rsvp.title}
          </h2>

          {answerFromUrl === "bad_response" ||
          answerFromUrl === "too_many_companions" ||
          answerFromUrl === "invalid_token" ||
          answerFromUrl === "rate_limited" ? (
            <p role="alert" className="vi-error">
              {base.rsvp.errors[answerFromUrl]}
            </p>
          ) : null}

          {answered && answerFromUrl !== "update" ? (
            <div className="vi-form">
              <p className="vi-thanks">{thankYouFor(answered)}</p>
              <p className="vi-band__sub">
                {fill(base.rsvp.current, { answer: base.rsvp.answers[answered] })}
              </p>
              <div className="vi-actions">
                <a className="vi-btn" href={question("update")}>
                  {base.rsvp.update}
                </a>
              </div>
            </div>
          ) : (
            <form action={submitRsvpAction} className="vi-form">
              <p className="vi-band__sub">{text("beforeRsvp")}</p>
              <input type="hidden" name="token" value={token} />
              {language !== invitation.language ? <input type="hidden" name="lang" value={language} /> : null}

              <label className="vi-opt">
                <input type="radio" name="response" value="confirmed" required defaultChecked={answered !== "declined"} />
                {/* The guest's own grammar, taken from their row. */}
                <span>{renderTemplate(confirmLabel(copy as never, invitation.gender), variables)}</span>
              </label>
              <label className="vi-opt">
                <input type="radio" name="response" value="declined" defaultChecked={answered === "declined"} />
                <span>{text("declineButton")}</span>
              </label>

              {rsvp && rsvp.maxCompanions > 0 ? (
                <label className="vi-form">
                  <span>
                    {base.rsvp.companions}{" "}
                    <span className="vi-band__sub">
                      ({fill(base.rsvp.companionHint, { max: rsvp.maxCompanions })})
                    </span>
                  </span>
                  <select name="companions" defaultValue={String(rsvp.companions)} className="vi-select">
                    {Array.from({ length: rsvp.maxCompanions + 1 }, (_, n) => (
                      <option key={n} value={n}>
                        {String(n)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="vi-actions">
                <button type="submit" className="vi-btn vi-btn--fill">
                  {answered ? base.rsvp.update : base.rsvp.submit}
                </button>
              </div>
            </form>
          )}
        </section>

        <p className="vi-note">{base.privacy}</p>

        <footer className="vi-footer">
          <span className="vi-footer__tagline">{isArabic ? "فنّ الدعوة" : "The Art of Inviting"}</span>
          <p className="vi-footer__line">{base.footer.withLove}</p>
          <p className="vi-footer__line">{base.footer.brand}</p>
        </footer>
      </main>
    </WaxSeal>
  );
}
