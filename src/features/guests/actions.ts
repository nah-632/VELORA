"use server";

/**
 * Guest server actions: the import, with its preview step, and the small per-guest edits.
 *
 * The import is two actions rather than one on purpose. The brief asks for "a preview step,
 * validation, duplicate detection", and the reason is practical: an operator pasting 50 rows from a
 * spreadsheet wants to see *which* rows could not be read **before** 48 invitations exist. So the
 * first call parses and reports and writes nothing; only the second, on the same text, inserts.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isLocale } from "@/i18n/routing";
import { assertSameOrigin, requireAdmin } from "@/features/admin/sessions";
import { parseGuestList, type ParseResult } from "./import";
import { addGuests, deleteGuest, markGuestsSent, updateGuest } from "./queries";

export interface ImportPreview {
  status: "preview";
  text: string;
  guests: ParseResult["guests"];
  rejected: ParseResult["rejected"];
  duplicates: ParseResult["duplicates"];
  detectedColumns: string[];
}

export interface ImportDone {
  status: "done";
  inserted: number;
}

export async function previewGuestImport(
  _previous: ImportPreview | ImportDone | { status: "error"; message: string } | null,
  formData: FormData,
): Promise<ImportPreview | ImportDone | { status: "error"; message: string }> {
  const rawLocale = formData.get("locale");
  const locale = isLocale(rawLocale) ? rawLocale : "ar";
  await requireAdmin(locale);

  const eventId = String(formData.get("event_id") ?? "");
  const text = String(formData.get("list") ?? "");
  const mode = String(formData.get("mode") ?? "preview");

  if (!eventId) return { status: "error", message: "No event." };
  if (!text.trim()) return { status: "error", message: "Paste a list first." };

  const parsed = parseGuestList(text);

  if (mode !== "commit") {
    return {
      status: "preview",
      text,
      guests: parsed.guests,
      rejected: parsed.rejected,
      duplicates: parsed.duplicates,
      detectedColumns: parsed.detectedColumns,
    };
  }

  if (!assertSameOrigin()) return { status: "error", message: "Rejected: wrong origin." };

  const inserted = await addGuests(eventId, parsed.guests);
  revalidatePath(`/${locale}/admin/events/${eventId}`);
  return { status: "done", inserted };
}

/**
 * "Sent" is recorded after the operator has actually sent it, so it is their click — never a guess
 * based on a WhatsApp link being generated.
 */
export async function markSentAction(formData: FormData): Promise<void> {
  const rawLocale = formData.get("locale");
  const locale = isLocale(rawLocale) ? rawLocale : "ar";
  await requireAdmin(locale);
  if (!assertSameOrigin()) redirect(`/${locale}/admin/events`);

  const eventId = String(formData.get("event_id") ?? "");
  const ids = formData.getAll("guest_id").map(String).filter(Boolean);
  if (ids.length > 0) await markGuestsSent(ids);

  revalidatePath(`/${locale}/admin/events/${eventId}`);
  redirect(`/${locale}/admin/events/${eventId}?sent=${ids.length}`);
}

const GuestEditSchema = z.object({
  guest_id: z.string().min(1),
  event_id: z.string().min(1),
  locale: z.string(),
  category: z.enum(["family", "friends", "work", "other"]).optional(),
  gender: z.enum(["male", "female", "neutral"]).optional(),
  // "derived" is the form's word for "no explicit audience"; the column stays null so the gender
  // keeps deciding if it changes later.
  audience: z.enum(["derived", "women", "men", "both"]).optional(),
  max_companions: z.coerce.number().int().min(0).max(20).optional(),
  personal_line_ar: z.string().max(140).optional(),
  personal_line_en: z.string().max(140).optional(),
});

export async function updateGuestAction(formData: FormData): Promise<void> {
  const parsed = GuestEditSchema.safeParse(Object.fromEntries(formData.entries()));
  const fallbackLocale = isLocale(formData.get("locale")) ? formData.get("locale") : "ar";
  const locale = String(fallbackLocale);
  await requireAdmin(locale);
  if (!parsed.success) {
    redirect(`/${locale}/admin/events/${formData.get("event_id")}?error=guest`);
  }
  if (!assertSameOrigin()) redirect(`/${locale}/admin/events/${parsed.data.event_id}`);

  const blankToNull = (value?: string) => {
    const trimmed = (value ?? "").trim();
    return trimmed.length === 0 ? null : trimmed;
  };

  await updateGuest(parsed.data.guest_id, {
    category: parsed.data.category,
    maxCompanions: parsed.data.max_companions,
    personalLineAr: blankToNull(parsed.data.personal_line_ar),
    personalLineEn: blankToNull(parsed.data.personal_line_en),
    gender: parsed.data.gender,
    audience: parsed.data.audience === "derived" ? null : (parsed.data.audience ?? null),
  });

  revalidatePath(`/${locale}/admin/events/${parsed.data.event_id}`);
  redirect(`/${locale}/admin/events/${parsed.data.event_id}?guest_saved=1`);
}

export async function deleteGuestAction(formData: FormData): Promise<void> {
  const rawLocale = formData.get("locale");
  const locale = isLocale(rawLocale) ? rawLocale : "ar";
  await requireAdmin(locale);
  const eventId = String(formData.get("event_id") ?? "");
  const guestId = String(formData.get("guest_id") ?? "");
  if (guestId && assertSameOrigin()) await deleteGuest(guestId);
  revalidatePath(`/${locale}/admin/events/${eventId}`);
  redirect(`/${locale}/admin/events/${eventId}?guest_deleted=1`);
}
