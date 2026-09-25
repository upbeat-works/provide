'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const createStrapi = require('@strapi/strapi');
const { UID } = require('../src/api/landing-analysis-card/lib/seed');

test('fresh startup links translations and preserves editor changes after restart', async () => {
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

    strapi = await createStrapi({ appDir, distDir: appDir }).load();
    const entries = await strapi.entityService.findMany(UID, { locale: 'all', populate: ['localizations'] });
    assert.equal(entries.length, 4);
    for (const entry of entries) {
      assert.equal(entry.localizations.length, 1);
      assert.equal(entry.localizations[0].Key, entry.Key);
      assert.notEqual(entry.localizations[0].locale, entry.locale);
    }

    await strapi.entityService.delete(UID, entries[0].id);
    await strapi.entityService.update(UID, entries[1].id, { data: { Key: 'edited-key', publishedAt: null } });
    await strapi.destroy();
    strapi = await createStrapi({ appDir, distDir: appDir }).load();

    const remaining = await strapi.entityService.findMany(UID, { locale: 'all', publicationState: 'preview' });
    assert.equal(remaining.length, 3);
    const edited = remaining.find((entry) => entry.id === entries[1].id);
    assert.equal(edited.Key, 'edited-key');
    assert.equal(edited.publishedAt, null);
  } finally {
    if (strapi) await strapi.destroy();
    await fs.rm(appDir, { recursive: true, force: true });
  }
});
