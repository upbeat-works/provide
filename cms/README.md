# Provide CMS

Strapi 5.60.0 CMS for the Provide website. Self-contained (its own `yarn`
toolchain) and vendored into this monorepo under `cms/`.

- **Database:** shared Postgres, `strapi` schema (the API uses the `catalog`
  schema of the same database).
- **Media:** uploads go to the configured S3-compatible store (`@strapi/provider-upload-aws-s3`);
  existing assets keep their `res.cloudinary.com` URLs.

## Local development

Requires Node 26.13.0 and Yarn 1.22.22. Copy `.env.example` to `.env` and fill
in fresh local secrets (leave S3 vars unset to use local uploads). The DB
connects to the shared Postgres (`strapi` schema) via the discrete `DATABASE_*`
fields in `.env`.

```
yarn install --frozen-lockfile
yarn develop      # or, from the monorepo root: npm run dev:strapi
```

To copy production PostgreSQL content locally, use the service-based backup and
restore commands in [Strapi v5 migration guide](../docs/strapi-v5-migration-guide.md). Both source
and destination must already run the same Strapi version. Strapi 5 export
archives can also be imported with `npm run db:cms:import` from the repo root.

### Content that started life in code

The landing page analysis cards live in the localized `landing-analysis-card`
collection. On first startup, Strapi ensures the locales exist, creates and links the two
cards in each language, and grants public read access. A saved completion flag
prevents later startups from restoring deleted cards or overwriting editor choices.

Each card's Image field selects one image from the media library. On startup,
a separate one-time import uploads the two bundled images through the configured
upload provider and attaches them to existing cards with empty image fields.
Later restarts preserve image changes and removals. ImageAlt overrides the media
library's alternative text when filled in.

The landing page's "Learn about the Climate Risk Dashboard project" block is the
`landing-project` single type (a heading plus its two fixed cards, `Intro` and
`Highlights`). If the entry is missing, the block does not render. Seed the default copy and
grant Public read with:

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

## Scripts

- `yarn develop` — Strapi with autoReload.
- `yarn start` — Strapi without autoReload (production).
- `yarn build` — build the admin panel.
