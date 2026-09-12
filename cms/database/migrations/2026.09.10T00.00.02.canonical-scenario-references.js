'use strict';

const { planScenarioReferenceMigration } = require('../../scripts/lib/scenario-reference-migration');

const URL_TABLES = ['components_future_impacts_future_impacts', 'components_avoiding_impacts_avoiding_impacts'];
const SCENARIO_TABLES = ['scenarios', 'scenario_simplifieds', 'components_scenario_scenarios', 'components_scenario_uid_scenarios'];

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
      const repository = {
        scenarios: [],
        explorerUrls: [],
      };
      for (const name of SCENARIO_TABLES) {
        const scenarioRows = await rows(transaction, name, ['id', 'uid']);
        repository.scenarios.push(...scenarioRows.map((row) => ({ ...row, table: name })));
      }
      for (const name of URL_TABLES) {
        const urlRows = await rows(transaction, name, ['id', 'explorer_url']);
        repository.explorerUrls.push(...urlRows.filter(({ explorer_url }) => explorer_url).map((row) => ({ id: row.id, table: name, url: row.explorer_url })));
      }
      const plan = planScenarioReferenceMigration(repository);
      for (const row of plan.scenarios) await table(transaction, row.table).where({ id: row.id }).update({ uid: row.uid });
      for (const row of plan.explorerUrls) await table(transaction, row.table).where({ id: row.id }).update({ explorer_url: row.url });
    });
  },
};
