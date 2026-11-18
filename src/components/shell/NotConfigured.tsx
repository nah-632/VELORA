import { getTranslations } from "next-intl/server";

import { buttonClass } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { type Locale } from "@/i18n/routing";

/**
 * Shown when the deployment has no data source configured.
 *
 * Deliberately not a silent empty catalogue, and deliberately not a stack trace. A reader of a
 * preview deployment should be told exactly what is missing and that everything else works —
 * and this only ever appears for a *configuration* problem, never for a database that is
 * unreachable or failing, because those are reported as the faults they are.
 */
export async function NotConfigured({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "unconfigured" });

  return (
    <div className="mx-auto flex max-w-prose flex-col gap-5 px-6 py-20">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="text-3xl text-ink">{t("title")}</h1>
      <p className="text-ink-muted">{t("body")}</p>
      <div className="rounded-md border border-warning bg-warning-ground px-4 py-3 text-sm text-warning">
        {t("detail")}
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className={buttonClass("primary")}>
          {t("home")}
        </Link>
        <Link href="/brand/preview.html" className={buttonClass("secondary")} prefetch={false}>
          {t("brand")}
        </Link>
      </div>
    </div>
  );
}
