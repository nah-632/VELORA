/**
 * A `var()` inside an SVG presentation attribute is not a CSS value.
 *
 * `stroke="var(--x)"` is an invalid attribute value, so the paint silently falls back to
 * `currentColor` — which inherits the *text* colour. That is how VELORA's fold lost its gold twice:
 * first as `stroke="var(--env-gold)"` (drawn in near-black on near-black paper), then again as
 * `stroke="var(--env-light, …)"`. Both were invisible to every colour measurement, because a line
 * that is not painted samples as paper. A screenshot found the first; this guard finds the class.
 *
 * `var()` resolves in a stylesheet, and in an element's own `style` attribute. Those are the two
 * places it may be written.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const WALK = ["src", "public"];
const EXTS = new Set([".tsx", ".jsx", ".ts", ".js", ".svg", ".html"]);
const PRESENTATIONAL = /\b(fill|stroke|stop-color|flood-color|lighting-color)\s*=\s*"([^"]*)"/g;

let files = 0;
const failures = [];

function scan(file) {
  files += 1;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    for (const match of line.matchAll(PRESENTATIONAL)) {
      if (!match[2].includes("var(")) continue;
      failures.push({
        where: `${relative(ROOT, file)}:${index + 1}`,
        text: `${match[1]}="${match[2]}"`,
      });
    }
  });
}

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === "node_modules" || name.startsWith(".next")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (EXTS.has(extname(path))) scan(path);
  }
}

for (const dir of WALK) walk(join(ROOT, dir));

if (failures.length) {
  console.error("svg var() guard — var() in an SVG presentation attribute:");
  for (const failure of failures) {
    console.error(`  ✗ ${failure.where}  ${failure.text}`);
    console.error("      it will fall back to currentColor, not to your variable");
    console.error(`      fix: style={{ ${failure.text.split("=")[0]}: "var(…)" }} or a CSS rule`);
  }
  console.error(`RESULT: FAIL — ${failures.length} in ${files} file(s)`);
  process.exit(1);
}

console.log(`svg var() guard — scanned ${files} file(s), no var() in an SVG presentation attribute`);
console.log("RESULT: PASS");