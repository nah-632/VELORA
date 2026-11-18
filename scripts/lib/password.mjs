/**
 * Password hashing for the seed script, in plain JavaScript on purpose.
 *
 * `scripts/seed-admin.mjs` runs inside the deployment container with plain `node`, and this Node
 * build has no TypeScript support (`--experimental-strip-types` reports ERR_NO_TYPESCRIPT here).
 * Importing `src/features/admin/credentials.ts` from a script would work on a developer's machine
 * running through tsx and fail at the one moment it matters: the first account on a live install.
 *
 * So the parameters live in two places, and that is a deliberate trade: TypeScript in the
 * application, JavaScript in the tooling. `tests/db/admin-auth.mjs` asserts that a hash produced
 * here verifies under the application's verifier — drift between the two is caught by a test rather
 * than prevented by structure, which for two constants and one call is the right size of solution.
 */
import { hash, verify } from "@node-rs/argon2";

/** Argon2id (algorithm 2), 19 MiB, 2 iterations, 1 lane. Must match src/features/admin/credentials.ts. */
export const ARGON_OPTIONS = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password) {
  return hash(password, ARGON_OPTIONS);
}

export async function verifyPassword(passwordHash, password) {
  try {
    return await verify(passwordHash, password, ARGON_OPTIONS);
  } catch {
    return false;
  }
}

/** The same policy the application enforces, so the seed cannot create a weak first password. */
export function passwordPolicyError(password, email) {
  if (password.length < 12) return "Use at least 12 characters.";
  if (password.length > 200) return "Use at most 200 characters.";
  const localPart = email.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 4 && password.toLowerCase().includes(localPart)) {
    return "Do not use the email address as the password.";
  }
  return null;
}
