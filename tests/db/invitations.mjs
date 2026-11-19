/**
 * Events, guests, and what the public route is allowed to reveal.
 *
 * The privacy assertions here are the point of the file. `/i/[token]` is reached by a stranger's
 * phone with a token from a forwarded WhatsApp message, so "returns the minimum" is a security
 * property, not a formatting preference — and the only way to know it holds is to load two guests
 * into one event and check that one guest's page contains nothing about the other.
 *
 * Run: npm run test:db:invitations
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { reporter } from "./setup.mjs";
import { pgliteSql } from "./pglite-sql.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = join(ROOT, "db/migrations");

const { loadInvitation, looksLikeToken, previewInvitationForGuest } = await import(
  "../../src/features/invitations/public.ts"
);
const { submitRsvp, rsvpForToken, thankYou } = await import("../../src/features/invitations/rsvp.ts");
const { newGuestToken } = await import("../../src/features/admin/credentials.ts");

const files = existsSync(DIR) ? readdirSync(DIR).filter((n) => n.endsWith(".sql")).sort() : [];
const t = reporter("VELORA — events, guests and the public route (real PostgreSQL via PGlite/WASM)");
if (files.length === 0) {
  console.error("✗ no migrations found");
  process.exit(1);
}

const db = await PGlite.create();
for (const name of files) await db.exec(readFileSync(join(DIR, name), "utf8"));
const sql = pgliteSql(db);
console.log(`migrations applied: ${files.join(", ")}`);

// ---------------------------------------------------------------------------------------------
t.section("the designs an event is built from");
const templates = await db.query(`select slug, name_en, design_config from public.templates order by sort_order`);
t.check("the built collection is seeded", templates.rows.length >= 6, `${templates.rows.length} designs`);
t.check(
  "every design carries a full configuration",
  templates.rows.every((row) => row.design_config?.palette && row.design_config?.typography && row.design_config?.layout),
);
t.check(
  "and nothing is left in the columns it replaced",
  (await db.query(
    `select count(*)::int as n from information_schema.columns
      where table_schema='public' and table_name='templates' and column_name in ('palette','fonts','layout_config')`,
  )).rows[0].n === 0,
);

// ---------------------------------------------------------------------------------------------
t.section("an event");
const templateId = templates.rows[0].slug;
const event = await db.query(
  `insert into public.events (slug, bride_name_ar, groom_name_ar, bride_name_en, groom_name_en,
                              event_datetime, venue_name_ar, venue_name_en, template_id, status)
   values ('khalid-noor-a1b2c3', 'نور', 'خالد', 'Noor', 'Khalid',
           '2027-02-14 18:30+03', 'قاعة البحرين', 'Bahrain Hall',
           (select id from public.templates where slug = $1), 'active')
   returning id`,
  [templateId],
);
const eventId = event.rows[0].id;
t.check("an event with bilingual fields is stored", Boolean(eventId));

// ---------------------------------------------------------------------------------------------
t.section("two guests, two tokens");
const firstToken = newGuestToken();
const secondToken = newGuestToken();
const first = await db.query(
  `insert into public.guests (event_id, full_name, phone, category, max_companions, token, personal_line_ar)
   values ($1, 'خالد الأنصاري', '+97333001234', 'family', 3, $2, 'إلى عمّنا العزيز')
   returning id`,
  [eventId, firstToken],
);
const second = await db.query(
  `insert into public.guests (event_id, full_name, phone, category, token)
   values ($1, 'مريم العلوي', '+97333005678', 'friends', $2) returning id`,
  [eventId, secondToken],
);

// ---------------------------------------------------------------------------------------------
t.section("the public route");
t.check("a token that is not token-shaped is refused", !looksLikeToken("short"));
t.check("...and never reaches the database", (await loadInvitation("short", { sql })) === null);
t.check("a well-shaped but unknown token returns nothing", (await loadInvitation(newGuestToken(), { sql })) === null);

const loaded = await loadInvitation(firstToken, { sql });
t.check("a real token returns the invitation", loaded !== null);
t.check("with the guest's own name", loaded?.guestName === 'خالد الأنصاري');
t.check("and the event's wording", loaded?.blocks.names.includes("خالد") === true, loaded?.blocks.names);
t.check("and a design the renderer can use", loaded?.design.version === 1);
t.check("and the guest's personal line for their language", loaded?.personalLine === 'إلى عمّنا العزيز');

const opened = await db.query(`select first_opened_at, open_count from public.guests where id = $1`, [first.rows[0].id]);
t.check("the open is recorded", opened.rows[0].first_opened_at !== null && opened.rows[0].open_count === 1);

const firstSeenAt = opened.rows[0].first_opened_at;
await loadInvitation(firstToken, { sql });
await loadInvitation(firstToken, { sql });
const openedAgain = await db.query(`select first_opened_at, open_count from public.guests where id = $1`, [first.rows[0].id]);
t.check("opening again counts, without moving the first open", openedAgain.rows[0].open_count === 3);
t.check(
  "...and the first-open timestamp is the first one",
  openedAgain.rows[0].first_opened_at.getTime() === firstSeenAt.getTime(),
);

// The privacy assertion, stated as the brief states it.
const serialised = JSON.stringify(loaded);
t.check("the response carries no phone number", !serialised.includes("+97333001234") && !serialised.includes("33001234"));
t.check("...and nothing about the other guest", !serialised.includes("مريم") && !serialised.includes("+97333005678"));
t.check(
  "...and no identifiers of either guest",
  !serialised.includes(first.rows[0].id) && !serialised.includes(second.rows[0].id),
);
t.check("the other guest's invitation was not touched by any of this", (await db.query(
  `select open_count, first_opened_at from public.guests where id = $1`,
  [second.rows[0].id],
)).rows[0].open_count === 0);

// ---------------------------------------------------------------------------------------------
t.section("the operator's preview");
const before = (await db.query(`select open_count from public.guests where id = $1`, [second.rows[0].id])).rows[0].open_count;
const preview = await previewInvitationForGuest(second.rows[0].id, { sql });
const after = (await db.query(`select open_count from public.guests where id = $1`, [second.rows[0].id])).rows[0].open_count;
t.check("the preview renders the invitation", preview?.guestName === 'مريم العلوي');
t.check("...and does not count as an open", before === after && after === 0, `${before} → ${after}`);

// ---------------------------------------------------------------------------------------------
t.section("a guest with no design");
await db.query(`update public.events set template_id = null where id = $1`, [eventId]);
const withoutDesign = await loadInvitation(secondToken, { sql });
t.check(
  "an event with no design returns nothing rather than a broken invitation",
  withoutDesign === null,
  "the route shows its apology page instead",
);

// ---------------------------------------------------------------------------------------------
t.section("RSVP");
// The companion cap belongs to the guest, not to the form. `first` was created with 3.
const confirmed = await submitRsvp(firstToken, { response: "confirmed", companions: 2 }, { sql });
t.check("a confirmation with companions is stored", confirmed.ok && confirmed.state.response === "confirmed" && confirmed.state.companions === 2);

const changed = await submitRsvp(firstToken, { response: "declined", companions: 3 }, { sql });
t.check("changing to a decline is accepted", changed.ok && changed.state.response === "declined");
t.check("...and the companions go to zero without the guest noticing", changed.state.companions === 0);
const rows = await db.query(`select count(*)::int as n from public.rsvps where guest_id = $1`, [first.rows[0].id]);
t.check("...on the same row, never a second one", rows.rows[0].n === 1, `${rows.rows[0].n} row(s)`);

const tooMany = await submitRsvp(firstToken, { response: "confirmed", companions: 9 }, { sql });
t.check("more companions than the guest is allowed is refused", tooMany.ok === false && tooMany.reason === "too_many_companions");
const unchanged = await rsvpForToken(firstToken, { sql });
t.check("...and the previous answer stands", unchanged.response === "declined", String(unchanged.response));

const nonsense = await submitRsvp(firstToken, { response: "maybe", companions: 0 }, { sql });
t.check("an answer that is neither is refused", nonsense.ok === false && nonsense.reason === "bad_response");
t.check("an unknown token is refused", (await submitRsvp(newGuestToken(), { response: "confirmed" }, { sql })).reason === "invalid_token");
t.check("a malformed token never reaches the database", (await submitRsvp("short", { response: "confirmed" }, { sql })).reason === "invalid_token");

const opensAfterAnswering = await db.query(`select open_count from public.guests where id = $1`, [first.rows[0].id]);
t.check(
  "answering does not count as an open",
  opensAfterAnswering.rows[0].open_count === 3,
  `${opensAfterAnswering.rows[0].open_count}`,
);

t.section("the thank-you");
const withWords = {
  thankYouConfirmedAr: "شكرًا من القلب", thankYouConfirmedEn: "With all our hearts",
  thankYouDeclinedAr: "نفتقدكم", thankYouDeclinedEn: "You will be missed",
};
t.check("the couple's own words are used when they exist", thankYou(withWords, "confirmed", "ar") === "شكرًا من القلب");
t.check("...in the guest's language", thankYou(withWords, "declined", "en") === "You will be missed");
const withoutWords = {
  thankYouConfirmedAr: null, thankYouConfirmedEn: null, thankYouDeclinedAr: null, thankYouDeclinedEn: null,
};
t.check("a plain default stands in when they are empty", thankYou(withoutWords, "confirmed", "en").includes("delighted"));
t.check("...and the two answers are told apart", thankYou(withoutWords, "confirmed", "ar") !== thankYou(withoutWords, "declined", "ar"));

// ---------------------------------------------------------------------------------------------
t.section("the writers, not just the schema");
// The gap that let a production bug through: the assertions above insert SQL literals, so they
// watched the *schema* and never the code that writes to it. These drive the real functions.
const queries = await import("../../src/features/events/queries.ts");
const schedule = [
  { time: "19:30", title_ar: "الاستقبال", title_en: "Reception", detail_ar: "البهو", detail_en: "Lobby" },
  { time: "20:30", title_ar: "الزفة", title_en: "Zaffa", detail_ar: null, detail_en: null },
];
const createdId = await queries.createEvent(
  {
    bride_name_ar: "نور", groom_name_ar: "خالد",
    bride_name_en: null, groom_name_en: null,
    event_datetime: "2027-02-14T18:30", timezone: "Asia/Bahrain",
    hijri_date_text: null,
    venue_name_ar: "قاعة البحرين", venue_name_en: null,
    venue_map_url: null,
    venue_address_ar: "المنامة", venue_address_en: null,
    parking_ar: null, parking_en: null, entrance_ar: null, entrance_en: null,
    sections_ar: null, sections_en: null,
    quote_ar: null, quote_en: null, notes_ar: null, notes_en: null,
    dress_code_ar: null, dress_code_en: null,
    thank_you_confirmed_ar: null, thank_you_confirmed_en: null,
    thank_you_declined_ar: null, thank_you_declined_en: null,
    template_id: null, monogram_text: null, status: "draft", schedule,
  },
  "writer-probe",
  { sql },
);

const written = await db.query(`select jsonb_typeof(schedule) as kind, venue_address_ar from public.events where id = $1`, [createdId]);
t.check("the writer stores the programme as a jsonb array", written.rows[0].kind === "array", `jsonb_typeof = ${written.rows[0].kind}`);
t.check("and the details alongside it", written.rows[0].venue_address_ar === "المنامة");

const readBack = await queries.getEvent(createdId, { sql });
t.check("order is preserved through the round trip", Array.isArray(readBack.schedule) && readBack.schedule[0].title_en === "Reception");

await queries.updateEvent(
  createdId,
  { ...readBack, timezone: readBack.timezone, event_datetime: "2027-02-14T19:00", schedule: [schedule[0]], status: "active" },
  { sql },
);
const updated = await db.query(`select jsonb_typeof(schedule) as kind, jsonb_array_length(schedule) as len, status from public.events where id = $1`, [createdId]);
t.check("the updater keeps it an array too", updated.rows[0].kind === "array", `jsonb_typeof = ${updated.rows[0].kind}`);
t.check("and replaces rather than appends", updated.rows[0].len === 1 && updated.rows[0].status === "active");

await db.close();
t.finish();
