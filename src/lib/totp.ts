/**
 * TOTP — RFC 6238, built on node:crypto, no dependency.
 *
 * The algorithm is thirty lines and it is the kind of thirty lines that is either exactly right or
 * quietly wrong, so it is verified against the RFC's own test vectors in
 * `tests/unit/totp.test.mjs` rather than against itself.
 *
 * Two decisions worth stating:
 *
 *   - **A window of ±1 step.** Phone clocks drift, and a code rejected because the operator's phone
 *     is 40 seconds ahead is indistinguishable from a broken feature. One step either side accepts
 *     the reality without meaningfully widening the guess space (3 codes out of 1,000,000 at any
 *     moment, for 30 seconds at a time).
 *   - **Comparison is constant-time.** A six-digit code compared with `===` leaks, through timing,
 *     how many leading digits were right. That is a small leak and a free fix.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/=+$/, "").replace(/[\s-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Not a base32 secret.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** A 160-bit secret, base32 — what every authenticator app expects. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: string, counter: number, digits = 6): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function totp(secret: string, atSeconds: number, options: { digits?: number; step?: number } = {}): string {
  const step = options.step ?? 30;
  return hotp(secret, Math.floor(atSeconds / step), options.digits ?? 6);
}

/**
 * Verifies a code, allowing one step of clock drift in each direction.
 *
 * `usedCounters`, when supplied, refuses a counter that has already been accepted for this account:
 * without it, a code stays valid for its whole 30-second window, so one observed over a shoulder is
 * replayable for the rest of it.
 */
export function verifyTotp(
  secret: string,
  code: string,
  options: { now?: number; window?: number; digits?: number; step?: number; lastUsedCounter?: number | null } = {},
): { ok: boolean; counter?: number } {
  const step = options.step ?? 30;
  const digits = options.digits ?? 6;
  const window = options.window ?? 1;
  const now = options.now ?? Math.floor(Date.now() / 1000);

  const submitted = (code ?? "").replace(/\D/g, "");
  if (submitted.length !== digits) return { ok: false };

  const current = Math.floor(now / step);
  let matched: number | null = null;
  for (let offset = -window; offset <= window; offset += 1) {
    const counter = current + offset;
    if (counter < 0) continue;
    const expected = hotp(secret, counter, digits);
    const a = Buffer.from(submitted);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      matched = counter;
      break;
    }
  }

  if (matched === null) return { ok: false };
  if (options.lastUsedCounter != null && matched <= options.lastUsedCounter) return { ok: false };
  return { ok: true, counter: matched };
}

export function otpauthUri(input: { secret: string; account: string; issuer?: string }): string {
  const issuer = input.issuer ?? "VELORA";
  const label = encodeURIComponent(`${issuer}:${input.account}`);
  const params = new URLSearchParams({
    secret: input.secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
