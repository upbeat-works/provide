# Staging Strapi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vendor the real `provide-cms` Strapi 4.24.2 source into this monorepo as `cms/`, bootable locally against local Postgres with a local upload provider, seedable from production, and shippable as a Docker image.

**Architecture:** Copy `../provide-cms` (minus its `.git`) into `cms/` as a self-contained yarn project (not part of the bun workspace). One source change makes the upload provider env-conditional (Cloudinary in prod, local filesystem otherwise). Local content is seeded from prod via `strapi transfer` authorized by an admin-generated transfer token. A `cms/Dockerfile` produces the release artifact.

**Tech Stack:** Strapi 4.24.2, Node 20.13.1, yarn, PostgreSQL, Docker. Tests for the pure config/transform logic run via `bun test` (the monorepo's runner).

## Implementation notes (as-built — deviations from the original plan)

- **Task 4 seeding changed approach.** Transfer tokens are unavailable — prod
  isn't configured for data transfer (no `TRANSFER_TOKEN_SALT`), and we can't
  change prod. Replaced with a **public-REST import**:
  `cms/scripts/fetch-snapshot.js` (deep-populate fetch → `cms/.snapshot/`) and
  `cms/scripts/seed-from-rest.js` (boots Strapi, creates local file rows for
  Cloudinary media, imports all types per locale, wires the one
  `scenario ↔ scenario-preset` relation, grants Public read). Pure logic in
  `cms/scripts/lib/{schema,transform}.js`, unit-tested in `cms/tests/`.
  Published content only (public API excludes drafts).
- **Schema drift discovered — the vendored repo is behind prod:**
  (1) `story.Type` enum was missing `impacts`/`adaptation` (added to the schema);
  (2) prod has a `case-study-outro` single type absent from the repo (it is
  empty on prod, so no data lost). Other drift may exist — reconcile against
  prod's real content-types (admin API) if full fidelity is needed later.
- **Docker fixes** to make the image build/boot: lazy-parse `DATABASE_URL`,
  `DATABASE_SSL`-configurable (default true), Debian-slim base (Alpine breaks
  `sharp`), `mkdir public/uploads`.
- **Env quirks:** `dev:strapi` needs Node 20 (`nvm use 20`); pinned
  `packageManager: yarn@1.22.22` in `cms/package.json` to shield against a stray
  `~/package.json` declaring pnpm. Local Postgres uses Homebrew trust auth.

## Global Constraints

- **Strapi 4.24.2 / Node 20.13.1 / yarn** — do not upgrade or switch package managers; `cms/` keeps its own `yarn.lock`.
- **`cms/` is self-contained** — its own toolchain; NOT added to the bun workspace or root `bun.lock`.
- **Local dev = native + local Postgres**, no Docker. Docker is the release artifact only.
- **Local/staging use the local upload provider** — no Cloudinary creds required; existing content keeps absolute Cloudinary URLs.
- **NO automatic git commits.** Every task ends by staging changes and pausing for the user to review and commit. Do NOT run `git commit` yourself.
- Production Strapi (`https://provide-cms.herokuapp.com`) is **read-only** — the only prod interaction is generating a transfer token and pulling data.

---

## File Structure

- `cms/**` — vendored Strapi project (created in Task 1)
- `cms/config/plugins.js` — modified: env-conditional upload provider (Task 2)
- `cms/tests/plugins.test.js` — new: unit test for the provider decision (Task 2)
- `cms/.env.example` — new: documents local dev env (Task 3)
- `cms/.env` — new, gitignored: local dev secrets/DB (Task 3)
- `cms/Dockerfile`, `cms/.dockerignore` — new: release artifact (Task 6)
- `package.json` (root) — modified: add `dev:strapi`, `docker:cms` (Tasks 1, 6)
- `.gitignore` (root) — modified: ignore `cms/` generated paths (Task 1)

---

## Task 1: Vendor the Strapi source into `cms/`

**Files:**
- Create: `cms/**` (copied from `../provide-cms`, excluding `.git` and generated dirs)
- Modify: `package.json` (root) — add `dev:strapi` script
- Modify: `.gitignore` (root) — ignore `cms/` generated paths

**Interfaces:**
- Produces: a `cms/` directory containing `package.json`, `yarn.lock`, `config/`, `src/`, `public/`, `types/`; a root `dev:strapi` script that runs `cd cms && yarn develop`.

- [ ] **Step 1: Copy the source, excluding `.git` and generated dirs**

Run from the monorepo root (`/Users/rodrigo/WorkWorkWorkWorkWorkWork/iiasa/provide`):

```bash
rsync -a --exclude='.git' --exclude='node_modules' --exclude='.tmp' \
  --exclude='build' --exclude='.cache' --exclude='dist' --exclude='.env' \
  ../provide-cms/ cms/
```

- [ ] **Step 2: Verify the copy landed and carries no upstream git**

Run:
```bash
test -f cms/package.json && test -d cms/config && test -d cms/src/api && \
  test ! -e cms/.git && echo "OK: vendored, no upstream .git"
grep '"@strapi/strapi"' cms/package.json
```
Expected: prints `OK: vendored, no upstream .git` and the `"@strapi/strapi": "4.24.2"` line.

- [ ] **Step 3: Add the `dev:strapi` script to the root `package.json`**

In `package.json` (root), inside `"scripts"`, add after the existing `"dev:api:node"` line:

```jsonc
    "dev:strapi": "cd cms && yarn develop",
```

- [ ] **Step 4: Ignore `cms/` generated paths in the root `.gitignore`**

Append to `.gitignore` (root):

```gitignore

# Vendored Strapi (cms/) — generated paths
cms/node_modules
cms/.env
cms/.tmp
cms/build
cms/.cache
cms/dist
cms/.strapi
cms/public/uploads
cms/exports
```

- [ ] **Step 5: Verify git sees the source but not the generated paths**

Run:
```bash
git status --short cms/ | grep -E 'cms/(config|src|package.json)' | head -3
git check-ignore cms/node_modules cms/.env cms/public/uploads
```
Expected: the first command lists `cms/config/…`, `cms/src/…`, `cms/package.json` as untracked (`??`); the second echoes all three ignored paths back.

- [ ] **Step 6: Checkpoint — stage and pause for review**

Run:
```bash
git add cms/ package.json .gitignore
git status
```
Do NOT commit. Report the staged file list and pause for the user to review and commit.

---

## Task 2: Make the upload provider env-conditional

**Files:**
- Modify: `cms/config/plugins.js`
- Test: `cms/tests/plugins.test.js`

**Interfaces:**
- Consumes: the vendored `cms/config/plugins.js` from Task 1, which currently exports `({ env }) => ({ ... upload: { config: { provider: "cloudinary", ... } } })`.
- Produces: `cms/config/plugins.js` exporting `({ env }) => object` where `object.upload.config.provider` is `"cloudinary"` when `env("CLOUDINARY_NAME")` is truthy, else `"local"`. The `"users-permissions"` block (with `jwtSecret: env("JWT_SECRET")`) is preserved unchanged.

- [ ] **Step 1: Write the failing test**

Create `cms/tests/plugins.test.js`:

```js
import { test, expect } from 'bun:test';

// The Strapi config module is CommonJS: ({ env }) => ({...}).
// This test lives in cms/tests/ (NOT cms/config/) — Strapi auto-loads every
// .js file under config/ as a config file at boot, which breaks on ESM syntax.
const plugins = require('../config/plugins.js');

// Minimal stand-in for Strapi's `env` helper (only .get form is used here).
const envWith = (vars) => {
  const fn = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.int = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.bool = (key, fallback) => (key in vars ? vars[key] : fallback);
  fn.array = (key, fallback) => (key in vars ? vars[key] : fallback);
  return fn;
};

test('falls back to the local upload provider when CLOUDINARY_NAME is unset', () => {
  const cfg = plugins({ env: envWith({}) });
  expect(cfg.upload.config.provider).toBe('local');
});

test('uses the cloudinary provider when CLOUDINARY_NAME is set', () => {
  const cfg = plugins({
    env: envWith({ CLOUDINARY_NAME: 'demo', CLOUDINARY_KEY: 'k', CLOUDINARY_SECRET: 's' }),
  });
  expect(cfg.upload.config.provider).toBe('cloudinary');
  expect(cfg.upload.config.providerOptions.cloud_name).toBe('demo');
});

test('preserves the users-permissions jwtSecret wiring', () => {
  const cfg = plugins({ env: envWith({ JWT_SECRET: 'shhh' }) });
  expect(cfg['users-permissions'].config.jwtSecret).toBe('shhh');
});
```

- [ ] **Step 2: Run the test to verify it fails on behavior**

Run: `bun test cms/tests/plugins.test.js`
Expected: FAIL — the first test errors because the current (always-cloudinary) `plugins.js` returns `provider: "cloudinary"`, so `expect(...).toBe('local')` fails. (The module loads and runs — this is a behavior failure, not an import error.)

- [ ] **Step 3: Implement the conditional provider**

Replace the entire contents of `cms/config/plugins.js` with:

```js
module.exports = ({ env }) => {
  const cloudName = env('CLOUDINARY_NAME');

  // Cloudinary in environments that configure it (production); the built-in
  // local filesystem provider everywhere else (local dev / staging), so no
  // Cloudinary credentials are required to boot.
  const upload = cloudName
    ? {
        config: {
          provider: 'cloudinary',
          providerOptions: {
            cloud_name: cloudName,
            api_key: env('CLOUDINARY_KEY'),
            api_secret: env('CLOUDINARY_SECRET'),
          },
          actionOptions: {
            upload: {},
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test cms/tests/plugins.test.js`
Expected: PASS — 3 tests pass.

- [ ] **Step 5: Checkpoint — stage and pause for review**

Run:
```bash
git add cms/config/plugins.js cms/tests/plugins.test.js
```
Do NOT commit. Pause for the user to review and commit.

---

## Task 3: Boot locally against local Postgres

**Files:**
- Create: `cms/.env.example`
- Create: `cms/.env` (gitignored)

**Interfaces:**
- Consumes: `cms/config/database.js` (local defaults: db `provide-cms`, user `jonas`, empty password, `localhost:5432`) and the env-conditional `cms/config/plugins.js` from Task 2.
- Produces: a running Strapi admin on `http://localhost:1337` backed by local Postgres, using the local upload provider.

- [ ] **Step 1: Create `cms/.env.example`**

Create `cms/.env.example`:

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

# Local Postgres (see config/database.js defaults)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=provide-cms
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_SSL=false

# Cloudinary is intentionally UNSET locally, so the local upload provider is
# used (see config/plugins.js). Set these only in environments that use Cloudinary.
# CLOUDINARY_NAME=
# CLOUDINARY_KEY=
# CLOUDINARY_SECRET=
```

- [ ] **Step 2: Create the local Postgres database**

Run (adjust `DATABASE_USERNAME`/host to your local Postgres if different from the example):

```bash
createdb provide-cms 2>/dev/null || echo "provide-cms db may already exist — continuing"
psql -lqt | cut -d '|' -f1 | grep -qw provide-cms && echo "OK: provide-cms database exists"
```
Expected: prints `OK: provide-cms database exists`.

- [ ] **Step 3: Create `cms/.env` with generated secrets**

Run from the monorepo root:

```bash
cp cms/.env.example cms/.env
# Generate real local secrets
APP_KEYS="$(openssl rand -base64 16),$(openssl rand -base64 16)"
python3 - "$APP_KEYS" <<'PY'
import re, sys, pathlib
keys = sys.argv[1]
p = pathlib.Path("cms/.env")
t = p.read_text()
subs = {
    "APP_KEYS": keys,
    "API_TOKEN_SALT": __import__("secrets").token_urlsafe(24),
    "ADMIN_JWT_SECRET": __import__("secrets").token_urlsafe(24),
    "JWT_SECRET": __import__("secrets").token_urlsafe(24),
    "TRANSFER_TOKEN_SALT": __import__("secrets").token_urlsafe(24),
}
for k, v in subs.items():
    t = re.sub(rf"(?m)^{k}=.*$", f"{k}={v}", t)
p.write_text(t)
print("wrote cms/.env with generated secrets")
PY
```
Expected: prints `wrote cms/.env with generated secrets`. Adjust `DATABASE_USERNAME`/`DATABASE_PASSWORD` in `cms/.env` to match your local Postgres.

- [ ] **Step 4: Install dependencies**

Run:
```bash
cd cms && yarn install --frozen-lockfile && cd ..
```
Expected: yarn completes without errors (Strapi + plugins installed).

- [ ] **Step 5: Boot Strapi and verify it serves**

Run (in one terminal):
```bash
yarn dev:strapi
```
In another terminal, once it prints "To manage your project 🚀, go to the administrator panel", run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:1337/_health
```
Expected: `204` (Strapi health check). The boot logs should NOT show a Cloudinary provider error (the local provider is active). Stop the server (Ctrl-C) after verifying.

- [ ] **Step 6: Checkpoint — stage and pause for review**

Run:
```bash
git add cms/.env.example
git check-ignore cms/.env && echo "cms/.env correctly ignored"
```
Do NOT commit. Confirm `cms/.env` is ignored (never staged) and pause for the user to review and commit.

---

## Task 4: Seed local content from production via `strapi transfer`

**Files:**
- None (operational task; data lands in local Postgres).

**Interfaces:**
- Consumes: a running-capable `cms/` project (Task 3) and a production **transfer token**.
- Produces: local Postgres populated with production content, relations, and locales; media entries retain their Cloudinary URLs.

- [ ] **Step 1: Generate a transfer token in production**

In the prod admin (`https://provide-cms.herokuapp.com/admin`) → **Settings → Transfer Tokens → Create new Transfer Token** (Full access, read is sufficient). Copy the token (shown once).

- [ ] **Step 2: Pull production data into local**

Run (paste the token; the target is your local project/DB):
```bash
cd cms
yarn strapi transfer \
  --from https://provide-cms.herokuapp.com/admin \
  --from-token '<PASTE_TRANSFER_TOKEN>' \
  --exclude files \
  --force
cd ..
```
Expected: transfer completes with a summary table (entities, links, configuration transferred; files skipped). `--exclude files` keeps assets on Cloudinary (their URLs come across intact).

- [ ] **Step 3: Verify content landed**

Boot (`yarn dev:strapi`) in one terminal, then in another:
```bash
curl -s "http://localhost:1337/api/indicators?pagination[limit]=1&locale=en-EU" \
  -o /dev/null -w "%{http_code}\n"
curl -s "http://localhost:1337/api/scenarios?pagination[pageSize]=1" | head -c 200; echo
```
Expected: HTTP `200` and a JSON body containing a `data` array with at least one entry.
If you get `403`/`404`: the Public role permissions may not have transferred — in the local admin, **Settings → Users & Permissions → Roles → Public**, enable `find`/`findOne` for the content types, save, and re-check.

- [ ] **Step 4: Checkpoint — pause for review**

No files change. Report the transfer summary and the verification HTTP codes, then pause for the user.

---

## Task 5: Verify the frontend against local Strapi

**Files:**
- Modify (local only, not committed): `.env` (root) — `VITE_HEROKU_URL`

**Interfaces:**
- Consumes: the seeded local Strapi (Task 4) on `http://localhost:1337`.
- Produces: confirmation that all 11 frontend-consumed content types load against the local instance.

- [ ] **Step 1: Point the frontend at local Strapi**

In the root `.env`, set (temporarily, for local verification — do not commit this change):
```dotenv
VITE_HEROKU_URL=http://localhost:1337
```

- [ ] **Step 2: Smoke-check all 11 consumed endpoints**

With `yarn dev:strapi` running, run from the monorepo root:
```bash
for t in about adaptation case-study-dynamics case-study-outro contact \
  glossaries indicators issue scenario-presets scenarios stories; do
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    "http://localhost:1337/api/$t?populate=*&locale=en-EU&pagination[limit]=1")
  echo "$code  $t"
done
```
Expected: every line prints `200`. Any `403` → enable Public `find`/`findOne` for that type (as in Task 4, Step 3). Any `404` → the endpoint name differs; note it for follow-up (frontend expects the names listed above).

- [ ] **Step 3: Load the site and eyeball a content page**

Run `yarn dev` (frontend) in another terminal and open the app; navigate to an editorial page (e.g. `/about`, a case study, `/methodology/key-terms`). Confirm CMS text renders and images resolve (from Cloudinary URLs).

- [ ] **Step 4: Revert the local frontend env change**

Restore `VITE_HEROKU_URL` in the root `.env` to its previous value (`https://provide-cms.herokuapp.com`) unless you intend to keep developing against local.

- [ ] **Step 5: Checkpoint — pause for review**

No committed files change. Report the 11 HTTP codes and whether the page rendered, then pause for the user.

---

## Task 6: Dockerize `cms/` as the release artifact

**Files:**
- Create: `cms/Dockerfile`
- Create: `cms/.dockerignore`
- Modify: `package.json` (root) — add `docker:cms` script

**Interfaces:**
- Consumes: the vendored `cms/` project.
- Produces: a Docker image `provide-cms` that boots Strapi on `:1337` against an external Postgres; a root `docker:cms` script mirroring `docker:api`.

- [ ] **Step 1: Create `cms/.dockerignore`**

Create `cms/.dockerignore`:

```dockerignore
.git
node_modules
.tmp
build
.cache
dist
.strapi
.env
exports
public/uploads
```

- [ ] **Step 2: Create `cms/Dockerfile`**

Create `cms/Dockerfile` (multi-stage, mirroring the API Dockerfile's build→runtime pattern; Node base + vips for Strapi's image processing):

```dockerfile
# Build stage
FROM node:20.13.1-alpine AS build
WORKDIR /app
RUN apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
ENV NODE_ENV=production
RUN yarn build

# Runtime stage
FROM node:20.13.1-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache vips
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1337
COPY --from=build /app ./
EXPOSE 1337
CMD ["yarn", "start"]
```

- [ ] **Step 3: Add the `docker:cms` script to the root `package.json`**

In `package.json` (root) `"scripts"`, add alongside the other scripts (this tree's
`package.json` is the SvelteKit `provide-website` — there is no `docker:api` to
anchor beside, so place it after `"dev:strapi"`):

```jsonc
    "docker:cms": "docker build -t provide-cms ./cms && docker run --rm -p 1337:1337 --env-file cms/.env provide-cms",
```

Note: production config (`NODE_ENV=production`) expects `DATABASE_URL` and `MY_HEROKU_URL`. For a local image smoke test, either provide a reachable `DATABASE_URL` in the env-file or run the build-only check in Step 4.

- [ ] **Step 4: Build the image and verify it compiles**

Run:
```bash
docker build -t provide-cms ./cms
```
Expected: build succeeds through `yarn build` (admin panel builds) with a final image tagged `provide-cms`. (`yarn build` failing here would catch a missing dependency or config error before deploy.)

- [ ] **Step 5: Boot the image against a Postgres and verify health**

Run a throwaway Postgres and the image on a shared network:
```bash
docker network create provide-cms-net 2>/dev/null || true
docker run -d --rm --name cms-db --network provide-cms-net \
  -e POSTGRES_DB=provide-cms -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres postgres:15-alpine
sleep 5
docker run -d --rm --name cms-app --network provide-cms-net -p 1337:1337 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgres://postgres:postgres@cms-db:5432/provide-cms \
  -e APP_KEYS="$(openssl rand -base64 16),$(openssl rand -base64 16)" \
  -e API_TOKEN_SALT="$(openssl rand -base64 24)" \
  -e ADMIN_JWT_SECRET="$(openssl rand -base64 24)" \
  -e JWT_SECRET="$(openssl rand -base64 24)" \
  -e TRANSFER_TOKEN_SALT="$(openssl rand -base64 24)" \
  -e MY_HEROKU_URL="http://localhost:1337" \
  provide-cms
sleep 20
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:1337/_health
docker stop cms-app cms-db; docker network rm provide-cms-net
```
Expected: `curl` prints `204`. (Startup on a fresh DB runs migrations; the 20s sleep covers it — increase if the health check races the boot.)

- [ ] **Step 6: Checkpoint — stage and pause for review**

Run:
```bash
git add cms/Dockerfile cms/.dockerignore package.json
```
Do NOT commit. Pause for the user to review and commit.

---

## Self-Review Notes

- **Spec coverage:** vendor into `cms/` (Task 1); env-conditional upload provider (Task 2); local boot + `.env.example` + local Postgres + `dev:strapi` (Tasks 1, 3); `strapi transfer` seed with `--exclude files` (Task 4); frontend verification of the 11 endpoints (Task 5); `cms/Dockerfile` + external Postgres boot (Task 6). All success criteria map to a task.
- **Provider names consistent:** `cfg.upload.config.provider` is the assertion path in Task 2's test and the shape produced by the implementation.
- **No auto-commits:** every task ends at a staged checkpoint per the global constraint.

## Known follow-ups (out of scope, flagged)

- Cutting the **live prod deploy** over from `jnsprnw/provide-cms` to this vendored `cms/` (prod keeps deploying from upstream until done separately).
- If prod has **transfer disabled**, Task 4 falls back to a REST/admin export or a DB dump (requires Heroku access) — revisit only if the token approach fails.
