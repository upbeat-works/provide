# Local DB setup

From zero to a working local stack: one Postgres with two schemas — `catalog`
(the Hono API) and `strapi` (the CMS) — plus a copy of the remote CMS content.

## 0. Prerequisites

- Docker Desktop (running)
- Postgres 14+ on the **host**, listening on `:5432` (Homebrew: `brew install postgresql@16 && brew services start postgresql@16`).
  The containers reach it via `host.docker.internal`; Homebrew's default `trust`
  auth means no password.
- PostgreSQL client tools: `pg_dump`, `pg_restore`, and `psql`. Use a client version that supports the source server.

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

`cms/.env` needs local application secrets and media-store settings. Avoid giving
a local CMS write access to the live media store. Compose overrides its DB settings.

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

## 4. Copy CMS content into the local `strapi` schema

Source and destination must run the same Strapi version. For a live Strapi 4
database, follow [the migration guide](strapi-v5-migration-guide.md) on an isolated copy first.

Set up a PostgreSQL service in `~/.pg_service.conf` with the source host,
port, database, user, and required TLS settings. Store its password in
`~/.pgpass` with mode `0600`. Then run:

```bash
export CMS_PG_SERVICE=provide_cms
export DB_USER="$(whoami)"
export DB_NAME=provide
npm run db:cms:pull
```

This backs up the source, stops the local CMS, backs up its `strapi` schema,
replaces that schema, and starts the CMS. It overwrites local CMS edits.
Backups are saved in `cms/dumps/`. Keep them private.

The database copy includes media records, not files. Copy local uploads too,
or ensure the copied media URLs can be read from their existing store.

For a backup without a restore, run `npm run db:cms:dump`.
`npm run db:cms:import` accepts a native Strapi 5 archive at
`cms/dumps/strapi-transfer.tar.gz`; it is not a Strapi 4 upgrade command.

## 5. Check whether content needs repair

Do not run repairs after every copy. Check the copied data for missing slugs,
coverage, and scenario names that fail to match the catalog.

If a fresh live backup shows a repair is needed, rehearse it on that copy
with the CMS stopped. `db:cms:rekey` repairs scenario names.
`db:cms:coverage` stages coverage and optional slug recovery in drafts;
review each changed draft in the CMS before publishing. Publishing also
includes any other edits already in that draft.

## 6. Verify

```bash
npm test
psql -d "$DB_NAME" -At -c "select count(*) from catalog.indicators"
psql -d "$DB_NAME" -At -c "select \"UID\" from strapi.scenarios limit 5"
psql -d "$DB_NAME" -At -c "select id, slug, is_default from strapi.case_study_dynamics"
```

Check missing slugs against the source before deciding on a repair.

Then open http://localhost:8080 and check an indicator page renders its CMS
description.

## Troubleshooting

- **Connection refused from containers** — host Postgres must accept connections and `DB_USER`/`DB_NAME` must match the compose defaults you exported.
- **Empty `/api/catalog`** — ixmp4 credentials in `.env` are wrong or the scan failed; check `docker compose logs api`.
