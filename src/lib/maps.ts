/**
 * Map links.
 *
 * The operator pastes whatever the couple sent — a Google Maps link, an Apple Maps link, the "share
 * location" URL from a phone, or nothing but the address typed into the address field. The page has
 * one question to answer for a guest: **what does the button open?**
 *
 * The answer is Google Maps for every hall. A link the operator pasted is used only when it is
 * already Google's; everything else becomes a Google Maps search on the venue's own name and
 * address. The button says Google Maps, so it opens Google Maps — a button labelled Google Maps that
 * opens Waze is a button that lies, and the guest only finds out after they have driven somewhere.
 *
 * `javascript:` and `data:` URLs are not links, they are code. They are refused here rather than
 * relied on to be refused elsewhere: this value came from a text field and ends up inside an anchor.
 */

/**
 * Is this specifically a Google Maps link — one that can be handed to a guest as-is?
 *
 * The distinction matters twice over, and the two uses have different strengths:
 *
 *   **The guest's button** wants a link that opens Google Maps. A `maps.app.goo.gl/...` short link
 *   from the couple's phone is exactly that, and rewriting it would be rude to the couple and lossy.
 *
 *   **The operator's field** wants to know whether a link is *Google's*, because that value reaches
 *   an anchor's `href`. `https://google.com/maps.evil.example/` is a perfectly valid URL and a
 *   perfectly good way to make a wedding invitation's button point at somebody else's page. So the
 *   scheme must be `https:`, the host is compared exactly, and for the `google.com` hosts the path
 *   must begin with `/maps`.
 */
export function isGoogleMapsUrl(input: string | null | undefined): boolean {
  const raw = (input ?? "").trim();
  if (!raw) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  // `maps.app.goo.gl` is the share link a phone produces; `maps.google.com` is the older form the
  // desktop site still hands out, usually as `?q=`. Both are Google's, exactly.
  if (host === "maps.app.goo.gl" || host === "maps.google.com") return true;
  if (host === "google.com" || host === "www.google.com") {
    return url.pathname === "/maps" || url.pathname.startsWith("/maps/");
  }
  return false;
}

/** Longer than this is not a venue address, it is an attack on the browser's URL bar. */
const MAX_HREF_LENGTH = 2048;

const SEARCH_ENDPOINT = "https://www.google.com/maps/search/?api=1&query=";

/**
 * The one link shape the guest's button can always use: a Google Maps search for a place name.
 *
 * `api=1` is not decoration — Google's Maps URLs documentation requires it, and without it
 * `/search/` is not the documented interface. There is deliberately **no** `query_place_id`: a place
 * id has to come from Google's Places API for one specific listing, and inventing or guessing one
 * would point guests at whichever business happens to hold that id.
 */
export function googleMapsSearchUrl(query: string): string {
  const encoded = encodeURIComponent(query.trim());
  // The *query* is trimmed to fit, never the finished URL, so the link is always a valid one. A name
  // and an address long enough to breach this are already unusable as a search.
  const room = MAX_HREF_LENGTH - SEARCH_ENDPOINT.length;
  return `${SEARCH_ENDPOINT}${encoded.length <= room ? encoded : encoded.slice(0, room)}`;
}

/**
 * The href for the guest's map button.
 *
 * A Google link the operator pasted is used unmodified: it may be a short link to a pinned entrance,
 * and a generated search would throw that away. Anything else — an Apple Maps link, a Waze link, a
 * leftover address — becomes a Google Maps search for the venue's name and address.
 *
 * `null` when there is nothing to search for: without a name or an address there is no honest query,
 * and a button that opens a blank map is worse than no button.
 */
export function googleMapsHref(input: {
  mapUrl?: string | null;
  name?: string | null;
  address?: string | null;
}): string | null {
  const stored = (input.mapUrl ?? "").trim();
  if (isGoogleMapsUrl(stored)) return stored;
  const query = [input.name, input.address]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(", ");
  if (!query) return null;
  return googleMapsSearchUrl(query);
}

/**
 * The word on the button.
 *
 * One label for every venue, because the button opens one service for every venue. It says "Google"
 * in the Arabic label too: the brand is not transliterated, which is how the prototype and every
 * Google Maps link on the web is written.
 */
export function mapsButtonLabel(locale: "ar" | "en"): string {
  return locale === "ar" ? "افتح في خرائط Google" : "Open in Google Maps";
}
