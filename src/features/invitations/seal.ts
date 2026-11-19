/**
 * The wax seal: its shape, its colours, and the pieces it breaks into.
 *
 * The shape is generated rather than drawn by hand, for a reason that is not laziness: a wax seal is
 * *irregular*, and a hand-drawn path is a single fixed irregularity that starts to look like a
 * pattern once it has been seen twice. Generated from a fixed seed, it is irregular in the same way
 * every time — which is what a seal is, and what makes it testable.
 *
 * Everything here is pure and free of `Math.random` at render time: the same seed gives the same
 * path, so the server and the client agree and the tests can assert geometry.
 */

export interface WaxPathOptions {
  radius?: number;
  points?: number;
  seed?: number;
  drips?: number;
  centre?: number;
}

/** A small deterministic generator — the same sequence on every machine, unlike Math.random. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A closed path around a circle whose radius wobbles, with a few soft bulges where the wax ran.
 *
 * Smoothing is Catmull-Rom converted to cubic Béziers: the point list is the shape, and the curve
 * through it is what stops the wobble reading as a polygon.
 */
export function waxPath(options: WaxPathOptions = {}): string {
  const radius = options.radius ?? 46;
  const count = options.points ?? 26;
  const drips = options.drips ?? 3;
  const centre = options.centre ?? 60;
  const random = mulberry32(options.seed ?? 20260214);

  // Where the wax ran: a few angles get a bulge, and its neighbours get part of one.
  const dripAt = new Map<number, number>();
  for (let d = 0; d < drips; d += 1) {
    const index = Math.floor(random() * count);
    const strength = 0.1 + random() * 0.07;
    dripAt.set(index, strength);
    dripAt.set((index + 1) % count, strength * 0.55);
    dripAt.set((index - 1 + count) % count, strength * 0.35);
  }

  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const wobble = 1 + (random() - 0.5) * 0.075;
    const drip = 1 + (dripAt.get(i) ?? 0);
    const r = radius * wobble * drip;
    points.push({ x: centre + Math.cos(angle) * r, y: centre + Math.sin(angle) * r });
  }

  // Catmull-Rom → cubic Bézier, closed.
  const at = (index: number) => points[((index % count) + count) % count]!;
  const round = (value: number) => Math.round(value * 100) / 100;

  let path = `M${round(at(0).x)},${round(at(0).y)}`;
  for (let i = 0; i < count; i += 1) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += `C${round(c1x)},${round(c1y)} ${round(c2x)},${round(c2y)} ${round(p2.x)},${round(p2.y)}`;
  }
  return `${path}Z`;
}

/**
 * The pieces the seal breaks into.
 *
 * Three wedges cut from the centre, expressed as clip paths rather than as three separate wax
 * shapes: clipping the *same* drawing three times means the gradient, the ring and the monogram stay
 * continuous across the break — which is what makes it read as one object that has cracked rather
 * than three objects that were always there.
 */
export function crackWedges(centre = 60, radius = 80): string[] {
  return [
    `M${centre},${centre} L${centre - radius},${centre - radius * 0.35} A${radius},${radius} 0 0 1 ${centre + radius * 0.15},${centre - radius} Z`,
    `M${centre},${centre} L${centre + radius * 0.15},${centre - radius} A${radius},${radius} 0 0 1 ${centre + radius},${centre + radius * 0.55} Z`,
    `M${centre},${centre} L${centre + radius},${centre + radius * 0.55} A${radius},${radius} 0 0 1 ${centre - radius},${centre - radius * 0.35} Z`,
  ];
}

/**
 * The six wax colours a template can be built on, and the derived tones each one needs.
 *
 * `accent` is what the design already declares, so a template's seal matches its invitation without
 * anybody choosing twice. The rest are mixed from it: a lighter face for the crown of the seal, a
 * darker one for the shadowed edge, and a near-black for the embossed monogram.
 */
export const SEAL_VARIANTS = {
  gold: "#B08D57",
  burgundy: "#6B1F2A",
  emerald: "#1F4A3C",
  roseGold: "#B76E79",
  champagne: "#D8C49B",
  black: "#141414",
} as const;

export type SealVariant = keyof typeof SEAL_VARIANTS;

export interface SealPalette {
  /** The base wax. */
  face: string;
  /** Lit crown, mixed towards white. */
  light: string;
  /** Shadowed edge, mixed towards brown-black. */
  dark: string;
  /** The raised outer ring, a touch lighter than the face. */
  ring: string;
  /** The monogram, pressed *into* the wax, so it is darker than the face. */
  emboss: string;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((value) => clamp(value).toString(16).padStart(2, "0")).join("")}`;
}

/** `amount` towards `target`, 0..1. */
export function mix(hex: string, target: [number, number, number], amount: number): string {
  const [r, g, b] = parseHex(hex);
  return toHex([
    r + (target[0] - r) * amount,
    g + (target[1] - g) * amount,
    b + (target[2] - b) * amount,
  ]);
}

/** Warm brown-black rather than pure black: wax does not go grey. */
const WAX_SHADOW: [number, number, number] = [58, 40, 24];
const WAX_LIGHT: [number, number, number] = [255, 250, 240];

export function sealPalette(accent: string): SealPalette {
  const safe = /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : SEAL_VARIANTS.gold;
  return {
    face: safe,
    light: mix(safe, WAX_LIGHT, 0.34),
    dark: mix(safe, WAX_SHADOW, 0.55),
    ring: mix(safe, WAX_LIGHT, 0.18),
    emboss: mix(safe, WAX_SHADOW, 0.72),
  };
}

/** What is written in the wax: the couple's monogram, or their initials. */
export function sealMonogram(monogram: string | null, names: { groom: string | null; bride: string | null }): string {
  const given = (monogram ?? "").trim();
  // Six characters, and trimmed after cutting: slicing "K & N" to four leaves "K & " with a
  // dangling separator, which is what a monogram looks like when nobody checked.
  if (given) return given.slice(0, 6).trim();

  // First letters, in the direction the couple is written. Arabic letters stand alone, which is
  // what a monogram does anyway.
  const initials = [names.groom, names.bride]
    .map((name) => (name ?? "").trim().charAt(0))
    .filter(Boolean);
  return initials.length > 0 ? initials.join(names.groom && names.bride ? " و " : "") : "V";
}
