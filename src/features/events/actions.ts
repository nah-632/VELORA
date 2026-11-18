"use server";

/**
 * Event server actions.
 *
 * Every one of them starts with `requireAdmin` and an origin check. That is the whole authorization
 * story for this application now that RLS is gone (AD-13): there is no second enforcement point, so
 * a missing guard here is a hole, not a defence-in-depth detail.
 */
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { isLocale } from "@/i18n/routing";
import { assertSameOrigin, requireAdmin } from "@/features/admin/sessions";
import {
  EventInputSchema,
  buildEventSlug,
  eventReadiness,
  type EventInput,
} from "./schema";
import { createEvent, getEvent, updateEvent } from "./queries";

/** Reads the flat form into the event shape, so the two actions cannot drift apart. */
function readEventForm(formData: FormData): Record<string, unknown> {
  const keys = [
    "bride_name_ar", "bride_name_en", "groom_name_ar", "groom_name_en",
    "event_datetime", "timezone", "hijri_date_text",
    "venue_name_ar", "venue_name_en", "venue_map_url",
    "quote_ar", "quote_en", "notes_ar", "notes_en",
    "dress_code_ar", "dress_code_en",
    "thank_you_confirmed_ar", "thank_you_confirmed_en",
    "thank_you_declined_ar", "thank_you_declined_en",
    "template_id", "monogram_text", "status",
  ];
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = formData.get(key);
    out[key] = typeof value === "string" ? value : undefined;
  }
  // An empty select is "no template", not the string "".
  if (!out.template_id) out.template_id = null;
  return out;
}

export async function createEventAction(formData: FormData): Promise<void> {
  const rawLocale = formData.get("locale");
  const locale = isLocale(rawLocale) ? rawLocale : "ar";
  await requireAdmin(locale);
  if (!assertSameOrigin()) redirect(`/${locale}/admin/events?error=origin`);

  const parsed = EventInputSchema.safeParse(readEventForm(formData));
  if (!parsed.success) {
    redirect(`/${locale}/admin/events?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "invalid")}`);
  }

  const slug = buildEventSlug({
    groomNameEn: parsed.data.groom_name_en,
    brideNameEn: parsed.data.bride_name_en,
    random: () => randomBytes(8).toString("hex"),
  });

  const id = await createEvent(parsed.data as EventInput, slug);
  revalidatePath(`/${locale}/admin/events`);
  redirect(`/${locale}/admin/events/${id}`);
}

export async function updateEventAction(formData: FormData): Promise<void> {
  const rawLocale = formData.get("locale");
  const locale = isLocale(rawLocale) ? rawLocale : "ar";
  const id = String(formData.get("event_id") ?? "");
  await requireAdmin(locale);
  if (!assertSameOrigin()) redirect(`/${locale}/admin/events/${id}?error=origin`);

  const parsed = EventInputSchema.safeParse(readEventForm(formData));
  if (!parsed.success) {
    redirect(`/${locale}/admin/events/${id}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "invalid")}`);
  }

  await updateEvent(id, parsed.data as EventInput);

  // Readiness is recomputed after the write, from what is actually stored, and the page is told
  // exactly which fields are still missing — "saved" and "ready to send" are different answers.
  const saved = await getEvent(id);
  const readiness = saved
    ? eventReadiness({
        bride_name_ar: saved.bride_name_ar,
        bride_name_en: saved.bride_name_en,
        groom_name_ar: saved.groom_name_ar,
        groom_name_en: saved.groom_name_en,
        event_datetime: saved.event_datetime,
        venue_name_ar: saved.venue_name_ar,
        venue_name_en: saved.venue_name_en,
        template_id: saved.template_id,
      })
    : { ready: false, missing: ["unknown"] };

  revalidatePath(`/${locale}/admin/events/${id}`);
  redirect(
    `/${locale}/admin/events/${id}?saved=1${readiness.ready ? "" : `&missing=${readiness.missing.join(",")}`}`,
  );
}
