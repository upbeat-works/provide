'use strict';
/**
 * Create (or update) the "adaptation" case study from the legacy `adaptation`
 * single type of the original Strapi. The old site exposed adaptation as a root
 * page; the new site models it as a case study (see lib/adaptation-case-study.js
 * for the field mapping). Source content is the committed snapshot
 * lib/adaptation-source.json (downloaded from https://provide-cms.herokuapp.com).
 *
 * Idempotent — matches an existing entry by CityUid + locale and updates it in
 * place, so it is safe to re-run.
 *
 * Boots Strapi programmatically, so run with the dev server stopped:
 *
 *   node scripts/create-adaptation-case-study.js
 *
 * On Fly (idle instance):
 *   fly ssh console -a provide-cms -C \
 *     "/bin/sh -c 'cd /app && node scripts/create-adaptation-case-study.js'"
 */
const { buildAdaptationCaseStudy } = require('./lib/adaptation-case-study');
const source = require('./lib/adaptation-source.json');

const UID = 'api::case-study-dynamic.case-study-dynamic';
const PROJECT_UID = 'api::project.project';
// The public site reads content in en-EU (VITE_STRAPI_LOCALE); en is the base
// locale / fallback. Seed both to match the other content types.
const LOCALES = ['en', 'en-EU'];
const PROJECT_TITLE = 'Provide';

// Find the PROVIDE project id in `locale`, falling back to the same project in
// any locale (relations can point at a localization). Returns null if absent.
async function findProjectId(strapi, locale) {
  const inLocale = await strapi.entityService.findMany(PROJECT_UID, {
    locale,
    filters: { Title: PROJECT_TITLE },
    limit: 1,
  });
  if (inLocale?.[0]) return inLocale[0].id;
  const anyLocale = await strapi.entityService.findMany(PROJECT_UID, {
    filters: { Title: PROJECT_TITLE },
    limit: 1,
  });
  return anyLocale?.[0]?.id ?? null;
}

async function main() {
  const strapi = await require('@strapi/strapi')().load();
  const log = (m) => strapi.log.info(`[adaptation] ${m}`);
  try {
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

    for (const locale of LOCALES) {
      const projectId = await findProjectId(strapi, locale);
      if (!projectId) log(`${locale}: WARNING — no "${PROJECT_TITLE}" project found; creating without a Project relation`);

      const data = {
        ...base,
        locale,
        publishedAt: new Date(),
        ...(projectId ? { Project: projectId } : {}),
      };

      const existing = await strapi.entityService.findMany(UID, {
        locale,
        filters: { CityUid: base.CityUid },
        limit: 1,
      });

      if (existing?.[0]) {
        await strapi.entityService.update(UID, existing[0].id, { data });
        log(`${locale}: updated "${base.Title}" (${base.CityUid}) id=${existing[0].id}`);
      } else {
        const rec = await strapi.entityService.create(UID, { data });
        log(`${locale}: created "${base.Title}" (${base.CityUid}) id=${rec.id}`);
      }
    }

    log('done');
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
