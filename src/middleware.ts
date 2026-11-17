import createMiddleware from "next-intl/middleware";

import { defaultLocale, locales } from "@/i18n/routing";

export default createMiddleware({
  locales,
  defaultLocale,
  // Always prefix, including the default locale. A URL that means different things depending on
  // a header is a URL that cannot be shared, cached or cited — and an invitation link will be
  // shared constantly.
  localePrefix: "always",
});

export const config = {
  // Everything except API routes, Next internals, and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
