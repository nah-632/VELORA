"use server";

/**
 * Admin server actions.
 *
 * Two rules hold here and neither is negotiable:
 *
 *   1. **The session is created server-side only.** The cookie is written by `createSession` after
 *      a password has been verified; nothing the browser sends can create one.
 *   2. **Every failure looks the same from outside.** A wrong password, an unknown email and a
 *      malformed body all end at the same place, so the login form cannot be used to find out which
 *      addresses exist.
 *
 * The origin check is on every state-changing action, in addition to `sameSite: strict` on the
 * cookie, because the cookie attribute is the browser's promise and this check is ours.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { serverEnv } from "@/lib/env";
import { isLocale } from "@/i18n/routing";
import { hashIp } from "./credentials";
import { authenticate, normalizeEmail } from "./login";
import {
  assertSameOrigin,
  createSession,
  destroyCurrentSession,
  pruneExpiredSessions,
  requestIp,
} from "./sessions";

const LoginSchema = z.object({
  email: z.string().min(3).max(200),
  password: z.string().min(1).max(200),
  locale: z.string().refine(isLocale, "unknown locale"),
});

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    locale: formData.get("locale"),
  });

  // The locale is needed for the redirect even when the body is rejected, so it is recovered
  // separately rather than taken from the failed parse.
  const rawLocale = formData.get("locale");
  const locale = isLocale(rawLocale) ? rawLocale : "ar";

  if (!parsed.success) redirect(`/${locale}/admin/login?error=invalid`);
  if (!assertSameOrigin()) redirect(`/${locale}/admin/login?error=invalid`);

  const ipHash = hashIp(requestIp(), serverEnv().SESSION_SECRET);
  const outcome = await authenticate({
    email: normalizeEmail(parsed.data.email),
    password: parsed.data.password,
    ipHash,
  });

  if (!outcome.ok) redirect(`/${locale}/admin/login?error=${outcome.reason}`);

  await createSession(outcome.userId);
  await pruneExpiredSessions();
  revalidatePath(`/${locale}/admin`);
  redirect(`/${locale}/admin`);
}

export async function logoutAction(formData: FormData): Promise<void> {
  const rawLocale = formData.get("locale");
  const locale = isLocale(rawLocale) ? rawLocale : "ar";
  if (assertSameOrigin()) await destroyCurrentSession();
  redirect(`/${locale}/admin/login`);
}
