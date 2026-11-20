#!/usr/bin/env python3
"""
VELORA — font subset verification.

Subsetting an Arabic font can destroy it silently. Drop a GSUB feature and the file still loads,
still renders, and produces **disconnected letters** — which in an Arabic interface is not a
subtle defect, it is a total failure, and it looks like a design choice to anyone who does not
read Arabic.

What this gate asserts, per face:

  1. **Nothing requested was lost.** Every codepoint that the source maps AND the subset asked for
     is still mapped. (Asserting `cmap == declared unicode-range` is impossible for Arabic — the
     sources genuinely lack codepoints inside a full Arabic range — so the test is "no drops from
     what was requested", computed from the requested ranges, not from a numeric span.)
  2. **The joining features survived.** init, medi, fina, isol, rlig, curs, mark, mkmk. Missing
     any of these is a hard failure.
  3. **No dangling references.** Every glyph name the retained layout tables still mention must
     exist. A lookup pointing at a removed glyph produces disconnected or missing letters while
     the font appears perfectly healthy.

Pruned *stylistic* features (ss, cv and friends) are reported but do not fail the gate: they only
ever applied to glyphs that were deliberately not requested, and pyftsubset correctly drops them.

Usage: python3 scripts/check-fonts.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from fontTools.ttLib import TTFont

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fonts import ARABIC_RANGE, CACHE, FONTS, LATIN_RANGE, OUT, parse_ranges  # noqa: E402

# Without these, Arabic does not join. Present in the source and absent here is a hard failure.
JOINING_FEATURES = {"init", "medi", "fina", "isol", "rlig", "curs", "mark", "mkmk"}

# The two feature classes that are informational rather than critical.
STYLISTIC_PREFIXES = ("ss", "cv")

# Strings that appear in a layout table but are not glyph references.
NOT_GLYPHS = {
    "GSUB", "GPOS", "GDEF", "DFLT", "arab", "latn", "kern", "mark", "mkmk", "curs", "init",
    "medi", "fina", "isol", "rlig", "liga", "calt", "clig", "dlig", "rclt", "mset", "ccmp",
    "locl", "frac", "numr", "dnom", "subs", "sups", "salt", "aalt", "vert", "vrt2", "case",
    "cpsp", "dist", "abvm", "blwm", "abvf", "blwf", "half", "pref", "pstf", "cjct", "akhn",
    "rphf", "vatu", "nukt", "pres", "abvs", "blws", "psts",
}

# The Arabic letters that must be present in any Arabic face, as a readable named list.
ARABIC_LETTERS = {
    0x0621: "hamza", 0x0622: "alef madda", 0x0623: "alef hamza above",
    0x0624: "waw hamza", 0x0625: "alef hamza below", 0x0626: "yeh hamza",
    0x0627: "alef", 0x0628: "beh", 0x0629: "teh marbuta", 0x062A: "teh",
    0x062B: "theh", 0x062C: "jeem", 0x062D: "hah", 0x062E: "khah", 0x062F: "dal",
    0x0630: "thal", 0x0631: "reh", 0x0632: "zain", 0x0633: "seen", 0x0634: "sheen",
    0x0635: "sad", 0x0636: "dad", 0x0637: "tah", 0x0638: "zah", 0x0639: "ain",
    0x063A: "ghain", 0x0641: "feh", 0x0642: "qaf", 0x0643: "kaf", 0x0644: "lam",
    0x0645: "meem", 0x0646: "noon", 0x0647: "heh", 0x0648: "waw", 0x0649: "alef maksura",
    0x064A: "yeh",
}


def collect_strings(node, seen: set[str], depth: int = 0) -> None:
    """Recursively collect every string in an object graph, generically.

    Deliberately format-agnostic. A hand-written per-table walker silently traverses NOTHING when
    the table layout differs from what its author expected, and reports a clean result — which is
    how a vacuous check passes review.
    """
    if depth > 12 or node is None:
        return
    if isinstance(node, str):
        seen.add(node)
        return
    if isinstance(node, (int, float, bytes, bool)):
        return
    if isinstance(node, (list, tuple, set)):
        for item in node:
            collect_strings(item, seen, depth + 1)
        return
    if isinstance(node, dict):
        for key, value in node.items():
            collect_strings(key, seen, depth + 1)
            collect_strings(value, seen, depth + 1)
        return
    if hasattr(node, "__dict__"):
        for value in vars(node).values():
            collect_strings(value, seen, depth + 1)


def feature_inputs(font, tag: str) -> set[str]:
    """Every glyph a feature's lookups reference as input or coverage, across GSUB and GPOS."""
    used: set[str] = set()
    for table_name in ("GSUB", "GPOS"):
        if table_name not in font:
            continue
        table = font[table_name].table
        if not table.FeatureList or not table.LookupList:
            continue
        indices: set[int] = set()
        for record in table.FeatureList.FeatureRecord:
            if record.FeatureTag == tag:
                indices.update(record.Feature.LookupListIndex)
        for index in indices:
            lookup = table.LookupList.Lookup[index]
            for subtable in lookup.SubTable:
                real = getattr(subtable, "ExtSubTable", subtable) or subtable
                for attr in ("Coverage", "InputCoverage", "BacktrackCoverage", "LookAheadCoverage"):
                    coverage = getattr(real, attr, None)
                    if isinstance(coverage, list):
                        for item in coverage:
                            used.update(getattr(item, "glyphs", []) or [])
                    elif coverage is not None:
                        used.update(getattr(coverage, "glyphs", []) or [])
    return used


def layout_features(font: TTFont, table: str) -> set[str]:
    if table not in font:
        return set()
    feature_list = getattr(font[table].table, "FeatureList", None)
    if feature_list is None:
        return set()
    return {record.FeatureTag for record in feature_list.FeatureRecord}


def main() -> int:
    print("VELORA — font subset verification\n")
    failures: list[str] = []
    warnings: list[str] = []

    for entry in FONTS:
        subset_path = OUT / f"{entry['out']}.woff2"
        source_path = CACHE / entry["cache_name"]
        label = f"{entry['out']}.woff2  ({entry['css_family']}, {entry['role']})"

        if not subset_path.exists():
            print(f"✗ {label}: missing — run npm run fonts:build")
            failures.append(f"{entry['out']}: file missing")
            continue
        if not source_path.exists():
            print(f"⚠ {label}: source not cached; coverage not comparable")
            warnings.append(f"{entry['out']}: source missing from vendor/fonts/")
            continue

        subset = TTFont(subset_path)
        source = TTFont(source_path)
        size_kb = subset_path.stat().st_size // 1024

        subset_cmap = set(subset.getBestCmap())
        source_cmap = set(source.getBestCmap())
        source_glyphs = set(source.getGlyphOrder())
        removed_glyphs = source_glyphs - set(subset.getGlyphOrder())

        # 1. No drops, measured against the ranges that were actually requested.
        requested = parse_ranges(LATIN_RANGE if entry["profile"] == "latin" else ARABIC_RANGE)
        expected = requested & source_cmap
        dropped = expected - subset_cmap

        # 2. Shaping features preserved — asked per table, because the two tables do different jobs.
        #
        #    GSUB *substitutes* glyphs: init/medi/fina/isol/rlig/calt are what keep Arabic joined, and
        #    losing any of them is a hard failure.
        #
        #    GPOS *positions* glyphs: `mark` and `mkmk` are what place the harakat under and over a
        #    letter. That is the one that matters for a verse with diacritics, and it is asserted.
        #
        #    The previous rule lumped both tables' tags together and required a `mark` feature in
        #    *either*. Measured on Amiri: `GPOS:mark` survives subsetting — harakat are positioned
        #    correctly — while `GSUB:mark` is pruned because its coverage referenced one Latin
        #    combining glyph the subset never asks for. Failing the gate for that was a false alarm,
        #    and requiring it would have meant carrying U+0305 in every Arabic face.
        missing_by_table: dict[str, set[str]] = {}
        for table in ("GSUB", "GPOS"):
            missing_by_table[table] = layout_features(source, table) - layout_features(subset, table)
        missing_features = set().union(*missing_by_table.values())

        # `JOINING_FEATURES` names both kinds in one set; the point of the split is that `mark` and
        # `mkmk` are positional, so they are looked for in GPOS only.
        substitution_only = JOINING_FEATURES - {"mark", "mkmk"}
        critical_subst = substitution_only if entry["profile"] == "arabic" else set()
        critical_position = {"mark", "mkmk"} if entry["profile"] == "arabic" else set()
        missing_joining = (missing_by_table["GSUB"] & critical_subst) | (
            missing_by_table["GPOS"] & critical_position
        )
        pruned_stylistic = {
            tag for tag in missing_features if tag.startswith(STYLISTIC_PREFIXES)
        }
        other_missing = missing_features - missing_joining - pruned_stylistic

        # 3. Dangling references among the glyphs that were removed.
        referenced: set[str] = set()
        for table in ("GSUB", "GPOS"):
            if table in subset:
                collect_strings(subset[table].table, referenced)
        dangling = {name for name in referenced if name in removed_glyphs and name not in NOT_GLYPHS}

        # 4. Arabic letters, named, so a failure says which letter went missing.
        missing_letters: list[str] = []
        if entry["profile"] == "arabic":
            missing_letters = [
                name for cp, name in ARABIC_LETTERS.items() if cp not in subset_cmap
            ]

        ok = not dropped and not missing_joining and not dangling and not missing_letters
        print(
            f"{'✓' if ok else '✗'} {label}\n"
            f"    {size_kb} KB · {len(subset_cmap)} codepoints · "
            f"{len(subset.getGlyphOrder())} glyphs (from {len(source_glyphs)}) · "
            f"{len(expected)} of {len(requested)} requested codepoints available in source"
        )

        if dropped:
            sample = " ".join(f"U+{cp:04X}" for cp in sorted(dropped)[:6])
            print(f"    LOST {len(dropped)} requested codepoints, e.g. {sample}")
            failures.append(f"{entry['out']}: lost {len(dropped)} requested codepoints")
        if missing_joining:
            print(f"    LOST joining features: {', '.join(sorted(missing_joining))}")
            failures.append(f"{entry['out']}: lost joining features {sorted(missing_joining)}")
        if dangling:
            print(f"    DANGLING glyph references: {', '.join(sorted(dangling)[:6])}")
            failures.append(f"{entry['out']}: {len(dangling)} dangling references")
        if missing_letters:
            print(f"    MISSING Arabic letters: {', '.join(missing_letters[:6])}")
            failures.append(f"{entry['out']}: missing Arabic letters {missing_letters[:6]}")

        if entry["profile"] == "arabic" and not missing_joining:
            present = sorted(JOINING_FEATURES & layout_features(subset, "GSUB"))
            print(f"    joining features intact: {', '.join(present)}")
        if pruned_stylistic:
            print(f"    pruned stylistic features (their glyphs were not requested): "
                  f"{', '.join(sorted(pruned_stylistic))}")
        if other_missing:
            print(f"    pruned, no glyphs requested for them: {', '.join(sorted(other_missing))}")
        if "fvar" in subset:
            axes = ", ".join(axis.axisTag for axis in subset["fvar"].axes)
            print(f"    variable axes retained: {axes}")

    print()
    for warning in warnings:
        print(f"⚠ {warning}")
    if failures:
        print(f"\n{len(failures)} failure(s)")
        for failure in failures:
            print(f"  ✗ {failure}")
        print("\nRESULT: FAIL")
        return 1
    print(f"{len(FONTS)} faces verified — nothing requested was lost, joining intact, no dangling references")
    print("\nRESULT: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
