# Staging Strapi — Design

## Goal

Stand up a second, independent Strapi instance the team can change freely
(content types, content, config) to **preview changes before touching the
shared production instance**. Production today is a single self-hosted Strapi on
Heroku (`https://provide-cms.herokuapp.com`) shared with the live site, so there
is nowhere safe to test edits.

## Constraints & context

- **Access we have:** Strapi **admin panel login only** (the `/admin`
  dashboard). No Heroku platform access — so no `heroku git:clone`, no config
  vars, no `pg_dump`.
- **Strapi version:** **v4** — confirmed by the frontend handling
  `data.data[].attributes` response shape (v5 dropped the `attributes` wrapper)
  and `X-Powered-By: Strapi` on the live host.
- **How the app uses Strapi:** read-only over REST with `populate=*`, via
  `loadFromStrapi()` in `src/lib/utils/apis.js`. Two locales are in use: `en`
  (fallback) and `en-EU` (`VITE_STRAPI_LOCALE`).
- **Content types (11):** `about`, `adaptation`, `case-study-dynamics`,
  `case-study-outro`, `contact`, `glossaries`, `indicators`, `issue`,
  `scenario-presets`, `scenarios`, `stories`.
- This is the **frontend + Hono API** monorepo. The Strapi source does **not**
  live here today — it only exists as the deployed Heroku app.

## Approach: reconstruct, don't recover

Because we have admin access but not the platform, we **reconstruct an
equivalent Strapi project** rather than recovering the original source. All
extraction is **read-only** against production — nothing is written to prod.

### What we can recover faithfully

1. **Schema** — with an admin JWT, the Content-Type Builder admin API returns
   every definition as JSON:
   - `GET /content-type-builder/content-types`
   - `GET /content-type-builder/components`

   These map almost directly onto Strapi project files
   (`src/api/<type>/content-types/<type>/schema.json` and `src/components/**`).
2. **Content** — pulled per type via REST `populate=*` for **both locales**
   (`en`, `en-EU`), including drafts via the admin content-manager API.
3. **Media** — download the uploaded files referenced by content and re-import
   into staging's upload provider.

### What we cannot recover (accepted caveat)

Any **custom server code** is not exposed by the admin API: custom
controllers / services / routes, middlewares, lifecycle hooks, installed
plugins beyond defaults, and `config/*` secrets. Since the frontend uses Strapi
purely as read-over-REST-with-populate, production is expected to be close to
**default + the i18n plugin**.

**Mitigation — verify by diffing:** after reconstruction, compare staging's REST
responses against production's for each content type and locale. Any structural
mismatch flags missing custom logic to address manually.

## Repo layout

Self-contained Strapi project as a subdirectory of this monorepo, alongside
`api/`. It keeps its **own toolchain** (npm + Strapi build) and is **not** part
of the bun workspace.

```
cms/
  src/
    api/…            # reconstructed content-types (the schema you'll change)
    components/…      # reconstructed components
  config/            # database.js, server.js, plugins.js (i18n)
  scripts/
    extract.js       # admin-API + REST extraction (schema, content, media)
    seed.js          # import extracted content + media into local DB
  Dockerfile         # release artifact, mirrors root Dockerfile
  package.json       # Strapi's own deps
  .env.example       # documents required Strapi env
```

## Components

1. **`cms/scripts/extract.js`** (read-only, against prod)
   - Authenticate to the admin API with admin credentials → admin JWT.
   - Fetch content-type + component schemas from the Content-Type Builder API.
   - Fetch content per type via REST `populate=*` for `en` and `en-EU`
     (drafts via content-manager API).
   - Download referenced media files.
   - Write a versioned snapshot to `cms/snapshot/` (schemas, content JSON,
     media) — the refreshable "copy of production".

2. **`cms/` Strapi project**
   - Scaffolded fresh **Strapi v4** with the **Postgres** connector.
   - Reconstructed schemas + components applied.
   - **i18n** enabled with locales `en` and `en-EU`.

3. **`cms/scripts/seed.js`**
   - Import the snapshot's content + media into the configured database via the
     Strapi entity API, preserving locales and relations.
   - Idempotent / refreshable.

4. **`cms/Dockerfile`**
   - Mirrors the root `Dockerfile` pattern (build deps → runtime, `EXPOSE`,
     external DB via env). Postgres is **external** (managed add-on / separate
     DB), as with the API.

## Environments

- **Local dev:** Strapi runs **natively** against **local Postgres** — no
  Docker. Started via a root-level script:

  ```jsonc
  // package.json (root)
  "scripts": {
    "dev:strapi": "cd cms && npm run develop"
  }
  ```

  `cms/.env` provides the DB connection plus Strapi secrets (`APP_KEYS`,
  `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `JWT_SECRET`, `TRANSFER_TOKEN_SALT`),
  generated fresh for staging (not copied from prod, which we don't have).

- **Staging/prod release:** the `cms/Dockerfile` image, deployed to Heroku (or
  any container host) with an external Postgres. Shareable preview URL.

## Data strategy

- Staging is seeded from a **read-only production snapshot** produced by
  `extract.js`, and is **refreshable** by re-running extract + seed.
- Production is **never written to**.

## Implementation flow

0. **Extract** — reconstruct schema + content + media from prod (admin API +
   REST). *Read-only.*
1. **Scaffold** — fresh Strapi v4 in `cms/`, Postgres connector, i18n; apply
   reconstructed schemas.
2. **Seed** — import snapshot content + media into local Postgres.
3. **Verify** — diff staging REST responses vs prod per type/locale; resolve
   gaps (flags any missing custom logic).
4. **Dockerize** — add `cms/Dockerfile`; confirm the image boots against an
   external Postgres.

## Out of scope

- Recovering production's custom server code / secrets (not exposed; handled via
  the diff-verify step).
- Automated continuous sync between prod and staging (snapshot is on-demand).
- Migrating the frontend to point at staging (a simple `VITE_HEROKU_URL`
  override when desired; not part of this work).

## Success criteria

- `dev:strapi` boots a local Strapi v4 admin against local Postgres.
- All 11 content types exist with their fields/relations/components and both
  locales.
- Seeded content + media render, and staging REST responses match production
  for each type/locale (diff-verify passes, or gaps are documented).
- `cms/Dockerfile` produces an image that boots against an external Postgres.
