import { describe, test, expect, beforeEach } from 'bun:test';
import { schema } from '.';
import { createTestEnv } from '../test-helpers';
import type { Env } from '../types';

let env: Env['Bindings'];
beforeEach(async () => {
  env = await createTestEnv();
});

describe('indicators enrichment table', () => {
  test('stores id, sector and legacyUid', async () => {
    await env.DB.insert(schema.indicators).values({
      id: 'Mean Daily Temperature',
      sector: 'urban-climate',
      legacyUid: 'urbclim-T2M-mean',
    });
    const rows = await env.DB.select().from(schema.indicators);
    expect(rows).toEqual([
      { id: 'Mean Daily Temperature', sector: 'urban-climate', legacyUid: 'urbclim-T2M-mean' },
    ]);
  });

  test('sector and legacyUid are optional (additive)', async () => {
    await env.DB.insert(schema.indicators).values({ id: 'Glacier Area' });
    const [row] = await env.DB.select().from(schema.indicators);
    expect(row).toEqual({ id: 'Glacier Area', sector: null, legacyUid: null });
  });
});
