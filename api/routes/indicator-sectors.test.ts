import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { http, HttpResponse } from 'msw';
import { api } from '../index';
import { schema } from '../db';
import { buildIndicatorsSeedSql, parseIndicatorsYaml } from '../db/import/import-indicators';
import { instances } from '../instances';
import { sectorLabel } from '../facets';
import { createTestEnv, listEnvelope, server } from '../test-helpers';
import type { FilteredIndicatorIndexResponse } from '../catalog/contracts';
import type { Env } from '../types';
import sourceVariables from '../fixtures/indicator-variables.json';

const seedRows = parseIndicatorsYaml(readFileSync(new URL('../db/import/indicators.yaml', import.meta.url), 'utf8'));
const migration = readFileSync(new URL('../db/migrations/0002_indicator_sectors.sql', import.meta.url), 'utf8');

function useSourceVariables() {
  for (const [slug, names] of Object.entries(sourceVariables)) {
    const instance = instances.find((instance) => instance.slug === slug)!;
    server.use(
      http.patch(`${instance.url}/iamc/variables/`, () => HttpResponse.json(listEnvelope(names.map((name, index) => ({ id: index + 1, name }))))),
      http.patch(`${instance.url}/units/`, () => HttpResponse.json(listEnvelope([{ id: 1, name: 'days/yr' }]))),
      http.patch(`${instance.url}/runs/`, () => HttpResponse.json(listEnvelope([{ id: 1, model: { name: 'Model' }, scenario: { name: 'Scenario' }, version: 1, is_default: true }])))
    );
  }
}

async function expectSectorCoverage(env: Env['Bindings']) {
  useSourceVariables();
  const res = await api.request('/api/indicators?Sector=', {}, env);
  expect(res.status).toBe(200);
  const json = (await res.json()) as FilteredIndicatorIndexResponse;
  expect(json.failedInstances).toEqual([]);
  expect(json.indicators).toHaveLength(Object.values(sourceVariables).flat().length);
  expect(json.indicators.filter((indicator) => !indicator.sector).map(({ id }) => id)).toEqual([]);

  const options = json.filters.find(({ key }) => key === 'Sector')!.options;
  expect(options.reduce((total, { count }) => total + count, 0)).toBe(json.indicators.length);
  for (const { value, count } of options) {
    const filtered = await api.request(`/api/indicators?${new URLSearchParams({ Sector: value })}`, {}, env);
    expect(filtered.status).toBe(200);
    const body = (await filtered.json()) as FilteredIndicatorIndexResponse;
    expect(body.failedInstances).toEqual([]);
    expect(body.indicators).toHaveLength(count);
    expect(body.indicators.every(({ sector }) => sectorLabel(sector) === value)).toBe(true);
  }

  expect(json.indicators).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'Days with Maximum Temperatures above 30 °C', sector: 'urban-climate' }),
      expect.objectContaining({ id: 'Heat-Wave Magnitude Index daily (HMWId)', sector: 'urban-climate' }),
      expect.objectContaining({ id: 'Fire Season Length', sector: 'terrestrial-climate' }),
      expect.objectContaining({ id: 'Glacier Runoff', sector: 'glacier' }),
      expect.objectContaining({ id: 'Global Mean Sea Level Rise', sector: 'maritime-climate' }),
      expect.objectContaining({ id: 'Mean Air Temperature', sector: 'terrestrial-climate' }),
      expect.objectContaining({ id: 'High Heat Risk', sector: 'urban-climate' }),
    ])
  );
}

describe('indicator sector coverage', () => {
  test('upgrades the legacy catalog and preserves existing metadata when run again', async () => {
    const env = await createTestEnv();
    const existingRows = [...seedRows, ...parseIndicatorsYaml('- id: Glacier Runoff\n  legacyUid: glacier-runoff\n- id: Custom Indicator\n  sector: custom\n')];
    await env.DB.execute(sql.raw(buildIndicatorsSeedSql(existingRows)));
    await env.DB.execute(sql.raw(migration));
    await env.DB.execute(sql.raw(migration));

    await expectSectorCoverage(env);
    expect(await env.DB.select().from(schema.indicators).where(eq(schema.indicators.id, 'Glacier Runoff'))).toEqual([{ id: 'Glacier Runoff', sector: 'glacier', legacyUid: 'glacier-runoff' }]);
    expect(await env.DB.select().from(schema.indicators).where(eq(schema.indicators.id, 'Custom Indicator'))).toEqual([{ id: 'Custom Indicator', sector: 'custom', legacyUid: null }]);
  });
});
