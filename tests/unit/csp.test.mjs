/**
 * The Content-Security-Policy — asserted as text, because a policy is only as good as what it
 * actually allows.
 *
 * Run: npm test
 */
import test from "node:test";
import assert from "node:assert/strict";

import { buildCsp, CSP_DIRECTIVES, CSP_HEADER } from "../../src/lib/csp.ts";

const nonce = "dGVzdC1ub25jZQ==";

test("script-src carries the nonce and no inline allowance", () => {
  const csp = buildCsp(nonce);
  const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src"));
  assert.ok(scriptSrc, "script-src is present");
  assert.match(scriptSrc, new RegExp(`'nonce-${nonce}'`));
  assert.match(scriptSrc, /'strict-dynamic'/);
  assert.equal(scriptSrc.includes("'unsafe-inline'"), false, "unsafe-inline would defeat the nonce");
  assert.equal(scriptSrc.includes("'unsafe-eval'"), false, "nothing here evaluates strings");
});

test("the nonce is the only thing that changes between builds of the policy", () => {
  const a = buildCsp("nonce-a");
  const b = buildCsp("nonce-b");
  assert.notEqual(a, b);
  assert.equal(a.replace("nonce-a", "X"), b.replace("nonce-b", "X"));
});

test("the dangerous defaults are nailed shut", () => {
  const csp = buildCsp(nonce);
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /form-action 'self'/);
});

test("style-src allows inline styles, and that gap is deliberate", () => {
  // React and the invitation renderer both write inline styles. Inline *style* injection can
  // misdraw a page; it cannot read a session. Recorded rather than hidden.
  assert.equal(CSP_DIRECTIVES["style-src"].includes("'unsafe-inline'"), true);
});

test("upgrade-insecure-requests only in production", () => {
  assert.equal(buildCsp(nonce, { production: true }).includes("upgrade-insecure-requests"), true);
  assert.equal(buildCsp(nonce, { production: false }).includes("upgrade-insecure-requests"), false);
});

test("the header name is stated once", () => {
  assert.equal(CSP_HEADER, "Content-Security-Policy");
});
