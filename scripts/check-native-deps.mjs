/**
 * Guard: every dependency that ships a native `.node` binary must be listed in Next's
 * `serverComponentsExternalPackages`.
 *
 * Why this exists. The first deploy of the auth slice failed on CranL with:
 *
 *   ./node_modules/@node-rs/argon2-linux-x64-gnu/argon2.linux-x64-gnu.node
 *   Module parse failed: Unexpected character '' (1:0)
 *   You may need an appropriate loader to handle this file type
 *
 * Webpack was trying to bundle a compiled binary. Nothing local catches that: `next build` exhausts
 * this device's memory, so the production bundle is only ever built on CranL — which means a
 * webpack-level mistake costs a full deploy cycle to discover. This check is cheap, runs in a
 * second, and turns that cycle into a failing command.
 *
 * The first version of this file reported "dependencies shipping a .node binary: (none)" while
 * `@node-rs/argon2` was sitting in node_modules with exactly such a binary, because it looked for
 * platform packages as `name-*` siblings instead of inside the npm scope directory. A guard that
 * finds nothing is worse than no guard, so this version proves its own detector against a fixture
 * before it reports anything about the real tree.
 *
 * Run: npm run check:native
 */
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Resolves the installed directories a declared dependency can occupy:
 *   pkg            → node_modules/pkg
 *   @scope/pkg     → node_modules/@scope/pkg
 * and, in both cases, the per-platform siblings that napi-rs packages install
 * (`pkg-linux-x64-gnu`, or `@scope/pkg-linux-x64-gnu`).
 */
function candidateDirs(root, dep) {
  const out = [];
  const [scope, name] = dep.startsWith("@") ? dep.split("/") : [null, dep];
  const scopeDir = scope ? join(root, scope) : root;
  if (!existsSync(scopeDir)) return out;
  for (const entry of readdirSync(scopeDir)) {
    if (entry !== name && !entry.startsWith(`${name}-`)) continue;
    out.push(join(scopeDir, entry));
  }
  return out;
}

/** Any `.node` file inside `dir`, two levels deep — enough for every napi-rs layout. */
function hasNativeBinary(dir, depth = 2) {
  if (!existsSync(dir) || depth < 0) return false;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (entry.endsWith(".node")) return true;
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir && hasNativeBinary(full, depth - 1)) return true;
  }
  return false;
}

/** The detector, over an arbitrary module root — so it can be proved against a fixture. */
function nativeDependencies(root, declared) {
  const found = new Set();
  for (const dep of declared) {
    if (candidateDirs(root, dep).some((dir) => hasNativeBinary(dir))) found.add(dep);
  }
  return found;
}

// ---------------------------------------------------------------------------------------------
// 1. Prove the detector works before trusting what it says about the real tree.
// ---------------------------------------------------------------------------------------------
const fixture = mkdtempSync(join(tmpdir(), "velora-native-guard-"));
let detectorProven = true;
try {
  mkdirSync(join(fixture, "@scope", "uses-native", "build"), { recursive: true });
  mkdirSync(join(fixture, "@scope", "uses-native-linux-x64-gnu"), { recursive: true });
  writeFileSync(join(fixture, "@scope", "uses-native-linux-x64-gnu", "binding.node"), "not really a binary");
  mkdirSync(join(fixture, "pure-js", "lib"), { recursive: true });
  writeFileSync(join(fixture, "pure-js", "index.js"), "module.exports = 1;");

  const detected = nativeDependencies(fixture, ["@scope/uses-native", "pure-js"]);
  detectorProven = detected.has("@scope/uses-native") && !detected.has("pure-js");
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

console.log("VELORA — native dependency guard");
console.log(`detector proved against a fixture: ${detectorProven ? "yes" : "NO"}`);

if (!detectorProven) {
  console.error(
    "\n✗ the detector failed its own fixture (a scoped package with a .node binary was not seen).\n" +
      "  Reporting PASS from a broken detector is worse than reporting nothing: fix the guard first.",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------
// 2. Now the real tree.
// ---------------------------------------------------------------------------------------------
const MODULES = join(ROOT, "node_modules");
if (!existsSync(MODULES)) {
  console.error("\n✗ node_modules is absent — the scan would examine nothing, so it proves nothing.");
  process.exit(1);
}

const config = readFileSync(join(ROOT, "next.config.mjs"), "utf8");
const externalised = new Set(
  [...config.matchAll(/serverComponentsExternalPackages:\s*\[([^\]]*)\]/g)].flatMap((match) =>
    [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]),
  ),
);

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const declared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
const natives = nativeDependencies(MODULES, declared);

console.log(`dependencies declared: ${declared.length}`);
console.log(`externalised in next.config.mjs: ${[...externalised].join(", ") || "(none)"}`);
console.log(`dependencies shipping a .node binary: ${[...natives].join(", ") || "(none)"}`);

const missing = [...natives].filter((dep) => !externalised.has(dep));
if (missing.length > 0) {
  console.error(
    `\n✗ ${missing.join(", ")} ship(s) a native binary and would be bundled by webpack.\n` +
      "  Add them to serverComponentsExternalPackages in next.config.mjs, or the CranL build will\n" +
      "  fail with 'Module parse failed: Unexpected character'.",
  );
  process.exit(1);
}

console.log(
  `\nRESULT: PASS — ${natives.size} native dependenc${natives.size === 1 ? "y" : "ies"} found, all externalised`,
);
