/**
 * Run production query code against PGlite.
 *
 * The server talks to PostgreSQL through `postgres` (postgres.js), whose queries are tagged
 * templates. PGlite is the same PostgreSQL compiled to WebAssembly, with a different call shape.
 * This adapter is the bridge, and it exists so that the *shipping* functions can be the ones under
 * test — a test that re-implements the lockout rule proves the test, not the rule.
 *
 * It supports the one form the application uses: `sql\`select … ${value}\``.
 */
export function pgliteSql(db) {
  /**
   * `sql.begin(fn)` — the transaction the venue writer uses, so the tests drive the shipping code
   * rather than a simplified version of it. A rollback on throw is the whole point: half a set of
   * halls is worse than none.
   */
  async function begin(fn) {
    await db.exec("begin");
    try {
      const result = await fn(pgliteSql(db));
      await db.exec("commit");
      return result;
    } catch (error) {
      await db.exec("rollback");
      throw error;
    }
  }

  const sql = async function sql(strings, ...values) {
    let text = "";
    const params = [];
    for (let i = 0; i < strings.length; i += 1) {
      text += strings[i];
      if (i < values.length) {
        params.push(values[i]);
        text += `$${params.length}`;
      }
    }
    const result = await db.query(text, params);
    return result.rows;
  };
  sql.begin = begin;
  return sql;
}
