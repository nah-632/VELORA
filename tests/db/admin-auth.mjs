/**
 * The admin authentication policy, driven through the shipping code against a real PostgreSQL.
 *
 * ADDENDUM E asks for credentials login with rate limiting and lockout. A policy like this is
 * exactly the kind of thing that is easy to write and easy to be wrong about, so the tests below
 * are behavioural: they call `authenticate()` — the same function the login form calls — over a
 * PGlite database carrying the real migrations, and assert what an attacker and the operator each
 * get back.
 *
 * Run: npm run test:db:auth
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { reporter } from "./setup.mjs";
import { pgliteSql } from "./pglite-sql.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = join(ROOT, "db/migrations");

const { authenticate, POLICY, recentAttempts } = await import("../../src/features/admin/login.ts");
const seedPassword = await import("../../scripts/lib/password.mjs");
const { hashPassword, hashSessionToken, newSessionToken, newGuestToken, verifyPassword, passwordPolicyError } =
  await import("../../src/features/admin/credentials.ts");

const files = existsSync(DIR)
  ? readdirSync(DIR)
      .filter((n) => n.endsWith(".sql"))
      .sort()
  : [];

const t = reporter("VELORA — admin authentication (real PostgreSQL via PGlite/WASM)");
if (files.length === 0) {
  console.error("✗ no migrations found — refusing to report success on an empty schema");
  process.exit(1);
}

const db = await PGlite.create();
for (const name of files) {
  await db.exec(readFileSync(join(DIR, name), "utf8"));
}
const sql = pgliteSql(db);
console.log(`migrations applied: ${files.join(", ")}`);

const EMAIL = "Operator@Velora.BH";
const PASSWORD = "a-long-operator-passphrase";
const IP = "hash-of-address-one";
const OTHER_IP = "hash-of-address-two";

await db.query(`insert into public.admin_users (email, password_hash) values ($1, $2)`, [
  EMAIL,
  await hashPassword(PASSWORD),
]);

// ---------------------------------------------------------------------------------------------
t.section("the ordinary path");
const good = await authenticate({ email: EMAIL, password: PASSWORD, ipHash: IP }, { sql });
t.check("the correct password is accepted", good.ok === true);
t.check("...and it returns the user id", good.ok && typeof good.userId === "string");

const afterGood = await db.query(`select failed_attempts, locked_until, last_login_at from public.admin_users`);
t.check("a successful login clears the failure counter", afterGood.rows[0].failed_attempts === 0);
t.check("...and records when it happened", afterGood.rows[0].last_login_at !== null);

const wrongCase = await authenticate({ email: "operator@velora.bh", password: PASSWORD, ipHash: IP }, { sql });
t.check("the email is matched case-insensitively", wrongCase.ok === true);

// ---------------------------------------------------------------------------------------------
t.section("a wrong password");
const wrong = await authenticate({ email: EMAIL, password: "not-the-passphrase", ipHash: IP }, { sql });
t.check("is refused", wrong.ok === false && wrong.reason === "invalid");
const afterWrong = await db.query(`select failed_attempts from public.admin_users`);
t.check("...and counted", afterWrong.rows[0].failed_attempts === (good.ok ? 1 : 2), `failed_attempts=${afterWrong.rows[0].failed_attempts}`);

// ---------------------------------------------------------------------------------------------
t.section("an email that does not exist");
const unknown = await authenticate({ email: "someone@else.bh", password: PASSWORD, ipHash: OTHER_IP }, { sql });
t.check("is refused the same way", unknown.ok === false && unknown.reason === "invalid");
const users = await db.query(`select count(*)::int as n from public.admin_users`);
t.check("...and no account is created for it", users.rows[0].n === 1, `${users.rows[0].n} account(s)`);

// ---------------------------------------------------------------------------------------------
t.section(`lockout after ${POLICY.maxFailuresBeforeLock} failures`);
await db.query(`update public.admin_users set failed_attempts = 0, locked_until = null`);
let lastReason = null;
for (let i = 0; i < POLICY.maxFailuresBeforeLock; i += 1) {
  const outcome = await authenticate({ email: EMAIL, password: "wrong-again", ipHash: IP }, { sql });
  lastReason = outcome.ok ? "ok" : outcome.reason;
}
t.check(`the ${POLICY.maxFailuresBeforeLock}th failure locks the account`, lastReason === "locked", String(lastReason));

const locked = await authenticate({ email: EMAIL, password: PASSWORD, ipHash: IP }, { sql });
t.check("the correct password is refused while locked", locked.ok === false && locked.reason === "locked");

const lockRow = await db.query(`select locked_until from public.admin_users`);
t.check("...and a lock expiry is recorded", lockRow.rows[0].locked_until !== null);

// Expire the lock rather than waiting 15 minutes for it.
await db.query(`update public.admin_users set locked_until = now() - interval '1 minute'`);
const afterLock = await authenticate({ email: EMAIL, password: PASSWORD, ipHash: IP }, { sql });
t.check("once the lock expires, the correct password works again", afterLock.ok === true);
const cleared = await db.query(`select failed_attempts, locked_until from public.admin_users`);
t.check("...and both the counter and the lock are cleared", cleared.rows[0].failed_attempts === 0 && cleared.rows[0].locked_until === null);

// ---------------------------------------------------------------------------------------------
t.section("rate limiting by address");
const FLOOD_IP = "hash-of-a-flooding-address";
for (let i = 0; i < POLICY.maxIpFailuresPerWindow; i += 1) {
  await authenticate({ email: EMAIL, password: "wrong", ipHash: FLOOD_IP }, { sql });
}
const flooded = await authenticate({ email: EMAIL, password: PASSWORD, ipHash: FLOOD_IP }, { sql });
t.check(
  `after ${POLICY.maxIpFailuresPerWindow} failures the address is refused even with the right password`,
  flooded.ok === false && flooded.reason === "rate_limited",
  flooded.ok ? "accepted" : flooded.reason,
);
const elsewhere = await authenticate({ email: EMAIL, password: PASSWORD, ipHash: "hash-of-another-address" }, { sql });
// The two controls are not the same control, and the difference is visible here: flooding one
// account 20 times locks the ACCOUNT, so a clean address is still refused — by the lock, not by
// the address limit. Asserting `elsewhere.ok === true` was the first version of this test, and it
// was wrong: it assumed a fresh address could bypass an account lock, which is the opposite of
// what a lock is for.
t.check(
  "a clean address is refused by the account lock, not by the address limit",
  elsewhere.ok === false && elsewhere.reason === "locked",
  elsewhere.ok ? "accepted" : elsewhere.reason,
);

// Clear the account lock: now the only control in play is the address one, and a clean address
// must get through while the flooding address stays out.
await db.query(`update public.admin_users set failed_attempts = 0, locked_until = null`);
const cleanAfterReset = await authenticate(
  { email: EMAIL, password: PASSWORD, ipHash: "hash-of-another-address" },
  { sql },
);
t.check("with the lock cleared, that clean address signs in", cleanAfterReset.ok === true);
const stillFlooded = await authenticate({ email: EMAIL, password: PASSWORD, ipHash: FLOOD_IP }, { sql });
t.check(
  "...while the flooding address is still refused",
  stillFlooded.ok === false && stillFlooded.reason === "rate_limited",
  stillFlooded.ok ? "accepted" : stillFlooded.reason,
);

// ---------------------------------------------------------------------------------------------
t.section("the log");
const attempts = await recentAttempts(100, { sql });
t.check("every attempt is recorded", attempts.length >= POLICY.maxIpFailuresPerWindow);
t.check(
  "successes and failures are distinguishable",
  attempts.some((a) => a.succeeded) && attempts.some((a) => !a.succeeded),
);

// ---------------------------------------------------------------------------------------------
t.section("sessions");
const token = newSessionToken();
t.check("a session token is 256 bits of base64url", token.length >= 43, `${token.length} chars`);
t.check("...and two are never equal", newSessionToken() !== token);
t.check("the stored hash is sha256 hex", /^[0-9a-f]{64}$/.test(hashSessionToken(token)));

const adminRow = await db.query(`select id from public.admin_users limit 1`);
const adminId = adminRow.rows[0].id;
await db.query(
  `insert into public.admin_sessions (user_id, token_hash, expires_at) values ($1, $2, now() + interval '1 day')`,
  [adminId, hashSessionToken(token)],
);
t.check("a session row can be stored and found by token hash", (await db.query(
  `select count(*)::int as n from public.admin_sessions where token_hash = $1`,
  [hashSessionToken(token)],
)).rows[0].n === 1);

async function refused(label, statement, params) {
  try {
    await db.query(statement, params);
    t.check(`${label} is refused`, false, "the row was accepted");
  } catch (error) {
    const name = /constraint "([^"]+)"/.exec(error.message)?.[1] ?? "unknown constraint";
    t.check(`${label} is refused`, true, name);
  }
}

await refused(
  "a session hash that is not sha256 hex",
  `insert into public.admin_sessions (user_id, token_hash, expires_at) values ($1, 'not-a-hash', now() + interval '1 day')`,
  [adminId],
);
await refused(
  "a session that expires before it was created",
  `insert into public.admin_sessions (user_id, token_hash, expires_at) values ($1, $2, now() - interval '1 day')`,
  [adminId, "a".repeat(64)],
);
await refused(
  "an admin whose password_hash is not argon2id",
  `insert into public.admin_users (email, password_hash) values ('x@y.bh', 'plaintext-password')`,
);
await refused(
  "a second admin with the same address in different case",
  `insert into public.admin_users (email, password_hash) values ($1, $2)`,
  [EMAIL.toLowerCase(), "$argon2id$v=19$m=19456,t=2,p=1$aaaaaaaaaaaaaaaaaaaaaa$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
);

await db.query(`update public.admin_sessions set revoked_at = now()`);
const stillThere = await db.query(
  `select count(*)::int as n from public.admin_sessions where token_hash = $1 and revoked_at is null`,
  [hashSessionToken(token)],
);
t.check("a revoked session no longer matches an active lookup", stillThere.rows[0].n === 0);

await db.query(`delete from public.admin_users where id = $1`, [adminId]);
const orphans = await db.query(`select count(*)::int as n from public.admin_sessions`);
t.check("deleting the administrator removes their sessions", orphans.rows[0].n === 0);

// ---------------------------------------------------------------------------------------------
t.section("the seed script and the application agree");
// scripts/lib/password.mjs is plain JavaScript because the container runs it with plain node, so
// the argon parameters and the policy exist twice. This is what keeps them the same.
const seedHash = await seedPassword.hashPassword(PASSWORD);
t.check("a hash written by the seed verifies under the application's verifier", await verifyPassword(seedHash, PASSWORD));
t.check("...and rejects a wrong password there too", (await verifyPassword(seedHash, "nope")) === false);
t.check(
  "the two password policies agree on the same inputs",
  ["short", "123456789012", `${EMAIL.split("@")[0]}-is-my-password`].every(
    (sample) =>
      Boolean(seedPassword.passwordPolicyError(sample, EMAIL)) ===
      Boolean(passwordPolicyError(sample, EMAIL)),
  ),
);

// ---------------------------------------------------------------------------------------------
t.section("guest invitation tokens");
const guestTokens = new Set();
for (let i = 0; i < 200; i += 1) guestTokens.add(newGuestToken());
t.check("200 guest tokens are all distinct", guestTokens.size === 200, `${guestTokens.size} unique`);
const one = newGuestToken();
t.check("a guest token is 160 bits of base64url", one.length === 27, `${one.length} chars`);
t.check("...and satisfies the schema's length constraint", one.length >= 22 && one.length <= 128);

await db.close();
t.finish();
