'use strict';
/**
 * Seed each case study's `Slug`, `Covers` and `IsDefault` — everything a fresh
 * `db:cms:pull` leaves missing on the case studies.
 *
 * Stage 1 (slugs) restores `Slug` from the pre-rename `city_uid` in the raw
 * remote snapshot `dumps/data-remote.db`. The remote CMS still has `CityUid`,
 * and `strapi export` serialises through the LOCAL content-type (where it is now
 * `Slug`), so the value is dropped in transit and imported rows arrive with
 * `slug = NULL`. Stage 2 matches entries BY SLUG, so it would skip everything
 * without stage 1 — which is why they live in one script. Stage 1 self-retires:
 * it no-ops once the remote runs the renamed schema.
 *
 * Stage 2 (coverage) sets `Covers` / `IsDefault` from the legacy /meta cities,
 * which carry the curated "most relevant case study" per city.
 *
 * Idempotent. Boots Strapi programmatically, so run with the dev server stopped:
 *
 *   node scripts/seed-case-study-coverage.js
 *   DRY_RUN=1 node scripts/seed-case-study-coverage.js
 *   META_URL=... DEFAULT_SLUG=lisbon node scripts/seed-case-study-coverage.js
 *   REMOTE_DB=dumps/other.db node scripts/seed-case-study-coverage.js
 */
const path = require('path');
const fs = require('fs');
const { buildCoverage } = require('./lib/case-study-coverage');
const { planSlugBackfill } = require('./lib/case-study-slugs');

const UID = 'api::case-study-dynamic.case-study-dynamic';
const LOCALES = ['en', 'en-EU'];
const META_URL = process.env.META_URL || 'https://provide-api.iiasa.ac.at/api/meta/';
const DRY_RUN = Boolean(process.env.DRY_RUN);
const REMOTE_DB = path.resolve(process.cwd(), process.env.REMOTE_DB || 'dumps/data-remote.db');

const sameCovers = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Pre-rename city_uid rows from the raw remote snapshot; [] when unavailable. */
function readRemoteRows(log) {
  if (!fs.existsSync(REMOTE_DB)) {
    log(`slugs: ${REMOTE_DB} not found — skipping backfill (run 'npm run db:cms:pull' if slugs are missing)`);
    return [];
  }
  const db = new (require('better-sqlite3'))(REMOTE_DB, { readonly: true });
  try {
    const cols = db.prepare(`select name from pragma_table_info('case_study_dynamics')`).all().map((c) => c.name);
    if (!cols.includes('city_uid')) {
      log('slugs: remote snapshot is already on the renamed schema — backfill no longer needed');
      return [];
    }
    return db.prepare('select city_uid, title, locale from case_study_dynamics').all();
  } finally {
    db.close();
  }
}

/** Stage 1: Slug <- city_uid, matched on Title + locale (ids don't survive the transfer). */
async function backfillSlugs(strapi, log) {
  const remoteRows = readRemoteRows(log);
  if (!remoteRows.length) return;

  for (const locale of LOCALES) {
    const entries = await strapi.entityService.findMany(UID, { locale, fields: ['Title', 'Slug'], limit: -1 });
    const rows = (Array.isArray(entries) ? entries : [entries]).filter(Boolean);
    const plan = planSlugBackfill(remoteRows, rows.map((e) => ({ ...e, locale })));
    if (!plan.length) {
      log(`slugs: ${locale}: ${rows.length} case studies, nothing to backfill`);
      continue;
    }
    for (const { id, slug } of plan) {
      if (DRY_RUN) {
        log(`slugs: ${locale}: would set id=${id} Slug=${slug}`);
        continue;
      }
      await strapi.entityService.update(UID, id, { data: { Slug: slug } });
      log(`slugs: ${locale}: id=${id} Slug=${slug}`);
    }
  }
}

async function main() {
  const res = await fetch(META_URL);
  if (!res.ok) throw new Error(`GET ${META_URL} -> ${res.status}`);
  const coverage = buildCoverage((await res.json()).cities, { defaultSlug: process.env.DEFAULT_SLUG });
  if (!coverage.length) throw new Error('no coverage derived from /meta');

  const strapi = await require('@strapi/strapi')().load();
  const log = (m) => strapi.log.info(`[coverage] ${m}`);
  try {
    await backfillSlugs(strapi, log);

    for (const { slug, covers, isDefault } of coverage) {
      const entries = await strapi.entityService.findMany(UID, {
        filters: { Slug: slug },
        populate: ['Covers'],
      });
      const rows = (Array.isArray(entries) ? entries : [entries]).filter(Boolean);
      if (!rows.length) {
        log(`${slug}: no case study with that slug — skipped`);
        continue;
      }

      for (const row of rows) {
        const current = (row.Covers ?? []).map((c) => c.GeographyId).sort();
        if (sameCovers(current, covers) && Boolean(row.IsDefault) === isDefault) {
          log(`${slug} (${row.locale}): already seeded`);
          continue;
        }
        if (DRY_RUN) {
          log(`${slug} (${row.locale}): would set ${covers.length} covers, isDefault=${isDefault}`);
          continue;
        }
        await strapi.entityService.update(UID, row.id, {
          data: { Covers: covers.map((GeographyId) => ({ GeographyId })), IsDefault: isDefault },
        });
        log(`${slug} (${row.locale}): ${covers.length} covers, isDefault=${isDefault}`);
      }
    }
    log(DRY_RUN ? 'dry run complete — nothing written' : 'done');
  } finally {
    await strapi.destroy();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
