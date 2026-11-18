import { type Metadata } from "next";
import { getTranslations, unstable_setRequestLocale } from "next-intl/server";

import { Button } from "@/components/ui/Button";
import { Card, SectionHeading, StatePanel } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { isLocale } from "@/i18n/routing";
import { requireAdmin } from "@/features/admin/sessions";
import {
  activeSessionCount,
  changePasswordAction,
  confirmTotpAction,
  disableTotpAction,
  startTotpAction,
} from "@/features/admin/actions";
import { totpState } from "@/features/admin/totp";

/**
 * Settings: the operator's own password, and their second factor.
 *
 * This screen exists before the product takes on real data on purpose. An operator who cannot
 * rotate their own password, and who has no second factor available, is one shared laptop away from
 * a list of guests' phone numbers in somebody else's hands.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "admin.settings" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function SettingsPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: {
    changed?: string;
    enrolling?: string;
    totp?: string;
    error?: string;
  };
}) {
  if (!isLocale(locale)) return null;
  unstable_setRequestLocale(locale);
  const admin = await requireAdmin(locale);

  const t = await getTranslations("admin.settings");
  const state = await totpState(admin.id);
  const sessions = await activeSessionCount();

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <SectionHeading eyebrow={t("eyebrow")} title={t("title")}>
        {admin.email}
      </SectionHeading>

      {searchParams.changed ? (
        <div className="mb-6">
          <StatePanel kind="success" message={t("passwordChanged")} />
        </div>
      ) : null}
      {searchParams.totp === "on" ? (
        <div className="mb-6">
          <StatePanel kind="success" message={t("totpEnabled")} />
        </div>
      ) : null}
      {searchParams.totp === "off" ? (
        <div className="mb-6">
          <StatePanel kind="empty" message={t("totpDisabled")} />
        </div>
      ) : null}
      {searchParams.error ? (
        <div className="mb-6">
          <StatePanel kind="error" message={searchParams.error === "current" ? t("wrongPassword") : t(`errors.${searchParams.error}`) } />
        </div>
      ) : null}

      <Card>
        <h2 className="text-sm font-medium text-ink">{t("passwordTitle")}</h2>
        <p className="mt-1 text-xs text-ink-muted">{t("passwordHint")}</p>
        <form action={changePasswordAction} className="mt-4 grid gap-3">
          <input type="hidden" name="locale" value={locale} />
          <Field label={t("current")} name="current_password" type="password" autoComplete="current-password" required />
          <Field label={t("next")} name="new_password" type="password" autoComplete="new-password" required />
          <Field label={t("confirm")} name="confirm_password" type="password" autoComplete="new-password" required />
          <div>
            <Button type="submit">{t("changePassword")}</Button>
          </div>
        </form>
        <p className="mt-3 text-xs text-ink-muted">{t("revokes", { count: Math.max(sessions - 1, 0) })}</p>
      </Card>

      <Card className="mt-4">
        <h2 className="text-sm font-medium text-ink">{t("totpTitle")}</h2>
        <p className="mt-1 text-xs text-ink-muted">{t("totpHint")}</p>

        {state.enrolled ? (
          <div className="mt-4 flex flex-col gap-3">
            <StatePanel kind="success" message={t("totpOn")} />
            <form action={disableTotpAction} className="flex flex-col gap-3">
              <input type="hidden" name="locale" value={locale} />
              <Field label={t("passwordToDisable")} name="password" type="password" required />
              <div>
                <Button type="submit" variant="danger">
                  {t("disable")}
                </Button>
              </div>
            </form>
          </div>
        ) : state.pendingSecret ? (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-ink">{t("enrolStep")}</p>
            {/* The secret is shown as text as well as inside the URI: an operator who cannot scan
                a QR code has to be able to type it, and copy-paste does not work on paper. */}
            <p className="ltr-token break-all rounded-md border border-line bg-ground-recipe p-3 font-mono text-sm" dir="ltr">
              {state.pendingSecret}
            </p>
            <p className="text-xs text-ink-muted">{t("enrolManual")}</p>
            <form action={confirmTotpAction} className="flex flex-col gap-3">
              <input type="hidden" name="locale" value={locale} />
              <Field
                label={t("enrolCode")}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                required
                dir="ltr"
                className="ltr-token text-center tracking-[0.3em]"
              />
              <div>
                <Button type="submit">{t("enable")}</Button>
              </div>
            </form>
          </div>
        ) : (
          <form action={startTotpAction} className="mt-4">
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit">{t("start")}</Button>
          </form>
        )}
      </Card>

      <p className="mt-6 text-xs text-ink-muted">{t("lostDevice")}</p>
    </main>
  );
}
