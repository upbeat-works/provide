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

## Scripts

- `npm run develop` — Strapi with autoReload.
- `npm run start` — Strapi without autoReload (production).
- `npm run build` — build the admin panel.
