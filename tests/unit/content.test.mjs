/**
 * Invitation content — the split between what can be *stored* and what can be *ordered*.
 *
 * This distinction was found the hard way: the first version validated format on save, so a
 * customer who had typed their names and not yet chosen a date could not save at all — which is
 * exactly when autosave matters most. The storage schema is now permissive, and order readiness
 * is a separate question asked by `validateContent`.
 *
 * Run: npm test
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY_CONTENT,
  InvitationContentSchema,
  isComplete,
  normaliseBahrainPhone,
  parseContent,
  validateContent,
} from "../../src/features/studio/content.ts";

test("a half-filled draft can be stored", () => {
  const result = InvitationContentSchema.safeParse({ brideName: "فاطمة" });
  assert.equal(result.success, true, "a draft in progress must be saveable");
  assert.equal(result.data.brideName, "فاطمة");
  assert.equal(result.data.weddingDate, "", "missing optional fields fall back to empty");
});

test("an entirely empty draft can be stored", () => {
  const result = InvitationContentSchema.safeParse({});
  assert.equal(result.success, true);
  assert.deepEqual(result.data, EMPTY_CONTENT);
});

test("a partially typed date or link does not block saving", () => {
  const result = InvitationContentSchema.safeParse({
    weddingDate: "2027-0",
    mapUrl: "https://maps.goo",
    weddingTime: "19:",
  });
  assert.equal(result.success, true, "mid-typing state must be storable");
});

test("but order readiness is judged strictly", () => {
  const issues = validateContent(EMPTY_CONTENT);
  const fields = issues.map((issue) => issue.field).sort();
  assert.deepEqual(fields, ["brideName", "groomName", "venueName", "weddingDate"]);
  assert.equal(isComplete(EMPTY_CONTENT), false);
});

test("a malformed date is reported even when other required fields are present", () => {
  const issues = validateContent({
    ...EMPTY_CONTENT,
    brideName: "أ",
    groomName: "ب",
    venueName: "ج",
    weddingDate: "31/12/2027",
  });
  assert.deepEqual(
    issues.map((issue) => [issue.field, issue.reason]),
    [["weddingDate", "date"]],
  );
});

test("a date that looks right but does not exist is refused", () => {
  const issues = validateContent({ ...EMPTY_CONTENT, weddingDate: "2027-02-31" });
  assert.equal(issues.some((issue) => issue.field === "weddingDate"), true);
});

test("a valid, complete invitation reports nothing", () => {
  const content = {
    ...EMPTY_CONTENT,
    brideName: "فاطمة الزياني",
    groomName: "محمد العلوي",
    weddingDate: "2027-03-12",
    weddingTime: "19:30",
    venueName: "قصر البحرين",
    mapUrl: "https://maps.google.com/?q=1",
  };
  assert.deepEqual(validateContent(content), []);
  assert.equal(isComplete(content), true);
});

test("a link without a protocol is refused, and an empty one is not", () => {
  assert.equal(
    validateContent({ ...EMPTY_CONTENT, mapUrl: "maps.google.com" }).some(
      (issue) => issue.field === "mapUrl",
    ),
    true,
  );
  assert.equal(
    validateContent({ ...EMPTY_CONTENT, mapUrl: "" }).some((issue) => issue.field === "mapUrl"),
    false,
  );
});

test("a stored draft that predates a new field still opens", () => {
  const old = { brideName: "فاطمة", groomName: "محمد" };
  const parsed = parseContent(old);
  assert.equal(parsed.brideName, "فاطمة");
  assert.equal(parsed.photographs.length, 0, "the new field arrived with its default");
  assert.equal(parsed.notes, "");
});

test("Bahraini numbers normalise to one shape", () => {
  assert.equal(normaliseBahrainPhone("36123456"), "+97336123456");
  assert.equal(normaliseBahrainPhone("+973 3612 3456"), "+97336123456");
  assert.equal(normaliseBahrainPhone("00973 3612 3456"), "+97336123456");
  assert.equal(normaliseBahrainPhone("97336123456"), "+97336123456");
  assert.equal(normaliseBahrainPhone("123"), null);
  assert.equal(normaliseBahrainPhone("not a number"), null);
});
