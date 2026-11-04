'use strict';
/**
 * Stage draft case-study coverage from the /meta cities list.
 * An optional SQLite source can restore missing slugs from its city_uid field.
 * Run with the CMS stopped:
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
    log(`slugs: ${REMOTE_DB} not found — skipping slug recovery`);
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
    const entries = await strapi.documents(UID).findMany({ locale, fields: ['Title', 'Slug'], limit: -1 });
    const rows = (Array.isArray(entries) ? entries : [entries]).filter(Boolean);
    const plan = planSlugBackfill(remoteRows, rows.map((e) => ({ ...e, id: e.documentId, locale })));
    if (!plan.length) {
      log(`slugs: ${locale}: ${rows.length} case studies, nothing to backfill`);
      continue;
    }
    for (const { id, slug } of plan) {
      if (DRY_RUN) {
        log(`slugs: ${locale}: would set id=${id} Slug=${slug}`);
        continue;
      }
      await strapi.documents(UID).update({ documentId: id, locale, data: { Slug: slug } });
      log(`slugs: ${locale}: id=${id} Slug=${slug}`);
    }
  }
}

async function applyCoverage(strapi, coverage, { dryRun = false, log = () => {} } = {}) {
  for (const { slug, covers, isDefault } of coverage) {
    const entries = (await Promise.all(LOCALES.map((locale) => strapi.documents(UID).findMany({
      locale, filters: { Slug: slug }, populate: ['Covers'],
    })))).flat();
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
      if (dryRun) {
        log(`${slug} (${row.locale}): would set ${covers.length} covers, isDefault=${isDefault}`);
        continue;
      }
      await strapi.documents(UID).update({ documentId: row.documentId, locale: row.locale,
        data: { Covers: covers.map((GeographyId) => ({ GeographyId })), IsDefault: isDefault },
      });
      log(`${slug} (${row.locale}): ${covers.length} covers, isDefault=${isDefault}`);
    }
  }
}

async function main() {
  const res = await fetch(META_URL);
  if (!res.ok) throw new Error(`GET ${META_URL} -> ${res.status}`);
  const coverage = buildCoverage((await res.json()).cities, { defaultSlug: process.env.DEFAULT_SLUG });
  if (!coverage.length) throw new Error('no coverage derived from /meta');

  const strapi = await require('@strapi/strapi').createStrapi().load();
  const log = (m) => strapi.log.info(`[coverage] ${m}`);
  try {
    await backfillSlugs(strapi, log);

    await applyCoverage(strapi, coverage, { dryRun: DRY_RUN, log });
    log(DRY_RUN ? 'dry run complete — nothing written' : 'drafts saved — review and publish in the CMS');
  } finally {
    await strapi.destroy();
  }
}

module.exports = { applyCoverage };

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
