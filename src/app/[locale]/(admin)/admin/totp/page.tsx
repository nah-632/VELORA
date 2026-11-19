import { type Metadata } from "next";
import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card, SectionHeading, StatePanel } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { isLocale } from "@/i18n/routing";
import { verifyTotpAction } from "@/features/admin/actions";
import { readLoginChallenge } from "@/features/admin/totp";
import { getCurrentAdmin } from "@/features/admin/sessions";

/**
 * The second step of a two-step sign-in.
 *
 * Reached only with a live challenge, which only exists after a correct password. Someone who lands
 * here without one is sent back to the beginning — and told nothing about why.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "admin.totp" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function TotpChallengePage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { error?: string };
}) {
  if (!isLocale(locale)) return null;
  unstable_setRequestLocale(locale);

  if (await getCurrentAdmin()) redirect(`/${locale}/admin`);
  const challenge = await readLoginChallenge();
  // Expired, already used, or never issued: the password step is the only way back in.
  if (!challenge) redirect(`/${locale}/admin/login`);

  const t = await getTranslations("admin.totp");

  return (
    <main className="mx-auto flex min-h-[70dvh] w-full max-w-md flex-col justify-center px-6 py-16">
      <SectionHeading eyebrow={t("eyebrow")} title={t("title")}>
        {t("intro")}
      </SectionHeading>

      <Card className="mt-8">
        <form action={verifyTotpAction} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="locale" value={locale} />
          <Field
            label={t("code")}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={7}
            required
            dir="ltr"
            className="ltr-token text-center text-2xl tracking-[0.4em]"
          />
          {searchParams.error ? (
            <p role="alert" className="text-sm text-danger">
              {t("badCode")}
            </p>
          ) : null}
          <Button type="submit" className="mt-2 w-full">
            {t("submit")}
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-xs text-ink-muted">{t("lostDevice")}</p>
    </main>
  );
}
