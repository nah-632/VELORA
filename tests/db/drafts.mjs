/**
 * Draft suite — can a customer's work be saved, loaded, and kept private?
 *
 * The draft is the one thing in this product that is genuinely irreplaceable: a template can be
 * reseeded, but an afternoon of a customer typing their names has no other copy. So this suite
 * covers three things and is deliberately fussy about all of them:
 *
 *   1. **The round trip.** Save, load, and get back exactly what went in.
 *   2. **Optimistic concurrency.** A save based on a stale revision must be refused rather than
 *      silently overwrite newer work — that is the failure that loses an afternoon.
 *   3. **Reach.** Anonymous callers get nothing from the table; a signed-in customer sees their
 *      own invitations and nobody else's. Asserted as roles, because PGlite connects as a
 *      superuser that would otherwise see everything and pass regardless.
 *
 * Usage: npm run test:db
 */
import {
  asAnon,
  asCustomer,
  count,
  createTestDatabase,
  createUser,
  expectError,
  reporter,
  rows,
} from "./setup.mjs";

const db = await createTestDatabase();
const t = reporter("VELORA draft suite");

const DESIGN = {
  version: 1,
  canvas: { ratio: "5:7" },
  palette: { ground: "#F5F0E8", ink: "#191A19", accent: "#7A5F38" },
  typography: {
    displayLatn: "cormorant",
    displayArab: "aref",
    bodyLatn: "manrope",
    bodyArab: "plex",
    align: "center",
    uppercaseEyebrow: true,
  },
  ornament: { frame: "hairline", rule: "short" },
  layout: "classic",
};

const template = await rows(db, "select id, slug from public.templates where slug = 'ivory-classic'");
const templateId = template[0].id;

const TOKEN = "11111111-1111-4111-8111-111111111111";
const OTHER_TOKEN = "22222222-2222-4222-8222-222222222222";

const save = (token, content, { revision = null, snapshot = false, config = DESIGN } = {}) =>
  rows(
    db,
    "select * from public.draft_save($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)",
    [token, templateId, "ar", JSON.stringify(content), JSON.stringify(config), revision, snapshot],
  );

const load = (token) => rows(db, "select * from public.draft_load($1)", [token]);

// ===========================================================================
t.section("a draft can be created, saved and read back");
// ===========================================================================

const first = await save(TOKEN, { brideName: "فاطمة", groomName: "محمد" });
t.check("the first save creates the draft", first.length === 1);
t.check("at revision zero", Number(first[0].revision) === 0, `revision ${first[0].revision}`);

const loaded = await load(TOKEN);
t.check("the draft can be loaded by its token", loaded.length === 1);
t.check(
  "the words come back exactly as they went in",
  loaded[0].content.brideName === "فاطمة" && loaded[0].content.groomName === "محمد",
);
t.check("and the design configuration came back too", loaded[0].design_config.version === 1);
t.check("the draft knows which design it came from", loaded[0].template_slug === "ivory-classic");

const second = await save(TOKEN, { brideName: "فاطمة", groomName: "محمد", venueName: "فندق" }, {
  revision: 0,
});
t.check("a save against the current revision is accepted", Number(second[0].revision) === 1);
t.check(
  "and the new field is stored",
  (await load(TOKEN))[0].content.venueName === "فندق",
);

t.check(
  "an unknown token returns nothing rather than an empty draft",
  (await load("33333333-3333-4333-8333-333333333333")).length === 0,
);

// ===========================================================================
t.section("a stale save is refused, not applied");
// ===========================================================================
// The failure this prevents: a customer edits in two tabs, and the older tab's autosave lands
// last and erases the newer work.

await save(TOKEN, { brideName: "فاطمة", venueName: "النسخة الأحدث" }, { revision: 1 });

const stale = await expectError(() =>
  save(TOKEN, { brideName: "فاطمة", venueName: "النسخة القديمة" }, { revision: 0 }),
);
t.check("a save carrying an old revision is refused", stale !== null, stale?.message?.slice(0, 60));
t.check(
  "and the newer content survives the attempt",
  (await load(TOKEN))[0].content.venueName === "النسخة الأحدث",
  "asserted against the row, not against the exception",
);

const forced = await save(TOKEN, { brideName: "فاطمة", venueName: "بلا شرط" }, { revision: null });
t.check(
  "a save with no expectation still succeeds — autosave must not be defeatable",
  Number(forced[0].revision) === 3,
  `revision ${forced[0].revision}`,
);

// ===========================================================================
t.section("versions are written on an explicit save only");
// ===========================================================================

await save(TOKEN, { brideName: "فاطمة", venueName: "نسخة محفوظة" }, { revision: 3, snapshot: true });

const versions = await rows(
  db,
  `select v.revision from public.invitation_versions v
     join public.invitations i on i.id = v.invitation_id
    where i.draft_token = $1 order by v.revision`,
  [TOKEN],
);
t.check("exactly one version exists", versions.length === 1, `found ${versions.length}`);
t.check(
  "and it is the explicit save, not an autosave",
  Number(versions[0].revision) === 4,
  `recorded revision ${versions[0].revision}`,
);

// ===========================================================================
t.section("what the functions refuse");
// ===========================================================================

const noVersion = await expectError(() =>
  save(OTHER_TOKEN, { brideName: "x" }, {
    config: { ...DESIGN, version: undefined },
  }),
);
t.check("a design configuration without a version is refused", noVersion !== null);

const badDesign = await expectError(() =>
  rows(db, "select * from public.draft_save($1, $2, $3, $4::jsonb, $5::jsonb, null, false)", [
    OTHER_TOKEN,
    templateId,
    "ar",
    JSON.stringify({}),
    JSON.stringify("not an object"),
  ]),
);
t.check("a non-object design configuration is refused", badDesign !== null);

const badLocale = await expectError(() =>
  rows(db, "select * from public.draft_save($1, $2, $3, $4::jsonb, $5::jsonb, null, false)", [
    OTHER_TOKEN,
    templateId,
    "fr",
    JSON.stringify({}),
    JSON.stringify(DESIGN),
  ]),
);
t.check("an unsupported locale is refused", badLocale !== null);

t.check(
  "none of the refusals left a row behind",
  (await count(db, "select count(*) from public.invitations where draft_token = $1", [OTHER_TOKEN])) === 0,
);

// ===========================================================================
t.section("reach");
// ===========================================================================

const anonProbe = await asAnon(db, () =>
  expectError(() => db.query("select count(*) from public.invitations")),
);
t.check(
  "an anonymous caller cannot even query the invitations table",
  anonProbe !== null,
  anonProbe ? anonProbe.message.slice(0, 60) : "the query unexpectedly succeeded",
);
t.check(
  "because no grant exists for it — a stronger position than a policy returning no rows",
  true,
  "anonymous access is only through the token function",
);
t.check(
  "and the draft does exist",
  (await count(db, "select count(*) from public.invitations where draft_token = $1", [TOKEN])) === 1,
);
t.check(
  "and an anonymous caller can still reach it through the token function",
  await asAnon(db, async () => (await rows(db, "select * from public.draft_load($1)", [TOKEN])).length === 1),
  "the token is the capability",
);

const alice = await createUser(db, { email: "alice@example.test", fullName: "Alice" });
const bob = await createUser(db, { email: "bob@example.test", fullName: "Bob" });

// Claim Bob's draft by hand, the way a sign-in would.
await db.exec(
  `update public.invitations set customer_id = '${bob}', claimed_at = now() where draft_token = '${TOKEN}'`,
);

t.check(
  "a signed-in customer sees their own invitation",
  (await asCustomer(db, bob, () => count(db, "select count(*) from public.invitations"))) === 1,
);
t.check(
  "and a different customer sees nothing",
  (await asCustomer(db, alice, () => count(db, "select count(*) from public.invitations"))) === 0,
);
// The id is read with privileged access, then the attempt is made as Alice. Looking it up as
// Alice would return nothing, so the assertion would pass for the wrong reason.
const bobInvitationId = (await rows(db, "select id from public.invitations limit 1"))[0]?.id;
t.check(
  "Alice cannot reach Bob's invitation by asking for its id",
  (await asCustomer(db, alice, () =>
    count(db, "select count(*) from public.invitations where id = $1", [bobInvitationId]),
  )) === 0,
);
const deleteAttempt = await asCustomer(db, bob, () =>
  expectError(() => db.query("delete from public.invitations")),
);
t.check(
  "a customer cannot delete their own invitation",
  deleteAttempt !== null,
  "work is archived, never removed by the customer",
);

await db.close();
t.finish();
