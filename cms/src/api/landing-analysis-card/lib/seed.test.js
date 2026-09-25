'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { seedLandingAnalysisCards, LANDING_ANALYSIS_CARDS } = require('./seed');
const schema = require('../content-types/landing-analysis-card/schema.json');

test('the Strapi collection declares every field used by the initial cards', () => {
  for (const card of LANDING_ANALYSIS_CARDS) {
    for (const field of Object.keys(card)) {
      assert.ok(schema.attributes[field], `schema is missing ${field}`);
    }
  }
  assert.equal(schema.kind, 'collectionType');
  assert.equal(schema.pluginOptions.i18n.localized, true);
});

function makeStrapi(existing = []) {
  const state = { entries: [...existing], permissions: [], creates: [], permissionCreates: [], locales: ['en'], completed: false, updates: [] };
  const strapi = {
    store: () => ({
      get: async () => state.completed,
      set: async ({ value }) => { state.completed = value; },
    }),
    plugin: () => ({
      service: () => ({
        find: async () => state.locales.map((code) => ({ code })),
        create: async ({ code }) => { state.locales.push(code); },
      }),
    }),
    db: {
      query(uid) {
        if (uid === 'api::landing-analysis-card.landing-analysis-card') {
          return { update: async ({ where, data }) => {
            state.updates.push({ id: where.id, data });
            Object.assign(state.entries.find((entry) => entry.id === where.id), data);
          } };
        }
        if (uid === 'plugin::users-permissions.role') return { findOne: async () => ({ id: 1 }) };
        assert.equal(uid, 'plugin::users-permissions.permission');
        return {
          findMany: async ({ where }) => state.permissions.filter((p) => p.role === where.role),
          create: async ({ data }) => {
            state.permissionCreates.push(data);
            state.permissions.push(data);
          },
        };
      },
    },
    entityService: {
      findMany: async (_uid, { locale, filters }) => state.entries.filter((entry) => entry.locale === locale && entry.Key === filters.Key),
      create: async (_uid, { data }) => {
        assert.ok(state.locales.includes(data.locale), 'locale must exist before creating content');
        const entry = { id: state.entries.length + 1, ...data };
        state.creates.push(entry);
        state.entries.push(entry);
        return entry;
      },
    },
  };
  return { strapi, state };
}

test('seeds the two cards once per locale and grants public read', async () => {
  const { strapi, state } = makeStrapi();
  await seedLandingAnalysisCards(strapi, ['en', 'en-EU']);

  assert.equal(state.creates.length, 4);
  assert.deepEqual(state.creates.map(({ locale, Key }) => `${locale}:${Key}`).sort(), [
    'en-EU:avoid-future-impacts', 'en-EU:explore-future-impacts',
    'en:avoid-future-impacts', 'en:explore-future-impacts',
  ]);
  assert.equal(state.creates.every((entry) => entry.publishedAt instanceof Date), true);
  assert.deepEqual(state.permissionCreates, [{ action: 'api::landing-analysis-card.landing-analysis-card.find', role: 1 }]);
});

test('leaves existing localized card content unchanged on later startups', async () => {
  const existing = { id: 99, locale: 'en', Key: 'avoid-future-impacts', Description: 'An editor revision' };
  const { strapi, state } = makeStrapi([existing]);
  await seedLandingAnalysisCards(strapi, ['en']);
  await seedLandingAnalysisCards(strapi, ['en']);

  assert.equal(state.creates.length, LANDING_ANALYSIS_CARDS.length - 1);
  assert.equal(existing.Description, 'An editor revision');
  assert.equal(state.permissionCreates.length, 1);
});

test('keeps editor deletions and key changes after the first successful seed', async () => {
  const { strapi, state } = makeStrapi();
  await seedLandingAnalysisCards(strapi);
  state.entries.splice(0, 1);
  state.entries[0].Key = 'editor-key';
  const entries = structuredClone(state.entries);
  await seedLandingAnalysisCards(strapi);
  assert.deepEqual(state.entries, entries);
  assert.equal(state.creates.length, 4);
});

test('links the two language versions of each card', async () => {
  const { strapi, state } = makeStrapi();
  await seedLandingAnalysisCards(strapi);
  for (const entry of state.entries) {
    const sibling = state.entries.find((other) => other.Key === entry.Key && other.locale !== entry.locale);
    assert.deepEqual(entry.localizations, [sibling.id]);
  }
});

test('can finish a failed seed without duplicating cards', async () => {
  const { strapi, state } = makeStrapi();
  const create = strapi.entityService.create;
  strapi.entityService.create = async (uid, options) => {
    if (state.entries.length === 1) throw new Error('write failed');
    return create(uid, options);
  };
  await assert.rejects(seedLandingAnalysisCards(strapi), /write failed/);
  assert.equal(state.completed, false);
  strapi.entityService.create = create;
  await seedLandingAnalysisCards(strapi);
  assert.equal(state.entries.length, 4);
  assert.equal(state.completed, true);
});
