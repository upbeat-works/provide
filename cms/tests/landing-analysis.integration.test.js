'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const createStrapi = require('@strapi/strapi');
const { UID } = require('../src/api/landing-analysis-card/lib/seed');

for (const setup of ['fresh', 'upgrade']) {
  test(`${setup}: imports media, links translations and preserves edits after restart`, async () => {
    const appDir = await fs.mkdtemp(path.join(os.tmpdir(), 'landing-cards-'));
    let strapi;
    try {
      await fs.mkdir(path.join(appDir, 'config'));
      await fs.mkdir(path.join(appDir, 'public/uploads'), { recursive: true });
      await fs.mkdir(path.join(appDir, 'src/api'), { recursive: true });
      await fs.copyFile(path.join(__dirname, '../package.json'), path.join(appDir, 'package.json'));
      await fs.symlink(path.join(__dirname, '../node_modules'), path.join(appDir, 'node_modules'));
      await fs.copyFile(path.join(__dirname, '../src/index.js'), path.join(appDir, 'src/index.js'));
      await fs.cp(path.join(__dirname, '../src/api/landing-analysis-card'), path.join(appDir, 'src/api/landing-analysis-card'), { recursive: true });
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
        strapi = await createStrapi({ appDir, distDir: appDir }).load();
        const oldEntries = await strapi.entityService.findMany(UID, { locale: 'all' });
        for (const entry of oldEntries) {
          await strapi.entityService.update(UID, entry.id, {
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

      strapi = await createStrapi({ appDir, distDir: appDir }).load();
      const entries = await strapi.entityService.findMany(UID, { locale: 'all', populate: ['localizations', 'Image'] });
      assert.equal(entries.length, 4);
      for (const entry of entries) {
        if (setup === 'upgrade') assert.equal(entry.Description, 'Editor text to preserve');
        assert.ok(entry.Image?.id, 'card must reference a media entry');
        assert.match(entry.Image.url, /^\/uploads\//);
        assert.equal(entry.localizations.length, 1);
        assert.equal(entry.localizations[0].Key, entry.Key);
        assert.notEqual(entry.localizations[0].locale, entry.locale);
      }

      const sibling = entries.find((entry) => entry.id === entries[0].localizations[0].id);
      assert.equal(entries[0].Image.id, sibling.Image.id);
      assert.equal(await strapi.db.query('plugin::upload.file').count(), 2);
      await strapi.entityService.update(UID, entries[2].id, { data: { Image: null } });
      await strapi.entityService.delete(UID, entries[0].id);
      await strapi.entityService.update(UID, entries[1].id, { data: { Key: 'edited-key', publishedAt: null } });
      await strapi.destroy();
      strapi = await createStrapi({ appDir, distDir: appDir }).load();

      const remaining = await strapi.entityService.findMany(UID, { locale: 'all', publicationState: 'preview', populate: ['Image'] });
      assert.equal(remaining.length, 3);
      const edited = remaining.find((entry) => entry.id === entries[1].id);
      assert.equal(edited.Key, 'edited-key');
      assert.equal(edited.publishedAt, null);
      assert.equal(remaining.find((entry) => entry.id === entries[2].id).Image, null);
      assert.equal(await strapi.db.query('plugin::upload.file').count(), 2);
    } finally {
      if (strapi) await strapi.destroy();
      await fs.rm(appDir, { recursive: true, force: true });
    }
  });

}
