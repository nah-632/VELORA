#!/usr/bin/env python3
"""
VELORA — font pipeline.

Downloads the four families, subsets them to the characters this product actually uses, and
emits `src/styles/fonts.css` alongside the woff2 files in `public/fonts/`.

Why subset at all: IBM Plex Sans Arabic ships ~500 glyphs this interface will never show, and
Aref Ruqaa is a calligraphic face with a large glyph set. Shipping the full files would cost
hundreds of kilobytes of render-blocking download on a phone in Bahrain.

Why a script rather than four downloaded files: the subsets have to be reproducible and the
`@font-face` declarations have to agree with what was actually subset. Both come from the
manifest below, so they cannot drift.

The source files are cached in vendor/fonts/ (gitignored) because they are inputs, not
artefacts. The outputs are committed.

Arabic subsetting keeps `--layout-features='*'`. Dropping layout features turns joined Arabic
into disconnected letters, which is a total failure for an Arabic interface and is invisible
unless someone looks for it. scripts/check-fonts.py looks for it.

Usage: npm run fonts:build
"""

import os
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "vendor" / "fonts"
OUT = ROOT / "public" / "fonts"
LICENCES = OUT / "licenses"
CSS = ROOT / "src" / "styles" / "fonts.css"

BASE = "https://raw.githubusercontent.com/google/fonts/main/ofl"

# Latin includes the separator (U+00B7), the ellipsis and the curly quotes the interface uses.
LATIN_RANGE = (
    "U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
    "U+2009-200A,U+2013-2014,U+2018-201D,U+2022,U+2026,U+202F,U+00B7,U+20AC,U+2192,U+FEFF"
)

# The Arabic faces also carry basic Latin, so a mixed string ("+973 3xxx xxxx") stays in one
# family instead of switching face mid-line.
ARABIC_RANGE = (
    "U+0020-007E,U+00A0,U+00B7,U+2009-200A,U+2013-2014,U+2018-201D,U+2022,U+2026,"
    "U+0600-06FF,U+0750-077F,U+08A0-08FF,U+200C-200F,U+204F,"
    "U+FB50-FDFF,U+FE70-FEFF"
)

# What the stylesheet declares. A superset is expected: an Arabic source may genuinely lack
# codepoints inside these ranges, so equality with the actual cmap is impossible to assert.
# scripts/check-fonts.py asserts nothing was DROPPED from the source instead.
CSS_RANGES = {
    "latin": "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, "
    "U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    "arabic": "U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0898-08E1, U+08E3-08FF, "
    "U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FEFF",
}

# family, css family, role, weight (None = variable), source file, output stem
FONTS = [
    {
        "id": "cormorant",
        "css_family": "Cormorant Garamond",
        "role": "display-latin",
        "variable": True,
        "weight_range": "300 700",
        "src": f"{BASE}/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf",
        "cache_name": "CormorantGaramond[wght].ttf",
        "profile": "latin",
        "out": "cormorantgaramond-latin-var",
        "above_fold": True,
        "licence": f"{BASE}/cormorantgaramond/OFL.txt",
        "licence_name": "CormorantGaramond-OFL.txt",
    },
    {
        "id": "manrope",
        "css_family": "Manrope",
        "role": "body-latin",
        "variable": True,
        "weight_range": "200 800",
        "src": f"{BASE}/manrope/Manrope%5Bwght%5D.ttf",
        "cache_name": "Manrope[wght].ttf",
        "profile": "latin",
        "out": "manrope-latin-var",
        "above_fold": True,
        "licence": f"{BASE}/manrope/OFL.txt",
        "licence_name": "Manrope-OFL.txt",
    },
    {
        "id": "aref-regular",
        "css_family": "Aref Ruqaa",
        "role": "display-arabic",
        "variable": False,
        "weight": 400,
        "src": f"{BASE}/arefruqaa/ArefRuqaa-Regular.ttf",
        "cache_name": "ArefRuqaa-Regular.ttf",
        "profile": "arabic",
        "out": "arefruqaa-arabic-400",
        "above_fold": True,
        "licence": f"{BASE}/arefruqaa/OFL.txt",
        "licence_name": "ArefRuqaa-OFL.txt",
    },
    {
        "id": "aref-bold",
        "css_family": "Aref Ruqaa",
        "role": "display-arabic",
        "variable": False,
        "weight": 700,
        "src": f"{BASE}/arefruqaa/ArefRuqaa-Bold.ttf",
        "cache_name": "ArefRuqaa-Bold.ttf",
        "profile": "arabic",
        "out": "arefruqaa-arabic-700",
        "licence": None,
        "licence_name": None,
    },
    {
        "id": "plex-ar-regular",
        "css_family": "IBM Plex Sans Arabic",
        "role": "body-arabic",
        "variable": False,
        "weight": 400,
        "src": f"{BASE}/ibmplexsansarabic/IBMPlexSansArabic-Regular.ttf",
        "cache_name": "IBMPlexSansArabic-Regular.ttf",
        "profile": "arabic",
        "out": "plexsansarabic-arabic-400",
        "above_fold": True,
        "licence": f"{BASE}/ibmplexsansarabic/OFL.txt",
        "licence_name": "IBMPlexSansArabic-OFL.txt",
    },
    {
        "id": "plex-ar-medium",
        "css_family": "IBM Plex Sans Arabic",
        "role": "body-arabic",
        "variable": False,
        "weight": 500,
        "src": f"{BASE}/ibmplexsansarabic/IBMPlexSansArabic-Medium.ttf",
        "cache_name": "IBMPlexSansArabic-Medium.ttf",
        "profile": "arabic",
        "out": "plexsansarabic-arabic-500",
        "licence": None,
        "licence_name": None,
    },
    {
        "id": "plex-ar-semibold",
        "css_family": "IBM Plex Sans Arabic",
        "role": "body-arabic",
        "variable": False,
        "weight": 600,
        "src": f"{BASE}/ibmplexsansarabic/IBMPlexSansArabic-SemiBold.ttf",
        "cache_name": "IBMPlexSansArabic-SemiBold.ttf",
        "profile": "arabic",
        "out": "plexsansarabic-arabic-600",
        "licence": None,
        "licence_name": None,
    },
    # ---------------------------------------------------------------------------------------
    # The template system's first four extra faces.
    #
    # Added because T1 Golden Palace names them in docs/TEMPLATES.md §2: Reem Kufi for labels, Amiri
    # for the verse, Noto Naskh for body, Cinzel for English headings. Rendering T1 with the four
    # faces that happened to exist would have been a template that says one thing and looks like
    # another.
    #
    # A licence per family, fetched and committed beside the others: the OFL requires the notice to
    # travel with the font, and seven licences already live in public/fonts/licenses/.
    # ---------------------------------------------------------------------------------------
    {
        "id": "reemkufi",
        "css_family": "Reem Kufi",
        "role": "labels-arabic",
        "variable": True,
        "weight_range": "400 700",
        "src": f"{BASE}/reemkufi/ReemKufi%5Bwght%5D.ttf",
        "cache_name": "ReemKufi[wght].ttf",
        "profile": "arabic",
        "out": "reemkufi-arabic-var",
        "above_fold": False,
        "licence": f"{BASE}/reemkufi/OFL.txt",
        "licence_name": "ReemKufi-OFL.txt",
    },
    {
        "id": "amiri-regular",
        "css_family": "Amiri",
        "role": "verse-arabic",
        "variable": False,
        "weight": 400,
        "src": f"{BASE}/amiri/Amiri-Regular.ttf",
        "cache_name": "Amiri-Regular.ttf",
        "profile": "arabic",
        "out": "amiri-arabic-400",
        "above_fold": False,
        "licence": f"{BASE}/amiri/OFL.txt",
        "licence_name": "Amiri-OFL.txt",
    },
    {
        "id": "notonaskh",
        "css_family": "Noto Naskh Arabic",
        "role": "body-arabic",
        "variable": True,
        "weight_range": "400 700",
        "src": f"{BASE}/notonaskharabic/NotoNaskhArabic%5Bwght%5D.ttf",
        "cache_name": "NotoNaskhArabic[wght].ttf",
        "profile": "arabic",
        "out": "notonaskh-arabic-var",
        "above_fold": False,
        "licence": f"{BASE}/notonaskharabic/OFL.txt",
        "licence_name": "NotoNaskhArabic-OFL.txt",
    },
    {
        "id": "cinzel",
        "css_family": "Cinzel",
        "role": "labels-latin",
        "variable": True,
        "weight_range": "400 700",
        "src": f"{BASE}/cinzel/Cinzel%5Bwght%5D.ttf",
        "cache_name": "Cinzel[wght].ttf",
        "profile": "latin",
        "out": "cinzel-latin-var",
        "above_fold": False,
        "licence": f"{BASE}/cinzel/OFL.txt",
        "licence_name": "Cinzel-OFL.txt",
    },
]


def parse_ranges(spec: str) -> set[int]:
    """Parse a `U+0020-007E,U+00B7` style range list into a set of codepoints.

    Shared with scripts/check-fonts.py so the verifier compares against the ranges that were
    actually requested, rather than against a numeric span that would flag every intentional
    exclusion as a loss.
    """
    out: set[int] = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if part.upper().startswith("U+"):
            part = part[2:]
        if "-" in part:
            start, end = part.split("-", 1)
            out.update(range(int(start, 16), int(end, 16) + 1))
        else:
            out.add(int(part, 16))
    return out


def fetch(url: str, destination: Path) -> None:
    if destination.exists() and destination.stat().st_size > 0:
        print(f"    cached  {destination.name}  ({destination.stat().st_size // 1024} KB)")
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    print(f"    fetch   {destination.name}")
    with urllib.request.urlopen(url, timeout=90) as response:
        payload = response.read()
    if not payload:
        raise RuntimeError(f"empty download from {url}")
    destination.write_bytes(payload)
    print(f"    saved   {destination.name}  ({len(payload) // 1024} KB)")


def subset(source: Path, destination: Path, profile: str) -> None:
    unicodes = LATIN_RANGE if profile == "latin" else ARABIC_RANGE
    command = [
        "pyftsubset",
        str(source),
        f"--unicodes={unicodes}",
        # Dropping layout features disconnects Arabic letters. Never remove this flag.
        "--layout-features=*",
        "--flavor=woff2",
        # pyftsubset's long options must be given with `=`; a space-separated value is parsed as
        # a positional glyph name.
        f"--output-file={destination}",
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"pyftsubset failed for {source.name}:\n{result.stderr}")


def css_block(entry: dict, file_name: str) -> str:
    weight = entry["weight_range"] if entry["variable"] else str(entry["weight"])
    # `block` for the faces the layouts preload, `swap` for the rest.
    #
    # These four arrive with the stylesheet — they are self-hosted, subset and preloaded — so the
    # browser has no reason to paint a fallback first. `swap` would paint one and then replace it,
    # and a text substitution is a layout shift by definition. For a face that is *not* preloaded,
    # blocking risks invisible text on a slow connection, and a shift is the lesser evil.
    display = "block" if entry.get("above_fold") else "swap"
    return (
        "@font-face {\n"
        f'  font-family: "{entry["css_family"]}";\n'
        f"  font-style: normal;\n"
        f"  font-weight: {weight};\n"
        f"  font-display: {display};\n"
        f"  src: url(\"/fonts/{file_name}\") format(\"woff2\");\n"
        f"  unicode-range: {CSS_RANGES[entry['profile']]};\n"
        "}"
    )


def main() -> int:
    print("VELORA font pipeline\n")
    OUT.mkdir(parents=True, exist_ok=True)
    LICENCES.mkdir(parents=True, exist_ok=True)

    blocks: list[str] = []
    total = 0

    for entry in FONTS:
        print(f"  {entry['css_family']} · {entry['role']}"
              + (f" · {entry['weight']}" if not entry["variable"] else " · variable"))
        source = CACHE / entry["cache_name"]
        fetch(entry["src"], source)

        destination = OUT / f"{entry['out']}.woff2"
        subset(source, destination, entry["profile"])
        size = destination.stat().st_size
        total += size
        print(f"    subset  {destination.name}  ({size // 1024} KB)")

        if entry["licence"]:
            fetch(entry["licence"], LICENCES / entry["licence_name"])

        blocks.append(css_block(entry, destination.name))

    CSS.parent.mkdir(parents=True, exist_ok=True)
    CSS.write_text(
        "/*\n"
        " * Generated by scripts/build-fonts.py — do not edit by hand.\n"
        " *\n"
        " * Every family here is OFL-1.1 licensed; the licence files are in public/fonts/licenses/.\n"
        " * Each face is subset to the characters this product uses, and the unicode-range below\n"
        " * is what lets the browser pick the Arabic face for Arabic and the Latin face for Latin\n"
        " * inside the same paragraph.\n"
        " */\n\n"
        + "\n\n".join(blocks)
        + "\n",
        encoding="utf-8",
    )
    print(f"\nstylesheet: src/styles/fonts.css")
    print(f"total woff2: {total // 1024} KB across {len(FONTS)} faces")
    print("\nRUN: python3 scripts/check-fonts.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
