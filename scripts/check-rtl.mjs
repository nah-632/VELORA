/**
 * VELORA — RTL guard.
 *
 * Fails the build on physical direction utilities and physical CSS properties in `src/`.
 *
 * Why a gate and not a guideline: in RTL, `pl-4` pads the wrong side, and the mistake is
 * invisible to anyone reviewing in English. Logical properties (`ps-4`, `me-2`, `text-start`)
 * make one stylesheet correct in both directions. This is the cheapest high-yield RTL control
 * available, so it is enforced rather than documented.
 *
 * Usage: node scripts/check-rtl.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// `--dir <path>` lets the canary test point this guard at a directory containing a deliberate
// violation. Without it, "the guard passes" is an untested claim.
const dirArg = (() => {
  const index = process.argv.indexOf("--dir");
  return index > -1 ? process.argv[index + 1] : null;
})();
const SCAN_DIRS = dirArg ? [dirArg] : ["src"];
const EXTENSIONS = new Set([".ts", ".tsx", ".css", ".jsx", ".js"]);

/** An absolute `--dir` is used as given; a relative one is resolved against the project root. */
function resolveScanDir(dir) {
  return isAbsolute(dir) ? dir : join(ROOT, dir);
}

// Tailwind utilities with a physical axis. `ps-`/`pe-`/`ms-`/`me-` are the logical forms.
const UTILITY_PATTERNS = [
  { re: /(?:^|[\s"'`{])(?:-)?(?:pl|pr|ml|mr)-\[?[0-9a-z.]/g, name: "physical padding/margin utility" },
  { re: /(?:^|[\s"'`{])text-(?:left|right)\b/g, name: "physical text alignment" },
  { re: /(?:^|[\s"'`{])border-(?:l|r)(?:-|\b)/g, name: "physical border side" },
  { re: /(?:^|[\s"'`{])rounded-(?:tl|tr|bl|br)\b/g, name: "physical corner radius" },
  { re: /(?:^|[\s"'`{])(?:inset-)?(?:left|right)-\[?[0-9a-z.]/g, name: "physical inset" },
  { re: /(?:^|[\s"'`{])float-(?:left|right)\b/g, name: "physical float" },
];

// Physical CSS properties written by hand.
const CSS_PATTERNS = [
  { re: /(?:^|[;{\s])(margin|padding)-(left|right)\s*:/g, name: "physical CSS property" },
  { re: /(?:^|[;{\s])(left|right)\s*:\s*(?!auto\b)[^;]+;/g, name: "physical CSS offset" },
  { re: /(?:^|[;{\s])text-align\s*:\s*(left|right)\b/g, name: "physical text-align" },
];

// A line may opt out when the direction is deliberately physical, e.g. a logo that must not
// mirror in RTL. The justification is required, not optional.
const ESCAPE = /rtl-ok:\s*\S/;

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (["node_modules", ".next", ".git"].includes(entry)) continue;
      yield* walk(full);
    } else if (EXTENSIONS.has(extname(full))) {
      yield full;
    }
  }
}

function stripComments(line) {
  return line.replace(/\/\*.*?\*\//g, "").replace(/\/\/.*$/, "");
}

const findings = [];
let scanned = 0;

for (const scanDir of SCAN_DIRS) {
  for (const file of walk(resolveScanDir(scanDir))) {
    scanned += 1;
    const lines = readFileSync(file, "utf8").split("\n");
    for (const [index, rawLine] of lines.entries()) {
      if (ESCAPE.test(rawLine)) continue;
      const line = stripComments(rawLine);
      const isCss = extname(file) === ".css";
      const patterns = isCss ? [...CSS_PATTERNS, ...UTILITY_PATTERNS] : UTILITY_PATTERNS;
      for (const { re, name } of patterns) {
        re.lastIndex = 0;
        const match = re.exec(line);
        if (match) {
          findings.push({
            file: relative(ROOT, file),
            line: index + 1,
            name,
            text: match[0].trim().slice(0, 40),
          });
          break;
        }
      }
    }
  }
}

console.log(`VELORA RTL guard — scanned ${scanned} file(s) under ${SCAN_DIRS.join(", ")}\n`);

// A guard that examined nothing must never report success: a missing or renamed directory would
// otherwise turn this gate into a rubber stamp.
if (scanned === 0) {
  console.log("✗ no files were scanned — a guard that examines nothing cannot pass");
  console.log("\nRESULT: FAIL");
  process.exit(1);
}

if (findings.length === 0) {
  console.log("no physical direction utilities found");
  console.log("\nRESULT: PASS");
  process.exit(0);
}

for (const finding of findings) {
  console.log(`✗ ${finding.file}:${finding.line}  ${finding.name}  →  "${finding.text}"`);
}
console.log(`\n${findings.length} finding(s). Use logical properties: ps-/pe-/ms-/me-, text-start/end,`);
console.log("border-s/border-e, start-/end-, rounded-ss/se/es/ee.");
console.log("A deliberate physical value needs a `rtl-ok: <reason>` comment on the same line.");
console.log("\nRESULT: FAIL");
process.exit(1);
