/**
 * Map links.
 *
 * The operator pastes whatever the couple sent: a Google Maps link, an Apple Maps link, or the
 * "share location" URL from a phone. All three are fine; the only question the application has to
 * answer is what to call the button, and whether the URL is safe to put in an `href`.
 *
 * `javascript:` and `data:` URLs are not links, they are code. They are refused here rather than
 * relied on to be refused elsewhere — this value came from a text field and ends up inside an
 * anchor element.
 */

export type MapKind = "google" | "apple" | "other";

export interface MapClassification {
  ok: boolean;
  kind?: MapKind;
  href?: string;
  /** Why it was refused, in words an operator can act on. */
  reason?: string;
}

const GOOGLE_HOSTS = [
  "google.com",
  "maps.google.com",
  "goo.gl",
  "maps.app.goo.gl",
  "google.com.sa",
  "google.ae",
  "google.com.bh",
];

const APPLE_HOSTS = ["maps.apple.com", "apple.co"];

function hostMatches(host: string, candidates: string[]): boolean {
  return candidates.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
}

export function classifyMapUrl(input: string | null | undefined): MapClassification {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, reason: "empty" };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "not a link" };
  }

  // Only these two schemes can be in an href. Everything else — including a bare "www.google.com/x"
  // that parsed with some other protocol — is refused.
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "only http and https links" };
  }

  // A plain http link on an invitation page is a mixed-content warning at best. Upgrade rather than
  // refuse: the operator pasted a working link from a phone, which is almost always what happened.
  if (url.protocol === "http:") url.protocol = "https:";

  const host = url.hostname.toLowerCase();
  const kind: MapKind = hostMatches(host, GOOGLE_HOSTS)
    ? "google"
    : hostMatches(host, APPLE_HOSTS)
      ? "apple"
      : "other";

  return { ok: true, kind, href: url.toString() };
}

/** The word on the button, per language and per kind of link. */
export function mapButtonLabel(kind: MapKind, locale: "ar" | "en"): string {
  if (locale === "ar") {
    if (kind === "apple") return "افتح في خرائط آبل";
    return "افتح الموقع في الخرائط";
  }
  if (kind === "apple") return "Open in Apple Maps";
  if (kind === "google") return "Open in Google Maps";
  return "Open in Maps";
}
