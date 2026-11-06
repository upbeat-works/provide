'use strict';
/**
 * Re-key Strapi scenario UIDs from the legacy slugs (`curpol`) to the ixmp4 names
 * the catalog serves (`2020 Climate Policies`), so CMS descriptions rejoin
 * the scenario details. Idempotent. See lib/scenario-uid-map.js for the map.
 *
 * The content of record is the REMOTE Strapi — a local-only run is reverted by
 * the next `npm run db:cms:pull`.
 *
 * Boots Strapi programmatically, so run with the dev server stopped:
 *
 *   node scripts/rekey-scenario-uids.js            # apply
 *   DRY_RUN=1 node scripts/rekey-scenario-uids.js  # print the plan only
 */
const { planScenarioRekey } = require('./lib/scenario-uid-map');

const UID = 'api::scenario.scenario';
const LOCALES = ['en', 'en-EU'];
const DRY_RUN = Boolean(process.env.DRY_RUN);

async function rekeyScenarios(strapi, { dryRun = false, log = () => {} } = {}) {
  for (const locale of LOCALES) {
    const rows = await strapi.db.query(UID).findMany({ where: { locale }, select: ['id', 'UID', 'locale'] });
    const plan = planScenarioRekey(rows);

    if (!plan.length) {
      log(`${locale}: ${rows.length} scenarios, nothing to change`);
      continue;
    }

    for (const { id, from, to } of plan) {
      if (dryRun) {
        log(`${locale}: would rename ${from} -> ${to}`);
        continue;
      }
      // Rename each stored variant without publishing an editor's draft.
      await strapi.db.query(UID).update({ where: { id }, data: { UID: to } });
      log(`${locale}: ${from} -> ${to}`);
    }
    const skipped = rows.length - plan.length;
    log(`${locale}: ${plan.length} renamed, ${skipped} unchanged`);
  }
}

async function main() {
  const strapi = await require('@strapi/strapi').createStrapi().load();
  const log = (m) => strapi.log.info(`[scenario-uid] ${m}`);
  try {
    await rekeyScenarios(strapi, { dryRun: DRY_RUN, log });
    log(DRY_RUN ? 'dry run complete — nothing written' : 'done');
  } finally {
    await strapi.destroy();
  }
}

module.exports = { rekeyScenarios };

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
