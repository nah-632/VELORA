import { type AbstractIntlMessages } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";

import { isLocale, type Locale } from "./routing";

/**
 * Message loading.
 *
 * A static import map rather than a template-literal path: a dynamic
 * `import(`../../messages/${locale}.json`)` is opaque to the bundler, which turns a missing
 * catalogue into a runtime failure instead of a build error.
 */
const catalogues: Record<Locale, () => Promise<{ default: AbstractIntlMessages }>> = {
  ar: () => import("../../messages/ar.json"),
  en: () => import("../../messages/en.json"),
};

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;
  if (!isLocale(locale)) notFound();

  return {
    locale,
    messages: (await catalogues[locale]()).default,
    // The business runs on Gulf time. A date rendered in UTC would be wrong for three hours
    // every day, which is exactly when a wedding is being looked at.
    timeZone: "Asia/Bahrain",
    now: new Date(),
  };
});
