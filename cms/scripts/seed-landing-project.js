'use strict';
/**
 * Seed the landing page's "Learn about the Climate Risk Dashboard project"
 * block (the `landing-project` single type) with the copy it shipped with, so a
 * fresh Strapi renders the block before anyone opens the admin.
 *
 * Idempotent AND non-destructive: a locale that already has cards is left alone,
 * so re-running never overwrites an editor's changes. Pass `--force` to reset a
 * locale back to the shipped copy.
 *
 * Boots Strapi programmatically, so run with the dev server stopped:
 *
 *   node scripts/seed-landing-project.js [--force]
 *
 */
const { LANDING_PROJECT } = require('./lib/landing-project');

const UID = 'api::landing-project.landing-project';
const LOCALES = ['en', 'en-EU'];

async function grantPublicRead(strapi, log) {
  const action = `${UID}.find`;
  const role = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'public' } });
  if (!role) return log('no public role — skipped permission grant');
  const existing = await strapi.db
    .query('plugin::users-permissions.permission')
    .findOne({ where: { role: role.id, action } });
  if (existing) return log('public read already granted');
  await strapi.db.query('plugin::users-permissions.permission').create({ data: { action, role: role.id } });
  log('granted public read');
}

async function seedLandingProject(strapi, locales = LOCALES, log = () => {}, { force = false } = {}) {
  await grantPublicRead(strapi, log);

  const entries = await Promise.all(locales.map((locale) => strapi.documents(UID).findFirst({
    locale,
    populate: { Intro: true, Highlights: { populate: ['Items'] } },
  })));
  let documentId = entries.find(Boolean)?.documentId;
  for (const [index, locale] of locales.entries()) {
    const entry = entries[index];
    if (entry) documentId = entry.documentId;
    if ((entry?.Intro || entry?.Highlights) && !force) {
      log(`${locale}: already has content — left untouched`);
      continue;
    }

    const data = { ...LANDING_PROJECT };
    let saved;
    if (documentId) saved = await strapi.documents(UID).update({ documentId, locale, status: 'published', data });
    else saved = await strapi.documents(UID).create({ locale, status: 'published', data });
    documentId = saved.documentId;
    log(`${locale}: seeded both cards`);
  }
}

async function main() {
  const strapi = await require('@strapi/strapi').createStrapi().load();
  const log = (m) => strapi.log.info(`[landing-project] ${m}`);
  try {
    await seedLandingProject(strapi, LOCALES, log, { force: process.argv.includes('--force') });
    log('done');
  } finally {
    await strapi.destroy();
  }
}

module.exports = { seedLandingProject, UID, LOCALES };

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
