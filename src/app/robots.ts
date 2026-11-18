import { type MetadataRoute } from "next";

/**
 * robots.txt.
 *
 * Two things are disallowed, for two different reasons.
 *
 * `/i/` is a guest's private invitation. The tokens are unguessable, which is why they work, but
 * "hard to guess" is not the same as "not published": a link that leaks into a search index stays
 * leaked. The page also sends `X-Robots-Tag` and its own `robots` metadata.
 *
 * `/admin` is the operator's console. It is behind a login, and it should not appear in results
 * either — a page that says "Operator console" in a search result invites exactly the attention
 * nobody needs.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/i/", "/admin", "/ar/admin", "/en/admin", "/api/"],
      },
    ],
  };
}
