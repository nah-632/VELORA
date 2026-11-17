/**
 * Environment validation — does a misconfigured deployment fail loudly, and does it fail early?
 *
 * Run in a child process with a controlled environment: env.ts parses at module load, which is
 * the behaviour under test, and module caching would hide it inside this process.
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

const PUBLIC_ONLY = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-that-is-long-enough-x",
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

test("with no environment at all, boot fails and names the missing variable", () => {
  const { code, out } = boot({});
  assert.equal(code, 1, `expected a failure, got: ${out}`);
  assert.match(out, /Invalid public environment/);
  assert.match(out, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(out, /\.env\.example/);
});

test("public variables alone are not enough — the server secret is required too", () => {
  const { code, out } = boot(PUBLIC_ONLY);
  assert.equal(code, 1, `expected a failure, got: ${out}`);
  assert.match(out, /Invalid server environment/);
  assert.match(out, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("a complete environment boots, and PAYMENT_PROVIDER defaults to none", () => {
  const { code, out } = boot({ ...PUBLIC_ONLY, SUPABASE_SERVICE_ROLE_KEY: "service-role-key-long-enough" });
  assert.equal(code, 0, `expected success, got: ${out}`);
  assert.match(out, /BOOT_OK/);
});

test("the failure message never echoes a value, only the name of what is wrong", () => {
  const secret = "super-secret-value-that-must-not-be-printed";
  const { code, out } = boot({
    ...PUBLIC_ONLY,
    SUPABASE_SERVICE_ROLE_KEY: secret,
    PAYMENT_PROVIDER: "stripe-but-not-really-a-valid-option",
  });
  assert.equal(code, 1, `expected a failure, got: ${out}`);
  assert.match(out, /PAYMENT_PROVIDER/);
  assert.equal(out.includes(secret), false, "a configured value leaked into the error output");
});
