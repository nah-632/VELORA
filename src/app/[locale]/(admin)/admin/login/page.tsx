import { type Metadata } from "next";
import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { isLocale } from "@/i18n/routing";
import { loginAction } from "@/features/admin/actions";
import { getCurrentAdmin } from "@/features/admin/sessions";
import { POLICY } from "@/features/admin/login";

/**
 * The operator's sign-in.
 *
 * Failures arrive as `?error=` rather than as client state, so the form works without JavaScript
 * and the error survives a reload. The three messages are fixed strings, never the submitted value:
 * reflecting input back into the page is how a login form becomes an injection point.
 */
export const dynamic = "force-dynamic";

const ERROR_KEYS = {
  invalid: "errorInvalid",
  locked: "errorLocked",
  rate_limited: "errorRateLimited",
} as const;

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "admin.login" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function AdminLoginPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { error?: string };
}) {
  if (!isLocale(locale)) return null;
  unstable_setRequestLocale(locale);

  // Already signed in: the login page has nothing to offer.
  if (await getCurrentAdmin()) redirect(`/${locale}/admin`);

  const t = await getTranslations("admin.login");
  const errorKey = ERROR_KEYS[searchParams.error as keyof typeof ERROR_KEYS];

  return (
    <main className="mx-auto flex min-h-[70dvh] w-full max-w-md flex-col justify-center px-6 py-16">
      <SectionHeading eyebrow={t("eyebrow")} title={t("title")}>
        {t("intro")}
      </SectionHeading>

      <Card className="mt-8">
        <form action={loginAction} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="locale" value={locale} />
          <Field
            label={t("email")}
            name="email"
            type="email"
            autoComplete="username"
            required
            dir="ltr"
            className="ltr-token"
          />
          <Field
            label={t("password")}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            dir="ltr"
            className="ltr-token"
          />
          {errorKey ? (
            <p role="alert" className="text-sm text-danger">
              {t(errorKey, { minutes: POLICY.lockMinutes })}
            </p>
          ) : null}
          <Button type="submit" className="mt-2 w-full">
            {t("submit")}
          </Button>
          <p className="text-xs text-ink-muted">{t("noIndex")}</p>
        </form>
      </Card>
    </main>
  );
}
