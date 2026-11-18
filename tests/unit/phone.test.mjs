/**
 * Phone normalisation and guest-list parsing — the two pieces that decide whether an operator's
 * list becomes invitations or becomes an afternoon of corrections.
 *
 * Run: npm test
 */
import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_COUNTRY, formatPhone, normalizePhone, toWesternDigits } from "../../src/lib/phone.ts";
import { parseGuestList } from "../../src/features/guests/import.ts";

test("a Bahraini mobile in any of the forms an operator writes it", () => {
  const expected = "+97333001234";
  for (const input of [
    "+97333001234",
    "+973 3300 1234",
    "+973-3300-1234",
    "0097333001234",
    "97333001234",
    "33001234",
    "3 300 1234",
    "  +973 (3300) 1234  ",
  ]) {
    const result = normalizePhone(input);
    assert.equal(result.ok, true, `${input} should be accepted`);
    assert.equal(result.ok && result.e164, expected, input);
  }
});

test("Arabic-Indic digits, because WhatsApp is where these lists are written", () => {
  const result = normalizePhone("+٩٧٣ ٣٣٠٠ ١٢٣٤");
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.e164, "+97333001234");
  // Eastern Arabic-Indic (Persian) digits arrive from some keyboards too.
  assert.equal(toWesternDigits("۰۱۲۳۴۵۶۷۸۹"), "0123456789");
  assert.equal(normalizePhone("٠٠٩٧٣٣٣٠٠١٢٣٤").ok && normalizePhone("٠٠٩٧٣٣٣٠٠١٢٣٤").e164, "+97333001234");
});

test("invisible characters do not survive the copy-paste", () => {
  // RTL marks and non-breaking spaces ride along with text lifted out of a chat.
  assert.equal(normalizePhone("\u200f+973\u00a033001234").ok, true);
  assert.equal(
    normalizePhone("\u200f+973\u00a033001234").ok && normalizePhone("\u200f+973\u00a033001234").e164,
    "+97333001234",
  );
});

test("the other GCC countries this operator will actually message", () => {
  const cases = [
    ["+966512345678", "+966512345678", "Saudi Arabia"],
    ["0551234567", "+966551234567", "Saudi Arabia"],
    ["+96512345678", "+96512345678", "Kuwait"],
    ["+97412345678", "+97412345678", "Qatar"],
    ["+971501234567", "+971501234567", "United Arab Emirates"],
    ["+96812345678", "+96812345678", "Oman"],
  ];
  for (const [input, expected, country] of cases) {
    const result = input.startsWith("05")
      ? normalizePhone(input, { defaultCountry: "966" })
      : normalizePhone(input);
    assert.equal(result.ok, true, `${input} (${country})`);
    assert.equal(result.ok && result.e164, expected, input);
  }
});

test("the default country is a parameter, not a hard-coded assumption", () => {
  assert.equal(normalizePhone("33001234").ok && normalizePhone("33001234").country.code, "973");
  assert.equal(
    normalizePhone("501234567", { defaultCountry: "971" }).ok &&
      normalizePhone("501234567", { defaultCountry: "971" }).e164,
    "+971501234567",
  );
  assert.equal(DEFAULT_COUNTRY, "973");
});

test("what must be refused, and why", () => {
  assert.equal(normalizePhone("").reason, "empty");
  assert.equal(normalizePhone("   ").reason, "empty");
  assert.equal(normalizePhone("not a phone").reason, "not_a_number");
  // Two different mistakes, told apart on purpose.
  assert.equal(normalizePhone("+1 555 0100").reason, "unsupported_country");
  assert.equal(normalizePhone("+9733300").reason, "wrong_length");
  assert.equal(normalizePhone("1234567890123456789").reason, "wrong_length");
  const failure = normalizePhone("+9733300");
  assert.equal(failure.ok, false);
  // The message names what was expected, because the operator has to fix it by hand.
  assert.match(failure.ok ? "" : failure.detail, /expects 8 digits, got 4/);
});

test("formatting is grouping only — never a reformat", () => {
  assert.equal(formatPhone("+97333001234"), "+973 3300 1234");
  assert.equal(formatPhone("+966512345678"), "+966 512 345 678");
  assert.equal(formatPhone("+973330012"), "+973330012");
});

test("a pasted list with a header in either language", () => {
  const english = parseGuestList("Name\tPhone\tCategory\tCompanions\nKhalid\t33001234\tfamily\t3");
  assert.equal(english.guests.length, 1);
  assert.equal(english.rejected.length, 0);
  assert.equal(english.guests[0].phone, "+97333001234");
  assert.equal(english.guests[0].category, "family");
  assert.equal(english.guests[0].maxCompanions, 3);

  const arabic = parseGuestList("الاسم,الجوال,الفئة,المرافقون\nخالد,+97333001234,عمل,2");
  assert.equal(arabic.guests.length, 1);
  assert.equal(arabic.guests[0].fullName, "خالد");
  assert.equal(arabic.guests[0].category, "work");
  assert.equal(arabic.guests[0].maxCompanions, 2);
});

test("a list with no header falls back to name then phone", () => {
  const result = parseGuestList("Khalid Ali\t33001234\nNoor\t3300 5678");
  assert.equal(result.guests.length, 2);
  assert.equal(result.guests[0].fullName, "Khalid Ali");
  assert.equal(result.guests[0].phone, "+97333001234");
  assert.equal(result.guests[1].phone, "+97333005678");
  assert.equal(result.guests[0].category, "other");
});

test("one bad row never destroys the import", () => {
  const result = parseGuestList(
    [
      "Name\tPhone",
      "Khalid\t33001234",
      "Noor\tnot-a-number",
      "\t33009999",
      "Salman\t33008888",
    ].join("\n"),
  );
  assert.equal(result.guests.length, 2, "the two good rows survive");
  assert.equal(result.rejected.length, 2);
  // Line numbers refer to the text that was pasted, header included.
  assert.deepEqual(
    result.rejected.map((row) => [row.line, row.reason]),
    [[3, "Not a number."], [4, "no name"]],
  );
});

test("duplicates are reported, never silently merged", () => {
  const result = parseGuestList("Name\tPhone\nKhalid\t33001234\nKhalid again\t+973 3300 1234\nNoor\t33005678");
  assert.equal(result.guests.length, 3, "both rows are kept: the operator decides");
  assert.deepEqual(result.duplicates, [{ line: 3, phone: "+97333001234", firstLine: 2 }]);
});

test("personal lines and companions survive the trip, with limits enforced", () => {
  const long = "x".repeat(200);
  const result = parseGuestList(
    ["Name\tPhone\tPersonal_line_ar\tPersonal_line_en", `خالد\t33001234\tإلى عمّنا العزيز\t${long}`].join("\n"),
  );
  assert.equal(result.guests[0].personalLineAr, "إلى عمّنا العزيز");
  // 140 is the database's limit; the importer truncates rather than rejecting the row.
  assert.equal(result.guests[0].personalLineEn.length, 140);

  const companions = parseGuestList("Name\tPhone\tCompanions\nKhalid\t33001234\t99");
  assert.equal(companions.guests[0].maxCompanions, 20, "capped at the schema's maximum");
  const negative = parseGuestList("Name\tPhone\tCompanions\nKhalid\t33001234\tnone");
  assert.equal(negative.guests[0].maxCompanions, 0);
});

test("quoted fields with commas inside them", () => {
  const result = parseGuestList('Name,Phone\n"Ali, and family",33001234');
  assert.equal(result.guests.length, 1);
  assert.equal(result.guests[0].fullName, "Ali, and family");
});

test("fifty guests in one paste — the acceptance criterion's shape", () => {
  const rows = ["Name\tPhone"];
  for (let i = 0; i < 50; i += 1) rows.push(`Guest ${i}\t3300${String(1000 + i)}`);
  const result = parseGuestList(rows.join("\n"));
  assert.equal(result.guests.length, 50);
  assert.equal(result.rejected.length, 0);
  assert.equal(new Set(result.guests.map((g) => g.phone)).size, 50);
});
