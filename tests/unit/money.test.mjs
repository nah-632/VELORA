/**
 * Money arithmetic — the numbers a customer is charged.
 *
 * Run: npm test   (node --test tests/unit)
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  formatMoney,
  fromMajorUnits,
  multiplyFils,
  parseMoneyInput,
  percentOf,
  stripBidi,
  sumFils,
  toMajorUnits,
  assertFils,
} from "../../src/lib/money.ts";

test("fils are integers and nothing else", () => {
  assert.equal(assertFils(1234), 1234);
  assert.throws(() => assertFils(12.5), TypeError);
  assert.throws(() => assertFils(Number.NaN), TypeError);
  assert.throws(() => fromMajorUnits(0.0005), RangeError);
});

test("major/minor conversion is exact for realistic amounts", () => {
  assert.equal(fromMajorUnits(12), 12_000);
  assert.equal(fromMajorUnits(0.75), 750);
  assert.equal(toMajorUnits(750), 0.75);
  assert.equal(fromMajorUnits(1.234), 1234);
});

test("sum and multiply stay integral", () => {
  assert.equal(sumFils([1000, 250, 5]), 1255);
  assert.equal(sumFils([]), 0);
  assert.equal(multiplyFils(2500, 3), 7500);
  assert.throws(() => multiplyFils(2500, -1), RangeError);
});

test("percentage rounds half away from zero, on both signs", () => {
  // 12.5% of 100 fils = 12.5 -> 13 (up)
  assert.equal(percentOf(100, 1250), 13);
  // 12.5% of -100 fils = -12.5 -> -13 (away from zero, not toward it)
  assert.equal(percentOf(-100, 1250), -13);
  assert.equal(percentOf(1000, 500), 50);
  assert.equal(percentOf(1000, 0), 0);
  assert.equal(percentOf(14_550, 1000), 1455);
});

test("percentage is exact where a float implementation drifts", () => {
  // 10.05% of 19.99 BHD. A naive (0.1005 * 19.99) drifts in binary floating point.
  assert.equal(percentOf(19_990, 1005), 2009);
  for (const fils of [1, 7, 999, 100_000, 999_999]) {
    for (const bp of [1, 33, 250, 1250, 7500, 10_000]) {
      assert.equal(Number.isInteger(percentOf(fils, bp)), true);
    }
  }
});

test("formatted money uses Latin digits and carries no bidi control characters", () => {
  const en = formatMoney(12_345, "en");
  const ar = formatMoney(12_345, "ar");
  assert.match(en, /12\.345|12,345/);
  for (const value of [en, ar]) {
    assert.equal(/[\u0660-\u0669]/.test(value), false, `Arabic-Indic digits leaked: ${value}`);
    assert.equal(/[\u200E\u200F\u061C]/.test(value), false, `bidi control leaked: ${value}`);
    assert.equal(value.includes("\u060C"), false, `Arabic comma leaked: ${value}`);
  }
});

test("stripBidi removes only the marks it means to", () => {
  assert.equal(stripBidi("02/11\u200f, 20:26"), "02/11, 20:26");
  assert.equal(stripBidi("\u200e1\u061c2"), "12");
  assert.equal(stripBidi("قصتك، بتوقيع"), "قصتك, بتوقيع");
});

test("operator input parses to fils, or returns null to become a field error", () => {
  assert.equal(parseMoneyInput("12"), 12_000);
  assert.equal(parseMoneyInput("12.5"), 12_500);
  assert.equal(parseMoneyInput("12.345"), 12_345);
  assert.equal(parseMoneyInput("1,234.567"), 1_234_567);
  assert.equal(parseMoneyInput("1.234,567"), 1_234_567);
  assert.equal(parseMoneyInput("\u0661\u0662\u0663"), 123_000);
  assert.equal(parseMoneyInput("  7  "), 7000);
  assert.equal(parseMoneyInput(""), null);
  assert.equal(parseMoneyInput("abc"), null);
  assert.equal(parseMoneyInput("1.2345"), null, "more precision than the currency has");
  assert.equal(parseMoneyInput("1.2.3"), null);
});

test("a price round-trips through display without losing a fil", () => {
  for (const fils of [0, 1, 999, 1000, 12_345, 987_654_321]) {
    assert.equal(parseMoneyInput(toMajorUnits(fils).toFixed(3)), fils);
  }
});
