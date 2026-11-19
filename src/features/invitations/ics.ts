/**
 * The calendar file, and the Google Calendar link.
 *
 * RFC 5545 is unglamorous and unforgiving: a file that a phone refuses to open looks exactly like a
 * feature that was never built. The three things that actually break a hand-rolled .ics are all
 * handled here, and each one is asserted in `tests/unit/ics.test.mjs`:
 *
 *   1. **Line endings must be CRLF.** A file written with bare `\n` is rejected by Outlook and
 *      ignored by some Android clients.
 *   2. **Long lines must be folded** at 75 octets, with continuation lines starting with a space.
 *      Arabic descriptions are multi-byte, so this is measured in octets, not characters.
 *   3. **Text values must be escaped** — commas, semicolons, backslashes and newlines inside a
 *      SUMMARY or DESCRIPTION will otherwise terminate the property early.
 *
 * Times are emitted in the event's own timezone where that timezone has a fixed offset (Bahrain has
 * had no DST since 1972) and in UTC otherwise. `DTSTART:20270214T183000Z` is unambiguous everywhere,
 * and correct for the tiny minority of clients that ignore VTIMEZONE.
 */
import { DEFAULT_DURATION_MINUTES } from "./countdown";

export interface IcsInput {
  uid: string;
  start: Date;
  end?: Date;
  title: string;
  location?: string | null;
  description?: string | null;
  /** IANA zone name. Only zones with a fixed offset are rendered as local time. */
  timezone: string;
  organizer?: { name: string; email?: string };
  now?: Date;
}

/** Zones this file will render as local wall-clock time, with the offset they use. */
const FIXED_OFFSETS: Record<string, { offset: string; tzid: string }> = {
  "Asia/Bahrain": { offset: "+0300", tzid: "Asia/Bahrain" },
  "Asia/Riyadh": { offset: "+0300", tzid: "Asia/Riyadh" },
  "Asia/Kuwait": { offset: "+0300", tzid: "Asia/Kuwait" },
  "Asia/Qatar": { offset: "+0300", tzid: "Asia/Qatar" },
  "Asia/Dubai": { offset: "+0400", tzid: "Asia/Dubai" },
  "Asia/Muscat": { offset: "+0400", tzid: "Asia/Muscat" },
};

function pad(value: number, size = 2): string {
  return String(value).padStart(size, "0");
}

/** `YYYYMMDDTHHMMSSZ` — the UTC form, which every client understands. */
export function toIcsUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** The wall clock in a fixed-offset zone, as `YYYYMMDDTHHMMSS`. */
export function toIcsLocal(date: Date, offset: string): string {
  const sign = offset.startsWith("-") ? -1 : 1;
  const hours = Number(offset.slice(1, 3));
  const minutes = Number(offset.slice(3, 5));
  const shifted = new Date(date.getTime() + sign * (hours * 60 + minutes) * 60_000);
  return (
    `${shifted.getUTCFullYear()}${pad(shifted.getUTCMonth() + 1)}${pad(shifted.getUTCDate())}` +
    `T${pad(shifted.getUTCHours())}${pad(shifted.getUTCMinutes())}${pad(shifted.getUTCSeconds())}`
  );
}

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Folds a content line at 75 octets, counting bytes rather than characters — an Arabic description is
 * three bytes per letter in UTF-8, so a fold that counts characters overflows and the client truncates.
 */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let current = Buffer.alloc(0);
  let index = 0;
  const limitFirst = 75;
  const limitRest = 74; // one byte is spent on the leading space

  while (index < bytes.length) {
    const limit = parts.length === 0 ? limitFirst : limitRest;
    let end = Math.min(index + limit, bytes.length);
    // Never split a UTF-8 sequence: step back while the byte is a continuation byte (10xxxxxx).
    while (end > index && end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end -= 1;
    current = bytes.subarray(index, end);
    parts.push(current.toString("utf8"));
    index = end;
  }

  return parts.map((part, i) => (i === 0 ? part : ` ${part}`)).join("\r\n");
}

function contentLine(name: string, value: string, params?: Record<string, string>): string {
  const paramText = params
    ? Object.entries(params)
        .map(([key, val]) => `;${key}=${/[,;:]/.test(val) ? `"${val}"` : val}`)
        .join("")
    : "";
  return foldLine(`${name}${paramText}:${value}`);
}

/**
 * A VTIMEZONE with a single STANDARD component. Correct for the Gulf, whose zones have not observed
 * daylight saving for decades; a zone with DST is emitted as UTC instead, which is always correct.
 */
function vtimezone(tzid: string, offset: string): string[] {
  return [
    "BEGIN:VTIMEZONE",
    contentLine("TZID", tzid),
    "BEGIN:STANDARD",
    contentLine("DTSTART", "19700101T000000"),
    contentLine("TZOFFSETFROM", offset),
    contentLine("TZOFFSETTO", offset),
    contentLine("TZNAME", tzid),
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
}

export function buildIcs(input: IcsInput): string {
  const end =
    input.end ?? new Date(input.start.getTime() + DEFAULT_DURATION_MINUTES * 60_000);
  const now = input.now ?? new Date();
  const zone = FIXED_OFFSETS[input.timezone];

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    contentLine("VERSION", "2.0"),
    contentLine("PRODID", "-//VELORA//The Art of Inviting//EN"),
    contentLine("CALSCALE", "GREGORIAN"),
    contentLine("METHOD", "PUBLISH"),
    ...(zone ? vtimezone(zone.tzid, zone.offset) : []),
    "BEGIN:VEVENT",
    contentLine("UID", input.uid),
    contentLine("DTSTAMP", toIcsUtc(now)),
  ];

  if (zone) {
    lines.push(
      contentLine("DTSTART", toIcsLocal(input.start, zone.offset), { TZID: zone.tzid }),
      contentLine("DTEND", toIcsLocal(end, zone.offset), { TZID: zone.tzid }),
    );
  } else {
    // No VTIMEZONE for this zone, so the times go out in UTC. An absolute instant is never wrong.
    lines.push(
      contentLine("DTSTART", toIcsUtc(input.start)),
      contentLine("DTEND", toIcsUtc(end)),
    );
  }

  lines.push(contentLine("SUMMARY", escapeIcsText(input.title)));
  if (input.location) lines.push(contentLine("LOCATION", escapeIcsText(input.location)));
  if (input.description) lines.push(contentLine("DESCRIPTION", escapeIcsText(input.description)));
  if (input.organizer) {
    lines.push(
      contentLine(
        "ORGANIZER",
        input.organizer.email ? `mailto:${input.organizer.email}` : "mailto:",
        { CN: input.organizer.name },
      ),
    );
  }
  lines.push("STATUS:CONFIRMED", "SEQUENCE:0", "END:VEVENT", "END:VCALENDAR");

  // RFC 5545 §3.1: CRLF, and a trailing one.
  return `${lines.join("\r\n")}\r\n`;
}

/** The Google Calendar "add event" URL. Google wants UTC instants, which is what this sends. */
export function googleCalendarUrl(input: {
  start: Date;
  end?: Date;
  title: string;
  location?: string | null;
  description?: string | null;
}): string {
  const end = input.end ?? new Date(input.start.getTime() + DEFAULT_DURATION_MINUTES * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${toIcsUtc(input.start)}/${toIcsUtc(end)}`,
  });
  if (input.location) params.set("location", input.location);
  if (input.description) params.set("details", input.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** A stable UID: the same invitation must update the same calendar entry, not add a second one. */
export function eventUid(token: string, start: Date): string {
  return `velora-${token.slice(0, 16)}-${toIcsUtc(start)}@velora.local`;
}
