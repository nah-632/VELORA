import { type Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, unstable_setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { type ReactNode } from "react";

import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { direction, isLocale, locales, type Locale } from "@/i18n/routing";

// fonts first: @font-face declarations have to exist before anything references the families.
import "@/styles/fonts.css";
// tokens before tailwind so the utilities can reference the custom properties, and base last so
// it can override preflight.
import "@/styles/tokens.css";
import "@/styles/tailwind.css";
import "@/styles/base.css";

/**
 * Faces used above the fold, per locale.
 *
 * Declaring `unicode-range` means one page can pull four families; preloading the two that paint
 * the first screen avoids a swap on the headline, which is the most visible shift on a slow
 * connection.
 */
const PRELOAD: Record<Locale, string[]> = {
  ar: ["/fonts/plexsansarabic-arabic-400.woff2", "/fonts/arefruqaa-arabic-400.woff2"],
  en: ["/fonts/manrope-latin-var.woff2", "/fonts/cormorantgaramond-latin-var.woff2"],
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "brand" });
  return {
    title: { default: `${t("name")} — ${t("positioning")}`, template: `%s · ${t("name")}` },
    description: t("tagline"),
    other: { "og:locale": locale === "ar" ? "ar_BH" : "en_BH" },
  };
}

/**
 * The root layout, one per locale.
 *
 * `dir` and `lang` are set here from the locale configuration — never by a component, and never
 * inferred from content. Everything below this line inherits a direction it did not choose.
 */
export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  if (!isLocale(locale)) notFound();
  unstable_setRequestLocale(locale);

  const messages = await getMessages();
  const typedLocale: Locale = locale;

  return (
    <html lang={locale} dir={direction[typedLocale]}>
      {/* React hoists these into the document head. */}
      {PRELOAD[typedLocale].map((href) => (
        <link
          key={href}
          rel="preload"
          href={href}
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      ))}
      <body className="min-h-dvh bg-ground text-ink antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader locale={typedLocale} />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
