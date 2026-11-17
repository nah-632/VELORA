/**
 * Shared test database setup.
 *
 * One place that knows how to build a real PostgreSQL (PGlite, WASM) carrying the real
 * migrations, and how to run a query **as somebody**.
 *
 * The role discipline is the entire point of this file. PGlite connects as a superuser, which
 * bypasses row-level security entirely — so a test that merely sets a JWT claim and then queries
 * will pass whether or not the policies work. Every query here runs inside a transaction that
 * first switches role, and rolls back afterwards.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIGRATIONS_DIR = join(ROOT, "supabase/migrations");
const STUB = join(ROOT, "tests/db/supabase-stub.sql");

export function migrationFiles() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

export function readMigration(name) {
  return readFileSync(join(MIGRATIONS_DIR, name), "utf8");
}

/** A real PostgreSQL with the stub applied and every migration replayed in order. */
export async function createTestDatabase({ applyMigrations = true } = {}) {
  const db = await PGlite.create();
  await db.exec(readFileSync(STUB, "utf8"));
  if (applyMigrations) {
    for (const name of migrationFiles()) {
      try {
        await db.exec(readMigration(name));
      } catch (error) {
        throw new Error(`migration ${name} failed:\n${error.message}`);
      }
    }
  }
  return db;
}

/**
 * Runs `fn` inside a transaction that has switched to another role, with an optional
 * authenticated identity. Nothing leaks between calls.
 *
 * Rolls back by default. `commit: true` is for assertions about writes — without it, a write
 * assertion reads a world where the write never happened and passes for the wrong reason.
 *
 * @param {object} options
 * @param {string} options.role  anon | authenticated | service_role
 * @param {string} [options.uid] uuid to expose as request.jwt.claim.sub
 * @param {boolean} [options.commit] persist the work instead of rolling it back
 */
export async function asRole(db, { role, uid, commit = false }, fn) {
  await db.exec("begin");
  try {
    await setIdentity(db, { role, uid });
    const result = await fn();
    await db.exec(commit ? "commit" : "rollback");
    return result;
  } catch (error) {
    try {
      await db.exec("rollback");
    } catch {
      // The transaction may already be unusable; the original error is the one that matters.
    }
    throw error;
  }
}

export const asAnon = (db, fn) => asRole(db, { role: "anon" }, fn);
export const asCustomer = (db, uid, fn) => asRole(db, { role: "authenticated", uid }, fn);
export const asAdmin = (db, uid, fn) => asRole(db, { role: "authenticated", uid }, fn);
export const asService = (db, fn) => asRole(db, { role: "service_role" }, fn);

/** Persisting variants, for assertions that must survive the transaction. */
export const asAnonCommitted = (db, fn) => asRole(db, { role: "anon", commit: true }, fn);
export const asCustomerCommitted = (db, uid, fn) =>
  asRole(db, { role: "authenticated", uid, commit: true }, fn);
export const asAdminCommitted = (db, uid, fn) =>
  asRole(db, { role: "authenticated", uid, commit: true }, fn);

/**
 * Sets the role and identity for the *current* transaction without managing it.
 * Used when a test needs to do something else in the same transaction — for example disable a
 * policy to prove the suite can detect a broken one.
 */
export async function setIdentity(db, { role, uid }) {
  await db.exec(`set local role ${role}`);
  await db.exec(`select set_config('request.jwt.claim.role', '${role}', true)`);
  if (uid) {
    await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', true)`);
  }
}

/** Runs fn and returns the error it threw, or null if it succeeded. */
export async function expectError(fn) {
  try {
    await fn();
    return null;
  } catch (error) {
    return error;
  }
}

/** Query helper returning an array of plain rows. */
export async function rows(db, sql, params) {
  const result = await db.query(sql, params);
  return result.rows;
}

/** Query helper returning the first column of the first row as a number. */
export async function count(db, sql, params) {
  const result = await db.query(sql, params);
  const first = result.rows[0] ?? {};
  return Number(Object.values(first)[0] ?? 0);
}

/** Inserts a user the way Supabase's auth service would, and returns the id. */
export async function createUser(db, { email, fullName = "" }) {
  const result = await db.query(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, JSON.stringify({ full_name: fullName })],
  );
  return result.rows[0].id;
}

/**
 * Minimal assertion reporter. Deliberately not a test framework: these suites run as scripts
 * so they can be read top to bottom as a description of the security model.
 */
export function reporter(title) {
  const results = [];
  return {
    check(name, passed, detail = "") {
      results.push({ name, passed, detail });
      console.log(`${passed ? "  ✓" : "  ✗"} ${name}${detail ? `  — ${detail}` : ""}`);
    },
    section(name) {
      console.log(`\n${name}`);
    },
    finish() {
      const failed = results.filter((r) => !r.passed);
      console.log(`\n${title}: ${results.length - failed.length}/${results.length} assertions passed`);
      if (failed.length) {
        console.log("RESULT: FAIL");
        for (const f of failed) console.log(`  ✗ ${f.name} ${f.detail}`);
        process.exit(1);
      }
      console.log("RESULT: PASS");
    },
  };
}
