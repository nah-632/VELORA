#!/usr/bin/env node
/**
 * Does `package.json` agree with `package-lock.json`?
 *
 * This exists because of a specific failure: `playwright` was added to `devDependencies` by editing
 * package.json as text, never installed, so the lockfile never learned about it. `npm ci` refuses to
 * run when the two disagree — correctly — and every deployment died at the install step while
 * `npm run verify` stayed green, because nothing in the suite looks at either file.
 *
 * The rule that prevents it: **never edit package.json by hand. `npm install <pkg>` writes both
 * files, and only one of them is guessable.**
 *
 * The check is a structural comparison rather than `npm ci --dry-run`:
 *
 *   - it is deterministic and offline, so it can run on every `verify` without a network;
 *   - `npm ci --dry-run` resolves the whole tree, which on this device is minutes;
 *   - and the thing that broke was a *declared* dependency missing from the lock, which is exactly
 *     what a name-by-name comparison finds.
 *
 * Usage: node scripts/check-lockfile.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = join(ROOT, "package.json");
const lockPath = join(ROOT, "package-lock.json");

const problems = [];
function check(label, ok, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) problems.push(label);
}

console.log("VELORA — package.json against package-lock.json");

if (!existsSync(lockPath)) {
  console.error("✗ no package-lock.json. Run `npm install` and commit the result.");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const locked = lock.packages ?? {};

check("the lockfile records a lockfileVersion", typeof lock.lockfileVersion === "number", `v${lock.lockfileVersion}`);

/** Every package.json declaration must be a package the lockfile knows about. */
const sections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
const missing = [];
let declared = 0;
for (const section of sections) {
  for (const [name, range] of Object.entries(pkg[section] ?? {})) {
    declared += 1;
    const entry = locked[`node_modules/${name}`];
    if (!entry) {
      missing.push(`${name}@${range} (${section})`);
      continue;
    }
    // `npm install` records the resolved version; a range that no longer includes it means somebody
    // edited the range by hand instead of running `npm install <pkg>@<range>`.
    const wanted = String(range).replace(/^[~^=]/, "");
    if (/^\d/.test(wanted) && entry.version && !entry.version.startsWith(wanted.split(".")[0])) {
      missing.push(`${name}@${range} — lockfile has ${entry.version} (${section})`);
    }
  }
}
check("every declared dependency is in the lockfile", missing.length === 0, missing.join(", "));
check("the root package entry matches", locked[""]?.name === pkg.name, `${locked[""]?.name} vs ${pkg.name}`);

/**
 * The lockfile's own root block is what `npm ci` compares first: it carries the declared ranges
 * copied at install time. If they differ from package.json, `npm ci` fails — and this is the exact
 * comparison it makes.
 */
const rootEntry = locked[""] ?? {};
for (const section of sections) {
  const inJson = pkg[section] ?? {};
  const inLock = rootEntry[section] ?? {};
  const drift = [];
  for (const [name, range] of Object.entries(inJson)) {
    if (inLock[name] !== range) drift.push(`${name}: package.json "${range}" vs lock "${inLock[name] ?? "absent"}"`);
  }
  for (const name of Object.keys(inLock)) {
    if (!(name in inJson)) drift.push(`${name}: in the lock but not in package.json`);
  }
  check(`${section} matches the lockfile's root block`, drift.length === 0, drift.slice(0, 4).join("; "));
}

console.log(
  declared === 0
    ? "  (no dependencies declared)"
    : `  ${declared} declared dependenc${declared === 1 ? "y" : "ies"} checked`,
);

if (problems.length > 0) {
  console.error("\nRESULT: FAIL — package.json and package-lock.json disagree.");
  console.error("`npm ci` will refuse to install, and the deployment will die at the install step.");
  console.error("Fix: NEVER edit package.json by hand. Run `npm install <pkg>` (or `npm uninstall <pkg>`),");
  console.error("which writes both files, then commit both.");
  process.exit(1);
}

console.log("\nRESULT: PASS — the two files agree, so `npm ci` will install");