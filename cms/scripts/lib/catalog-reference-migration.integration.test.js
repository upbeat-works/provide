'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const knexFactory = require('../../node_modules/knex');
const migration = require('../../database/migrations/2026.09.10T00.00.00.canonical-catalog-references');
const titleCaseMigration = require('../../database/migrations/2026.09.10T00.00.01.title-case-catalog-references');

test('recognizes the PostgreSQL client name used by Strapi', async (context) => {
  const knex = knexFactory({ client: 'postgres' });
  context.after(() => knex.destroy());
  assert.equal(migration.isPostgresDialect(knex), true);
});

test('does not treat SQLite as PostgreSQL', async (context) => {
  const knex = sqliteKnex();
  context.after(() => knex.destroy());
  assert.equal(migration.isPostgresDialect(knex), false);
});

async function createRepository(knex, indicator = 'urbclim-heatwave-days') {
  for (const [name, field] of [
    ['components_impacts_galery_impact_geos', 'indicator'],
    ['components_impacts_galery_impact_time_snapshots', 'indicator'],
    ['components_avoiding_impacts_indicators', 'uid'],
  ]) {
    await knex.schema.createTable(name, (table) => {
      table.integer('id').primary();
      table.string(field);
    });
    await knex(name).insert({ id: 1, [field]: indicator });
  }
  for (const name of ['components_future_impacts_future_impacts', 'components_avoiding_impacts_avoiding_impacts']) {
    await knex.schema.createTable(name, (table) => {
      table.integer('id').primary();
      table.string('explorer_url');
    });
  }
  await knex('components_future_impacts_future_impacts').insert({
    id: 1,
    explorer_url: `/impacts/explore?indicator=urbclim-heatwave-days&geography=lisbon&note=${'x'.repeat(260)}#chart`,
  });
  await knex('components_avoiding_impacts_avoiding_impacts').insert({ id: 1, explorer_url: '/impacts/avoid' });
}

function sqliteKnex() {
  const directory = mkdtempSync(join(tmpdir(), 'provide-catalog-migration-'));
  return knexFactory({ client: 'better-sqlite3', connection: { filename: join(directory, 'data.db') }, useNullAsDefault: true });
}

test('boot migration creates columns, writes exact values, and is idempotent on SQLite', async (context) => {
  const knex = sqliteKnex();
  context.after(() => knex.destroy());
  await createRepository(knex);
  await migration.up(knex);
  await migration.up(knex);
  await titleCaseMigration.up(knex);
  await titleCaseMigration.up(knex);

  for (const [name, field] of [
    ['components_impacts_galery_impact_geos', 'indicator'],
    ['components_impacts_galery_impact_time_snapshots', 'indicator'],
    ['components_avoiding_impacts_indicators', 'uid'],
  ]) {
    assert.deepEqual(await knex(name).first({ value: field }, 'instance'), { value: 'Heatwave Days per Year', instance: 'provide-internal' });
  }
  const explorerUrl = (await knex('components_future_impacts_future_impacts').first('explorer_url')).explorer_url;
  assert.equal(explorerUrl.startsWith('/impacts/explore?indicator=Heatwave+Days+per+Year&geography=Lisbon&note='), true);
  assert.equal(explorerUrl.endsWith('&instance=provide-internal#chart'), true);
  assert.equal(explorerUrl.length > 255, true);
  assert.equal((await knex('components_avoiding_impacts_avoiding_impacts').first('explorer_url')).explorer_url, '/impacts/avoid');
});

test('unknown input rolls back without a persistent schema or content mutation', async (context) => {
  const knex = sqliteKnex();
  context.after(() => knex.destroy());
  await createRepository(knex, 'unknown');
  await assert.rejects(migration.up(knex), /Unknown indicator/);
  assert.equal((await knex('components_impacts_galery_impact_geos').first('indicator')).indicator, 'unknown');
  assert.equal(await knex.schema.hasColumn('components_impacts_galery_impact_geos', 'instance'), false);
});

test('missing component tables are an empty migration input', async (context) => {
  const knex = sqliteKnex();
  context.after(() => knex.destroy());
  await migration.up(knex);
  assert.deepEqual(await knex.raw("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'"), []);
});

test('title-case migration persists every reference shape and is idempotent on SQLite', async (context) => {
  const knex = sqliteKnex();
  context.after(() => knex.destroy());
  for (const [name, field, value] of [
    ['components_impacts_galery_impact_geos', 'indicator', 'Global atmospheric CH4 concentration from peatland emissions'],
    ['components_impacts_galery_impact_time_snapshots', 'indicator', 'Annual maximum of the fire weather index'],
    ['components_avoiding_impacts_indicators', 'uid', 'Lost working hours per year for intense activities'],
  ]) {
    await knex.schema.createTable(name, (table) => {
      table.integer('id').primary();
      table.string(field);
      table.string('instance');
    });
    await knex(name).insert({ id: 1, [field]: value, instance: 'provide-internal' });
  }
  for (const name of ['components_future_impacts_future_impacts', 'components_avoiding_impacts_avoiding_impacts']) {
    await knex.schema.createTable(name, (table) => {
      table.integer('id').primary();
      table.text('explorer_url');
    });
  }
  await knex('components_future_impacts_future_impacts').insert({
    id: 1,
    explorer_url: '/impacts/explore?indicator=Sea+surface+pH&note=keep#chart',
  });
  await knex('components_avoiding_impacts_avoiding_impacts').insert({ id: 1, explorer_url: '/impacts/avoid' });

  await titleCaseMigration.up(knex);
  const first = {
    geo: await knex('components_impacts_galery_impact_geos').first(),
    time: await knex('components_impacts_galery_impact_time_snapshots').first(),
    avoid: await knex('components_avoiding_impacts_indicators').first(),
    futureUrl: await knex('components_future_impacts_future_impacts').first(),
    avoidUrl: await knex('components_avoiding_impacts_avoiding_impacts').first(),
  };
  assert.equal(first.geo.indicator, 'Global Atmospheric CH4 Concentration from Peatland Emissions');
  assert.equal(first.time.indicator, 'Annual Maximum of the Fire Weather Index');
  assert.equal(first.avoid.uid, 'Lost Working Hours per Year for Intense Activities');
  assert.equal(first.futureUrl.explorer_url, '/impacts/explore?indicator=Sea+Surface+pH&note=keep#chart');
  assert.equal(first.avoidUrl.explorer_url, '/impacts/avoid');

  await titleCaseMigration.up(knex);
  assert.deepEqual(await knex('components_impacts_galery_impact_geos').first(), first.geo);
  assert.deepEqual(await knex('components_impacts_galery_impact_time_snapshots').first(), first.time);
  assert.deepEqual(await knex('components_avoiding_impacts_indicators').first(), first.avoid);
  assert.deepEqual(await knex('components_future_impacts_future_impacts').first(), first.futureUrl);
  assert.deepEqual(await knex('components_avoiding_impacts_avoiding_impacts').first(), first.avoidUrl);
});

test('boot migration runs in the configured PostgreSQL strapi schema', { skip: process.env.POSTGRES_MIGRATION_TEST !== '1' }, async () => {
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
    const schema = await knex('information_schema.schemata').where({ schema_name: 'strapi' }).first('schema_name');
    assert.ok(schema, 'Configured PostgreSQL schema "strapi" does not exist');
    await knex.transaction(async (transaction) => {
      await transaction.raw('set local search_path to strapi');
      const snapshotTables = [
        ['components_impacts_galery_impact_geos', 'indicator'],
        ['components_impacts_galery_impact_time_snapshots', 'indicator'],
        ['components_avoiding_impacts_indicators', 'uid'],
      ];
      const urlTables = ['components_future_impacts_future_impacts', 'components_avoiding_impacts_avoiding_impacts'];
      for (const [name] of snapshotTables) {
        assert.equal(await transaction.schema.withSchema('strapi').hasTable(name), true, `Required PostgreSQL table strapi.${name} is absent`);
        assert.ok(Number((await transaction.withSchema('strapi').table(name).count({ count: '*' }).first()).count) > 0, `Required PostgreSQL table strapi.${name} has no data`);
      }
      for (const name of urlTables) {
        assert.equal(await transaction.schema.withSchema('strapi').hasTable(name), true, `Required PostgreSQL table strapi.${name} is absent`);
      }
      await migration.up(transaction);
      const first = {};
      const canonicalIndicators = new Set([
        'Days a Year with Maximum Temperatures Above X°C',
        'Nights a Year with Minimum Temperatures Above X°C',
        'Days a Year with Extreme Heat Stress',
        'Days a Year with Very High Heat Stress',
        'Cooling Degree Hours',
        'Lost Working Hours per Year for Intense Activities',
        'Heatwave Days per Year',
        'Population Exposed to Heatwaves',
      ]);
      for (const [name, field] of snapshotTables) {
        assert.equal(await transaction.schema.withSchema('strapi').hasColumn(name, 'instance'), true);
        const rows = await transaction.withSchema('strapi').table(name).select('id', field, 'instance').orderBy('id');
        for (const row of rows) {
          assert.equal(canonicalIndicators.has(row[field]), true, `Unexpected canonical indicator ${row[field]}`);
          assert.equal(row.instance, 'provide-internal');
        }
        first[name] = rows;
      }
      for (const name of urlTables) {
        const rows = await transaction.withSchema('strapi').table(name).select('id', 'explorer_url').orderBy('id');
        for (const row of rows) {
          if (!row.explorer_url) continue;
          assert.equal(row.explorer_url.includes('urbclim-'), false);
          const url = new URL(row.explorer_url, 'https://provide.local');
          if (url.searchParams.has('indicator')) assert.equal(url.searchParams.get('instance'), 'provide-internal');
        }
        const column = await transaction('information_schema.columns').where({ table_schema: 'strapi', table_name: name, column_name: 'explorer_url' }).first('data_type');
        assert.equal(column.data_type, 'text');
        first[name] = rows;
      }
      assert.equal(
        urlTables.some((name) => first[name].some((row) => (row.explorer_url?.length ?? 0) > 255)),
        true,
        'Repository smoke must cover a canonical Explorer URL longer than 255 characters'
      );
      await migration.up(transaction);
      for (const [name, field] of snapshotTables) {
        assert.deepEqual(await transaction.withSchema('strapi').table(name).select('id', field, 'instance').orderBy('id'), first[name]);
      }
      for (const name of urlTables) {
        assert.deepEqual(await transaction.withSchema('strapi').table(name).select('id', 'explorer_url').orderBy('id'), first[name]);
      }
      throw new Error('ROLLBACK_SMOKE');
    });
  } catch (error) {
    if (error.message !== 'ROLLBACK_SMOKE') throw error;
  } finally {
    await knex.destroy();
  }
});
