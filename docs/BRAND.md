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

---

## Appendix A — measured: would a new Arabic face be worth adopting? (2026-11-21)

**No face was adopted and no decision was taken here.** This is a measurement, taken before a
decision, so the decision can be made with numbers rather than with an impression from a screenshot.

Method: each family's stylesheet was fetched from the Google Fonts CSS2 API, every subset URL it
declares was downloaded, and the files were measured with `stat` — not estimated from a directory
listing, which rounds to 4 KB blocks and has already made this repository's font total wrong once.
Licences were fetched from the upstream `OFL.txt` in `google/fonts`, not read off a marketing page.

| Candidate | Arabic subset | Latin subset | Licence | Variable? |
|---|---|---|---|---|
| **Readex Pro** | **22,864 B (22.3 KB)** | 31,428 B (30.7 KB) | OFL 1.1 — "Copyright 2018 The Readex Pro Project Authors… with Reserved Font Name RevReading Lexend" | yes, 300–700 in one file |
| **El Messiri** | 22,280 B (21.8 KB) | 23,632 B (23.1 KB) | OFL 1.1 — "Copyright 2015 The El Messiri Project Authors" | yes |
| **Cairo** | 30,896 B (30.2 KB) | 33,820 B (33.0 KB) | OFL 1.1 — "Copyright 2009 The Cairo Project Authors" | yes |

What the repository ships today, same measure:

| File | Bytes | Role |
|---|---|---|
| `amiri-arabic-400.woff2` | 121,088 | verse |
| `notonaskh-arabic-var.woff2` | 98,880 | body (Arabic) |
| `cormorantgaramond-latin-var.woff2` | 60,820 | names / body (Latin) |
| `arefruqaa-arabic-700.woff2` | 56,036 | names |
| `plexsansarabic-arabic-600.woff2` | 55,076 | admin only |
| `plexsansarabic-arabic-500.woff2` | 54,756 | admin only |
| `plexsansarabic-arabic-400.woff2` | 51,220 | admin only |
| `arefruqaa-arabic-400.woff2` | 48,500 | names |
| `cinzel-latin-var.woff2` | 35,004 | labels (Latin) |
| `reemkufi-arabic-var.woff2` | 24,196 | labels |
| `manrope-latin-var.woff2` | 23,540 | interface |
| **total** | **629,116 B (614 KB)** | 11 files |

### Where a new face would win, on measurement

Readex Pro's Arabic subset (22.3 KB) is **smaller than every Arabic face this repository ships**
except Reem Kufi. But it is a geometric **sans**, so it cannot replace Aref Ruqaa (display) or Amiri
(verse) — those are calligraphic faces and the choice of them is a design decision, not a byte
count. Its natural slot is the one IBM Plex Sans Arabic occupies today: **admin-only, three static
files, 161,052 B (157 KB)**. One Readex Pro variable file covers 300–700 and would cut about
**139 KB** from the repository and two requests from the console's first paint.

That is the strongest measured argument for it, and it is an argument about the **console**, in a
different font than the invitation's. §2 of `DESIGN.md` already forbids Plex on `/i/<token>`.

### Where it would not win

Swapping **Noto Naskh Arabic** (98.9 KB, the invitation body face) for a geometric sans would change
the character of every template at once — a Naskh carries the calligraphic register the product is
selling. That is a `DESIGN.md §2` decision for the owner, and a size saving is not a reason to make
it.

### Loading strategy — what would have to be done, not assumed

1. **Self-host and subset through `scripts/fonts.py`.** Dropping a Google subset into `public/fonts/`
   would skip `npm run test:fonts`, which is what asserts joining features survive
   (`init/medi/fina/rlig`) and that nothing references a glyph it dropped. Google's Arabic subset has
   not been through that check.
2. **`font-display: block` above the fold, `swap` below** — the existing rule, measured in
   `src/styles/fonts.css` as 4 `block` / 7 `swap`. `swap` on a preloaded above-fold face is a
   substitution, and a substitution is a layout shift; that is how the CLS defect was found on
   2026-11-19.
3. **`<link rel="preload">` the faces actually used above the fold**, and only those.
4. **Keep the subsets split by script.** Readex Pro already ships Arabic and Latin as separate files;
   `unicode-range` must be kept so a European locale never downloads the Arabic file and vice versa.
5. **Verify by measurement, not by inspection:** `npm run test:fonts`, plus reading
   `document.fonts` and the actual bytes fetched in a browser.

Reported to the owner as a measurement. Nothing in this appendix is adopted.
