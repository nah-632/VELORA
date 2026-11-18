/**
 * Migration runner for the CranL-managed PostgreSQL.
 *
 * Why not `drizzle-kit migrate`: the schema is written as SQL, and it carries things a schema DSL
 * cannot express — a check constraint that refuses a decline with companions, a single-row settings
 * table, a trigger that owns `updated_at`, and a `do $$` block over five tables. Drizzle is the
 * typed access layer (tasks/plan.md AD-14); this is the migration path.
 *
 * Properties that matter in production:
 *   - each migration runs in its own transaction, so a failure leaves the database at the previous
 *     version rather than half-way through;
 *   - an applied migration whose file has since changed is a hard failure, not a silent skip — a
 *     checksum mismatch means the database and the repository disagree about what was applied;
 *   - it is idempotent: running it twice is a no-op.
 *
 * Usage
 *   npm run db:migrate            apply everything pending
 *   npm run db:migrate -- --status print what is applied and what the schema contains
 *   npm run db:migrate -- --dry-run
 *
 * On CranL it is run inside the application container, which is the only place with a route to the
 * database: `run_command --command "node scripts/db-migrate.mjs"`. Nothing has to be exposed to the
 * internet to migrate.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "db/migrations");

const args = new Set(process.argv.slice(2));
const status = args.has("--status");
const dryRun = args.has("--dry-run");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set.\n" +
      "  locally: it lives in .env.local (never committed)\n" +
      "  on CranL: it is injected into the application by connect_database_to_app\n" +
      "Nothing was changed.",
  );
  process.exit(1);
}

if (!existsSync(DIR)) {
  console.error(`no migrations directory at ${DIR} — refusing to report success on an empty set`);
  process.exit(1);
}

const files = readdirSync(DIR).filter((n) => n.endsWith(".sql")).sort();
const migrations = files.map((name) => {
  const sql = readFileSync(join(DIR, name), "utf8");
  return { name, sql, checksum: createHash("sha256").update(sql).digest("hex").slice(0, 16) };
});

const { default: postgres } = await import("postgres");
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql`
    create table if not exists public.schema_migrations (
      name       text primary key,
      checksum   text not null,
      applied_at timestamptz not null default now()
    )`;

  const applied = await sql`select name, checksum, applied_at from public.schema_migrations order by name`;
  const appliedByName = new Map(applied.map((r) => [r.name, r]));

  for (const m of applied) {
    const file = migrations.find((x) => x.name === m.name);
    if (file && file.checksum !== m.checksum) {
      console.error(
        `\n✗ ${m.name} was applied as ${m.checksum} but the file is now ${file.checksum}.\n` +
          "  The database and the repository disagree about what this migration did.\n" +
          "  Add a new migration that moves the schema forward instead of editing an applied one.\n",
      );
      process.exit(1);
    }
  }

  const pending = migrations.filter((m) => !appliedByName.has(m.name));

  if (status) {
    console.log("applied:");
    for (const m of applied) console.log(`  ✓ ${m.name}  (${m.checksum}, ${m.applied_at.toISOString()})`);
    console.log(`pending: ${pending.length ? pending.map((m) => m.name).join(", ") : "none"}`);

    const tables = await sql`
      select table_name, (select count(*) from information_schema.columns c
                           where c.table_schema = 'public' and c.table_name = t.table_name)::int as columns
        from information_schema.tables t
       where t.table_schema = 'public' order by t.table_name`;
    console.log("\nschema:");
    for (const row of tables) console.log(`  ${row.table_name}  ${row.columns} columns`);

    const counts = {};
    for (const table of ["events", "guests", "rsvps", "templates", "settings"]) {
      if (!tables.some((x) => x.table_name === table)) continue;
      const [{ n }] = await sql`select count(*)::int as n from ${sql(table)}`;
      counts[table] = n;
    }
    console.log("\nrows:", JSON.stringify(counts));
    await sql.end();
    process.exit(0);
  }

  if (pending.length === 0) {
    console.log(`nothing to do — ${applied.length} migration(s) already applied`);
    await sql.end();
    process.exit(0);
  }

  console.log(dryRun ? "would apply:" : "applying:");
  for (const m of pending) console.log(`  • ${m.name}  (${m.checksum})`);
  if (dryRun) {
    await sql.end();
    process.exit(0);
  }

  for (const m of pending) {
    await sql.begin(async (tx) => {
      await tx.unsafe(m.sql);
      await tx`insert into public.schema_migrations (name, checksum) values (${m.name}, ${m.checksum})`;
    });
    console.log(`  ✓ ${m.name}`);
  }
  console.log(`\n${pending.length} migration(s) applied. Nothing else was touched.`);
} catch (error) {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 }).catch(() => {});
}
