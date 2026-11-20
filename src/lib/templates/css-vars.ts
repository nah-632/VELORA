import type { CSSProperties } from "react";

import type { Palette, SealConfig, TemplateTokens, ThemeOverride } from "./schema";

/**
 * Tokens → CSS custom properties, and template + override → the tokens to render with.
 *
 * The single place a template's values become CSS. Nothing in the stylesheet hard-codes a template's
 * colour or font, so "swappable per event" is structural rather than a matter of remembering.
 *
 * Every family is self-hosted and subset (`scripts/fonts.py`), so a stack here never names a font the
 * browser would have to fetch from a third party — which is also why there is no `@import` anywhere.
 * Each stack ends in a metric-matched fallback where one exists (`scripts/font-fallbacks.py`), and in
 * a system face where one does not.
 */
const STACKS: Record<TemplateTokens["fonts"]["ar"]["names"], string> = {
  aref: '"Aref Ruqaa", "Noto Naskh Arabic", serif',
  amiri: '"Amiri", "Noto Naskh Arabic", serif',
  reemkufi: '"Reem Kufi", "IBM Plex Sans Arabic", sans-serif',
  notonaskh: '"Noto Naskh Arabic", "Geeza Pro", serif',
  cormorant: '"Cormorant Garamond", "Cormorant Garamond Fallback", "Times New Roman", serif',
  cinzel: '"Cinzel", "Cormorant Garamond Fallback", "Times New Roman", serif',
  manrope: '"Manrope", "Manrope Fallback", system-ui, sans-serif',
  plex: '"IBM Plex Sans Arabic", "Geeza Pro", sans-serif',
};

/** The wax colour a seal variant resolves to, when the template's own palette is not the answer. */
const WAX: Record<SealConfig["wax"], (palette: Palette) => string> = {
  burgundy: (palette) => palette.burgundy,
  gold: (palette) => palette.gold,
  emerald: (palette) => palette.emerald,
  "rose-gold": () => "#B76E79",
  champagne: () => "#D8C49B",
  black: () => "#141414",
};

const ENVELOPE: Record<TemplateTokens["envelope"]["paper"], (palette: Palette) => string> = {
  emerald: (palette) => palette.emerald,
  ivory: (palette) => palette.ivory,
  black: () => "#141414",
  blush: () => "#F7E6E1",
};

/** Template + per-event override → the tokens to render with. Deep, because every section is flat. */
export function resolveTheme(template: TemplateTokens, override: ThemeOverride | null | undefined): TemplateTokens {
  if (!override) return template;
  return {
    ...template,
    palette: { ...template.palette, ...(override.palette ?? {}) },
    fonts: {
      ar: { ...template.fonts.ar, ...(override.fonts?.ar ?? {}) },
      en: { ...template.fonts.en, ...(override.fonts?.en ?? {}) },
    },
    seal: { ...template.seal, ...(override.seal ?? {}) },
    layout: { ...template.layout, ...(override.layout ?? {}) },
  };
}

export function themeToCssVars(template: TemplateTokens, locale: "ar" | "en"): CSSProperties {
  const { palette, fonts, layout } = template;
  const script = fonts[locale];

  return {
    // The five roles.
    "--tpl-ivory": palette.ivory,
    "--tpl-gold": palette.gold,
    "--tpl-emerald": palette.emerald,
    "--tpl-burgundy": palette.burgundy,
    "--tpl-ink": palette.ink,
    // The names the existing stylesheet already speaks, mapped onto the same five.
    "--ground": palette.ivory,
    "--ground-paper": palette.ivory,
    "--ink": palette.ink,
    "--ink-muted": `color-mix(in oklab, ${palette.ink} 62%, ${palette.ivory})`,
    "--accent": palette.gold,
    "--gold-deep": palette.gold,
    "--line": `color-mix(in oklab, ${palette.gold} 42%, ${palette.ivory})`,
    // Typography, per role and per script.
    "--tpl-font-names": STACKS[script.names],
    "--tpl-font-verse": STACKS[script.verse],
    "--tpl-font-label": STACKS[script.label],
    "--tpl-font-body": STACKS[script.body],
    // What the older components ask for.
    "--font-display": STACKS[script.names],
    "--font-body": STACKS[script.body],
    // Opening.
    "--tpl-wax": WAX[template.seal.wax](palette),
    "--tpl-envelope": ENVELOPE[template.envelope.paper](palette),
    "--tpl-duration": `${template.opening.duration_ms}ms`,
    // Frames and dividers are drawn in gold; the arch's inner stroke is emerald.
    "--tpl-frame": palette.gold,
    "--tpl-frame-inner": palette.emerald,
    "--tpl-foil-a": palette.gold,
    "--tpl-foil-b": `color-mix(in oklab, ${palette.gold} 55%, #FFF6DA)`,
    "--tpl-foil-c": `color-mix(in oklab, ${palette.gold} 72%, #6B4A12)`,
    ...(layout.foil_names ? {} : {}),
  } as CSSProperties;
}

export function themeDataAttributes(template: TemplateTokens): Record<string, string> {
  return {
    "data-template": template.slug,
    "data-composition": template.layout.composition,
    "data-frame": template.layout.frame,
    "data-countdown": template.layout.countdown,
    "data-rsvp": template.layout.rsvp,
    "data-divider": template.layout.divider,
    "data-foil": template.layout.foil_names ? "on" : "off",
    "data-opening": template.opening.type,
    "data-seal": template.seal.imprint,
    "data-envelope": template.envelope.paper,
  };
}
