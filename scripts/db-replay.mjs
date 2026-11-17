/**
 * Local database harness.
 *
 * Applies every migration in `supabase/migrations` in filename order to an empty database,
 * then applies the entire set a **second time** to prove the migrations are re-runnable, then
 * reports what exists. Runs on PGlite — real PostgreSQL compiled to WASM — which is the only
 * way to get a genuine PostgreSQL on this device (initdb needs shared memory, which the sandbox
 * does not provide).
 *
 * Usage: npm run test:db
 */
import { PGlite } from "@electric-sql/pglite";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(ROOT, "supabase/migrations");
const STUB = join(ROOT, "tests/db/supabase-stub.sql");

function migrationFiles() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort(); // filename order is the migration order: NNNN_description.sql
}

async function applySet(db, files, { label }) {
  for (const name of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, name), "utf8");
    try {
      await db.exec(sql);
    } catch (error) {
      console.error(`\n✗ migration ${name} failed during ${label}\n`);
      console.error(error.message);
      process.exit(1);
    }
  }
}

async function count(db, sql) {
  const result = await db.query(sql);
  const row = result.rows[0] ?? {};
  return Number(Object.values(row)[0] ?? 0);
}

async function main() {
  const files = migrationFiles();
  console.log("VELORA — database harness (real PostgreSQL 17 via PGlite/WASM)");
  console.log(`migrations found: ${files.length}${files.length ? ` (${files.join(", ")})` : ""}\n`);

  const db = await PGlite.create();

  if (!existsSync(STUB)) {
    console.error(`✗ missing ${STUB}`);
    process.exit(1);
  }
  await db.exec(readFileSync(STUB, "utf8"));

  // Pass 1 — from an empty database.
  await applySet(db, files, { label: "first pass" });
  console.log(`✓ applied ${files.length} migration(s) from empty`);

  // Pass 2 — every migration must be safe to re-apply. A migration that is not is a
  // deployment hazard: any partially-applied run becomes unrecoverable.
  await applySet(db, files, { label: "second pass" });
  console.log("✓ re-applied the same set (idempotent)");

  const tables = await count(
    db,
    `select count(*)::int from information_schema.tables
      where table_schema not in ('pg_catalog', 'information_schema')`,
  );
  const functions = await count(
    db,
    `select count(*)::int from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'app_private', 'auth')`,
  );

  console.log(`\ntables:    ${tables}`);
  console.log(`functions: ${functions}`);

  // The helpers the whole schema leans on must exist and be callable.
  const helpers = ["uid", "role_name", "bahrain_today"];
  const rows = await db.query(
    `select p.proname from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app_private' and p.proname = any($1::text[])`,
    [helpers],
  );
  const found = rows.rows.map((r) => r.proname).sort();
  const missing = helpers.filter((h) => !found.includes(h));
  if (missing.length) {
    console.error(`✗ missing helper function(s): ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log(`helpers present: ${found.join(", ")}`);

  await db.close();
  console.log("\nRESULT: PASS");
}

main().catch((error) => {
  console.error("\n✗ harness crashed\n");
  console.error(error);
  process.exit(1);
});
