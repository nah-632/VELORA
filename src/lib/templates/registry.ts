import { TemplateTokensSchema, type TemplateTokens } from "./schema";

/**
 * The registry.
 *
 * One row per template, and everything a template is lives in its row. T1 is the only entry that has
 * been built; the other twenty-three are named in `docs/TEMPLATES.md` and arrive with their own rows.
 *
 * **T1 · Golden Palace** — the reference's values verbatim (§3): ivory `#F6EEDC`, antique gold
 * `#B8913A`, deep emerald `#0F3D3E`, burgundy `#6B1E2E`, ink brown `#2B1B12`; Aref Ruqaa names,
 * Amiri verse, Reem Kufi labels; Cormorant Garamond and Cinzel for English; burgundy wax with a gold
 * eight-point star; emerald envelope with a gold arabesque liner; mihrab arch, khatam tessellation,
 * muqarnas corners, zellige dividers.
 */
export const GOLDEN_PALACE: TemplateTokens = TemplateTokensSchema.parse({
  slug: "golden-palace",
  version: 1,
  name_ar: "قصر ذهبي",
  name_en: "Golden Palace",
  description_ar: "فناء قصر مغربي عند الغروب: عاجي وذهب عتيق، قوس محراب، وشمع عنابي.",
  description_en: "A Moorish palace courtyard at dusk: ivory and antique gold, a mihrab arch, burgundy wax.",
  idiom: "Moorish",
  palette: {
    ivory: "#F6EEDC",
    gold: "#B8913A",
    emerald: "#0F3D3E",
    burgundy: "#6B1E2E",
    ink: "#2B1B12",
  },
  fonts: {
    ar: { names: "aref", verse: "amiri", label: "reemkufi", body: "notonaskh" },
    en: { names: "cormorant", verse: "cormorant", label: "cinzel", body: "cormorant" },
  },
  seal: { wax: "burgundy", imprint: "eight-star", shape: "round" },
  envelope: { paper: "emerald", liner: "arabesque" },
  opening: { type: "wax_seal", duration_ms: 600 },
  layout: {
    composition: "centered",
    frame: "royal-double",
    ornaments: ["khatam-tessellation", "mihrab-arch", "muqarnas-corners", "zellige-strip"],
    countdown: "framed",
    rsvp: "solid",
    divider: "zellige",
    foil_names: true,
  },
  is_active: true,
  sort_order: 1,
});

export const TEMPLATES: readonly TemplateTokens[] = [GOLDEN_PALACE];

if (process.env.NODE_ENV !== "production") {
  const seen = new Set<string>();
  for (const template of TEMPLATES) {
    TemplateTokensSchema.parse(template);
    if (seen.has(template.slug)) throw new Error(`registry: duplicate template slug "${template.slug}"`);
    seen.add(template.slug);
  }
}

export function getTemplateBySlug(slug: string | null | undefined): TemplateTokens | undefined {
  if (!slug) return undefined;
  return TEMPLATES.find((template) => template.slug === slug);
}

export function getActiveTemplates(): TemplateTokens[] {
  return TEMPLATES.filter((template) => template.is_active).sort((a, b) => a.sort_order - b.sort_order);
}