"use server";

/**
 * The public RSVP action.
 *
 * Same discipline as the admin actions, for a different stranger: the token identifies the guest, the
 * companion cap comes from the guest's row rather than from the form, and the answer is written
 * server-side. Nothing the browser sends is trusted except which of two buttons was pressed.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { looksLikeToken } from "./public";
import { submitRsvp } from "./rsvp";

export async function submitRsvpAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const response = String(formData.get("response") ?? "");
  const companions = Number(formData.get("companions") ?? 0);

  if (!looksLikeToken(token)) redirect("/i/invalid");

  const outcome = await submitRsvp(token, { response, companions });
  revalidatePath(`/i/${token}`);

  if (!outcome.ok) redirect(`/i/${token}?rsvp=${outcome.reason}`);
  redirect(`/i/${token}?rsvp=${outcome.state.response}`);
}
