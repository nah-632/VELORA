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
  venue_map_url: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || /^https?:\/\//.test(value), "Use a link starting with https://")
    .nullable()
    .optional(),
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
  template_id: z.string().uuid().nullable().optional(),
  monogram_text: optionalText(12),
  status: z.enum(EVENT_STATUSES).default("draft"),
});

export type EventInput = z.infer<typeof EventInputSchema>;

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
export function eventReadiness(fields: {
  bride_name_ar: string | null;
  bride_name_en: string | null;
  groom_name_ar: string | null;
  groom_name_en: string | null;
  event_datetime: string | Date | null;
  venue_name_ar: string | null;
  venue_name_en: string | null;
  template_id: string | null;
}): { ready: boolean; missing: string[] } {
  const missing: string[] = [];

  const hasArabicNames = Boolean(fields.bride_name_ar && fields.groom_name_ar);
  const hasLatinNames = Boolean(fields.bride_name_en && fields.groom_name_en);
  if (!hasArabicNames && !hasLatinNames) missing.push("coupleNames");

  if (!fields.event_datetime) missing.push("date");
  if (!fields.venue_name_ar && !fields.venue_name_en) missing.push("venue");
  if (!fields.template_id) missing.push("template");

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
