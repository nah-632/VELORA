/**
 * Migration replay proof.
 *
 * Applies every migration to an empty database, then applies the entire set a second time.
 * A migration that cannot be re-applied is a deployment hazard: any partially-applied or
 * re-run deployment becomes unrecoverable, and this device cannot run a real `initdb`.
 *
 * Usage: npm run test:db:migrations
 */
import { createTestDatabase, migrationFiles, readMigration } from "../tests/db/setup.mjs";

async function applySet(db, files, label) {
  for (const name of files) {
    try {
      await db.exec(readMigration(name));
    } catch (error) {
      console.error(`\n✗ migration ${name} failed during ${label}\n`);
      console.error(error.message);
      process.exit(1);
    }
  }
}

const files = migrationFiles();
console.log("VELORA — migration replay (real PostgreSQL 17 via PGlite/WASM)");
console.log(`migrations found: ${files.length}${files.length ? ` (${files.join(", ")})` : ""}\n`);

const db = await createTestDatabase({ applyMigrations: false });

await applySet(db, files, "first pass");
console.log(`✓ applied ${files.length} migration(s) from empty`);

await applySet(db, files, "second pass");
console.log("✓ re-applied the same set (idempotent)");

const tables = await db.query(
  `select count(*)::int as n from information_schema.tables
    where table_schema not in ('pg_catalog', 'information_schema')`,
);
const functions = await db.query(
  `select count(*)::int as n from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app_private')`,
);
const policies = await db.query(
  `select count(*)::int as n from pg_policies where schemaname = 'public'`,
);

console.log(`\ntables:    ${tables.rows[0].n}`);
console.log(`functions: ${functions.rows[0].n}`);
console.log(`policies:  ${policies.rows[0].n}`);

const helpers = ["uid", "role_name", "bahrain_today", "is_admin", "log_admin_action", "handle_new_user"];
const found = await db.query(
  `select p.proname from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app_private' and p.proname = any($1::text[])`,
  [helpers],
);
const present = found.rows.map((r) => r.proname).sort();
const missing = helpers.filter((h) => !present.includes(h));
if (missing.length) {
  console.error(`✗ missing helper function(s): ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`helpers:   ${present.join(", ")}`);

// The policies must exist as real rows, not merely as intent in a file.
if (policies.rows[0].n < 7) {
  console.error(`✗ expected at least 7 policies on public, found ${policies.rows[0].n}`);
  process.exit(1);
}

await db.close();
console.log("\nRESULT: PASS");
