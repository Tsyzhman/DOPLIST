#!/bin/sh
set -eu

DATA_DIR="${PROPOSAL_DATA_DIR:-/app/.data}"

mkdir -p "$DATA_DIR"

if [ "$(id -u)" = "0" ]; then
  chown -R nextjs:nodejs "$DATA_DIR"
  exec su-exec nextjs:nodejs "$@"
fi

exec "$@"
