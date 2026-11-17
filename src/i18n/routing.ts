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

/**
 * Narrows a value to a known locale.
 *
 * Takes `unknown` rather than `string` on purpose: the value usually arrives from a route
 * parameter or a request header, either of which can be absent, and a narrowing function that
 * cannot be called with a possibly-undefined value forces a cast at every call site.
 */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function otherLocale(locale: Locale): Locale {
  return locale === "ar" ? "en" : "ar";
}
