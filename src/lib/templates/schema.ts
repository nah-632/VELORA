import { z } from "zod";

/**
 * Template tokens — rebuilt from `docs/TEMPLATES.md`.
 *
 * A template is a document of tokens, not a component with colours baked in. Everything the
 * invitation shows is described here, so a different value produces a different invitation without a
 * different code path.
 *
 * **The palette has five values, with the roles the reference gives them** (§3, T1):
 *
 *   ivory     the paper. Background, and the light tone on dark ornaments.
 *   gold      the metal. Rules, ornament strokes, foil on the names, the seal's imprint.
 *   emerald   an *ornament* colour — the inner arch stroke. Never body text.
 *   burgundy  an *ornament* colour — the wax, the accent. Never body text.
 *   ink       the only colour body text may use.
 *
 * That distinction is the reason this is not the three-role palette the earlier `DesignConfig`
 * carried: a design that used burgundy for body copy would be legible and wrong, and the token
 * system should not make that easy.
 *
 * `FontKey` lists the eight families that actually ship, with the role each was subset for. The
 * reference names more (Bodoni, Pinyon, Jost, Katibeh, Italiana); each of those means another
 * render-blocking subset, and a template that asks for one is a template that has not been built yet.
 */

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "expected a six-digit hex colour");

export const FontKeySchema = z.enum([
  "aref", // Aref Ruqaa — Arabic calligraphic names
  "amiri", // Amiri — Arabic verse
  "reemkufi", // Reem Kufi — Arabic labels
  "notonaskh", // Noto Naskh Arabic — Arabic body
  "cormorant", // Cormorant Garamond — Latin names and verse
  "cinzel", // Cinzel — Latin labels
  "manrope", // Manrope — Latin body (product chrome)
  "plex", // IBM Plex Sans Arabic — admin dashboard only
]);
export type FontKey = z.infer<typeof FontKeySchema>;

export const OrnamentKeySchema = z.enum([
  "khatam-tessellation",
  "mihrab-arch",
  "muqarnas-corners",
  "zellige-strip",
  "botanical-corners",
  "deco-fan",
  "eight-star",
  "none",
]);
export type OrnamentKey = z.infer<typeof OrnamentKeySchema>;

export const OpeningTypeSchema = z.enum(["wax_seal", "gatefold", "curtain", "fade", "monogram_seal"]);
export type OpeningType = z.infer<typeof OpeningTypeSchema>;

export const PaletteSchema = z
  .object({
    ivory: Hex,
    gold: Hex,
    emerald: Hex,
    burgundy: Hex,
    ink: Hex,
  })
  .strict();

export const FontsSchema = z
  .object({
    ar: z
      .object({
        names: FontKeySchema,
        verse: FontKeySchema,
        label: FontKeySchema,
        body: FontKeySchema,
      })
      .strict(),
    en: z
      .object({
        names: FontKeySchema,
        verse: FontKeySchema,
        label: FontKeySchema,
        body: FontKeySchema,
      })
      .strict(),
  })
  .strict();

export const SealSchema = z
  .object({
    wax: z.enum(["burgundy", "gold", "emerald", "rose-gold", "champagne", "black"]),
    imprint: z.enum(["eight-star", "monogram", "diamond"]),
    shape: z.enum(["round", "oval", "geometric"]),
  })
  .strict();

export const EnvelopeSchema = z
  .object({
    paper: z.enum(["emerald", "ivory", "black", "blush"]),
    liner: z.enum(["arabesque", "plain", "sadu", "tiles"]),
  })
  .strict();

export const OpeningSchema = z
  .object({
    type: OpeningTypeSchema,
    /** Total time after the seal is pressed: releasing (40%) then opening (60%). */
    duration_ms: z.number().int().min(300).max(2000),
  })
  .strict();

export const LayoutSchema = z
  .object({
    composition: z.enum(["centered", "asymmetric", "architectural", "editorial"]),
    frame: z.enum(["royal-double", "thin-line", "geometric", "none"]),
    ornaments: z.array(OrnamentKeySchema).min(0).max(6),
    countdown: z.enum(["framed", "plain"]),
    rsvp: z.enum(["solid", "outlined"]),
    divider: z.enum(["zellige", "rule", "ornament", "none"]),
    /** Gold foil on the couple's names — a gradient clipped to the text, no image. */
    foil_names: z.boolean(),
  })
  .strict();

export const TemplateTokensSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    version: z.number().int().min(1),
    name_ar: z.string().min(1).max(60),
    name_en: z.string().min(1).max(60),
    description_ar: z.string().min(1).max(200),
    description_en: z.string().min(1).max(200),
    /** The reference's own label for the idiom: Moorish, Art Deco, Quiet Luxury… */
    idiom: z.string().min(1).max(40),
    palette: PaletteSchema,
    fonts: FontsSchema,
    seal: SealSchema,
    envelope: EnvelopeSchema,
    opening: OpeningSchema,
    layout: LayoutSchema,
    is_active: z.boolean(),
    sort_order: z.number().int().min(0),
  })
  .strict();

/**
 * Per-event overrides: palette and display fonts, exactly what the operator may change.
 *
 * Body and label faces are not overridable on purpose. They are what makes the invitation readable
 * at 320px; letting them move is how a design ends up elegant in the editor and illegible on the one
 * phone that matters.
 */
export const ThemeOverrideSchema = z
  .object({
    palette: PaletteSchema.partial().strict().optional(),
    fonts: z
      .object({
        ar: z.object({ names: FontKeySchema.optional(), verse: FontKeySchema.optional() }).strict().optional(),
        en: z.object({ names: FontKeySchema.optional(), verse: FontKeySchema.optional() }).strict().optional(),
      })
      .strict()
      .optional(),
    seal: SealSchema.partial().strict().optional(),
    layout: LayoutSchema.partial().strict().optional(),
  })
  .strict();

export type TemplateTokens = z.infer<typeof TemplateTokensSchema>;
export type Palette = z.infer<typeof PaletteSchema>;
export type ThemeOverride = z.infer<typeof ThemeOverrideSchema>;
export type SealConfig = z.infer<typeof SealSchema>;