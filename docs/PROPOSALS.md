# PROPOSALS.md — changes that need the owner's decision

Nothing in this file is approved, built, or in progress. A proposal becomes a decision only when the
owner says so; until then the code does not contain it, and it must not be referenced as if it did.
Every entry names what it would touch, because "small change" is a claim, not a description.

---

## P1 — `?open=1` on `/i/<token>`: an addressable opened state

**Status: PROPOSED — not approved. Raised 2026-11-21 from the reference study; the owner has stated
the constraints it must satisfy if it is ever approved, and they are recorded below as binding.**

### Why it is on the table

ChungDoi's invitation is opened by an `<a href="?open=1">`, so the opened state is a URL
(`chungdoi.com/templates/qasr-gold/demo?open=1`, verified; the document goes 844px → 7001px). Every
one of Velora's sealed-state verifications — C1, C3, C5, D, E — currently has to drive the seal
first, in a browser, against a deployment. An addressable opened state would let the same page be
photographed, diffed and measured without the animation, and let a support conversation start from
the exact thing the guest is looking at.

### The constraints, as given by the owner

1. **Preview and accessibility use only.** Not a guest-facing shortcut, not a share link.
2. **It must not count as a host-visible open.** `open_count` and `first_opened_at` must not move.
3. **It must not become the default path.** The real envelope stays what a guest gets from a normal
   link; `?open=1` is the exception, and must never be the URL anybody is sent.
4. **The opening must still be tested without it.** C6's three tap cases and D4's tap→revealed
   measurement are not allowed to migrate onto the flag. A harness that only ever exercises
   `?open=1` would leave the actual entrance unverified, which is the failure this proposal is
   meant to reduce.

### What it would touch — checked against the code, not assumed

| File | Change | Why |
|---|---|---|
| `src/app/i/[token]/page.tsx` | read the search param; render `WaxSeal` with `phase` starting at `open`; pass `recordOpen: false` | the only place that decides the entrance's initial phase |
| `src/features/invitations/public.ts` | **no change** | `loadInvitation` already takes `options.recordOpen`, documented as "true for the page and false for everything else. The calendar file and the [other non-page consumers] pass false". The mechanism for constraint 2 already exists and is already exercised by `/i/<token>/calendar.ics` |
| `src/features/invitations/rsvp.ts` | **no change** | the RSVP write path does not read the entrance's phase, the search params, or `open_count`. Confirmed by inspection of the file's exports and the route's call sites |
| `src/app/i/[token]/layout.tsx` | **no change** | `robots`, `noindex`, `no-store` and `X-Robots-Tag` are properties of the route, not of the entrance |
| middleware | **no change** | the `i/` exclusion that keeps the route out of the locale tree is unrelated to the query string |

### What it would and would not change about the public route's behaviour

- **Would change:** one request's *rendering* — the entrance starts at `open` instead of `sealed` —
  and it deliberately suppresses the one write the page is entitled to make.
- **Would not change:** the response's cache and indexing headers, the 404 behaviour for an unknown
  or expired token, the RSVP action, the `.ics` route, rate limiting, or anything a guest who never
  sends `?open=1` experiences.
- **Cannot be claimed as zero-risk without doing it.** The honest statement is that it is confined to
  one file and one already-existing option, and that the verification would be: the same token
  fetched with and without the flag, asserting `open_count` unchanged, `first_opened_at` null, and
  the sealed path still the default — plus C6 and D4 re-run **without** the flag.

### If approved, the acceptance tests

```
1. GET /i/<token>            → entrance starts sealed; open_count advances by 1
2. GET /i/<token>?open=1     → entrance starts open;  open_count unchanged, first_opened_at unchanged
3. GET /i/<token>?open=1     → headers identical to (1): noindex, no-store, X-Robots-Tag
4. POST the RSVP action      → accepted from either URL; cap still taken from the guest's row
5. C6's three tap cases      → run WITHOUT the flag, in a real browser
6. D4 tap→revealed           → measured WITHOUT the flag
```

Test 1 is the one that catches the obvious mistake: a preview flag that quietly counts as an open
would corrupt the operator's only engagement signal, and it would do it silently.
