"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { otherLocale, type Locale } from "@/i18n/routing";

/**
 * Switches language while staying on the same page.
 *
 * A link, not a `<select>`: it is navigation between two addresses, it should be shareable and
 * crawlable, and it should work without JavaScript.
 */
export function LanguageSwitch({ locale }: { locale: Locale }) {
  const t = useTranslations("language");
  const pathname = usePathname();
  const target = otherLocale(locale);

  return (
    <Link
      href={pathname}
      locale={target}
      hrefLang={target}
      lang={target}
      className="inline-flex min-h-11 items-center rounded-md border border-line px-3 text-sm text-ink transition-colors hover:border-gold-deep hover:text-gold-deep"
    >
      {t("switchTo")}
    </Link>
  );
}
