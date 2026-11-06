import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { schema } from '.';
import { buildIndicatorsSeedSql, parseIndicatorsYaml } from './import/import-indicators';
import { createTestEnv } from '../test-helpers';

test('adds missing sector links without losing metadata when repeated', async () => {
  const env = await createTestEnv();
  const existing = parseIndicatorsYaml(`- id: Glacier Runoff
  legacyUid: glacier-runoff
- id: Custom Indicator
  sector: custom
`);
  await env.DB.execute(sql.raw(buildIndicatorsSeedSql(existing)));

  const migration = readFileSync(new URL('./migrations/0002_indicator_sectors.sql', import.meta.url), 'utf8');
  await env.DB.execute(sql.raw(migration));

  const rows = await env.DB.select().from(schema.indicators).orderBy(schema.indicators.id);
  expect(rows).toEqual(
    expect.arrayContaining([
      { id: 'Days with Maximum Temperatures above 30 °C', sector: 'urban-climate', legacyUid: null },
      { id: 'Heat-Wave Magnitude Index daily (HMWId)', sector: 'urban-climate', legacyUid: null },
      { id: 'Glacier Runoff', sector: 'glacier', legacyUid: 'glacier-runoff' },
      { id: 'Custom Indicator', sector: 'custom', legacyUid: null },
    ])
  );

  await env.DB.execute(sql.raw(migration));
  expect(await env.DB.select().from(schema.indicators).orderBy(schema.indicators.id)).toEqual(rows);
});
