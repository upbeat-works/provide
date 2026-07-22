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

Alternatively, pull the remote CMS data and import it (from the monorepo root):

```
npm run db:cms:dump      # pull the remote DB into cms/dumps/
npm run db:cms:import     # import it into the local Postgres `strapi` schema
```

## Scripts

- `npm run develop` — Strapi with autoReload.
- `npm run start` — Strapi without autoReload (production).
- `npm run build` — build the admin panel.
