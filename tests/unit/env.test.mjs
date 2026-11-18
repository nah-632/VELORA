/**
 * Environment validation — does a misconfigured deployment fail loudly, and does it fail early?
 *
 * Run in a child process with a controlled environment: env.ts parses at module load, which is
 * the behaviour under test, and module caching would hide it inside this process.
 *
 * Rewritten for ADDENDUM E. It used to check that Supabase's keys were required; what a CranL
 * deployment actually needs is a database and a secret to pepper hashes with. The four ideas are
 * unchanged — fail loudly, name the variable, fail early, and never print a value.
 *
 * Run: npm test
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const BOOT = `
import('./src/lib/env.ts')
  .then((m) => { m.serverEnv(); console.log('BOOT_OK'); })
  .catch((e) => { console.log('BOOT_FAIL: ' + e.message); process.exit(1); });
`;

const PUBLIC_ONLY = { NEXT_PUBLIC_SITE_URL: "https://velora.example" };
const SERVER_COMPLETE = {
  DATABASE_URL: "postgresql://user:pass@host:5432/db",
  SESSION_SECRET: "a-session-secret-that-is-long-enough-to-pass",
};

function boot(env) {
  const result = spawnSync(process.execPath, ["--import", "tsx", "-e", BOOT], {
    cwd: ROOT,
    encoding: "utf8",
    // A deliberately closed environment: nothing is inherited, so a variable that happens to be
    // set on this machine cannot make a test pass.
    env: { PATH: process.env.PATH, NODE_ENV: "test", ...env },
  });
  return { code: result.status, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

test("in production, a missing site URL fails by name instead of defaulting to localhost", () => {
  // Without this, a deployment that forgot the variable boots and then sends every guest a
  // `http://localhost:3000/i/<token>` link. That was the behaviour before this test existed.
  const { code, out } = boot({ NODE_ENV: "production" });
  assert.equal(code, 1, `expected a failure, got: ${out}`);
  assert.match(out, /Invalid public environment/);
  assert.match(out, /NEXT_PUBLIC_SITE_URL/);
  assert.match(out, /\.env\.example/);
});

test("in development the site URL falls back, and the server variables are still required", () => {
  const { code, out } = boot({ NODE_ENV: "development" });
  assert.equal(code, 1, `expected a failure, got: ${out}`);
  assert.match(out, /Invalid server environment/);
  assert.match(out, /DATABASE_URL/);
});

test("public variables alone are not enough — the server secret is required too", () => {
  const { code, out } = boot(PUBLIC_ONLY);
  assert.equal(code, 1, `expected a failure, got: ${out}`);
  assert.match(out, /Invalid server environment/);
  assert.match(out, /DATABASE_URL/);
});

test("a database without a session secret is still refused", () => {
  const { code, out } = boot({ ...PUBLIC_ONLY, DATABASE_URL: SERVER_COMPLETE.DATABASE_URL });
  assert.equal(code, 1, `expected a failure, got: ${out}`);
  assert.match(out, /SESSION_SECRET/);
});

test("a complete environment boots", () => {
  const { code, out } = boot({ ...PUBLIC_ONLY, ...SERVER_COMPLETE });
  assert.equal(code, 0, `expected success, got: ${out}`);
  assert.match(out, /BOOT_OK/);
});

test("the failure message never echoes a value, only the name of what is wrong", () => {
  const connectionString = "postgresql://operator:a-real-password@db.internal:5432/velora";
  const { code, out } = boot({
    ...PUBLIC_ONLY,
    DATABASE_URL: connectionString,
    // Too short: the failure names the variable, and must say nothing about the others.
    SESSION_SECRET: "short",
  });
  assert.equal(code, 1, `expected a failure, got: ${out}`);
  assert.match(out, /SESSION_SECRET/);
  assert.equal(out.includes(connectionString), false, "a configured connection string leaked into the error output");
  assert.equal(out.includes("a-real-password"), false, "a password leaked into the error output");
});
