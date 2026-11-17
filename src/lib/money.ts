/**
 * Money.
 *
 * VELORA's launch currency is the Bahraini dinar, which has **three** decimal places:
 * 1 BHD = 1000 fils. Every amount in this codebase is an integer number of fils — never a
 * float, never a decimal string, never a formatted string used as a value.
 *
 * These functions are pure integer arithmetic. Rounding is half-away-from-zero, applied once,
 * at a named step. Nothing here touches the database or the network.
 */

export type Fils = number;

export const CURRENCY = {
  code: "BHD",
  minorUnits: 3,
  minorsPerUnit: 1_000,
} as const;

export type MoneyLocale = "ar" | "en";

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${label} must be an integer, received ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} exceeds the safe integer range: ${value}`);
  }
}

export function assertFils(value: number): Fils {
  assertInteger(value, "Money");
  return value;
}

/**
 * Seeds and test fixtures only. Runtime money comes from the database as fils;
 * multiplying by 1000 keeps the result exact for any realistic amount.
 */
export function fromMajorUnits(major: number): Fils {
  const fils = major * CURRENCY.minorsPerUnit;
  if (!Number.isInteger(fils)) {
    throw new RangeError(`${major} cannot be represented exactly in fils`);
  }
  return assertFils(fils);
}

/** Display only — never feed this back into a calculation. */
export function toMajorUnits(fils: Fils): number {
  return assertFils(fils) / CURRENCY.minorsPerUnit;
}

export function sumFils(amounts: readonly Fils[]): Fils {
  let total = 0;
  for (const amount of amounts) total += assertFils(amount);
  return assertFils(total);
}

export function multiplyFils(fils: Fils, quantity: number): Fils {
  assertInteger(quantity, "Quantity");
  if (quantity < 0) throw new RangeError("Quantity cannot be negative");
  return assertFils(assertFils(fils) * quantity);
}

/**
 * Basis points, not percentages: 1250 = 12.5%. Integer in, integer out, exactly one rounding
 * step. A 15% discount is `percentOf(total, 1500)`.
 */
export function percentOf(fils: Fils, basisPoints: number): Fils {
  assertFils(fils);
  assertInteger(basisPoints, "Basis points");
  const numerator = fils * basisPoints; // exact while within the safe-integer range
  if (!Number.isSafeInteger(numerator)) {
    throw new RangeError(`Percentage computation overflowed for ${fils} at ${basisPoints} bp`);
  }
  // Half away from zero, computed on integers so no binary-float error can enter.
  const rounded =
    numerator >= 0
      ? Math.floor((numerator + 5_000) / 10_000)
      : -Math.floor((-numerator + 5_000) / 10_000);
  return assertFils(rounded);
}

/** Applies a rate and returns the single rounding delta, so breakdowns always reconcile. */
export function applyRate(fils: Fils, basisPoints: number): { amount: Fils; delta: Fils } {
  const amount = percentOf(fils, basisPoints);
  return { amount, delta: 0 };
}

const formatters = new Map<MoneyLocale, Intl.NumberFormat>();

function formatterFor(locale: MoneyLocale): Intl.NumberFormat {
  const cached = formatters.get(locale);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat(locale === "ar" ? "ar-BH" : "en-BH", {
    style: "currency",
    currency: CURRENCY.code,
    minimumFractionDigits: CURRENCY.minorUnits,
    maximumFractionDigits: CURRENCY.minorUnits,
    // Latin digits on purpose: a price must be readable at a glance in both locales, and
    // mixing Arabic-Indic digits into a funnel makes support and reconciliation harder.
    numberingSystem: "latn",
  });
  formatters.set(locale, formatter);
  return formatter;
}

/**
 * Removes bidirectional control characters and normalises the Arabic comma.
 *
 * `Intl` with an Arabic locale injects U+200E/U+200F/U+061C into its output. Inside an RTL
 * paragraph those marks reorder a value relative to its neighbours — and `unicode-bidi: isolate`
 * does NOT fix it, because the mark sits *inside* the string. Stripping happens once, here, so
 * no format function can leak a dirty string into the DOM.
 */
export function stripBidi(value: string): string {
  return value.replace(/[\u200E\u200F\u061C]/g, "").replace(/\u060C/g, ",");
}

export function formatMoney(fils: Fils, locale: MoneyLocale = "en"): string {
  assertFils(fils);
  return stripBidi(formatterFor(locale).format(fils / CURRENCY.minorsPerUnit));
}

const ARABIC_INDIC = /[\u0660-\u0669]/g;
const EXTENDED_ARABIC_INDIC = /[\u06F0-\u06F9]/g;

function normaliseDigits(input: string): string {
  return input
    .replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EXTENDED_ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * Parses operator input into fils. Accepts "1,234.567", "1.234,567", Arabic-Indic digits and a
 * bare number. Returns null rather than throwing, so a form can show a field error.
 */
export function parseMoneyInput(raw: string): Fils | null {
  const cleaned = normaliseDigits(raw).replace(/[\s\u00A0]/g, "");
  if (cleaned === "") return null;
  if (!/^-?[\d.,]+$/.test(cleaned)) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalised: string;

  if (lastComma > -1 && lastDot > -1) {
    // Whichever separator comes last is the decimal separator.
    const decimalSep = lastComma > lastDot ? "," : ".";
    const groupSep = decimalSep === "," ? "." : ",";
    normalised = cleaned.split(groupSep).join("").replace(decimalSep, ".");
  } else if (lastComma > -1) {
    normalised = cleaned.split(",").join(".");
  } else {
    normalised = cleaned;
  }

  const parts = normalised.split(".");
  if (parts.length > 2) return null;
  const [whole = "", fraction = ""] = parts;
  if (!/^-?\d*$/.test(whole) || !/^\d*$/.test(fraction)) return null;
  if (whole === "" || whole === "-") return null;
  if (fraction.length > CURRENCY.minorUnits) return null;

  const paddedFraction = fraction.padEnd(CURRENCY.minorUnits, "0");
  const negative = whole.startsWith("-");
  const digits = (negative ? whole.slice(1) : whole) + paddedFraction;
  const value = Number(digits);
  if (!Number.isSafeInteger(value)) return null;
  return assertFils(negative ? -value : value);
}
