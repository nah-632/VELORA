import { z } from "zod";

/**
 * The content of an invitation: what it says, with nothing about how it looks.
 *
 * The brief requires content to be separable from its visual rendering, and lists the fields a
 * customer must be able to fill in. This module is the single definition of that content, used by
 * the editor, by validation, and — through the same schema — by the database's JSON column when
 * it is parsed back out.
 *
 * Two rules of thumb encoded here:
 *   * **Nothing is coerced silently.** A half-typed date is invalid, not "close enough"; the
 *     editor shows an error rather than saving something the customer did not mean.
 *   * **Optional means optional.** Venue address, map link, verse and notes may be empty, and the
 *     renderer must cope with each being absent — a preview that breaks on an empty optional
 *     field is a preview that breaks for most customers.
 */

/** Bahraini mobile numbers arrive as `3xxx xxxx`, `+973 3xxx xxxx`, or with an 00973 prefix. */
const PHONE_DIGITS = /^\+[1-9][0-9]{7,14}$/;

/**
 * The **storage** shape.
 *
 * Deliberately permissive about format, and this is the important part: a draft is a document
 * being written. If storing one required a valid date, a customer who has typed their names and
 * not yet chosen a date could not save at all — which is precisely when autosave matters most.
 *
 * So this schema bounds each field's *length* and nothing else. Whether the values are good
 * enough to **order** is a separate question, answered by `validateContent` below. The database
 * stores what the customer has typed; the order flow demands that it is valid.
 */
export const InvitationContentSchema = z.object({
  brideName: z.string().max(80).default(""),
  groomName: z.string().max(80).default(""),

  /** ISO calendar date, `YYYY-MM-DD`. Stored as text so no timezone can shift it by a day. */
  weddingDate: z.string().max(32).default(""),

  /** Optional: not every invitation carries a Hijri date, and it is the customer's to supply. */
  hijriDate: z.string().max(40).default(""),

  /** 24-hour `HH:MM`. */
  weddingTime: z.string().max(16).default(""),

  venueName: z.string().max(120).default(""),
  venueAddress: z.string().max(240).default(""),
  mapUrl: z.string().max(500).default(""),

  message: z.string().max(600).default(""),
  verse: z.string().max(600).default(""),
  notes: z.string().max(600).default(""),

  /**
   * Photographs are storage paths, never URLs the customer typed, and never binaries in the JSON.
   * The upload path itself arrives with the file-storage work; the field exists so the shape does
   * not change when it does.
   */
  photographs: z.array(z.string().max(300)).max(6).default([]),
});

export type InvitationContent = z.infer<typeof InvitationContentSchema>;

/** The subset a customer must supply before an invitation can be ordered. */
export const REQUIRED_FIELDS = ["brideName", "groomName", "weddingDate", "venueName"] as const;

export type RequiredField = (typeof REQUIRED_FIELDS)[number];

export const EMPTY_CONTENT: InvitationContent = {
  brideName: "",
  groomName: "",
  weddingDate: "",
  hijriDate: "",
  weddingTime: "",
  venueName: "",
  venueAddress: "",
  mapUrl: "",
  message: "",
  verse: "",
  notes: "",
  photographs: [],
};

export interface FieldIssue {
  field: keyof InvitationContent;
  /** Message key suffix, so the interface can say this in the customer's language. */
  reason: "required" | "date" | "time" | "url" | "tooLong";
}

/**
 * Validates editor content and returns per-field issues rather than throwing.
 *
 * A form that has been half filled in is the normal case, not an error: the caller needs to know
 * *which* fields are wrong so it can mark them, and it needs that without a try/catch around every
 * keystroke.
 */
export function validateContent(content: InvitationContent): FieldIssue[] {
  const issues: FieldIssue[] = [];

  for (const field of REQUIRED_FIELDS) {
    const value = content[field];
    if (typeof value === "string" && value.trim() === "") {
      issues.push({ field, reason: "required" });
    }
  }

  if (content.weddingDate && !isRealDate(content.weddingDate)) {
    issues.push({ field: "weddingDate", reason: "date" });
  }

  if (content.weddingTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(content.weddingTime)) {
    issues.push({ field: "weddingTime", reason: "time" });
  }

  if (content.mapUrl && !isHttpUrl(content.mapUrl)) {
    issues.push({ field: "mapUrl", reason: "url" });
  }

  return issues;
}

/** True when the invitation has everything it needs to be ordered. */
export function isComplete(content: InvitationContent): boolean {
  return validateContent(content).length === 0;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * True only for a date that exists.
 *
 * `Date.parse("2027-02-31")` does **not** reject the 31st of February — it rolls over to the 3rd
 * of March and returns a perfectly valid timestamp. A customer who mistyped a day would have been
 * shown a different date than they entered, silently. So the parsed components are compared back
 * against what was written.
 */
export function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Normalises a Bahraini phone number to E.164, or returns null.
 *
 * Not used by the invitation itself yet — it exists because the same numbers will be collected at
 * checkout, and a number stored four different ways is a number nobody can dial.
 */
export function normaliseBahrainPhone(input: string): string | null {
  const compact = input.replace(/[\s()-]/g, "");
  const withCountry = compact.startsWith("00973")
    ? `+973${compact.slice(5)}`
    : compact.startsWith("973")
      ? `+${compact}`
      : compact.startsWith("+")
        ? compact
        : `+973${compact}`;
  return PHONE_DIGITS.test(withCountry) ? withCountry : null;
}

/** Parses stored content, filling optional fields rather than failing the whole invitation. */
export function parseContent(value: unknown): InvitationContent {
  const result = InvitationContentSchema.safeParse(value ?? {});
  if (result.success) return result.data;
  // A stored draft that predates a new optional field still opens: the known fields survive and
  // the rest fall back to their defaults.
  const partial = InvitationContentSchema.partial().safeParse(value ?? {});
  return { ...EMPTY_CONTENT, ...(partial.success ? partial.data : {}) };
}
