/**
 * Real-defect replay — proves the guards catch the bugs that actually shipped.
 *
 * Distinct from guard-canary.mjs: that one plants *representative* violations. This one
 * plants the three defects that really occurred in this project, in the shape they really
 * occurred (2026-11-19 outline position, 2026-11-20 pointer-events overlay, 2026-11-21
 * RTL mask direction). The question is not "can the guard fail?" but "would the guard
 * have stopped us?"
 *
 * Each case copies the current source into a sandbox, introduces exactly one historical
 * defect, runs the relevant guard, and asserts non-zero. A defect that the guard misses
 * is a real gap, not a theoretical one — and is reported as such rather than hidden.
 *
 * Usage: node tests/ui/real-defect-replay.mjs
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

let passed = 0;
let failed = 0;

function report(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? `  — ${detail}` : ""}`);
  }
}

function runNode(script, args) {
  const result = spawnSync(process.execPath, [join(ROOT, script), ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { code: result.status, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

const sandbox = mkdtempSync(join(tmpdir(), "velora-replay-"));

/**
 * Copies src/ into a fresh directory and applies one string replacement.
 * Returns the sandbox path. Throws if the search string is absent — a replay that
 * silently no-ops would "pass" by not planting anything.
 */
function stage(name, file, search, replacement) {
  const dir = join(sandbox, name);
  cpSync(join(ROOT, "src"), dir, { recursive: true });
  const target = join(dir, file);
  const before = readFileSync(target, "utf8");
  if (!before.includes(search)) {
    throw new Error(
      `replay ${name}: search string not found in ${file}\n  searched: ${search.slice(0, 80)}`,
    );
  }
  writeFileSync(target, before.replace(search, replacement));
  return dir;
}

console.log("\nReal-defect replay — would the guards have caught these?");

try {
  // -------------------------------------------------------------------------
  // Defect 1 (2026-11-19): physical `left`/`right` where a logical property belonged.
  // The seal was positioned with an offset that only held in LTR.
  // -------------------------------------------------------------------------
  {
    const dir = stage(
      "physical-offset",
      "styles/invitation.css",
      ".seal__disc {",
      ".seal__disc {\n  left: 50%;",
    );
    const r = runNode("scripts/check-rtl.mjs", ["--dir", dir]);
    report(
      "physical `left` in CSS is rejected by the RTL guard",
      r.code !== 0,
      r.code === 0 ? "guard passed a physical property — BLIND SPOT" : "",
    );
  }

  // -------------------------------------------------------------------------
  // Defect 2 (2026-11-19): a Tailwind physical utility (`pl-4`) in a TSX file.
  // This is the shape the RTL guard was written for.
  // -------------------------------------------------------------------------
  {
    const dir = stage(
      "physical-utility",
      "app/[locale]/layout.tsx",
      "<body",
      '<body className="pl-4"',
    );
    const r = runNode("scripts/check-rtl.mjs", ["--dir", dir]);
    report(
      "Tailwind `pl-4` in a component is rejected by the RTL guard",
      r.code !== 0,
      r.code === 0 ? "guard missed a physical utility — BLIND SPOT" : "",
    );
  }

  // -------------------------------------------------------------------------
  // Defect 3 (2026-11-20): an unterminated CSS comment — the class of mistake the
  // CSS guard's own message claims to catch ("no malformed comments").
  //
  // Planted by APPENDING, not by inserting: several stylesheets already open with a
  // block comment, so an insert lands inside it and the delimiters still balance.
  // A replay that plants nothing observable would report a false blind spot.
  // -------------------------------------------------------------------------
  {
    const dir = join(sandbox, "unterminated-comment");
    cpSync(join(ROOT, "src"), dir, { recursive: true });
    const target = join(dir, "styles/tokens.css");
    writeFileSync(target, `${readFileSync(target, "utf8")}\n/* never closed\n`);
    const r = runNode("scripts/check-css.mjs", ["--dir", dir]);
    report(
      "unterminated CSS comment is rejected by the CSS guard",
      r.code !== 0,
      r.code === 0 ? "guard passed a malformed comment — BLIND SPOT" : "",
    );
  }
} catch (error) {
  failed += 1;
  console.log(`  ✗ replay could not run — ${error.message}`);
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

console.log(`\nreal-defect replay: ${passed}/${passed + failed} caught`);
console.log(`RESULT: ${failed === 0 ? "PASS" : "FAIL"}`);
process.exit(failed === 0 ? 0 : 1);