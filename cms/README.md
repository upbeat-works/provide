# Provide CMS

Strapi 4.24.2 CMS for the Provide website. Self-contained (its own `yarn`
toolchain) and vendored into this monorepo under `cms/`.

- **Hosting:** Fly.io app `provide-cms` (region `fra`), scale-to-zero.
- **Database:** SQLite on a Fly Volume (`provide_cms_data` → `/data/data.db`).
- **Media:** new uploads go to Cloudflare R2 (`@strapi/provider-upload-aws-s3`);
  existing assets keep their `res.cloudinary.com` URLs.

## Local development

Requires Node 20 (`nvm use 20`) and yarn. Copy `.env.example` to `.env` and fill
in fresh local secrets (R2 vars stay unset → local upload provider; DB defaults
to `database/data.db`, gitignored).

```
npm run develop   # or, from the monorepo root: yarn dev:strapi
```

Seed local content from the live snapshot (writes to `database/data.db`).
`seed.js` seeds every content type and then builds the methodology tab single
types from the seeded content:

```
node scripts/fetch-snapshot.js
node scripts/seed.js
```

## Deploy (Fly.io)

Deploys run automatically on push to `main` that touches `cms/**`
(`.github/workflows/deploy-cms.yml`, auth via the `FLY_API_TOKEN` repo secret).

### First-time setup

```bash
fly apps create provide-cms
fly volumes create provide_cms_data --region fra --size 1

# Secrets (generate app secrets fresh; do not reuse old values):
fly secrets set \
  APP_KEYS=... API_TOKEN_SALT=... ADMIN_JWT_SECRET=... JWT_SECRET=... \
  TRANSFER_TOKEN_SALT=... PUBLIC_URL=https://provide-cms.fly.dev \
  R2_BUCKET=... R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com \
  R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_PUBLIC_URL=https://<r2-domain>

fly deploy
```

### One-time content seed

After the first deploy (while the instance is idle), seed the volume on the
machine:

```bash
fly ssh console -a provide-cms -C \
  "/bin/sh -c 'cd /app && node scripts/fetch-snapshot.js && node scripts/seed.js'"
```

### Content that started life in code

The landing page's "Learn about the Climate Risk Dashboard project" block is the
`landing-project` single type (a heading plus its two fixed cards, `Intro` and
`Highlights`). It is not in any snapshot — it was hardcoded markup before it was
content — so a database that predates it has no entry and the block simply
doesn't render. Restore the shipped copy, and grant Public read, with:

```bash
node scripts/seed-landing-project.js          # skips locales that already have content
node scripts/seed-landing-project.js --force  # reset back to the shipped copy
```

Run it with the dev server stopped (it boots Strapi programmatically). On the
deployed instance, after a deploy has shipped the schema:

```bash
fly ssh console -a provide-cms -C \
  "/bin/sh -c 'cd /app && node scripts/seed-landing-project.js'"
```

`seed.js` already runs it as one of its steps.

## Scripts

- `npm run develop` — Strapi with autoReload.
- `npm run start` — Strapi without autoReload (production).
- `npm run build` — build the admin panel.
