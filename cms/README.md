# Provide CMS

Strapi 4.24.2 CMS for the Provide website. Self-contained (its own `yarn`
toolchain) and vendored into this monorepo under `cms/`.

- **Database:** shared Postgres, `strapi` schema (the API uses the `catalog`
  schema of the same database).
- **Media:** new uploads go to Cloudflare R2 (`@strapi/provider-upload-aws-s3`);
  existing assets keep their `res.cloudinary.com` URLs.

## Local development

Requires Node 20 (`nvm use 20`) and yarn. Copy `.env.example` to `.env` and fill
in fresh local secrets (R2 vars stay unset → local upload provider). The DB
connects to the shared Postgres (`strapi` schema) via the discrete `DATABASE_*`
fields in `.env`.

```
npm run develop   # or, from the monorepo root: yarn dev:strapi
```

Seed local content from the live snapshot (via Strapi, into the configured DB).
`seed.js` seeds every content type and then builds the methodology tab single
types from the seeded content:

```
node scripts/fetch-snapshot.js
node scripts/seed.js
```

Alternatively, pull the live remote CMS content into the local Postgres `strapi`
schema in one step (from the monorepo root):

```
npm run db:cms:pull      # fetch remote DB -> export -> back up -> import -> verify
```

`db:cms:pull` copies the remote SQLite DB down (read-only), exports a Strapi
transfer archive from it inside the cms container, backs up the local `strapi`
schema, then imports with `--force`. Media stays on R2 (only file-entry URLs
transfer). Stage toggles: `SKIP_FETCH=1` (reuse `cms/dumps/data-remote.db`),
`SKIP_IMPORT=1` (build the tarball only), `SKIP_BACKUP=1`, `SKIP_VERIFY=1`,
`KEEP_ASSETS=1` (bundle R2 media — large).

The lower-level pieces are still available: `db:cms:dump` writes a standalone
SQLite `.sql` backup of the remote (not loadable into Postgres as-is), and
`db:cms:import` imports an existing `cms/dumps/strapi-transfer.tar.gz` on its own.

### Content that started life in code

The landing page's "Learn about the Climate Risk Dashboard project" block is the
`landing-project` single type (a heading plus its two fixed cards, `Intro` and
`Highlights`). It is not in any snapshot — it was hardcoded markup before it was
content — so a fresh database (or a `db:cms:pull` from a remote that predates it)
has no entry, and the block simply doesn't render. Restore the shipped copy, and
grant Public read, with:

```bash
node scripts/seed-landing-project.js          # skips locales that already have content
node scripts/seed-landing-project.js --force  # reset back to the shipped copy
```

Run it with the dev server stopped (it boots Strapi programmatically); under the
Docker stack that means:

```bash
docker compose stop cms
docker compose run --rm cms node scripts/seed-landing-project.js
docker compose start cms
```

On the deployed instance, after a deploy has shipped the schema:

```bash
fly ssh console -a provide-cms -C \
  "/bin/sh -c 'cd /app && node scripts/seed-landing-project.js'"
```

`seed.js` already runs it as one of its steps.

## Scripts

- `npm run develop` — Strapi with autoReload.
- `npm run start` — Strapi without autoReload (production).
- `npm run build` — build the admin panel.
