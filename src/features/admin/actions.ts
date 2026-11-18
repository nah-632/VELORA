"use server";

/**
 * Admin server actions.
 *
 * Two rules hold here and neither is negotiable:
 *
 *   1. **The session is created server-side only.** The cookie is written by `createSession` after
 *      a password *and, when enrolled, a code* have been verified; nothing the browser sends can
 *      create one.
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
import { getSql } from "@/lib/db";
import { hashPassword, hashIp, passwordPolicyError, verifyPassword } from "./credentials";
import { authenticate, normalizeEmail } from "./login";
import {
  assertSameOrigin,
  createSession,
  currentSessionToken,
  destroyCurrentSession,
  getCurrentAdmin,
  pruneExpiredSessions,
  requestIp,
  requireAdmin,
} from "./sessions";
import {
  clearLoginChallenge,
  confirmTotpEnrolment,
  consumeLoginChallenge,
  createLoginChallenge,
  disableTotp,
  MAX_TOTP_ATTEMPTS,
  pruneExpiredChallenges,
  readLoginChallenge,
  recordChallengeAttempt,
  startTotpEnrolment,
  totpState,
  verifyLoginCode,
} from "./totp";

const LoginSchema = z.object({
  email: z.string().min(3).max(200),
  password: z.string().min(1).max(200),
  locale: z.string().refine(isLocale, "unknown locale"),
});

function localeFrom(formData: FormData): string {
  const raw = formData.get("locale");
  return isLocale(raw) ? raw : "ar";
}

export async function loginAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    locale: formData.get("locale"),
  });

  if (!parsed.success) redirect(`/${locale}/admin/login?error=invalid`);
  if (!assertSameOrigin()) redirect(`/${locale}/admin/login?error=invalid`);

  const ipHash = hashIp(requestIp(), serverEnv().SESSION_SECRET);
  const outcome = await authenticate({
    email: normalizeEmail(parsed.data.email),
    password: parsed.data.password,
    ipHash,
  });

  if (!outcome.ok) redirect(`/${locale}/admin/login?error=${outcome.reason}`);

  const state = await totpState(outcome.userId);
  if (state.enrolled) {
    // The password was right; the session does not exist yet. Five minutes to produce a code.
    await createLoginChallenge(outcome.userId);
    await pruneExpiredChallenges();
    redirect(`/${locale}/admin/totp`);
  }

  await createSession(outcome.userId);
  await pruneExpiredSessions();
  revalidatePath(`/${locale}/admin`);
  redirect(`/${locale}/admin`);
}

export async function verifyTotpAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const challenge = await readLoginChallenge();
  // No challenge, or an expired one: back to the password, with no hint about which it was.
  if (!challenge) redirect(`/${locale}/admin/login?error=invalid`);
  if (!assertSameOrigin()) redirect(`/${locale}/admin/totp?error=invalid`);

  const code = String(formData.get("code") ?? "");
  if (await verifyLoginCode(challenge.userId, code)) {
    await consumeLoginChallenge(challenge.id);
    await createSession(challenge.userId);
    await pruneExpiredSessions();
    revalidatePath(`/${locale}/admin`);
    redirect(`/${locale}/admin`);
  }

  const attempts = await recordChallengeAttempt(challenge.id);
  if (attempts >= MAX_TOTP_ATTEMPTS) {
    // The challenge is spent. A fresh password login is required, which is the point: five wrong
    // codes should not leave a half-open door standing for five minutes.
    await clearLoginChallenge();
    redirect(`/${locale}/admin/login?error=invalid`);
  }
  redirect(`/${locale}/admin/totp?error=code`);
}

export async function logoutAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  if (assertSameOrigin()) await destroyCurrentSession();
  redirect(`/${locale}/admin/login`);
}

// ---------------------------------------------------------------------------------------------
// Settings: the password, and the second factor
// ---------------------------------------------------------------------------------------------

const ChangePasswordSchema = z.object({
  current_password: z.string().min(1).max(200),
  new_password: z.string().min(1).max(200),
  confirm_password: z.string().min(1).max(200),
  locale: z.string(),
});

/** Verifies the current password against what is stored. Used by two actions, so it lives once. */
async function verifyCurrentPassword(userId: string, password: string): Promise<boolean> {
  const rows = await getSql()<{ password_hash: string }[]>`
    select password_hash from public.admin_users where id = ${userId} limit 1`;
  const hash = rows[0]?.password_hash;
  return hash ? verifyPassword(hash, password) : false;
}

export async function changePasswordAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const admin = await requireAdmin(locale);
  if (!assertSameOrigin()) redirect(`/${locale}/admin/settings?error=origin`);

  const parsed = ChangePasswordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) redirect(`/${locale}/admin/settings?error=invalid`);

  if (parsed.data.new_password !== parsed.data.confirm_password) {
    redirect(`/${locale}/admin/settings?error=mismatch`);
  }
  if (!(await verifyCurrentPassword(admin.id, parsed.data.current_password))) {
    redirect(`/${locale}/admin/settings?error=current`);
  }
  const policyError = passwordPolicyError(parsed.data.new_password, admin.email);
  if (policyError) {
    redirect(`/${locale}/admin/settings?error=${encodeURIComponent(policyError)}`);
  }

  const hash = await hashPassword(parsed.data.new_password);
  await getSql()`
    update public.admin_users
       set password_hash = ${hash}, password_changed_at = now(),
           failed_attempts = 0, locked_until = null
     where id = ${admin.id}`;

  /**
   * Every session except this one is revoked.
   *
   * Changing a password is what somebody does when they believe it may be known to another person.
   * Leaving that person's session alive would make the change theatre — this is the part that
   * actually evicts them. The current session survives so the operator is not signed out of the tab
   * they are standing in.
   */
  const currentToken = currentSessionToken();
  if (currentToken) {
    await getSql()`
      update public.admin_sessions set revoked_at = now()
       where user_id = ${admin.id} and revoked_at is null and token_hash <> ${currentToken}`;
  } else {
    // No cookie to spare: revoke everything rather than leave a session standing on a guess.
    await getSql()`
      update public.admin_sessions set revoked_at = now()
       where user_id = ${admin.id} and revoked_at is null`;
  }

  revalidatePath(`/${locale}/admin/settings`);
  redirect(`/${locale}/admin/settings?changed=1`);
}

export async function startTotpAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const admin = await requireAdmin(locale);
  if (!assertSameOrigin()) redirect(`/${locale}/admin/settings?error=origin`);
  await startTotpEnrolment(admin.id, admin.email);
  revalidatePath(`/${locale}/admin/settings`);
  redirect(`/${locale}/admin/settings?enrolling=1`);
}

export async function confirmTotpAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const admin = await requireAdmin(locale);
  if (!assertSameOrigin()) redirect(`/${locale}/admin/settings?error=origin`);

  const result = await confirmTotpEnrolment(admin.id, String(formData.get("code") ?? ""));
  if (!result.ok) redirect(`/${locale}/admin/settings?enrolling=1&error=totp`);

  revalidatePath(`/${locale}/admin/settings`);
  redirect(`/${locale}/admin/settings?totp=on`);
}

export async function disableTotpAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const admin = await requireAdmin(locale);
  if (!assertSameOrigin()) redirect(`/${locale}/admin/settings?error=origin`);

  // Turning the second factor off requires the password. Otherwise a borrowed unlocked browser is
  // enough to remove the thing that was protecting it.
  if (!(await verifyCurrentPassword(admin.id, String(formData.get("password") ?? "")))) {
    redirect(`/${locale}/admin/settings?error=current`);
  }
  await disableTotp(admin.id);
  revalidatePath(`/${locale}/admin/settings`);
  redirect(`/${locale}/admin/settings?totp=off`);
}

/** Used by the settings page to show whether the session in front of it is the only one. */
export async function activeSessionCount(): Promise<number> {
  const admin = await getCurrentAdmin();
  if (!admin) return 0;
  const rows = await getSql()<{ n: number }[]>`
    select count(*)::int as n from public.admin_sessions
     where user_id = ${admin.id} and revoked_at is null and expires_at > now()`;
  return rows[0]?.n ?? 0;
}
