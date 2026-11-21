/**
 * VELORA — brand asset guard.
 *
 * The property this protects: **the brand files must not depend on a font being installed.**
 *
 * A wordmark is artwork. If someone later "fixes" it by exporting `<text>` with a font-family,
 * it will render differently on every machine that opens it, reflow when a webfont fails, and
 * break at a printer — while looking perfectly correct in a browser on the machine where it was
 * made. That is a silent defect, so it is checked rather than documented.
 *
 * Also asserts that the generated set is complete and internally consistent: the lockup must
 * contain the monogram's paths and the wordmark's paths, because it is composed from them.
 *
 * Usage: node tests/ui/check-brand.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BRAND = join(ROOT, "public", "brand");

let passed = 0;
let failed = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? `  — ${detail}` : ""}`);
  }
}

const read = (file) => {
  const path = join(BRAND, file);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
};

const pathsOf = (svg) => (svg ? [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]) : []);

console.log("VELORA brand asset guard\n");

// ---------------------------------------------------------------------------
console.log("assets present");
// ---------------------------------------------------------------------------
const EXPECTED = [
  "monogram.svg",
  "monogram-obsidian.svg",
  "monogram-ivory.svg",
  "monogram-gold.svg",
  "monogram-mono.svg",
  "wordmark.svg",
  "wordmark-obsidian.svg",
  "wordmark-ivory.svg",
  "lockup.svg",
  "lockup-obsidian.svg",
  "lockup-ivory.svg",
  "lockup-mono.svg",
  "preview.html",
];

for (const file of EXPECTED) {
  const svg = read(file);
  check(`${file} exists`, svg !== null, "run `npm run brand:build`");
}

const icon = existsSync(join(ROOT, "src", "app", "icon.svg"))
  ? readFileSync(join(ROOT, "src", "app", "icon.svg"), "utf8")
  : null;
check("src/app/icon.svg exists (served as the favicon)", icon !== null);

// ---------------------------------------------------------------------------
console.log("\nno font dependency");
// ---------------------------------------------------------------------------
const SVG_FILES = EXPECTED.filter((file) => file.endsWith(".svg"));
for (const file of SVG_FILES) {
  const svg = read(file);
  if (!svg) continue;
  const offenders = [];
  if (/<text[\s>]/.test(svg)) offenders.push("<text>");
  if (/font-family/.test(svg)) offenders.push("font-family");
  if (/<tspan[\s>]/.test(svg)) offenders.push("<tspan>");
  if (/@font-face/.test(svg)) offenders.push("@font-face");
  if (/xlink:href="[^"]*\.woff/.test(svg)) offenders.push("linked webfont");
  check(`${file} is outlines only`, offenders.length === 0, offenders.join(", "));
}

// ---------------------------------------------------------------------------
console.log("\nstructure");
// ---------------------------------------------------------------------------
const wordmark = read("wordmark.svg");
const wordmarkPaths = pathsOf(wordmark);
check(
  "the wordmark is six outlined glyphs (V E L O R A)",
  wordmarkPaths.length === 6,
  `found ${wordmarkPaths.length}`,
);
check("the wordmark has no fill of its own (it inherits)", /fill="currentColor"/.test(wordmark ?? ""));
check(
  "the wordmark declares a viewBox",
  /viewBox="0 0 [\d.]+ [\d.]+"/.test(wordmark ?? ""),
);

const monogram = read("monogram.svg");
const monogramPaths = pathsOf(monogram);
// The mark is a trace of the operator's logo — four paths, no folded planes. It used to be a
// generated ribbon with exactly two planes and a tonal fold, and this guard described that. The
// guard follows the artwork, not the other way round: it still refuses a monogram that is not the
// shipped geometry, it just knows what the shipped geometry now is.
check(
  "the monogram is the traced mark — four paths",
  monogramPaths.length === 4,
  `found ${monogramPaths.length}`,
);
check(
  "the monogram is a single tone — the mark has no folded planes",
  !/fill-opacity/.test(monogram ?? ""),
  "a traced outline has no second plane to hold back",
);

const mono = read("monogram-mono.svg");
check(
  "the single-tone monogram has no tonal difference",
  mono !== null && !/fill-opacity/.test(mono),
  "one-colour reproduction must collapse cleanly",
);

const lockup = read("lockup.svg");
const lockupPaths = pathsOf(lockup);
check(
  "the lockup carries both the mark and all six wordmark glyphs",
  lockupPaths.length === 10,
  `found ${lockupPaths.length}, expected 4 + 6`,
);
check(
  "the lockup reuses the mark's exact geometry",
  monogramPaths.every((d) => lockup?.includes(d)),
  "a composed lockup must not drift from the mark it contains",
);
check(
  "the lockup reuses the wordmark's exact outlines",
  wordmarkPaths.every((d) => lockup?.includes(d)),
);

console.log(`\nbrand guard: ${passed}/${passed + failed} expectations met`);
if (failed > 0) {
  console.log("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
