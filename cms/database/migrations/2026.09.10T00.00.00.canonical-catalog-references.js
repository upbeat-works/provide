'use strict';

const { planCatalogReferenceMigration } = require('../../scripts/lib/catalog-reference-migration');

const SNAPSHOT_TABLES = [
  ['components_impacts_galery_impact_geos', 'impactGeoSnapshots'],
  ['components_impacts_galery_impact_time_snapshots', 'impactTimeSnapshots'],
  ['components_avoiding_impacts_indicators', 'avoidingIndicators'],
];
const URL_TABLES = ['components_future_impacts_future_impacts', 'components_avoiding_impacts_avoiding_impacts'];

function schemaBuilder(knex) {
  const schema = knex.client?.config?.connection?.schema;
  return schema ? knex.schema.withSchema(schema) : knex.schema;
}

function table(knex, name) {
  const schema = knex.client?.config?.connection?.schema;
  return schema ? knex.withSchema(schema).table(name) : knex(name);
}

async function addInstanceColumns(knex) {
  for (const [name] of SNAPSHOT_TABLES) {
    if (!(await schemaBuilder(knex).hasTable(name))) continue;
    if (await schemaBuilder(knex).hasColumn(name, 'instance')) continue;
    await schemaBuilder(knex).alterTable(name, (definition) => definition.string('instance'));
  }
}

function isPostgresDialect(knex) {
  const client = knex.client;
  if (client?.dialect === 'postgresql') return true;
  if (client?.driverName === 'pg') return true;
  return ['pg', 'postgres', 'postgresql'].includes(client?.config?.client);
}

async function widenExplorerUrlColumns(knex) {
  if (!isPostgresDialect(knex)) return;
  for (const name of URL_TABLES) {
    if (!(await schemaBuilder(knex).hasTable(name))) continue;
    await schemaBuilder(knex).alterTable(name, (definition) => definition.text('explorer_url').alter());
  }
}

async function rows(knex, name, columns) {
  if (!(await schemaBuilder(knex).hasTable(name))) return [];
  const available = [];
  for (const column of columns) {
    if (await schemaBuilder(knex).hasColumn(name, column)) available.push(column);
  }
  return table(knex, name).select(available);
}

async function readRepository(knex) {
  const [impactGeoSnapshots, impactTimeSnapshots, avoidingIndicators] = await Promise.all([
    rows(knex, SNAPSHOT_TABLES[0][0], ['id', 'indicator', 'instance']),
    rows(knex, SNAPSHOT_TABLES[1][0], ['id', 'indicator', 'instance']),
    rows(knex, SNAPSHOT_TABLES[2][0], ['id', 'uid', 'instance']),
  ]);
  const explorerUrls = [];
  for (const name of URL_TABLES) {
    const urlRows = await rows(knex, name, ['id', 'explorer_url']);
    for (const row of urlRows) {
      if (row.explorer_url) explorerUrls.push({ id: row.id, table: name, url: row.explorer_url });
    }
  }
  return { impactGeoSnapshots, impactTimeSnapshots, avoidingIndicators, explorerUrls };
}

async function applyPlan(knex, plan) {
  for (const [name, key] of SNAPSHOT_TABLES) {
    for (const row of plan[key]) {
      const value = key === 'avoidingIndicators' ? { uid: row.uid, instance: row.instance } : { indicator: row.indicator, instance: row.instance };
      await table(knex, name).where({ id: row.id }).update(value);
    }
  }
  for (const row of plan.explorerUrls) {
    await table(knex, row.table).where({ id: row.id }).update({ explorer_url: row.url });
  }
}

module.exports = {
  isPostgresDialect,
  async up(knex) {
    await knex.transaction(async (transaction) => {
      const repository = await readRepository(transaction);
      const plan = planCatalogReferenceMigration(repository);
      await addInstanceColumns(transaction);
      await widenExplorerUrlColumns(transaction);
      await applyPlan(transaction, plan);
    });
  },
};
