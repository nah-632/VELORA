import { TemplateTokensSchema, type TemplateTokens } from "./schema";

/**
 * The registry.
 *
 * One row per template, and everything a template is lives in its row. Three entries are built; the
 * other twenty-one are named in `docs/TEMPLATES.md` and arrive with their own rows.
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
  sort_order: 5,
});

/**
 * **Emerald Envelope** — the attachment mockups, and the tree's own measured values.
 *
 * Nothing here is invented. `ivory`, `gold`, `emerald` and `ink` are the `.vi` tokens in
 * `src/styles/luxe.css`, which were taken from the mockups and are what the built entrance already
 * renders; the wax is the envelope mockup's own `#650E18`. The one constraint recorded in that file
 * travels with them: `#BE925E` is 2.4:1 on this paper, so `gold` is decoration and `#7A5220` is the
 * gold that carries text. A template row cannot express that distinction, which is why it is stated
 * here and in `css-vars.ts` rather than left to be rediscovered.
 *
 * `opening.duration_ms` stays at 600 — the value the entrance was measured against (B10: the whole
 * sequence ≈2s, releasing 40% then opening 60%). The brief estimates 4–6s for the full sequence
 * including the pre-tap ambience; that is a different span from this field, which starts at the press.
 */
export const EMERALD_ENVELOPE: TemplateTokens = TemplateTokensSchema.parse({
  slug: "emerald-envelope",
  version: 1,
  name_ar: "المظروف الزمردي",
  name_en: "Emerald Envelope",
  description_ar: "زمرد عميق وذهب، ختم عنابي، قوس ذهبي، وأسماء بخط الرفعة.",
  description_en: "Deep emerald and gold, a burgundy wax seal, a gold arch, and names in Aref Ruqaa.",
  idiom: "Emerald & Wax",
  palette: {
    ivory: "#F1DEC6",
    gold: "#BE925E",
    emerald: "#192A21",
    burgundy: "#650E18",
    ink: "#2B1B12",
  },
  fonts: {
    ar: { names: "aref", verse: "amiri", label: "reemkufi", body: "notonaskh" },
    en: { names: "cormorant", verse: "cormorant", label: "cinzel", body: "cormorant" },
  },
  seal: { wax: "burgundy", imprint: "monogram", shape: "round" },
  envelope: { paper: "emerald", liner: "arabesque" },
  opening: { type: "wax_seal", duration_ms: 600 },
  layout: {
    composition: "centered",
    frame: "thin-line",
    ornaments: ["khatam-tessellation", "mihrab-arch", "botanical-corners", "zellige-strip"],
    countdown: "framed",
    rsvp: "solid",
    divider: "zellige",
    foil_names: true,
  },
  is_active: true,
  sort_order: 4,
});

/**
 * **Velora Classic** — the brand's own palette, from `docs/BRAND.md` rather than from the brief.
 *
 * The brief supplies approximations (`~#B08D57`, `~#5A3E2B`, `~#FAF3EA`). The in-tree brand document
 * carries measured values with their contrast already recorded, so `ivory`, `gold`, `emerald` and
 * `ink` are read from there and only the brown is taken from the brief — `BRAND.md` has no brown, and
 * `burgundy` is a required role that exists to hold an accent that is never body text.
 *
 * It is deliberately the opposite of the emerald template on every axis it can be: an ivory envelope
 * instead of emerald, a plain liner instead of arabesque, a gold wax instead of burgundy, thin plain
 * rules instead of zellige, an outlined RSVP instead of solid. That is what makes it a second design
 * rather than a recoloured first one.
 */
export const VELORA_CLASSIC: TemplateTokens = TemplateTokensSchema.parse({
  slug: "velora-classic",
  version: 1,
  name_ar: "فيلورا كلاسيك",
  name_en: "Velora Classic",
  description_ar: "الكلاسيكي الهادئ: عاجي، ذهب عتيق، ومساحة بيضاء سخية.",
  description_en: "Quiet luxury: ivory, antique gold, and generous whitespace.",
  idiom: "Quiet Luxury",
  palette: {
    ivory: "#F5F0E8",
    gold: "#B99B6C",
    emerald: "#263E35",
    burgundy: "#5A3E2B",
    ink: "#191A19",
  },
  fonts: {
    ar: { names: "aref", verse: "amiri", label: "reemkufi", body: "notonaskh" },
    en: { names: "cormorant", verse: "cormorant", label: "cinzel", body: "cormorant" },
  },
  seal: { wax: "gold", imprint: "monogram", shape: "round" },
  envelope: { paper: "ivory", liner: "plain" },
  opening: { type: "wax_seal", duration_ms: 600 },
  layout: {
    composition: "centered",
    frame: "thin-line",
    ornaments: ["eight-star", "botanical-corners"],
    countdown: "plain",
    rsvp: "outlined",
    divider: "ornament",
    foil_names: true,
  },
  is_active: true,
  sort_order: 6,
});

export const TEMPLATES: readonly TemplateTokens[] = [EMERALD_ENVELOPE, GOLDEN_PALACE, VELORA_CLASSIC];

/*
 * Note on reach, because it is narrower than the array suggests.
 *
 * The only consumer is `src/app/i/[token]/page.tsx`, which calls `getTemplateBySlug(invitation.
 * templateSlug)` where the slug comes from `public.templates.slug`. A row in this file becomes
 * reachable when a matching slug exists in that table — so `emerald-envelope` and `velora-classic`
 * are defined here and **inert until a migration seeds them**. The operator-facing chooser reads the
 * database, not this file; `0003_templates.sql` already seeds eight presets.
 *
 * Two design documents, deliberately kept apart: the database carries `DesignConfig` (three roles —
 * ground, ink, accent — plus canvas, typography, ornament, layout), and this file carries
 * `TemplateTokens` (five roles, with the seal, the envelope and the opening). They are not the same
 * schema and a slug cannot be in one without the other being decided.
 */

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