/**
 * The form reader, in its own module so it can be tested.
 *
 * It used to live inside the server-action file, and that is exactly where the bug hid: the list of
 * field names was written by hand, the schema grew a second time, and the reader quietly stopped
 * covering it. Every save then wrote `null` over fields the operator had filled in — the form posted
 * them, the action dropped them, and nothing said a word.
 *
 * `tests/unit/event-details.test.mjs` now asserts that every field the schema knows about is read
 * here. Adding a column and forgetting this list is a failing test rather than a silent data loss.
 */
import { CopyOverridesSchema, ScheduleSchema, VenuesInputSchema, EventInputSchema } from "./schema";
import { ThemeOverrideSchema } from "@/lib/templates/schema";

/**
 * Every field the event form submits, other than `schedule`, which arrives as one JSON value.
 * Kept as one explicit list rather than derived from the schema: deriving it would read fields the
 * form does not have and write `undefined` over stored values.
 */
export const EVENT_FORM_KEYS = [
  "bride_name_ar", "bride_name_en", "groom_name_ar", "groom_name_en",
  "event_datetime", "timezone", "hijri_date_text",
  "venue_name_ar", "venue_name_en", "venue_map_url",
  "venue_address_ar", "venue_address_en",
  "parking_ar", "parking_en",
  "entrance_ar", "entrance_en",
  "sections_ar", "sections_en",
  "quote_ar", "quote_en", "notes_ar", "notes_en",
  "dress_code_ar", "dress_code_en",
  "thank_you_confirmed_ar", "thank_you_confirmed_en",
  "thank_you_declined_ar", "thank_you_declined_en",
  "template_id", "monogram_text", "status",
] as const;

/** Fields the schema has that the form supplies by another route. */
export const SCHEDULE_FIELD = "schedule";

export function readEventForm(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of EVENT_FORM_KEYS) {
    const value = formData.get(key);
    out[key] = typeof value === "string" ? value : undefined;
  }

  // An empty select is "no template", not the string "".
  if (!out.template_id) out.template_id = null;

  // The programme arrives as one hidden JSON field, because it is a list the operator builds rather
  // than a set of inputs. A malformed value is an empty programme, not a crash.
  const raw = formData.get(SCHEDULE_FIELD);
  if (typeof raw === "string" && raw.trim().length > 0) {
    try {
      const parsed = ScheduleSchema.safeParse(JSON.parse(raw));
      out.schedule = parsed.success ? parsed.data : [];
    } catch {
      out.schedule = [];
    }
  } else {
    out.schedule = [];
  }

  // The halls, as one hidden JSON value — the same shape the programme uses, and validated here so a
  // malformed value is a validation failure rather than a broken event.
  const rawVenues = formData.get(VENUES_FIELD);
  if (typeof rawVenues === "string" && rawVenues.trim().length > 0) {
    try {
      const parsed = VenuesInputSchema.safeParse(JSON.parse(rawVenues));
      out.venues = parsed.success ? parsed.data : [];
    } catch {
      out.venues = [];
    }
  }

  // The per-event wording overrides.
  const rawCopy = formData.get(COPY_FIELD);
  if (typeof rawCopy === "string" && rawCopy.trim().length > 0) {
    try {
      const parsed = CopyOverridesSchema.safeParse(JSON.parse(rawCopy));
      out.copy_templates = parsed.success ? parsed.data : {};
    } catch {
      out.copy_templates = {};
    }
  }

  return out;
}

/**
 * The template picker's two values.
 *
 * The slug is checked against the `templates` table by the action; the override is validated here,
 * strictly, so an unknown key is rejected rather than stored and rendered later. The operator may
 * change five palette roles and two display faces — the schema is the boundary that says so.
 */
export function readThemeFields(formData: FormData): { theme_override: unknown } {
  const raw = formData.get("theme_override");
  if (typeof raw !== "string" || raw.trim().length === 0) return { theme_override: {} };
  try {
    const parsed = ThemeOverrideSchema.safeParse(JSON.parse(raw));
    return { theme_override: parsed.success ? parsed.data : {} };
  } catch {
    return { theme_override: {} };
  }
}

export const VENUES_FIELD = "venues";
export const COPY_FIELD = "copy_templates";

/** The schema's field names, for the test that keeps the two lists in step. */
export function schemaFields(): string[] {
  return Object.keys(EventInputSchema.shape);
}
