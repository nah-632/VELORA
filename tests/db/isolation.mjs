/**
 * Isolation suite — does the database actually keep customers apart?
 *
 * This is not a unit test of our own code. It is an adversarial interrogation of the policies:
 * every assertion is run **as a different role with a different identity**, because a
 * superuser connection sees everything regardless of policy, which is how an RLS suite ends up
 * reporting green while testing nothing.
 *
 * Two rules this suite holds itself to:
 *   1. An assertion about a write must survive the transaction that made it, or it is reading a
 *      world where the write never happened. Writes use the committed variants.
 *   2. A refusal is a silent no-op on UPDATE and DELETE, not an error. Assertions check the
 *      affected row count AND verify the row afterwards with a privileged read.
 *
 * It closes with a negative control: the suite deliberately breaks a policy and requires itself
 * to notice. A security suite that cannot fail is not evidence.
 *
 * Usage: npm run test:db
 */
import {
  asAnon,
  asCustomer,
  asCustomerCommitted,
  count,
  createTestDatabase,
  createUser,
  expectError,
  reporter,
  rows,
  setIdentity,
} from "./setup.mjs";

const db = await createTestDatabase();
const t = reporter("VELORA isolation suite");

// ---------------------------------------------------------------------------
// Fixtures: two customers and one administrator. The admin grant is made with privileged
// access, exactly as an operator would.
// ---------------------------------------------------------------------------

const alice = await createUser(db, { email: "alice@example.test", fullName: "Alice" });
const bob = await createUser(db, { email: "bob@example.test", fullName: "Bob" });
const carol = await createUser(db, { email: "carol@example.test", fullName: "Carol" });
await db.exec(`insert into public.user_roles (user_id, role_code) values ('${bob}', 'admin')`);

const profileCountAs = (uid) =>
  asCustomer(db, uid, () => count(db, "select count(*) from public.profiles"));

// ===========================================================================
t.section("the auth trigger did its job before any policy is tested");
// ===========================================================================

t.check("a new auth user gets a profile", (await count(db, "select count(*) from public.profiles")) === 3);
t.check(
  "a new auth user gets the customer role",
  (await count(db, "select count(*) from public.user_roles where role_code = 'customer'")) === 3,
);
t.check(
  "the name from the auth metadata reaches the profile",
  (await count(db, "select count(*) from public.profiles where full_name = 'Carol'")) === 1,
);

// ===========================================================================
t.section("profiles: a customer sees themselves and nobody else");
// ===========================================================================

t.check("Alice sees exactly one profile", (await profileCountAs(alice)) === 1);
t.check(
  "Alice's profile is her own",
  await asCustomer(db, alice, async () => {
    const r = await rows(db, "select user_id from public.profiles");
    return r[0]?.user_id === alice;
  }),
);
t.check(
  "Alice cannot reach Bob's profile even by asking for it by id",
  (await asCustomer(db, alice, () =>
    count(db, "select count(*) from public.profiles where user_id = $1", [bob]),
  )) === 0,
);

// ===========================================================================
t.section("profiles: writes are confined to the caller's own row");
// ===========================================================================

await asCustomerCommitted(db, alice, () =>
  db.query("update public.profiles set full_name = 'Alice Updated' where user_id = $1", [alice]),
);
t.check(
  "a customer can edit their own profile, and it persists",
  (await count(db, "select count(*) from public.profiles where user_id = $1 and full_name = 'Alice Updated'", [alice])) === 1,
);

const crossUpdate = await asCustomerCommitted(db, alice, async () => {
  const result = await db.query("update public.profiles set full_name = 'owned' where user_id = $1", [bob]);
  return result.affectedRows ?? 0;
});
t.check("an update aimed at another customer's row affects nothing", crossUpdate === 0);
t.check(
  "Bob's name is untouched on a privileged read",
  (await count(db, "select count(*) from public.profiles where user_id = $1 and full_name = 'Bob'", [bob])) === 1,
);

const deleteAttempt = await asCustomer(db, alice, () =>
  expectError(() => db.query("delete from public.profiles where user_id = $1", [alice])),
);
t.check(
  "no application role can delete a profile: accounts are deactivated, not removed",
  deleteAttempt !== null,
  deleteAttempt ? deleteAttempt.message.slice(0, 50) : "the delete unexpectedly succeeded",
);
t.check(
  "Alice's profile is still there after the attempt",
  (await count(db, "select count(*) from public.profiles where user_id = $1", [alice])) === 1,
);

// ===========================================================================
t.section("user_roles: privilege cannot be granted to oneself");
// ===========================================================================

t.check(
  "Alice sees only her own role rows",
  (await asCustomer(db, alice, () =>
    count(db, "select count(*) from public.user_roles where user_id <> $1", [alice]),
  )) === 0,
);

const escalation = await asCustomer(db, alice, () =>
  expectError(() =>
    db.query("insert into public.user_roles (user_id, role_code) values ($1, 'admin')", [alice]),
  ),
);
t.check(
  "Alice cannot grant herself the admin role",
  escalation !== null,
  escalation ? escalation.message.slice(0, 55) : "the escalation unexpectedly succeeded",
);
t.check(
  "and she is still not an admin on a privileged read",
  (await count(db, "select count(*) from public.user_roles where user_id = $1 and role_code = 'admin'", [alice])) === 0,
  "asserted against the row, not against the exception",
);

const crossRevoke = await asCustomerCommitted(db, alice, async () => {
  const result = await db.query("delete from public.user_roles where user_id = $1", [carol]);
  return result.affectedRows ?? 0;
});
t.check("a customer cannot revoke someone else's role", crossRevoke === 0);
t.check(
  "Carol still holds her role",
  (await count(db, "select count(*) from public.user_roles where user_id = $1", [carol])) === 1,
);

// ===========================================================================
t.section("administrators: reach is explicit and narrow");
// ===========================================================================

t.check("Bob, an administrator, sees every profile", (await profileCountAs(bob)) === 3);

await asCustomerCommitted(db, bob, () =>
  db.query("update public.profiles set full_name = 'Carol B.' where user_id = $1", [carol]),
);
t.check(
  "an administrator can edit another account, and the row changes",
  (await count(db, "select count(*) from public.profiles where user_id = $1 and full_name = 'Carol B.'", [carol])) === 1,
);

// ===========================================================================
t.section("the activity log is append-only and staff-only");
// ===========================================================================

const customerWrite = await asCustomer(db, alice, () =>
  expectError(() => db.query("select app_private.log_admin_action($1)", ["orders.cancelled"])),
);
t.check(
  "a customer cannot write to the log",
  customerWrite !== null,
  customerWrite ? customerWrite.message.slice(0, 60) : "the write unexpectedly succeeded",
);

const logId = await asCustomerCommitted(db, bob, async () => {
  const r = await rows(db, "select app_private.log_admin_action($1, $2, null, $3::jsonb) as id", [
    "profile.renamed",
    "profile",
    JSON.stringify({ to: "Carol B." }),
  ]);
  return r[0]?.id;
});
t.check("an administrator can write an entry", Boolean(logId));
t.check(
  "the entry records the administrator as its actor",
  (await count(db, "select count(*) from public.admin_activity_log where id = $1 and actor_id = $2", [logId, bob])) === 1,
  "read after commit, so the row genuinely exists",
);
t.check(
  "an administrator can read the log",
  (await asCustomer(db, bob, () => count(db, "select count(*) from public.admin_activity_log"))) === 1,
);
t.check(
  "a customer reads no log rows, even though one now exists",
  (await asCustomer(db, alice, () => count(db, "select count(*) from public.admin_activity_log"))) === 0,
);

const logRewrite = await asCustomer(db, bob, () =>
  expectError(() => db.query("update public.admin_activity_log set action = 'nothing'")),
);
t.check(
  "even an administrator cannot rewrite the log",
  logRewrite !== null,
  "no UPDATE grant exists for any application role",
);

// ===========================================================================
t.section("anonymous callers");
// ===========================================================================

t.check(
  "an anonymous visitor can read the role catalogue and nothing else",
  await asAnon(db, async () => {
    const roleCount = await count(db, "select count(*) from public.roles");
    const profileProbe = await expectError(() => db.query("select * from public.profiles"));
    return roleCount === 2 && profileProbe !== null;
  }),
);

// ===========================================================================
t.section("negative control — the suite must be able to fail");
// ===========================================================================
// Everything above is worthless if it would also pass against a broken policy. This disables
// RLS on profiles inside a transaction and requires the query that returned 1 to now return 3.
// If it does not, the assertions are measuring the harness, not the policies.

await db.exec("begin");
try {
  await db.exec("alter table public.profiles disable row level security");
  await setIdentity(db, { role: "authenticated", uid: alice });
  const leaked = await count(db, "select count(*) from public.profiles");
  t.check(
    "with RLS off, the same query sees every row — so the role discipline is real",
    leaked === 3,
    `saw ${leaked}, expected 3`,
  );
} finally {
  await db.exec("rollback");
}

t.check("the rollback restored the policy", (await profileCountAs(alice)) === 1);

await db.close();
t.finish();
