/**
 * The token document, proved three ways.
 *
 * `0009_token_config.sql` moved `TemplateTokens` out of the code roster and into the row it belongs
 * to. That creates one risk and one deadline, and this file is for both:
 *
 *   The risk — **two descriptions of one design.** `src/lib/templates/registry.ts` still carries the
 *   same documents, and the row now carries a copy. If the two ever disagree, the guest sees one and
 *   the operator's picker shows the other, and nothing in the build would say so. So the code copy and
 *   the stored copy are asserted equal, role by role.
 *
 *   The deadline — **the boundary.** `/i/<token>` parses this column with
 *   `TemplateTokensSchema.safeParse`, and an unparseable stored document is treated as a stored bug
 *   rather than rendered half-applied. A document that does not validate is therefore not a cosmetic
 *   problem; it takes the guest's page down. Parsing every seeded document here is what keeps that
 *   from first happening in production.
 *
 * It also pins the rule for `NULL`, which is the normal case rather than a gap: eight presets seeded
 * in `0003_templates.sql` have no token document and are meant to fall back to the registry by slug.
 *
 * Run: node --import tsx tests/db/token-config.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { TemplateTokensSchema } from "../../src/lib/templates/schema.ts";
import { TEMPLATES } from "../../src/lib/templates/registry.ts";
import { reporter } from "./setup.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = join(ROOT, "db/migrations");
const files = readdirSync(DIR)
  .filter((n) => n.endsWith(".sql"))
  .sort();

const t = reporter("VELORA — token documents (real PostgreSQL 17 via PGlite/WASM)");

if (files.length === 0) {
  console.error("\n✗ no migrations in db/migrations — a schema test with nothing to test passes for the wrong reason");
  process.exit(1);
}

const db = await PGlite.create();
for (const name of files) {
  try {
    await db.exec(readFileSync(join(DIR, name), "utf8"));
  } catch (error) {
    console.error(`\n✗ migration ${name} failed\n${error.message}`);
    process.exit(1);
  }
}
t.check(`applied ${files.length} migration(s)`, true);

// ---------------------------------------------------------------------------------------------
t.section("every seeded document satisfies the schema the route enforces");

const rows = (
  await db.query(`select slug, token_config from public.templates where token_config is not null order by slug`)
).rows;

t.check("at least the three token templates carry one", rows.length >= 3, rows.map((r) => r.slug).join(", "));

for (const row of rows) {
  const parsed = TemplateTokensSchema.safeParse(row.token_config);
  t.check(
    `${row.slug} parses as TemplateTokens`,
    parsed.success,
    parsed.success ? "" : String(parsed.error.issues[0]?.message).slice(0, 90),
  );
  if (parsed.success) {
    t.check(
      `  and its own slug is the one it is stored under`,
      parsed.data.slug === row.slug,
      `${row.slug} vs ${parsed.data.slug}`,
    );
  }
}

// A document that is present and unparseable is refused, not rendered half-applied. The route relies
// on this: `toInvitation` returns null rather than a partially themed invitation.
const broken = TemplateTokensSchema.safeParse({ slug: "not-a-template", version: 1 });
t.check("a truncated document is refused", !broken.success);

/**
 * Canonical JSON — object keys sorted, recursively.
 *
 * jsonb does not preserve key order: Postgres stores keys sorted by length then byte value, so a
 * document written in this file's order comes back in another. A raw `JSON.stringify` comparison
 * therefore reports every nested object as different while every value in it is identical — which is
 * what this test did on its first run, flagging three documents that agreed. Compare structure, not
 * spelling.
 */
function canon(value) {
  if (Array.isArray(value)) return value.map(canon);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canon(value[key])]),
    );
  }
  return value;
}

/**
 * The fields that are deliberately allowed to differ, with why.
 *
 * Nothing is relaxed here yet — the list exists so that relaxing one is a decision someone writes
 * down, rather than a comparison quietly loosened until it passes.
 */
const ALLOWED_TO_DIFFER = [];

function same(a, b) {
  const left = canon(a);
  const right = canon(b);
  for (const key of ALLOWED_TO_DIFFER) {
    delete left[key];
    delete right[key];
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

// ---------------------------------------------------------------------------------------------
t.section("the code registry and the stored document agree");

for (const template of TEMPLATES) {
  const row = rows.find((r) => r.slug === template.slug);
  if (!row) continue;

  const stored = TemplateTokensSchema.safeParse(row.token_config);
  if (!stored.success) continue;

  // Structural equality on the whole document: if someone edits one copy and not the other, this
  // fails here rather than as a guest seeing a colour the operator did not choose.
  const agrees = same(stored.data, template);
  t.check(
    `${template.slug}: the two copies are identical`,
    agrees,
    agrees ? "" : firstDifference(stored.data, template),
  );
}

/** Names the field that differs, so a failure is actionable rather than "the two disagree". */
function firstDifference(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (JSON.stringify(canon(a[key])) !== JSON.stringify(canon(b[key]))) {
      return `${key}: registry ${JSON.stringify(a[key])} vs stored ${JSON.stringify(b[key])}`;
    }
  }
  return "no field differs — the comparison itself is wrong";
}

// ---------------------------------------------------------------------------------------------
t.section("the fallback is the normal case");

const without = await db.query(`select count(*)::int as n from public.templates where token_config is null`);
t.check(
  "rows with no token document fall back to the registry",
  without.rows[0].n >= 8,
  `${without.rows[0].n} presets rely on it`,
);

await db.close();
t.finish();
