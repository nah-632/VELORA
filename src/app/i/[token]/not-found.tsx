import { getTranslations } from "next-intl/server";

/**
 * The page a guest sees when the link does not resolve.
 *
 * It is deliberately identical for a token that never existed, a token that was deleted with its
 * event, and a token whose design could not be parsed. A route that answers those three cases
 * differently is a route that tells an attacker which tokens are real.
 *
 * Like the page beside it, this must not be cached: it is shown for a URL that a guest will retry,
 * and a cached copy would outlive the fix.
 */
export const dynamic = "force-dynamic";

export default async function InvitationNotFound() {
  // Read through the request's own locale if next-intl can resolve one, and fall back to Arabic:
  // the guest's language lives on their row, which by definition did not load.
  let title = "تعذّر فتح هذه الدعوة";
  let body = "الرابط غير صحيح أو لم يعد فعّالًا. تواصل مع مُرسِل الدعوة للحصول على رابط جديد.";
  try {
    const t = await getTranslations("invitation");
    title = t("brokenTitle");
    body = t("brokenBody");
  } catch {
    // No locale context outside the [locale] tree — the Arabic default above is the honest answer.
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <p className="mt-3 text-sm text-ink-muted">{body}</p>
    </main>
  );
}
