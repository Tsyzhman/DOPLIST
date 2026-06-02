# SCOPELIST

Scope lists for publishing and tracking client-facing work packages.

## Development

```bash
npm run dev
npm run lint
npm run build
```

The app uses local Geist font files from `public/fonts/`, so `next build` does not depend on Google Fonts network access.

## Public sharing

Admin sharing publishes a server-side proposal record and copies a client link:

```text
https://domain.ru/p/<shareSlug>
```

Only the private `shareSlug` is in the URL. Proposal data stays in Supabase, or
in `/app/.data/proposals.json` when Supabase env is not configured.

Public routes:

```text
/p/[shareSlug]
/p/[shareSlug]/password
/api/items/[id]/share
/api/public/[shareSlug]/password
/api/public-events
```

The public page checks `status`, `shareSettings.isPublished`, `expiresAt`, and
password access before rendering. Password-protected proposals use an httpOnly
HMAC cookie signed by `PROPOSAL_ACCESS_SECRET`. Public payloads strip
`passwordHash`, `internalNotes`, `project.notes`, and item `internalNote`.

For production Supabase, apply `supabase/schema.sql` or the latest migration in
`supabase/migrations/` before enabling public sharing.

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

SCOPELIST can archive old proposals to a private Telegram chat and then purge heavy proposal content from the database after the retention window.

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

- `web`: Next.js standalone app on `APP_PORT` (`3004` by default), image `scopelist-web:latest`, with the `scopelist-data` Docker volume mounted at `/app/.data` for file-store public sharing fallback.
- `archive-worker`: separate `worker` Docker target and image `scopelist-archive-worker:latest`, enabled only with `--profile worker`.
- `scopelist-data`: named Docker volume for file-store proposals/events, archive worker fallback, and archive cron logs when Supabase is not used. Container startup normalizes `/app/.data` ownership to `nextjs:nodejs`, then runs the Node process as `nextjs`, so existing named volumes remain writable for atomic temp-file saves.

Public sharing env:

- `PROPOSAL_PUBLIC_ORIGIN`: canonical public origin used to copy `/p/<shareSlug>` links.
- `PROPOSAL_ACCESS_SECRET`: secret for password-gate HMAC cookies.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: use Supabase instead of `/app/.data/proposals.json`.
- `SUPABASE_EVENTS_TABLE`: optional events table override, defaults to `proposal_events`.

Archive worker scheduling:

- By default, no resident worker process runs next to the web app.
- Host cron runs `archive-worker` once per day with `--once`.
- Install or refresh the cron line with `bash scripts/install-archive-cron.sh`.

Resource limits:

- `web`: `cpus: 0.5`, `mem_limit: 512m`, `mem_reservation: 128m`, `NODE_OPTIONS=--max-old-space-size=384`.
- `archive-worker`: `cpus: 0.2`, `mem_limit: 192m`, `mem_reservation: 64m`, `NODE_OPTIONS=--max-old-space-size=128`.
- Compose `deploy.resources` mirrors these values for Swarm or `docker compose --compatibility`.

Sizing guidance for a compact production deployment:

- CPU: `0.5 vCPU` for web; the one-shot archive worker may briefly add up to `0.2 vCPU`.
- RAM: `0.4-0.8 GB` for web; worker memory is transient and capped at `192 MB`.
- Disk: `2-5 GB` for the optimized web/worker images plus the `scopelist-data` volume.

If SCOPELIST starts receiving heavier production traffic, raise web `mem_limit` to `1g` and remove or increase `NODE_OPTIONS=--max-old-space-size`.
