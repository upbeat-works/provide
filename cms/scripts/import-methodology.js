'use strict';
/**
 * One-time migration: reshape the existing `methodology` (DataType[]) + `glossaries`
 * content into the new per-tab single types — models, data-processing, key-terms,
 * impact — and publish them. Idempotent: re-running replaces each type's Sections.
 *
 * Boots Strapi programmatically, so run with the server stopped. On Fly:
 *   fly ssh console -a provide-cms -C \
 *     "/bin/sh -c 'cd /app && node scripts/import-methodology.js'"
 */
const { buildTabs } = require('./lib/methodology-map');

const GLOSSARY_LOCALE = 'en-EU'; // glossary is localized; the site serves en-EU

const NEW_TYPES = {
  models: 'api::models.models',
  dataProcessing: 'api::data-processing.data-processing',
  keyTerms: 'api::key-terms.key-terms',
  impact: 'api::impact.impact',
};

async function main() {
  const strapi = await require('@strapi/strapi')().load();
  const log = (m) => strapi.log.info(`[import-methodology] ${m}`);
  try {
    // ---- read existing source content ----
    const methodology = await strapi.entityService.findMany('api::methodology.methodology', {
      populate: { DataType: { populate: ['Model', 'Simulation', 'Processing'] } },
    });
    if (!methodology) throw new Error('No methodology entry found to migrate from.');
    const glossaries = await strapi.entityService.findMany('api::glossary.glossary', {
      fields: ['Title', 'Description'],
      locale: GLOSSARY_LOCALE,
      sort: 'id:asc',
      limit: -1,
    });
    log(`source: ${methodology.DataType?.length ?? 0} DataTypes, ${glossaries?.length ?? 0} glossaries (${GLOSSARY_LOCALE})`);

    // ---- reshape (pure, unit-tested in lib/methodology-map.test.js) ----
    const tabs = buildTabs(methodology, glossaries);

    // ---- upsert the new single types, published ----
    const payloads = {
      [NEW_TYPES.models]: { Sections: tabs.models },
      [NEW_TYPES.dataProcessing]: { Sections: tabs.dataProcessing },
      [NEW_TYPES.keyTerms]: { Sections: tabs.keyTerms },
      [NEW_TYPES.impact]: { Sections: tabs.impact },
    };
    for (const [uid, data] of Object.entries(payloads)) {
      const existing = await strapi.entityService.findMany(uid);
      const payload = { ...data, publishedAt: new Date() };
      if (existing) await strapi.entityService.update(uid, existing.id, { data: payload });
      else await strapi.entityService.create(uid, { data: payload });
      log(`${uid}: ${data.Sections.length} section(s)`);
    }

    // ---- grant Public read (find) on the new single types ----
    const pubRole = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' } });
    const existingPerms = await strapi.db
      .query('plugin::users-permissions.permission')
      .findMany({ where: { role: pubRole.id } });
    const have = new Set(existingPerms.map((p) => p.action));
    let granted = 0;
    for (const uid of Object.values(NEW_TYPES)) {
      const action = `${uid}.find`;
      if (have.has(action)) continue;
      await strapi.db
        .query('plugin::users-permissions.permission')
        .create({ data: { action, role: pubRole.id } });
      granted += 1;
    }
    log(`permissions: granted ${granted} of ${Object.keys(NEW_TYPES).length} public find action(s)`);
    log('done');
  } finally {
    await strapi.destroy();
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
