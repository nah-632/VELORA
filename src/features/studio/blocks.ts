import { isRealDate } from "@/features/studio/content";
import { type InvitationContent } from "@/features/studio/content";
import { type Locale } from "@/i18n/routing";

/**
 * What the renderer draws.
 *
 * This is the seam between content and rendering. Everything upstream — the catalogue's sample
 * wording, or a customer's finished invitation — is reduced to these blocks, and the renderer
 * knows nothing about either source. It is what makes one canvas serve the catalogue thumbnail,
 * the Studio preview and the final invitation, which the brief requires and forbids duplicating.
 *
 * `details` is a **list**, not a formatted sentence: the renderer decides how to lay them out, and
 * a customer who left the venue address empty simply has fewer entries rather than a stray
 * separator or an empty line.
 */
export interface InvitationBlocks {
  eyebrow: string;
  names: string;
  details: string[];
  footer: string;
  message?: string;
  verse?: string;
  notes?: string;
}

export interface BlockSource {
  eyebrow: { ar: string; en: string };
  names: { ar: string; en: string };
  footer: { ar: string; en: string };
}

/** The catalogue's sample wording. Marked as a sample upstream so it can never be mistaken for a couple. */
export function blocksFromPreview(preview: BlockSource, locale: Locale): InvitationBlocks {
  return {
    eyebrow: locale === "ar" ? preview.eyebrow.ar : preview.eyebrow.en,
    names: locale === "ar" ? preview.names.ar : preview.names.en,
    details: [],
    footer: locale === "ar" ? preview.footer.ar : preview.footer.en,
  };
}

/**
 * Used when a template has no sample wording, or a stored one fails to parse. The design still
 * has to be shown — an empty card would hide the design entirely, which is worse than a
 * placeholder that is obviously a placeholder.
 */
export function fallbackBlocks(locale: Locale): InvitationBlocks {
  return {
    eyebrow: "",
    names: locale === "ar" ? "اسم العروس واسم العريس" : "Bride and Groom",
    details: [],
    footer: "",
  };
}

/** A customer's own invitation. Empty optional fields simply do not produce a line. */
export function blocksFromContent(content: InvitationContent, locale: Locale): InvitationBlocks {
  const details: string[] = [];

  if (content.weddingDate) {
    const formatted = formatDate(content.weddingDate, locale);
    if (formatted) details.push(formatted);
  }
  if (content.hijriDate) details.push(content.hijriDate);
  if (content.weddingTime) details.push(content.weddingTime);
  if (content.venueName) {
    details.push(content.venueAddress ? `${content.venueName} — ${content.venueAddress}` : content.venueName);
  }

  return {
    eyebrow: locale === "ar" ? "دعوة زفاف" : "Wedding Invitation",
    names:
      content.brideName && content.groomName
        ? `${content.brideName} ${locale === "ar" ? "و" : "and"} ${content.groomName}`
        : content.brideName || content.groomName || (locale === "ar" ? "الأسماء" : "Names"),
    details,
    footer: locale === "ar" ? "مملكة البحرين" : "Kingdom of Bahrain",
    message: content.message || undefined,
    verse: content.verse || undefined,
    notes: content.notes || undefined,
  };
}

/**
 * Dates are formatted for display, never stored formatted.
 *
 * `ar-BH` with Latin digits, matching the rest of the product: an Arabic invitation still shows
 * 12/03/2027 rather than ١٢/٠٣/٢٠٢٧, because the customer and the venue read the same number.
 */
function formatDate(iso: string, locale: Locale): string | null {
  // `Date.parse` accepts the 31st of February and rolls it into March, so the calendar is checked
  // first rather than trusting the parse to fail.
  if (!isRealDate(iso)) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-BH" : "en-BH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
    numberingSystem: "latn",
  }).format(date);
}
