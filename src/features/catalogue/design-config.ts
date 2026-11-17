import { z } from "zod";

/**
 * The design configuration.
 *
 * The brief requires that an invitation's **content** be separable from its **visual rendering**,
 * and that the configuration be structured and versionable. This is that document: it describes
 * *how* an invitation looks and says nothing about *what* it says. Content lives in its own
 * object (`InvitationContentSchema`), and the two are only combined at render time.
 *
 * The version is not decoration. When an invitation is saved, the Studio stores a snapshot of the
 * configuration it was designed with, so a template edited next month cannot silently redraw an
 * invitation that has already been sold. Every reader of this document must therefore state which
 * versions it understands, and refuse the rest rather than guess.
 *
 * Parsed at the repository boundary rather than trusted: a malformed configuration in the
 * database is a bug, and it should surface as an error instead of as a strange-looking card.
 */

export const CURRENT_DESIGN_VERSION = 1;

/** Latin and Arabic derive from the same four families the product licenses. */
export const FONT_FAMILIES = {
  cormorant: "Cormorant Garamond",
  aref: "Aref Ruqaa",
  manrope: "Manrope",
  plex: "IBM Plex Sans Arabic",
} as const;

export type FontKey = keyof typeof FONT_FAMILIES;

const FontKeySchema = z.enum(["cormorant", "aref", "manrope", "plex"]);
const HexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/, "expected a six-digit hex colour");

export const DesignConfigSchema = z.object({
  version: z.literal(CURRENT_DESIGN_VERSION),
  canvas: z.object({
    ratio: z.enum(["5:7", "1:1", "4:5"]),
  }),
  palette: z.object({
    ground: HexColour,
    ink: HexColour,
    accent: HexColour,
  }),
  typography: z.object({
    /** Chosen per script: a design decides its Arabic face and its Latin face independently. */
    displayLatn: FontKeySchema,
    displayArab: FontKeySchema,
    bodyLatn: FontKeySchema,
    bodyArab: FontKeySchema,
    align: z.enum(["center", "start"]),
    /**
     * Uppercase is a Latin typographic device: it does nothing to Arabic, and the tracking that
     * usually accompanies it breaks Arabic joins. It is recorded as a design choice and applied
     * only in a Latin context, never as a CSS class on a bilingual element.
     */
    uppercaseEyebrow: z.boolean(),
  }),
  ornament: z.object({
    frame: z.enum(["none", "hairline", "double"]),
    rule: z.enum(["none", "short", "long"]),
  }),
  layout: z.enum(["classic", "editorial", "stacked"]),
});

export type DesignConfig = z.infer<typeof DesignConfigSchema>;

/**
 * Sample wording for the catalogue thumbnail.
 *
 * Kept separate from the design so the catalogue uses the same separation the Studio will, and
 * flagged as a sample so nothing in the interface can present it as a real couple.
 */
export const PreviewContentSchema = z.object({
  isSample: z.literal(true),
  eyebrow: z.object({ ar: z.string(), en: z.string() }),
  names: z.object({ ar: z.string(), en: z.string() }),
  footer: z.object({ ar: z.string(), en: z.string() }),
});

export type PreviewContent = z.infer<typeof PreviewContentSchema>;

export interface ResolvedDesign {
  config: DesignConfig;
  ground: string;
  ink: string;
  accent: string;
  displayFamily: string;
  bodyFamily: string;
  align: "center" | "start";
  aspect: string;
}

/**
 * Resolves a configuration for one locale.
 *
 * The two scripts need opposite treatment: in an Arabic canvas the display family is the Arabic
 * one and the tracking is stripped, because letter-spacing breaks the joins; in a Latin canvas
 * the Latin family applies and tracking is permitted. Deciding this here keeps every renderer
 * from having to remember it.
 */
export function resolveDesign(config: DesignConfig, locale: "ar" | "en"): ResolvedDesign {
  const arabic = locale === "ar";
  return {
    config,
    ground: config.palette.ground,
    ink: config.palette.ink,
    accent: config.palette.accent,
    displayFamily: FONT_FAMILIES[arabic ? config.typography.displayArab : config.typography.displayLatn],
    bodyFamily: FONT_FAMILIES[arabic ? config.typography.bodyArab : config.typography.bodyLatn],
    align: arabic ? config.typography.align : config.typography.align,
    aspect: config.canvas.ratio.replace(":", " / "),
  };
}

/** Parses a design configuration, returning null rather than throwing at a page boundary. */
export function parseDesignConfig(value: unknown): DesignConfig | null {
  const result = DesignConfigSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parsePreviewContent(value: unknown): PreviewContent | null {
  const result = PreviewContentSchema.safeParse(value);
  return result.success ? result.data : null;
}
