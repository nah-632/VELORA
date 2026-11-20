/**
 * The wording, the variables, and which hall a guest is being welcomed to.
 *
 * Run: npm test
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  COPY_SLOTS,
  DEFAULT_COPY,
  DEFAULT_WHATSAPP,
  WHATSAPP_PURPOSES,
  audienceForGender,
  confirmLabel,
  placeholdersIn,
  renderTemplate,
  resolveAudience,
  resolveCopy,
} from "../../src/features/invitations/messages.ts";
import {
  venueComplete,
  venueLabel,
  venueText,
  venueVariables,
  venueForCalendar,
  venuesForGuest,
} from "../../src/features/invitations/venues.ts";

// ---------------------------------------------------------------------------------------------
// The wording

test("every slot exists in both languages, and none is empty where it must not be", () => {
  for (const locale of ["ar", "en"]) {
    for (const slot of COPY_SLOTS) {
      assert.equal(typeof DEFAULT_COPY[locale][slot], "string", `${locale}.${slot}`);
      if (slot === "verse") continue; // an English invitation may legitimately carry no verse
      assert.ok(DEFAULT_COPY[locale][slot].trim().length > 0, `${locale}.${slot} is empty`);
    }
  }
});

test("the Arabic defaults are the operator's text, verbatim", () => {
  assert.equal(DEFAULT_COPY.ar.greeting, "أهلًا بك يا {guest_name}، يا من نعتزّ بمحبته");
  assert.match(DEFAULT_COPY.ar.opening, /^بقلوبٍ عامرة بالفرح/);
  assert.match(DEFAULT_COPY.ar.body, /يتشرّف \{groom\} و\{bride\} بدعوتكم/);
  assert.equal(DEFAULT_COPY.ar.beforeRsvp, "يسعدنا أن نعرف هل ستكونون معنا، لنُحسن استقبالكم كما تستحقون");
  assert.equal(DEFAULT_COPY.ar.confirmButtonNeutral, "سأحضر بإذن الله");
  assert.equal(DEFAULT_COPY.ar.declineButton, "أعتذر مع خالص محبتي");
});

test("variables are substituted, and an unknown one is left visible", () => {
  const rendered = renderTemplate("أهلًا بك يا {guest_name} في {venue}", {
    guest_name: "خالد",
    venue: "قاعة البحرين",
  });
  assert.equal(rendered, "أهلًا بك يا خالد في قاعة البحرين");

  // A mistyped placeholder is left as written, so the operator sees it in the preview rather than
  // finding an empty line on the invitation.
  assert.equal(renderTemplate("يا {guest_nmae}", { guest_name: "خالد" }), "يا {guest_nmae}");
  assert.deepEqual(placeholdersIn("أهلًا {guest_name} · {venue} · {venue}"), ["guest_name", "venue"]);
});

test("the confirm button is the guest's own, and the default is correct for anybody", () => {
  const arabic = resolveCopy("ar", null, "neutral");
  assert.equal(confirmLabel(arabic, "male"), "بإذن الله سأكون حاضرًا");
  assert.equal(confirmLabel(arabic, "female"), "بإذن الله سأكون حاضرة");
  assert.equal(confirmLabel(arabic, "neutral"), "سأحضر بإذن الله");

  // English does not inflect, and the three forms are the same sentence rather than three texts.
  const english = resolveCopy("en", null, "female");
  assert.equal(confirmLabel(english, "female"), confirmLabel(english, "male"));
});

test("an overridden slot replaces the default, and an empty one does not", () => {
  const overridden = resolveCopy("ar", { ar: { greeting: "أهلًا وسهلًا يا {guest_name}", opening: "   " } }, "neutral");
  assert.equal(overridden.greeting, "أهلًا وسهلًا يا {guest_name}");
  assert.equal(overridden.opening, DEFAULT_COPY.ar.opening, "whitespace is not an override");
  assert.equal(overridden.body, DEFAULT_COPY.ar.body, "an override of one slot leaves the rest");
  // Overriding one language does not touch the other.
  assert.equal(resolveCopy("en", { ar: { greeting: "x" } }, "neutral").greeting, DEFAULT_COPY.en.greeting);
});

test("gender decides the audience unless the operator says otherwise", () => {
  assert.equal(audienceForGender("female"), "women");
  assert.equal(audienceForGender("male"), "men");
  assert.equal(audienceForGender("neutral"), "both");
  assert.equal(resolveAudience("female", null), "women");
  assert.equal(resolveAudience("female", "both"), "both", "a family overrides the individual");
  assert.equal(resolveAudience("neutral", "men"), "men");
  assert.equal(resolveAudience("male", "nonsense"), "men", "an unknown value falls back to the rule");
});

// ---------------------------------------------------------------------------------------------
// The messages the operator sends

test("all four WhatsApp messages exist in both languages and keep their variables", () => {
  for (const purpose of WHATSAPP_PURPOSES) {
    for (const locale of ["ar", "en"]) {
      const template = DEFAULT_WHATSAPP[purpose][locale];
      assert.ok(template.trim().length > 0, `${purpose}.${locale} is empty`);
      assert.match(template, /\{guest_name\}/, `${purpose}.${locale} does not address the guest`);
    }
  }
  // The day-before message is the one that carries the hall, because that is the day it matters.
  assert.match(DEFAULT_WHATSAPP.beforeEvent.ar, /\{venue_name_for_guest\}/);
  assert.match(DEFAULT_WHATSAPP.beforeEvent.ar, /\{venue_map_url_for_guest\}/);
  assert.match(DEFAULT_WHATSAPP.reminder.ar, /\{link\}/);
});

// ---------------------------------------------------------------------------------------------
// The venues

const women = {
  id: "1", kind: "women", sort_order: 0,
  name_ar: "قاعة اللؤلؤة", name_en: "Pearl Hall",
  address_ar: "المنامة، مجمع ٣٢٨", address_en: "Manama, Block 328",
  map_url: "https://maps.apple.com/?q=pearl", start_time: "19:30",
  entrance_ar: "البوابة الشرقية", entrance_en: "East gate",
  parking_ar: null, parking_en: "Behind the hall",
  dress_code_ar: null, dress_code_en: null, notes_ar: null, notes_en: null, contact_phone: null,
};
const men = {
  ...women, id: "2", kind: "men", sort_order: 1,
  name_ar: "قاعة الخليج", name_en: "Gulf Hall",
  address_ar: "المنامة، مجمع ٣٢٩", address_en: "Manama, Block 329",
  map_url: "https://waze.com/ul/abc", start_time: "20:00",
};
const shared = { ...women, id: "3", kind: "shared" };

test("one field of one venue, in the guest's language, falling back to the other", () => {
  assert.equal(venueText(women, "name", "ar"), "قاعة اللؤلؤة");
  assert.equal(venueText(women, "name", "en"), "Pearl Hall");
  // The operator filled parking only in English; an Arabic-reading guest still gets it.
  assert.equal(venueText(women, "parking", "ar"), "Behind the hall");
  // And a field nobody filled is empty, not a placeholder.
  assert.equal(venueText(women, "notes", "ar"), "");
});

test("both venues are shown to every guest, and only the guest's own is emphasised", () => {
  const forWoman = venuesForGuest([women, men], "women");
  assert.deepEqual(forWoman.own.map((v) => v.kind), ["women"]);
  assert.deepEqual(forWoman.other.map((v) => v.kind), ["men"], "the other hall is never hidden");
  assert.equal(forWoman.emphasis, "women");

  const forMan = venuesForGuest([women, men], "men");
  assert.deepEqual(forMan.own.map((v) => v.kind), ["men"]);
  assert.deepEqual(forMan.other.map((v) => v.kind), ["women"]);
  assert.equal(forMan.emphasis, "men");

  const forBoth = venuesForGuest([women, men], "both");
  assert.deepEqual(forBoth.own.map((v) => v.kind), ["women", "men"]);
  assert.equal(forBoth.emphasis, null, "a household is not sent to one hall");
  assert.equal(forBoth.other.length, 0);
});

test("a shared venue, or a single hall, is one venue and no contrast", () => {
  const one = venuesForGuest([shared], "both");
  assert.equal(one.single, true);
  assert.equal(one.emphasis, null);
  assert.equal(one.own.length, 1);

  const onlyWomen = venuesForGuest([women], "men");
  assert.equal(onlyWomen.single, true, "one hall is one hall, whatever the audience says");
  assert.equal(onlyWomen.own[0].kind, "women");
});

test("the WhatsApp variables name the guest's hall, and both when there are two", () => {
  const womanVars = venueVariables(venuesForGuest([women, men], "women"), "ar");
  assert.match(womanVars.venue_name_for_guest, /قاعة النساء: قاعة اللؤلؤة/);
  assert.equal(womanVars.venue_map_url_for_guest, "https://maps.apple.com/?q=pearl");

  const bothVars = venueVariables(venuesForGuest([women, men], "both"), "ar");
  assert.match(bothVars.venue_name_for_guest, /قاعة النساء/);
  assert.match(bothVars.venue_name_for_guest, /قاعة الرجال/, "a household needs both addresses");
  assert.match(bothVars.venue_map_url_for_guest, /maps\.apple\.com/);
  assert.match(bothVars.venue_map_url_for_guest, /waze\.com/);

  const englishVars = venueVariables(venuesForGuest([women, men], "men"), "en");
  assert.match(englishVars.venue_name_for_guest, /Men's Hall: Gulf Hall/);
});

test("the calendar entry names the guest's hall and its address", () => {
  const calendar = venueForCalendar(venuesForGuest([women, men], "women"), "ar");
  assert.equal(calendar.name, "قاعة اللؤلؤة");
  assert.equal(calendar.address, "المنامة، مجمع ٣٢٨");
  assert.equal(calendar.map, "https://maps.apple.com/?q=pearl");
});

test("what the checklist considers a complete venue", () => {
  assert.deepEqual(venueComplete(women), { name: true, address: true, map: true });
  assert.deepEqual(venueComplete({ ...women, map_url: null }), { name: true, address: true, map: false });
  assert.deepEqual(venueComplete({ ...women, name_ar: " ", name_en: null }), { name: false, address: true, map: true });
});

test("a venue with no name still has a label a guest can read", () => {
  assert.equal(venueLabel({ ...women, name_ar: null, name_en: null }, "ar"), "قاعة النساء");
  assert.equal(venueLabel({ ...men, name_ar: null, name_en: null }, "en"), "Men's Hall");
  assert.equal(venueLabel({ ...shared, name_ar: null, name_en: null }, "ar"), "مكان الحفل");
});

// ---------------------------------------------------------------------------------------------
// Phase 3: the sender seam, and the export's escaping

test("the manual provider composes a link and never claims it sent", async () => {
  const { manualProvider, waLink, resolveProvider } = await import("../../src/features/whatsapp/provider.ts");
  const result = await manualProvider.send({ to: "+973 3300 1234", body: "أهلًا يا خالد" });
  assert.equal(result.sent, false, "opening WhatsApp is not sending");
  assert.equal(result.link, waLink("+973 3300 1234", "أهلًا يا خالد"));
  // wa.me needs digits only.
  assert.match(result.link, /^https:\/\/wa\.me\/97333001234\?text=/);
  assert.equal(result.link.includes("+"), false);
  assert.equal(resolveProvider({}).id, "manual", "manual is the default");
});

test("the cloud provider reports what it is missing instead of pretending", async () => {
  const { cloudProvider, resolveProvider } = await import("../../src/features/whatsapp/provider.ts");
  const unconfigured = await cloudProvider({}).send({ to: "+97333001234", body: "x" });
  assert.equal(unconfigured.sent, false);
  assert.match(unconfigured.error, /not configured/);

  const configured = await cloudProvider({ token: "t", phoneNumberId: "p" }).send({ to: "+97333001234", body: "x" });
  assert.equal(configured.sent, false, "it does not claim to send what it cannot");
  assert.match(configured.error, /approved template/);
  assert.equal(resolveProvider({ WHATSAPP_PROVIDER: "cloud" }).id, "cloud");
});

test("the message a guest receives is the template for its purpose, in its language", async () => {
  const { composeMessage } = await import("../../src/features/whatsapp/provider.ts");
  const invite = composeMessage({
    purpose: "invite",
    locale: "ar",
    variables: { guest_name: "خالد", groom: "خالد", bride: "نور", link: "https://x/i/t" },
  });
  assert.match(invite, /أهلًا يا خالد/);
  assert.match(invite, /https:\/\/x\/i\/t/);

  const reminderEn = composeMessage({
    purpose: "reminder",
    locale: "en",
    variables: { guest_name: "Khalid", date: "14 February", link: "https://x/i/t" },
  });
  assert.match(reminderEn, /gentle reminder/);
  assert.notEqual(invite, reminderEn, "the purposes are different messages");

  // An override wins, and an empty one does not.
  const overridden = composeMessage({
    purpose: "invite",
    locale: "ar",
    variables: { guest_name: "خالد", link: "L" },
    overrides: { invite: { ar: "رسالتي: {guest_name} {link}" } },
  });
  assert.equal(overridden, "رسالتي: خالد L");
});
