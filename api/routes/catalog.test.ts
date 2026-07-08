import { describe, test, expect } from 'bun:test';
import { http, HttpResponse } from 'msw';
import { api } from '../index';
import { createTestEnv, listEnvelope, server, testInstance } from '../test-helpers';

function useFixtureHandlers() {
  server.use(
    http.patch(`${testInstance.url}/iamc/variables/`, () =>
      HttpResponse.json(
        listEnvelope([
          { id: 1, name: 'Mean Temperature|2011-2020 (Present Day)|Annual|Area|50th Percentile' },
          { id: 2, name: 'Mean Temperature|2011-2020 (Present Day)|Annual|Area|1.5 °C' },
        ]),
      ),
    ),
    http.patch(`${testInstance.url}/runs/`, () =>
      HttpResponse.json(
        listEnvelope([
          { id: 1, model: { name: 'M' }, scenario: { name: 'curpol' }, version: 1, is_default: true },
        ]),
      ),
    ),
  );
}

describe('GET /api/catalog', () => {
  test('returns the catalog keys (indicators, indicatorParameters, scenarios)', async () => {
    useFixtureHandlers();
    const res = await api.request('/api/catalog', {}, createTestEnv());
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    for (const key of ['indicators', 'indicatorParameters', 'scenarios']) {
      expect(json).toHaveProperty(key);
      expect(Array.isArray(json[key])).toBe(true);
    }
  });

  test('collapses convention variables into one indicator with its facet values', async () => {
    useFixtureHandlers();
    const res = await api.request('/api/catalog', {}, createTestEnv());
    const json = (await res.json()) as {
      indicators: Array<{
        uid: string;
        label: string;
        temporals: string[];
        warmingLevels: string[];
        percentiles: string[];
      }>;
    };
    // The two raw variable strings collapse into a single searchable indicator.
    expect(json.indicators.map((i) => i.uid)).toEqual(['Mean Temperature']);
    const mt = json.indicators[0];
    expect(mt.label).toBe('Mean Temperature');
    expect(mt.temporals).toEqual(['Annual']);
    expect(mt.percentiles).toEqual(['50th Percentile']);
    expect(mt.warmingLevels).toEqual(['1.5 °C']);
  });

  test('exposes convention facets as selector parameters (time/reference/spatial)', async () => {
    useFixtureHandlers();
    const res = await api.request('/api/catalog', {}, createTestEnv());
    const json = (await res.json()) as {
      indicators: Array<{ uid: string; parameters: Record<string, string[]> }>;
      indicatorParameters: Array<{ uid: string; label: string; options: Array<{ uid: string; label: string }> }>;
    };
    const mt = json.indicators.find((i) => i.uid === 'Mean Temperature')!;
    expect(mt.parameters.time).toEqual(['Annual']);
    expect(mt.parameters.reference).toEqual(['2011-2020 (Present Day)']);
    expect(mt.parameters.spatial).toEqual(['Area']);
    // The global dictionary mirrors the facets with raw uid === label.
    const time = json.indicatorParameters.find((p) => p.uid === 'time')!;
    expect(time.options).toEqual([{ uid: 'Annual', label: 'Annual' }]);
  });

  test('derives scenarios from ixmp4 runs (name is the id, no curation)', async () => {
    useFixtureHandlers();
    const res = await api.request('/api/catalog', {}, createTestEnv());
    const json = (await res.json()) as { scenarios: Array<{ uid: string; label: string }> };
    // The runs fixture exposes one scenario, "curpol"; it surfaces verbatim.
    expect(json.scenarios).toEqual([{ uid: 'curpol', label: 'curpol' }]);
  });

  test('collapses case-only duplicate scenario names to one canonical entry', async () => {
    // Source data carries the same overshoot scenario twice, differing only in
    // case (`SSP5-3.4-OS`/`SSP5-3.4-Os`); the selector must show it once.
    server.use(
      http.patch(`${testInstance.url}/iamc/variables/`, () => HttpResponse.json(listEnvelope([]))),
      http.patch(`${testInstance.url}/runs/`, () =>
        HttpResponse.json(
          listEnvelope([
            { id: 1, model: { name: 'M' }, scenario: { name: 'SSP5-3.4-Os' }, version: 1, is_default: true },
            { id: 2, model: { name: 'M' }, scenario: { name: 'SSP5-3.4-OS' }, version: 1, is_default: true },
          ]),
        ),
      ),
    );
    const res = await api.request('/api/catalog', {}, createTestEnv());
    const json = (await res.json()) as { scenarios: Array<{ uid: string; label: string }> };
    expect(json.scenarios).toEqual([{ uid: 'SSP5-3.4-OS', label: 'SSP5-3.4-OS' }]);
  });
});
