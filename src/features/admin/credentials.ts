/**
 * Credential material: passwords, session tokens, guest tokens, and the pepper that keeps an IP
 * address from being stored in the clear.
 *
 * Everything here is a decision that is expensive to change later, so each one is written down.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

/**
 * argon2id at the OWASP-recommended parameters for a server: 19 MiB, 2 iterations, 1 lane.
 *
 * argon2id rather than bcrypt because ADDENDUM E offers the choice and argon2id is the better one:
 * it is memory-hard, so a GPU farm buys an attacker far less than it does against bcrypt.
 *
 * `algorithm: 2` is Argon2id. The package exports it as an ambient const enum, which a project with
 * `isolatedModules` cannot reference at all, so the value is written out and named here rather than
 * left to the library's default — an algorithm that is correct because it happens to be the
 * default is one dependency bump away from not being.
 */
const ARGON_OPTIONS = {
  algorithm: 2 as const,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON_OPTIONS);
}

/** A malformed or foreign hash is a failed verification, never an exception in a login path. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, ARGON_OPTIONS);
  } catch {
    return false;
  }
}

/**
 * A real argon2id hash of a password nobody knows, verified against when the submitted email does
 * not exist.
 *
 * Without this, an unknown email returns in a millisecond and a known one takes ~90 ms, which is a
 * free account-enumeration oracle: an attacker learns which address is the operator's before
 * guessing a single password.
 */
const TIMING_EQUALISATION_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$5b8ONuCysr/c3ZYXAmWJ7g$iyfng3TylJa0Aig69QdP/20Ln5AgUT5dqZJs5rDabnE";

export async function spendPasswordTime(password: string): Promise<void> {
  await verifyPassword(TIMING_EQUALISATION_HASH, password);
}

/** 256 bits, base64url. The raw value exists only in the cookie; the database holds its sha256. */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What is stored. Hex, so the column's shape constraint can check it. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * A guest's invitation token: 160 bits, base64url, 27 characters.
 *
 * Guessing is not a threat model here — finding one by accident is. These appear in WhatsApp
 * messages and in a URL that a guest may forward, so the requirement is that they are unguessable
 * and never derived from anything about the guest, and that is what 160 random bits gives.
 */
export function newGuestToken(): string {
  return randomBytes(20).toString("base64url");
}

/**
 * HMAC, not a bare digest: an unsalted sha256 of an IPv4 address is reversible by brute force in
 * seconds (there are only 4 billion of them), so the secret is what actually makes it a hash.
 */
export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

/** Length is the control that matters. Complexity rules push people towards `Passw0rd!`. */
export function passwordPolicyError(password: string, email: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (password.length > 200) return "Use at most 200 characters.";
  const localPart = email.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 4 && password.toLowerCase().includes(localPart)) {
    return "Do not use the email address as the password.";
  }
  return null;
}

/** Constant-time comparison, for anything that compares a secret to a stored value. */
export function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
