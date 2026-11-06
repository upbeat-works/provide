'use strict';
/**
 * Create (or update) the "adaptation" case study from the legacy `adaptation`
 * single type of the original Strapi. The old site exposed adaptation as a root
 * page; the new site models it as a case study (see lib/adaptation-case-study.js
 * for the field mapping). Source content is the committed snapshot
 * lib/adaptation-source.json (downloaded from https://provide-cms.herokuapp.com).
 *
 * Matches by Slug and locale. Re-running replaces and publishes the mapped
 * fields, including any editor changes to those fields.
 *
 * Boots Strapi programmatically, so run with the dev server stopped:
 *
 *   node scripts/create-adaptation-case-study.js
 */
const { buildAdaptationCaseStudy } = require('./lib/adaptation-case-study');
const source = require('./lib/adaptation-source.json');

const UID = 'api::case-study-dynamic.case-study-dynamic';
const PROJECT_UID = 'api::project.project';
// The public site reads content in en-EU (VITE_STRAPI_LOCALE); en is the base
// locale / fallback. Seed both to match the other content types.
const LOCALES = ['en', 'en-EU'];
const PROJECT_TITLE = 'Provide';

async function findProjectId(strapi, locale) {
  const project = await strapi.documents(PROJECT_UID).findFirst({ locale, filters: { Title: PROJECT_TITLE } });
  return project?.documentId ?? null;
}

async function seedAdaptationCaseStudy(strapi, log = () => {}) {
  const base = buildAdaptationCaseStudy(source);

  // Ensure the target locales exist (a fresh Strapi has only `en`).
  const localeService = strapi.plugin('i18n').service('locales');
  const haveLocales = (await localeService.find()).map((l) => l.code);
  for (const code of LOCALES) {
    if (!haveLocales.includes(code)) {
      await localeService.create({ code, name: code });
      log(`created locale ${code}`);
    }
  }

  const entries = await Promise.all(LOCALES.map((locale) => strapi.documents(UID).findFirst({
    locale, filters: { Slug: base.Slug },
  })));
  let documentId = entries.find(Boolean)?.documentId;
  for (const [index, locale] of LOCALES.entries()) {
    const projectId = await findProjectId(strapi, locale);
    if (!projectId) log(`${locale}: WARNING — no "${PROJECT_TITLE}" project found; creating without a Project relation`);

    const data = {
      ...base,
      ...(projectId ? { Project: projectId } : {}),
    };

    const existing = entries[index];
    if (existing) documentId = existing.documentId;
    let saved;
    if (documentId) saved = await strapi.documents(UID).update({ documentId, locale, status: 'published', data });
    else saved = await strapi.documents(UID).create({ locale, status: 'published', data });
    documentId = saved.documentId;
    log(`${locale}: saved "${base.Title}" (${base.Slug}) documentId=${documentId}`);
  }
}

async function main() {
  const strapi = await require('@strapi/strapi').createStrapi().load();
  const log = (m) => strapi.log.info(`[adaptation] ${m}`);
  try {
    await seedAdaptationCaseStudy(strapi, log);
    log('done');
  } finally {
    await strapi.destroy();
  }
}

module.exports = { seedAdaptationCaseStudy };

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
