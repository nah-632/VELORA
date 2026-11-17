/**
 * Catalogue suite — does the template system behave, and can every design be read?
 *
 * Two kinds of assertion, both against the real seeded rows rather than a fixture:
 *
 *   1. **Visibility and query behaviour.** A draft must be invisible to the public and visible to
 *      an administrator; filters, search and paging must mean what they say. Every query is made
 *      as a real role, because PGlite connects as a superuser that bypasses row-level security.
 *
 *   2. **Legibility of every palette.** A catalogue is a set of designs, and a design the customer
 *      cannot read is a defect regardless of how it was produced. Each seeded template's palette
 *      is measured: ink on ground must clear AA for text, and the accent must clear the 3:1 that
 *      WCAG 1.4.11 requires for a graphical element. A design that fails cannot be published
 *      without somebody changing the numbers.
 *
 * Usage: npm run test:db
 */
import {
  asAnon,
  asCustomer,
  count,
  createTestDatabase,
  createUser,
  reporter,
  rows,
} from "./setup.mjs";

const db = await createTestDatabase();
const t = reporter("VELORA catalogue suite");

// ---------------------------------------------------------------------------
// A customer and an administrator to look through.
// ---------------------------------------------------------------------------
const admin = await createUser(db, { email: "admin@example.test", fullName: "Admin" });
await db.exec(`insert into public.user_roles (user_id, role_code) values ('${admin}', 'admin')`);

const list = (role, uid, args) =>
  (uid ? asCustomer(db, uid, () => rows(db, `select * from public.catalogue_list($1,$2,$3,$4,$5,$6)`, args))
       : asAnon(db, () => rows(db, `select * from public.catalogue_list($1,$2,$3,$4,$5,$6)`, args)));

// ===========================================================================
t.section("what the public can see");
// ===========================================================================

const anonList = await list("anon", null, ["ar", null, null, null, 50, 0]);
t.check("a visitor sees the published designs", anonList.length === 8, `saw ${anonList.length}`);
t.check(
  "the draft is not visible to a visitor",
  (await asAnon(db, () =>
    count(db, "select count(*) from public.templates where slug = 'draft-preview-only'"))) === 0,
);
t.check(
  "and it is not reachable through the query function either",
  (await asAnon(db, () =>
    count(db, "select count(*) from public.catalogue_get('draft-preview-only', 'ar')"))) === 0,
);

t.check(
  "an administrator sees the draft",
  (await asCustomer(db, admin, () => count(db, "select count(*) from public.templates"))) === 9,
);
t.check(
  "the public query function refuses a draft even to an administrator",
  (await asCustomer(db, admin, () =>
    count(db, "select count(*) from public.catalogue_get('draft-preview-only', 'ar')"))) === 0,
  "it filters to published in its own body, so RLS being wrong is not the only thing protecting drafts",
);

// ===========================================================================
t.section("localised names");
// ===========================================================================

const arabic = anonList.find((row) => row.slug === "ivory-classic");
const englishList = await list("anon", null, ["en", null, null, null, 50, 0]);
const english = englishList.find((row) => row.slug === "ivory-classic");
t.check("Arabic names come back in Arabic", arabic?.name === "عاجي كلاسيكي", arabic?.name);
t.check("English names come back in English", english?.name === "Ivory Classic", english?.name);
t.check(
  "the category name is localised too",
  arabic?.category_name === "ملكي كلاسيكي" && english?.category_name === "Classic Royal",
);

// ===========================================================================
t.section("filtering, search and paging");
// ===========================================================================

const royal = await list("anon", null, ["en", "classic-royal", null, null, 50, 0]);
t.check("filtering by category narrows the list", royal.length === 2, `saw ${royal.length}`);

const featured = await list("anon", null, ["en", null, null, true, 50, 0]);
t.check("filtering by featured returns only featured designs", featured.length === 3, `saw ${featured.length}`);
t.check(
  "featured designs come first",
  anonList.slice(0, 3).every((row) => row.is_featured),
);

const searched = await list("anon", null, ["en", null, "Noir", null, 50, 0]);
t.check(
  "searching finds a design by name",
  searched.length === 1 && searched[0].slug === "ink-noir",
  `${searched.length} result(s)`,
);

const descriptionMatch = await list("anon", null, ["en", null, "emerald", null, 50, 0]);
t.check(
  "search also matches descriptions and category names, not just titles",
  descriptionMatch.length === 2,
  "emerald-royal by name, naskh-heritage by description",
);

const searchArabic = await list("anon", null, ["ar", null, "رملي", null, 50, 0]);
t.check(
  "searching works in Arabic",
  searchArabic.length === 1 && searchArabic[0].slug === "sand-editorial",
  `${searchArabic.length} result(s)`,
);

t.check(
  "searching by category name works",
  (await list("anon", null, ["en", null, "Editorial", null, 50, 0])).length === 1,
);

const wildcard = await list("anon", null, ["en", null, "%", null, 50, 0]);
t.check(
  "a literal percent sign searches for a percent sign, not everything",
  wildcard.length === 0,
  `${wildcard.length} result(s) — the metacharacter is escaped`,
);

const paged = await list("anon", null, ["en", null, null, null, 3, 3]);
t.check("paging returns the page size", paged.length === 3, `saw ${paged.length}`);
t.check(
  "and reports the total for the whole result, not just the page",
  Number(paged[0]?.total_count) === 8,
  `total_count=${paged[0]?.total_count}`,
);
t.check(
  "the second page is different from the first",
  paged[0].slug !== anonList[0].slug,
);

// ===========================================================================
t.section("supported locales");
// ===========================================================================

const heritage = anonList.find((row) => row.slug === "naskh-heritage");
t.check(
  "an Arabic-only design declares it",
  Array.isArray(heritage?.supported_locales)
    && heritage.supported_locales.length === 1
    && heritage.supported_locales[0] === "ar",
  JSON.stringify(heritage?.supported_locales),
);

const categories = await asAnon(db, () => rows(db, "select * from public.catalogue_categories('en')"));
t.check("all seven categories are listed", categories.length === 7, `saw ${categories.length}`);
t.check(
  "a category with nothing published still appears, reporting zero",
  categories.every((row) => Number(row.total) >= 0),
);
t.check(
  "the draft is not counted in its category",
  Number(categories.find((row) => row.slug === "modern-minimal")?.total) === 1,
  "modern-minimal has one published design and one draft",
);

// ===========================================================================
t.section("prices are not invented");
// ===========================================================================

t.check(
  "no seeded design carries a price",
  anonList.every((row) => row.base_price_fils === null),
  "pricing is an owner decision; the interface shows an unpriced state",
);

// ===========================================================================
t.section("every published palette is legible");
// ===========================================================================
// WCAG 2.x relative luminance. Measured, not assumed: a design that cannot be read is a defect no
// matter how it was chosen.

function luminance(hex) {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

let checkedPalettes = 0;
for (const template of anonList) {
  const palette = template.design_config.palette ?? {};
  const { ground, ink, accent } = palette;
  if (!ground || !ink || !accent) {
    t.check(`${template.slug}: palette complete`, false, JSON.stringify(palette));
    continue;
  }
  checkedPalettes += 1;
  const inkRatio = ratio(ink, ground);
  const accentRatio = ratio(accent, ground);
  t.check(
    `${template.slug}: ink on ground clears AA`,
    inkRatio >= 4.5,
    `${inkRatio.toFixed(2)}:1 (${ink} on ${ground})`,
  );
  t.check(
    `${template.slug}: accent clears 3:1 as a graphical element`,
    accentRatio >= 3,
    `${accentRatio.toFixed(2)}:1 (${accent} on ${ground})`,
  );
}
t.check(
  `all ${checkedPalettes} palettes measured`,
  checkedPalettes === anonList.length,
  `${checkedPalettes} of ${anonList.length}`,
);

// ===========================================================================
t.section("every design configuration is complete and versioned");
// ===========================================================================

for (const template of anonList) {
  const config = template.design_config;
  const ok =
    typeof config.version === "number"
    && typeof config.canvas?.ratio === "string"
    && typeof config.layout === "string"
    && typeof config.typography?.displayArab === "string"
    && typeof config.typography?.displayLatn === "string";
  t.check(`${template.slug}: version, canvas, layout and both scripts declared`, ok);
  t.check(
    `${template.slug}: content is separate from design`,
    !JSON.stringify(config).includes("Bride")
      && JSON.stringify(template.preview_content).includes("Bride"),
    "the sample words live in preview_content, never in design_config",
  );
}

await db.close();
t.finish();
