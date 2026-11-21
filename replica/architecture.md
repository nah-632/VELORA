# Architecture plan — four features from the reference study

Produced by `/replica-architect`, 2026-11-21. Input: `replica/recon.md` (parked study) and
`replica/features.csv`, **restricted to the features that do not touch guest data**.

**This is a plan, not code.** No migration, no component, no route is written by this document. Where
a change is named as a file, the file is named so it can be reviewed before anyone edits it.

Companion documents: `docs/ARCHITECTURE.md` (the system as it is), `docs/PROPOSALS.md` (P1, unapproved),
`tasks/todo.md` (the phase list), `DESIGN.md` (the design system).

---

## 1. Scope

### In

| # | Feature | Recon reference | Guest data? |
|---|---|---|---|
| F1 | Ambient music with an explicit control | ChungDoi (paused track + ♪ button), Invyt ("music never autoplays"), Wedding Story (13 tracks at volume 0.25) | **no** — event-level setting |
| F2 | Timeline / programme of the day | ChungDoi (17:30→00:00 list), Invifest ("every function with its date, time, venue and map") | **no** — event-level content |
| F3 | After-event page on the same link | Invity ("automatic thank-you note displayed after the event date") | **read-only** — renders already-stored event data |
| F4 | Arabic face loading strategy | Koroty (Readex Pro + El Messiri) vs Wedding Story (Arabic in Latin-only faces) | **no** |

### Out — needs a DB/policy decision, not designed here

| Feature | What it would touch |
|---|---|
| Wishes wall / guestbook | a new relation for guest-authored content; an **unauthenticated write** (the token is the only credential); a read path where one guest's words are shown to every other guest; operator moderation/removal; retention. **The first surface in this product where guests read each other** |
| QR entry pass + check-in | a second per-guest credential (unguessable, revocable); a check-in record with timestamp + actor; an operator surface that must work at a door, possibly offline; a decision about what the scanner may see, since the scanner is not the host |
| Per-guest personal font | a per-guest style preference; collides first with the **fixed type scale** (DESIGN.md §6, names 44–52px, Aref Ruqaa display-only below ~24px per the 2.3 legibility test) and only second with the database. No reference product implements it — recon §2 |
| **Per-guest personal line** | **already built.** `guests.personal_line_ar` / `_en`, read by the token route and rendered under the greeting (T1 E2). Nothing to decide. It is in this table only because the brief groups it with the others |
| Excel/CSV export of the guest list | an export writer; **who may download it**; the fact that the export is a copy of guest data that leaves the system's control (retention, and no per-guest consent is collected for it) |
| WhatsApp reminders | a sender (or a per-guest `wa.me` link queue); per-guest send state; rate limits; and the WhatsApp Business policy question, which is a policy decision before it is a technical one |

### Invariants — unchanged by every feature in this plan

Verified by `git diff --stat` at each stop gate; a change to any of these files fails the gate.

| File | What it holds |
|---|---|
| `src/features/invitations/rsvp.ts` | RSVP logic (cap from the guest's row, decline forces 0) |
| `src/features/invitations/actions.ts` | the RSVP server action |
| `src/features/events/actions.ts` | the **token minter** — `random: () => randomBytes(8).toString("hex")` (line 40) |
| `src/lib/totp.ts` | admin auth (`src/lib/csp.ts` and `src/middleware.ts` likewise) |
| the `.ics` route and `/api/health` | non-page consumers of the same data |

**Public routes.** F1 and F2 add markup to `/i/<token>`; F3 adds a *render branch* to it. No feature
changes a route's contract: the same URL, the same handlers, the same search parameters, no new
public route. F3 is called out separately in §4 because "renders something different" is still a
change a guest can see, and the owner should say yes to it explicitly.

---

## 2. What already exists — checked, because three of my assumptions were wrong

Read out of the code on 2026-11-21. This is the section that changes the size of the job.

| Feature | Already built | Evidence |
|---|---|---|
| **F2 timeline** | **almost all of it.** `events.schedule jsonb not null default '[]'`, `ScheduleSchema` (max 20 items × `time`, `title_ar/en`, `detail_ar/en`), `ScheduleEditor.tsx`, `form-fields.ts`, copy keys, and the route renders the list with an audience filter | `db/migrations/0006_event_details.sql:24`, `src/features/events/schema.ts:38-46`, `src/app/i/[token]/page.tsx:125-135`, `:323-353` |
| **F4 fonts** | **the strategy, already implemented.** `unicode-range` on **12** declarations in `fonts.css`; `rel="preload"` in `src/app/[locale]/layout.tsx` (whose comment already states the rule); subsets built by `pyftsubset --unicodes=` with `--layout-features='*'`; `font-display` 4× `block` / 7× `swap`; `npm run test:fonts` asserts joining features survive | `src/styles/fonts.css`, `src/app/[locale]/layout.tsx:24,76`, `scripts/fonts.py:267-277` |
| **F3 after-event** | the **copy** exists (`countdownFinished: "The celebration has passed — thank you for being part of it."`) and nothing else: no end date on an event, no branch on the route | `src/features/invitations/copy.ts:120`; `db/migrations/0001_operator_baseline.sql:67` has `event_datetime` and **no** end column; `page.tsx` uses a date only for the countdown (`:174`) |
| **F1 music** | **nothing.** `rg 'audio\|music'` across `src/`, `db/migrations/` and `public/` returns **zero** matches | — |

**Corrected, and worth recording because I nearly planned against it:** I expected the schedule's
`relevant` filter to drop rows by time (which would have hidden a Gulf post-midnight row), and I
expected the Arabic faces to be fetched on the English page and the subsets to be built from a fixed
corpus (which would have risked tofu on an unusual guest name). All three were wrong — the filter is
by **audience**, `unicode-range` is already declared, and subsetting is by **Unicode range**. None of
those plans appear below.

---

## 3. Order of work

Ordered by dependency, not by size. Each feature ends at a **stop gate** — nothing proceeds past a
gate until its evidence exists, and evidence that is missing is reported as missing rather than
implied.

```
F4 fonts ──┐  (no data, no route contract, cheapest, and it is the legibility of everything else)
           ├─→ F2 timeline ──→ F3 after-event ──→ F1 music
F2 timeline┘        │                  │                 └── depends on C5 storage (NOT built)
                    └── no schema      └── needs an event end (decision + migration)
```

Why this order: F4 and F2 add no data at all. F3 needs one event-level decision. F1 needs a decision
**and** a subsystem that does not exist yet (C5), so it goes last — a music feature built before its
storage interface would have to be rebuilt after it.

---

## 4. The features

### F4 — Arabic face loading (verify, then decide)

**What is left to do** is not "build a loading strategy" — that exists. It is (a) **prove** the
strategy works by measurement, and (b) put one **decision** in front of the owner.

| File | Change | Why |
|---|---|---|
| none | — | this feature may require no code at all |
| `docs/BRAND.md` | already carries the measured comparison (Appendix A) | Readex Pro Arabic subset **22,864 B** vs Noto Naskh **98,880 B**; both OFL 1.1 |
| `src/styles/fonts.css` | **only if** the owner swaps a face | the `@font-face` set and its `unicode-range` declarations |
| `src/lib/templates/registry.ts:30-33` | **only if** the swap touches a template role | `ar: { names, verse, label, body }` |

**The decision:** whether to replace `notonaskh` (body, 98,880 B) with a smaller geometric face.
My recommendation is **no** — Noto Naskh is a calligraphic register that the product sells, and a
byte saving is not a reason to change every template's character. The measured case for Readex Pro is
in the **console** (three admin-only Plex files, 161,052 B → one variable file, 22,864 B), not on
`/i/<token>`, and `DESIGN.md` §2 already forbids Plex there.

**Dependencies:** none. **Risks:** preloading the wrong face reproduces the 2026-11-19 substitution
shift; `font-display: block` on a face that fails to load is an invisible-text window (bounded by the
browser's 3 s swap timeout).

**Stop gate — measured, both locales at 390×844:**
1. bytes fetched for fonts on first paint of `/ar/i/<token>` and `/en/i/<token>`, listed per file;
2. no Arabic face requested on the English page and none vice versa (`unicode-range` is doing its job);
3. `document.fonts.check(...)` true for each face that paints above the fold;
4. a screenshot at ~0.3 s showing no invisible-text window;
5. CLS re-measured, compared against the recorded `0.00013`;
6. `npm run test:fonts` PASS.
If (2) fails, that is a finding and the fix is in `fonts.css`, not in the template.

### F2 — Timeline (small: the structure is built)

| File | Change | Why |
|---|---|---|
| `src/features/events/ScheduleEditor.tsx` | add a "start from a template" control that seeds the rows | the recon's real value here is **content**, not structure: dates & Arabic coffee · katb al-kitab · zaffa · kosha · walima · dabke · sweets & farewell (ChungDoi, read from its live DOM) |
| `src/features/events/` (a new small module) | the template row set as a constant | a constant, not a table: it is product copy, and it must not need a migration to improve |
| `src/features/invitations/copy.ts`, `messages.ts` | the label for that control, AR + EN | every user-facing string comes from the catalogue |
| `src/features/events/form-fields.ts` | **only if** a field is added | this is the file that silently wrote NULL over operator input in 2026-11-19 when it did not cover the schema; any new field must be added here and covered by its both-ways test |
| **no migration** | — | `schedule` is already `jsonb`, already read, already rendered |

**Dependencies:** none.

**Ordering: settled, and it is the good case.** I expected to find a sort by the `time` string, which
would have put a `00:00` farewell *before* `22:30`. `ScheduleEditor.tsx` does not sort: it is
documented as "the running order, as a list the operator builds", it holds the items in operator
order, and its `move(index, direction)` is an array swap (`:55-60`). It already has add, remove and
move. **So F2 is one affordance — seeding the rows — and nothing else.**

Remaining risk is small: the 20-item cap (zod, `ScheduleSchema.max(20)`), so a 12-row Gulf programme
fits; and the render must preserve the same order the editor holds, which is what the gate checks.

**Stop gate:**
1. a 7-row Gulf programme seeded from the template renders in the template's order, AR and EN;
2. the `00:00` row is last — the editor does not reorder it, and the render does not either;
3. the audience filter still hides the other hall's rows and `?schedule=all` still reveals them;
4. `git diff --stat` shows no change to the invariant files;
5. screenshot of the rendered programme in both locales.

### F3 — After-event page (one decision, one branch)

**The honest description of the conflict:** the owner's instruction is "keep public routes unchanged".
An after-event state changes **what `/i/<token>` renders**. It does not change the route's contract
(same URL, same handlers, same search params, no new public route, RSVP/auth/token untouched) — but a
guest sees something different, so this needs an explicit yes, not an inference from "the contract is
the same".

| File | Change | Why |
|---|---|---|
| `db/migrations/0009_*` | a nullable **end** on the event | there is none today: `events` has `event_datetime` (start) only. Invity's rule is "once the last event date has passed", so the trigger needs an end. **Event-level, not guest data** |
| `src/features/events/schema.ts` | the field in `EventInputSchema` | validation |
| `src/features/events/form-fields.ts` | the reader | the 2026-11-19 defect: a field the reader does not cover is written as NULL over what the operator typed |
| `src/features/events/` editor | one input | the operator sets it; **default derived from the last schedule row at save time**, overridable — a derived default beats a guess, and it beats asking the operator a third time |
| `src/features/invitations/public.ts` | select the new column | the route needs it |
| `src/app/i/[token]/page.tsx` | the render branch | the after-event state |
| `src/features/invitations/copy.ts` | the thank-you copy, with the existing `COPY_SLOTS` override | the family writes their own thank-you; `countdownFinished` already exists and must agree with it |

**Dependencies:** the end-date decision (data), and the owner's yes (product). **Risks, in order:**
1. **Two states that disagree.** The countdown already renders "the celebration has passed — thank you
   for being part of it." A second after-event state that says something else means the same link
   tells two stories. Either the branch subsumes that copy or it must not exist.
2. **Time zones.** "Has it passed" is a comparison across a timezone boundary — `src/lib/time.ts`
   exists for exactly this, and the 2026-11-19 bug was a wall clock read in the server's zone.
3. **The RSVP deadline.** Whether an RSVP arriving *after* the event should be refused is a real
   question — and it lands on `rsvp.ts`, which is frozen for this run. **Flagged as a question, not
   built.** If the answer is "refuse it", that is a separate change with its own gate.
4. **Expiry.** Invity keeps the page 60/180 days and then shows a branded expiry. Without a decision,
   the link lives forever, which is the safer default and the one I would take.
5. A link that changes under the family's feet mid-event, if the end is wrong by hours.

**Stop gate:**
1. with the end in the past: the link renders the after-event state, AR and EN, no countdown;
2. with the end in the future: the link renders the invitation **byte-identical** to today
   (`git stash` comparison against `HEAD`);
3. `git diff --stat` shows no change to `rsvp.ts`, `actions.ts`, `totp.ts`, `middleware.ts`;
4. the derived default is visible in the editor before saving, and an operator override sticks;
5. screenshots of all three states (before / during / after) in both locales.

### F1 — Ambient music (last: it needs a decision and a subsystem)

**Nothing exists** — not a component, not a column, not an asset.

**Decision required before any code**, because it determines the whole shape:
- **(a) the host uploads their own MP3.** Needs the storage interface + a CranL S3 driver — **task C5,
  which is unchecked in `tasks/todo.md`**. Also needs file type/size validation, a signed-URL policy,
  and a statement from the host that they hold the rights.
- **(b) a curated royalty-free library** bundled with the product. No upload path, no storage
  dependency, one licence to manage — but the operator gets a choice they did not make.
- **(c) no music.** The recon's music rows become `skip`. Defensible: every reference either ships a
  licensed recording it cannot pass on (ChungDoi serves a commercial track) or a control with nothing
  behind it (Greenvelope's `DIV.button.music` with **0** `<audio>` elements).

**My recommendation: (b) then (a) later.** (b) is a constant plus a player; (a) is a file-upload
feature wearing a music costume, and it should be sized as one.

| File | Change | Why |
|---|---|---|
| `src/features/invitations/MusicToggle.tsx` | **new** — client component | the control the references all have |
| `src/styles/invitation.css` | the control's styles | logical properties only; position must not collide with the venue dialog's controls; z-index below the dialog's top layer |
| `src/app/i/[token]/page.tsx` | mount it | additive markup; the route contract is unchanged |
| `src/features/events/schema.ts` + `form-fields.ts` | the setting | event-level; **and `form-fields.ts` is the file that bit us before** |
| `db/migrations/0009_*` (or one combined with F3) | the setting column | only for (a) or (b) |
| `docs/COMPLIANCE.md` | the rights statement | for (a), the product must record that the host asserted rights |

**Dependencies:** C5 (storage) for (a); the owner's decision for all three; nothing for (b) beyond a
bundled asset and its licence. **Risks:**
1. **Autoplay is blocked by every browser.** So the control *is* the trigger — which matches the
   references (ChungDoi's track is `paused`, Invyt states "music never autoplays… on any device").
   A design that intends ambient sound on open is unimplementable, and the recon's ChungDoi row is
   the proof.
2. **iOS and the silent switch.** An `<audio>` element is silenced by the hardware mute switch; Web
   Audio is not. This changes the implementation, and it is not a detail to discover after shipping.
3. **Weight.** Audio on a phone is bandwidth on a metered connection. Needs a size ceiling and no
   preload of the file before the guest taps.
4. **A control with nothing behind it** is worse than no control — Greenvelope ships exactly that.
   The gate below is written to catch it.
5. **Licensing.** A commercial recording cannot be shipped to guests. This is the single largest risk
   in the whole plan and the reason (b)/(c) come before (a).

**Stop gate:**
1. at t=2 s and t=10 s after load, **zero** audio elements are playing and no audio file has been
   requested (network log);
2. after one tap the track plays; after a second it stops; the control's `aria-pressed` state matches;
3. `elementFromPoint` at the control's centre returns the control (it is not underneath the invitation
   overlay — the failure that made the seal unpressable);
4. CLS 0 on attach and on toggle;
5. AR and EN screenshots; the control's label from the catalogue, not a literal;
6. the licence for whatever is shipped is recorded in `docs/COMPLIANCE.md`.

---

## 5. ASSUMED, and what would settle each

| # | Assumption | How to settle it |
|---|---|---|
| ~~A1~~ | ~~`ScheduleEditor` sorts by the `time` string~~ | **SETTLED — it does not sort.** `ScheduleEditor.tsx:8-11,55-60`: operator order, `move()` is an array swap |
| A2 | The token minter at `src/features/events/actions.ts:40` is the only place guest tokens are minted | `rg 'randomBytes\|randomUUID' src/` — done, and this is the only non-middleware hit; **an invitation token could also be derived elsewhere, which I did not trace** |
| A3 | No page currently renders for a past event (so F3 has no incumbent behaviour to preserve) | `rg 'event_datetime' src/app/` shows it used for the countdown only |
| ~~A4~~ | ~~C5's storage interface may exist despite being unchecked~~ | **SETTLED — it is absent.** `src/lib/` is csp · data-source · db · env · maps · money · phone · templates · time · totp. No storage module, no S3 driver, no signed-URL helper. F1(a) therefore carries all of C5 |
| A5 | The 2026-11-19 CLS figure `0.00013` is still the current baseline to compare against | re-measure rather than trust the number |
| A6 | No test currently asserts anything about `/i/<token>`'s rendered sections | `tests/browser/` holds layout-shift, venue-dialog and countdown-stability only |

## 6. Sizing, and what this plan does not promise

| Feature | Size | Why |
|---|---|---|
| F4 | **XS** — a measurement and a decision; possibly zero code | the strategy exists |
| F2 | **XS** — one control and one constant; the ordering question turned out to be answered already | the schema, the editor, the reorder control and the render all exist |
| F3 | **M** — one migration, one branch, one copy path, three timezone states | small in code, large in consequence: it changes what an existing URL shows |
| F1 | **M–L** — M for a curated library, L if the host uploads | (a) carries C5 with it |

Riskiest three, in order: **F1's licensing** (a legal exposure, not a bug), **F3's two-states
disagreeing** (the same link telling two stories), **F2's ordering** (silent, cultural, and only
visible if someone looks at a Gulf programme).

**No code was written. No schema was designed. No file in `src/` or `db/` was touched.** The one
outstanding item from the previous session, `docs/PROPOSALS.md` P1, remains unapproved.
