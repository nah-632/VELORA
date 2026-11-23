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

### 1.0 The palette as sampled from the references

Method, so the numbers can be re-derived: Python 3.12 + Pillow 11 + NumPy 2 — every pixel of the
941x1672 reference that passes a colour filter, value = median per channel; pixel counts are the
number of matches, not a guess.

| Role | **sealed** (`entrance-target.png`) | n | **broken** (`entrance-target-broken.png`) | n |
|---|---|---|---|---|
| wax | `#650E18` (5% `#5B0211`, 95% `#B85055`) | 5,020 | `#641A1E` (95% `#BA5F53`) | 6,333 |
| gold — line and leaves | `#BE925E` | 17,712 | `#C0915D` | 20,390 |
| envelope emerald | `#192A21` | 386,989 | `#15241E` | 354,607 |
| card cream | `#ECD2B8` | 418,738 | `#EED3B8` | 510,498 |
| ground beige | `#E6CAAE` | 656,775 | `#E9CDB1` | 725,057 |

**Correction to an earlier report.** The column above filed as "opening" is the **broken** state.
`entrance-target-opening.png` held the broken photograph until the rename commit; the labels here are
the corrected ones. The two columns also differ more than noise: the broken state is lit slightly
differently, which is why the entrance takes its emerald from the sealed column and its liner from the
broken one — the liner is only ever visible in the broken and opening states.

Measured contrast against the card cream `#EED3B8`: wax **8.99:1**, emerald **10.50:1**, gold
**1.96:1**. Gold is a decoration colour, confirmed by measurement rather than by taste.

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

Three photographs, one per state the entrance has to reach, filed in `assets/reference/`. They are the
target for **materials, lighting, proportions and ornament** — not a colour specification (colours
come from §1 and the contrast rules) and not a pixel spec.

| File | State | What it settles |
|---|---|---|
| `entrance-target.png` | **sealed** | flap down over the front, its two edges meeting at the seal, a hairline gold line along every fold edge, the sprigs lying along the flap edges, the seal on the vertical axis at the closure point |
| `entrance-target-opening.png` | **flap open, seal intact** | the flap at 180° with the lining visible behind it, the wax **whole** at the closure point, the card only part way out |
| `entrance-target-broken.png` | **seal broken** | the wax in three wedges resting on the front panel, gold dust above where it sat, the card raised, the lining behind it |

Naming note, because it cost a wrong review: `entrance-target-opening.png` held the **broken** state
until a rename commit (`docs: rename broken-seal reference`). "Opening" is the flap at 180° with the
seal whole; the broken state is a different photograph. The older `assets/brand/reference/*.jpg`
copies are the same three images filed earlier under descriptive names — the copies under
`assets/reference/` are the ones the entrance is measured against.

Two of the three are JPEG payloads under a `.png` name. That is what was asked for and the md5 is the
contract, but a tool that sniffs the container will see JPEG — worth knowing before one of them is
ever fed to an image pipeline.

Their seals carry a serif V with a leaf spray. The brand mark is not that, and §7 says why. **Do not
copy the placeholder mark from any of them.**

### 8.0 The card's entrance — choreography, for step (c)

**What this covers.** The invitation card inside the envelope — not the hall cards, which keep **no**
entrance animation (they are opened many times a session and a stagger there is a tax on every use).
Recorded here as a plan only: **no motion is implemented in this commit.**

Cast, with the file each element lives in:

| Element | Role | Where |
|---|---|---|
| wax pieces ×3 | Decoration — they are the tap's acknowledgement, not the message | `invitation.css:346` |
| gold particles, 6–10 | Decoration | `WaxSeal.tsx` `.seal__mote` |
| flap | Support — the gate, not the gift | `invitation.css:213` |
| **the card** | **Lead** | `invitation.css:251` |
| sprigs, drawn | Support | drawn with `stroke-dashoffset` |
| arch | Support | `invitation.css:1015` |
| guest name | Support — the personal moment | `invitation.css:176` |
| entrance overlay | Static — removed, never animated out | `invitation.css:435` |

| Element | Starts | Duration | Motion | Relationship |
|---|---|---|---|---|
| tap feedback | 0ms | <100ms | `transform: scale(.985)` | — |
| wax pieces | 0ms | 560ms | drop **a few px and stay on the envelope face**; no fade | with the tap |
| particles 6–10 | 180ms | 820ms | rise 10–18px, fade | overlaps the crack's tail |
| flap | **first crack clearly visible**, then | 620ms | `rotateX(-172deg)` | overlaps only the crack's **tail** |
| the card | after the flap has cleared the pocket | 900ms | `translateY` out of an `overflow:hidden` window | overlaps the flap |
| sprigs | with the card | 700ms | `stroke-dashoffset` | overlaps the card |
| arch | after the card settles | 1160ms | `stroke-dashoffset` | overlaps the card's settle |
| guest name | 780ms after the tap | 1200ms | mask wipe, logical direction | overlaps the arch |
| overlay removed | **2000ms** | — | zero layout change | — |
| failsafe | **2500ms** | — | forces the invitation open wherever the sequence is | — |

**Order is not negotiable:** wax cracks → flap → card. The flap must not move before the first crack
is legible; that is the cause-and-effect pairing, and reversing it reads as the envelope flinching.

**The card carrying the invitation is a PROPOSAL**, not a decision. Today the card rises and the
invitation fades in beside it — two entrances for one object, which is what makes the opening feel
like a queue. Whether to restructure the DOM so the card *carries* the invitation is decided in B2,
**after the card's geometry is measured**. Nothing is restructured now.

**RTL (§19).** Everything above is vertical — `translateY`, `rotateX`, `scale` — so no direction can
be got wrong. The guest name's wipe is the only directional motion; it is expressed once with a
logical `--wipe-angle` set per `[dir]`, not duplicated as two rules. Particles drift symmetrically
about the vertical axis so neither language gets a bias.

**Reduced motion** collapses the choreography rather than shortening it: no delays, no movement, a
300ms cross-fade to the end state.

### 8.06 The card — the decision, and the measurement that is still owed

**Decision: the card carries the invitation. Yes.** One entrance per container.

Today two things enter at once, on the same pixels: `.envelope__card` (900ms, delay 180ms) rises
while `.invitation-reveal` (700ms, delay 200ms) fades in beside it. That is two entrances for one
object, and it is why the opening reads as a queue rather than a gesture. The card is what the guest
is being handed; the invitation is what is printed on it. So the card moves and the invitation travels
with it — the *Carry* relationship, not two siblings performing the same gesture.

What this commits us to, when the card is built:

  * the invitation loses its own entrance animation entirely. No fade, no delay of its own.
  * its position comes from the card's transform, so there is one moving object and one thing to keep
    in sync — not two.
  * the overlay is still removed at 2000ms with **zero layout change**, so removal cannot shift
    anything a guest is already reading.

**Hall cards: no entrance animation.** They open many times in a session, and the choreography
rule against staggering a high-frequency surface applies. They are simply there.

**MEASUREMENT OWED, and B2 is blocked on it: the card's top edge as a percentage of the envelope
height, for state 2 and state 3 separately.** Attempted and **UNVERIFIED**:

  * the card is `#EDD2B7` and the ground is `#E9CDB1` — four levels apart on every channel, so no
    threshold separates them;
  * a per-column luminance profile down the middle is noise at that margin;
  * a full-row mean, which should average the margin down to a clean step, was killed by the sandbox
    before it produced output.

The reference states cannot be opened by "the card looks like it starts about here". What would
resolve it: the card's own edge — a thin shadow line or the gold border the brief asks for — measured
row by row across the middle 60% of the width, which is a job for a machine that is not currently
running out of memory.

### 8.05 The fold lines — the measured geometry, which is not a clip edge

**This replaces an assumption.** The pocket and the flap were both built on the idea that the fold
lines meet where the seal sits, at the closure point (50%, 54.8%). They do not. Fitted on
`entrance-target.png` with RANSAC over the centres of gold runs — columns 8%–30% of the envelope
width on the left and 70%–92% on the right, the two lines on a side separated by **slope sign** with a
25–55° gate, inliers within 2px (the earlier attempt separated them by the closure point and came back
with 72° and 70°: it was fitting the gold botanical print):

| Line | Slope (image px) | Angle | Edge start | Inliers |
|---|---|---|---|---|
| upper-left | +0.8304 | **39.7°** | **13.8%** of H | 120 |
| lower-left | −0.7836 | **38.1°** | **85.9%** | 79 |
| upper-right | −0.8287 | **39.6°** | **14.0%** | 101 |
| lower-right | +0.7901 | **38.3°** | **86.4%** | 129 |

The left pair meets at **(34.4% W, 50.9% H)** and the right pair at **(65.4% W, 51.1%)** — at the
**sprig bases**, not at the seal. The lines stop there; the seal sits in the gap between them.

Consequences, and they are implemented as such:

  * the four lines are **independent SVG paths**, each from its edge start to its pair's meeting
    point. They are not attached to the pocket's or the flap's clip-path edge, because neither edge
    is where they are.
  * the flap's clip apex **stays 54.8%** — that is the flap's own fold, and a separate thing from
    where the gold is drawn.
  * the gold takes its colour from a **CSS class** (`stroke: var(--env-gold)`), never from a
    `stroke="var(...)"` attribute — that is invalid, falls back to `currentColor`, and is how these
    lines were once drawn in near-black on near-black paper. `tests/ui/check-svg-vars.mjs` refuses it.

**Deferred:** the envelope's rounded corners. The fits start at the outer edge of a rectangle; the
reference's corners are rounded, so the line's true start is a little inside. Recorded as a later
polish item, not worked on.

### 8.1 Liner polish, deferred

**liner polish: lighting + denser, finer line-art.** Accepted as a later item and deliberately not
worked on now. The liner is a flat `#14231D` fill with a 0.26-opacity botanical print; the reference's
lining carries its own lighting and a print that is both denser and finer. Measured spread across the
reference's lining: `#161817` on the dark body, `#21261D` near a lit edge, `#50412E` on a print stroke.

### 8.2 Idea sources and deferred items

Recorded so the provenance is not lost, and nothing here is implemented yet. **No code, texture file,
token or dependency from any of these has been imported**; they are ideas, and the implementation
stays plain CSS and SVG with our own easing and timings — smooth, not stepped.

- **Step (c), the card emerging** — ideas taken from the *Receipt Printer* experiment at
  `dqnamo.com/kitchen`, reuse stated as fine by the operator: an `overflow: hidden` window the card
  slides out of with `translateY`; an explicit stage state machine `sealed → cracking → opening →
  complete`; a soft contact shadow under the emerging card; reduced motion = 300 ms cross-fade.
  **Not** imported: `motion/react`, Phosphor icons, its texture files, its grayscale tokens.
  *No literal value or line of code was copied, so there is nothing to attribute line by line.*
- **Step (c), "sprigs draw" and "arch draws"** — `stroke-dashoffset` on SVG paths: outline traced
  first, then the fill fades in. Idea source: dqnamo **Logo Trace Loader** (MIT, on 21st.dev).
  If any code is ever copied from it, its copyright notice comes with it. Reduced motion = the static
  final state, or a 300 ms cross-fade.
- **Step (e), the couple-name sheen** — a slow gold gradient sweep, decoration only; the text colour
  stays ink or deep gold so contrast keeps passing. Idea source: dqnamo **Iridescent Foil**.
  **Licence NOT verified.** Do not copy code from it. Gold only, no rainbow.
- **Deferred, not planned:** perforated card edge (Ticket), postage frame (Stamp), a drawn signature,
  hold-to-confirm RSVP.

| Direction | State |
|---|---|
| **A — Pressed Wax** | **approved and being built.** Burgundy wax seal with the brand mark pressed in, the crack, the flap opening on its hinge, the arch drawing itself. |
| **B** | recorded, not chosen |
| **C — Palace Gate** | recorded as a **future template only**. Nothing is built, no decision depends on it, and it must not appear in the code until it is scoped as a template of its own. |
---

## 9. The cream palette, and the luxe composition (2026-11-23)

### 9.1 The decision

The owner's prototype `velora-invitation-luxe.html` carries its own palette, and the invitation now
uses it **instead of** the brand tokens — for the `/i/<token>` subtree only.

| Token | Value | Role |
|---|---|---|
| `--vi-paper` | `#F1DEC6` | the page |
| `--vi-paper-2` | `#E8CFB1` | the hero's recessed cream |
| `--vi-ink` | `#2B1B12` | body copy |
| `--vi-muted` | `#5C4636` | secondary copy |
| `--vi-gold` | `#BE925E` | **decoration only** — arch, rules, icons, rings. 2.14:1 on the paper: it can never carry words |
| `--vi-gold-deep` | `#7A5220` | **the text gold.** 5.24:1 on the paper, 4.58:1 on the recessed cream |
| `--vi-foil-1/2` | `#946828` → `#7A5220` | the names, through `background-clip: text` (large text: 3.75:1 / 5.24:1) |
| `--vi-em / --vi-em-d / --vi-em-l` | `#192A21` / `#0F1913` / `#2E4539` | the two bands |
| `--vi-gold-light` / `--vi-on-em` | `#DCB27F` / `#CDB591` | text on emerald only |
| `--vi-error` | `#FFD9D3` | the one non-gold colour; 11.56:1 on the band |

**Why it is scoped and not global.** A wedding invitation is a document, not a screen of the product.
The studio, the catalogue and the admin console must not change colour because a guest page did, and
the entrance gate above this subtree keeps the brand tokens it was measured against. Everything lives
under `.vi` in `src/styles/luxe.css`; `tokens.css` is untouched.

**Dark mode is guarded, as the owner wrote it:** `@media (prefers-color-scheme: dark)
:root:not([data-theme="light"]) .vi` plus `:root[data-theme="dark"] .vi`. An invitation explicitly
shown light is not repainted by a dark device.

**Every pair is measured, not asserted.** `scripts/check-contrast.py` now reads `luxe.css` as a
second source and measures 16 cream pairs (35/35, 0 required failures). It reads only the *light*
`.vi` block on purpose: the file redefines seven of those values for dark mode, and a naive read
would have measured dark ink against light paper and reported a comfortable pass.

### 9.2 What the composition replaced

- The hero is now the kicker, the mihrab arch, the names inside it, the lead, the couple's own
  sentence, the real date, the personal line and the verse — from real event data and the v1 copy
  system. **The template card is gone from the guest page.** `GoldenPalace` and `TemplateCanvas`
  printed the names, the date and the venue a second time; that duplication was the owner's question
  (c). The template still supplies the entrance (seal imprint, envelope paper, wax, liner) and the
  accent the venue icons take, so nothing about the gate changed.
- The page has **two** emerald bands (countdown, RSVP) with 30px top corners, a frameless pair of
  halls, a programme timeline, and a footer that carries the tagline.
- The date appears **once** in the hero and **once** as the operator's own sentence under the
  countdown — down from three printings.

### 9.3 Still open

- The seam defect on the envelope is **not** part of this order and is **not** closed. It stays on
  the list.
- P1 in `docs/PROPOSALS.md` (`?open=1`) is still proposed, not approved.
- The hall icons are the product's own line art at 72px in `--vi-gold`, which is deliberately faint
  on cream. If the owner wants them read as more than ornament, that is a palette decision, not a
  bug.
