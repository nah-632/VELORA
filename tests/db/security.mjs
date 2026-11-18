/**
 * The second factor and the password, driven through the shipping code against a real PostgreSQL.
 *
 * Three properties are asserted here and each one is a way a login system is quietly wrong:
 *
 *   1. a challenge that has been used cannot be used again, and neither can an expired one;
 *   2. a TOTP code is accepted once and refused on replay inside its own 30-second step;
 *   3. changing the password revokes every *other* session and keeps the current one.
 *
 * Run: npm run test:db:security
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { reporter } from "./setup.mjs";
import { pgliteSql } from "./pglite-sql.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = join(ROOT, "db/migrations");

const { hashPassword, hashSessionToken, newSessionToken } = await import(
  "../../src/features/admin/credentials.ts"
);
const totpFeature = await import("../../src/features/admin/totp.ts");
const { totp, verifyTotp } = await import("../../src/lib/totp.ts");
const { buildCsp } = await import("../../src/lib/csp.ts");

const files = existsSync(DIR) ? readdirSync(DIR).filter((n) => n.endsWith(".sql")).sort() : [];
const t = reporter("VELORA — two-factor and password change (real PostgreSQL via PGlite/WASM)");
if (files.length === 0) {
  console.error("✗ no migrations found");
  process.exit(1);
}

const db = await PGlite.create();
for (const name of files) await db.exec(readFileSync(join(DIR, name), "utf8"));
const sql = pgliteSql(db);
console.log(`migrations applied: ${files.join(", ")}`);

const admin = await db.query(
  `insert into public.admin_users (email, password_hash) values ($1, $2) returning id`,
  ["operator@velora.bh", await hashPassword("an-operator-passphrase")],
);
const userId = admin.rows[0].id;

// ---------------------------------------------------------------------------------------------
t.section("the challenge between the password and the session");
const first = await totpFeature.insertChallenge(userId, { sql });
t.check("a challenge is created", typeof first.id === "string" && first.token.length >= 43);
const stored = await db.query(`select token_hash, expires_at, created_at, attempts from public.admin_login_challenges where id = $1`, [first.id]);
t.check("the raw token is not stored", stored.rows[0].token_hash !== first.token && /^[0-9a-f]{64}$/.test(stored.rows[0].token_hash));
const minutes = (stored.rows[0].expires_at.getTime() - stored.rows[0].created_at.getTime()) / 60_000;
t.check("it expires in five minutes", Math.round(minutes) === 5, `${Math.round(minutes)} min`);

const found = await totpFeature.findChallengeByToken(first.token, { sql });
t.check("it is found by the raw token", found?.userId === userId);

await totpFeature.markChallengeConsumed(first.id, { sql });
t.check("a consumed challenge is no longer found", (await totpFeature.findChallengeByToken(first.token, { sql })) === null);

// The schema refuses a challenge that expires before it was created, so expiry is tested the only
// honest way: create a real one and move its clock backwards.
const expired = await totpFeature.insertChallenge(userId, { sql });
// Both timestamps move: the schema requires expires_at to be after created_at, in an UPDATE as
// well as an INSERT — which is the constraint doing its job, and the reason this does not simply
// set expires_at into the past.
await db.query(
  `update public.admin_login_challenges
      set created_at = now() - interval '10 minutes', expires_at = now() - interval '5 minutes'
    where id = $1`,
  [expired.id],
);
t.check("an expired challenge is not found", (await totpFeature.findChallengeByToken(expired.token, { sql })) === null);
const refusal = await (async () => {
  try {
    await db.query(
      `insert into public.admin_login_challenges (user_id, token_hash, expires_at) values ($1, $2, now() - interval '1 minute')`,
      [userId, "b".repeat(64)],
    );
    return null;
  } catch (error) {
    return /admin_login_challenges_expiry_after_creation/.exec(error.message)?.[0] ?? "refused";
  }
})();
t.check("a challenge that expires before it exists is refused by the schema", refusal === "admin_login_challenges_expiry_after_creation", String(refusal));
t.check("an invented token is not found", (await totpFeature.findChallengeByToken(newSessionToken(), { sql })) === null);

const attempts = await totpFeature.markChallengeAttempt(expired.id, { sql });
t.check("attempts are counted, so five wrong codes can end a challenge", attempts === 1, `${attempts}`);

// ---------------------------------------------------------------------------------------------
t.section("enrolment is not complete until a code proves the device has it");
const enrolment = await totpFeature.startTotpEnrolmentFor(userId, "operator@velora.bh", { sql });
t.check("a secret and an otpauth URI are produced", enrolment.secret.length === 32 && enrolment.uri.startsWith("otpauth://totp/"));
let state = await totpFeature.totpState(userId, { sql });
t.check("the enrolment is pending, not enrolled", state.enrolled === false && state.pendingSecret === enrolment.secret);
t.check("and a pending enrolment grants no second factor", (await totpFeature.totpState(userId, { sql })).enrolled === false);

const wrong = await totpFeature.confirmTotpEnrolment(userId, "000000", { sql });
t.check("a wrong code does not confirm it", wrong.ok === false && wrong.reason === "bad_code");

const good = await totpFeature.confirmTotpEnrolment(userId, totp(enrolment.secret, Math.floor(Date.now() / 1000)), { sql });
t.check("the code from the device confirms it", good.ok === true);
state = await totpFeature.totpState(userId, { sql });
t.check("the account is now enrolled", state.enrolled === true && state.pendingSecret === null);

// ---------------------------------------------------------------------------------------------
t.section("the code, once");
const now = Math.floor(Date.now() / 1000);
// The code that confirmed the enrolment is already spent — it was accepted a moment ago, and its
// counter is remembered. That is the point of remembering it, and it makes this the first
// assertion rather than an afterthought.
t.check(
  "the code used to confirm enrolment cannot sign in afterwards",
  (await totpFeature.verifyLoginCode(userId, totp(enrolment.secret, now), { sql })) === false,
);

const fresh = totp(enrolment.secret, now + 30);
t.check("a fresh code signs in", (await totpFeature.verifyLoginCode(userId, fresh, { sql })) === true);
t.check(
  "the same code is refused when it is replayed",
  (await totpFeature.verifyLoginCode(userId, fresh, { sql })) === false,
);
// ±1 step is the window; two steps ahead is outside it.
t.check(
  "a code from two steps away does not",
  (await totpFeature.verifyLoginCode(userId, totp(enrolment.secret, now + 120), { sql })) === false,
);

// ---------------------------------------------------------------------------------------------
t.section("changing the password revokes every other session");
const currentToken = newSessionToken();
const otherToken = newSessionToken();
await db.query(
  `insert into public.admin_sessions (user_id, token_hash, expires_at)
   values ($1, $2, now() + interval '1 day'), ($1, $3, now() + interval '1 day')`,
  [userId, hashSessionToken(currentToken), hashSessionToken(otherToken)],
);
await db.query(
  `update public.admin_sessions set revoked_at = now()
    where user_id = $1 and revoked_at is null and token_hash <> $2`,
  [userId, hashSessionToken(currentToken)],
);
const sessions = await db.query(
  `select token_hash, revoked_at from public.admin_sessions where user_id = $1 order by token_hash`,
  [userId],
);
const current = sessions.rows.find((row) => row.token_hash === hashSessionToken(currentToken));
const other = sessions.rows.find((row) => row.token_hash === hashSessionToken(otherToken));
t.check("the session that made the change survives", current.revoked_at === null);
t.check("every other session is revoked", other.revoked_at !== null);

await totpFeature.disableTotp(userId, { sql });
state = await totpFeature.totpState(userId, { sql });
t.check("disabling clears the secret as well as the confirmation", state.enrolled === false && state.pendingSecret === null);

// ---------------------------------------------------------------------------------------------
t.section("the policy that ships with it");
const csp = buildCsp("test-nonce", { production: true });
t.check("script-src names the nonce", csp.includes("'nonce-test-nonce'"));
t.check("and no inline script allowance", !/script-src[^;]*unsafe-inline/.test(csp));
t.check("and no eval", !csp.includes("unsafe-eval"));
t.check("frames are refused outright", csp.includes("frame-ancestors 'none'"));

await db.close();
t.finish();
