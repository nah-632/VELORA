import { NextResponse } from "next/server";

import { buildIcs, eventUid } from "@/features/invitations/ics";
import { loadInvitation } from "@/features/invitations/public";
import { venueForCalendar, venueVariables, venuesForGuest } from "@/features/invitations/venues";
import { LIMITS, clientAddress, consume, requestKey } from "@/features/invitations/rate-limit";

/**
 * The calendar file.
 *
 * A route handler rather than a page: the response is a file, and a page that returns a file is a
 * page whose Content-Type somebody will eventually forget.
 *
 * The guest's name is deliberately **not** in the file. The title is the couple and the place; a
 * forwarded .ics should not carry the name of the person it was sent to. Nor is this an "open":
 * `recordOpen: false`, so downloading the calendar entry does not move the operator's
 * "has not opened it yet" column.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const decision = await consume(requestKey("ics", { token: params.token, address: clientAddress() }), LIMITS.calendar);
  if (!decision.allowed) {
    return new NextResponse("Too many requests", { status: 429, headers: { "Cache-Control": "no-store" } });
  }

  const invitation = await loadInvitation(params.token, { recordOpen: false });
  if (!invitation) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { event, language } = invitation;
  const pick = (ar: string | null, en: string | null) => ((language === "ar" ? ar : en) ?? ar ?? en ?? "").trim();
  // The guest's own hall and its address: somebody who saves this is going to drive to it.
  const view = venuesForGuest(invitation.venues, invitation.audience);
  const calendarVenue = venueForCalendar(view, language);
  const venue = calendarVenue.name || pick(event.venueNameAr, event.venueNameEn);
  const address = calendarVenue.address || pick(event.venueAddressAr, event.venueAddressEn);
  const forGuest = venueVariables(view, language);
  const notes = pick(event.notesAr, event.notesEn);
  const dressCode = pick(event.dressCodeAr, event.dressCodeEn);
  const schedule = (Array.isArray(event.schedule) ? event.schedule : []) as Record<string, string | undefined>[];
  const lineOf = (item: Record<string, string | undefined>, field: "title" | "detail") =>
    ((language === "ar" ? item[`${field}_ar`] : item[`${field}_en`]) ??
      item[`${field}_${language === "ar" ? "en" : "ar"}`] ??
      "").trim();
  const couple =
    language === "ar"
      ? [event.groomNameAr, event.brideNameAr].filter(Boolean).join(" و ")
      : [event.groomNameEn, event.brideNameEn].filter(Boolean).join(" & ");

  const title = language === "ar" ? `زفاف ${couple}` : `Wedding of ${couple}`;
  const verse = language === "ar" ? event.quoteAr : event.quoteEn;

  /**
   * The description carries what a guest needs when they arrive: where it is, the full address, the
   * notes the operator wrote, the dress code, and the running order. The venue and address also go in
   * LOCATION, because that is the field a car's navigation reads.
   */
  const descriptionParts: string[] = [language === "ar" ? "دعوة زفاف" : "A wedding invitation"];
  if (verse) descriptionParts.push(verse);
  if (address) descriptionParts.push(`${language === "ar" ? "العنوان" : "Address"}: ${address}`);
  if (notes) descriptionParts.push(notes);
  if (dressCode) descriptionParts.push(`${language === "ar" ? "الزي" : "Dress code"}: ${dressCode}`);
  // The halls, by name and by link: a guest who forwards this file should be sending the map too.
  if (forGuest.venue_name_for_guest) descriptionParts.push(forGuest.venue_name_for_guest);
  if (forGuest.venue_map_url_for_guest) descriptionParts.push(forGuest.venue_map_url_for_guest);
  const programme = schedule
    .map((item) => {
      const title = lineOf(item, "title");
      if (!title) return null;
      const detail = lineOf(item, "detail");
      return `${item.time ? `${item.time} — ` : ""}${title}${detail ? `: ${detail}` : ""}`;
    })
    .filter((value): value is string => Boolean(value));
  if (programme.length > 0) {
    descriptionParts.push(`${language === "ar" ? "البرنامج" : "Programme"}:\n${programme.join("\n")}`);
  }
  const description = descriptionParts.filter(Boolean).join("\n\n");

  const ics = buildIcs({
    uid: eventUid(params.token, event.eventDatetime),
    start: event.eventDatetime,
    title,
    // LOCATION is what navigation reads, so it carries the address too when there is one.
    location: [venue, address].filter(Boolean).join(", "),
    description,
    timezone: event.timezone || "Asia/Bahrain",
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="velora-invitation.ics"',
      // Private, uncached, and never indexed — the same rules as the page it belongs to.
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
