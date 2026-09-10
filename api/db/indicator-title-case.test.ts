import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { schema } from '.';
import { createTestEnv } from '../test-helpers';

test('renames stored indicators without changing their metadata or unrelated names', async () => {
  const env = await createTestEnv();
  await env.DB.insert(schema.indicators).values([
    { id: 'Annual maximum temperature', sector: 'terrestrial-climate', legacyUid: 'terclim-txx' },
    { id: 'Custom indicator', sector: 'custom' },
  ]);
  const migration = readFileSync(new URL('./migrations/0001_indicator_title_case.sql', import.meta.url), 'utf8');
  await env.DB.execute(sql.raw(migration));
  await env.DB.execute(sql.raw(migration));
  expect(await env.DB.select().from(schema.indicators).orderBy(schema.indicators.id)).toEqual([
    { id: 'Annual Maximum Temperature', sector: 'terrestrial-climate', legacyUid: 'terclim-txx' },
    { id: 'Custom indicator', sector: 'custom', legacyUid: null },
  ]);
});
