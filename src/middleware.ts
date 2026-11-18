import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE } from "@/features/admin/cookie";
import { buildCsp } from "@/lib/csp";
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
const LOGIN_PATH = /^\/(ar|en)\/admin\/(login|totp)\/?$/;

/**
 * Locale routing, one convenience for the console, and the Content-Security-Policy.
 *
 * The admin redirect is **not** the authorization check. It runs at the edge, where there is no
 * database, so all it can see is whether a cookie is present — and a present cookie is not a valid
 * session. Its only job is to send a signed-out reader to the login form instead of letting them
 * watch an admin page fail. The check that decides is `requireAdmin()`, in the page and in every
 * server action.
 *
 * The CSP is generated per request because it carries a nonce. A policy that allows `unsafe-inline`
 * for scripts protects against nothing that matters: an injected inline script is exactly what it
 * was meant to stop. See `src/lib/csp.ts` for the policy and for what it deliberately does not
 * constrain.
 */
export default function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // One nonce per request, fresh each time. `randomUUID` is available in the edge runtime.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, { production: process.env.NODE_ENV === "production" });

  if (ADMIN_PATH.test(path) && !LOGIN_PATH.test(path) && !request.cookies.get(ADMIN_SESSION_COOKIE)) {
    const locale = path.split("/")[1] ?? defaultLocale;
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/admin/login`;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  /**
   * The nonce travels on the request as well as the response.
   *
   * Next reads the policy from the forwarded request headers and stamps the nonce onto the scripts
   * it generates; without this the app's own JavaScript would be blocked by the policy that was
   * written to protect it — which is a failure that looks exactly like "the deployment is broken".
   */
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = intlMiddleware(new NextRequest(request, { headers: requestHeaders }));
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Everything except API routes, Next internals, files with an extension, and **/i/** — a guest's
  // invitation is deliberately outside the locale tree: the link the operator pastes into WhatsApp
  // is /i/<token>, with no /ar/ or /en/ in it, and the language comes from the guest's own row.
  // Letting the locale middleware see /i/ would rewrite it to /ar/i/<token> and 404.
  matcher: ["/((?!api|i/|_next|_vercel|.*\\..*).*)"],
};
