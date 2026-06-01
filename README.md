# DOPLIST

Digital Offer & Proposal List for Interactive Scope Tracking.

## Development

```bash
npm run dev
npm run lint
npm run build
```

The app uses local Geist font files from `public/fonts/`, so `next build` does not depend on Google Fonts network access.

## Local artifacts

`output/`, `screenshots/`, `.playwright-cli/`, `.data/proposals.json`, `dev-server*.log`, `.next/`, and `tsconfig.tsbuildinfo` are local development or verification artifacts. They are excluded from git and Docker, but can grow on a developer machine.

Clean them with:

```bash
npm run clean
```

Preview the cleanup without deleting files:

```bash
node scripts/clean-local-artifacts.mjs --dry-run
```

## Docker

Build and run the web app:

```bash
docker compose up -d
```

`docker compose up -d` starts only `web`. The archive worker is behind the `worker` profile and is intended to run as a short host-cron job:

```bash
docker compose --profile worker run --rm archive-worker \
  node scripts/proposal-archive-worker.mjs --once
```

Install the daily host cron on the server:

```bash
bash scripts/install-archive-cron.sh
```

## Telegram Archive Worker

DOPLIST can archive old proposals to a private Telegram chat and then purge heavy proposal content from the database after the retention window.

Required production env:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_ARCHIVE_CHAT_ID=
ARCHIVE_RETENTION_MONTHS=6
ARCHIVE_LEAD_DAYS=7
```

Run once locally:

```bash
npm run archive:once
```

Self-test without network or database:

```bash
npm run archive:self-test
```

For production Supabase, apply `supabase/migrations/20260531000000_proposal_archive_retention.sql` before enabling the worker.

## Resource Profile

Current Docker shape:

- `web`: Next.js standalone app on `APP_PORT` (`3004` by default), image `price-presentation-web:latest`.
- `archive-worker`: separate `worker` Docker target and image `price-presentation-archive-worker:latest`, enabled only with `--profile worker`.
- `.data`: bind mount for the worker file-store fallback and archive cron logs when Supabase is not used.

Archive worker scheduling:

- By default, no resident worker process runs next to the web app.
- Host cron runs `archive-worker` once per day with `--once`.
- Install or refresh the cron line with `bash scripts/install-archive-cron.sh`.

Resource limits:

- `web`: `cpus: 0.5`, `mem_limit: 512m`, `mem_reservation: 128m`, `NODE_OPTIONS=--max-old-space-size=384`.
- `archive-worker`: `cpus: 0.2`, `mem_limit: 192m`, `mem_reservation: 64m`, `NODE_OPTIONS=--max-old-space-size=128`.
- Compose `deploy.resources` mirrors these values for Swarm or `docker compose --compatibility`.

Sizing guidance for a polished demo deployment:

- CPU: `0.5 vCPU` for web; the one-shot archive worker may briefly add up to `0.2 vCPU`.
- RAM: `0.4-0.8 GB` for web; worker memory is transient and capped at `192 MB`.
- Disk: `2-5 GB` for the optimized web/worker images plus `.data` and archive volume.

If DOPLIST starts receiving real traffic instead of demo load, raise web `mem_limit` to `1g` and remove or increase `NODE_OPTIONS=--max-old-space-size`.
