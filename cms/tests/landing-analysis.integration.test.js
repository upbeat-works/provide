'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createStrapi } = require('@strapi/strapi');
const { applyCoverage } = require('../scripts/seed-case-study-coverage');
const { UID, SEED_STORE, seedLandingAnalysisCards } = require('../src/api/landing-analysis-card/lib/seed');
const { rekeyScenarios } = require('../scripts/rekey-scenario-uids');
const { seedAdaptationCaseStudy } = require('../scripts/create-adaptation-case-study');
const { seedLandingProject, UID: PROJECT_UID } = require('../scripts/seed-landing-project');

async function listCards(strapi, status) {
  const cards = await Promise.all(['en', 'en-EU'].map((locale) => strapi.documents(UID).findMany({ locale, status, populate: ['Image'] })));
  return cards.flat();
}

for (const setup of ['fresh', 'upgrade']) {
  test(`${setup}: imports media, links translations and preserves edits after restart`, async (t) => {
    const appDir = await fs.mkdtemp(path.join(os.tmpdir(), 'landing-cards-'));
    let strapi;
    try {
      await fs.mkdir(path.join(appDir, 'config'));
      await fs.mkdir(path.join(appDir, 'public/uploads'), { recursive: true });
      await fs.mkdir(path.join(appDir, 'src/api'), { recursive: true });
      await fs.copyFile(path.join(__dirname, '../package.json'), path.join(appDir, 'package.json'));
      await fs.symlink(path.join(__dirname, '../node_modules'), path.join(appDir, 'node_modules'));
      await fs.copyFile(path.join(__dirname, '../src/index.js'), path.join(appDir, 'src/index.js'));
      await fs.cp(path.join(__dirname, '../src/api'), path.join(appDir, 'src/api'), { recursive: true });
      await fs.cp(path.join(__dirname, '../src/components'), path.join(appDir, 'src/components'), { recursive: true });
      await fs.writeFile(path.join(appDir, 'config/database.js'),
        "module.exports = { connection: { client: 'sqlite', connection: { filename: __dirname + '/../test.db' }, useNullAsDefault: true } };");
      await fs.writeFile(path.join(appDir, 'config/server.js'),
        "module.exports = { app: { keys: ['test-key'] } };");
      await fs.writeFile(path.join(appDir, 'config/admin.js'),
        "module.exports = { auth: { secret: 'test-secret' }, apiToken: { salt: 'test-salt' }, transfer: { token: { salt: 'test-transfer' } } };");
      await fs.writeFile(path.join(appDir, 'config/plugins.js'),
        "module.exports = { 'users-permissions': { config: { jwtSecret: 'test-jwt' } } };");

      if (setup === 'upgrade') {
        const schemaPath = path.join(appDir, 'src/api/landing-analysis-card/content-types/landing-analysis-card/schema.json');
        const indexPath = path.join(appDir, 'src/index.js');
        const mediaSchema = await fs.readFile(schemaPath, 'utf8');
        const bootstrap = await fs.readFile(indexPath, 'utf8');
        const oldSchema = JSON.parse(mediaSchema);
        oldSchema.attributes.Image = { type: 'string', pluginOptions: { i18n: { localized: true } } };
        await fs.writeFile(schemaPath, JSON.stringify(oldSchema));
        await fs.writeFile(indexPath, bootstrap.replace('await seedLandingAnalysisImages(strapi);', ''));
        strapi = createStrapi({ appDir, distDir: appDir });
        await strapi.load();
        const oldEntries = (await Promise.all(['en', 'en-EU'].map((locale) => strapi.documents(UID).findMany({ locale, status: 'published' })))).flat();
        for (const entry of oldEntries) {
          await strapi.documents(UID).update({ documentId: entry.documentId, locale: entry.locale, status: 'published',
            data: { Image: '/img/old-image.png', Description: 'Editor text to preserve' },
          });
        }
        await strapi.destroy();
        strapi = null;
        await fs.writeFile(schemaPath, mediaSchema);
        await fs.writeFile(indexPath, bootstrap);
        delete require.cache[require.resolve(schemaPath)];
        delete require.cache[require.resolve(indexPath)];
      }

      strapi = createStrapi({ appDir, distDir: appDir });
      await strapi.load();
      await seedLandingProject(strapi);
      const projects = await Promise.all(['en', 'en-EU'].map((locale) => strapi.documents(PROJECT_UID).findFirst({ locale, status: 'published' })));
      assert.equal(projects[0].documentId, projects[1].documentId);
      await seedAdaptationCaseStudy(strapi);
      await seedAdaptationCaseStudy(strapi);
      const studies = (await Promise.all(['en', 'en-EU'].map((locale) => strapi.documents('api::case-study-dynamic.case-study-dynamic').findMany({ locale, status: 'published' })))).flat();
      assert.equal(studies.length, 2);
      assert.equal(studies[0].documentId, studies[1].documentId);
      const scenarios = strapi.documents('api::scenario.scenario');
      const scenario = await scenarios.create({ locale: 'en', status: 'published', data: { UID: 'curpol', Description: 'Published description' } });
      await scenarios.update({ documentId: scenario.documentId, locale: 'en', data: { Description: 'Draft description' } });
      const privateScenario = await scenarios.create({ locale: 'en', data: { UID: 'gs', Description: 'Private scenario' } });
      await rekeyScenarios(strapi);
      const published = await scenarios.findOne({ documentId: scenario.documentId, locale: 'en', status: 'published' });
      const draft = await scenarios.findOne({ documentId: scenario.documentId, locale: 'en', status: 'draft' });
      assert.equal(published.UID, '2020 Climate Policies');
      assert.equal(draft.UID, '2020 Climate Policies');
      assert.equal(published.Description, 'Published description');
      assert.equal(draft.Description, 'Draft description');
      assert.equal(await scenarios.findOne({ documentId: privateScenario.documentId, locale: 'en', status: 'published' }), null);
      const entries = await listCards(strapi, 'published');
      assert.equal(entries.length, 4);
      for (const key of new Set(entries.map((entry) => entry.Key))) {
        const translations = entries.filter((entry) => entry.Key === key);
        assert.equal(typeof translations[0].documentId, 'string');
        assert.equal(translations[0].documentId, translations[1].documentId);
      }
      for (const entry of entries) {
        if (setup === 'upgrade') assert.equal(entry.Description, 'Editor text to preserve');
        assert.ok(entry.Image?.id, 'card must reference a media entry');
        assert.match(entry.Image.url, /^\/uploads\//);
      }

      const sibling = entries.find((entry) => entry.documentId === entries[0].documentId && entry.locale !== entries[0].locale);
      assert.equal(entries[0].Image.id, sibling.Image.id);
      assert.equal(await strapi.db.query('plugin::upload.file').count(), 2);
      await strapi.documents(UID).update({ documentId: entries[2].documentId, locale: entries[2].locale, status: 'published', data: { Image: null } });
      await strapi.documents(UID).delete({ documentId: entries[0].documentId, locale: entries[0].locale });
      await strapi.documents(UID).update({ documentId: entries[1].documentId, locale: entries[1].locale, data: { Key: 'edited-key' } });
      await strapi.documents(UID).unpublish({ documentId: entries[1].documentId, locale: entries[1].locale });
      await strapi.destroy();
      strapi = createStrapi({ appDir, distDir: appDir });
      await strapi.load();

      const remaining = await listCards(strapi, 'draft');
      assert.equal(remaining.length, 3);
      const edited = remaining.find((entry) => entry.documentId === entries[1].documentId && entry.locale === entries[1].locale);
      assert.equal(edited.Key, 'edited-key');
      assert.equal(edited.publishedAt, null);
      assert.equal(remaining.find((entry) => entry.documentId === entries[2].documentId && entry.locale === entries[2].locale).Image, null);
      assert.equal(await strapi.db.query('plugin::upload.file').count(), 2);
      await t.test('fills a missing language without splitting the card', async () => {
        for (const card of remaining) await strapi.documents(UID).delete({ documentId: card.documentId, locale: card.locale });
        await strapi.store(SEED_STORE).delete();
        const euCard = await strapi.documents(UID).create({ locale: 'en-EU', status: 'published', data: { Key: 'avoid-future-impacts', Path: '/impacts/avoid', Description: 'Keep this editor text' } });
        await seedLandingAnalysisCards(strapi);
        const enCard = await strapi.documents(UID).findFirst({ locale: 'en', filters: { Key: 'avoid-future-impacts' } });
        assert.equal(enCard.documentId, euCard.documentId);
        const keptCard = await strapi.documents(UID).findOne({ documentId: euCard.documentId, locale: 'en-EU', status: 'published' });
        assert.equal(keptCard.Description, 'Keep this editor text');
      });

      await t.test('fills missing project and adaptation languages on the existing document', async () => {
        await strapi.documents(PROJECT_UID).delete({ documentId: projects[0].documentId, locale: 'en' });
        await seedLandingProject(strapi);
        const project = await strapi.documents(PROJECT_UID).findFirst({ locale: 'en' });
        assert.equal(project.documentId, projects[1].documentId);
        const cases = strapi.documents('api::case-study-dynamic.case-study-dynamic');
        await cases.delete({ documentId: studies[0].documentId, locale: 'en' });
        await seedAdaptationCaseStudy(strapi);
        const adaptation = await cases.findFirst({ locale: 'en', filters: { Slug: 'adaptation' } });
        assert.equal(adaptation.documentId, studies[1].documentId);
      });

      await t.test('coverage repairs leave published content and private drafts separate', async () => {
        const caseStudies = strapi.documents('api::case-study-dynamic.case-study-dynamic');
        const publicStudy = await caseStudies.create({ locale: 'en', status: 'published', data: { Slug: 'coverage-public', Title: 'Public title' } });
        await caseStudies.update({ documentId: publicStudy.documentId, locale: 'en', data: { Title: 'Private title' } });
        const privateStudy = await caseStudies.create({ locale: 'en', data: { Slug: 'coverage-private', Title: 'Private study' } });
        await applyCoverage(strapi, [
          { slug: 'coverage-public', covers: ['PT'], isDefault: true },
          { slug: 'coverage-private', covers: ['AT'], isDefault: false },
        ]);
        const publicAfter = await caseStudies.findOne({ documentId: publicStudy.documentId, locale: 'en', status: 'published' });
        const draftAfter = await caseStudies.findOne({ documentId: publicStudy.documentId, locale: 'en', populate: ['Covers'] });
        assert.equal(publicAfter.Title, 'Public title');
        assert.equal(draftAfter.Title, 'Private title');
        assert.deepEqual(draftAfter.Covers.map((entry) => entry.GeographyId), ['PT']);
        assert.equal(await caseStudies.findOne({ documentId: privateStudy.documentId, locale: 'en', status: 'published' }), null);
      });
    } finally {
      if (strapi) await strapi.destroy();
      await fs.rm(appDir, { recursive: true, force: true });
    }
  });

}
