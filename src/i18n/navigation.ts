import { createSharedPathnamesNavigation } from "next-intl/navigation";

import { locales } from "./routing";

/**
 * Locale-aware navigation. Components import Link from here, never from `next/link`, so a link
 * can never silently drop the locale prefix and bounce a visitor into the other language.
 */
export const { Link, usePathname, useRouter, redirect } = createSharedPathnamesNavigation({
  locales,
});
