# DESIGN.md — the template system

The single source of truth for how a Velora invitation looks. Written so template T7 and T24 do not
each reinvent a palette, and so a future agent can add one without asking what a "muted ink" is.

Authoritative reference for what each template *is*: `docs/TEMPLATES.md` (24 templates).
Quality bar for the first one: `docs/T1-QUALITY.md`.

---

## 1. Palette roles

Five tokens, each with one job. A colour that appears in two roles is a palette that has not been
thought through.

| Token | T1 value | Role | May it be text? |
|---|---|---|---|
| `ivory` | `#F6EEDC` | the paper — backgrounds, the light half of a dark ornament | on dark grounds only |
| `gold` | `#B8913A` | the metal — rules, strokes, foil, the seal's imprint | **no** — 2.54:1 on ivory |
| `emerald` | `#0F3D3E` | an ornament colour: the arch's inner stroke, deep accents | yes → 10.35:1 on ivory |
| `burgundy` | `#6B1E2E` | an ornament colour: wax, accent rules | yes → 9.83:1 on ivory |
| `ink` | `#2B1B12` | **the only colour body text may use** | yes → 14.34:1 on ivory |

**The rule that follows:** gold is decoration. If a piece of text must be gold, it is drawn with the
foil ramp (§1.1), whose stops are deliberately darker than the ornament gold.

### 1.1 The gold foil ramp

A gradient clipped to the glyphs; it reads as metal because the light moves across it, not because it
is bright.

```
#6E531B → #8A6A24 → #9A7729 → #8A6A24 → #6E531B
  6.23      4.36      3.60      4.36      6.23   :1 on ivory
```

Every stop clears **3:1**, which is the bar for large text — the names are 44–52px. The sheen is a
`background-position` animation on a 240%-wide gradient: paint only, never layout.

---

## 2. Font stacks

Self-hosted, subset, `font-display: block` above the fold (see `scripts/fonts.py`), with
metric-matched fallbacks where one exists (`scripts/font-fallbacks.py`).

| Role | Arabic | Latin |
|---|---|---|
| Couple's names | Aref Ruqaa | Cormorant Garamond |
| Verse / quote | Amiri | Cormorant Garamond |
| Labels, small caps | Reem Kufi | Cinzel |
| Body copy | Noto Naskh Arabic | Cormorant Garamond |

- **IBM Plex Sans Arabic is admin-only** and must never appear on `/i/<token>`.
- Arabic never takes `letter-spacing`; labels use `font-size` and weight instead.
- Sizes at 375px: names 44–52px, verse 15.7px (0.98rem), labels 11.2px (0.7rem), body 15px.

---

## 3. Ornament specifications

Generated SVG, no downloads, no raster. All strokes are `currentColor` so the palette reaches them.

| Ornament | Recipe | Numbers |
|---|---|---|
| **khatam field** | two equal squares, one rotated 45°, in a `<pattern>` | tile 68px, stroke 0.9px, opacity **0.07**, plus a lattice cross at 50% |
| **mihrab arch** | straight sides to 55% height, horseshoe curve, pointed apex; drawn twice | outer stroke 1.6px gold, inner 1px emerald, inset 8px |
| **muqarnas corner** | three stacked arcs of decreasing radius + one echoed at 0.35 opacity | 56×56, stroke 1px, opacity 0.55 |
| **zellige strip** | alternating eight-point star and diamond tiles | tile 26px, height 22px, stroke 0.9px |
| **star divider** | two rules with a four-point star between | 160×16, stroke 0.9px |

---

## 4. Spacing rhythm

A single 4px base. Section rhythm is by role, not by eye:

| Between | Space |
|---|---|
| eyebrow → names | 14px |
| names → divider | 24px |
| divider → verse | 20px |
| verse → personal line | 12px |
| personal line → countdown | 32px |
| countdown → venues | 40px |
| venues → programme | 40px |
| programme → RSVP | 40px |

Page inset is 20px at 375px; the royal frame sits at 10px from the edge with a 5px inner line.

---

## 5. Motion

| Element | Property | Duration | Easing |
|---|---|---|---|
| seal crack | `transform`, `opacity` per piece | 620ms | `cubic-bezier(0.3, 0, 0.2, 1)` |
| flap open | `transform: rotateX` | 900ms | `cubic-bezier(0.22, 0.61, 0.36, 1)` |
| arch draw | `stroke-dashoffset` | 1400ms, 240ms delay | `cubic-bezier(0.22, 0.61, 0.36, 1)` |
| foil sheen | `background-position` | 9s infinite | `ease-in-out` |
| countdown digit | `opacity` only | 160ms | `linear` |

**Never animated:** `width`, `height`, `top`, `left`, `margin`, `padding`, `filter: blur()`.
`prefers-reduced-motion` removes the sequence rather than shortening it: arch at `stroke-dashoffset: 0`,
foil static, no pulse, no crack travel.

---

## 6. What a template may change, and what it may not

A template owns: palette (five values), the four font roles per script, the ornament set, the seal
(shape, wax, imprint), the envelope (paper, liner), the opening type, the composition and the density
of the rhythm.

A template **may not**: change the type scale (44–52px names is the legible range at 375px), change the
countdown's fixed cells, introduce a raster ornament, or animate layout properties.

An **operator override** may change: the five palette values, and the names/verse faces. Body and
label faces are fixed by the template — they are what keeps the invitation readable, and a design that
is elegant in the editor and illegible on a phone is a failed design.

---

## 7. The seal

Both T1 and every later template use the **brand mark** as the imprint. The mark is a single strip of
card, folded once, read as the letter V — the construction and its reasoning are in
`brand/monogram.mjs`, and the geometry is generated there, never drawn by hand. It is drawn as vector
paths inside the wax, not placed as an image, so it stays crisp at any size and inherits the wax's
shading.

**There is no leaf in it.** `SPEC.md` records the alternative — a serif V carrying a botanical spray —
as decision **D4**, and notes that it *conflicts with the brief*, which asks for "a folded invitation
or refined paper geometry" and rules out excessive flourishes. The folded strip is what was built.
This paragraph said "the V-and-leaf" until a G2 extraction showed the artwork has two paths and no
leaf; the wording was the drift, not the drawing.

| Part | Spec |
|---|---|
| wax body | irregular edge (seeded path, three soft drips), radial gradient from a light crown to a dark edge |
| raised rim | stroke at 18% towards white, 2.2px |
| inner ring | dark line 1.6px at 42% + light line 0.9px just inside it |
| imprint | brand mark (a folded strip, read as V), pressed: inner shadow, 88% opacity of the darkest wax tone |
| highlight | off-centre ellipse at 36%/28%, white at 50% falling to 0 |
| shadow | drop shadow, 3px y-offset, 3.2px blur, 42% of a warm brown-black |
| crack | three wedges clipped from one drawing, so gradients and rings stay continuous until they part |

Colour variants: burgundy (T1), gold, emerald, rose gold, champagne, black. The wax is chosen by the
template's seal spec — never by the palette accent, which is how a gold seal appeared on a burgundy
template once already.

---

## 8. The reference image, and the directions

**`assets/brand/reference/envelope-reference.jpg`** is the operator's target image for the opening.
It lives under `assets/`, not `public/`: it is a thing to compare renders against, not an asset to
serve to a guest's phone.

It shows the **open** state — matte emerald cotton envelope, the flap folded back over a dark green
botanical lining, an ivory card rising above the wings, burgundy wax at the wing junction with two
thin gold sprigs beside it, soft light from the top left. There are three of them, and together they are the three states G3 has to build:

| File | State | What it settles |
|---|---|---|
| `envelope-reference-sealed.jpg` | **sealed** | the closed composition: flap down over the front, its two edges meeting at the seal, gold hairline along every fold edge, the two sprigs lying along the flap edges, the seal on the vertical axis at the closure point |
| `envelope-reference-opening.jpg` | **opening** | the flap standing at 180°, the lining fully revealed with its gold botanical print and frame, the card risen about half way, the wax in **three broken wedges resting on the front panel**, and the particles rising above where the seal was |
| `envelope-reference.jpg` | **open / final** | the card out above the wings, the lining behind it, the ornament at rest |

All three are the target for **materials, lighting, proportions and ornament**. None is a colour
specification — colours come from `tokens.css` and the contrast rules.

Two geometry notes to carry into G3. In the sealed reference the flap's lower edge is a **shallow V**
across the upper half of the envelope, not the deep triangle the current build draws
(`clip-path: polygon(0 0, 100% 0, 50% 100%)`, whose apex reaches the flap's own bottom) — the seal
sits where that shallow V meets the vertical axis, a little above the envelope's midline. And in the
opening reference the broken wax stays **on the front panel** rather than falling away; the current
build animates the three pieces down and out to `opacity: 0`.

The seal in all three carries a serif **V with a leaf spray**. The brand mark is not that, and
`SPEC.md` D4 is where that was decided. **Do not copy the placeholder mark from any of them.**

| Direction | State |
|---|---|
| **A — Pressed Wax** | **approved.** The seal rebuilt as pressed wax; flap, lining and card given real materials; the mark revealed by wiping its own lit plane. See §9 for the decisions taken under it. |
| **B** | recorded, not chosen |
| **C — Palace Gate** | recorded as a **future template only**. Its brief has not been written down here and nothing is built; no current decision depends on it. |

---

## 9. Decisions taken under Direction A

Recorded as taken, with the evidence that forced them. Where a decision contradicts an earlier
document, the earlier document is corrected rather than left to disagree.

| # | Decision | Why |
|---|---|---|
| A-1 | The envelope and seal layers are **direction-neutral** — physical offsets or an explicit `direction: ltr` on `.envelope`, never a logical inset with a physical offset | `/i/` is an RTL document even when `?lang=en`; only the invitation canvas goes LTR. `inset-inline-start: 50%` with `translate: -50%` put the seal 97.5px off-centre in **both** languages. Fixed in `b623464`, measured delta 0.00px in AR and EN |
| A-2 | Every decorative layer stays **inside** the seal button; the disc keeps `pointer-events: none` | The button is `inset: 0` and wraps the whole envelope, so the topmost hit target is always one of its own children. A decorative layer placed outside it silently kills the touch — which is what happened before `01eb103` |
| A-3 | The reference image is filed under `assets/`, and the brand geometry stays in `public/brand/*.svg` + `brand/monogram.mjs` | There is no `assets/brand/` source directory in this repository. `public/` is for things that are served; the reference is not |
| A-4 | The mark's reveal is a **mask wipe over its own paths**, not a stroke draw and not a leaf unfurl | The brand file is filled geometry with no `stroke`, so `stroke-dashoffset` would require re-outlining it. And there is no leaf to unfurl — see §7 |
| A-5 | The two gold botanical sprigs are **ornament around the seal only**. The mark itself stays the folded strip | The operator's decision on the G2 gate. The sprigs are what R7 and `docs/TEMPLATES.md` call ornament, so they can be drawn fresh; the identity of the mark does not move because a reference photograph of a concept contained one |

### 9.1 The build order for G3 — one layer, one screenshot, before the next

Written down so it cannot become a blind rewrite, and because the alternative — writing the whole
engine at once — is exactly how a regression ships unseen.

| # | Layer | Proved by |
|---|---|---|
| 1 | the box: body, wings, front panel, the fold lines | harness screenshot at 375px; `.envelope` still 330×220 |
| 2 | the flap: opaque, shallow-V lower edge, lit edge, gold hairline, shadow onto the panel | ditto, plus `clip-path` read back from the computed style |
| 3 | the lining: the flap's inner face, botanical print, gold frame | screenshot with the flap at 180° |
| 4 | the card: ivory cotton, colourless emboss, gold star on a rule | screenshot, card at 0% and at 50% |
| 5 | the seal: pressed wax, the original mark in muted gold | screenshot at 2×; the mark measured as a share of the inner disc |
| 6 | the ornament: the two sprigs flanking the seal | screenshot at 2× |
| 7 | the sequence: timing, the leaf-free mark wipe, particles, reduced motion | state-by-state screenshots, then the timing table |

The iteration environment is not the app: this sandbox cannot run Next.js. It is a static page that
loads the **real** `invitation.css` and mirrors the component's DOM exactly, and it prints what it
measured (stylesheet loaded, rule count, `.envelope` box) so a broken link cannot be mistaken for a
styling choice. A layer is not done because the harness likes it — it is done when the same markup is
in `WaxSeal.tsx` and the deployed page agrees.
