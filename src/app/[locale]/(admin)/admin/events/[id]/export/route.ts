import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { getCurrentAdmin } from "@/features/admin/sessions";
import { getEvent } from "@/features/events/queries";
import { listGuests } from "@/features/guests/queries";
import { resolveAudience } from "@/features/invitations/messages";

/**
 * The venue list: who is coming, to which hall, and with how many.
 *
 * CSV rather than a real `.xlsx`, and that is a decision rather than a shortcut. What "Excel export"
 * has to achieve is a file the venue's staff can open in Excel and read — and a UTF-8 CSV with a BOM
 * does exactly that, in Excel, in LibreOffice and in Numbers, with the Arabic intact. A produced
 * `.xlsx` would mean a spreadsheet-writing dependency in the server bundle to gain column widths.
 *
 * Three things it deliberately does:
 *
 *   - **A BOM first.** Without it Excel reads a UTF-8 CSV as Latin-1 and every Arabic name arrives as
 *     punctuation soup. This is the single most common way an Arabic export "breaks".
 *   - **Arabic text is quoted and escaped**, so a comma inside a name does not become a column.
 *   - **The personal line is not included.** The operator writes 「إلى عمّنا العزيز」 for one guest; it
 *     is not the venue's business, and the brief says it must not appear in the attendance export
 *     unless deliberately asked for (`?personal=1`).
 *
 * Phone numbers are includable with `?phone=1` — the venue sometimes needs to ring a guest — but are
 * off by default, because a list of phone numbers on a caterer's laptop is a leak waiting to happen.
 */
export const dynamic = "force-dynamic";

/** RFC 4180: quote when the value contains a delimiter, a quote or a newline; double the quotes. */
function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(
  request: Request,
  { params }: { params: { locale: string; id: string } },
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    // A route handler cannot redirect like a page; the console redirects, this refuses.
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const event = await getEvent(params.id);
  if (!event) return new NextResponse("Not found", { status: 404 });

  const url = new URL(request.url);
  const withPhone = url.searchParams.get("phone") === "1";
  const withPersonal = url.searchParams.get("personal") === "1";

  const guests = await listGuests(params.id);
  const t = await getTranslations({ locale: params.locale === "en" ? "en" : "ar", namespace: "admin.export" });

  const header = [
    t("name"),
    t("hall"),
    t("category"),
    t("answer"),
    t("companions"),
    t("seats"),
    ...(withPhone ? [t("phone")] : []),
    ...(withPersonal ? [t("personalLine")] : []),
  ];

  const rows = guests.map((guest: Awaited<ReturnType<typeof listGuests>>[number]) => {
    const audience = resolveAudience((guest.gender as "male" | "female" | "neutral") ?? "neutral", guest.audience);
    const answered = guest.response === "confirmed" || guest.response === "declined" ? guest.response : null;
    const companions = guest.companions_count ?? 0;
    // Seats = the guest plus whoever they are bringing, and only when they are coming.
    const seats = answered === "confirmed" ? 1 + companions : 0;
    return [
      guest.full_name,
      t(`audience.${audience}`),
      guest.category,
      answered ? t(`answers.${answered}`) : t("answers.none"),
      companions,
      seats,
      ...(withPhone ? [guest.phone] : []),
      ...(withPersonal ? [(params.locale === "en" ? guest.personal_line_en : guest.personal_line_ar) ?? ""] : []),
    ];
  });

  const totalSeats = rows.reduce((sum: number, row: (string | number)[]) => sum + Number(row[5] ?? 0), 0);
  const body = [
    header.map(cell).join(","),
    ...rows.map((row: (string | number)[]) => row.map(cell).join(",")),
    "",
    [cell(t("totalSeats")), cell(totalSeats)].join(","),
    [cell(t("totalGuests")), cell(guests.length)].join(","),
  ].join("\r\n");

  // The BOM is what makes Excel read the file as UTF-8. Without it every Arabic name is mojibake.
  const csv = `\uFEFF${body}\r\n`;
  const filename = `velora-${event.slug}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // A guest list is the most sensitive file this product produces. It must not sit in a cache.
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}