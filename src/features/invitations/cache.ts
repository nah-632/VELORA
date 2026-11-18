import { cache } from "react";

import { loadInvitation, type PublicInvitation } from "./public";

/**
 * One load per request, shared by the layout and the page.
 *
 * React's `cache()` is per-request, so the layout and the page call this and the database is
 * touched once — which matters twice over: the open is recorded exactly once, and a guest's phone
 * does not pay for two round trips to render a single page.
 *
 * It lives in its own module rather than in the layout because a Next route file may only export
 * the things Next recognises, and an extra export there is a build error.
 */
export const loadInvitationOnce = cache(
  async (token: string): Promise<PublicInvitation | null> => loadInvitation(token),
);
