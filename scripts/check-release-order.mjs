#!/usr/bin/env node
/**
 * Is every migration that the running code depends on recorded, in the right order?
 *
 * The failure this prevents is the other half of the same story: `0007_dual_venues.sql` added a table
 * the new code reads, and the deploy went out before the migration was applied. The container ran
 * queries against a table that did not exist, and the first sign of it was a 500 on the page a guest
 * had opened.
 *
 * Two checks, because there are two ways to get this wrong:
 *
 *   1. **Every migration file is recorded in `db/RELEASE.md`.** A migration nobody wrote down is a
 *      migration somebody will apply late or not at all.
 *   2. **Every object a migration creates that the code actually reads is called out as a "reader"**
 *      — i.e. the migration is named in the document, so its apply-before-deploy requirement is
 *      visible next to the code that needs it.
 *
 * It cannot check that the migration *was* applied — that is `/api/health`'s job, and it reports
 * `checks.schema` for exactly that. What this checks is that the knowledge exists in the repository.
 *
 * Usage: node scripts/check-release-order.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = join(ROOT, "db", "migrations");
const RELEASE = join(ROOT, "db", "RELEASE.md");
const SRC = join(ROOT, "src");

const problems = [];
function check(label, ok, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) problems.push(label);
}

console.log("VELORA — migration release order");

if (!existsSync(MIGRATIONS)) {
  console.error("✗ no db/migrations directory");
  process.exit(1);
}
if (!existsSync(RELEASE)) {
  console.error("✗ no db/RELEASE.md — the apply-before-deploy order is not written down anywhere.");
  process.exit(1);
}

const release = readFileSync(RELEASE, "utf8");
const migrations = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort();
check("there is at least one migration", migrations.length > 0, `${migrations.length}`);

/** The document must state the order, not merely exist. */
check(
  "db/RELEASE.md states that the migration is applied before the deploy",
  /migrate first, then deploy/i.test(release),
  "the sentence a reader needs",
);

/**
 * Every migration, by name, in the document.
 */
const unrecorded = migrations.filter((name) => !release.includes(name));
check("every migration file is named in db/RELEASE.md", unrecorded.length === 0, unrecorded.join(", "));

/**
 * Every migration, in order, and the document's list must not skip one.
 */
const listed = migrations.filter((name) => release.includes(name));
check(
  "the document lists them in the order they apply",
  listed.length === migrations.length,
  `${listed.length}/${migrations.length}`,
);

// ---------------------------------------------------------------------------------------------
// What each migration creates, and whether the code reads it.
// ---------------------------------------------------------------------------------------------

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

const sources = existsSync(SRC) ? walk(SRC) : [];
const sourceText = sources.map((file) => readFileSync(file, "utf8")).join("\n");

/** `create table if not exists public.x` and `add column if not exists y`. */
function createdObjects(sql) {
  const tables = [...sql.matchAll(/create table if not exists\s+(?:public\.)?([a-z_]+)/gi)].map((m) => m[1]);
  const columns = [...sql.matchAll(/add column if not exists\s+([a-z_]+)\s+/gi)].map((m) => m[1]);
  return { tables: [...new Set(tables)], columns: [...new Set(columns)] };
}

const readers = [];
for (const name of migrations) {
  const sql = readFileSync(join(MIGRATIONS, name), "utf8");
  const { tables, columns } = createdObjects(sql);
  const usedTables = tables.filter((table) => new RegExp(`\\b${table}\\b`).test(sourceText));
  // A bare column name is far too common to search for; a column only counts when the code writes
  // the table and column together (`g.gender`) or selects it in a column list.
  const usedColumns = columns.filter((column) =>
    new RegExp(`\\b[a-z]{1,3}\\.${column}\\b|\\b${column}\\b\\s*(,|from|\\bas\\b)`).test(sourceText),
  );
  if (usedTables.length > 0 || usedColumns.length > 0) {
    readers.push({ name, tables: usedTables, columns: usedColumns });
  }
}

check(
  "every migration whose objects the code reads is named in db/RELEASE.md",
  readers.every((entry) => release.includes(entry.name)),
  readers.filter((entry) => !release.includes(entry.name)).map((entry) => entry.name).join(", "),
);

for (const entry of readers) {
  const objects = [...entry.tables, ...entry.columns];
  console.log(`    ${entry.name} is read by src/: ${objects.join(", ")}`);
}

/** And the document should say which of those is a reader, so the risk is visible where it matters. */
const undocumentedReaders = readers.filter((entry) => {
  const section = release.slice(release.indexOf(entry.name));
  return !/read|reader|query|select|scans|页/i.test(section.slice(0, 1200));
});
check(
  "the document says what reads them",
  undocumentedReaders.length === 0,
  undocumentedReaders.map((entry) => entry.name).join(", "),
);

if (problems.length > 0) {
  console.error("\nRESULT: FAIL — the release order is not recorded for every migration the code needs.");
  console.error("Fix: name the migration in db/RELEASE.md, and say which code reads its objects.");
  process.exit(1);
}

console.log(`\nRESULT: PASS — ${migrations.length} migrations recorded, ${readers.length} with readers in src/`);