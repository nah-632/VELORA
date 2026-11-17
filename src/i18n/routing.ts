/**
 * Locale configuration. One place that decides what a locale means.
 *
 * Direction and typeface are properties of the locale, not of a page or a component, so no
 * screen can be built for one direction and quietly shipped broken in the other.
 */
export const locales = ["ar", "en"] as const;

export type Locale = (typeof locales)[number];

/** Bahrain first: Arabic is the default, not a translation of an English site. */
export const defaultLocale: Locale = "ar";

/** BCP-47 tags for Intl. `ar-BH` is Bahrain; it is not the same as generic `ar`. */
export const localeTags: Record<Locale, string> = {
  ar: "ar-BH",
  en: "en-BH",
};

export const direction: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

export const localeName: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function otherLocale(locale: Locale): Locale {
  return locale === "ar" ? "en" : "ar";
}
