# T1 · Golden Palace — quality bar

**Status:** ACTIVE, written before any code was changed. The bar below does not move. If a criterion
turns out to be unachievable, it is reported as unmet with evidence — not reworded until it passes.

Every item names its **evidence**: a measurement, a screenshot, or a computed value. "Looks right" is
not evidence and will not appear here.

## A. The names

| # | Criterion | How it is proved |
|---|---|---|
| A1 | Both names sit **fully inside** the horseshoe arch — no glyph, diacritic or descender crosses either stroke | Screenshot at 375px; plus the bounding box of the names block measured against the arch's inner path box (`getBoundingClientRect` on `.t1__couple` vs the arch's inset geometry) |
| A2 | Names render at **44–52px** at 375px width | `getComputedStyle(.t1__name).fontSize` ∈ [44, 52] |
| A3 | Names use **Aref Ruqaa**, computed, not merely declared | `getComputedStyle(.t1__name).fontFamily` starts with `"Aref Ruqaa"`, and `document.fonts.check('44px "Aref Ruqaa"')` is true |
| A4 | Every other text element uses its specified face: verse **Amiri**, labels **Reem Kufi**, body **Noto Naskh Arabic**; EN names/verse **Cormorant Garamond**, labels **Cinzel** | computed `font-family` read per element and tabulated |
| A5 | **No visible background box** behind the names — the arch and paper only | screenshot inspection + `background-color` computed as `rgba(0, 0, 0, 0)` on the names block |
| A6 | Gold foil stays legible: every gradient stop **≥ 3:1** on ivory (large text) | computed contrast, all stops listed below |

**Measured palette contrast (before any change):**

| Pair | Ratio | Verdict |
|---|---|---|
| ink `#2B1B12` on ivory `#F6EEDC` | **14.34:1** | body text — AAA |
| burgundy `#6B1E2E` on ivory | **9.83:1** | AAA |
| emerald `#0F3D3E` on ivory | **10.35:1** | AAA |
| gold `#B8913A` on ivory | **2.54:1** | **fails even 3:1** |

Consequence, decided here and not later: **`#B8913A` is a decoration colour, never a text colour.**
Ornament strokes, rules and dividers may use it (they carry no meaning). The names use a deep foil
ramp whose lightest stop still clears 3:1:

`#6E531B → #8A6A24 → #9A7729 → #8A6A24 → #6E531B` — **6.23 / 4.36 / 3.60 / 4.36 / 6.23** : 1.

## B. The field and the ornaments

| # | Criterion | How it is proved |
|---|---|---|
| B1 | Khatam tessellation is **visible** and lands in the **6–8%** range | computed `opacity` on the pattern rect; screenshot at 100% crop showing star geometry readable |
| B2 | Zellige divider strips appear between sections, alternating star and diamond | screenshot + DOM count |
| B3 | Muqarnas corners present at the frame's top edge, mirrored | screenshot + DOM count = 2 |
| B4 | Arch draws in once (stroke-dashoffset), and under `prefers-reduced-motion` it is simply present | two screenshots (motion on / reduced), same final geometry |

## C. The seal and the envelope

| # | Criterion | How it is proved |
|---|---|---|
| C1 | Seal **centred on the flap tip**, not offset into the card | computed centre of `.seal` vs the flap apex at 375px |
| C2 | **Burgundy wax** (`#6B1E2E` family), not the design accent | computed fill of the wax shape |
| C3 | Imprint is the **brand mark** — a folded strip read as V (see `brand/monogram.mjs`; there is no leaf in the artwork) — crisp vector, no raster | DOM: an inline `<svg>` path set, no `<img>`; screenshot at 2× for crispness |
| C4 | **Raised rim**, inner embossed ring, **specular highlight**, soft outer shadow | four distinct elements present in the DOM + screenshot |
| C5 | Envelope is **emerald** with a gold **arabesque liner** revealed as the flap opens | screenshot mid-open and after |
| C6 | Opens on **first tap**, on **double tap**, and on a **tap during the animation** — all three end revealed, none double-fires | three runs, each asserting the invitation is visible and the seal gone |

| C7 | In `phase=sealed`, `document.elementFromPoint` **at the seal centre returns the seal button or a child of it** | a browser check run on **every release** — not a one-off probe. Against the deployed URL at 375px, AR and EN. Written after the seal turned out to be unreachable by touch for the layer above it (`opacity: 0` still hit-tests); the button was 330×220, focusable, and dead |

## D. Movement and stability

| # | Criterion | How it is proved |
|---|---|---|
| D1 | **CLS = 0** across load, opening and reveal, on a 4× throttled CPU | `layout-shift` observer, total rounded to 5 dp |
| D2 | Countdown cells keep **identical boxes** across ≥60 ticks | wrapper + 4 cells, max delta ≤ 0.5px |
| D3 | Motion uses only `transform` and `opacity` | grep of the T1 stylesheet for animated layout properties = 0 |
| D4 | Tap → visible invitation in **< 1 s** on the throttled profile | measured tap-to-`revealed` |
| D5 | `prefers-reduced-motion` yields a plain fade, no sequence | screenshot + computed `animation-name: none` on the arch |

## E. Bilingual, and the things already guaranteed

| # | Criterion | How it is proved |
|---|---|---|
| E1 | AR and EN both correct: direction, faces, labels, and the switch does not move the dialog or the page furniture | screenshots of both + `dir`/`lang` computed |
| E2 | Per-guest personal line present, in the verse face, under the greeting | DOM + screenshot |
| E3 | Venue icons and the dialog keep working, CLS 0 on open/close | re-run `tests/browser/venue-dialog.mjs` |
| E4 | Warm copy unchanged | the copy slots render the operator's text verbatim |

## The gate before any commit that touches the sealed state

**Any change affecting the sealed state requires a screenshot before commit, even if measurement takes only a few minutes.**

Written after the 2026-11-20 incident, in which three fixes to the sealed state shipped in one commit
without a screenshot of the result. The rule is stated as a requirement rather than a lesson because a
lesson is what everyone already had.

## Status of the sealed-state contracts

| # | Status | Why |
|---|---|---|
| C1 | **UNVERIFIED** | no measured centre of `.seal` against the flap apex at 375px |
| C3 | **UNVERIFIED** | no 2× screenshot of the imprint |
| C5 | **UNVERIFIED** | no screenshot mid-open and after |
| D | **UNVERIFIED** | no run of the CLS / countdown / tap-to-reveal measurements |
| E | **UNVERIFIED** | no AR/EN screenshots of the sealed and open states |

A1–A5 and B1–B3 keep whatever status the earlier evidence gave them. They are evidence about the
**names, the field and the ornaments** — not about the envelope, the seal or the opening. They must not
be read as proof that the sealed state works. No status above moves, and no "after" value is written,
without direct visual verification.

## What "done" means

Each row above has evidence attached in the report. A row without evidence is reported as
**UNVERIFIED**, with the reason — not as passed. Guesses, "should be fine", and reading the code are
not evidence for anything in section A, C or D.