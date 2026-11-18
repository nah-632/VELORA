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
  return async function sql(strings, ...values) {
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
}
