#!/usr/bin/env python3
"""
VELORA — contrast gate.

Measures WCAG 2.x contrast for the colour pairs this interface actually uses, reading the
token values out of src/styles/tokens.css so the report cannot drift from the stylesheet.

A pair is either:
  required = the pairing carries meaning and MUST clear its threshold, or
  decorative = it may not, and is recorded as decoration-only so nobody "fixes" it later.

Exit code is non-zero only when a required pair fails.

Usage: python3 scripts/check-contrast.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOKENS = ROOT / "src" / "styles" / "tokens.css"

AA_TEXT = 4.5      # normal-size text
AA_LARGE = 3.0     # large text
AA_NON_TEXT = 3.0  # UI components, focus indicators, graphical objects (WCAG 1.4.11)


def read_tokens(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    raw = dict(re.findall(r"--([a-z0-9-]+)\s*:\s*([^;]+);", text))

    # Resolve one level of var() indirection.
    out: dict[str, str] = {}
    for name, value in raw.items():
        value = value.strip()
        match = re.fullmatch(r"var\(\s*--([a-z0-9-]+)\s*\)", value)
        if match:
            value = raw.get(match.group(1), "").strip()
        if re.fullmatch(r"#[0-9a-fA-F]{6}", value):
            out[name] = value.lower()
    return out


def luminance(hex_color: str) -> float:
    r, g, b = (int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5))

    def channel(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def ratio(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    lighter, darker = max(la, lb), min(la, lb)
    return (lighter + 0.05) / (darker + 0.05)


# (foreground token, background token, threshold, required, what it is)
PAIRS: list[tuple[str, str, float, bool, str]] = [
    ("ink", "ivory", AA_TEXT, True, "body copy on the page ground"),
    ("ink", "paper", AA_TEXT, True, "body copy on a raised card"),
    ("ink", "ivory-deep", AA_TEXT, True, "body copy on a recessed section"),
    ("ink-muted", "ivory", AA_TEXT, True, "secondary text on the ground"),
    ("ink-muted", "paper", AA_TEXT, True, "secondary text on a card"),
    ("ink-inverse", "obsidian", AA_TEXT, True, "inverse text on the dark surface"),
    ("ink-inverse", "emerald", AA_TEXT, True, "label on the emerald action"),
    ("ink-inverse", "gold-deep", AA_TEXT, True, "label on the gold action"),
    ("emerald", "ivory", AA_TEXT, True, "emerald used as text"),
    ("gold-deep", "ivory", AA_TEXT, True, "interactive gold as text"),
    ("gold-deep", "paper", AA_NON_TEXT, True, "focus ring on a card (1.4.11)"),
    ("gold-deep", "ivory", AA_NON_TEXT, True, "focus ring on the ground (1.4.11)"),
    ("emerald", "paper", AA_NON_TEXT, True, "emerald outline on a card"),
    ("danger", "paper", AA_TEXT, True, "error text without its ground"),
    ("danger", "danger-ground", AA_TEXT, True, "error text on its ground"),
    ("success", "success-ground", AA_TEXT, True, "success text on its ground"),
    ("warning", "warning-ground", AA_TEXT, True, "warning text on its ground"),
    ("line", "ivory", AA_NON_TEXT, False, "hairline divider"),
    ("gold", "ivory", AA_LARGE, False, "DECORATION ONLY — champagne gold on ivory"),
    ("gold", "obsidian", AA_LARGE, False, "DECORATION ONLY — champagne gold on black"),
    ("taupe", "ivory", AA_LARGE, False, "DECORATION ONLY — soft taupe on ivory"),
]


def main() -> int:
    if not TOKENS.exists():
        print(f"contrast gate: missing {TOKENS}")
        return 1

    tokens = read_tokens(TOKENS)
    failures: list[str] = []
    missing: list[str] = []

    print(f"VELORA contrast gate — {len(PAIRS)} pairs from {TOKENS.name}\n")
    print(f"{'pair':<34}{'ratio':>7}  {'need':>5}  {'':<4}use")
    print("-" * 96)

    for fg, bg, threshold, required, description in PAIRS:
        if fg not in tokens or bg not in tokens:
            missing.append(f"{fg} on {bg}")
            continue
        value = ratio(tokens[fg], tokens[bg])
        ok = value >= threshold
        flag = "PASS" if ok else ("FAIL" if required else "DECOR")
        if not ok and required:
            failures.append(f"{fg} on {bg} = {value:.2f}:1, needs {threshold}")
        print(
            f"{fg + ' on ' + bg:<34}{value:>6.2f}:1  {threshold:>5.1f}  {flag:<4}"
            f" {description}"
        )

    print()
    if missing:
        print(f"!! tokens referenced but not found: {', '.join(missing)}")
    print(f"measured: {len(PAIRS) - len(missing)}/{len(PAIRS)} pairs")
    print(f"required failures: {len(failures)}")
    for failure in failures:
        print(f"  ✗ {failure}")

    tokens_not_measured = sorted(set(tokens) - {p[0] for p in PAIRS} - {p[1] for p in PAIRS})
    if tokens_not_measured:
        print(f"note: {len(tokens_not_measured)} token(s) not used in any measured pair: "
              f"{', '.join(tokens_not_measured)}")

    if failures or missing:
        print("\nRESULT: FAIL")
        return 1
    print("\nRESULT: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
