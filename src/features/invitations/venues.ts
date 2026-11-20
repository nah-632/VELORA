/**
 * Which hall this guest is being welcomed to.
 *
 * The rule the operator asked for, and the one the product needs:
 *
 *   **Every guest sees both venues.** A cousin invited to the men's hall still needs to tell his
 *   mother where the women's hall is — hiding the other one produces a phone call, and the phone call
 *   is the operator's evening. So nothing is filtered: the guest's own hall is *emphasised*, and the
 *   other is simply there.
 *
 * What the guest's audience does change is the wording they receive in WhatsApp and the calendar
 * entry they save: those are addressed to one person, and "the venue" has a definite answer there.
 */
import { type Locale } from "./messages";

export type VenueKind = "women" | "men" | "shared";
export type Audience = "women" | "men" | "both";

export interface Venue {
  id: string;
  kind: VenueKind;
  sort_order: number;
  name_ar: string | null;
  name_en: string | null;
  address_ar: string | null;
  address_en: string | null;
  map_url: string | null;
  start_time: string | null;
  entrance_ar: string | null;
  entrance_en: string | null;
  parking_ar: string | null;
  parking_en: string | null;
  dress_code_ar: string | null;
  dress_code_en: string | null;
  notes_ar: string | null;
  notes_en: string | null;
  contact_phone: string | null;
}

export type VenueTextField =
  | "name"
  | "address"
  | "entrance"
  | "parking"
  | "dress_code"
  | "notes";

/**
 * One field of one venue, in the guest's language, falling back to the other language.
 *
 * The fallback is the point: an operator who typed the men's hall name in Arabic only, because that
 * is what the venue's sign says, should not produce an empty heading for an English-reading guest.
 */
export function venueText(venue: Venue, field: VenueTextField, locale: Locale): string {
  const ar = venue[`${field}_ar` as keyof Venue] as string | null;
  const en = venue[`${field}_en` as keyof Venue] as string | null;
  const preferred = locale === "ar" ? ar : en;
  const other = locale === "ar" ? en : ar;
  return (preferred ?? other ?? "").trim();
}

/** The label a venue shows as: its name, or a plain word if the operator left the name empty. */
export function venueLabel(venue: Venue, locale: Locale): string {
  const name = venueText(venue, "name", locale);
  if (name) return name;
  if (venue.kind === "women") return locale === "ar" ? "قاعة النساء" : "Women's Hall";
  if (venue.kind === "men") return locale === "ar" ? "قاعة الرجال" : "Men's Hall";
  return locale === "ar" ? "مكان الحفل" : "The Venue";
}

export interface VenueView {
  /** The hall this guest is expected in — or both, or the single shared one. */
  own: Venue[];
  /** The halls shown for reference. Never hidden from the guest. */
  other: Venue[];
  /** Which hall gets the gold ring, or null when there is nothing to contrast. */
  emphasis: "women" | "men" | null;
  /** True when the event has one venue and it is not separated by audience. */
  single: boolean;
}

export function venuesForGuest(venues: Venue[], audience: Audience): VenueView {
  const sorted = [...venues].sort((a, b) => a.sort_order - b.sort_order || a.kind.localeCompare(b.kind));
  const shared = sorted.filter((venue) => venue.kind === "shared");

  // A single shared venue, or an event that has only one hall: there is no "other" to show.
  if (shared.length > 0 || sorted.length <= 1) {
    return { own: sorted, other: [], emphasis: null, single: true };
  }

  const women = sorted.filter((venue) => venue.kind === "women");
  const men = sorted.filter((venue) => venue.kind === "men");

  if (audience === "women") return { own: women, other: men, emphasis: "women", single: false };
  if (audience === "men") return { own: men, other: women, emphasis: "men", single: false };
  // "both": nobody is emphasised, because emphasising one would be picking for a household.
  return { own: [...women, ...men], other: [], emphasis: null, single: false };
}

/**
 * The two variables the WhatsApp messages use, for one guest.
 *
 * **The guest's own hall only** — and both halls when the guest *is* both. A message to a woman that
 * carries the men's hall address as well is not generous, it is confusing: she is being told to
 * choose. The invitation page shows both halls for reference; a message addressed to one person says
 * where that person is expected.
 */
export function venueVariables(
  view: VenueView,
  locale: Locale,
): { venue_name_for_guest: string; venue_map_url_for_guest: string } {
  const label = (venue: Venue) => {
    const kind = venue.kind === "women"
      ? (locale === "ar" ? "قاعة النساء" : "Women's Hall")
      : venue.kind === "men"
        ? (locale === "ar" ? "قاعة الرجال" : "Men's Hall")
        : (locale === "ar" ? "مكان الحفل" : "The Venue");
    const name = venueText(venue, "name", locale);
    return name ? `${kind}: ${name}` : kind;
  };

  return {
    venue_name_for_guest: view.own.map(label).join(" · "),
    venue_map_url_for_guest: view.own
      .map((venue) => (venue.map_url ?? "").trim())
      .filter(Boolean)
      .join(" "),
  };
}

/**
 * What the .ics uses: the guest's own hall, and both when the guest is a household.
 *
 * Someone who saves the calendar entry is going to drive to it, so it names the hall they are going
 * to — not both, which would put two addresses in a navigation field.
 */
export function venueForCalendar(view: VenueView, locale: Locale): { name: string; address: string; map: string } {
  if (view.own.length === 0) return { name: "", address: "", map: "" };
  return {
    name: view.own.map((venue) => venueLabel(venue, locale)).join(" · "),
    address: view.own.map((venue) => venueText(venue, "address", locale)).filter(Boolean).join(" · "),
    map: view.own.map((venue) => (venue.map_url ?? "").trim()).filter(Boolean).join(" "),
  };
}

/** True when this venue has the three things a guest needs: a name, an address and a map link. */
export function venueComplete(venue: Venue): { name: boolean; address: boolean; map: boolean } {
  return {
    name: Boolean((venue.name_ar ?? "").trim() || (venue.name_en ?? "").trim()),
    address: Boolean((venue.address_ar ?? "").trim() || (venue.address_en ?? "").trim()),
    map: Boolean((venue.map_url ?? "").trim()),
  };
}
