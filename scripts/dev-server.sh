#!/bin/sh
# Local development server control.
#
# Exists so that no shell command has to contain the server's command line: a `pkill -f` run
# from a command that itself mentions the server matches its own process and kills the shell.
#
# Usage: sh scripts/dev-server.sh start|stop|status|log
PORT="${PORT:-3210}"
LOG=/tmp/velora-dev.log
PIDF=/tmp/velora-dev.pid
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

case "$1" in
  start)
    if [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF")" 2>/dev/null; then
      echo "already running, pid $(cat "$PIDF")"
      exit 0
    fi
    cd "$ROOT" || exit 1
    nohup npx next dev -p "$PORT" > "$LOG" 2>&1 &
    echo $! > "$PIDF"
    echo "started pid $(cat "$PIDF") on port $PORT, log $LOG"
    ;;
  stop)
    if [ -f "$PIDF" ]; then
      kill "$(cat "$PIDF")" 2>/dev/null
      rm -f "$PIDF"
    fi
    pkill -f "p $PORT" 2>/dev/null
    echo stopped
    ;;
  status)
    curl -s -o /dev/null -w 'http=%{http_code}\n' -m 5 "http://localhost:$PORT/ar" || echo down
    ;;
  log)
    tail -n "${2:-25}" "$LOG"
    ;;
  *)
    echo "usage: $0 start|stop|status|log [lines]"
    exit 2
    ;;
esac
