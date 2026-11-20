/**
 * Turning what the operator pastes into guests.
 *
 * The brief's acceptance criterion is "import 50 guests from Excel, generate links, and send via
 * manual WhatsApp in under 10 minutes". Ten minutes is the real requirement: if the importer makes
 * the operator fix rows one at a time, the number is unachievable no matter how correct the code is.
 *
 * So the design is: **parse everything, reject nothing, report precisely.** A row that cannot be
 * understood comes back with its line number and a reason, next to the rows that worked. An import
 * is never all-or-nothing, because re-doing 50 rows because one had a typo is the thing that wastes
 * the ten minutes.
 *
 * The input is whatever a spreadsheet produces: tab-separated on paste, comma-separated from a CSV,
 * optionally with a header row, optionally with a category, companions and personal lines.
 *
 * Columns are found by header name when there is a header (Arabic or English), and by position when
 * there is not (name, phone, then optional category and companions). Duplicate phone numbers within
 * one import are reported rather than silently merged: the operator decides.
 */
import { normalizePhone, phoneErrorText, type GccCode, type PhoneResult } from "@/lib/phone";

export const GUEST_CATEGORIES = ["family", "friends", "work", "other"] as const;
export type GuestCategory = (typeof GUEST_CATEGORIES)[number];

export type GuestGender = "male" | "female" | "neutral";
export type GuestAudience = "women" | "men" | "both";

export interface ParsedGuest {
  line: number;
  fullName: string;
  phone: string;
  category: GuestCategory;
  maxCompanions: number;
  personalLineAr: string | null;
  personalLineEn: string | null;
  gender: GuestGender;
  /** Null means "work it out from the gender", which is what most imports want. */
  audience: GuestAudience | null;
}

/** The words an operator actually writes in that column, in either language. */
const GENDER_WORDS: Record<string, GuestGender> = {
  m: "male", male: "male", man: "male", ذكر: "male", رجل: "male",
  f: "female", female: "female", woman: "female", أنثى: "female", انثى: "female", امرأة: "female", سيدة: "female",
  n: "neutral", neutral: "neutral", "": "neutral", محايد: "neutral",
};

const AUDIENCE_WORDS: Record<string, GuestAudience> = {
  women: "women", w: "women", ladies: "women", "women's": "women",
  نساء: "women", النساء: "women", "قاعة النساء": "women",
  men: "men", m: "men", gents: "men", mens: "men", رجال: "men", الرجال: "men", "قاعة الرجال": "men",
  both: "both", "": "both", الكل: "both", الاثنين: "both", together: "both",
};

export interface RejectedRow {
  line: number;
  raw: string;
  reason: string;
}

export interface ParseResult {
  guests: ParsedGuest[];
  rejected: RejectedRow[];
  duplicates: { line: number; phone: string; firstLine: number }[];
  detectedColumns: string[];
}

/** Arabic and English header names, so a spreadsheet in either language just works. */
const COLUMN_ALIASES: Record<string, string[]> = {
  name: ["name", "full name", "guest", "guest name", "الاسم", "اسم", "الاسم الكامل", "المدعو"],
  phone: ["phone", "mobile", "number", "phone number", "الجوال", "الهاتف", "الرقم", "رقم الجوال", "الموبايل"],
  category: ["category", "group", "type", "الفئة", "التصنيف", "المجموعة"],
  companions: ["companions", "max companions", "guests", "plus ones", "المرافقون", "عدد المرافقين", "مرافقين"],
  personalAr: ["personal_line_ar", "personal ar", "arabic line", "رسالة عربية", "سطر عربي"],
  personalEn: ["personal_line_en", "personal en", "english line", "رسالة إنجليزية", "سطر إنجليزي"],
  gender: ["gender", "sex", "الجنس", "التذكير والتأنيث"],
  audience: ["audience", "hall", "section", "القاعة", "الجمهور"],
};

const CATEGORY_WORDS: Record<string, GuestCategory> = {
  family: "family", "عائلة": "family", "أهل": "family", "العائلة": "family",
  friends: "friends", "أصدقاء": "friends", "اصدقاء": "friends",
  work: "work", "عمل": "work", "زملاء": "work",
  other: "other", "أخرى": "other", "اخرى": "other",
};

/**
 * Header matching that is symmetric, which the first version was not: it normalised the header but
 * compared it against aliases that still contained underscores, so `personal_line_ar` — the column
 * name the brief itself specifies — silently matched nothing and the personal lines were dropped.
 */
function cleanHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u00a0_]+/g, " ")
    .replace(/\s+/g, " ");
}

function normaliseHeader(value: string): string | null {
  const cleaned = cleanHeader(value);
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some((alias) => cleanHeader(alias) === cleaned)) return key;
  }
  return null;
}

/**
 * Lines, with the raw text preserved.
 *
 * Trimming here looked harmless and was not: a spreadsheet row whose first cell is empty pastes as
 * "\t33009999", and trimming removes the leading tab, so the phone number slides into the name
 * column. "Guest with no name" is a normal row, not an edge case, and it has to arrive intact.
 */
function splitLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);
}

function splitColumns(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((cell) => cell.trim());
  if (line.includes(";")) return line.split(";").map((cell) => cell.trim());
  // A comma only separates when it is not inside a quoted field; the importer keeps this simple and
  // documented rather than pretending to be a full CSV parser.
  const cells = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}

function unquote(value: string): string {
  return value.replace(/^"(.*)"$/s, "$1").trim();
}

export function parseGuestList(
  text: string,
  options: { defaultCountry?: GccCode } = {},
): ParseResult {
  const lines = splitLines(text ?? "");
  const rejected: RejectedRow[] = [];
  const guests: ParsedGuest[] = [];
  const duplicates: { line: number; phone: string; firstLine: number }[] = [];
  const seen = new Map<string, number>();

  if (lines.length === 0) {
    return { guests, rejected, duplicates, detectedColumns: [] };
  }

  // A header is a first row whose cells are mostly recognisable column names.
  const firstCells = splitColumns(lines[0] ?? "").map(unquote);
  const headerKeys = firstCells.map(normaliseHeader);
  const headerCount = headerKeys.filter(Boolean).length;
  const hasHeader = headerCount >= 2;

  let index: Record<string, number> = { name: 0, phone: 1, category: 2, companions: 3, personalAr: 4, personalEn: 5 };
  if (hasHeader) {
    index = {};
    headerKeys.forEach((key, position) => {
      if (key) index[key] = position;
    });
  }

  const detectedColumns = hasHeader
    ? firstCells.filter((_, position) => headerKeys[position])
    : ["name", "phone", "category", "companions"].slice(0, 2);

  const dataLines = hasHeader ? lines.slice(1) : lines;
  // The default column layout for a headerless paste: name, phone, then the optional columns in the
  // order the brief lists them, including the two new ones.
  if (!hasHeader) {
    index = { name: 0, phone: 1, category: 2, companions: 3, gender: 4, audience: 5, personalAr: 6, personalEn: 7 };
  }

  dataLines.forEach((line, offset) => {
    // Line numbers are 1-based and refer to the text the operator pasted, header included, so the
    // number in the error is the number in their spreadsheet.
    const lineNumber = offset + (hasHeader ? 2 : 1);
    const cells = splitColumns(line).map(unquote);

    const name = index.name !== undefined ? (cells[index.name] ?? "") : "";
    const phoneCell = index.phone !== undefined ? (cells[index.phone] ?? "") : "";

    if (!name && !phoneCell) {
      rejected.push({ line: lineNumber, raw: line, reason: "empty row" });
      return;
    }
    if (!name) {
      rejected.push({ line: lineNumber, raw: line, reason: "no name" });
      return;
    }

    const phone: PhoneResult = normalizePhone(phoneCell, { defaultCountry: options.defaultCountry });
    if (!phone.ok) {
      rejected.push({ line: lineNumber, raw: line, reason: phoneErrorText(phone) });
      return;
    }

    const categoryCell = index.category !== undefined ? (cells[index.category] ?? "").toLowerCase().trim() : "";
    const category: GuestCategory = CATEGORY_WORDS[categoryCell] ?? "other";

    const companionsCell = index.companions !== undefined ? (cells[index.companions] ?? "") : "";
    const companions = Number.parseInt(companionsCell.replace(/[^\d]/g, ""), 10);
    const maxCompanions = Number.isFinite(companions) ? Math.min(Math.max(companions, 0), 20) : 0;

    const trim = (value: string | undefined) => {
      const cleaned = (value ?? "").trim();
      if (!cleaned) return null;
      // The database enforces 140 characters and refuses control bytes; the importer truncates
      // rather than rejecting the whole row, and says so by leaving the value visibly cut.
      return cleaned.slice(0, 140);
    };

    const personalLineAr = index.personalAr !== undefined ? trim(cells[index.personalAr]) : null;
    const personalLineEn = index.personalEn !== undefined ? trim(cells[index.personalEn]) : null;

    const genderCell = index.gender !== undefined ? (cells[index.gender] ?? "").trim().toLowerCase() : "";
    const gender: GuestGender = GENDER_WORDS[genderCell] ?? "neutral";

    const audienceCell = index.audience !== undefined ? (cells[index.audience] ?? "").trim().toLowerCase() : "";
    // An empty audience cell is not "both": it means the operator did not say, and the gender decides.
    const audience: GuestAudience | null = audienceCell ? (AUDIENCE_WORDS[audienceCell] ?? null) : null;

    const firstLine = seen.get(phone.e164);
    if (firstLine !== undefined) {
      duplicates.push({ line: lineNumber, phone: phone.e164, firstLine });
    } else {
      seen.set(phone.e164, lineNumber);
    }

    guests.push({
      line: lineNumber,
      fullName: name,
      phone: phone.e164,
      category,
      maxCompanions,
      personalLineAr,
      personalLineEn,
      gender,
      audience,
    });
  });

  return { guests, rejected, duplicates, detectedColumns };
}
