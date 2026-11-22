/**
 * The details an invitation carries, and the rules that decide whether it is ready to send.
 *
 * Run: npm test
 */
import test from "node:test";
import assert from "node:assert/strict";

import { EventInputSchema, ScheduleSchema, eventChecklist, eventReadiness } from "../../src/features/events/schema.ts";
import { EVENT_FORM_KEYS, SCHEDULE_FIELD, readEventForm, schemaFields } from "../../src/features/events/form-fields.ts";
import { googleMapsHref, googleMapsSearchUrl, isGoogleMapsUrl, mapsButtonLabel } from "../../src/lib/maps.ts";

const complete = {
  bride_name_ar: "نور", groom_name_ar: "خالد",
  bride_name_en: "Noor", groom_name_en: "Khalid",
  event_datetime: "2027-02-14T18:30",
  venue_name_ar: "قاعة البحرين", venue_name_en: "Bahrain Hall",
  template_id: "11111111-1111-1111-1111-111111111111",
};

test("the four things without which there is no invitation", () => {
  const { ready, missing } = eventReadiness(complete);
  assert.equal(ready, true);
  assert.deepEqual(missing, []);

  for (const [field, expected] of [
    ["template_id", "template"],
    ["event_datetime", "date"],
  ]) {
    const partial = { ...complete, [field]: null };
    const result = eventReadiness(partial);
    assert.equal(result.ready, false, `${field} should matter`);
    assert.deepEqual(result.missing, [expected]);
  }
});

test("names in either language are enough, because the guest reads one", () => {
  const arabicOnly = { ...complete, bride_name_en: null, groom_name_en: null };
  assert.equal(eventReadiness(arabicOnly).ready, true);
  const latinOnly = { ...complete, bride_name_ar: null, groom_name_ar: null };
  assert.equal(eventReadiness(latinOnly).ready, true);
  const neither = { ...complete, bride_name_ar: null, groom_name_ar: null, bride_name_en: null, groom_name_en: null };
  assert.equal(eventReadiness(neither).ready, false);
});

test("a thin invitation is sendable, and the checklist says what is thin", () => {
  // The distinction the operator needs: ✗ blocks a send, ○ does not.
  const checklist = eventChecklist(complete);
  const required = checklist.filter((item) => item.required);
  const optional = checklist.filter((item) => !item.required);

  assert.equal(required.every((item) => item.done), true);
  assert.equal(optional.every((item) => !item.done), true, "nothing optional was filled in");
  // The venue's address and map are checked per hall (`venueAddress`, `venueMap`), which also cover
  // an event created before halls existed — so there is no separate `address`/`map` item.
  assert.deepEqual(
    optional.map((item) => item.key),
    ["venueAddress", "venueMap", "notes", "dressCode", "parking", "sections", "schedule"],
  );
});

test("each optional detail lights up on its own, in either language", () => {
  const withExtras = eventChecklist({
    ...complete,
    venue_address_ar: "المنامة، طريق 123",
    parking_en: "Behind the hall",
    schedule: [{ time: "20:30" }],
  });
  const done = Object.fromEntries(withExtras.map((item) => [item.key, item.done]));
  assert.equal(done.venueAddress, true);
  assert.equal(done.parking, true);
  assert.equal(done.schedule, true);
  assert.equal(done.dressCode, false);
  assert.equal(done.sections, false);

  const bothLanguages = eventChecklist({ ...complete, dress_code_en: "Black tie", dress_code_ar: null });
  assert.equal(bothLanguages.find((item) => item.key === "dressCode")?.done, true);
});

test("a Google Maps link is accepted, and only a Google Maps link", () => {
  for (const accepted of [
    "https://maps.app.goo.gl/abc123",
    "https://www.google.com/maps/search/?api=1&query=Manama",
    "https://google.com/maps/place/Bahrain+Hall",
    "https://www.google.com/maps/@26.2,50.5,15z",
  ]) {
    assert.equal(isGoogleMapsUrl(accepted), true, accepted);
  }

  // Refused, in three families. Each of these is a value that could reach an anchor's href.
  for (const refused of [
    // not links at all
    "javascript:alert(1)", "data:text/html;base64,PHNjcmlwdD4=", "vbscript:msgbox", "not a url", "",
    // a link, but somebody else's service
    "https://maps.apple.com/?q=Bahrain", "https://waze.com/ul/abc", "https://example.com/where",
    // Google's name on a host Google does not control — this is the open-redirect shape
    "https://google.com.maps.example.com/", "https://google.com.evil.example/maps",
    "https://www.google.com.attacker.test/maps", "https://goo.gl/maps/abc",
    // Google's host, but not the Maps path
    "https://google.com/search?q=Bahrain", "https://www.google.com/",
    // plain http is a mixed-content downgrade, not a map link
    "http://maps.google.com/?q=1",
  ]) {
    assert.equal(isGoogleMapsUrl(refused), false, refused);
  }
  assert.equal(isGoogleMapsUrl(null), false);
});

test("the guest's button opens Google Maps whatever the operator pasted", () => {
  const good = "https://maps.app.goo.gl/abc123";
  assert.equal(googleMapsHref({ mapUrl: good }), good, "a Google link is used as it is");

  const generated = googleMapsHref({ mapUrl: "https://waze.com/ul/abc", name: "قاعة الخليج", address: "المنامة" });
  assert.equal(generated?.startsWith("https://www.google.com/maps/search/?api=1&query="), true);
  assert.equal(generated?.includes("waze"), false, "the Waze link is not passed through");
  assert.equal(decodeURIComponent(generated?.split("query=")[1] ?? ""), "قاعة الخليج, المنامة");

  // Nothing to search for: an address field is not a map link, and a blank map is worse than none.
  assert.equal(googleMapsHref({ mapUrl: "https://waze.com/ul/abc" }), null);
  assert.equal(googleMapsHref({ mapUrl: null, name: "قاعة", address: null })?.includes("query=%D9%82%D8%A7%D8%B9%D8%A9"), true);

  // The length cap is applied to the query, so the URL stays a URL.
  const long = googleMapsSearchUrl("ا".repeat(3000));
  assert.equal(long.length <= 2048, true, `${long.length}`);
  assert.equal(long.startsWith("https://www.google.com/maps/search/?api=1&query="), true);
});

test("the map button says Google Maps in both languages", () => {
  assert.equal(mapsButtonLabel("en"), "Open in Google Maps");
  assert.equal(mapsButtonLabel("ar"), "افتح في خرائط Google");
});

test("the schedule: shape, order, and a limit", () => {
  const parsed = ScheduleSchema.parse([
    { time: "20:30", title_ar: "الاستقبال", title_en: "Reception", detail_ar: null, detail_en: "Lobby" },
    { time: "", title_ar: "الزفة" },
  ]);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].title_en, "Reception");
  assert.equal(parsed[1].time, "", "a line without a time is allowed — not every line has a clock");
  assert.equal(parsed[0].detail_ar, null, "an empty string becomes absent");

  assert.equal(ScheduleSchema.safeParse("not an array").success, false);
  assert.equal(ScheduleSchema.safeParse(Array.from({ length: 21 }, () => ({ time: "x" }))).success, false);
});

test("the event form accepts the new fields, and rejects a dangerous map URL", () => {
  const good = EventInputSchema.safeParse({
    ...complete,
    venue_address_ar: "المنامة",
    parking_en: "Behind the hall",
    sections_ar: "قاعة رجال، قاعة نساء",
    schedule: [{ time: "20:30", title_ar: "الاستقبال" }],
    venue_map_url: "https://maps.google.com/?q=Bahrain",
    status: "draft",
  });
  assert.equal(good.success, true, good.success ? "" : JSON.stringify(good.error.issues));

  const bad = EventInputSchema.safeParse({ ...complete, venue_map_url: "javascript:alert(1)" });
  assert.equal(bad.success, false);
  assert.match(bad.success ? "" : bad.error.issues[0]?.message ?? "", /Google Maps link starting with https:/);
});

test("a link that is not Google's is refused, and an empty field is absent rather than empty", () => {
  // Apple and Waze links arrive from phones and are still valid links; they are simply not this
  // field's value any more, because the guest's button opens Google Maps.
  for (const refused of ["https://maps.apple.com/?ll=26.2,50.5", "https://waze.com/ul/abc", "https://google.com.evil.example/maps"]) {
    assert.equal(EventInputSchema.safeParse({ ...complete, venue_map_url: refused }).success, false, refused);
  }

  const parsed = EventInputSchema.parse({ ...complete, venue_map_url: "https://maps.app.goo.gl/xyz" });
  assert.equal(parsed.venue_map_url, "https://maps.app.goo.gl/xyz");
  const empty = EventInputSchema.parse({ ...complete, venue_map_url: "" });
  assert.equal(empty.venue_map_url, null, "an empty field is absent, not an empty string");
});

test("every field the schema knows is read from the form", () => {
  // This is the test that was missing when the new columns were added: the schema grew, the reader
  // did not, and every save wrote null over what the operator had typed. A silent data loss with a
  // green build — the failure mode this file exists to prevent.
  const schema = schemaFields().filter((field) => field !== SCHEDULE_FIELD);
  const read = new Set(EVENT_FORM_KEYS);
  const missing = schema.filter((field) => !read.has(field));
  assert.deepEqual(missing, [], `the form reader does not read: ${missing.join(", ")}`);

  // And the reader must not read fields that are not in the schema either — that would write values
  // nobody validated.
  const unknown = [...read].filter((field) => !schema.includes(field));
  assert.deepEqual(unknown, [], `the reader reads fields the schema does not have: ${unknown.join(", ")}`);
});

test("the reader turns a posted form into the event shape", () => {
  const form = new FormData();
  form.set("venue_address_ar", "المنامة، مجمع ٣٢٨");
  form.set("parking_en", "Behind the hall");
  form.set("sections_ar", "قاعة للرجال وقاعة للنساء");
  form.set("schedule", JSON.stringify([{ time: "19:30", title_ar: "الاستقبال" }]));
  form.set("status", "active");

  const read = readEventForm(form);
  assert.equal(read.venue_address_ar, "المنامة، مجمع ٣٢٨");
  assert.equal(read.parking_en, "Behind the hall");
  assert.equal(Array.isArray(read.schedule), true);
  assert.equal(read.schedule[0].title_ar, "الاستقبال");

  // A malformed programme is an empty one, not a crash.
  const broken = new FormData();
  broken.set("schedule", "{ not json");
  assert.deepEqual(readEventForm(broken).schedule, []);
  // And an oversized one is refused by the schema in the reader, not stored.
  const huge = new FormData();
  huge.set("schedule", JSON.stringify(Array.from({ length: 30 }, () => ({ time: "x" }))));
  assert.deepEqual(readEventForm(huge).schedule, []);
});

test("the reader and the schema agree end to end", () => {
  const form = new FormData();
  form.set("groom_name_ar", "خالد");
  form.set("bride_name_ar", "نور");
  form.set("event_datetime", "2027-02-14T18:30");
  form.set("venue_address_en", "Manama, Block 328");
  form.set("template_id", "11111111-1111-1111-1111-111111111111");
  form.set("status", "active");

  const parsed = EventInputSchema.safeParse(readEventForm(form));
  assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error.issues));
  assert.equal(parsed.success && parsed.data.venue_address_en, "Manama, Block 328");
});
