# Staging Strapi — Design

## Goal

Stand up an independent Strapi instance the team can change freely (content
types, content, config) to **preview changes before touching the shared
production instance** (`https://provide-cms.herokuapp.com`, currently the only
instance and shared with the live site).

## Context (from the real source)

The Strapi source now exists at `../provide-cms` (GitHub `jnsprnw/provide-cms`,
deployed to Heroku via git push). Key facts read from it:

- **Strapi 4.24.2**, **Node 20.13.1**, **yarn**. Scripts: `develop`, `start`,
  `build`.
- **Database:** Postgres. Local defaults (`config/database.js`): db
  `provide-cms`, user `jonas`, empty password, `localhost:5432`. Production
  (`config/env/production/database.js`) parses `DATABASE_URL` with SSL.
- **Media:** **Cloudinary** upload provider (`config/plugins.js`) — assets live
  in a shared Cloudinary cloud, not on the dyno filesystem.
- **Plugins:** i18n, users-permissions, cloudinary upload provider.
- **Required env:** `APP_KEYS, JWT_SECRET, API_TOKEN_SALT, ADMIN_JWT_SECRET,
  CLOUDINARY_NAME/KEY/SECRET` (plus DB vars).
- **15 content types** — a superset of the 11 the frontend reads. Frontend
  endpoints (Strapi-pluralized) all map to repo types: `about, adaptation,
  case-study-dynamics, case-study-outro, contact, glossaries, indicators, issue,
  scenario-presets, scenarios, stories`.
- **Access we have:** Strapi **admin** login + the **source repo**. No Heroku
  platform access (so no `DATABASE_URL`, no `pg_dump`).

## Decisions

- **Home:** **vendor** the source into this monorepo as `cms/` — self-contained,
  its own yarn toolchain, **not** part of the bun workspace. (Accepted trade-off:
  gives up the tie to `jnsprnw/provide-cms` history and its Heroku pipeline; the
  team owns `cms/` going forward. The vendored copy drops the upstream `.git`.)
- **Local dev:** run Strapi natively against **local Postgres** — no Docker.
  Started via a root script `dev:strapi`.
- **Media:** staging uses Strapi's **local upload provider** (filesystem), not
  Cloudinary. Existing content keeps its absolute Cloudinary URLs (they still
  resolve read-only); new uploads in staging land on the local provider. No
  Cloudinary creds needed in staging, zero risk to prod's shared media library.
- **Data:** seed staging from a **production snapshot** via `strapi transfer`,
  authorized by an **admin-generated transfer token** — no Heroku access
  required. Refreshable on demand.
- **Release artifact:** a `cms/Dockerfile` (mirroring the API's Dockerfile
  pattern) so staging/prod can deploy as a container, external Postgres via env.

## Repo layout

```
cms/                       # vendored Strapi 4.24.2 project (self-contained)
  config/
    database.js            # unchanged (local Postgres defaults)
    plugins.js             # MODIFIED: upload provider conditional (see below)
    env/production/…        # unchanged (DATABASE_URL, MY_HEROKU_URL)
  src/api/…                # 15 content types (the schema you'll change)
  src/components/…
  public/ types/ favicon.ico
  package.json yarn.lock   # Strapi's own toolchain (yarn)
  .env.example             # documents required env for local dev
  Dockerfile               # release artifact, external Postgres
  README.md                # vendored + a "run from the monorepo" note
```

Root `package.json` gains:

```jsonc
"scripts": {
  "dev:strapi": "cd cms && yarn develop"
}
```

Root `.gitignore` gains the Strapi-generated paths: `cms/node_modules`,
`cms/.env`, `cms/.tmp`, `cms/build`, `cms/.cache`, `cms/dist`, `cms/.strapi`,
`cms/public/uploads` (local-provider media).

## Components

1. **Vendored `cms/` project** — copied from `../provide-cms` minus its `.git`.
   Committed into the monorepo as-is except the two changes below.

2. **`cms/config/plugins.js`** (only source change)
   Make the upload provider **conditional**: use Cloudinary only when
   `CLOUDINARY_NAME` is set (production), otherwise fall back to Strapi's default
   **local** provider. This lets prod keep Cloudinary while local dev / staging
   run without Cloudinary creds — one config, env-driven.

3. **`cms/.env.example`** — documents the local dev env: `HOST`, `PORT`,
   `APP_KEYS`, `JWT_SECRET`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`,
   `DATABASE_NAME/USERNAME/PASSWORD` (Cloudinary vars documented as optional /
   prod-only). Secrets are generated fresh for staging, not copied from prod.

4. **Data seeding — `strapi transfer` pull**
   - In prod admin (Settings → Transfer Tokens) generate a transfer token.
   - Locally: `cd cms && yarn strapi transfer --from https://provide-cms.herokuapp.com/admin --from-token <token> --exclude files`.
   - Content + relations + locales come across into local Postgres. `--exclude
     files` skips asset re-upload, so media entries retain their absolute
     Cloudinary URLs and render read-only from Cloudinary. (Drop the flag to
     fully localize assets onto the local provider instead.)
   - Refreshable by re-running the transfer.

5. **`cms/Dockerfile`** — mirrors the root `Dockerfile` pattern: Node 20 base →
   `yarn install --frozen-lockfile` → `yarn build` → `EXPOSE 1337` →
   `yarn start`. Postgres is external (`DATABASE_URL` / DB env). Deployable to
   Heroku (container) or any container host for a shareable preview.

## Environments

- **Local dev:** `dev:strapi` (root) → native Strapi admin on `:1337` against
  local Postgres, local upload provider, seeded from a prod transfer snapshot.
- **Staging/prod release:** the `cms/Dockerfile` image with an external Postgres;
  Cloudinary env set only if that environment should use Cloudinary.

## Prerequisites (local)

- Node 20.13.1 (`.node-version`), yarn.
- Local Postgres with a `provide-cms` database reachable per `cms/.env`.

## Implementation flow

0. **Vendor** — copy `../provide-cms` (minus `.git`) into `cms/`; update root
   `package.json` (`dev:strapi`) and `.gitignore`.
1. **Local boot** — create `cms/.env`, ensure local Postgres `provide-cms` db,
   `dev:strapi` boots an empty admin on `:1337`.
2. **Conditional upload** — make `cms/config/plugins.js` env-driven; confirm
   local boot uses the local provider with no Cloudinary creds.
3. **Seed** — generate a prod transfer token; `strapi transfer` pulls content
   into local Postgres; verify content renders.
4. **Verify** — point the frontend's `VITE_HEROKU_URL` at
   `http://localhost:1337` and confirm the 11 consumed content types load.
5. **Dockerize** — add `cms/Dockerfile`; confirm the image boots against an
   external Postgres.

## Out of scope

- Migrating the live prod deploy off `jnsprnw/provide-cms` (separate effort;
  vendoring doesn't touch prod).
- Automated continuous prod→staging sync (transfer is on-demand).
- A second Cloudinary for staging (chosen local provider instead).

## Success criteria

- `dev:strapi` boots Strapi 4.24.2 admin on `:1337` against local Postgres with
  the local upload provider (no Cloudinary creds required).
- All 15 content types load in the admin; the 11 frontend-consumed endpoints
  return data after seeding.
- `strapi transfer` populates local content from prod, and it is repeatable.
- Pointing `VITE_HEROKU_URL` at the local instance renders the site.
- `cms/Dockerfile` builds an image that boots against an external Postgres.
