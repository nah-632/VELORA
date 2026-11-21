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

### 5.1 The opening sequence — about 2s, end to end

Written before the component, because the order *is* the design. Only `transform` and `opacity` are
animated; nothing here touches layout.

| t (ms) | What happens | Property |
|---|---|---|
| 0–100 | tap feedback on the seal; optional device vibration | `transform`, `opacity` |
| 100–700 | the wax cracks along the V into three wedges, which settle **on the front panel** | per-piece `transform`, `opacity` |
| 250–900 | the mark's lit plane draws in under a sweeping mask edge | `mask-position` |
| 350–1250 | 6–10 gold particles drift up and fade | per-mote `transform`, `opacity` |
| 700–1500 | the flap opens on its top hinge, revealing the lining | `rotateX` |
| 900–1700 | the card rises out of the envelope | `transform` |
| 1400–2400 | the arch draws, then the content settles | `stroke-dashoffset`, `opacity` |
| 2400 | the entrance overlay is removed; the invitation underneath is what remains | — |

**Failsafe:** at **2500ms** the invitation is forced open wherever the sequence has got to. A guest
never watches an animation that has stopped.

**Reduced motion:** not a shorter sequence — a **300ms cross-fade** straight to the invitation.

### 5.2 The rest of the page

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

The imprint is the **brand mark**: a gold V whose left stroke is thick and carries a flat top serif,
whose right stroke thins to the vertex, and from which a stem sweeps into an open loop and rises as a
branch of pointed leaves with visible veins, ending in a small curled tendril.

**The geometry is a trace of the operator's own logo**, not a drawing of it —
`assets/brand/velora-mark.svg`, produced with potrace and copied through unchanged. It replaced a
folded-ribbon monogram that had been generated here (`brand/archive/monogram.mjs`, archived, used
nowhere): that ribbon is not the operator's mark and has no leaf. Earlier documents called the ribbon
"the V-and-leaf", which was wrong in the other direction — the leaf was in the real logo all along.

The sequence (§5.1) says the branch draws itself. It does — but not with `stroke-dashoffset`: the mark
is *filled* geometry with no `stroke` anywhere, so a dash offset would first require re-outlining it,
which changes its shape at every size. The branch is revealed by **a mask edge sweeping across the
existing paths**, which is the same gesture and leaves the artwork untouched.

| Part | Spec |
|---|---|
| wax body | organic lobed edge with soft drips, radial gradient from a light crown to a dark edge |
| raised rim | stroke 18% towards white, 2.2px |
| recessed centre | dark line 1.6px at 42% + light line 0.9px just inside it |
| imprint | the brand mark in **muted gold**, pressed with an inner shadow; **55–60% of the inner disc at 92px — measured in a browser, not calculated** |
| branch reveal | a sweeping mask edge, so the leaf draws without the geometry being redrawn |
| highlight | one off-centre ellipse, white at 50% falling to 0 |
| contact shadow | drop shadow, 3px y-offset, 3.2px blur, 42% of a warm brown-black |
| grain | inlined noise; no file, no dependency |
| crack | three wedges clipped from one drawing, so gradients and rings stay continuous until they part |

Colour variants: burgundy (T1), gold, emerald, rose gold, champagne, black. The wax is chosen by the
template's seal spec — never by the palette accent, which is how a gold seal appeared on a burgundy
template once already.

---

## 8. The reference images, and the directions

Three photographs, one per state the entrance has to reach, filed in `assets/brand/reference/`. They
are the target for **materials, lighting, proportions and ornament** — not a colour specification
(colours come from §1 and the contrast rules) and not a pixel spec.

| File | State | What it settles |
|---|---|---|
| `envelope-reference-sealed.jpg` | sealed | flap down over the front, its two edges meeting at the seal, a hairline gold line along every fold edge, the sprigs lying along the flap edges, the seal on the vertical axis at the closure point |
| `envelope-reference-opening.jpg` | opening | the flap at 180°, the lining with its botanical print and frame, the card risen about half way, the wax in **three broken wedges resting on the front panel**, particles rising above where the seal was |
| `envelope-reference.jpg` | open / final | the card out above the wings, the lining behind it, the ornament at rest |

Their seals carry a serif V with a leaf spray. The brand mark is not that, and §7 says why. **Do not
copy the placeholder mark from any of them.**

| Direction | State |
|---|---|
| **A — Pressed Wax** | **approved and being built.** Burgundy wax seal with the brand mark pressed in, the crack, the flap opening on its hinge, the arch drawing itself. |
| **B** | recorded, not chosen |
| **C — Palace Gate** | recorded as a **future template only**. Nothing is built, no decision depends on it, and it must not appear in the code until it is scoped as a template of its own. |