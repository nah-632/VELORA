import { type Metadata } from "next";

import { loadInvitationOnce } from "@/features/invitations/cache";

// fonts first, exactly as the locale layout does: the @font-face declarations must exist before
// anything references the families.
import "@/styles/fonts.css";
// Metric-matched fallbacks, so a late font cannot reflow the text it replaces.
import "@/styles/font-fallbacks.css";
import "@/styles/tokens.css";
import "@/styles/tailwind.css";
import "@/styles/base.css";
// The entrance's keyframes, scoped to this route.
import "@/styles/invitation.css";
// The guest page's own palette and composition, scoped to `.vi`. Imported after `invitation.css`
// and after the brand tokens, so its scoped custom properties are the ones the page resolves
// against without any of them reaching `:root`.
import "@/styles/luxe.css";

/**
 * The root layout for /i/[token].
 *
 * It sits outside the `[locale]` tree on purpose. A guest's invitation is not one of the site's
 * locales: there is no language switcher, no navigation, and no `/ar/` or `/en/` in the link the
 * operator pastes into WhatsApp. The language comes from the guest's own row.
 *
 * The loader is wrapped in React's `cache()` (see features/invitations/cache.ts), so this layout
 * and the page share **one** database call: the open is recorded exactly once per request.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params: { token },
}: {
  params: { token: string };
}): Promise<Metadata> {
  const invitation = await loadInvitationOnce(token);
  const isArabic = invitation?.language !== "en";
  return {
    title: isArabic ? "دعوتك" : "Your invitation",
    // The brief: no invitation page is indexable. `robots` here, `X-Robots-Tag` in next.config, and
    // a disallow in robots.txt — three doors, because one of them will be forgotten one day.
    robots: { index: false, follow: false, nocache: true },
    openGraph: {
      // Deliberately says almost nothing: a link preview appears in a chat list, and a wedding
      // invitation is not public information.
      title: isArabic ? "دعوة زفاف" : "A wedding invitation",
      description: isArabic ? "افتح رابطك لعرض الدعوة" : "Open your link to see the invitation",
    },
    other: { "robots": "noindex, nofollow, noarchive" },
  };
}

export default async function InvitationRootLayout({
  children,
  params: { token },
}: {
  children: React.ReactNode;
  params: { token: string };
}) {
  const invitation = await loadInvitationOnce(token);
  const locale = invitation?.language ?? "ar";
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir}>
      <body className="bg-ground-paper text-ink antialiased">{children}</body>
    </html>
  );
}
