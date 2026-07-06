# CMS → Fly.io Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the vendored Strapi CMS (`cms/`) to Fly.io on SQLite (a Fly Volume) with Cloudflare R2 for new media uploads, automated via GitHub Actions, and strip the remaining Heroku couplings.

**Architecture:** `cms/` stays a self-contained Strapi 4.24.2 project. The DB becomes SQLite at `/data/data.db` on a Fly Volume (single machine, scale-to-zero via `suspend`). The upload provider becomes `@strapi/provider-upload-aws-s3` pointed at R2 when configured, else the local provider. A path-filtered `deploy-cms.yml` runs `flyctl deploy` on push to `cms/**`. Existing Cloudinary asset URLs are left resolving as-is (no migration). Config modules are pure `({ env }) => …` functions unit-tested with `bun test`; a final Docker smoke test proves the image builds on SQLite and the volume persists.

**Tech Stack:** Strapi 4.24.2, Node 20.13.1, yarn (in `cms/`), `better-sqlite3` 9.4.3, `@strapi/provider-upload-aws-s3` 4.24.2, Fly.io (Machines + Volumes), Cloudflare R2, GitHub Actions. Tests run with `bun test` from the monorepo root.

## Global Constraints

- **Strapi 4.24.2 / Node 20.13.1 / yarn** — do not upgrade Strapi or switch package managers; `cms/` keeps its own `yarn.lock`. `cms/` yarn commands require Node 20 (`nvm use 20`).
- **`cms/` is self-contained** — its own toolchain; NOT added to the bun workspace or root `bun.lock`. Only `bun test` (root) runs the `cms/tests/*` unit tests.
- **`better-sqlite3` pinned to `9.4.3`** — ships Node-20 (ABI 115) glibc prebuilds, so it installs on the Debian-slim image without a compiler (matches how `sharp` already works).
- **Single machine only** — SQLite is single-writer; the app runs one Fly machine bound to one volume. Do not scale horizontally.
- **Media:** R2 for new uploads only. Existing `res.cloudinary.com` URLs are absolute strings in content — leave them untouched; keep `res.cloudinary.com` in the CSP.
- **NO automatic git commits.** Every task ends by staging changes and pausing for the user to review and commit. Do NOT run `git commit`, merge, push, or open PRs.
- **RED before GREEN:** each behavioral change starts with a test that runs the real (current) module and fails on an assertion — never on a missing import.

---

## File Structure

- `cms/config/database.js` — MODIFIED: SQLite config (Task 1)
- `cms/config/env/production/database.js` — DELETED: no more Postgres/`DATABASE_URL` (Task 1)
- `cms/config/plugins.js` — MODIFIED: R2-conditional upload provider (Task 2)
- `cms/config/middlewares.js` — MODIFIED: factory form + R2 host in CSP (Task 3)
- `cms/config/env/production/server.js` — MODIFIED: `MY_HEROKU_URL` → `PUBLIC_URL` (Task 4)
- `cms/package.json`, `cms/yarn.lock` — MODIFIED: swap deps (Tasks 1, 2)
- `cms/.env.example` — MODIFIED: SQLite + R2 vars (Task 1)
- `cms/tests/database.test.js` — NEW (Task 1)
- `cms/tests/plugins.test.js` — MODIFIED: R2 assertions (Task 2)
- `cms/tests/middlewares.test.js` — NEW (Task 3)
- `cms/fly.toml` — NEW: Fly app config (Task 5)
- `cms/README.md` — MODIFIED: Fly + volume + R2 docs (Task 7)
- `src/lib/utils/apis.js` — MODIFIED: `VITE_HEROKU_URL` → `VITE_CMS_URL` (Task 4)
- `.github/workflows/deploy.yml`, `.github/workflows/pr-preview.yml` — MODIFIED: `VITE_CMS_URL` (Task 4)
- `.github/workflows/deploy-cms.yml` — NEW: CMS deploy CI (Task 6)
- `.env` (root) — MODIFIED (local, uncommitted): `VITE_CMS_URL` (Task 4)

---

## Task 1: Switch the database to SQLite

**Files:**
- Modify: `cms/config/database.js`
- Delete: `cms/config/env/production/database.js`
- Modify: `cms/package.json` (deps), `cms/yarn.lock`
- Modify: `cms/.env.example`
- Test: `cms/tests/database.test.js`

**Interfaces:**
- Produces: `cms/config/database.js` exporting `({ env }) => object` where `object.connection.client === 'sqlite'`, `object.connection.connection.filename` comes from `env('DATABASE_FILENAME', '.tmp/data.db')`, and `object.connection.useNullAsDefault === true`.

- [ ] **Step 1: Write the failing test**

Create `cms/tests/database.test.js`:

```js
import { test, expect } from 'bun:test';

// Strapi config modules are CommonJS: ({ env }) => ({...}). Tests live in
// cms/tests/ (not cms/config/) so Strapi does not auto-load them at boot.
const database = require('../config/database.js');

// Minimal stand-in for Strapi's `env` helper.
const envWith = (vars) => {
  const fn = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.int = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.bool = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.array = (key, fallback) => (key in vars ? vars[key] : fallback);
  return fn;
};

test('uses the sqlite client', () => {
  const cfg = database({ env: envWith({}) });
  expect(cfg.connection.client).toBe('sqlite');
});

test('defaults the sqlite file to .tmp/data.db when DATABASE_FILENAME is unset', () => {
  const cfg = database({ env: envWith({}) });
  expect(cfg.connection.connection.filename).toBe('.tmp/data.db');
});

test('honors DATABASE_FILENAME (the Fly volume path in production)', () => {
  const cfg = database({ env: envWith({ DATABASE_FILENAME: '/data/data.db' }) });
  expect(cfg.connection.connection.filename).toBe('/data/data.db');
});

test('sets useNullAsDefault (knex requires it for sqlite)', () => {
  const cfg = database({ env: envWith({}) });
  expect(cfg.connection.useNullAsDefault).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails on behavior**

Run: `bun test cms/tests/database.test.js`
Expected: FAIL — the current `database.js` returns `client: 'postgres'`, so `expect(...).toBe('sqlite')` fails on the value. The module loads and runs (behavior failure, not an import error).

- [ ] **Step 3: Replace `cms/config/database.js` with the SQLite config**

Replace the entire file contents with:

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

- [ ] **Step 4: Delete the production Postgres override**

Run:
```bash
git rm cms/config/env/production/database.js
```
Rationale: the base `config/database.js` (SQLite, `DATABASE_FILENAME`-driven) now applies to every environment; the Postgres/`DATABASE_URL` override is obsolete.

- [ ] **Step 5: Swap the database dependency in `cms/package.json`**

In `cms/package.json` `"dependencies"`, remove these two lines:
```jsonc
    "pg": "^8.11.5",
    "pg-connection-string": "^2.6.4",
```
and add (keep dependencies alphabetically reasonable — place after the `@strapi/*` entries):
```jsonc
    "better-sqlite3": "9.4.3",
```

- [ ] **Step 6: Update the lockfile and confirm the native driver loads**

Run (Node 20 required for `cms/` yarn):
```bash
cd cms && yarn install && node -e "require('better-sqlite3'); console.log('better-sqlite3 OK')" && cd ..
```
Expected: yarn resolves the lockfile without `pg`; `better-sqlite3 OK` prints (the prebuilt binary loaded — no compiler needed).

- [ ] **Step 7: Rewrite `cms/.env.example` for SQLite + R2**

Replace the entire file contents with:

```dotenv
# Local development env for the vendored Strapi (cms/).
# Copy to cms/.env and fill in. Secrets below are LOCAL-ONLY — generate fresh,
# do not reuse production values.

HOST=0.0.0.0
PORT=1337

# App secrets — generate each with: openssl rand -base64 16
APP_KEYS=key1==,key2==
API_TOKEN_SALT=replace-me
ADMIN_JWT_SECRET=replace-me
JWT_SECRET=replace-me
TRANSFER_TOKEN_SALT=replace-me

# SQLite database file. Unset → .tmp/data.db (see config/database.js).
# In production (Fly) this is the volume path, e.g. /data/data.db.
# DATABASE_FILENAME=.tmp/data.db

# Cloudflare R2 (media uploads) — intentionally UNSET locally, so the built-in
# local filesystem provider is used (see config/plugins.js). Set these only in
# environments that upload to R2 (production).
# R2_BUCKET=
# R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
# R2_ACCESS_KEY_ID=
# R2_SECRET_ACCESS_KEY=
# R2_PUBLIC_URL=https://<public-r2-domain>
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `bun test cms/tests/database.test.js`
Expected: PASS — 4 tests pass.

- [ ] **Step 9: Checkpoint — stage and pause for review**

Run:
```bash
git add cms/config/database.js cms/package.json cms/yarn.lock cms/.env.example cms/tests/database.test.js
git rm --cached cms/config/env/production/database.js 2>/dev/null || true
git status
```
Do NOT commit. Report the staged file list and pause for the user to review and commit.

---

## Task 2: Point the upload provider at Cloudflare R2

**Files:**
- Modify: `cms/config/plugins.js`
- Modify: `cms/tests/plugins.test.js`
- Modify: `cms/package.json` (deps), `cms/yarn.lock`

**Interfaces:**
- Consumes: `cms/config/plugins.js` from the vendored source (currently Cloudinary-conditional on `CLOUDINARY_NAME`).
- Produces: `cms/config/plugins.js` exporting `({ env }) => object` where `object.upload.config.provider` is `'aws-s3'` when `env('R2_BUCKET')` is truthy (with `providerOptions.baseUrl` from `R2_PUBLIC_URL` and `providerOptions.s3Options.params.Bucket` from `R2_BUCKET`), else `'local'`. The `'users-permissions'` block with `jwtSecret: env('JWT_SECRET')` is preserved.

- [ ] **Step 1: Rewrite the test for the R2 decision**

Replace the entire contents of `cms/tests/plugins.test.js` with:

```js
import { test, expect } from 'bun:test';

const plugins = require('../config/plugins.js');

const envWith = (vars) => {
  const fn = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.int = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.bool = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.array = (key, fallback) => (key in vars ? vars[key] : fallback);
  return fn;
};

test('falls back to the local upload provider when R2_BUCKET is unset', () => {
  const cfg = plugins({ env: envWith({}) });
  expect(cfg.upload.config.provider).toBe('local');
});

test('uses the aws-s3 provider pointed at R2 when R2_BUCKET is set', () => {
  const cfg = plugins({
    env: envWith({
      R2_BUCKET: 'media',
      R2_ENDPOINT: 'https://acc.r2.cloudflarestorage.com',
      R2_ACCESS_KEY_ID: 'k',
      R2_SECRET_ACCESS_KEY: 's',
      R2_PUBLIC_URL: 'https://cdn.example.com',
    }),
  });
  const opts = cfg.upload.config.providerOptions;
  expect(cfg.upload.config.provider).toBe('aws-s3');
  expect(opts.baseUrl).toBe('https://cdn.example.com');
  expect(opts.s3Options.endpoint).toBe('https://acc.r2.cloudflarestorage.com');
  expect(opts.s3Options.region).toBe('auto');
  expect(opts.s3Options.params.Bucket).toBe('media');
  expect(opts.s3Options.credentials.accessKeyId).toBe('k');
});

test('preserves the users-permissions jwtSecret wiring', () => {
  const cfg = plugins({ env: envWith({ JWT_SECRET: 'shhh' }) });
  expect(cfg['users-permissions'].config.jwtSecret).toBe('shhh');
});
```

- [ ] **Step 2: Run the test to verify it fails on behavior**

Run: `bun test cms/tests/plugins.test.js`
Expected: FAIL — the current `plugins.js` keys off `CLOUDINARY_NAME`, so with only `R2_BUCKET` set it returns `provider: 'local'`; the `'aws-s3'` assertion fails on the value. (Runs the real module — behavior failure.)

- [ ] **Step 3: Replace `cms/config/plugins.js` with the R2-conditional provider**

Replace the entire file contents with:

```js
module.exports = ({ env }) => {
  const bucket = env('R2_BUCKET');

  // Cloudflare R2 (S3-compatible) in environments that configure it (production);
  // the built-in local filesystem provider everywhere else (local dev), so no
  // object-store credentials are required to boot.
  const upload = bucket
    ? {
        config: {
          provider: 'aws-s3',
          providerOptions: {
            baseUrl: env('R2_PUBLIC_URL'),
            s3Options: {
              endpoint: env('R2_ENDPOINT'),
              region: 'auto',
              credentials: {
                accessKeyId: env('R2_ACCESS_KEY_ID'),
                secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
              },
              params: {
                Bucket: bucket,
              },
            },
          },
          actionOptions: {
            upload: {},
            uploadStream: {},
            delete: {},
          },
        },
      }
    : {
        config: {
          provider: 'local',
          providerOptions: {
            sizeLimit: 100 * 1024 * 1024, // 100 MB
          },
        },
      };

  return {
    'users-permissions': {
      config: {
        jwtSecret: env('JWT_SECRET'),
      },
    },
    upload,
  };
};
```

- [ ] **Step 4: Swap the upload-provider dependency in `cms/package.json`**

In `cms/package.json` `"dependencies"`, remove:
```jsonc
    "@strapi/provider-upload-cloudinary": "^4.24.2",
```
and add (next to the other `@strapi/*` providers):
```jsonc
    "@strapi/provider-upload-aws-s3": "4.24.2",
```

- [ ] **Step 5: Update the lockfile**

Run:
```bash
cd cms && yarn install && cd ..
```
Expected: yarn resolves `@strapi/provider-upload-aws-s3@4.24.2`, drops the cloudinary provider, updates `yarn.lock`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `bun test cms/tests/plugins.test.js`
Expected: PASS — 3 tests pass.

- [ ] **Step 7: Checkpoint — stage and pause for review**

Run:
```bash
git add cms/config/plugins.js cms/tests/plugins.test.js cms/package.json cms/yarn.lock
```
Do NOT commit. Pause for the user to review and commit.

---

## Task 3: Allow the R2 host in the admin CSP

**Files:**
- Modify: `cms/config/middlewares.js`
- Test: `cms/tests/middlewares.test.js`

**Interfaces:**
- Consumes: `cms/config/middlewares.js` (currently a plain array with a `strapi::security` CSP allowing `res.cloudinary.com`).
- Produces: `cms/config/middlewares.js` exporting `({ env }) => array`; the `strapi::security` entry's `contentSecurityPolicy.directives['img-src']` and `['media-src']` always include `'res.cloudinary.com'` and, when `env('R2_PUBLIC_URL')` is set, the host parsed from it.

- [ ] **Step 1: Write the failing test**

Create `cms/tests/middlewares.test.js`:

```js
import { test, expect } from 'bun:test';

const middlewares = require('../config/middlewares.js');

const envWith = (vars) => {
  const fn = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.int = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.bool = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.array = (key, fallback) => (key in vars ? vars[key] : fallback);
  return fn;
};

// Tolerate both the old array export and the new ({ env }) => array factory,
// so the RED run exercises the real current module and fails on an assertion
// (a missing host) rather than a TypeError.
const resolve = (env) =>
  typeof middlewares === 'function' ? middlewares({ env }) : middlewares;
const directivesFor = (env) =>
  resolve(env).find((m) => m && m.name === 'strapi::security')
    .config.contentSecurityPolicy.directives;

test('always allows Cloudinary for existing assets', () => {
  const d = directivesFor(envWith({}));
  expect(d['img-src']).toContain('res.cloudinary.com');
  expect(d['media-src']).toContain('res.cloudinary.com');
});

test('allows the R2 public host when R2_PUBLIC_URL is set', () => {
  const d = directivesFor(envWith({ R2_PUBLIC_URL: 'https://cdn.example.com/' }));
  expect(d['img-src']).toContain('cdn.example.com');
  expect(d['media-src']).toContain('cdn.example.com');
});

test('adds no R2 host when R2_PUBLIC_URL is unset', () => {
  const d = directivesFor(envWith({}));
  expect(d['img-src']).not.toContain('cdn.example.com');
});
```

- [ ] **Step 2: Run the test to verify it fails on behavior**

Run: `bun test cms/tests/middlewares.test.js`
Expected: FAIL — the second test fails: the current array-form module ignores env, so `img-src` never contains `cdn.example.com`. (The `resolve` shim runs the real array — assertion failure, not a TypeError.)

- [ ] **Step 3: Replace `cms/config/middlewares.js` with the factory form**

Replace the entire file contents with:

```js
module.exports = ({ env }) => {
  // New uploads are served from R2's public domain; existing content still
  // references res.cloudinary.com. Allow both in the CSP so the admin media
  // library can preview them. R2_PUBLIC_URL is unset locally (local provider),
  // in which case only Cloudinary is allowed.
  const publicUrl = env('R2_PUBLIC_URL');
  const r2Host = publicUrl ? new URL(publicUrl).host : null;
  const assetHosts = ['res.cloudinary.com', ...(r2Host ? [r2Host] : [])];

  return [
    'strapi::errors',
    {
      name: 'strapi::security',
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            'connect-src': ["'self'", 'https:'],
            'img-src': ["'self'", 'data:', 'blob:', ...assetHosts],
            'media-src': ["'self'", 'data:', 'blob:', ...assetHosts],
            upgradeInsecureRequests: null,
          },
        },
      },
    },
    'strapi::cors',
    'strapi::poweredBy',
    'strapi::logger',
    'strapi::query',
    'strapi::body',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test cms/tests/middlewares.test.js`
Expected: PASS — 3 tests pass.

- [ ] **Step 5: Checkpoint — stage and pause for review**

Run:
```bash
git add cms/config/middlewares.js cms/tests/middlewares.test.js
```
Do NOT commit. Pause for the user to review and commit.

---

## Task 4: Rename the Heroku-named URL env vars

**Files:**
- Modify: `cms/config/env/production/server.js`
- Modify: `src/lib/utils/apis.js`
- Modify: `.github/workflows/deploy.yml`
- Modify: `.github/workflows/pr-preview.yml`
- Modify: `.env` (root, local/uncommitted)

**Interfaces:**
- Produces: no `MY_HEROKU_URL` / `VITE_HEROKU_URL` in active code or workflows; the CMS reads its public URL from `PUBLIC_URL`, the frontend from `VITE_CMS_URL` (repo secret of the same name).

- [ ] **Step 1: Rename the CMS public-URL var**

Replace the entire contents of `cms/config/env/production/server.js` with:

```js
module.exports = ({ env }) => ({
  proxy: true,
  url: env("PUBLIC_URL"),
  app: {
    keys: env.array("APP_KEYS"),
  },
  webhooks: {
    // Add this to not receive populated relations in webhooks
    populateRelations: false,
  },
});
```

- [ ] **Step 2: Rename the frontend var**

In `src/lib/utils/apis.js` line 9, change:
```js
const ENV_URL_CONTENT = import.meta.env.VITE_HEROKU_URL;
```
to:
```js
const ENV_URL_CONTENT = import.meta.env.VITE_CMS_URL;
```

- [ ] **Step 3: Rename the var in both deploy workflows**

In `.github/workflows/deploy.yml` and `.github/workflows/pr-preview.yml`, change the line (line 39 in each):
```yaml
          VITE_HEROKU_URL: ${{ secrets.VITE_HEROKU_URL }}
```
to:
```yaml
          VITE_CMS_URL: ${{ secrets.VITE_CMS_URL }}
```

- [ ] **Step 4: Rename the var in the root `.env` (local, not committed)**

In the root `.env`, change line 10:
```dotenv
VITE_HEROKU_URL=https://provide-cms.herokuapp.com
```
to (keep pointing at the live Heroku instance until cutover):
```dotenv
VITE_CMS_URL=https://provide-cms.herokuapp.com
```

- [ ] **Step 5: Verify no stale references remain in active code**

Run:
```bash
grep -rn "VITE_HEROKU_URL\|MY_HEROKU_URL" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=superpowers .
```
Expected: no matches. (The `docs/superpowers/**` specs/plans mention the old names historically and are excluded.) If any active file still matches, fix it.

- [ ] **Step 6: Checkpoint — stage and pause for review**

Run:
```bash
git add cms/config/env/production/server.js src/lib/utils/apis.js \
  .github/workflows/deploy.yml .github/workflows/pr-preview.yml
git status
```
Note: `.env` is gitignored/local — do not stage it. Remind the user to (a) rename the GitHub repo secret `VITE_HEROKU_URL` → `VITE_CMS_URL` and (b) at cutover point it at `https://provide-cms.fly.dev`. Do NOT commit. Pause for review.

---

## Task 5: Add the Fly app config

**Files:**
- Create: `cms/fly.toml`

**Interfaces:**
- Produces: `cms/fly.toml` declaring app `provide-cms`, region `fra`, a volume mount `provide_cms_data` → `/data`, `DATABASE_FILENAME=/data/data.db`, an `http_service` on internal port 1337 with scale-to-zero (`suspend`) and a `/_health` check, and a `shared-cpu-1x` / 1 GB VM.

- [ ] **Step 1: Create `cms/fly.toml`**

Create `cms/fly.toml`:

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

- [ ] **Step 2: Validate the config**

Run (if `flyctl` is installed and authenticated):
```bash
cd cms && flyctl config validate && cd ..
```
Expected: `Configuration is valid`. If `flyctl` is unavailable, instead confirm the required keys are present:
```bash
grep -E 'app = "provide-cms"|destination = "/data"|internal_port = 1337|DATABASE_FILENAME' cms/fly.toml
```
Expected: all four lines print. (Full schema validation then happens at first `flyctl deploy`.)

- [ ] **Step 3: Checkpoint — stage and pause for review**

Run:
```bash
git add cms/fly.toml
```
Do NOT commit. Pause for the user to review and commit.

---

## Task 6: Add the GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy-cms.yml`

**Interfaces:**
- Consumes: `cms/fly.toml` (Task 5) and a `FLY_API_TOKEN` repo secret (set by the operator).
- Produces: a workflow that runs `flyctl deploy --remote-only` from `cms/` on push to `main` touching `cms/**`.

- [ ] **Step 1: Create `.github/workflows/deploy-cms.yml`**

Create `.github/workflows/deploy-cms.yml`:

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

- [ ] **Step 2: Verify the workflow YAML parses**

Run:
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-cms.yml')); print('YAML OK')"
```
Expected: `YAML OK`.

- [ ] **Step 3: Checkpoint — stage and pause for review**

Run:
```bash
git add .github/workflows/deploy-cms.yml
```
Do NOT commit. Remind the user to add the `FLY_API_TOKEN` repo secret (`fly tokens create deploy`). Pause for review.

---

## Task 7: Rewrite the CMS README

**Files:**
- Modify: `cms/README.md`

**Interfaces:**
- Produces: `cms/README.md` documenting Fly.io (app + volume), SQLite, R2 media, the one-time seed, CI, and local dev — with no Heroku/Cloudinary/Postgres references.

- [ ] **Step 1: Replace `cms/README.md`**

Replace the entire file contents with:

```markdown
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
to `.tmp/data.db`).

```
npm run develop   # or, from the monorepo root: yarn dev:strapi
```

Seed local content from the live snapshot (writes to `.tmp/data.db`):

```
node scripts/fetch-snapshot.js
node scripts/seed-from-rest.js
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
  "/bin/sh -c 'cd /app && node scripts/fetch-snapshot.js && node scripts/seed-from-rest.js'"
```

## Scripts

- `npm run develop` — Strapi with autoReload.
- `npm run start` — Strapi without autoReload (production).
- `npm run build` — build the admin panel.
```

- [ ] **Step 2: Verify the README dropped the old platforms**

Run:
```bash
grep -iE "heroku|cloudinary|postgres" cms/README.md && echo "FOUND stale refs" || echo "clean"
grep -iE "fly\.io|r2|volume" cms/README.md >/dev/null && echo "has fly/r2/volume" || echo "MISSING new refs"
```
Expected: `clean` and `has fly/r2/volume`.

- [ ] **Step 3: Checkpoint — stage and pause for review**

Run:
```bash
git add cms/README.md
```
Do NOT commit. Pause for the user to review and commit.

---

## Task 8: Docker smoke test — image builds on SQLite and the volume persists

**Files:**
- None (integration verification; requires Docker).

**Interfaces:**
- Consumes: the `cms/` project after Tasks 1–2 (SQLite + R2 deps) and the existing `cms/Dockerfile`.
- Produces: evidence the image builds (better-sqlite3 prebuild installs on Debian-slim), boots on SQLite, serves `/_health`, and persists `/data/data.db` across a container restart.

- [ ] **Step 1: Build the image**

Run:
```bash
docker build -t provide-cms ./cms
```
Expected: build succeeds through `yarn build`. If it fails installing `better-sqlite3` with a node-gyp/compiler error (no prebuild for the platform), add build tooling to the **build stage** of `cms/Dockerfile` — `RUN apt-get update && apt-get install -y python3 make g++` before `yarn install` — and rebuild. (Expected not to be needed for `9.4.3` on linux/amd64.)

- [ ] **Step 2: Boot the image on a named volume and check health**

Run:
```bash
docker volume create cms-data >/dev/null
docker run -d --rm --name cms-app -p 1337:1337 \
  -v cms-data:/data \
  -e NODE_ENV=production \
  -e DATABASE_FILENAME=/data/data.db \
  -e APP_KEYS="$(openssl rand -base64 16),$(openssl rand -base64 16)" \
  -e API_TOKEN_SALT="$(openssl rand -base64 24)" \
  -e ADMIN_JWT_SECRET="$(openssl rand -base64 24)" \
  -e JWT_SECRET="$(openssl rand -base64 24)" \
  -e TRANSFER_TOKEN_SALT="$(openssl rand -base64 24)" \
  -e PUBLIC_URL="http://localhost:1337" \
  provide-cms
sleep 25
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:1337/_health
```
Expected: `204`. (No R2 env → local provider; migrations create `/data/data.db` on first boot.)

- [ ] **Step 3: Confirm the DB persisted to the volume, then restart to prove reuse**

Run:
```bash
docker exec cms-app sh -c 'ls -la /data/data.db'   # file exists on the volume
docker stop cms-app
docker run -d --rm --name cms-app2 -p 1337:1337 -v cms-data:/data \
  -e NODE_ENV=production -e DATABASE_FILENAME=/data/data.db \
  -e APP_KEYS="$(openssl rand -base64 16),$(openssl rand -base64 16)" \
  -e API_TOKEN_SALT="$(openssl rand -base64 24)" \
  -e ADMIN_JWT_SECRET="$(openssl rand -base64 24)" \
  -e JWT_SECRET="$(openssl rand -base64 24)" \
  -e TRANSFER_TOKEN_SALT="$(openssl rand -base64 24)" \
  -e PUBLIC_URL="http://localhost:1337" \
  provide-cms
sleep 25
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:1337/_health
docker exec cms-app2 sh -c 'ls -la /data/data.db'
docker stop cms-app2; docker volume rm cms-data
```
Expected: the first `ls` lists `data.db`; the second boot returns `204` and lists the **same** `data.db` (the volume — not the image — held the DB across restarts). This is the core proof that redeploys won't wipe content.

- [ ] **Step 4: Checkpoint — report results**

No files change. Report the two health codes and that `/data/data.db` persisted across the restart, then pause for the user.

---

## Self-Review Notes

- **Spec coverage:** SQLite + volume + deps (Task 1, §2/§1); R2 provider (Task 2, §3); CSP R2 host (Task 3, §3); env rename (Task 4, §6); `fly.toml` (Task 5, §1); CI (Task 6, §5); README (Task 7, §8); volume-persistence proof (Task 8, success criteria). Seeding (§7) and account provisioning (§Operator steps) are operator actions documented in the README, not code tasks — flagged below.
- **No placeholders:** every code/config step shows full contents; every command has expected output.
- **Type/name consistency:** the `env` stub shape is identical across all three test files; `provider` assertion path (`cfg.upload.config.provider`) matches the implementation; `DATABASE_FILENAME`, `provide_cms_data`, `/data/data.db`, and `PUBLIC_URL` are used identically in `database.js`, `fly.toml`, README, and Task 8.

## Operator actions (not code — do these outside the plan)

- Create the Fly app + volume, the R2 bucket + S3 token + public domain, and set all secrets (README "First-time setup").
- Run the one-time seed via `fly ssh` after the first deploy (README "One-time content seed").
- Add the `FLY_API_TOKEN` repo secret; rename the GitHub secret `VITE_HEROKU_URL` → `VITE_CMS_URL` and, at cutover, point it at `https://provide-cms.fly.dev`.
- Verify the frontend renders against the Fly URL (existing Cloudinary images still resolve), then retire the Heroku instance.

## Known follow-ups (out of scope)

- DB backups beyond Fly's default daily volume snapshots (Litestream → a **private** R2 bucket, or a periodic `sqlite3 .backup` to R2).
- Migrating the 625 existing Cloudinary assets to R2 (only if Cloudinary is retired).
