'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const knexFactory = require('../../node_modules/knex');
const migration = require('../../database/migrations/2026.09.10T00.00.02.canonical-scenario-references');
const { ixmp4UidFor } = require('./scenario-uid-map');

function sqliteKnex() {
  const directory = mkdtempSync(join(tmpdir(), 'provide-scenario-migration-'));
  return knexFactory({ client: 'better-sqlite3', connection: { filename: join(directory, 'data.db') }, useNullAsDefault: true });
}

async function createRepository(knex) {
  for (const name of ['scenarios', 'scenario_simplifieds', 'components_scenario_scenarios', 'components_scenario_uid_scenarios']) {
    await knex.schema.createTable(name, (table) => {
      table.integer('id').primary();
      table.string('uid');
    });
    await knex(name).insert({ id: 1, uid: name === 'scenarios' ? 'ssp534-over' : 'ref-1p5-extended' });
  }
  await knex('scenarios').insert([
    { id: 2, uid: 'Stabilisation At 1.5°C' },
    { id: 3, uid: 'Unknown Scenario' },
  ]);
  for (const name of ['components_future_impacts_future_impacts', 'components_avoiding_impacts_avoiding_impacts']) {
    await knex.schema.createTable(name, (table) => {
      table.integer('id').primary();
      table.text('explorer_url');
    });
  }
  await knex('components_future_impacts_future_impacts').insert({
    id: 1,
    explorer_url: '/impacts/explore?scenarios%5B0%5D=curpol-os&note=keep&scenarios%5B1%5D=ref-1p5#chart',
  });
  await knex('components_avoiding_impacts_avoiding_impacts').insert({
    id: 1,
    explorer_url: '/impacts/avoid?scenarios%5B0%5D=Unknown+Scenario&link=https%3A%2F%2Fexample.test%2Fx#anchor',
  });
}

test('scenario migration persists exact names and URL parameters and is idempotent', async (context) => {
  const knex = sqliteKnex();
  context.after(() => knex.destroy());
  await createRepository(knex);
  await migration.up(knex);
  const first = {
    scenarios: await knex('scenarios').select('id', 'uid').orderBy('id'),
    future: await knex('components_future_impacts_future_impacts').first('explorer_url'),
    avoid: await knex('components_avoiding_impacts_avoiding_impacts').first('explorer_url'),
  };
  assert.deepEqual(first.scenarios, [
    { id: 1, uid: 'SSP5-3.4-Overshoot' },
    { id: 2, uid: 'Stabilisation at 1.5 °C' },
    { id: 3, uid: 'Unknown Scenario' },
  ]);
  for (const name of ['scenario_simplifieds', 'components_scenario_scenarios', 'components_scenario_uid_scenarios']) {
    assert.equal((await knex(name).first('uid')).uid, 'Stabilisation at 1.5 °C (Extended)');
  }
  assert.equal(first.future.explorer_url, '/impacts/explore?scenarios%5B0%5D=2020+Climate+Policies+then+back+to+1.5+%C2%B0C&note=keep&scenarios%5B1%5D=Stabilisation+at+1.5+%C2%B0C#chart');
  assert.equal(first.avoid.explorer_url, '/impacts/avoid?scenarios%5B0%5D=Unknown+Scenario&link=https%3A%2F%2Fexample.test%2Fx#anchor');

  await migration.up(knex);
  assert.deepEqual(await knex('scenarios').select('id', 'uid').orderBy('id'), first.scenarios);
  assert.deepEqual(await knex('components_future_impacts_future_impacts').first('explorer_url'), first.future);
  assert.deepEqual(await knex('components_avoiding_impacts_avoiding_impacts').first('explorer_url'), first.avoid);
});

test('missing scenario and URL tables are an empty migration input', async (context) => {
  const knex = sqliteKnex();
  context.after(() => knex.destroy());
  await migration.up(knex);
  assert.deepEqual(await knex.raw("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'"), []);
});

test('scenario migration runs in the configured PostgreSQL schema and rolls back', { skip: process.env.POSTGRES_MIGRATION_TEST !== '1' }, async () => {
  const knex = knexFactory({
    client: 'pg',
    connection: {
      host: process.env.DATABASE_HOST ?? 'localhost',
      port: Number(process.env.DATABASE_PORT ?? 5432),
      database: process.env.DATABASE_NAME ?? 'provide',
      user: process.env.DATABASE_USERNAME ?? 'postgres',
      password: process.env.DATABASE_PASSWORD ?? 'postgres',
      schema: 'strapi',
    },
  });
  try {
    await knex.transaction(async (transaction) => {
      const before = {};
      for (const name of ['scenarios', 'scenario_simplifieds', 'components_scenario_scenarios', 'components_scenario_uid_scenarios']) {
        if (!(await transaction.schema.withSchema('strapi').hasTable(name))) continue;
        before[name] = await transaction.withSchema('strapi').table(name).select('id', 'uid').orderBy('id');
      }
      await migration.up(transaction);
      for (const [name, rows] of Object.entries(before)) {
        const after = await transaction.withSchema('strapi').table(name).select('id', 'uid').orderBy('id');
        assert.deepEqual(after.map((row, index) => row.uid), rows.map((row) => ixmp4UidFor(row.uid) ?? row.uid), `${name} did not persist exact scenario names`);
      }
      throw new Error('ROLLBACK_SMOKE');
    });
  } catch (error) {
    if (error.message !== 'ROLLBACK_SMOKE') throw error;
  } finally {
    await knex.destroy();
  }
});
