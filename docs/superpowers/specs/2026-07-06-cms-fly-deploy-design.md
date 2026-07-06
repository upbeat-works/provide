# CMS → Fly.io Deploy — Design

## Goal

Move the vendored Strapi CMS (`cms/`) off Heroku and deploy it to **Fly.io**,
switch the database to **SQLite on a Fly Volume**, and switch media uploads off
Cloudinary to **Cloudflare R2**. The upstream Heroku git-push pipeline was
dropped when the source was vendored into this monorepo, so `cms/` currently has
**no deploy automation**. This design adds a Fly.io release path (config,
secrets, CI, persistent volume), replaces the DB and media providers, and
removes the remaining Heroku couplings, so the monorepo owns the CMS deploy end
to end.

## Context (from the repo)

- **`cms/`** is a self-contained **Strapi 4.24.2** project (Node 20.13.1, yarn),
  already containerized: `cms/Dockerfile` (Debian-slim base) builds the admin
  panel and runs `yarn start` on `:1337` with `HOST=0.0.0.0`,
  `NODE_ENV=production`. The Debian base (vs. Alpine) already supports native
  modules like `better-sqlite3` and `sharp`.
- **DB today = Postgres.** `config/database.js` (local defaults) and
  `config/env/production/database.js` (parses `DATABASE_URL`, SSL). `package.json`
  depends on `pg` + `pg-connection-string`. This is being replaced by SQLite.
- **Production config couples to Heroku:** `config/env/production/server.js` →
  `url: env("MY_HEROKU_URL")`; `scripts/fetch-snapshot.js` default source URL
  `provide-cms.herokuapp.com` (the *seed source*, not a deploy coupling).
- **Media today = Cloudinary.** `config/plugins.js` selects Cloudinary when
  `CLOUDINARY_NAME` is set, else the local filesystem provider. Existing content
  has **625 absolute `res.cloudinary.com` asset URLs** baked in (confirmed in the
  snapshot). The default CSP in `config/middlewares.js` allows `res.cloudinary.com`
  in `img-src`/`media-src`. Installed providers: `cloudinary`, `local` (no S3/R2
  provider yet).
- **Frontend** (SvelteKit, static/netlify adapter, **prerendered**) reads the CMS
  via `VITE_HEROKU_URL`. Because pages prerender at build time, the frontend's CI
  build hits the CMS — so the CMS must resolve reliably during a build, not only
  for interactive admin use. `VITE_HEROKU_URL` appears in exactly four active
  places: `src/lib/utils/apis.js`, `.github/workflows/deploy.yml`,
  `.github/workflows/pr-preview.yml`, and the root `.env`.
- The frontend's own deploy target is unaffected — only the CMS moves.

## Decisions (locked)

1. **Database:** **SQLite** on a **Fly Volume** (persistent block storage mounted
   at `/data`, DB file `/data/data.db`). No external DB vendor. Swap `pg` +
   `pg-connection-string` for `better-sqlite3`. Because SQLite is single-writer,
   the app runs on a **single machine**. Durability rests on the volume; Fly's
   built-in **daily volume snapshots (5-day retention)** are the only backup for
   now — no Litestream/point-in-time replication (can be added later).
2. **Deploy:** **GitHub Actions on push** to `main` (path-filtered to `cms/**`),
   mirroring the frontend's `deploy.yml`. Auth via a `FLY_API_TOKEN` secret.
3. **Content:** seed from the existing snapshot scripts (`fetch-snapshot.js` →
   `seed-from-rest.js`) — no Heroku DB access needed. The production volume is
   seeded once by running the scripts on the machine via `fly ssh` (see §7).
4. **Naming:** rename the Heroku-named public-URL vars to provider-neutral:
   `MY_HEROKU_URL` → `PUBLIC_URL` (CMS), `VITE_HEROKU_URL` → `VITE_CMS_URL`
   (frontend).
5. **Media:** **Cloudflare R2** for **new** uploads via the official
   `@strapi/provider-upload-aws-s3` (R2's S3-compatible endpoint). Existing
   Cloudinary URLs are **left as-is** — absolute strings that keep resolving from
   `res.cloudinary.com`; no asset migration. The Cloudinary provider dependency
   is removed.

### Defaulted sub-choices (adjustable)

- **App name:** `provide-cms` (Fly names are global; fall back to
  `provide-cms-iiasa` if taken). URL → `https://provide-cms.fly.dev`.
- **Region:** `fra` (Frankfurt).
- **Volume:** name `provide_cms_data`, `1gb`, region `fra`.
- **Scaling:** **scale-to-zero** — `min_machines_running = 0`,
  `auto_stop_machines = "suspend"`, `auto_start_machines = true`. Suspend
  (RAM-snapshot resume, ~seconds) beats `stop` (full ~15s Strapi cold boot). The
  single machine keeps its volume across suspend/resume and across in-place
  deploys.
- **VM:** `shared-cpu-1x`, `1gb` memory (Strapi runtime headroom; 512 MB risks
  OOM).

## Files

**New**
- `cms/fly.toml` — Fly app config (build via existing Dockerfile, volume mount,
  scale-to-zero, health check).
- `.github/workflows/deploy-cms.yml` — CI deploy on push to `cms/**`.

**Modified**
- `cms/config/database.js` — replace Postgres with SQLite (`client: 'sqlite'`,
  `filename` from `DATABASE_FILENAME`).
- `cms/config/plugins.js` — upload provider R2-conditional (aws-s3 → R2 when
  configured, else local); Cloudinary block removed.
- `cms/config/middlewares.js` — CSP `img-src`/`media-src` allow the R2 public
  host (from env) alongside the retained `res.cloudinary.com`.
- `cms/config/env/production/server.js` — `MY_HEROKU_URL` → `PUBLIC_URL`.
- `cms/package.json` + `cms/yarn.lock` — remove `pg`, `pg-connection-string`,
  `@strapi/provider-upload-cloudinary`; add `better-sqlite3` and
  `@strapi/provider-upload-aws-s3` (4.24.2).
- `cms/tests/plugins.test.js` — assert the R2/local decision (was Cloudinary).
- `cms/.env.example` — SQLite (`DATABASE_FILENAME`) + R2 vars; drop Postgres vars.
- `cms/README.md` — drop Heroku/Cloudinary/Postgres; document Fly + volume + R2
  setup, CI, and one-time seed.
- `src/lib/utils/apis.js` — `VITE_HEROKU_URL` → `VITE_CMS_URL`.
- `.github/workflows/deploy.yml` — `VITE_HEROKU_URL` → `VITE_CMS_URL`.
- `.github/workflows/pr-preview.yml` — `VITE_HEROKU_URL` → `VITE_CMS_URL`.
- root `.env` (local, likely uncommitted) — `VITE_HEROKU_URL` → `VITE_CMS_URL`.

**Deleted**
- `cms/config/env/production/database.js` — the SQLite base config in
  `config/database.js` (with `DATABASE_FILENAME` env) applies to all
  environments; no Postgres/`DATABASE_URL` override remains.

**Unchanged**
- `cms/Dockerfile` — already boots correctly; no DB or backup tooling to add.
- `cms/scripts/fetch-snapshot.js`, `cms/scripts/seed-from-rest.js` — boot Strapi
  against the configured DB, which is now SQLite; no code change.
- Existing content's Cloudinary asset URLs — kept verbatim.

## Components

### 1. `cms/fly.toml`

```toml
app = "provide-cms"
primary_region = "fra"

[build]
  dockerfile = "Dockerfile"

[env]
  DATABASE_FILENAME = "/data/data.db"

[mounts]
  source = "provide_cms_data"
  destination = "/data"

[http_service]
  internal_port = 1337
  force_https = true
  auto_stop_machines = "suspend"
  auto_start_machines = true
  min_machines_running = 0

  [[http_service.checks]]
    interval = "30s"
    timeout = "5s"
    grace_period = "20s"
    method = "GET"
    path = "/_health"

[[vm]]
  size = "shared-cpu-1x"
  memory = "1gb"
```

Notes: the volume mount at `/data` makes `/data/data.db` survive deploys and
suspend/resume (the container rootfs does not). `internal_port = 1337` matches
the Dockerfile's `PORT`. Strapi's `/_health` returns `204` (2xx → check passes);
`grace_period` covers boot. Single machine only (one volume, single SQLite
writer) — Fly updates it in place on deploy, preserving the volume.

### 2. Database — SQLite

Replace `config/database.js` with a SQLite config used in every environment
(local dev falls back to `.tmp/data.db`; production sets `DATABASE_FILENAME` to
the volume path):

```js
module.exports = ({ env }) => ({
  connection: {
    client: 'sqlite',
    connection: {
      filename: env('DATABASE_FILENAME', '.tmp/data.db'),
    },
    useNullAsDefault: true,
  },
});
```

Delete `config/env/production/database.js` (no more `DATABASE_URL`/SSL). In
`package.json`, remove `pg` and `pg-connection-string`, add `better-sqlite3`
(Strapi 4's SQLite driver; the Debian-slim base builds/uses its node-20 glibc
prebuild — pin the version compatible with Strapi 4.24.2's bundled knex, verified
at implementation).

### 3. Media — Cloudflare R2 (S3-compatible)

**`config/plugins.js`** — swap the Cloudinary-conditional upload block for an
R2-conditional one. Use `aws-s3` when `R2_BUCKET` is set (production), else the
local provider (local dev, no creds needed to boot):

```js
const bucket = env('R2_BUCKET');
const upload = bucket
  ? {
      config: {
        provider: 'aws-s3',
        providerOptions: {
          baseUrl: env('R2_PUBLIC_URL'), // public serving URL (custom domain / r2.dev)
          s3Options: {
            endpoint: env('R2_ENDPOINT'), // https://<accountid>.r2.cloudflarestorage.com
            region: 'auto',
            credentials: {
              accessKeyId: env('R2_ACCESS_KEY_ID'),
              secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
            },
            params: { Bucket: bucket },
          },
        },
        actionOptions: { upload: {}, uploadStream: {}, delete: {} },
      },
    }
  : { config: { provider: 'local', providerOptions: { sizeLimit: 100 * 1024 * 1024 } } };
```

`@strapi/provider-upload-aws-s3@4.24.2` uses the AWS SDK v3 shape (`s3Options`)
and supports `baseUrl`, required for R2 because the S3 API endpoint is not
publicly readable — `baseUrl` makes Strapi store/return the public bucket URL.

**`config/middlewares.js`** — convert to the `({ env }) => [...]` factory form
and add the R2 public host to the CSP so admin previews of new uploads load,
keeping Cloudinary for existing assets:

```js
module.exports = ({ env }) => {
  const publicUrl = env('R2_PUBLIC_URL');
  const r2Host = publicUrl ? new URL(publicUrl).host : null;
  const assetHosts = ['res.cloudinary.com', ...(r2Host ? [r2Host] : [])];
  return [
    'strapi::errors',
    { name: 'strapi::security', config: { contentSecurityPolicy: { useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': ["'self'", 'data:', 'blob:', ...assetHosts],
          'media-src': ["'self'", 'data:', 'blob:', ...assetHosts],
          upgradeInsecureRequests: null,
        } } } },
    'strapi::cors', 'strapi::poweredBy', 'strapi::logger', 'strapi::query',
    'strapi::body', 'strapi::session', 'strapi::favicon', 'strapi::public',
  ];
};
```

**`package.json`** — add `"@strapi/provider-upload-aws-s3": "4.24.2"`, remove
`"@strapi/provider-upload-cloudinary"`; regenerate `yarn.lock`.

**Env vars (new, prod-only):** `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`. Unset locally → local provider.

### 4. Secrets (`fly secrets set`)

Set on the Fly app (never committed): `APP_KEYS`, `API_TOKEN_SALT`,
`ADMIN_JWT_SECRET`, `JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `R2_BUCKET`,
`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`,
`PUBLIC_URL` (= the app URL). `DATABASE_FILENAME`, `NODE_ENV`, `HOST`, `PORT`
are non-secret (fly.toml `[env]` / Dockerfile). Generate fresh app secrets — do
not reuse Heroku's.

### 5. CI — `.github/workflows/deploy-cms.yml`

```yaml
name: Deploy CMS
on:
  push:
    branches: [main]
    paths:
      - 'cms/**'
      - '.github/workflows/deploy-cms.yml'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    concurrency:
      group: deploy-cms
      cancel-in-progress: true
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        working-directory: cms
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

`--remote-only` builds on Fly's builders (no Docker in the runner). Path filter
keeps CMS deploys independent of the frontend deploy. `concurrency` prevents
overlapping deploys onto the single machine/volume.

### 6. Env var rename

- `cms/config/env/production/server.js`: `url: env("PUBLIC_URL")`.
- `src/lib/utils/apis.js`: `const ENV_URL_CONTENT = import.meta.env.VITE_CMS_URL;`.
- `.github/workflows/deploy.yml` & `pr-preview.yml`:
  `VITE_CMS_URL: ${{ secrets.VITE_CMS_URL }}`.
- root `.env`: `VITE_CMS_URL=…`.

### 7. Content seed (one-time, onto the volume)

Seed the volume by running the existing scripts **on the machine via `fly ssh`**,
right after the first deploy while the instance is idle (no editors yet):

```bash
# Machine must be up (hit the URL or `fly machine start` if scaled to zero)
fly ssh console -a provide-cms -C \
  "/bin/sh -c 'cd /app && node scripts/fetch-snapshot.js && node scripts/seed-from-rest.js'"
```

`fetch-snapshot.js` pulls a read-only snapshot from the live Heroku REST API
into `/app/.snapshot`; `seed-from-rest.js` boots Strapi via `.load()` (no HTTP
port bound → no conflict with the running server) and writes to
`/data/data.db` (the machine's `DATABASE_FILENAME`). It creates file rows for
existing Cloudinary media (absolute URLs preserved), imports published content
per locale, wires the `scenario ↔ scenario-preset` relation, and grants Public
read. Safe against the idle live server: SQLite's busy-timeout absorbs any brief
write overlap; corruption is not possible under SQLite's locking. Repeatable if
the content needs re-pulling. (For local dev, run the same two scripts with the
default `.tmp/data.db`.)

### 8. `cms/README.md`

Rewrite: remove the Heroku banner and Cloudinary/Postgres notes; add Fly
first-time setup (`fly apps create provide-cms`, `fly volumes create
provide_cms_data`, create the R2 bucket + token + public domain, `fly secrets
set …`, `fly deploy`), the one-time seed (§7), the CI flow (auto-deploy on push
to `cms/**`, `FLY_API_TOKEN` secret). Keep the develop/start/build sections; note
DB = SQLite on the volume, media = R2 (new uploads) with existing assets on
Cloudinary.

## Operator steps (outside the code change)

These require account access and cannot be scripted in the repo:

1. **Fly app + volume:** `fly apps create provide-cms`; `fly volumes create
   provide_cms_data --region fra --size 1`.
2. **R2:** create a bucket; create an S3 API token (access key/secret); enable a
   public URL (bucket `r2.dev` or a custom domain) for `R2_PUBLIC_URL`; note the
   account S3 endpoint for `R2_ENDPOINT`.
3. **Secrets:** `fly secrets set …` for every secret in §4.
4. **Deploy:** `fly deploy` (first deploy boots Strapi on the empty volume).
5. **Seed:** run the one-time seed on the running machine (§7).
6. **GitHub:** add repo secret `FLY_API_TOKEN` (`fly tokens create deploy`);
   rename secret `VITE_HEROKU_URL` → `VITE_CMS_URL` and point it at
   `https://provide-cms.fly.dev` (both `deploy` and `pr-preview` read it).
7. **Cutover:** verify the frontend renders against the Fly URL (existing
   Cloudinary images still resolve), then retire the Heroku instance.

## Out of scope

- DB backups beyond Fly's default daily volume snapshots (Litestream →
  private R2 bucket, or a periodic `sqlite3 .backup` to R2, can be added later
  without app changes).
- Migrating the 625 existing Cloudinary assets to R2 (chosen: leave URLs as-is;
  R2 is for new uploads).
- Decommissioning the Heroku instance (it stays as the seed source until cutover
  is verified) and changing the frontend's own deploy target.
- A staging Fly app / horizontal scaling (single machine by SQLite's design).

## Success criteria

- `cms/fly.toml` + `cms/Dockerfile` deploy via `flyctl deploy` to a running Fly
  app that boots Strapi on `:1337` against `/data/data.db`; `/_health` returns
  `204`.
- The SQLite DB **survives a redeploy** (content persists on the volume across
  `fly deploy`).
- Pushing a change under `cms/**` to `main` triggers `deploy-cms.yml` and
  redeploys the app.
- The one-time seed (§7) populates the volume; the 11 frontend-consumed
  endpoints return data.
- A new image uploaded in the admin lands in R2 and serves from `R2_PUBLIC_URL`;
  existing Cloudinary-hosted images still render.
- The frontend, with `VITE_CMS_URL` pointed at the Fly URL, renders CMS content.
- No `MY_HEROKU_URL` / `VITE_HEROKU_URL` references remain in active code or
  workflows; no `heroku`/Postgres/Cloudinary coupling remains in `cms/`.
```
