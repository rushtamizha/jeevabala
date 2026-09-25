#!/usr/bin/env bash
# Project-local PostgreSQL for development (data in .data/pg, port 5433).
set -euo pipefail
cd "$(dirname "$0")/.."
export LC_ALL=${LC_ALL:-en_US.UTF-8} LANG=${LANG:-en_US.UTF-8}
DATA=.data/pg
PORT=${PGPORT_LOCAL:-5433}
case "${1:-}" in
  init)
    mkdir -p .data
    if [ -d "$DATA" ]; then echo "Already initialised at $DATA"; exit 0; fi
    PW=$(openssl rand -hex 24); echo "$PW" > .data/.pgpass-dev; chmod 600 .data/.pgpass-dev
    initdb -D "$DATA" -U saarathi --auth-local=scram-sha-256 --auth-host=scram-sha-256 --pwfile=.data/.pgpass-dev -E UTF8 >/dev/null
    pg_ctl -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=localhost" -l .data/postgres.log -w start
    PGPASSWORD=$PW createdb -h localhost -p "$PORT" -U saarathi saarathi
    echo "DATABASE_URL=postgres://saarathi:$PW@localhost:$PORT/saarathi"
    ;;
  start) pg_ctl -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=localhost" -l .data/postgres.log -w start ;;
  stop) pg_ctl -D "$DATA" -m fast stop ;;
  status) pg_ctl -D "$DATA" status ;;
  *) echo "usage: $0 {init|start|stop|status}"; exit 1 ;;
esac
