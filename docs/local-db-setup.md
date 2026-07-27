# Local DB setup

From zero to a working local stack: one Postgres with two schemas — `catalog`
(the Hono API) and `strapi` (the CMS) — plus the remote CMS content pulled down
and its scenario UIDs re-keyed to the catalog's ixmp4 names.

## 0. Prerequisites

- Docker Desktop (running)
- Postgres 14+ on the **host**, listening on `:5432` (Homebrew: `brew install postgresql@16 && brew services start postgresql@16`).
  The containers reach it via `host.docker.internal`; Homebrew's default `trust`
  auth means no password.
- `flyctl` (authenticated: `fly auth login`), `jq`, `pg_dump`/`psql` — needed for the CMS pull.

Create the database with **your own** role/name:

```bash
createdb provide          # or: psql -c 'create database provide'
```

The compose stack defaults to `DB_USER=rodrigo`, `DB_NAME=provide`. If your
Postgres superuser isn't `rodrigo`, export these once (or put them in your
shell profile) — every command below and `docker compose up` read them:

```bash
export DB_USER="$(whoami)"
export DB_NAME=provide
```

## 1. Env files

```bash
cp .env.example .env
cp cms/.env.example cms/.env   # ask Rodrigo for the real APP_KEYS / *_SECRET / S3_* values
```

In `.env` set at least `DATABASE_USERNAME` to your role, plus `IXMP4_USERNAME` /
`IXMP4_PASSWORD` and `VITE_MAPBOX_ACCESS_TOKEN`.

`cms/.env` secrets must match the ones the remote uses for the S3/R2 media to
resolve; the DB settings there are overridden by compose.

## 2. Bring the stack up

```bash
docker compose up --build     # first build takes a few minutes
```

Single origin at http://localhost:8080 — `/api` (API), `http://cms.localhost:8080`
(Strapi), `/` (SvelteKit). `server.ts` runs the catalog migrations on boot, so the
`catalog` schema tables exist after the API container starts.

## 3. Seed the catalog API

In a second terminal (host, needs `bun`):

```bash
npm run db:migrate    # idempotent; no-op if the API container already migrated
npm run db:seed       # geographies -> indicators -> seed.sql + seed-indicators.sql
```

`db:seed` is the convention-driven import: `import-geographies.ts`,
`import-indicators.ts` (from `api/db/import/indicators.yaml`), then applies the
generated SQL into the `catalog` schema.

Sanity check:

```bash
curl -s localhost:8080/api/geographies | head -c 300
curl -s localhost:8080/api/catalog     | head -c 300
```

## 4. Pull the CMS content into the local `strapi` schema

```bash
npm run db:cms:pull
```

Five stages: fetch the remote SQLite DB from Fly (read-only), `strapi export`
inside the cms container, `pg_dump` backup of your local `strapi` schema,
`strapi import --force`, restart + row counts. Media stays on R2 — only file
rows transfer.

Useful flags: `SKIP_FETCH=1` (reuse `cms/dumps/data-remote.db`), `SKIP_IMPORT=1`
(build the tarball only), `KEEP_ASSETS=1` (bundle media — large and slow).

That's the whole dump-and-import — there is no separate import step. The other
two scripts are escape hatches you won't need on a fresh setup:

- `npm run db:cms:dump` — readable SQLite snapshot of the remote at
  `cms/dumps/strapi-remote.sql`, for inspection/backup. Does **not** load into Postgres.
- `npm run db:cms:import` — re-import an existing `cms/dumps/strapi-transfer.tar.gz`
  (e.g. built by a `SKIP_IMPORT=1` pull, or handed to you) without re-fetching.
  Follow it with `docker compose restart cms`.

## 5. Re-key scenario UIDs to the catalog ids

CMS scenarios still carry legacy slugs (`curpol`); the catalog serves ixmp4 names
(`2020 Climate Policies`). Without this, CMS descriptions don't join
`GET /api/catalog`. The script boots Strapi programmatically, so **stop the cms
container first**:

```bash
docker compose stop cms
npm run db:cms:rekey
docker compose start cms
```

Idempotent — re-running changes nothing. Scenarios without an ixmp4 counterpart
keep their legacy uid and are reported as skipped.

⚠️ A local-only run is reverted by the next `npm run db:cms:pull`. The content of
record is the **remote** Strapi; re-run the pull, then re-run this script.

## 6. Verify

```bash
npm test                                    # bun test api/
psql -d "$DB_NAME" -At -c "select count(*) from catalog.indicators"
psql -d "$DB_NAME" -At -c "select \"UID\" from strapi.scenarios limit 5"
```

Then open http://localhost:8080 and check an indicator page renders its CMS
description.

## Troubleshooting

- **`no started VMs` / fly errors** — `fly auth login`; the remote is scale-to-zero, the script starts it.
- **`better-sqlite3` NODE_MODULE_VERSION** — you ran `strapi export` on the host. It only works inside the cms container; use `npm run db:cms:pull`.
- **Connection refused from containers** — host Postgres must accept connections and `DB_USER`/`DB_NAME` must match the compose defaults you exported.
- **Empty `/api/catalog`** — ixmp4 credentials in `.env` are wrong or the scan failed; check `docker compose logs api`.
