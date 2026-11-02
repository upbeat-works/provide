'use strict';

const SEED_STORE = { type: 'core', name: 'landing-analysis-cards', key: 'initial-content' };
const UID = 'api::landing-analysis-card.landing-analysis-card';

const LANDING_ANALYSIS_CARDS = [
  {
    Key: 'avoid-future-impacts',
    Path: '/impacts/avoid',
    ImageAlt: 'Chart showing compatible scenarios and impact levels',
    Description:
      'Avoiding future impacts explores which scenarios minimise the risk from certain impacts in cities and their rural surroundings.',
    Project: 'Provide',
    Geography: 'Cities',
    DataSource: 'CMIP6',
    SortOrder: 1,
  },
  {
    Key: 'explore-future-impacts',
    Path: '/impacts/explore',
    ImageAlt: 'Map showing future climate impacts across geographies',
    Description:
      'Explorer future impacts shows how different climate futures will affect the environment and people across different emission scenarios.',
    Project: 'Provide',
    Geography: 'Global',
    DataSource: 'CMIP6',
    SortOrder: 2,
  },
];

async function grantPublicRead(strapi, log) {
  const action = `${UID}.find`;
  const role = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'public' } });
  if (!role) return;

  const permissions = await strapi.db.query('plugin::users-permissions.permission').findMany({ where: { role: role.id } });
  if (permissions.some((permission) => permission.action === action)) return;

  await strapi.db.query('plugin::users-permissions.permission').create({ data: { action, role: role.id } });
  log(`granted public read for ${UID}`);
}

async function seedLandingAnalysisCards(strapi, locales = ['en', 'en-EU'], log = () => {}) {
  const store = strapi.store(SEED_STORE);
  if (await store.get()) return;

  const localeService = strapi.plugin('i18n').service('locales');
  const existingLocales = await localeService.find();
  for (const code of locales) {
    if (!existingLocales.some((locale) => locale.code === code)) {
      await localeService.create({ code, name: code });
    }
  }

  await grantPublicRead(strapi, log);
  for (const card of LANDING_ANALYSIS_CARDS) {
    const entries = await Promise.all(locales.map((locale) => strapi.documents(UID).findFirst({
      locale, status: 'draft', filters: { Key: card.Key },
    })));
    let documentId = entries.find(Boolean)?.documentId;
    for (const [index, locale] of locales.entries()) {
      if (entries[index]) continue;
      const options = { locale, status: 'published', data: { ...card } };
      let entry;
      if (documentId) entry = await strapi.documents(UID).update({ documentId, ...options });
      else entry = await strapi.documents(UID).create(options);
      documentId = entry.documentId;
      log(`${locale}: seeded ${card.Key}`);
    }
  }

  await store.set({ value: true });
}

module.exports = { LANDING_ANALYSIS_CARDS, seedLandingAnalysisCards, UID, SEED_STORE };
