import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_SESSION_COOKIE } from "@/features/admin/cookie";
import { defaultLocale, locales } from "@/i18n/routing";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  // Always prefix, including the default locale. A URL that means different things depending on
  // a header is a URL that cannot be shared, cached or cited — and an invitation link will be
  // shared constantly.
  localePrefix: "always",
});

const ADMIN_PATH = /^\/(ar|en)\/admin(\/|$)/;
const LOGIN_PATH = /^\/(ar|en)\/admin\/login\/?$/;

/**
 * Locale routing, plus one convenience for the operator console.
 *
 * This middleware is **not** the admin authorization check. It runs at the edge, where there is no
 * database, so all it can see is whether a cookie is present — and a present cookie is not a valid
 * session. Its only job is to send a signed-out reader to the login form instead of letting them
 * watch an admin page fail. The check that decides is `requireAdmin()` in the page and in every
 * server action, which verifies the session against the database.
 *
 * Keeping the two apart matters: if this were treated as the gate, deleting a cookie would look
 * like a security control.
 */
export default function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (ADMIN_PATH.test(path) && !LOGIN_PATH.test(path) && !request.cookies.get(ADMIN_SESSION_COOKIE)) {
    const locale = path.split("/")[1] ?? defaultLocale;
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/admin/login`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  // Everything except API routes, Next internals, and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
