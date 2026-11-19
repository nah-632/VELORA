/**
 * What an event is, and when it is ready to be sent.
 *
 * Two different questions, deliberately separated — a lesson this project already paid for once. A
 * half-filled event must be **saveable**: the operator writes what the couple sent on WhatsApp,
 * which arrives in pieces over days. But a half-filled event must not be **sendable**, because a
 * guest who opens an invitation with no date and no venue has been sent a mistake.
 *
 * So the storage schema is permissive and `eventReadiness()` answers the second question, naming
 * every missing piece at once rather than one per attempt.
 */
import { z } from "zod";

import { classifyMapUrl } from "@/lib/maps";

const trimmed = (max: number) =>
  z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length <= max, `Use at most ${max} characters.`);

/** Empty strings from an HTML form are absent values, not empty ones. */
const optionalText = (max: number) =>
  trimmed(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional();

export const EVENT_STATUSES = ["draft", "active", "ended"] as const;

/**
 * One line of the evening.
 *
 * A time, a title, and an optional detail, in both languages. `time` is free text because a wedding
 * programme says things like "after the zaffa" as often as it says "20:30", and forcing a time input
 * would make the operator lie to the form.
 */
export const ScheduleItemSchema = z.object({
  time: trimmed(40).default(""),
  title_ar: optionalText(80),
  title_en: optionalText(80),
  detail_ar: optionalText(200),
  detail_en: optionalText(200),
});

export const ScheduleSchema = z.array(ScheduleItemSchema).max(20);

export const EventInputSchema = z.object({
  bride_name_ar: optionalText(120),
  bride_name_en: optionalText(120),
  groom_name_ar: optionalText(120),
  groom_name_en: optionalText(120),
  event_datetime: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || !Number.isNaN(Date.parse(value)),
      "Use a real date and time.",
    ),
  timezone: z.string().trim().min(1).max(64).default("Asia/Bahrain"),
  hijri_date_text: optionalText(120),
  venue_name_ar: optionalText(200),
  venue_name_en: optionalText(200),
  // Validated by `classifyMapUrl`, which refuses `javascript:` and `data:` outright. This value
  // came from a text field and ends up inside an anchor's href.
  venue_map_url: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional()
    .refine(
      (value) => value === null || value === undefined || classifyMapUrl(value).ok,
      "Use a Google Maps or Apple Maps link starting with https://",
    ),
  quote_ar: optionalText(400),
  quote_en: optionalText(400),
  notes_ar: optionalText(600),
  notes_en: optionalText(600),
  dress_code_ar: optionalText(120),
  dress_code_en: optionalText(120),
  thank_you_confirmed_ar: optionalText(400),
  thank_you_confirmed_en: optionalText(400),
  thank_you_declined_ar: optionalText(400),
  thank_you_declined_en: optionalText(400),
  venue_address_ar: optionalText(300),
  venue_address_en: optionalText(300),
  parking_ar: optionalText(300),
  parking_en: optionalText(300),
  entrance_ar: optionalText(300),
  entrance_en: optionalText(300),
  sections_ar: optionalText(300),
  sections_en: optionalText(300),
  schedule: ScheduleSchema.default([]),
  template_id: z.string().uuid().nullable().optional(),
  monogram_text: optionalText(12),
  status: z.enum(EVENT_STATUSES).default("draft"),
});

export type EventInput = z.infer<typeof EventInputSchema>;

export type ScheduleItem = z.infer<typeof ScheduleItemSchema>;

export interface EventRecord {
  id: string;
  slug: string;
  status: (typeof EVENT_STATUSES)[number];
  event_datetime: Date;
  timezone: string;
}

/**
 * Never sent a reminder for an answer that cannot arrive.
 *
 * Returns the *names* of what is missing so the console can point at the fields rather than say
 * "incomplete".
 */
export interface ReadinessFields {
  bride_name_ar: string | null;
  bride_name_en: string | null;
  groom_name_ar: string | null;
  groom_name_en: string | null;
  event_datetime: string | Date | null;
  venue_name_ar: string | null;
  venue_name_en: string | null;
  venue_address_ar?: string | null;
  venue_address_en?: string | null;
  venue_map_url?: string | null;
  notes_ar?: string | null;
  notes_en?: string | null;
  dress_code_ar?: string | null;
  dress_code_en?: string | null;
  parking_ar?: string | null;
  parking_en?: string | null;
  sections_ar?: string | null;
  sections_en?: string | null;
  schedule?: unknown[] | null;
  template_id: string | null;
}

export type ChecklistItem = {
  key: string;
  /** Required to send at all, versus worth having. The editor shows both, differently. */
  required: boolean;
  done: boolean;
};

/**
 * What is missing before the links go out.
 *
 * Two tiers on purpose. Without a date, a venue and a design there is no invitation to send; without
 * a dress code or a schedule there is one that is merely thinner. Treating them alike would either
 * block a send over a parking note or let a dateless invitation through, and both of those are worse
 * than a list that says which is which.
 *
 * A field counts as done if **either** language is filled. The operator is holding two versions and
 * the guest reads one; an Arabic-only dress code is not a missing dress code.
 */
export function eventChecklist(fields: ReadinessFields): ChecklistItem[] {
  const any = (...values: (string | null | undefined)[]) => values.some((value) => Boolean(value && value.trim()));

  return [
    { key: "coupleNames", required: true, done: (Boolean(fields.bride_name_ar) && Boolean(fields.groom_name_ar)) || (Boolean(fields.bride_name_en) && Boolean(fields.groom_name_en)) },
    { key: "date", required: true, done: Boolean(fields.event_datetime) },
    { key: "venue", required: true, done: any(fields.venue_name_ar, fields.venue_name_en) },
    { key: "template", required: true, done: Boolean(fields.template_id) },
    { key: "address", required: false, done: any(fields.venue_address_ar, fields.venue_address_en) },
    { key: "map", required: false, done: Boolean(fields.venue_map_url) },
    { key: "notes", required: false, done: any(fields.notes_ar, fields.notes_en) },
    { key: "dressCode", required: false, done: any(fields.dress_code_ar, fields.dress_code_en) },
    { key: "parking", required: false, done: any(fields.parking_ar, fields.parking_en) },
    { key: "sections", required: false, done: any(fields.sections_ar, fields.sections_en) },
    { key: "schedule", required: false, done: Array.isArray(fields.schedule) && fields.schedule.length > 0 },
  ];
}

export function eventReadiness(fields: ReadinessFields): { ready: boolean; missing: string[] } {
  const checklist = eventChecklist(fields);
  const missing = checklist.filter((item) => item.required && !item.done).map((item) => item.key);
  return { ready: missing.length === 0, missing };
}

const SLUG_STOPWORDS = /[^a-z0-9]+/g;

/**
 * A URL-safe slug from the couple's Latin names when we have them, otherwise a short random one.
 *
 * Arabic is not transliterated: a machine-transliterated Arabic name is a guess about how somebody
 * spells their own name, and it would be visible in the URL. A random suffix is honest instead.
 */
export function buildEventSlug(input: {
  brideNameEn?: string | null;
  groomNameEn?: string | null;
  random: () => string;
}): string {
  const joined = [input.groomNameEn, input.brideNameEn]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join("-");
  const cleaned = joined
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(SLUG_STOPWORDS, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = input.random().slice(0, 6);
  return cleaned.length >= 3 ? `${cleaned}-${suffix}`.toLowerCase() : `event-${suffix}`.toLowerCase();
}
