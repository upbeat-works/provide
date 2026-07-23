'use strict';
/**
 * Reshape the About single type into the four-section information architecture
 * used by the sidebar index — About the dashboard / Projects / Funding sources /
 * License & how to cite (see lib/about-restructure.js for the mapping). The index
 * (NestedNav) is derived from the rendered h2/h3 headings, so this also
 * rearranges the menu.
 *
 * Idempotent — safe to re-run; already-restructured entries are left untouched.
 *
 * Boots Strapi programmatically, so run with the dev server stopped:
 *
 *   node scripts/restructure-about.js
 *
 * On Fly (idle instance):
 *   fly ssh console -a provide-cms -C \
 *     "/bin/sh -c 'cd /app && node scripts/restructure-about.js'"
 */
const { restructureAbout } = require('./lib/about-restructure');

const UID = 'api::about.about';
const LOCALES = ['en', 'en-EU'];

async function main() {
  const strapi = await require('@strapi/strapi')().load();
  const log = (m) => strapi.log.info(`[about] ${m}`);
  try {
    for (const locale of LOCALES) {
      const entry = await strapi.entityService.findMany(UID, { locale, populate: ['Section'] });
      if (!entry) {
        log(`${locale}: no About entry — skipped`);
        continue;
      }

      const before = (entry.Section ?? []).map((s) => ({ Title: s.Title, Text: s.Text ?? '' }));
      const after = restructureAbout(before);

      if (after === before) {
        log(`${locale}: already restructured — skipped`);
        continue;
      }

      await strapi.entityService.update(UID, entry.id, {
        data: { Section: after, publishedAt: new Date() },
      });
      log(`${locale}: ${before.length} → ${after.length} sections [${after.map((s) => s.Title).join(' | ')}]`);
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
