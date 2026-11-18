/**
 * The Content-Security-Policy.
 *
 * Built in one place and tested, rather than assembled inline in the middleware where the only way
 * to know what it says is to read the header off a live response.
 *
 * What this policy is for: the operator console holds guests' phone numbers and a login that can
 * send 50 messages. An injected inline script there is not a cosmetic problem. `script-src` with a
 * per-request nonce and `strict-dynamic` means only scripts this server put on the page — and the
 * scripts those load — may run, and a `<script>` an attacker manages to inject may not.
 *
 * What it deliberately does **not** constrain, and why:
 *
 *   - **`style-src 'unsafe-inline'`.** React writes inline styles (and so does the invitation
 *     renderer, which positions blocks with a design document). Inline *style* injection is a far
 *     smaller problem than inline script — it can misdraw a page, not read a token — and tightening
 *     it would mean auditing every `style=` in the tree. Recorded as a real gap rather than
 *     pretended away.
 *   - **No `upgrade-insecure-requests` outside production**, so a local http origin still works.
 *
 * `frame-ancestors 'none'` in the policy and `X-Frame-Options: DENY` in next.config are the same
 * control twice, which is the point: they are enforced by different layers.
 */

export const CSP_DIRECTIVES = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "form-action": ["'self'"],
  "img-src": ["'self'", "data:", "blob:"],
  "font-src": ["'self'"],
  "connect-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
} as const;

export function buildCsp(nonce: string, options: { production?: boolean } = {}): string {
  const directives: string[] = [];

  for (const [name, values] of Object.entries(CSP_DIRECTIVES)) {
    directives.push(`${name} ${values.join(" ")}`);
  }

  // The nonce and `strict-dynamic`. With `strict-dynamic`, a host allowlist in script-src is
  // ignored by modern browsers, so listing one would be a false sense of specificity.
  directives.push(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
  // `'unsafe-eval'` appears nowhere: nothing in this app evaluates strings, and a policy that
  // permits it is a policy that permits a whole class of injected code.

  if (options.production) directives.push("upgrade-insecure-requests");

  return directives.join("; ");
}

/** The header name, so the middleware and the tests cannot disagree about it. */
export const CSP_HEADER = "Content-Security-Policy";
