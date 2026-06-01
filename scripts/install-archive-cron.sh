#!/usr/bin/env bash
set -euo pipefail

# Install a daily host cron job that runs the archive worker once.
# Run this script on the Docker host, not inside the container.

COMPOSE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_PATH="${COMPOSE_DIR}/.data/archive-cron.log"

mkdir -p "${COMPOSE_DIR}/.data"

quote() {
  printf "%q" "$1"
}

CRON_LINE="17 3 * * * cd $(quote "${COMPOSE_DIR}") && /usr/bin/docker compose --profile worker run --rm archive-worker node scripts/proposal-archive-worker.mjs --once >> $(quote "${LOG_PATH}") 2>&1 # proposal-archive-worker"

( crontab -l 2>/dev/null | grep -v "proposal-archive-worker" || true; echo "${CRON_LINE}" ) | crontab -

echo "Installed cron line:"
echo "${CRON_LINE}"
