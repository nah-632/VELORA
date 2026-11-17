import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const brand = await getTranslations("brand");
  const footer = await getTranslations("footer");

  return (
    <footer className="border-t border-line bg-ground-dark text-ink-inverse">
      <div className="mx-auto flex max-w-shell flex-col gap-3 px-6 py-10">
        <span className="font-display text-xl tracking-[0.2em]">{brand("name")}</span>
        <span className="text-sm">{brand("tagline")}</span>
        {/* Stated openly rather than left as an unfilled legal page. */}
        <p className="text-sm">{footer("legalPending")}</p>
        <p className="text-xs">
          © {new Date().getFullYear()} {brand("name")} · {footer("rights")}
        </p>
      </div>
    </footer>
  );
}
