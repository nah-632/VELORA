#!/usr/bin/env bash
# Starts the cluster if it is not already accepting connections. Runs on every Codespace start, so
# a resumed session has its database back without thinking about it.
set -euo pipefail

PG_BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
export PATH="$PG_BIN:$PATH"

if [ ! -d "$HOME/pgdata" ]; then
  echo "no cluster at $HOME/pgdata — run .devcontainer/setup.sh" >&2
  exit 0
fi

if pg_isready -h /tmp -p 5432 -U velora >/dev/null 2>&1; then
  echo "→ PostgreSQL already running"
  exit 0
fi

echo "→ starting PostgreSQL"
pg_ctl -D "$HOME/pgdata" -l "$HOME/pg.log" -o "-p 5432 -k /tmp" start
