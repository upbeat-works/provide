'use strict';

const { planCatalogTitleCaseMigration } = require('../../scripts/lib/catalog-title-case-migration');

const SNAPSHOT_TABLES = [
  ['components_impacts_galery_impact_geos', 'impactGeoSnapshots', 'indicator'],
  ['components_impacts_galery_impact_time_snapshots', 'impactTimeSnapshots', 'indicator'],
  ['components_avoiding_impacts_indicators', 'avoidingIndicators', 'uid'],
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

async function rows(knex, name, columns) {
  if (!(await schemaBuilder(knex).hasTable(name))) return [];
  return table(knex, name).select(columns);
}

module.exports = {
  async up(knex) {
    await knex.transaction(async (transaction) => {
      const repository = { impactGeoSnapshots: [], impactTimeSnapshots: [], avoidingIndicators: [], explorerUrls: [] };
      for (const [name, key, field] of SNAPSHOT_TABLES) {
        repository[key] = await rows(transaction, name, ['id', field]);
      }
      for (const name of URL_TABLES) {
        const urlRows = await rows(transaction, name, ['id', 'explorer_url']);
        repository.explorerUrls.push(...urlRows.filter(({ explorer_url }) => explorer_url).map((row) => ({ id: row.id, table: name, url: row.explorer_url })));
      }

      const plan = planCatalogTitleCaseMigration(repository);
      for (const [name, key, field] of SNAPSHOT_TABLES) {
        for (const row of plan[key]) await table(transaction, name).where({ id: row.id }).update({ [field]: row[field] });
      }
      for (const row of plan.explorerUrls) await table(transaction, row.table).where({ id: row.id }).update({ explorer_url: row.url });
    });
  },
};
