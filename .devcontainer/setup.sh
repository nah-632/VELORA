#!/usr/bin/env bash
# One-time setup for a fresh Codespace.
#
# Everything here is something that had to be done by hand once, and would otherwise have to be done
# by hand every time:
#
#   * `npm ci` — the dependencies, including the PGlite that makes the suite runnable anywhere;
#   * PostgreSQL — a *real* server, because a schema that has only ever been applied to a
#     WebAssembly PostgreSQL is a schema whose migrations are untested against a server;
#   * fontTools — `npm run test:fonts` opens the shipped woff2 files and checks the glyph coverage;
#     without it the gate stops at the font step with a Python traceback.
#
# The cluster is initialised **as the workspace user, in the workspace user's home**, on a socket in
# /tmp. That avoids `sudo` entirely for day-to-day work: `pg_ctl start`, `psql`, `createdb` all run
# unprivileged, which is also why this works in a container where sudo wants a password.
set -euo pipefail

echo "→ dependencies"
npm ci

echo "→ PostgreSQL and fontTools"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-client python3-fonttools

# Pick the installed major version's bin directory; the package puts it in a versioned folder.
PG_BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
export PATH="$PG_BIN:$PATH"

if [ ! -d "$HOME/pgdata" ]; then
  echo "→ initialising the cluster at $HOME/pgdata"
  initdb -D "$HOME/pgdata" -U velora --auth=trust >/dev/null
fi

bash .devcontainer/start-db.sh

echo "→ creating the database (idempotent)"
createdb -h /tmp -p 5432 -U velora velora 2>/dev/null || true

echo
echo "Ready. Next:"
echo "  npm run db:migrate     # applies db/migrations to the real PostgreSQL"
echo "  ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a long passphrase' npm run seed:admin"
echo "  npm run dev"