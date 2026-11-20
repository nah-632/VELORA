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
import { LIMITS, clientAddress, consume, requestKey } from "./rate-limit";
import { submitRsvp } from "./rsvp";

export async function submitRsvpAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  // A guest who switched language should not be switched back by answering.
  const rawLang = String(formData.get("lang") ?? "");
  const lang = rawLang === "en" || rawLang === "ar" ? `&lang=${rawLang}` : "";
  const response = String(formData.get("response") ?? "");
  const companions = Number(formData.get("companions") ?? 0);

  if (!looksLikeToken(token)) redirect("/i/invalid");

  // Two limits, because they defend different things: one bounds a single guest's link being used as
  // a public write endpoint, the other bounds one address doing it across many invitations.
  const address = clientAddress();
  const perGuest = await consume(requestKey("rsvp-guest", { token }), LIMITS.rsvpPerGuest);
  const perAddress = await consume(requestKey("rsvp-address", { address }), LIMITS.rsvpPerAddress);
  if (!perGuest.allowed || !perAddress.allowed) {
    redirect(`/i/${token}?rsvp=rate_limited${lang}`);
  }

  const outcome = await submitRsvp(token, { response, companions });
  revalidatePath(`/i/${token}`);

  if (!outcome.ok) redirect(`/i/${token}?rsvp=${outcome.reason}${lang}`);
  redirect(`/i/${token}?rsvp=${outcome.state.response}${lang}`);
}
