> **STATUS: PARKED — 2026-11-21.** Accepted as a reference study and closed. **No feature in this
> map may be started from it** until G3 is closed and the owner approves the specific feature. It is
> a description of how other products look and behave, not a work order; `docs/PROPOSALS.md` holds
> the one item from it that has been put forward, and P1 is not approved either.

# Recon map: Velora — reference study for the guest invitation experience

Scope: the **guest-facing invitation** (seal → opening → reveal → details → RSVP) and the
operator-side machinery behind it (per-guest link, personalisation, tracking), benchmarked against
live references. Not a study of the operator console UI, which Velora already owns.
For: Velora — single-operator luxury wedding invitations, Bahrain, Arabic/English.
Date: 2026-11-21
Method: `replica-recon`. Public pages only. No account was created, no paywall crossed, no
JavaScript bundle or private API was read.

**Precedence:** Velora's approved decisions — Direction A (Pressed Wax), `docs/T1-QUALITY.md`,
`src/styles/tokens.css` — override every recommendation below. Where a reference contradicts
Velora's bar, it is recorded as *what to avoid*.

**Provenance — read this before trusting a row.** Rows marked `Y` in the URL column were opened by
this session unless the note says `delegated`. Five URL verifications were delegated to
sub-agents (monogram, guest-list export, wishes wall, gallery/music/thank-you, some long-tail
URL probes); their rows carry the sub-agent's own verbatim quote and are marked `Y (delegated)`
in the Notes column. Every claim about *behaviour* (timings, `dir`, fonts, animation durations,
element geometry) comes from an instrumented live page in this session, never from marketing copy.
Marketing claims are labelled **CLAIM** and were not upgraded to facts.

---

## Sources

| # | source | URL | verified | what it gave |
| --- | --- | --- | --- | --- |
| 1 | Greenvelope — wedding invitations | https://www.greenvelope.com/wedding-invitations | Y (via 301 from `/weddings`) | envelope + card animation, guest card layout, per-guest price table, FAQ set |
| 2 | Greenvelope — live card preview | https://www.greenvelope.com/card/.preview-1e11c01669da486db0b0f0c587ce5a6a33363933343538?sid=68467&dtid=1040 | Y | measured flap/card animation, real guest DOM |
| 3 | Greenvelope — design detail | https://www.greenvelope.com/designs/invitations/wedding/love-letter | Y | how the animated preview is embedded (iframe 332×804) |
| 4 | ChungDoi — Qasr Gold template | https://chungdoi.com/templates/qasr-gold | Y (via redirect from `/en/...`) | Gulf template inventory, palette, feature list |
| 5 | ChungDoi — Qasr Gold demo (EN/FR) | https://chungdoi.com/templates/qasr-gold/demo?open=1 | Y | opened invitation, timeline, families, guestbook, sparkles, music |
| 6 | ChungDoi — Qasr Gold demo (AR) | https://chungdoi.com/ar/templates/qasr-gold/demo?open=1 | Y | real RTL, Cairo webfont, Gulf naming, religious copy |
| 7 | ChungDoi — Arabic collection | https://chungdoi.com/templates/collections/arabic | Y | the Arabic template inventory |
| 8 | Framer — Wedding Story RTLTR | https://www.framer.com/marketplace/templates/wedding-story-rtltr/ | Y | feature inventory + the two live preview URLs |
| 9 | Wedding Story — EN live preview | https://weddingstoryday.framer.website/ | Y | hero, section list, countdown, 13 audio elements |
| 10 | Wedding Story — AR live preview | https://weddingstoryday.framer.website/home-ar | Y (DOM only — see "capture failures") | RTL defects, logical alignment, nav mirroring |
| 11 | InviteDrop — wedding invitations | https://www.invitedrop.com/wedding | Y | envelope-animation claim, free tier, RSVP flow wording |
| 12 | InviteDrop — design browser | https://www.invitedrop.com/cards/wedding | Y | "how it works" copy, no public design preview |
| 13 | InviteDrop — homepage | https://www.invitedrop.com/ | Y | no public envelope demo reachable |
| 14 | Koroty (كروتي) — Arabic-first, Saudi-facing | https://koroty.com/ar | Y | the closest Gulf-native analogue: opening-screen gallery, per-guest naming, QR entry ticket, RSVP feed, Readex Pro/El Messiri |
| 15 | Invifest / Aangan | https://invifest.com/aangan/ | Y (delegated) | per-guest line and per-guest link, explicitly |
| 16 | ArtFont — Monogram Maker | https://artfont.art/monogram-maker | Y (delegated) | initials → SVG/PNG monogram, styles |
| 17 | WedGuest — guest list app | https://play.google.com/store/apps/details?id=com.wedding.planner.guest.list&hl=en-US | Y (delegated) | Excel export of guest list + RSVP |
| 18 | Wallble — digital guest book | https://www.wallble.com/ideas/wedding-guest-book | Y (delegated) | wishes wall, QR/link entry, moderation-free posting |
| 19 | Invity — features / thank-you page | https://invity.com/features | Y (delegated) | automatic post-event thank-you on the same link |
| 20 | Invyt — invitations with music | https://invyt.io/invitations-with-music | Y (delegated) | tap-to-play music control; explicitly never autoplay |
| 21 | BirEvet — digital invitations (TR) | https://birevet.com/ | Y (delegated) | per-theme font/colour customisation, 20+ openings |
| 22 | Lista Virtual — QR check-in | https://andreoleari.com.br/en/lista-virtual | Y (delegated) | QR pass, arrival times, not-arrived tab, offline |
| 23 | Nupta — interactive wedding platform | https://nupta.app/en/ | Y (delegated) | memories/gallery feed (app-side, not inside the invitation) |
| 24 | AisleReply | https://aislereply.com/whatsapp-rsvp-without-a-link/ | Y (delegated) | WhatsApp RSVP *inside the chat*, deliberately no link |
| 25 | Zant Jametna — زانت جمعتنا | https://zantjametna.com | **N** — surfaced in a search result, not opened by me | QR invitations / barcode check-in → treat as a lead only |

---

## Core loop (what the guest, not the operator, experiences)

```
guest opens their own link  ->  a sealed envelope  ->  one tap  ->  the invitation revealed
     ->  names, families, countdown, timeline, venue, gallery  ->  RSVP (no account)
     ->  everything the guest did is visible to the operator as a per-guest row
```

The loop Velora sells is the *first three steps*. The references differ far more there than in the
RSVP half, and the measured timings below are the only place in this document where a reference
gives Velora a number to beat.

---

## Screens

| ID | screen | how reached | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Sealed cover (Guestvelope) | `greenvelope.com/card/.preview-…` | envelope is a *place* the card sits in | photographic surface, envelope, flap, card raster | animating, settled |
| S02 | Opened card | same, after the sequence | read the invitation | raster card w/ embossed script names, zoom button, music button | settled |
| S03 | ChungDoi cover | `chungdoi.com/templates/qasr-gold/demo` | names + date + one action | title, ornament, date (two languages), `Open / Ouvrir` pill, chat + music buttons | sealed |
| S04 | ChungDoi opened invitation | `…/demo?open=1` | the scroll of sections | hero watercolour, families block, countdown, calendar, venue, dress code, timeline, guestbook, gift box | opened |
| S05 | ChungDoi Arabic invitation | `chungdoi.com/ar/…/demo?open=1` | same, RTL | as S04, mirrored, Cairo, `بن`/`بنت` patronymics | opened |
| S06 | Wedding Story EN hero | `weddingstoryday.framer.website/` | website-style invitation | nav pill + AR switcher, names, date, venue, RSVP, watercolour florals, pendant photo | loaded |
| S07 | Wedding Story AR hero | `…/home-ar` | the Arabic counterpart | as S06, `EN` switcher flipped to the nav's other side | loaded (DOM-verified only) |
| S08 | Koroty step 01/02 | `koroty.com/ar` | operator picks a design and types the couple's names | numbered RTL step chips, design carousel, groom/bride fields, countdown/map/album/wishes list, free CTA | loaded |
| S09 | InviteDrop wedding landing | `invitedrop.com/wedding` | positioning + gating | benefit list w/ gold check rings, dark pill CTA, FAQ block | loaded |
| S10 | Greenvelope design detail | `/designs/invitations/wedding/love-letter` | pick a design, preview the animation | breadcrumb, preview button, 412×531 preview card | loaded |
| S11 | Operator console (reference) | `chungdoi.com/dashboard`, `/guests` | guest list + invitations | nav entries exist; **not opened** (login required) | UNKNOWN |

---

## Flows

```
F01 Guest reveals a Greenvelope card                     (S03 -> S01 -> S02)
    happy path taps: 0  — the envelope opens by itself on load
    measured: flap transform 625 ms -> envelope height 312.5 ms -> card rise 1500 ms
    controls found: DIV.button.music (0 <audio> elements instantiated), zoom button
    "Hide Details" text appears while the flap is moving

F02 Guest reveals a ChungDoi invitation                  (S03 -> S04)
    happy path taps: 1  ("Open / Ouvrir", 188 px wide, centred at y=643 on 390x844)
    addressable state: ?open=1  — the opened invitation is a deep link, not a JS-only state
    effect measured: document 844 px -> 7001 px after the tap
    edge: the same page without ?open=1 renders the sealed cover and nothing else

F03 Operator personalises per guest                      (Koroty S08, Invifest)
    type couple names -> design carries each guest's own name into the cover copy
    evidence: ChungDoi cover reads "Cordially Invites / Cordialement invité Noura to celebrate
    with our family"; Koroty "أرسلها باسم كل ضيف" (send it in every guest's name)

F04 Guest RSVPs without an account                       (InviteDrop, Greenvelope, Koroty)
    one tap; attending / declined / pending counted live for the operator
    edge: party size ("3 أشخاص" in Koroty's live feed), meal choice (Greenvelope survey question)
    NOT observed: the RSVP form itself on any reference (needs a real invitation or an account)
```

---

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Envelope surface | photographic stone (Greenvelope), illustrated palace (ChungDoi), none (InviteDrop, Wedding Story) | sealed, opening, open | S01, S03 |
| Open control | full-width pill in two languages (ChungDoi), implicit auto-play (Greenvelope), scroll (Wedding Story, Koroty) | idle, pressed, hint-pulse | S03, S04 |
| Card surface | raster artwork w/ baked emboss (Greenvelope), DOM sections (ChungDoi, Wedding Story) | rising, settled, zoomed | S02, S04 |
| Countdown | 4 numeric cells (ChungDoi, Wedding Story), duplicated bilingually (ChungDoi) | ticking, ended | S04, S06 |
| Music control | round fixed button w/ ♪ (ChungDoi, Greenvelope), nav-integrated (Wedding Story) | off, on, playlist | S02, S04 |
| Language control | in-nav text switch (Wedding Story `AR`/`EN`), stacked bilingual lines (ChungDoi) | LTR, RTL | S04, S06, S07 |
| Families block | two columns, thin vertical rule, each family with its city (ChungDoi) | — | S04, S05 |
| Timeline | vertical list, time + label (ChungDoi) | — | S04 |
| Guestbook | entry list + send form (ChungDoi), wall (Wallble) | empty, filled | S04 |
| Sparkle / particle | 4 sparkle nodes, 2 s loop (ChungDoi) | looping, idle | S04 |
| QR entry pass | per-guest QR, scanned at the door (Koroty, Lista Virtual) | issued, scanned, not-arrived | S08 |
| Operator console | dashboard + guests (ChungDoi nav) | UNKNOWN | S11 |

---

## Inferred data model (of the references — input to replica-architect)

```
Event          couple names (ar/en), date, time, timezone, two venue blocks,
               families block (family name, city, per side), dress code, palette, template id
               evidence: S04, S05, S03  |  confidence: high
Ceremony       kind (katb al-kitab | walima | reception), venue, starts_at, label
               evidence: ChungDoi shows TWO ceremonies on one invitation
               (Katb al-Kitab @ Al Hamra Majlis 18:30 ; Walima @ Waldorf Astoria RAK 20:00)
               confidence: high — this maps directly onto Velora's dual-hall decision
Guest          name, party size, language, personal line, per-guest link, QR pass,
               opened_at, rsvp_status, arrived_at
               evidence: Koroty live feed ("أم خالد confirmed, 3 people, a minute ago"),
               ChungDoi cover injecting the guest name, Lista Virtual's arrival tracking
               confidence: high for name/link/rsvp; medium for arrived_at
TimelineItem   time, label (ar/en)   evidence: S04 list  |  confidence: high
Wish           guest name, message, created_at
               evidence: S04 guestbook, Wallble  |  confidence: high
OpeningStyle   id, name, preview   evidence: Koroty names 8  |  confidence: high
               (lace envelope, palace doors, scratch-the-gold, ivory envelope,
                silk ribbon, royal parchment, burgundy envelope, wine envelope)
Track          audio url, title, playlist order
               evidence: Wedding Story ships 13 <audio> at volume 0.25
               confidence: high (an audio element per track/section)

Relationships: Event 1-n Ceremony · Event 1-n TimelineItem · Event 1-n Guest ·
               Guest 1-n Wish · Event n-n Track · Event 1-1 OpeningStyle
```

---

## Size

Screens studied: 11 (S11 unopened) · Flows: 4 · Entities: 7.
Hard parts, in order: the **sealed-state correctness** (hit-testing, CLS, reduced motion — all three
now have named failure modes in this document), **Arabic typography that is not a fallback**, and
**per-guest rendering at scale** (one link per guest).
Size for the parts Velora has not built: **M** — nothing here needs a new architecture, and Velora
already holds the two assets the references lack (a measured press-wax seal and a bilingual token
system).

---

# Feature tables

Columns: **Feature · Reference · Official URL (verified Y/N) · Replication elements (precise) ·
Priority · Notes**. Velora's own decision always wins; where it does, the row says so.

## 1. Envelope, seal and the opening

| Feature | Reference | Official URL (verified Y/N) | Replication elements (precise) | Priority | Notes |
| --- | --- | --- | --- | --- | --- |
| Envelope that opens **without a tap** | Greenvelope | https://www.greenvelope.com/card/.preview-1e11c01669da486db0b0f0c587ce5a6a33363933343538?sid=68467&dtid=1040 **Y** | Measured on load: `DIV.img-flap` **transform 625 ms**; envelope `IMG` height **312.5 ms**; then `DIV.centerCard` transform **1500 ms** + `DIV.imageMap.front` **1500 ms**. Sequence total ≈ **2.1 s** | High | The opposite of Velora's T1 decision (tap to open). Recorded as the timing budget to beat: Velora's D4 requires tap → revealed **< 1 s** |
| Card **rising out of** the envelope | Greenvelope | same **Y** | Card starts inside the pocket, rises straight up 1500 ms, `transform` only, no opacity change; envelope stays in frame behind it; photographic stone surface is the ground | High | Reference screenshot: `screens/greenvelope-02-card-rising-mid-anim.jpg`, `-03-card-settled.jpg`. The "physical object on a surface" metaphor is the closest published cousin of Velora's pressed wax |
| Envelope **liner** revealed inside the flap | Greenvelope (CLAIM) | https://www.greenvelope.com/wedding-invitations **Y** | Marketing copy: "arrives inside an animated envelope with a custom liner, stamp, and background music" | Med | CLAIM, not observed — the preview sample's liner is inside the closed envelope. Velora's equivalent is T1 C5 (emerald + gold arabesque liner), still UNVERIFIED on Velora's side |
| **Addressable opened state** (`?open=1`) | ChungDoi | https://chungdoi.com/templates/qasr-gold/demo?open=1 **Y** | The seal button is `<a href="?open=1">`; the URL renders the invitation already open, document **844 px → 7001 px** | High | Cheap, and Velora does not have it. Makes the guest view shareable, testable and screenshot-able without driving the animation every time |
| **Eight named opening screens**, each tappable as a live preview | Koroty | https://koroty.com/ar **Y** | "شاشة البداية — أوّل ما يراه ضيفك قبل الدعوة. مجانية مع كل دعوة، **المس أيّاً منها لتراها تتحرّك**": lace envelope · palace doors · scratch-the-gold · ivory envelope · silk ribbon · royal parchment · **burgundy envelope** · wine envelope | Med | Velora ships **one** opening (Direction A Pressed Wax) — that is the decision. Copy only the *tappable live preview of the opening itself* in the operator console, not the multiplicity. Note they already own "burgundy envelope" |
| Hint that the card is pressable | ChungDoi | https://chungdoi.com/templates/qasr-gold/demo?open=1 **Y** | `igbHintPulse` on a `.igb-hint` node, **2000 ms** loop, plus Tailwind `ping` **1000 ms** / `ping-slow` **1500 ms** rings | Med | Velora's seal is 330×220 and already focusable. A 2 s hint pulse satisfies T1 C6 ("opens on first tap") without changing the artwork |
| Tap **during** the animation must not double-fire | — | — | No reference exposes this | High | Velora's own C6. Keep it; none of the five references can be copied for it |
| Gift-box micro-interaction with its own motion set | ChungDoi | https://chungdoi.com/templates/qasr-gold/demo?open=1 **Y** | `igbSparkleAnim` **2000 ms** ×4 nodes · `igbGiftBob` **3000 ms** · `igbShadowPulse` **3000 ms** · `igbHintPulse` **2000 ms** | Low | A second sealed object inside the opened invitation. Nice pattern, wrong scope for Velora's MVP |

## 2. Per-guest personalisation

| Feature | Reference | Official URL (verified Y/N) | Replication elements (precise) | Priority | Notes |
| --- | --- | --- | --- | --- | --- |
| **Guest's own name written into the invitation copy** | ChungDoi | https://chungdoi.com/templates/qasr-gold/demo **Y** | Cover reads "Cordially Invites / Cordialement invité **Noura** to celebrate with our family / à célébrer avec notre famille"; the feature is listed as "**Guest name display**" | High | Exactly Velora's `{guest_name}` slot in `messages.ts` — already built. Confirms the slot belongs in the *invitation copy*, not only in the WhatsApp message |
| **Send it in each guest's name**, then track who replied | Koroty | https://koroty.com/ar **Y** | "أرسلها **باسم كل ضيف**، وتابع من سيحضر ومن اعتذر أولاً بأول" | High | The Gulf framing of the same mechanic. Their live feed shows 「أم خالد أكّدت حضورها **3 أشخاص** · قبل دقيقة」 — name, party size, relative time |
| Per-guest **link** + per-guest **message** + per-guest reminder | Invifest / Aangan | https://invifest.com/aangan/ **Y (delegated)** | "Every guest has their own link and a message ready to go. One tap opens your chat with them, and you press Send"; "Reminders: a message of their own, with lists of who has not replied and who has not been reminded yet" | High | Velora has this. The reusable detail is the **two lists** (not replied / not reminded) — the operator needs both, they are different |
| A **line of its own for any guest** | Invifest | https://invifest.com/aangan/ **Y (delegated)** | "The greeting: Dear, Respected, Namaste, Welcome or your own, and **a line of its own for any guest**" | High | Velora's personal line (T1 E2 checks it renders under the greeting, in the verse face) |
| **Per-guest personal font** | — | — | **No reference found.** Searched the five priority targets plus eight candidate products; not one exposes a per-guest typeface | Med | Genuinely Velora-original. Two constraints from Velora's own tokens: a personal line must stay inside `--font-display-ar` / `--font-body-ar` for legibility, and Aref Ruqaa is display-only. If it ships, it needs its own T1 row |
| Per-guest **QR entry pass** | Koroty | https://koroty.com/ar **Y** | "**وصلتها تذكرة الدخول تُمسح عند الباب**" (her entry ticket arrived, scanned at the door) | Med | See §8. Note it rides on the guest row, not on a separate ticket system |

## 3. RSVP, tracking and guest management

| Feature | Reference | Official URL (verified Y/N) | Replication elements (precise) | Priority | Notes |
| --- | --- | --- | --- | --- | --- |
| One-tap RSVP, **no guest account** | InviteDrop | https://www.invitedrop.com/wedding **Y** | "Guests respond in one tap with no account required, and you see attending, declined, and pending counts update in real time on your dashboard" | High | Matches Velora's token-link model. The reusable naming: **attending / declined / pending** — three states, not two |
| Live tracking of **opens** and responses | Greenvelope | https://www.greenvelope.com/wedding-invitations **Y** | "View 'Yes' and 'No' responses, **open rates**, and survey responses in real-time" | High | Velora already counts the first open in the same statement that reads the row. Keep that |
| Automatic reminders to **subsets** | Greenvelope | same **Y** | "Schedule and send reminders to **subsets** of your guest list to alert them of an upcoming RSVP deadline or event date" | Med | Velora has a reminder concept. The subset idea (by hall, by unanswered) is the part worth stealing |
| Party size captured with the RSVP | Koroty | https://koroty.com/ar **Y** | Live feed: 「أم خالد أكّدت حضورها **3 أشخاص**」 | Med | Velora's `rsvp.ts` already caps from the guest's row; keep the cap as the ceiling and the reply as the number |
| Meal choice / survey questions | Greenvelope | same **Y** | "Chicken or fish?" · "Do you have a song request?" — arbitrary questions attached to the RSVP | Low | Out of Velora's stated scope |
| Operator console: dashboard + guests | ChungDoi | https://chungdoi.com/dashboard · https://chungdoi.com/guests — **N (login required)** | Nav exposes "My Invitations" and "Guests" | Med | URLs recorded because they are the shape Velora already has; **contents UNVERIFIED** |
| **Excel/CSV export** of guest list + RSVP | WedGuest | https://play.google.com/store/apps/details?id=com.wedding.planner.guest.list&hl=en-US **Y (delegated)** | "You can also export your wedding guest list to Excel. … Confirm the attendance of your wedding guests with just 1 click." App site: wedguest.app | Med | Velora has an export in scope. Their limitation is informative: the free tier caps at 6 guests, so the export is the paywall. Velora's is CSV from the console |
| **Raw timestamps leaked into guest-facing copy** | ChungDoi | https://chungdoi.com/templates/qasr-gold/demo **Y** | Guestbook entries render as "3/14/2027, 12:00:00 PM" — a locale-default, un-formatted string | — | **Avoid.** Velora has `Intl`-based formatting and `zonedToUtc`; the guestbook must format per locale, never `toString()` |

## 4. Arabic, RTL and bilingual

| Feature | Reference | Official URL (verified Y/N) | Replication elements (precise) | Priority | Notes |
| --- | --- | --- | --- | --- | --- |
| **Real RTL document**, not translated text | ChungDoi | https://chungdoi.com/ar/templates/qasr-gold/demo?open=1 **Y** | Measured: `documentElement.dir = "rtl"`, `lang = "ar"`, 1099 Arabic characters, headings and nav in Arabic | High | This is the reference to copy. Velora's `/i/` is an RTL document even with `?lang=en` — same finding, arrived at from the other direction |
| **Arabic webfont actually shipped** | Koroty | https://koroty.com/ar **Y** | Measured computed stacks over Arabic nodes: **Readex Pro** (13 nodes) and **El Messiri** (1) — both Arabic-capable | High | The single most important row in this document. Koroty *has* an Arabic typeface; see the next two rows for what happens without one |
| Arabic headings on a mixed stack | ChungDoi | https://chungdoi.com/ar/… **Y** | **Cairo** (3 nodes) — but also "Times New Roman" (1), Baskerville (4), "Viaoda Libre" (2) declaring the Arabic strings | Med | Partial. `Cairo` is right; the Latin display faces on Arabic nodes fall back silently. Velora's A4 already tabulates the face per element — do that here |
| **What a fake RTL looks like** (avoid) | Wedding Story RTLTR | https://weddingstoryday.framer.website/home-ar **Y (DOM)** | Measured on the Arabic page: `documentElement.dir = "ltr"`, `lang` empty; Arabic `<h1>` computed `font-family: Rochester, "Rochester Placeholder"` and body Arabic in **Poppins** — Latin-only faces; `text-align` is correctly logical (`start`/`end`) | — | **Avoid.** The marketplace listing says "Arabic full RTL layout, mirrored automatically… Dedicated Arabic typography". The direction is carried per-element, the document is LTR, and there is no Arabic face. Also: declared `direction: rtl` **and** `align=end` on the same node — two mechanisms for one job |
| Logical, not hard-coded, alignment | Wedding Story · ChungDoi | both **Y** | Wedding Story: `text-align: start` / `end` measured on Arabic nodes. ChungDoi AR: `align=start` on nav/family nodes, `center` on the names | High | Confirms Velora's `tokens.css` rule ("this file contains no left/right values") |
| **Mirrored chrome** | Koroty | https://koroty.com/ar **Y** | Step chip `01` sits top-**right**, `02` to its left, the back control top-**left** | High | Velora already mirrors the dialog; this is the corroborating pattern for the console |
| Language switching | Wedding Story | https://weddingstoryday.framer.website/home-ar **Y** | An in-nav text switch (`EN` measured at x=593, y=40 on a nav spanning 549→891 — i.e. **moved to the opposite side** from the EN layout); separate URL per language, not a client re-render | Med | Velora soft-navigates with `?lang=` and keeps the dialog open — strictly better than a separate URL. Keep it |
| Bilingual **stacked in one line** | ChungDoi | https://chungdoi.com/templates/qasr-gold/demo **Y** | "CEREMONY INFO **/** INFO CÉRÉMONIE", "RECEPTION INFO / INFO RÉCEPTION", countdown printed twice (EN then FR) | Low | Suits a *printed* bilingual card. On a phone with a switcher it doubles the scroll. Velora: switcher |
| Gulf naming conventions | ChungDoi AR | https://chungdoi.com/ar/… **Y** | Page title "**عمر بن خالد** و **ليلى بنت يوسف**"; both families named with their cities (دبي · أبوظبي) | High | Velora should carry `بن` / `بنت` patronymics as separate name fields, not as one free text line |
| Religious / cultural opening line | ChungDoi AR | https://chungdoi.com/ar/… **Y** | "**بفضل الله وكرمه**، يتشرف عمر وليلى بدعوتكم لمشاركتهما فرحة الزفاف في أمسية عربية أصيلة تليق بهذا اليوم." | High | Copy slot, not a string. Velora's `COPY_SLOTS` + per-event override already fits this exactly |
| RTL claim **without a reachable Arabic demo** | ChungDoi | https://chungdoi.com/templates/qasr-gold/demo?open=1&lang=ar **Y but no effect** | The `lang=ar` probe returned **0 Arabic characters**, `dir=ltr`, `lang=en` | — | The claim ("full Arabic support with a complete RTL layout") is verified **only** through the `/ar/` locale, not through a language parameter. Worth remembering: check the locale path, not a query param |
| Numerals in Arabic | — | — | Not measured on any reference | Low | Velora decides Arabic-Indic vs Western per product; T1 already uses Latin digits in both languages. Keep consistent |

## 5. Timeline, venue, calendar, gallery

| Feature | Reference | Official URL (verified Y/N) | Replication elements (precise) | Priority | Notes |
| --- | --- | --- | --- | --- | --- |
| **Culturally specific day timeline** | ChungDoi | https://chungdoi.com/templates/qasr-gold/demo **Y** | Read from the live DOM, in order: `17:30` Guests welcomed with **dates and Arabic coffee** · `18:30` Katb al-kitab · `19:30` **Zaffa** procession · `20:00` The couple take the **kosha** · `21:00` **Walima** dinner · `22:30` **Dabke** and dancing · `00:00` Sweets and farewell | High | The best single reference in this document for Velora's audience. Note the last row crosses midnight and is a *farewell*, not a start — a timeline component must not assume same-day ordering |
| **Two ceremonies on one invitation** | ChungDoi | same **Y** | "**KATB AL-KITAB** Al Hamra Majlis AT 18:30" and "**WALIMA** Waldorf Astoria Ras Al Khaimah AT 20:00", each with its own venue | High | The Gulf two-part structure, and the same shape as Velora's dual halls (`event_venues.kind = women \| men \| shared`). Velora's data model generalises better: theirs is fixed at two |
| **Per-function schedule** — every function with its own date, time and venue, inside one link | Invifest (the replacement for the brief's "WedApp") | https://invifest.com/wedding-invitation-website/ **Y (delegated)** | "Every function with its date, time, venue and map, your photos and your song, on one link you send on WhatsApp" | High | "WedApp" itself could not be sourced: wedapp.com is a GoDaddy **for-sale** page, wedapp.app is **parked**, .io/.co/.in/.net do not resolve, and its only surviving page is a Play Store listing (not the product's own site). Invifest is the verified stand-in, and its framing generalises the two-ceremony pattern: *n* functions, not two |
| Countdown, 4 cells | ChungDoi **Y** · Wedding Story **Y** | https://chungdoi.com/templates/qasr-gold/demo · https://weddingstoryday.framer.website/ | ChungDoi: "225 days 11 hours 22 min 23 sec" (printed twice: EN + FR). Wedding Story: 4 numeric cells at 335 / 16 / 56 / 33 | High | Velora's D2 (cells keep identical boxes across ≥60 ticks) is a stricter bar than either ships. Neither reference shows a fixed cell size; ChungDoi's labels are proportional text |
| Mini calendar with the wedding day marked + add-to-calendar | ChungDoi | same **Y** | "July 2027" grid, 7 columns, the day marked with a heart; "Add to Calendar / Ajouter au calendrier" | Med | Velora generates a `.ics`. A visual month grid is a small, high-perceived-value addition |
| Venue + map link | ChungDoi **Y** · Koroty **Y** | https://chungdoi.com/templates/qasr-gold/demo · https://koroty.com/ar | ChungDoi: venue name + city + "Get directions"; Koroty lists "خريطة القاعة" (hall map) among what every invitation includes | Med | Velora has `maps.ts` and venue icons; the dialog pattern (T1 E3) is already stronger |
| Dress code | ChungDoi | same **Y** | "DRESS CODE — Party Attire / Tenue de soirée" as its own section | Low | Velora's `0006_event_details.sql` already carries this |
| Photo gallery inside the invitation | ChungDoi **Y** · Nupta **Y (delegated)** | https://chungdoi.com/templates/qasr-gold/demo · https://nupta.app/en/ | ChungDoi: "3D coverflow photo album" (CLAIM — the demo's gallery section is present: "PHOTO GALLERY / GALERIE PHOTO"). Nupta: "Guests share photos, stories, and moments" — an app-side **Memories feed**, up to 50 / 1,000 / 5,000 photos by tier | Med | Nupta's gallery is *not* inside the invitation page — a distinction the marketplace copy blurs. Velora: gallery inside the invitation, photos supplied by the operator |

## 6. Music and ambience

| Feature | Reference | Official URL (verified Y/N) | Replication elements (precise) | Priority | Notes |
| --- | --- | --- | --- | --- | --- |
| Background music + toggle in the invitation | ChungDoi | https://chungdoi.com/templates/qasr-gold/demo **Y** | One `<audio>`: `/m/music/perfect-ed-sheeran.mp3`, `paused=true` (never autoplayed); round fixed button with a ♪ glyph, bottom-right, dark olive | High | The control is always visible and never auto-plays — the correct pattern. The default track is a **licensed pop song** (see below) |
| **A playlist**, not one song, with per-song volume | Wedding Story RTLTR | https://weddingstoryday.framer.website/ **Y** | **13** `<audio>` elements; the populated ones are `framerusercontent.com/assets/*.mp3`; `volume = 0.25`; every one `paused`, `loop=false` | Med | Below-1 volume is a nice touch. The marketplace describes "bride's song / groom's song / vintage turntable player" (**CLAIM**) |
| Tap-to-play, **explicitly never autoplay** | Invyt | https://invyt.io/invitations-with-music **Y (delegated)** | "Guests tap it and the song plays while they read the details and RSVP"; "**Music never autoplays**… no jarring sound the moment a link opens, on any device" | High | Their product page states the rule Velora should adopt verbatim. Note their public sample invitation has **0 audio elements and no music control in the DOM** — asserted, not demonstrated |
| Music control present but inert | Greenvelope | https://www.greenvelope.com/card/.preview-… **Y** | A `DIV.button.music` node exists; `document.querySelectorAll('audio').length === 0` at every point observed | Med | A button with nothing behind it is worse than no button. Do not ship the control before the track |
| **Licensed music cannot be cloned** | ChungDoi · Wedding Story | both **Y** | A commercial recording (Ed Sheeran, "Perfect") is served as the demo track; the Framer template ships MP3s on its own CDN | — | `skip`. Velora must use licensed/commissioned or royalty-free audio, or the event's own upload, and say so in the terms |

## 7. Motion, ornament, foil and particles (Velora-specific check)

| Feature | Reference | Official URL (verified Y/N) | Replication elements (precise) | Priority | Notes |
| --- | --- | --- | --- | --- | --- |
| **Gold bubbles / sparkle particles** | ChungDoi | https://chungdoi.com/templates/qasr-gold/demo?open=1 **Y** | `igbSparkleAnim` on **4** nodes classed `.igb-spark`, duration **2000 ms**, infinite; sibling `igbGiftBob` 3000 ms and `igbShadowPulse` 3000 ms | High | The only reference in this study with a real particle layer, and it is **4 nodes on a 2 s loop** — not hundreds. That is the scale Velora should match: a handful of absolutely-positioned nodes animating `transform`/`opacity` only (Velora's D3 forbids animated layout properties) |
| Ping / ripple rings | ChungDoi | same **Y** | Tailwind `ping` (1000 ms) and `ping-slow` (1500 ms) on `rounded-full` nodes | Med | Reusable for the "tap the seal" hint; cheap, transform-only |
| **Foil / embossed names** | Greenvelope | https://www.greenvelope.com/card/.preview-… **Y** | The card is a **raster artwork**: script names carry a baked 3D drop shadow and a paper-grain texture; nothing is CSS-driven except the wrappers | — | **Avoid the raster.** Velora renders the names live (T1 A3/A6: Aref Ruqaa, computed, with a measured foil ramp whose lightest stop clears 3:1). A raster card cannot re-flow, cannot be localised, and cannot honour reduced motion |
| Watercolour hero + reflecting pool | ChungDoi | same **Y** | Illustrated palace, four palms, teal pool, couple from behind; the Arabic demo shows the **same illustration** with Arabic copy | Low | The look Velora is deliberately *not* taking: Velora's field is Khatam tessellation + zellige dividers on ivory (T1 B1–B3), not a watercolour scene |
| Scroll-reveal ornament set (floating hearts, flower drift, film strip) | Wedding Story RTLTR | https://www.framer.com/marketplace/templates/wedding-story-rtltr/ **Y (listing)** | Listing: "floral ornaments, film strip, floating hearts, flower drift, text reveal effects" | Low | **CLAIM** — listed, not individually observed; the EN page's hero florals were observed, the named effects were not |
| Arch drawn in once (`stroke-dashoffset`) | Velora (internal) | — | T1 B4, with a `prefers-reduced-motion` branch | High | No reference observed does a *drawn* ornament. Velora's is ahead; keep it and keep the reduced-motion branch |

## 8. Extras: check-in, wishes, thank-you, monogram, export, customisation

| Feature | Reference | Official URL (verified Y/N) | Replication elements (precise) | Priority | Notes |
| --- | --- | --- | --- | --- | --- |
| **QR entry pass per guest**, scanned at the door | Koroty | https://koroty.com/ar **Y** | "**وصلتها تذكرة الدخول تُمسح عند الباب**"; the pass arrives with the guest's own link | High | The Gulf-native product treats the ticket as a property of the guest row. Velora's `guests` table can carry it without a new entity |
| QR check-in console | Lista Virtual | https://andreoleari.com.br/en/lista-virtual **Y (delegated)** | "At the door the receptionist scans the guest's QR code or checks them in with a tap"; live attendance counter, a **"Not arrived" tab**, arrival times, PDF/Excel reports, group QR on Premium, works offline | High | The **"not arrived" tab** is the operationally correct frame — a door list is defined by who is missing, not who is present |
| QR invitations / 2D check-in (Gulf) | Zant Jametna | https://zantjametna.com — **N (surfaced in a search result, never opened)** | Search snippet only: QR invitations, WhatsApp per guest, barcode check-in | Med | Lead, not a source. Open it before citing it |
| **Guest wishes wall** | Wallble **Y (delegated)** · ChungDoi **Y** | https://www.wallble.com/ideas/wedding-guest-book · https://chungdoi.com/templates/qasr-gold/demo | Wallble: guests post message/photo/voice/doodle on a wall reached by link or QR, "without anyone needing to sign up", free to 10 posts, $9 one-time unlock. ChungDoi: "GUESTBOOK / LIVRE D'OR" with "🪄 SEND WISHES / ENVOYER UN VŒU" and a public entry list | High | Velora's Addendum C wishes wall. Two lessons: **no signup for the guest**, and keep it a *wall* (everyone sees) rather than a message to the operator |
| **After-event thank-you on the same link** | Invity | https://invity.com/features **Y (delegated)** | "Automatic thank-you note displayed to guests **after the event date**"; their blog: "once the last event date has passed, the invitation page automatically switches to a thank-you message… The music, the photos and the blessings wall are still there", same address, page lives 60 days (Grand) / 180 (Royal), then a branded expiry page | Med | The expiry window is the detail Velora needs to decide: a link that 404s after the wedding looks like a bug to the family |
| **Monogram generator** | ArtFont | https://artfont.art/monogram-maker **Y (delegated)** | Style picker (circle, split-letter, floral, interlocking, script), name/initials field, colour selector, transparent **PNG** + cut-ready **SVG**; 2K standard / 4K for 1 credit; 30 free credits then $9.99 packs; generation requires an account | Low | Velora already ships its own monogram (`brand/monogram.mjs`, the folded strip read as V) and T1 C3 requires a **crisp vector inline `<svg>`, no raster** — so a generator is only useful as a *comparison*, not a dependency. The page never mentions wax seals; that use is **ASSUMED** |
| **Advanced per-theme customisation** (fonts, colours) | BirEvet | https://birevet.com/ **Y (delegated)** | "Her temanın renklerini ve yazı tiplerini değiştirebilirsiniz" ("you can change the colours and fonts of every theme"); 44 themes, 20+ opening animations; editor is behind sign-up | Low | **PARTIAL** — fonts and colours verified in copy; layout/background/size not found. Velora's design_config snapshot is the stronger model (an invitation must not change when a template is edited later). The same page also documents **host-uploaded MP3** music, an unlimited photo gallery and a "kişisel anı defteri" (personal memory book) — three things Velora's Addendum C lists; a second live reference for the same customisation claim is nupta.site ("Customize everything — colors, fonts, layout… The design is a starting point, not a locked template") |
| **Swap the design after publishing** | Koroty | https://koroty.com/ar **Y** | "بدّل التصميم حتى بعد النشر وتبقى نصوصك وصورك وضيوفك كما هي" (change the design even after publishing; your text, photos and guests stay as they are) | Med | Directly relevant: Velora snapshots `design_config` per invitation. Say out loud whether a post-send palette change is allowed — Koroty says yes and preserves the data |
| Free-to-start gating | InviteDrop **Y** · ChungDoi **Y** · Greenvelope **Y** | https://www.invitedrop.com/wedding · https://chungdoi.com/templates/qasr-gold · https://www.greenvelope.com/wedding-invitations | InviteDrop: 5 free invites, no ads, one-time price above that. ChungDoi: "Free to create · 3-day trial · **Pay only if you love it**" (pay at publish). Greenvelope: flat one-time price **by guest count**, observed from $19 (≤20) to $3,799 (25,000) | Low | Velora is single-operator (no self-serve gating in scope). Recorded because the "**pay at publish**" gate is the one that matches an operator who builds drafts for clients |

---

# URLs that failed verification

Everything attempted and not usable as a source. "Failed" means: did not resolve, redirected away
from the claimed product, served a parked or empty page, or loaded but did not show the claimed
feature. Nothing in the feature tables above rests on any row below.

## Hard failures — the URL exists but is not the product

| URL | What it returned |
| --- | --- |
| https://www.framer.com/marketplace/templates/velvet-vow/ | **"Template unavailable — Page not found / That page moved. We probably forgot to add a redirect here."** The template is gone. The whole "tap-open envelope, rising card, music toggle" target had to be re-sourced; Greenvelope + ChungDoi + Koroty cover those mechanics instead |
| https://weddingid.com/ | HTTP 200 but an **empty Apache default document** (`<html><body><!-- default --></body></html>`, Last-Modified 2022), expired TLS certificate (delegated) |
| https://wedapp.com | GoDaddy **"is for sale"** lander (delegated) |
| https://wedapp.app | GoDaddy **parked-domain** lander (delegated) |
| https://www.eventsapps.com/ | Redirects to a **HugeDomains** parked page (delegated) |
| https://chungdoi.com/templates/qasr-gold/demo?open=1&lang=ar | Loaded, but `lang=ar` did **nothing**: 0 Arabic characters, `dir=ltr`, `lang=en`. Not a failure of the URL — a failure of the parameter. The Arabic content lives at the `/ar/` locale path instead |
| https://www.invitedrop.com/ and /cards/wedding | Live, but **no public envelope animation anywhere**: 0 `<video>`, no envelope/flap/seal nodes, nothing but pulse skeletons. The "cinematic envelope animation" is only reachable by creating an invitation |

## Non-resolving domains (NXDOMAIN)

`wedapp.io` · `wedapp.co` · `wedapp.in` · `wedapp.net` · `listavirtual.com` · `listaivirtual.com` ·
`aislereply.io` · `aislereply.app` · `getaislereply.com` · `ikskom.com` · `appforwed.com` ·
`weddingid.app` · `weddingid.io` · `wedding-id.com` (all delegated).
Note the pattern: **every one of these was a plausible-looking domain for a product named in the
brief.** Not one of them existed. A named product is not a URL.

## Page-level blocks

| URL | What it returned |
| --- | --- |
| https://www.mojeek.com/search?q=%22AisleReply%22 | HTTP **403 Forbidden** (delegated) |
| https://html.duckduckgo.com/html/?q=… | **Bot challenge page**, no results (delegated) |
| https://www.birevet.com/davetiye-tasarimlari · /ozellikler | **404** — my own guessed paths, never linked from the site. Guessing a path to a live site is the same error as guessing a domain |

## Redirects (not failures — recorded because the given URL is not the real one)

| Given | Lands on | Content correct? |
| --- | --- | --- |
| https://www.greenvelope.com/weddings | https://www.greenvelope.com/wedding-invitations | yes — canonical product page |
| https://chungdoi.com/en/templates/qasr-gold | https://chungdoi.com/templates/qasr-gold | yes — the `/en/` locale prefix is dropped |

## Capture failures (the page was fine; the screenshot was not)

Recorded because a blank image is not evidence of a blank page — Velora learned this the expensive
way on 2026-11-20, and it happened again here:

- `https://weddingstoryday.framer.website/` — first capture returned a white frame; the DOM held
  headings, fonts and images at the same moment. Recaptured successfully at 1440×900.
- `https://weddingstoryday.framer.website/home-ar` — **three** captures returned only the cream
  background; the DOM held **189 elements in the viewport** (only 4 of them faded). The AR page is
  therefore **DOM-verified only**; its visible rendering is UNVERIFIED.
- A browser tab evaluating JavaScript on that page **stopped responding after 15 s** and had to be
  rebuilt, losing the page state.
- `https://chungdoi.com/templates/qasr-gold/demo` (sealed cover) captured blank once; the same page
  captured correctly after the tap.

## Leads seen but never opened — do not cite without checking

`zantjametna.com` · `fotify.app` · `mithaq-invitation.com` · `da3watfarah.com` · `party-card.com/ar` ·
`planning.wedding/ar` · `pressedlove.com` · `linkinvitation.com` · `rsvpful.com` · `invitease.co` ·
`quikrsvp.com` · `withjoy.com` (opened by a delegated agent, but its content was never read before
that run ended). These appeared in search results or answer summaries only.

---

# Verified facts vs assumptions

## FACT — measured in this session on a live page

- Greenvelope reveal: `DIV.img-flap` transform **625 ms**; envelope `IMG` height **312.5 ms**;
  `DIV.centerCard` + `DIV.imageMap.front` transform **1500 ms** each; the card is a raster artwork;
  a `DIV.button.music` exists with **0** `<audio>` elements.
- ChungDoi: the open control is `<a href="?open=1">`; opened document **844 → 7001 px**;
  sparkles = **4** nodes × **2000 ms**; `igbGiftBob`/`igbShadowPulse` **3000 ms**; `igbHintPulse`
  **2000 ms**; `ping` **1000 ms** / `ping-slow` **1500 ms**; one `<audio>` (an Ed Sheeran MP3),
  `paused=true`; timeline rows 17:30 → 00:00 incl. dates-and-coffee, zaffa, kosha, walima, dabke.
- ChungDoi Arabic demo: `dir="rtl"`, `lang="ar"`, 1099 Arabic chars, **Cairo** on 3 nodes (with
  Baskerville/Times/Viaoda Libre also declaring Arabic nodes), `align=start` on nav/families,
  title "عمر بن خالد و ليلى بنت يوسف".
- Wedding Story: **13** `<audio>`, `volume=0.25`, all paused; countdown cells 335/16/56/33;
  EN hero verified visually at 1440 (cream field, four-corner watercolour florals, gold necklace
  with a photo pendant, green serif names, RSVP pill).
- Wedding Story AR: `documentElement.dir === "ltr"`, `lang` empty, Arabic headings computed as
  **Rochester** / body Arabic as **Poppins** (Latin-only), `text-align: start|end`,
  the `EN` switch measured at x=593 inside a nav spanning 549→891 (mirrored side).
- Koroty: `dir="rtl"`, `lang="ar"`, **Readex Pro** on 13 Arabic nodes + **El Messiri** on 1;
  step `01` top-right with the back control top-left; 8 named opening screens; "أرسلها باسم كل ضيف";
  entry ticket "تُمسح عند الباب"; live RSVP feed with party size and relative time.
- InviteDrop: 5 free invites, no ads, one-time pricing above that; no public envelope demo.
- Greenvelope price table: one-time, per guest count, $19 (≤20) → $3,799 (25,000).

## ASSUMED — inferred, not observed

- **ArtFont's monogram usable as a wax-seal imprint** — the maker page never mentions seals.
- **WedGuest's exported spreadsheet carries the RSVP column** — the app tracks attendance and
  exports "to Excel", but the two are stated separately.
- **Nupta's gallery sitting "inside the invitation"** — the evidence is a Memories feed and photo
  tiers in an app, not a photo section inside a web invitation.
- **"WedApp" and "AisleReply" as spelled in the brief map onto the live products of those names** —
  treated as the intended products; both verdicts turned on the specific claimed feature.
- **Greenvelope's envelope liner, stamp and background music** — marketing copy; the preview sample
  did not expose them.
- **Wedding Story's named motion effects** (floating hearts, flower drift, film strip) — listed on
  the marketplace page, not individually observed.
- **ChungDoi's "3D coverflow photo album"** — the gallery section exists ("PHOTO GALLERY /
  GALERIE PHOTO"); the 3D coverflow behaviour was not exercised.
- **ChungDoi's Arabic support in the operator product** — verified only on the demo locale path;
  I did not create an invitation in Arabic.

## UNVERIFIED — could not be established, and is not claimed

- Any **RSVP form** on any reference (all sit behind a real invitation or an account).
- Any **operator console** (ChungDoi's `/dashboard` and `/guests` are login-gated).
- **ChungDoi's visual RTL mirroring** at the pixel level: the AR demo is a *different* seed
  (عمر بن خالد / ليلى بنت يوسف, Dubai/Abu Dhabi) from the EN demo (Omar & Noura, Ras Al Khaimah),
  so EN and AR could not be diffed like for like.
- The **Wedding Story AR page as rendered pixels** (capture returned background only, 3 attempts).
- **InviteDrop's envelope animation** — claimed in copy, no public instance found.
- Whether any reference has a **per-guest personal font** — none was found, which is why it is
  recorded as Velora-original rather than copied.
- **Zant Jametna and the other Gulf leads** — search snippets only.

---

# Out of scope (cannot or should not be cloned)

- **The music itself.** ChungDoi serves a commercial recording; Wedding Story ships MP3s on its own
  CDN. Neither is licensable to Velora. Velora needs licensed, commissioned or guest-uploaded audio
  and a stated policy.
- **The illustrated artwork.** ChungDoi's palace/oasis hero and Greenvelope's raster cards are
  commissioned or licensed art. Velora builds its own field (Khatam, zellige, muqarnas) — and its
  own artwork is already the differentiator.
- **The guest networks.** Every reference's value partly comes from guests already recognising the
  brand in their inbox. Velora's is trust with one operator's own clientele, which is a different
  asset and cannot be copied.
- **Third-party delivery infrastructure** — SMS/WhatsApp sending at scale, email deliverability,
  address validation (Greenvelope). Velora sends by `wa.me` deep link, which is a legitimate and
  cheaper choice for a single operator.
- **Designers' catalogues and marketplace mechanics** (Greenvelope's indie designers, Framer's
  template marketplace). Not Velora's business model.
- **The Apple/Google app-store app** (WedGuest, Nupta). Velora is the web.

# What Velora should do next (three items, in order)

1. **Take the addressable opened state.** `?open=1` on `/i/<token>` costs almost nothing, makes the
   guest view testable and shareable without driving the seal every time, and would have made the
   C1/C3/C5/D/E verification on 2026-11-20 shorter. It is the single cheapest item in this document.
2. **Give the Arabic copy a real face before the Arabic copy is written.** Koroty ships Readex Pro +
   El Messiri; Wedding Story ships Rochester/Poppins on Arabic text and falls back silently. Velora
   already has the right rule in `tokens.css` (`[dir="rtl"]` swaps `--font-display`/`--font-body`) —
   the reference study confirms the rule is the differentiator, not the translation.
3. **Build the wishes wall and the QR pass as properties of the guest row.** Koroty and Lista
   Virtual both attach the ticket to the guest, and Velora's `guests` table already has the row.
   No new entity is needed, and the door list is defined by the "not arrived" set.

Next step in the pack: `/replica-architect` — turn the inferred entities in this document into the
real schema, indexes and access rules.

---

# Verdict index — every named candidate in the brief

One row per name the brief put forward, so nothing is left dangling. `Y` = live product with the
claimed feature observed; `PARTIAL` = live, feature only half as claimed; `REPLACED` = name could not
be sourced, a verified stand-in was used; `DEAD` = URL exists but is not the product.

| named in the brief | verdict | what it actually is | where it went in this map |
| --- | --- | --- | --- |
| Framer **Velvet Vow** | **DEAD** | "Template unavailable — Page not found" | §1 — replaced by Greenvelope + ChungDoi + Koroty for the tap-open/rising-card/music mechanics |
| **Greenvelope** | Y (given URL 301s to `/wedding-invitations`) | real, large, raster-card product | §1, §3, §6 |
| **ChungDoi — Qasr Gold** | Y (given URL drops the `/en/` prefix) | the strongest Gulf-style reference; **`/ar/` renders true RTL** | §1, §4, §5, §7 |
| Framer **Wedding Story RTLTR** | Y | live previews verified — and a **fake RTL** (dir=ltr on the Arabic page) | §4, §6 |
| **InviteDrop** | Y — official site is **invitedrop.com** | live; envelope animation claimed but not publicly demonstrable | §3, §8 |
| **ArtFont** (monogram) | Y (delegated) | artfont.art/monogram-maker, PNG + SVG | §8 — `skip` for Velora, which owns its monogram |
| **Invifest** (personal line) | Y (delegated) | invifest.com/aangan/ — per-guest line, link, message, reminders | §2 |
| **WedApp** (timeline) | **REPLACED → Invifest** | wedapp.com for sale, wedapp.app parked, .io/.co/.in/.net NXDOMAIN; only a Play Store listing survives | §5 new row |
| **Lista Virtual** (QR check-in) | Y (delegated) | live, but on a **personal domain** (andreoleari.com.br), not listavirtual.com | §8 |
| **AisleReply** (WhatsApp reminders) | **PARTIAL** | live and real (aislereply.com) but deliberately **has no per-guest links** — replies happen in the chat | Sources #24 — kept as the counter-example, not the model |
| **WedGuest** (Excel export) | Y (delegated) | Play Store listing documents the Excel export; wedguest.app does not; free tier caps at 6 guests | §3 |
| **Wallble** (wishes wall) | Y (delegated) | wallble.com, no signup for guests, free to 10 posts, $9 unlock incl. PDF download | §8 |
| **Nupta** (gallery) | **PARTIAL** | nupta.app — gallery is an **app-side Memories feed**, not a section inside the invitation. Name collides with nupta.site (a different product) and nupta.rw / app.nupta.cl | §5 |
| **Invyt** (ambient music) | **PARTIAL** | invyt.io — tap-to-play control, and the page states **"Music never autoplays"**; its own public sample has 0 audio elements | §6 |
| **WeddingID** (thank-you page) | **REPLACED → Invity** | weddingid.com is an empty Apache default page with an expired certificate; .app/.io/wedding-id.com do not resolve. invity.com/features documents the automatic post-event thank-you | §8 |
| **Bir Evet** (customisation) | **PARTIAL** | birevet.com — 44 themes, fonts + colours, host-uploaded MP3, gallery, memory book; layout/background/size not offered | §8 |
| **Gulf/Arabic-native pass** | Y — done directly | the delegated agent for this **timed out with no usable output**; covered by **Koroty** (koroty.com/ar), the Arabic locale of ChungDoi, and an Arabic-language search that surfaced Fotify · Mithaq · Zanta Jametna · Da3wat Farah · Party Card · planning.wedding (all leads, unopened) | §1, §2, §4, §8 |
