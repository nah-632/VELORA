# tools/shots — the measuring instruments for the entrance

These are the scripts every layer's evidence comes from. They live in the repository because the
Codespace erases `/tmp` when it restarts, and a lost instrument is a day of re-deriving numbers.

| File | What it does |
|---|---|
| `run.sh` | Clean `.next`, start the dev server, warm the route, run a measurement and a shoot |
| `shoot-entrance.mjs` | 375×812 at dpr 2, AR and EN, sealed and lining frames, plus the geometry each one reports |
| `measure-gold.mjs` | The fold diagonals measured **from the DOM** — `getPointAtLength` + `getScreenCTM`, the stroke as computed, the apex and edge positions as a percentage of the envelope |

## The two rules that keep these honest

1. **`rm -rf .next` before every `next dev`.** `next build` writes `.next` for production; `next dev`
   reuses the same directory and then fails every request with `ENOENT .../vendor-chunks/*.js`. Never
   run both against one `.next`.
2. **Never point these at production.** They shoot `http://localhost:3210` against the local
   PostgreSQL, using a guest token seeded for the purpose. Production is verified separately, in a
   browser, by a person.

`measure-gold.mjs` hides `.seal__disc` with an injected stylesheet — **test-only**. The old tan wax
seal sits in the same lower half as the fold and any colour mask that finds the gold also finds it.
The injected rule exists inside the measurement and is never committed to the stylesheet.