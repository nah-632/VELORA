/**
 * Create the one administrator, from environment variables.
 *
 * ADDENDUM E: "The initial admin credentials come from environment variables on first seed; no
 * public sign-up." So this is the only way an account is born — there is no route, no form and no
 * invite link that can create one.
 *
 *   ADMIN_EMAIL=operator@example.com ADMIN_PASSWORD='…' node scripts/seed-admin.mjs
 *
 * Properties worth stating:
 *   - idempotent: run it twice and the second run says so instead of creating a second account.
 *     Two administrators would quietly break "single operator" everywhere it is assumed;
 *   - the password is checked against the same policy the settings screen will use;
 *   - `--reset` is the password-rotation path, and it is the documented way to recover from a lost
 *     password: it replaces the hash and revokes every live session;
 *   - it prints the account, never the password, and never the hash.
 *
 * On CranL this runs inside the container, which is the only place that can reach the database:
 *   run_command --command "ADMIN_EMAIL=… ADMIN_PASSWORD=… node scripts/seed-admin.mjs"
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { hashPassword, passwordPolicyError } from "../src/features/admin/credentials.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** .env.local is read here rather than imported, so the seed never depends on Next's loader. */
function loadLocalEnv() {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

loadLocalEnv();

const reset = process.argv.includes("--reset");
const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Nothing was created.");
  process.exit(1);
}
if (!email || !password) {
  console.error(
    "ADMIN_EMAIL and ADMIN_PASSWORD must both be set.\n" +
      "Example: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a long passphrase' node scripts/seed-admin.mjs",
  );
  process.exit(1);
}
const policyError = passwordPolicyError(password, email);
if (policyError) {
  console.error(`${policyError} Nothing was created.`);
  process.exit(1);
}

const { default: postgres } = await import("postgres");
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

try {
  const existing = await sql`select id, email from public.admin_users limit 2`;

  if (existing.length > 0 && !reset) {
    console.log(
      `An administrator already exists (${existing[0].email}). Nothing was created.\n` +
        "To rotate the password: re-run with --reset.",
    );
    process.exit(0);
  }

  const hash = await hashPassword(password);

  if (existing.length > 0) {
    await sql`
      update public.admin_users
         set email = ${email},
             password_hash = ${hash},
             password_changed_at = now(),
             failed_attempts = 0,
             locked_until = null
       where id = ${existing[0].id}`;
    const revoked = await sql`
      update public.admin_sessions set revoked_at = now()
       where user_id = ${existing[0].id} and revoked_at is null returning id`;
    console.log(
      `Password rotated for ${email}. ${revoked.length} live session(s) revoked — sign in again.`,
    );
  } else {
    await sql`
      insert into public.admin_users (email, password_hash)
      values (${email}, ${hash})`;
    console.log(`Created the administrator ${email}. Password not shown, by design.`);
  }
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
