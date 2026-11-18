/**
 * Blocks — what the renderer is handed, and what happens when fields are empty.
 *
 * The brief requires "a reliable preview state even when optional fields are empty". Most
 * customers fill in the names first and everything else later, so the empty cases are the common
 * path, not the edge case. A stray separator, an "Invalid Date", or a dangling "and" would all be
 * seen by nearly everyone.
 *
 * Run: npm test
 */
import test from "node:test";
import assert from "node:assert/strict";

import { EMPTY_CONTENT } from "../../src/features/studio/content.ts";
import {
  blocksFromContent,
  blocksFromPreview,
  fallbackBlocks,
} from "../../src/features/studio/blocks.ts";

test("names only — no details, no message, and nothing dangling", () => {
  const blocks = blocksFromContent(
    { ...EMPTY_CONTENT, brideName: "فاطمة", groomName: "محمد" },
    "ar",
  );
  assert.equal(blocks.names, "فاطمة و محمد");
  assert.deepEqual(blocks.details, [], "no line is produced for a field nobody filled in");
  assert.equal(blocks.message, undefined);
  assert.equal(blocks.verse, undefined);
  assert.equal(blocks.footer.length > 0, true);
});

test("one name only does not leave a dangling conjunction", () => {
  const blocks = blocksFromContent({ ...EMPTY_CONTENT, brideName: "فاطمة" }, "ar");
  assert.equal(blocks.names, "فاطمة");
  assert.equal(blocks.names.includes(" و "), false);
});

test("no names at all falls back to a placeholder rather than an empty canvas", () => {
  const arabic = blocksFromContent(EMPTY_CONTENT, "ar");
  const english = blocksFromContent(EMPTY_CONTENT, "en");
  assert.equal(arabic.names, "الأسماء");
  assert.equal(english.names, "Names");
});

test("a full invitation collects its details in order, one line each", () => {
  const blocks = blocksFromContent(
    {
      ...EMPTY_CONTENT,
      brideName: "فاطمة",
      groomName: "محمد",
      weddingDate: "2027-03-12",
      hijriDate: "٣ رمضان ١٤٤٨",
      weddingTime: "19:30",
      venueName: "قصر البحرين",
      venueAddress: "المنامة",
    },
    "ar",
  );
  assert.equal(blocks.details.length, 4, JSON.stringify(blocks.details));
  assert.match(blocks.details[0], /2027/);
  assert.equal(blocks.details[1], "٣ رمضان ١٤٤٨");
  assert.equal(blocks.details[2], "19:30");
  assert.equal(blocks.details[3], "قصر البحرين — المنامة");
});

test("a venue without an address is one line, not a line ending in a dash", () => {
  const blocks = blocksFromContent({ ...EMPTY_CONTENT, venueName: "قصر البحرين" }, "ar");
  assert.deepEqual(blocks.details, ["قصر البحرين"]);
});

test("an address without a venue is not shown as a location", () => {
  const blocks = blocksFromContent({ ...EMPTY_CONTENT, venueAddress: "المنامة" }, "ar");
  assert.deepEqual(blocks.details, [], "an address alone does not identify a place");
});

test("a half-typed date produces no line at all, never 'Invalid Date'", () => {
  for (const weddingDate of ["2027-0", "2027-02-31", "", "not a date"]) {
    const blocks = blocksFromContent({ ...EMPTY_CONTENT, weddingDate }, "ar");
    assert.deepEqual(blocks.details, [], `date "${weddingDate}" leaked into the canvas`);
  }
});

test("the date is formatted for the customer, with Latin digits in both languages", () => {
  const arabic = blocksFromContent({ ...EMPTY_CONTENT, weddingDate: "2027-03-12" }, "ar");
  const english = blocksFromContent({ ...EMPTY_CONTENT, weddingDate: "2027-03-12" }, "en");
  assert.match(arabic.details[0], /2027/);
  assert.match(english.details[0], /2027/);
  assert.equal(/[٠-٩]/.test(arabic.details[0]), false, "Arabic-Indic digits are not used for dates");
});

test("the catalogue's sample wording becomes the same block shape", () => {
  const preview = {
    eyebrow: { ar: "دعوة زفاف", en: "Wedding Invitation" },
    names: { ar: "اسم العروس واسم العريس", en: "Bride and Groom" },
    footer: { ar: "مملكة البحرين", en: "Kingdom of Bahrain" },
  };
  const arabic = blocksFromPreview(preview, "ar");
  const english = blocksFromPreview(preview, "en");
  assert.equal(arabic.eyebrow, "دعوة زفاف");
  assert.equal(english.names, "Bride and Groom");
  assert.deepEqual(arabic.details, []);
  assert.deepEqual(Object.keys(arabic).sort(), Object.keys(english).sort());
});

test("the fallback keeps the canvas from rendering an empty card", () => {
  assert.equal(fallbackBlocks("ar").names.length > 0, true);
  assert.equal(fallbackBlocks("en").names.length > 0, true);
});
