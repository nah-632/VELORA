import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { type Locale } from "@/i18n/routing";

import { LanguageSwitch } from "./LanguageSwitch";

/**
 * Navigation items that do not have a page yet are rendered as disabled text, not as links.
 * A link to a 404 is a dead end, and the brief forbids shipping dead ends — so the honest state
 * of each destination is part of the interface until its page exists.
 */
const NAV = [
  { key: "templates", href: "/templates", ready: false },
  { key: "pricing", href: "/pricing", ready: false },
  { key: "about", href: "/about", ready: false },
  { key: "contact", href: "/contact", ready: false },
] as const;

export async function SiteHeader({ locale }: { locale: Locale }) {
  const t = await getTranslations("nav");
  const brand = await getTranslations("brand");

  return (
    <header className="border-b border-line bg-ground-paper">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-6 px-6 py-5">
        <div className="flex flex-col">
          {/* Wordmark only for now: the monogram is Milestone 2 work, and a placeholder mark
              would be worse than none. */}
          <span className="font-display text-2xl tracking-[0.2em] text-ink">{brand("name")}</span>
          <span className="text-xs tracking-[0.14em] text-ink-muted">{brand("positioning")}</span>
        </div>

        <nav aria-label={t("templates")} className="hidden items-center gap-7 md:flex">
          {NAV.map((item) =>
            item.ready ? (
              <Link key={item.key} href={item.href} className="text-sm text-ink hover:text-gold-deep">
                {t(item.key)}
              </Link>
            ) : (
              <span
                key={item.key}
                aria-disabled="true"
                title={t("soon")}
                className="cursor-default text-sm text-ink-muted"
              >
                {t(item.key)}
              </span>
            ),
          )}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitch locale={locale} />
        </div>
      </div>
    </header>
  );
}
