'use strict';
/**
 * Re-key Strapi scenario UIDs from the legacy slugs (`curpol`) to the ixmp4 names
 * the catalog serves (`2020 Climate Policies`), so CMS descriptions rejoin
 * `GET /api/catalog`. Idempotent. See lib/scenario-uid-map.js for the map.
 *
 * The content of record is the REMOTE Strapi — a local-only run is reverted by
 * the next `npm run db:cms:pull`.
 *
 * Boots Strapi programmatically, so run with the dev server stopped:
 *
 *   node scripts/rekey-scenario-uids.js            # apply
 *   DRY_RUN=1 node scripts/rekey-scenario-uids.js  # print the plan only
 *
 * On Fly (idle instance):
 *   fly ssh console -a provide-cms -C \
 *     "/bin/sh -c 'cd /app && node scripts/rekey-scenario-uids.js'"
 */
const { planScenarioRekey } = require('./lib/scenario-uid-map');

const UID = 'api::scenario.scenario';
const LOCALES = ['en', 'en-EU'];
const DRY_RUN = Boolean(process.env.DRY_RUN);

async function main() {
  const strapi = await require('@strapi/strapi')().load();
  const log = (m) => strapi.log.info(`[scenario-uid] ${m}`);
  try {
    for (const locale of LOCALES) {
      const entries = await strapi.entityService.findMany(UID, { locale, fields: ['UID'], limit: -1 });
      const rows = (Array.isArray(entries) ? entries : [entries]).filter(Boolean);
      const plan = planScenarioRekey(rows.map((e) => ({ id: e.id, locale, UID: e.UID })));

      if (!plan.length) {
        log(`${locale}: ${rows.length} scenarios, nothing to change`);
        continue;
      }

      for (const { id, from, to } of plan) {
        if (DRY_RUN) {
          log(`${locale}: would rename ${from} -> ${to}`);
          continue;
        }
        await strapi.entityService.update(UID, id, { data: { UID: to } });
        log(`${locale}: ${from} -> ${to}`);
      }
      const skipped = rows.length - plan.length;
      log(`${locale}: ${plan.length} renamed, ${skipped} left on their legacy uid (no ixmp4 counterpart)`);
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
