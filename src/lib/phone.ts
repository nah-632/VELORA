/**
 * Guest phone numbers, normalised to E.164.
 *
 * This is small and it is load-bearing: a link sent to a mistyped number is an invitation that
 * never arrived, and the operator will not notice until somebody does not come. So the rules are
 * explicit, the failures are named, and nothing is silently "fixed".
 *
 * What it accepts, because this is what a Bahraini operator actually pastes:
 *
 *   +973 3300 1234      international, with spaces
 *   +973-3300-1234      with dashes
 *   00973 33001234      the other international prefix, used across the Gulf
 *   97333001234         country code without a plus
 *   33001234            8 digits, no code → the default country (+973)
 *   ٠٠٩٧٣٣٣٠٠١٢٣٤       Arabic-Indic digits, + RTL marks, copy-pasted from WhatsApp
 *
 * What it refuses: anything that does not end up being a plausible number, and any country the
 * operator cannot plausibly be messaging. A refusal carries a reason a human can act on.
 *
 * The digits are stored as written, in Latin: the number is an identifier, not a sentence to be
 * rendered in the reader's numerals.
 */
import { z } from "zod";

/** The six GCC states, with the national-number length that follows each country code. */
export const GCC_COUNTRIES = {
  "973": { code: "973", name: "Bahrain", localLength: 8 },
  "966": { code: "966", name: "Saudi Arabia", localLength: 9 },
  "965": { code: "965", name: "Kuwait", localLength: 8 },
  "974": { code: "974", name: "Qatar", localLength: 8 },
  "971": { code: "971", name: "United Arab Emirates", localLength: 9 },
  "968": { code: "968", name: "Oman", localLength: 8 },
} as const;

export type GccCode = keyof typeof GCC_COUNTRIES;

export const DEFAULT_COUNTRY: GccCode = "973";

/**
 * Four ways to fail, and no fifth.
 *
 * An earlier version also had an "ambiguous" case for numbers that were neither clearly one country
 * nor clearly another. It was reachable only from one branch, said nothing the operator could act
 * on, and would have drifted out of sync with reality the first time a rule changed — so the
 * numbers that used to land there are reported as what they are: the wrong length.
 */
export type PhoneFailure =
  | "empty"
  | "not_a_number"
  | "unsupported_country"
  | "wrong_length";

export type PhoneResult =
  | { ok: true; e164: string; country: (typeof GCC_COUNTRIES)[GccCode]; national: string }
  | { ok: false; reason: PhoneFailure; detail: string };

/**
 * Arabic-Indic (٠١٢٣…) and Eastern Arabic-Indic (۰۱۲۳…) digits, plus the direction marks and
 * non-breaking spaces that come along with text copied out of WhatsApp.
 */
const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

export function toWesternDigits(input: string): string {
  let out = "";
  for (const char of input) {
    const indic = ARABIC_INDIC.indexOf(char);
    const eastern = EASTERN_ARABIC_INDIC.indexOf(char);
    if (indic >= 0) out += String(indic);
    else if (eastern >= 0) out += String(eastern);
    else out += char;
  }
  return out;
}

/** Everything that is not a digit or a leading plus: spaces, dashes, brackets, RTL marks. */
function stripFormatting(input: string): string {
  return input
    .replace(/[\u200e\u200f\u061c\u202a-\u202e]/g, "")
    .replace(/\u00a0/g, " ")
    .trim();
}

export function normalizePhone(
  input: string,
  options: { defaultCountry?: GccCode } = {},
): PhoneResult {
  const defaultCountry = options.defaultCountry ?? DEFAULT_COUNTRY;
  const raw = stripFormatting(input ?? "");

  if (!raw) return { ok: false, reason: "empty", detail: "no number given" };

  let digits = toWesternDigits(raw).replace(/[^\d+]/g, "");
  /**
   * An explicit international prefix is a claim about the number, and it is honoured: if it does
   * not name a GCC country, the number is refused rather than reinterpreted.
   *
   * Without this, "+1 555 0100" has ten digits and ends in eight that look like a Bahraini mobile,
   * so it became +97315550100 — an invitation sent to a stranger in Bahrain, from an operator who
   * had just pasted a number from somewhere else. The first version of this function did exactly
   * that, and the test that caught it is in tests/unit/phone.test.mjs.
   */
  let international = false;

  if (digits.startsWith("+")) {
    digits = digits.slice(1);
    international = true;
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
    international = true;
  } else if (digits.startsWith("0")) {
    // A national trunk prefix (KSA writes 05x…). The country's own code replaces it.
    digits = digits.replace(/^0+/, "");
  }

  if (!/^\d+$/.test(digits) || digits.length === 0) {
    return { ok: false, reason: "not_a_number", detail: `"${input}" contains no digits` };
  }

  // Which country? Longest match first, so 973 is not shadowed by a shorter code.
  const codes = Object.keys(GCC_COUNTRIES).sort((a, b) => b.length - a.length) as GccCode[];
  let matched: GccCode | null = null;
  for (const code of codes) {
    if (digits.startsWith(code)) {
      const national = digits.slice(code.length);
      // Only treat it as a country code when what follows could be that country's national number.
      if (national.length === GCC_COUNTRIES[code].localLength) {
        matched = code;
        break;
      }
    }
  }

  if (international && !matched) {
    // "Truncated" and "from somewhere else" are different mistakes and the operator is told which
    // one they made: +9733300 is a Bahraini number with digits missing, +15550100 is not a Gulf
    // number at all.
    const looksGcc = codes.find((code) => digits.startsWith(code));
    return looksGcc
      ? {
          ok: false,
          reason: "wrong_length",
          detail: `+${looksGcc} expects ${GCC_COUNTRIES[looksGcc].localLength} digits, got ${digits.length - looksGcc.length}`,
        }
      : {
          ok: false,
          reason: "unsupported_country",
          detail: `+${digits} is an international number outside the GCC`,
        };
  }

  const country: GccCode = matched ?? defaultCountry;
  const national = matched
    ? digits.slice(country.length)
    : digits.slice(-GCC_COUNTRIES[country].localLength);

  const expected = GCC_COUNTRIES[country].localLength;
  if (!matched && digits.length > expected + 3) {
    // A bare number far longer than any Gulf one: digits were pasted from somewhere else, or a
    // stray digit was typed. Truncating it to the last eight would send an invitation to a
    // stranger, so it is refused.
    return {
      ok: false,
      reason: "wrong_length",
      detail: `${digits.length} digits is longer than any GCC number (${country} expects ${expected})`,
    };
  }

  if (national.length !== expected) {
    return {
      ok: false,
      reason: "wrong_length",
      detail: `${country} expects ${expected} digits after the country code, got ${national.length}`,
    };
  }

  return {
    ok: true,
    e164: `+${country}${national}`,
    country: GCC_COUNTRIES[country],
    national,
  };
}

/** For the importer: the same rules, but named for what the operator sees. */
export function phoneErrorText(result: Extract<PhoneResult, { ok: false }>): string {
  switch (result.reason) {
    case "empty":
      return "No number.";
    case "not_a_number":
      return "Not a number.";
    case "unsupported_country":
      return "Not a GCC number.";
    case "wrong_length":
      return "Too many digits.";
    default:
      return result.detail;
  }
}

const E164 = /^\+[1-9]\d{6,14}$/;

export const E164Schema = z.string().regex(E164, "expected an E.164 number");

/**
 * The display form the operator reads: +973 3300 1234.
 *
 * Grouping only, and only when the national part is exactly the length that country uses. An
 * earlier version fell back to "group any three digits then the rest", which turned a truncated
 * number into something that *looked* correctly formatted — the most dangerous kind of display bug
 * in a list of 50 phone numbers.
 */
export function formatPhone(e164: string): string {
  const digits = e164.replace(/[^\d]/g, "");
  const codes = Object.keys(GCC_COUNTRIES).sort((a, b) => b.length - a.length) as GccCode[];
  for (const code of codes) {
    if (!digits.startsWith(code)) continue;
    const national = digits.slice(code.length);
    if (national.length !== GCC_COUNTRIES[code].localLength) continue;
    if (national.length === 8) return `+${code} ${national.slice(0, 4)} ${national.slice(4)}`;
    return `+${code} ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
  }
  return e164;
}
