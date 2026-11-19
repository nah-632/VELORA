import { NextResponse } from "next/server";

import { buildIcs, eventUid } from "@/features/invitations/ics";
import { loadInvitation } from "@/features/invitations/public";

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
  const invitation = await loadInvitation(params.token, { recordOpen: false });
  if (!invitation) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { event, language } = invitation;
  const venue = language === "ar" ? event.venueNameAr : event.venueNameEn;
  const couple =
    language === "ar"
      ? [event.groomNameAr, event.brideNameAr].filter(Boolean).join(" و ")
      : [event.groomNameEn, event.brideNameEn].filter(Boolean).join(" & ");

  const title = language === "ar" ? `زفاف ${couple}` : `Wedding of ${couple}`;
  const verse = language === "ar" ? event.quoteAr : event.quoteEn;
  const description = [language === "ar" ? "دعوة زفاف" : "A wedding invitation", verse]
    .filter(Boolean)
    .join("\n\n");

  const ics = buildIcs({
    uid: eventUid(params.token, event.eventDatetime),
    start: event.eventDatetime,
    title,
    location: venue,
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
