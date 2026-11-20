import type { ReactNode } from "react";

import { KhatamField, MihrabArch, MuqarnasCorner, ZelligeStrip, StarDivider } from "./ornaments";
import { themeDataAttributes, themeToCssVars, resolveTheme } from "./css-vars";
import type { TemplateTokens, ThemeOverride } from "./schema";

/**
 * The T1 arrangement: frame, ornament field, arch, and the names inside it.
 *
 * A server component, so all of this is in the first HTML — a guest with no JavaScript sees the
 * finished invitation, and the arch's draw-in is decoration on top of content that is already there.
 *
 * The composition is fixed for T1 (centred, arch around the names, ornaments in the corners) while
 * every *value* comes from tokens. That is the split the reference asks for: a template owns its
 * arrangement, the palette and type are swappable underneath it.
 */
export function GoldenPalace({
  template,
  override,
  locale,
  eyebrow,
  groom,
  bride,
  children,
  names,
}: {
  template: TemplateTokens;
  override?: ThemeOverride | null;
  locale: "ar" | "en";
  eyebrow?: string;
  groom: string;
  bride: string;
  /** Everything below the names: verse, countdown, venues, RSVP. */
  children: ReactNode;
  /** The rendered names block, so the arch can wrap whatever the page supplies. */
  names?: ReactNode;
}) {
  const theme = resolveTheme(template, override);
  const style = themeToCssVars(theme, locale);
  const attrs = themeDataAttributes(theme);
  const ornaments = theme.layout.ornaments;

  return (
    <div className="t1" style={style} {...attrs} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      {ornaments.includes("khatam-tessellation") ? (
        <div className="t1__field" aria-hidden="true">
          <KhatamField opacity={0.07} size={68} />
        </div>
      ) : null}

      {theme.layout.frame !== "none" ? <div className="t1__frame" aria-hidden="true" /> : null}

      {ornaments.includes("muqarnas-corners") ? (
        <span aria-hidden="true" className="t1__corners">
          <MuqarnasCorner className="muqarnas t1__corner--start" />
          <MuqarnasCorner className="muqarnas t1__corner--end" flip />
        </span>
      ) : null}

      <div className="t1__content">
        {eyebrow ? <p className="t1__eyebrow">{eyebrow}</p> : null}

        <div className="t1__names">
          {ornaments.includes("mihrab-arch") ? <MihrabArch className="mihrab" /> : null}
          {names ?? (
            <div className="t1__couple">
              <span className="t1__name">{groom}</span>
              <span className="t1__amp">{locale === "ar" ? "و" : "&"}</span>
              <span className="t1__name">{bride}</span>
            </div>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}

/** The three ornaments a page composes between its sections. */
export function T1Divider({ kind }: { kind: "zellige" | "rule" | "ornament" | "none" }) {
  if (kind === "none") return null;
  if (kind === "zellige") return <ZelligeStrip className="zellige" />;
  if (kind === "rule") return <hr className="my-6 border-0 border-t border-[color:var(--tpl-gold)] opacity-40" />;
  return <StarDivider className="divider" />;
}