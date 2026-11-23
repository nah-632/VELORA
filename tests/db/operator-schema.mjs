/**
 * The operator schema, proved against a real PostgreSQL (PGlite, WASM).
 *
 * ADDENDUM E removed RLS from this project, so "the database keeps guests apart" is no longer a
 * property this schema can be trusted for. What this file proves instead is everything the schema
 * still owns: that every field the brief lists exists, that the constraints reject the specific
 * bad rows that matter (an un-normalised phone, a short token, a decline with companions), that a
 * guest's answer is updated in place rather than duplicated, that deleting an event removes its
 * guests' data, and that the whole set can be applied twice.
 *
 * It is deliberately independent of the Supabase stub the other db tests use: this schema must
 * run on a plain PostgreSQL, because that is what CranL provides.
 *
 * Run: node tests/db/operator-schema.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { reporter } from "./setup.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = join(ROOT, "db/migrations");

const files = existsSync(DIR)
  ? readdirSync(DIR).filter((n) => n.endsWith(".sql")).sort()
  : [];

const t = reporter("VELORA — operator schema (real PostgreSQL 17 via PGlite/WASM)");
console.log(`migrations found: ${files.length}${files.length ? ` (${files.join(", ")})` : ""}`);

if (files.length === 0) {
  console.error("\n✗ no migrations in db/migrations — a schema test with nothing to test passes for the wrong reason");
  process.exit(1);
}

const db = await PGlite.create();

async function applyAll(label) {
  for (const name of files) {
    try {
      await db.exec(readFileSync(join(DIR, name), "utf8"));
    } catch (error) {
      console.error(`\n✗ migration ${name} failed during ${label}\n${error.message}`);
      process.exit(1);
    }
  }
}

await applyAll("first pass");
t.check(`applied ${files.length} migration(s) from empty`, true);
await applyAll("second pass");
t.check("re-applied the same set (idempotent)", true);

/** Runs a statement that must be refused by a constraint, and reports which one refused it. */
async function refused(label, sql) {
  try {
    await db.exec(sql);
    t.check(`${label} is refused`, false, "the statement was accepted");
  } catch (error) {
    const name = /constraint "([^"]+)"/.exec(error.message)?.[1] ?? "unknown constraint";
    t.check(`${label} is refused`, true, name);
  }
}

// ---------------------------------------------------------------------------------------------
t.section("structure");
const tables = await db.query(
  `select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`,
);
const names = tables.rows.map((r) => r.table_name);
for (const expected of ["settings", "templates", "events", "guests", "rsvps"]) {
  t.check(`table ${expected} exists`, names.includes(expected), names.join(", "));
}

const triggers = await db.query(
  `select count(*)::int as n from pg_trigger where not tgisinternal and tgname like '%_touch'`,
);
// One trigger per mutable table. 0002 adds admin_users, so this number moves whenever a migration
// adds a table with an updated_at column — and the assertion is here to make that a decision rather
// than a drift.
const EXPECTED_TOUCH_TRIGGERS = 6;
t.check(
  "every mutable table maintains updated_at in the database",
  triggers.rows[0].n === EXPECTED_TOUCH_TRIGGERS,
  `${triggers.rows[0].n}/${EXPECTED_TOUCH_TRIGGERS} triggers`,
);

const indexes = await db.query(
  `select indexname from pg_indexes where schemaname = 'public'`,
);
const indexNames = indexes.rows.map((r) => r.indexname);
for (const idx of ["events_status_datetime_idx", "guests_event_idx", "guests_send_status_idx", "rsvps_response_idx"]) {
  t.check(`index ${idx} exists`, indexNames.includes(idx));
}

// ---------------------------------------------------------------------------------------------
t.section("the seeded default");
const settings = await db.query(`select whatsapp_number, default_timezone from public.settings`);
t.check("settings holds exactly one row", settings.rows.length === 1, `${settings.rows.length} rows`);
t.check(
  "the operator's sending number is the configured default",
  settings.rows[0]?.whatsapp_number === "+97366661238",
  settings.rows[0]?.whatsapp_number,
);
t.check("timezone defaults to Bahrain", settings.rows[0]?.default_timezone === "Asia/Bahrain");

await refused(
  "a second settings row",
  `insert into public.settings (id) values (false)`,
);

// ---------------------------------------------------------------------------------------------
t.section("an event, a guest, an answer");
const event = await db.query(
  `insert into public.events (slug, bride_name_ar, groom_name_en, event_datetime, venue_name_ar)
   values ('khalid-noor', 'نور', 'Khalid', '2027-02-14 18:30+03', 'قاعة البحرين')
   returning id`,
);
const eventId = event.rows[0].id;

const guest = await db.query(
  `insert into public.guests (event_id, full_name, phone, category, max_companions, token, personal_line_ar)
   values ($1, 'خالد الأنصاري', '+97333001234', 'family', 3,
           'kR7pQ2mXvT9bN4sL6cH1wY8zA0', 'إلى عمّنا العزيز، حضوركم يكمل فرحنا.')
   returning id, token`,
  [eventId],
);
t.check("a guest with a Gulf phone and a personal line is accepted", guest.rows.length === 1);

await db.query(
  `insert into public.rsvps (guest_id, response, companions_count) values ($1, 'confirmed', 2)`,
  [guest.rows[0].id],
);
const first = await db.query(`select response, companions_count from public.rsvps where guest_id = $1`, [guest.rows[0].id]);
t.check("a confirmation is stored", first.rows[0].response === "confirmed" && first.rows[0].companions_count === 2);

// A guest may change their mind: the same row is updated, never a second one.
await db.query(
  `insert into public.rsvps (guest_id, response, companions_count) values ($1, 'declined', 0)
   on conflict (guest_id) do update
     set response = excluded.response, companions_count = excluded.companions_count, updated_at = now()`,
  [guest.rows[0].id],
);
const after = await db.query(`select count(*)::int as n, max(response) as r from public.rsvps where guest_id = $1`, [guest.rows[0].id]);
t.check(
  "changing an answer updates that guest's row instead of adding another",
  after.rows[0].n === 1 && after.rows[0].r === "declined",
  `${after.rows[0].n} row(s)`,
);

// ---------------------------------------------------------------------------------------------
t.section("the bad rows the schema must refuse");
const G = (cols) => `insert into public.guests (event_id, full_name, phone, token ${cols}) values ('${eventId}', 'x', '+97333001234', 'kR7pQ2mXvT9bN4sL6cH1wY8zA1'`;

await refused("a phone that is not E.164",
  `insert into public.guests (event_id, full_name, phone, token) values ('${eventId}', 'x', '33001234', 'kR7pQ2mXvT9bN4sL6cH1wY8zA2')`);
await refused("a phone with Arabic-Indic digits",
  `insert into public.guests (event_id, full_name, phone, token) values ('${eventId}', 'x', '+٩٧٣٣٣٠٠١٢٣٤', 'kR7pQ2mXvT9bN4sL6cH1wY8zA3')`);
await refused("a token shorter than 22 characters",
  `insert into public.guests (event_id, full_name, phone, token) values ('${eventId}', 'x', '+97333001235', 'tooShort')`);
await refused("a duplicate token",
  `insert into public.guests (event_id, full_name, phone, token) values ('${eventId}', 'x', '+97333001236', 'kR7pQ2mXvT9bN4sL6cH1wY8zA0')`);
await refused("an unknown category",
  `insert into public.guests (event_id, full_name, phone, token, category) values ('${eventId}', 'x', '+97333001237', 'kR7pQ2mXvT9bN4sL6cH1wY8zA4', 'cousin')`);
await refused("a personal line longer than 140 characters",
  `insert into public.guests (event_id, full_name, phone, token, personal_line_en) values ('${eventId}', 'x', '+97333001238', 'kR7pQ2mXvT9bN4sL6cH1wY8zA5', '${"a".repeat(141)}')`);
await refused("a personal line containing a control character",
  `insert into public.guests (event_id, full_name, phone, token, personal_line_en) values ('${eventId}', 'x', '+97333001239', 'kR7pQ2mXvT9bN4sL6cH1wY8zA6', 'hello${String.fromCharCode(7)}world')`);
await refused("more companions than the guests table allows",
  `insert into public.guests (event_id, full_name, phone, token, max_companions) values ('${eventId}', 'x', '+97333001240', 'kR7pQ2mXvT9bN4sL6cH1wY8zA7', 21)`);
await refused("a decline that still claims companions",
  `insert into public.rsvps (guest_id, response, companions_count) values ('${guest.rows[0].id}', 'declined', 1)`);
await refused("an event with no name in either language",
  `insert into public.events (slug, event_datetime) values ('nameless', now())`);
await refused("an event status nobody defined",
  `insert into public.events (slug, bride_name_en, event_datetime, status) values ('x-y', 'A', now(), 'cancelled')`);

// ---------------------------------------------------------------------------------------------
t.section("data that must not outlive an event");
await db.query(`delete from public.events where id = $1`, [eventId]);
const left = await db.query(
  `select (select count(*) from public.guests)::int as guests,
          (select count(*) from public.rsvps)::int as rsvps,
          (select count(*) from public.settings)::int as settings`,
);
t.check(
  "deleting an event removes its guests and their answers, and nothing else",
  left.rows[0].guests === 0 && left.rows[0].rsvps === 0 && left.rows[0].settings === 1,
  JSON.stringify(left.rows[0]),
);

const guards = await db.query(`select count(*)::int as n from public.guests`);
t.check("(the constraint probes left nothing behind)", guards.rows[0].n === 0, `${guards.rows[0].n} guests`);

// ---------------------------------------------------------------------------------------------
t.section("the details an invitation carries");
const columns = await db.query(
  `select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'events' order by column_name`,
);
const columnNames = columns.rows.map((row) => row.column_name);
for (const expected of [
  "venue_address_ar", "venue_address_en", "parking_ar", "parking_en",
  "entrance_ar", "entrance_en", "sections_ar", "sections_en", "schedule",
]) {
  t.check(`events.${expected} exists`, columnNames.includes(expected));
}

const detailed = await db.query(
  `insert into public.events (slug, bride_name_ar, groom_name_ar, event_datetime,
                              venue_name_ar, venue_address_ar, parking_en, entrance_en,
                              sections_ar, dress_code_ar, schedule, status)
   values ('details-round-trip', 'نور', 'خالد', '2027-02-14 18:30+03',
           'قاعة البحرين', 'المنامة، طريق 123', 'Behind the hall', 'Gate 2',
           'قاعة رجال، قاعة نساء', 'زي رسمي',
           '[{"time":"20:30","title_ar":"الاستقبال","title_en":"Reception"},{"time":"","title_ar":"الزفة"}]'::jsonb,
           'draft')
   returning schedule, venue_address_ar, parking_en`,
);
t.check("a fully described event is stored", detailed.rows.length === 1);
t.check("the schedule keeps its order and its shape", Array.isArray(detailed.rows[0].schedule) && detailed.rows[0].schedule[0].title_en === "Reception", JSON.stringify(detailed.rows[0].schedule).slice(0, 80));
t.check("a line without a time survives", detailed.rows[0].schedule[1].time === "");
t.check("the bilingual details come back as written", detailed.rows[0].venue_address_ar === "المنامة، طريق 123" && detailed.rows[0].parking_en === "Behind the hall");

await refused(
  "a schedule that is not an array",
  `insert into public.events (slug, bride_name_ar, event_datetime, schedule)
   values ('bad-schedule', 'نور', now(), '{"time":"20:30"}'::jsonb)`,
);

const defaulted = await db.query(
  `insert into public.events (slug, bride_name_ar, event_datetime) values ('no-schedule', 'نور', now())
   returning schedule`,
);
t.check("an event with no programme gets an empty one, not null", JSON.stringify(defaulted.rows[0].schedule) === "[]");

// ---------------------------------------------------------------------------------------------
// 0009 — the token document lives in the row
// ---------------------------------------------------------------------------------------------

const tokenColumn = await db.query(
  `select is_nullable, data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'templates' and column_name = 'token_config'`,
);
t.check("templates.token_config exists", tokenColumn.rows.length === 1);
t.check(
  "and it is nullable, so a row seeded before 0009 still renders",
  tokenColumn.rows[0]?.is_nullable === "YES",
  String(tokenColumn.rows[0]?.is_nullable),
);

await refused(
  "a token document that is not an object",
  `update public.templates set token_config = '"not a document"'::jsonb where slug = 'golden-palace'`,
);

const seeded = await db.query(
  `select slug, token_config, design_config from public.templates
    where slug in ('emerald-envelope', 'velora-classic', 'golden-palace') order by slug`,
);
t.check("the three token templates are seeded", seeded.rows.length === 3, seeded.rows.map((r) => r.slug).join(", "));
t.check(
  "every one of them carries a token document",
  seeded.rows.every((r) => r.token_config !== null && typeof r.token_config === "object"),
);
t.check(
  "and a design document beside it, because the catalogue renderer reads that one",
  seeded.rows.every((r) => r.design_config !== null && typeof r.design_config === "object"),
);
t.check(
  "the emerald row keeps the mockups' measured emerald, not a near neighbour",
  seeded.rows.find((r) => r.slug === "emerald-envelope")?.token_config?.palette?.emerald === "#192A21",
);
t.check(
  "and its design document uses the text gold, not the 2.4:1 decoration gold",
  seeded.rows.find((r) => r.slug === "emerald-envelope")?.design_config?.palette?.accent === "#7A5220",
);
t.check(
  "the plain slug format constraint still holds for the new rows",
  seeded.rows.every((r) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug)),
);

// The fallback the route relies on: a preset seeded in 0003 has no token document, and that is the
// normal case rather than a gap.
const presets = await db.query(
  `select count(*)::int as without_token from public.templates where token_config is null`,
);
t.check(
  "the 0003 presets have no token document — the code registry is their fallback",
  presets.rows[0].without_token >= 8,
  `${presets.rows[0].without_token} rows fall back`,
);

await db.close();
t.finish();
