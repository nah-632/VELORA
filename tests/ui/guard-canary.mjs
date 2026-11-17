/**
 * Guard canary — proves the quality gates can fail.
 *
 * A guard that has never failed is not evidence. Each of the three UI gates is pointed at a
 * directory (or stylesheet) containing a deliberate violation, and must exit non-zero; then at
 * a clean input, and must exit zero.
 *
 * This exists because the same class of mistake had already been made once in this project:
 * isolation assertions that passed for the wrong reason. The fix there was a negative control,
 * and the same discipline is applied here.
 *
 * Usage: node tests/ui/guard-canary.mjs
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
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

function runPython(script, args) {
  const result = spawnSync("python3", [join(ROOT, script), ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { code: result.status, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

const sandbox = mkdtempSync(join(tmpdir(), "velora-canary-"));
const cleanDir = join(sandbox, "clean");
const dirtyDir = join(sandbox, "dirty");
mkdirSync(cleanDir);
mkdirSync(dirtyDir);

try {
  // =========================================================================
  console.log("\nRTL guard");
  // =========================================================================

  writeFileSync(
    join(cleanDir, "fine.tsx"),
    `<div className="ps-6 pe-4 text-start border-s border-line ms-2" />\n`,
  );
  const rtlClean = runNode("scripts/check-rtl.mjs", ["--dir", cleanDir]);
  check(
    "logical properties only → exit 0",
    rtlClean.code === 0,
    `exit ${rtlClean.code}`,
  );

  writeFileSync(join(dirtyDir, "bad.tsx"), `export const x = <div className="pl-4 text-left" />;\n`);
  const rtlDirty = runNode("scripts/check-rtl.mjs", ["--dir", dirtyDir]);
  check(
    "a planted `pl-4 text-left` → exit 1",
    rtlDirty.code === 1,
    `exit ${rtlDirty.code}, output: ${rtlDirty.out.slice(0, 80)}`,
  );
  check(
    "  and it names the offending file and rule",
    rtlDirty.out.includes("bad.tsx") && rtlDirty.out.includes("physical"),
  );

  // A deliberate physical value must be allowed through with a reason.
  writeFileSync(
    join(dirtyDir, "bad.tsx"),
    `export const x = <div className="left-0" />; // rtl-ok: logo must not mirror\n`,
  );
  const rtlEscaped = runNode("scripts/check-rtl.mjs", ["--dir", dirtyDir]);
  check(
    "an `rtl-ok: <reason>` line is honoured",
    rtlEscaped.code === 0,
    `exit ${rtlEscaped.code}`,
  );

  // =========================================================================
  console.log("\nCSS guard");
  // =========================================================================

  writeFileSync(join(cleanDir, "ok.css"), `:root {\n  --gold: #b99b6c;\n}\n`);
  const cssClean = runNode("scripts/check-css.mjs", ["--dir", cleanDir]);
  check("C-style comments only → exit 0", cssClean.code === 0, `exit ${cssClean.code}`);

  writeFileSync(
    join(dirtyDir, "bad.css"),
    `# VELORA tokens\n# this looks like a comment and is not one\n:root {\n  --gold: #b99b6c;\n}\n`,
  );
  const cssDirty = runNode("scripts/check-css.mjs", ["--dir", dirtyDir]);
  check(
    "a planted `#` comment line → exit 1",
    cssDirty.code === 1,
    `exit ${cssDirty.code}, output: ${cssDirty.out.slice(0, 80)}`,
  );
  check("  and it says why", cssDirty.out.includes("not a CSS comment"));

  // =========================================================================
  console.log("\nContrast gate");
  // =========================================================================

  const goodTokens = join(sandbox, "good-tokens.css");
  // A copy of the real stylesheet: the gate must pass on what actually ships.
  writeFileSync(goodTokens, readFileSync(join(ROOT, "src/styles/tokens.css"), "utf8"));
  const contrastClean = runPython("scripts/check-contrast.py", ["--tokens", goodTokens]);
  check(
    "the real stylesheet → exit 0",
    contrastClean.code === 0,
    `exit ${contrastClean.code}`,
  );

  // The same stylesheet with ink lightened until body copy fails AA on ivory.
  const lightened = readFileSync(join(ROOT, "src/styles/tokens.css"), "utf8").replace(
    "--ink: var(--obsidian);",
    "--ink: #8a8f8b;",
  );
  check("  (the ink token was actually altered)", lightened.includes("#8a8f8b"));
  writeFileSync(goodTokens, lightened);
  const contrastDirty = runPython("scripts/check-contrast.py", ["--tokens", goodTokens]);
  check(
    "ink lightened past AA → exit 1",
    contrastDirty.code === 1,
    `exit ${contrastDirty.code}`,
  );
  check(
    "  and it reports the measured ratio",
    /required failures: [1-9]/.test(contrastDirty.out),
    contrastDirty.out.split("\n").filter((l) => l.includes("required failures")).join(" "),
  );
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

console.log(`\nguard canary: ${passed}/${passed + failed} expectations met`);
if (failed > 0) {
  console.log("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
