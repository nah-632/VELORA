# INVITATION-QUALITY.md — the bar for the rebuilt public invitation

**Status:** ACTIVE, written before any of the new UI exists. The bar does not move to meet the work.
If a row turns out to be unachievable, it is reported as unmet **with evidence** — not reworded until
it passes.

**Scope.** The public invitation only: route `/i/<token>` and its visual layer. The admin console,
auth, schema, migrations, rate limiting, CSP, import, dashboard, export, sending queue and settings are
out of scope and are only touched if a row below cannot be met without a small additive change — and
any such change is listed, not assumed.

**How to read a row.** Every criterion names the **proof**: a command, a measurement, a computed
value, or a screenshot. "Looks right" and "the code says so" are not proofs. A row without its proof
recorded is **UNVERIFIED**, not passed.

| Legend | Meaning |
|---|---|
| ✅ | proved, and the proof is recorded in the report |
| 🟡 | partially proved — the gap is stated |
| ⛔ | unmet, with the measured reason |
| ⬜ | not yet run |

---

## A. Preserved behaviour — regression, re-tested against the new UI

These already work. The rebuild must not break them, so each is re-run and its result recorded. They
are not re-implemented unless a test fails.

| # | Criterion | Proof |
|---|---|---|
| A1 | Guest token resolves to exactly one invitation; an unknown token is a `not-found`, not a crash | `npm run test:db:invitations` |
| A2 | The **first open is recorded once per request** — the layout and the page share one cached loader, so a render cannot double-count | same suite; plus a count read before/after one page load |
| A3 | **RSVP is not an open.** Submitting an RSVP must not change `open_count` | same suite; the RSVP action is exercised and the count re-read |
| A4 | RSVP companion cap comes from **that guest's row**; declining forces 0 | same suite |
| A5 | Per-guest hall resolution: `women` / `men` / `both`, and the copy variables `{venue_name_for_guest}`, `{venue_map_url_for_guest}` resolve to the guest's own hall | `npm run test:db:invitations` + the message tests |
| A6 | Warm copy templates with gender inflection, and the operator's personal line, render verbatim | the copy tests; plus one AR and one EN screenshot showing the personal line |
| A7 | `.ics` uses `zonedToUtc`, CRLF, 75-octet folding that never splits a UTF-8 sequence, leaves the **Arabic comma** unescaped, and carries the per-guest venue | the invitation suite; plus the generated file fetched and parsed |
| A8 | The Google Calendar link carries the same instant as the `.ics` | same suite (parity assertion) |
| A9 | `/i/` is `noindex` (header + meta + robots.txt) and `no-store` | `curl -sI` on a live token, headers printed |
| A10 | Public routes are rate limited | the security suite |
| A11 | AR/EN switch changes language **without moving anything** | two screenshots at the same scroll position; element rects compared |

## B. The entrance — rebuilt, one self-contained component

| # | Criterion | Proof |
|---|---|---|
| B1 | The entrance is one self-contained component in its own files; **no class, SVG or rule from the old layers survives** | `rg` for every old class name in `src/` returns nothing |
| B2 | The control is a real `<button>`, hit area ≥ 72×72 CSS px, and it is the **topmost hit target** | `document.elementFromPoint` at the seal centre returns the button or its descendant; and a **real click** at that point opens |
| B3 | A tap **anywhere on the envelope** opens — the button covers the envelope | click at four corners and the centre; each opens |
| B4 | Enter and Space activate it | keyboard events at 375px |
| B5 | The handler is **idempotent**: double tap, rapid taps and a tap during the animation each end in one open, never two | four sequences run, phase read after each |
| B6 | A **2.5s failsafe** forces the invitation open if the sequence stalls | the timer is disabled in a probe, and the invitation is still visible at 2.5s |
| B7 | The brand mark fills **55–60% of the inner disc, measured in a real browser at 92px** | mark bounding box ÷ inner-disc diameter, printed |
| B8 | The mark's path data is the original's, **unchanged** | byte comparison against `public/brand/monogram.svg` |
| B9 | Wax: organic lobed edge with soft drips, raised rim, recessed centre, one specular highlight, contact shadow, grain | screenshot at 2×, and the elements counted in the DOM |
| B10 | The whole sequence is **about 2s**, and only `transform` and `opacity` animate | the timing table in DESIGN.md §5, and a grep of the entrance stylesheet for animated layout properties = 0 |
| B11 | `prefers-reduced-motion` gives a **300ms cross-fade**, not a shortened sequence | two screenshots (motion on/off) and the computed `animation-name: none` |
| B12 | The invitation content is in the DOM **underneath** the entrance — JS off, screen reader and crawler all get it | view-source of a live token contains the names and the venue; and a no-JS render |

## C. The page composition

| # | Criterion | Proof |
|---|---|---|
| C1 | The names sit **inside a true horseshoe (mihrab) arch** — nothing crosses either stroke | the names' bounding box against the arch's inner path box, plus a 2× crop |
| C2 | Names are **44–52px at 375px**, in Aref Ruqaa, computed — not merely declared | `getComputedStyle` on the names block; `document.fonts.check` |
| C3 | Background is a single ivory with a visible but subtle khatam tessellation in the **6–8%** range | computed opacity of the khatam layer |
| C4 | **No visible content box** — no card edge, shadow or border behind the content | computed `background-color: rgba(0,0,0,0)` + screenshot inspection |
| C5 | Larger muqarnas corners; zellige strips between sections | DOM count = 2 corners; strips counted |
| C6 | Each element's computed `font-family` matches its role: names Aref Ruqaa, verse Amiri, labels Reem Kufi, body Noto Naskh Arabic; EN Cormorant Garamond and Cinzel | a table of element → computed family |
| C7 | Body text is **≥18px with line-height ≥1.9** | computed values per body element |
| C8 | Gold is never text colour except through the foil ramp | every gold text element's computed colour is a ramp stop, not `#B8913A` |

## D. Movement and stability

| # | Criterion | Proof |
|---|---|---|
| D1 | **CLS 0** across: load, the countdown ticking, the venue dialog opening and closing, and the entrance being removed | a `layout-shift` observer on a 4× throttled profile, total to 5 dp |
| D2 | Countdown cells keep **identical boxes** across ≥60 ticks | wrapper + 4 cells, max delta ≤ 0.5px |
| D3 | Tap-to-response on a throttled mobile profile | measured ms, reported |
| D4 | Long frames during the opening | count and max duration, reported |
| D5 | No horizontal overflow at 320 / 375 / 390 / 430 | `scrollWidth <= clientWidth` at each width |

## E. Bilingual and accessible

| # | Criterion | Proof |
|---|---|---|
| E1 | Every state captured at 375px **in AR and EN**: sealed, pressed, half-open, card emerging, revealed | 10 screenshots |
| E2 | While sealed, the only focus targets are the instruction text and the button | a tab walk, listing `document.activeElement` at each stop |
| E3 | The card's content is **not focusable before open** | the same walk — no stop lands inside the card |
| E4 | The invitation is reachable by a screen reader without watching the sequence | an accessibility-tree read before and after open |

## F. Evidence discipline

| # | Criterion | Proof |
|---|---|---|
| F1 | Every row above carries its proof, actually run | the report names the command or the measurement |
| F2 | Screenshots are at 375px, in AR and EN, with the **real fonts loaded** | the page reports `document.fonts.status` and the loaded family list |
| F3 | Anything not run is named as not run — `next build`, `verify`, `test:browser`, a physical device | a list, not a silence |
| F4 | Nothing is called done because it renders; it is done when its row is ✅ | this table |
