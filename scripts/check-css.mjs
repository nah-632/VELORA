/**
 * VELORA — CSS validity guard.
 *
 * Exists because of a real failure: a stylesheet whose header used `#` lines (a shell habit,
 * not CSS syntax) shipped a file where every `var()` reference resolved to nothing. The
 * utilities further down still worked, so the page looked "mostly styled" while every colour
 * and every font fell back. It took a rendered screenshot to notice.
 *
 * These checks are cheap and each one has already cost a debugging session somewhere.
 *
 * Usage: node scripts/check-css.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// `--dir <path>` exists so the canary test can point this guard at a planted violation.
const dirArg = (() => {
  const index = process.argv.indexOf("--dir");
  return index > -1 ? process.argv[index + 1] : null;
})();
const SCAN_DIRS = dirArg ? [dirArg] : ["src/styles"];

/** An absolute `--dir` is used as given; a relative one is resolved against the project root. */
function resolveScanDir(dir) {
  return isAbsolute(dir) ? dir : join(ROOT, dir);
}

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
      if (entry === "node_modules") continue;
      yield* walk(full);
    } else if (extname(full) === ".css") {
      yield full;
    }
  }
}

const findings = [];
let scanned = 0;

for (const dir of SCAN_DIRS) {
  for (const file of walk(resolveScanDir(dir))) {
    scanned += 1;
    const lines = readFileSync(file, "utf8").split("\n");
    let inComment = false;

    for (const [index, line] of lines.entries()) {
      const trimmed = line.trim();
      const opens = (line.match(/\/\*/g) ?? []).length;
      const closes = (line.match(/\*\//g) ?? []).length;
      const wasInComment = inComment;
      if (opens > closes) inComment = true;
      if (closes > 0 && closes >= opens) inComment = false;
      if (wasInComment) continue;

      // 1. A `#` line outside a comment is not CSS. It is usually a shell-style comment, and
      //    the parser's recovery swallows the next rule.
      if (/^#/.test(trimmed)) {
        findings.push({
          file: relative(ROOT, file),
          line: index + 1,
          rule: "'#' is not a CSS comment",
          text: trimmed.slice(0, 50),
        });
      }

      // 2. A dark colour token named as a surface, or vice versa, is the other mistake this
      //    project has made. Cheap to catch here.
      const match = /^\s*--(border|line|divider)\s*:\s*(#[0-9a-fA-F]{6})/.exec(line);
      if (match && match[2]) {
        const lum = Number.parseInt(match[2].slice(1, 3), 16);
        if (lum < 0x40) {
          findings.push({
            file: relative(ROOT, file),
            line: index + 1,
            rule: "divider token that is nearly black",
            text: match[0].trim(),
          });
        }
      }
    }
  }
}

console.log(`VELORA CSS guard — scanned ${scanned} file(s) under ${SCAN_DIRS.join(", ")}\n`);

// A guard that examined nothing must never report success.
if (scanned === 0) {
  console.log("✗ no files were scanned — a guard that examines nothing cannot pass");
  console.log("\nRESULT: FAIL");
  process.exit(1);
}

if (findings.length === 0) {
  console.log("no malformed comments, no suspicious tokens");
  console.log("\nRESULT: PASS");
  process.exit(0);
}

for (const f of findings) {
  console.log(`✗ ${f.file}:${f.line}  ${f.rule}  →  "${f.text}"`);
}
console.log("\nRESULT: FAIL");
process.exit(1);
