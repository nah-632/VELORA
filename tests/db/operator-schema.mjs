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
t.check("every mutable table maintains updated_at in the database", triggers.rows[0].n === 5, `${triggers.rows[0].n}/5 triggers`);

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

await db.close();
t.finish();
