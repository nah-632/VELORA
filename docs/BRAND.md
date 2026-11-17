# VELORA — brand guidelines

Status: **living document, Milestone 2 in progress.** Everything here is derived from something
that was measured or rendered, not chosen by eye.

## 1. The mark

**One strip of card, folded once, read as the letter V.**

The brief asks the monogram to explore the letter V through "a folded invitation or refined paper
geometry", and explicitly rules out crowns, hearts, rings and flourishes. The mark contains no
borrowed wedding symbol: it is a single strip, folded at its middle, with a paper cut at each end
and the folded edge squared off where it faces the viewer.

### Why it is built this way

| Decision | Reason |
|---|---|
| The fold is shown by **tone**, not by a drawn line | A crease drawn as a hairline disappears at 24px and turns to grey mush at 16px. A tonal difference between two planes survives to the smallest size. |
| The silhouette is drawn under the lit plane | Painting the union first prevents an antialiasing hairline along the crease — exactly where a two-shape construction shows a seam. |
| The ends are cut **perpendicular to the strip** | What a cut strip actually looks like; it is what separates the mark from a generic chevron. |
| The point is **squared into a flat foot** | A true miter spikes to y≈31 on a 32 grid, past the artwork, and reads as a blade. |
| **Nothing finer than 1 unit** on a 32 grid | In one colour the planes merge into a clean solid V. Nothing breaks; nothing degrades badly. |

### The first attempt failed, and why it is recorded here

The mark was first built as **two separate arm triangles with one tonally lighter**. Every
argument above still applied on paper. Rendered at 160px it read as **two blades, or a pair of
misplaced highlights** — because the tone break sat between two *disjoint* shapes instead of
across a fold. A single-band construction fixed exactly that.

**A design that has not been rendered has not been designed.** This is the same failure mode that
produced the `#`-comment catastrophe in `tokens.css` in the same week: a document that reads
correctly and behaves incorrectly.

## 2. Assets

All variants are generated from one source — `brand/monogram.mjs` for the mark,
`scripts/build-wordmark.py` for the wordmark — by `npm run brand:build`, which runs the wordmark
first because the lockup composes both. They cannot drift apart, and the build is deterministic,
so a diff of `public/brand/` is a diff of the mark.

| File | Use |
|---|---|
| `monogram.svg` | `currentColor`; inherits the surrounding text colour. The site's default. |
| `monogram-obsidian/-ivory/-gold.svg` | Fixed colour, for exports, documents and print. |
| `monogram-mono.svg` | Single tone: foiling, embroidery, one-colour print. |
| `wordmark.svg`, `wordmark-obsidian/-ivory.svg` | The wordmark as outlines. |
| `lockup.svg`, `lockup-obsidian/-ivory/-mono.svg` | Mark + wordmark at the sanctioned relationship. |
| `src/app/icon.svg` | Application icon and favicon, served at `/icon.svg`. |
| `preview.html` | The construction, size ladder, specimen and lockup, on the real subsets. |

### The wordmark is outlines, and here is why that is checked

The letters V E L O R A are converted to paths from **the shipped Cormorant Garamond subset**,
instanced at weight 400 — not from a system serif, and not from a `<text>` element. A wordmark is
artwork: set as live text it renders differently on every machine that opens it, reflows when a
webfont fails, and cannot be handed to a printer or an embroiderer.

`npm run test:brand` enforces that: no `<text>`, no `font-family`, no `<tspan>`, no linked
webfont in any generated SVG. It also checks that the lockup carries the mark's **exact** path data
and the wordmark's **exact** outlines, so a composed file cannot silently drift from its parts.

## 3. Size and clear space

- **Minimum** 16px on screen, 12mm in print. Below that it is a coloured square; use the wordmark.
- **Clear space** half the mark's width on every side. Measured from the mark's own bounding box,
  not from the artwork file.
- The mark is **never mirrored** for Arabic. A monogram is a mark, not a text run; mirroring would
  make one product look like two.

## 4. Type

| Role | Family | Weight | Note |
|---|---|---|---|
| Arabic display | Aref Ruqaa | 400, 700 | Calligraphic Ruqaa. **Minimum 24px**, and never body copy or interface chrome. |
| Arabic body | IBM Plex Sans Arabic | 400, 500, 600 | |
| English display | Cormorant Garamond | variable 300–700 | |
| English body | Manrope | variable 200–800 | |

All four are self-hosted, OFL-1.1, and subset to the characters this product uses — 341 KB across
seven faces. Licences are in `public/fonts/licenses/`. Rebuild with `npm run fonts:build`; the
subsets are verified by `npm run test:fonts`, which runs in `verify`.

### Legibility test — the result

The brief makes Aref Ruqaa "subject to legibility testing", so it was tested rather than trusted.
`public/brand/preview.html` carries a specimen on the real subsets: the abjad, then the sizes the
interface actually uses.

**Result: legible from about 24px upward; below that it becomes ornament.** At 44px "دعوة زفاف"
is confident and unmistakably Ruqaa. At 18px the same face is genuinely hard to read — the
stacked, interlocking letterforms that give it character at display size collapse into texture.

Consequence, now enforced in CSS: the display face is attached to `h1` and `h2` **only**, plus an
explicit `.font-display` class. **`h3` is deliberately excluded**, because h3 is often set small
and nothing would have caught it drifting below the floor.

### Arabic shaping

The gate asserts three things per face, and the first two caught errors in the gate itself:

1. **Nothing requested was lost** — measured against the ranges actually requested. (An earlier
   version compared against a numeric span and "found" 758 drops in Cormorant that were
   deliberate exclusions.)
2. **Joining features survived** — init, medi, fina, isol, rlig. Only the Arabic faces are held to
   this: a Latin subset legitimately loses `mark`/`mkmk` because it requests no combining marks.
3. **No dangling references** — every glyph the retained layout tables still mention exists. This
   is the failure that produces disconnected letters while the font looks perfectly healthy.

Verified intact: **Aref Ruqaa** `init, medi, fina, isol`; **IBM Plex Sans Arabic**
`init, medi, fina, rlig`.

## 5. Colour

Measured by `scripts/check-contrast.py` on every run. The gate reports **21 pairs, 0 required
failures**.

| Token | Value | Role |
|---|---|---|
| `--obsidian` | `#191A19` | Ink, primary action ground. 15.39:1 on ivory. |
| `--ivory` | `#F5F0E8` | Page ground. |
| `--gold` | `#B99B6C` | **Decoration only.** 2.32:1 on ivory — it fails even the 3:1 that WCAG 1.4.11 requires for a focus ring. |
| `--gold-deep` | `#7A5F38` | Every interactive use. 5.26:1 on ivory, 5.96:1 on white. |
| `--taupe` | `#B9ADA0` | Decoration only. 1.94:1 on ivory. |
| `--emerald` | `#263E35` | Secondary action ground. 10.16:1 on ivory. |

A brand colour named in a specification for a UI affordance **must be measured before it ships**.
This is the fourth project in a row where the named gold failed and a darkened variant had to
carry every interactive use.

## 6. Direction

- The interface's direction comes from the locale, set once on `<html>`.
- **User-authored content carries its own direction** (`dir="auto"`): an Arabic invitation inside
  the English interface, a Latin venue name inside an Arabic one.
- **Latin identifiers inside Arabic need isolation**, not a font change. `--obsidian` renders as
  `obsidian--` without it, because the leading hyphens are direction-neutral and the bidi
  algorithm moves them to the end of the run. The same applies to order references, file paths,
  version numbers and API keys. Class: `.ltr-token`.
- Physical CSS direction is **enforced against** by `scripts/check-rtl.mjs`, which refuses to pass
  when it has scanned no files.

## 7. Still outstanding

- The favicon and application icon have not been opened in a real browser tab.
- The tagline ("The Art of Inviting") is set as live text beside the lockup; if it becomes part of
  a printed asset it needs the same outline treatment as the wordmark.
- Light and dark **social/OG images** are not produced.
