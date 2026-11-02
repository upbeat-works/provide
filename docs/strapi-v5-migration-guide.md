# Strapi v5 migration guide

The website uses Node 26.13.0; the API uses Bun 1.4.4. Both install from the root npm lockfile. The CMS uses Strapi 5.60.0, Node 26.13.0, and Yarn 1.22.22. SQLite remains available for tests and exports; production uses PostgreSQL.

## Live migration steps


1. Verify IIASA's base images before choosing production tags. Check their Node/Bun versions and any required certificates or settings. Use the tested official images (`node:26.13.0-bookworm-slim` and `oven/bun:1.4.4`) if IIASA permits, or verified private equivalents. The private tags currently named in `docker/prod/` have not been checked. Publish new private bases only if needed.
2. Record the live app image digests, Node/Bun versions, PostgreSQL version, and CMS version for rollback. Update the production Dockerfiles to the bases chosen in step 1, then build and test those app images. Node 26 needs `libatomic1`; the official Bookworm image includes it. The CMS build installs native compilation tools and Yarn explicitly.
3. Set a persistent `ADMIN_ENCRYPTION_KEY` for the CMS. Generate it with `openssl rand -base64 32`; store it alongside the other CMS secrets. Retain existing application keys, token salts, JWT secrets, database configuration, and S3 settings.
4. Restore a production PostgreSQL backup into a separate database. First boot it with Strapi 4.26.2 if production is older, using Node 20.20.2 or a supported Node 22 release. Stop that instance before starting Strapi 5. Rehearse with the final IIASA app images on the production architecture. Check admin login, editing, publishing, uploads, language versions, case studies, methodology, and API charts.
5. For the agreed maintenance window, stop CMS edits and all old CMS instances. Back up the database and media. Repeat the tested upgrade sequence, including the Strapi 4.26.2 step if needed. Run exactly one Strapi 5 CMS instance through its startup migrations.
6. Release the matching website and CMS together: the website reads the Strapi 5 response shape. Deploy the pinned Bun API image. Check the public pages, API, admin actions, and logs before reopening.
7. If checks fail, stop the new CMS and restore the database backup plus the previous app images. An image-only rollback cannot undo the Strapi database migration. Restore media too if the release changed it.

Publishing base images, changing Jenkins, and deploying production require IIASA access and are not performed by the local scripts. The live-data rehearsal is required even when the generated-data migration test passes.

Any chart configuration that sets `caseStudyId` must use the migrated Strapi `documentId`. Numeric database row IDs no longer identify a document across publishing and language versions.

Do not run content repairs after every copy. Use the fresh backup to decide whether any are needed. Coverage and slug repairs save drafts; review all edits in each draft before publishing.

## Checks already completed


A separate PostgreSQL database was restored from the local `provide.strapi` schema and upgraded through Strapi 4.26.2 to 5.60.0. All 174 content entries matched their original fields, including nested components, relations, and media references. The 113 media records remained present. Restart checks passed.

Browser checks covered the homepage, About, methodology, key terms, case-study list, Lisbon, Islamabad, Nassau, adaptation, and the impact tools. Editing, saving a private draft, publishing, language isolation, restart persistence, and a local image upload passed. Live API-backed temperature and risk charts loaded. The map service responded successfully but reported no map data for the selected indicator and geography, so map rendering was not verified.

This was the local database copy, not a fresh production backup. Case-study and scenario updates in it date to July; media updates extend to October. Two homepage upload files were absent from the local filesystem. Two case-study/scenario join rows already had no target before the upgrade. Check these conditions against the current live backup. Existing production admin credentials and S3 uploads still need verification in the production-like rehearsal; the browser test used a temporary admin and local uploads.

The senior review and both complexity reviews are complete. The agreed fixes passed follow-up review. The final CMS checks passed: 105 tests, with two existing opt-in tests skipped. The rebuilt CMS image also passed the PostgreSQL Strapi 4-to-5 upgrade and restart check.

## Run local checks


Use the versions in `.node-version` and `.bun-version`, then run:

```sh
npm ci
npm test
VITE_SCREENSHOT_URL=http://screenshots.example.test npm run test:web
npm run test:content
npm run build
yarn --cwd cms install --frozen-lockfile
npm run test:cms
yarn --cwd cms build
npm run test:cms:migration
```

API tests need a separate PostgreSQL database configured through `DATABASE_*`. They create and drop `test_*` schemas. Do not point tests at production. The migration check creates its own PostgreSQL container, seeds Strapi 4.26.2 through its content API, then boots the actual Strapi 5 application twice. It checks drafts, translations, media, relations, page sections, and the shortened scenario-characteristic table.

Vitest needs Bun on PATH for the API packaging test. Its commands disable Node's Web Storage globals so jsdom supplies browser storage. CMS tests use Node for native SQLite integration and Bun for configuration tests.

Two existing database tests need a populated CMS copy and opt in with `POSTGRES_MIGRATION_TEST=1`. The separate Docker migration check runs without production access.

## Copy production content locally


Configure a PostgreSQL service in `.pg_service.conf` and its password in `.pgpass`. `CMS_PG_SERVICE` names the source service; `DB_USER` and `DB_NAME` select the local destination. Both instances must already use the same Strapi schema/version.

```sh
CMS_PG_SERVICE=provide-cms npm run db:cms:dump
CMS_PG_SERVICE=provide-cms DB_USER=rodrigo DB_NAME=provide npm run db:cms:pull
```

The pull stops the local CMS, backs up its `strapi` schema, and restores the remote schema in one transaction. It leaves the API's `catalog` schema alone. On failure the CMS stays stopped for inspection; restart it after restoring or checking the backup. Media URLs still refer to their existing object store.

`db:cms:import` accepts a Strapi 5 export archive in `cms/dumps/strapi-transfer.tar.gz`. Use database backup and restore for the Strapi 4-to-5 migration.
