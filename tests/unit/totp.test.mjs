/**
 * TOTP, checked against the RFC's own test vectors.
 *
 * RFC 6238 Appendix B publishes the expected codes for a known secret and a set of timestamps. Any
 * implementation can agree with itself; agreeing with the RFC is the only thing that matters,
 * because the other side of this protocol is whichever authenticator app the operator happens to
 * have installed — and none of them is going to be lenient about a wrong HMAC.
 *
 * Run: npm test
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  otpauthUri,
  totp,
  verifyTotp,
} from "../../src/lib/totp.ts";

/** RFC 6238 uses the ASCII secret "12345678901234567890". */
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));

test("base32 round-trips, and matches the RFC's own secret", () => {
  assert.equal(RFC_SECRET, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.equal(base32Decode(RFC_SECRET).toString("ascii"), "12345678901234567890");
  // Padding and lowercase are what a human pasting a secret produces.
  assert.equal(base32Decode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ====")?.length, 20);
  assert.throws(() => base32Decode("not-base32-!!"), /base32/);
});

test("RFC 6238 Appendix B — every published vector", () => {
  // No type annotation: this file is .mjs, and Node parses it as plain JavaScript.
  const vectors = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];
  for (const [at, expected] of vectors) {
    assert.equal(totp(RFC_SECRET, at, { digits: 8 }), expected, `T=${at}`);
  }
});

test("six digits is the same code, truncated — which is what authenticator apps show", () => {
  assert.equal(totp(RFC_SECRET, 59), "287082");
  assert.equal(hotp(RFC_SECRET, 1, 6), "287082");
});

test("a code is accepted for the step it belongs to, and for one step of drift either side", () => {
  const at = 1_700_000_000;
  const code = totp(RFC_SECRET, at);
  assert.equal(verifyTotp(RFC_SECRET, code, { now: at }).ok, true);
  // 25 seconds later the same code is still inside its own 30-second window.
  assert.equal(verifyTotp(RFC_SECRET, code, { now: at + 25 }).ok, true);
  // A phone 30 seconds behind or ahead still works — one step of tolerance, not more.
  assert.equal(verifyTotp(RFC_SECRET, code, { now: at - 30 }).ok, true);
  assert.equal(verifyTotp(RFC_SECRET, code, { now: at + 30 }).ok, true);
  // Two steps away is a different code, and this one is not it.
  assert.equal(verifyTotp(RFC_SECRET, code, { now: at + 90 }).ok, false);
});

test("what must be refused", () => {
  const at = 1_700_000_000;
  const code = totp(RFC_SECRET, at);
  assert.equal(verifyTotp(RFC_SECRET, code, { now: at, window: 0, lastUsedCounter: Math.floor(at / 30) }).ok, false, "a replayed code");
  assert.equal(verifyTotp(RFC_SECRET, "12345", { now: at }).ok, false, "five digits");
  assert.equal(verifyTotp(RFC_SECRET, "1234567", { now: at }).ok, false, "seven digits");
  assert.equal(verifyTotp(RFC_SECRET, "", { now: at }).ok, false, "empty");
  assert.equal(verifyTotp(RFC_SECRET, "abcdef", { now: at }).ok, false, "letters");
  // Digits are stripped first: an operator typing "123 456" or "123-456" is typing a code.
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  assert.equal(verifyTotp(RFC_SECRET, spaced, { now: at }).ok, true);
  // A different secret must not accept this code.
  assert.equal(verifyTotp(generateTotpSecret(), code, { now: at }).ok, false);
});

test("a replayed code is refused when its counter is remembered", () => {
  const at = 1_700_000_000;
  const code = totp(RFC_SECRET, at);
  const first = verifyTotp(RFC_SECRET, code, { now: at });
  assert.equal(first.ok, true);
  const replay = verifyTotp(RFC_SECRET, code, { now: at + 5, lastUsedCounter: first.counter ?? null });
  assert.equal(replay.ok, false, "the same code, twice, inside its window");
});

test("a generated secret is 160 bits of base32 and never repeats", () => {
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) seen.add(generateTotpSecret());
  assert.equal(seen.size, 200);
  const one = generateTotpSecret();
  assert.equal(one.length, 32, `${one.length} characters`);
  assert.match(one, /^[A-Z2-7]{32}$/);
  assert.equal(base32Decode(one).length, 20);
});

test("the enrolment URI is what an authenticator app expects", () => {
  const uri = otpauthUri({ secret: RFC_SECRET, account: "operator@velora.bh" });
  assert.match(uri, /^otpauth:\/\/totp\/VELORA%3Aoperator%40velora\.bh\?/);
  assert.match(uri, /secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ/);
  assert.match(uri, /algorithm=SHA1/);
  assert.match(uri, /digits=6/);
  assert.match(uri, /period=30/);
});
