#!/usr/bin/env python3
"""
VELORA — wordmark build.

Converts the letters V E L O R A into outlines and emits `public/brand/wordmark.svg`.

Why outlines rather than a `<text>` element: a wordmark is a fixed piece of artwork. Set as live
text it changes with whatever font the viewer happens to have, reflows if the font fails to load,
and cannot be handed to a printer or an embroiderer. Outlines are the deliverable.

Why generated from the shipped subset rather than from "a serif": the wordmark must match the
typeface the product actually uses. Building it from a system font would produce a mark that
disagrees with every heading on the site, and nothing would flag the difference.

The source is the variable Cormorant Garamond subset in public/fonts/, instanced at a single
weight, so the outlines come from exactly the file the browser loads.

Usage: npm run wordmark:build   (or `npm run brand:build`, which runs this first)
"""

from __future__ import annotations

import sys
from pathlib import Path

from fontTools.misc.transform import Transform
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parent.parent
SUBSET = ROOT / "public" / "fonts" / "cormorantgaramond-latin-var.woff2"
OUT_DIR = ROOT / "public" / "brand"

WORD = "VELORA"
WEIGHT = 400
TRACKING_EM = 0.18  # matches the letter-spacing used wherever the wordmark appears
TARGET_CAP = 64.0   # cap height in the emitted coordinate system
PADDING = 4.0

PALETTE = {
    "obsidian": "#191a19",
    "ivory": "#f5f0e8",
}


class Letter:
    """One glyph, resolved once and reused for both measuring and drawing."""

    def __init__(self, font: TTFont, character: str) -> None:
        self.character = character
        cmap = font.getBestCmap()
        if ord(character) not in cmap:
            raise SystemExit(f"'{character}' is not in the subset — cannot build a wordmark from it")
        self.name = cmap[ord(character)]
        self.glyph_set = font.getGlyphSet()
        self.advance, _ = font["hmtx"][self.name]

    def bounds(self, transform: Transform) -> tuple[float, float, float, float] | None:
        pen = BoundsPen(self.glyph_set)
        self.glyph_set[self.name].draw(TransformPen(pen, transform))
        return pen.bounds

    def path(self, transform: Transform) -> str:
        pen = SVGPathPen(self.glyph_set, ntos=lambda value: f"{value:.2f}".rstrip("0").rstrip("."))
        self.glyph_set[self.name].draw(TransformPen(pen, transform))
        return pen.getCommands()


def main() -> int:
    print("VELORA wordmark\n")

    if not SUBSET.exists():
        print(f"✗ {SUBSET.relative_to(ROOT)} is missing — run `npm run fonts:build` first.")
        return 1

    font = TTFont(SUBSET)
    if "fvar" in font:
        axes = {axis.axisTag for axis in font["fvar"].axes}
        if "wght" in axes:
            font = instantiateVariableFont(font, {"wght": WEIGHT}, inplace=False, updateFontNames=False)
            print(f"  instanced the variable subset at wght={WEIGHT}")

    cap_height = font["OS/2"].sCapHeight
    units_per_em = font["head"].unitsPerEm
    scale = TARGET_CAP / cap_height
    tracking = TRACKING_EM * units_per_em * scale
    print(f"  source: {SUBSET.name}")
    print(f"  cap height {cap_height}/{units_per_em} units → scale {scale:.4f}, tracking {tracking:.2f}")

    letters = [Letter(font, character) for character in WORD]

    # Baseline at y=0 for measuring; the emitted paths are shifted once the true bounds are known.
    positions = []
    x = 0.0
    for letter in letters:
        positions.append((letter, x))
        x += letter.advance * scale + tracking
    total_advance = x - tracking

    # True ink bounds, so the viewBox hugs the artwork instead of the advance widths.
    ink = None
    for letter, offset in positions:
        bounds = letter.bounds(Transform(scale, 0, 0, -scale, offset, 0))
        if bounds is None:
            continue
        ink = bounds if ink is None else (
            min(ink[0], bounds[0]), min(ink[1], bounds[1]),
            max(ink[2], bounds[2]), max(ink[3], bounds[3]),
        )
    if ink is None:
        print("✗ no ink bounds — the subset has no outlines for these letters")
        return 1

    shift_x = PADDING - ink[0]
    shift_y = PADDING - ink[1]
    width = (ink[2] - ink[0]) + PADDING * 2
    height = (ink[3] - ink[1]) + PADDING * 2

    print(f"  advance width {total_advance:.2f} → ink {width:.2f} × {height:.2f}")

    def svg(fill: str) -> str:
        body = []
        for letter, offset in positions:
            commands = letter.path(Transform(scale, 0, 0, -scale, offset + shift_x, shift_y))
            body.append(f'  <path d="{commands}"/>')
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.2f} {height:.2f}" '
            f'role="img" aria-label="VELORA">\n'
            f"  <title>VELORA</title>\n"
            f'  <g fill="{fill}">\n' + "\n".join(body) + "\n  </g>\n</svg>\n"
        )

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Themable: inherits the surrounding text colour when inlined.
    themable = svg("currentColor")
    (OUT_DIR / "wordmark.svg").write_text(themable, encoding="utf-8")
    (OUT_DIR / "wordmark-obsidian.svg").write_text(svg(PALETTE["obsidian"]), encoding="utf-8")
    (OUT_DIR / "wordmark-ivory.svg").write_text(svg(PALETTE["ivory"]), encoding="utf-8")

    for name in ("wordmark.svg", "wordmark-obsidian.svg", "wordmark-ivory.svg"):
        print(f"  → public/brand/{name}  ({(OUT_DIR / name).stat().st_size} bytes)")

    print(f"\n  {len(WORD)} glyphs outlined from the shipped subset, no font dependency at render time")
    return 0


if __name__ == "__main__":
    sys.exit(main())
