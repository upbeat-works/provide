'use strict';
/**
 * Seed each case study's `Covers` / `IsDefault` from the legacy /meta cities,
 * which carry the curated "most relevant case study" per city. One-off import —
 * once this has run, the CMS owns the association and /meta is out of the loop.
 *
 * Idempotent. Boots Strapi programmatically, so run with the dev server stopped:
 *
 *   node scripts/seed-case-study-coverage.js
 *   DRY_RUN=1 node scripts/seed-case-study-coverage.js
 *   META_URL=... DEFAULT_SLUG=lisbon node scripts/seed-case-study-coverage.js
 */
const { buildCoverage } = require('./lib/case-study-coverage');

const UID = 'api::case-study-dynamic.case-study-dynamic';
const META_URL = process.env.META_URL || 'https://provide-api.iiasa.ac.at/api/meta/';
const DRY_RUN = Boolean(process.env.DRY_RUN);

const sameCovers = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

async function main() {
  const res = await fetch(META_URL);
  if (!res.ok) throw new Error(`GET ${META_URL} -> ${res.status}`);
  const coverage = buildCoverage((await res.json()).cities, { defaultSlug: process.env.DEFAULT_SLUG });
  if (!coverage.length) throw new Error('no coverage derived from /meta');

  const strapi = await require('@strapi/strapi')().load();
  const log = (m) => strapi.log.info(`[coverage] ${m}`);
  try {
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
