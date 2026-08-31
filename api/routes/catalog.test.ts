import { describe, test, expect, afterEach, spyOn } from 'bun:test';
import { http, HttpResponse } from 'msw';
import { api } from '../index';
import { __resetCatalogCache } from './catalog';
import { schema } from '../db';
import * as gmtView from '../views/gmt';
import type { GmtByScenario, GmtSeries } from '../views/gmt';
import { createTestEnv, listEnvelope, server, tabulateEnvelope, testInstance } from '../test-helpers';

// The GMT emulator's model name, as it appears on both its runs and its rows.
const GMT_MODEL = 'FaIR v1.6.4';

const gmtStub = (scenario: string): GmtSeries => ({
  data: [[1.1, 1.3, 1.5]],
  yearStart: 2020,
  yearStep: 5,
  yearEnd: 2020,
  characteristics: {},
  scenario,
  model: GMT_MODEL,
});

let gmtSpy: ReturnType<typeof spyOn<typeof gmtView, 'fetchGmtSeriesAcross'>> | undefined;
function useGmt(series: GmtByScenario) {
  gmtSpy = spyOn(gmtView, 'fetchGmtSeriesAcross').mockResolvedValue(series);
}

afterEach(() => {
  gmtSpy?.mockRestore();
  gmtSpy = undefined;
});

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
    const res = await api.request('/api/catalog', {}, await createTestEnv());
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    for (const key of ['indicators', 'indicatorParameters', 'scenarios']) {
      expect(json).toHaveProperty(key);
      expect(Array.isArray(json[key])).toBe(true);
    }
  });

  test('collapses convention variables into one indicator with its facet values', async () => {
    useFixtureHandlers();
    const res = await api.request('/api/catalog', {}, await createTestEnv());
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
    const res = await api.request('/api/catalog', {}, await createTestEnv());
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
    const res = await api.request('/api/catalog', {}, await createTestEnv());
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
    const res = await api.request('/api/catalog', {}, await createTestEnv());
    const json = (await res.json()) as { scenarios: Array<{ uid: string; label: string }> };
    expect(json.scenarios).toEqual([{ uid: 'SSP5-3.4-OS', label: 'SSP5-3.4-OS' }]);
  });

  test('attaches the global-warming trajectory and characteristics to a scenario', async () => {
    useFixtureHandlers();
    useGmt(
      new Map([
        [
          'curpol',
          {
            data: [[1.1, 1.3, 1.5]] as [number, number, number][],
            yearStart: 2020,
            yearStep: 5,
            yearEnd: 2020,
            characteristics: { gmtPeak: [3.6, 2100] as [number, number], gmt2100: 3.6 },
            scenario: 'curpol',
            model: GMT_MODEL,
          },
        ],
      ]),
    );
    __resetCatalogCache();
    const res = await api.request('/api/catalog', {}, await createTestEnv());
    const { scenarios } = (await res.json()) as {
      scenarios: Array<{ uid: string; gmt?: { data: number[][]; yearStart: number; yearStep: number }; characteristics?: Record<string, unknown> }>;
    };
    const curpol = scenarios.find((s) => s.uid === 'curpol')!;
    expect(curpol.gmt).toEqual({ data: [[1.1, 1.3, 1.5]], yearStart: 2020, yearStep: 5 });
    expect(curpol.characteristics).toEqual({ gmtPeak: [3.6, 2100], gmt2100: 3.6 });
  });

  test('leaves a scenario without GMT untouched', async () => {
    useFixtureHandlers();
    useGmt(new Map());
    __resetCatalogCache();
    const res = await api.request('/api/catalog', {}, await createTestEnv());
    const { scenarios } = (await res.json()) as { scenarios: Array<Record<string, unknown>> };
    expect(scenarios[0]).not.toHaveProperty('gmt');
    expect(scenarios[0]).not.toHaveProperty('characteristics');
  });

  // The climate emulator publishes long-term scenario variants ("… then Net Zero",
  // "(Extended)") that no impact indicator covers — they must not reach the pickers.
  test('excludes scenarios that only the GMT emulator publishes', async () => {
    server.use(
      http.patch(`${testInstance.url}/iamc/variables/`, () => HttpResponse.json(listEnvelope([]))),
      http.patch(`${testInstance.url}/runs/`, () =>
        HttpResponse.json(
          listEnvelope([
            { id: 1, model: { name: 'MESMER' }, scenario: { name: 'curpol' }, version: 1, is_default: true },
            { id: 2, model: { name: GMT_MODEL }, scenario: { name: 'curpol' }, version: 1, is_default: true },
            {
              id: 3,
              model: { name: GMT_MODEL },
              scenario: { name: 'curpol then Net Zero' },
              version: 1,
              is_default: true,
            },
          ]),
        ),
      ),
    );
    useGmt(
      new Map([
        ['curpol', gmtStub('curpol')],
        ['curpol then net zero', gmtStub('curpol then Net Zero')],
      ]),
    );
    __resetCatalogCache();
    const res = await api.request('/api/catalog', {}, await createTestEnv());
    const { scenarios } = (await res.json()) as { scenarios: Array<{ uid: string }> };
    expect(scenarios.map((s) => s.uid)).toEqual(['curpol']);
  });

  test('keeps the two-segment GMT variables out of the indicator list', async () => {
    server.use(
      http.patch(`${testInstance.url}/iamc/variables/`, () =>
        HttpResponse.json(
          listEnvelope([
            { id: 1, name: 'Mean Temperature|2011-2020 (Present Day)|Annual|Area|50th Percentile' },
            { id: 2, name: 'Global Mean Temperature|50th Percentile' },
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
    __resetCatalogCache();
    const res = await api.request('/api/catalog', {}, await createTestEnv());
    const { indicators } = (await res.json()) as { indicators: Array<{ uid: string }> };
    expect(indicators.map((i) => i.uid)).toEqual(['Mean Temperature']);
  });

  test('serves repeat requests from cache without re-scanning ixmp4', async () => {
    let variableScans = 0;
    let runScans = 0;
    server.use(
      http.patch(`${testInstance.url}/iamc/variables/`, () => {
        variableScans++;
        return HttpResponse.json(
          listEnvelope([
            { id: 1, name: 'Mean Temperature|2011-2020 (Present Day)|Annual|Area|50th Percentile' },
          ]),
        );
      }),
      http.patch(`${testInstance.url}/runs/`, () => {
        runScans++;
        return HttpResponse.json(
          listEnvelope([
            { id: 1, model: { name: 'M' }, scenario: { name: 'curpol' }, version: 1, is_default: true },
          ]),
        );
      }),
    );
    const env = await createTestEnv();
    const first = await api.request('/api/catalog', {}, env);
    const afterFirst = { variableScans, runScans };
    const second = await api.request('/api/catalog', {}, env);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await first.json()).toEqual(await second.json());
    // The second request adds no ixmp4 traffic — it is served from the cache.
    expect(variableScans).toBe(afterFirst.variableScans);
    expect(runScans).toBe(afterFirst.runScans);
    expect(runScans).toBeGreaterThan(0);
  });

  test('left-joins sector and legacyUid from the indicators table (additive)', async () => {
    server.use(
      http.patch(`${testInstance.url}/iamc/variables/`, () =>
        HttpResponse.json(
          listEnvelope([
            { id: 1, name: 'Mean Temperature|2011-2020 (Present Day)|Annual|Area|50th Percentile' },
            { id: 2, name: 'Glacier area|2011-2020 (Present Day)|Annual|Area|50th Percentile' },
          ]),
        ),
      ),
      http.patch(`${testInstance.url}/runs/`, () => HttpResponse.json(listEnvelope([]))),
    );
    const env = await createTestEnv();
    // Only "Mean Temperature" has a curated enrichment row.
    await env.DB.insert(schema.indicators).values({
      id: 'Mean Temperature',
      sector: 'terrestrial-climate',
      legacyUid: 'terclim-mean-temperature',
    });

    const res = await api.request('/api/catalog', {}, env);
    const { indicators } = (await res.json()) as {
      indicators: Array<{ uid: string; sector?: string | null; legacyUid?: string | null }>;
    };
    const mean = indicators.find((i) => i.uid === 'Mean Temperature');
    expect(mean?.sector).toBe('terrestrial-climate');
    expect(mean?.legacyUid).toBe('terclim-mean-temperature');
    // No row → unchanged (additive; no sector/legacyUid).
    const glacier = indicators.find((i) => i.uid === 'Glacier area');
    expect(glacier?.sector ?? null).toBeNull();
    expect(glacier?.legacyUid ?? null).toBeNull();
  });
});

describe('GET /api/catalog advanced filters', () => {
  // Two runs, two indicators, distinguished by their Temporal Resolution tag.
  function useFacetHandlers() {
    server.use(
      http.patch(`${testInstance.url}/runs/`, () =>
        HttpResponse.json(
          listEnvelope([
            { id: 1, model: { name: 'M' }, scenario: { name: 'curpol' }, version: 1, is_default: true },
            { id: 2, model: { name: 'M' }, scenario: { name: 'ssp119' }, version: 1, is_default: true },
          ]),
        ),
      ),
      http.patch(`${testInstance.url}/meta/`, () =>
        HttpResponse.json(
          tabulateEnvelope(
            ['run__id', 'key', 'value'],
            [
              [1, 'Temporal Resolution', 'Annual'],
              [2, 'Temporal Resolution', '5 years'],
              [1, 'Model Information', 'MESMER (Beusch et al., 2020)'],
            ],
          ),
        ),
      ),
      http.patch(`${testInstance.url}/iamc/variables/`, async ({ request }) => {
        const body = (await request.json().catch(() => null)) as { run?: { id__in?: number[] } } | null;
        const runId = body?.run?.id__in?.[0];
        const mt = { id: 1, name: 'Mean Temperature|2011-2020 (Present Day)|Annual|Area|50th Percentile' };
        const glacier = { id: 2, name: 'Glacier area|2011-2020 (Present Day)|Annual|Area|50th Percentile' };
        if (runId === 1) return HttpResponse.json(listEnvelope([mt]));
        if (runId === 2) return HttpResponse.json(listEnvelope([glacier]));
        return HttpResponse.json(listEnvelope([mt, glacier]));
      }),
    );
  }

  test('exposes discovered facet values with indicator counts', async () => {
    useFacetHandlers();
    __resetCatalogCache();
    const res = await api.request('/api/catalog', {}, await createTestEnv());
    const { facets } = (await res.json()) as {
      facets: Array<{ key: string; label: string; color: string; options: Array<{ value: string; count: number }>; selected: string[] }>;
    };
    const temporal = facets.find((f) => f.key === 'Temporal Resolution')!;
    expect(temporal.options).toEqual([
      { value: '5 years', count: 1 },
      { value: 'Annual', count: 1 },
    ]);
    expect(temporal.label).toBe('TEMPORAL');
    expect(temporal.selected).toEqual([]);
    // Citation keys are not facets.
    expect(facets.map((f) => f.key)).not.toContain('Model Information');
  });

  test('narrows the indicator list to runs carrying the selected value', async () => {
    useFacetHandlers();
    __resetCatalogCache();
    const res = await api.request(
      `/api/catalog?${new URLSearchParams({ 'Temporal Resolution': '5 years' })}`,
      {},
      await createTestEnv(),
    );
    const { indicators } = (await res.json()) as { indicators: Array<{ uid: string }> };
    expect(indicators.map((i) => i.uid)).toEqual(['Glacier area']);
  });

  test('an unfiltered request restricts nothing', async () => {
    useFacetHandlers();
    __resetCatalogCache();
    const res = await api.request('/api/catalog', {}, await createTestEnv());
    const { indicators } = (await res.json()) as { indicators: Array<{ uid: string }> };
    expect(indicators.map((i) => i.uid).sort()).toEqual(['Glacier area', 'Mean Temperature']);
  });
});

describe('GET /api/catalog indicator detail', () => {
  const PROSE = 'Temperature of the air near the surface.';

  test('serves the description from ixmp4 variable docs, without the unit marker', async () => {
    server.use(
      http.patch(`${testInstance.url}/iamc/variables/`, () =>
        HttpResponse.json(
          listEnvelope([
            { id: 7, name: 'Mean Temperature|2011-2020 (Present Day)|Annual|Area|50th Percentile' },
          ]),
        ),
      ),
      http.get(`${testInstance.url}/docs/iamc/variables/`, () =>
        HttpResponse.json(listEnvelope([{ id: 1, dimension__id: 7, description: `${PROSE} [°C]` }])),
      ),
      http.patch(`${testInstance.url}/runs/`, () => HttpResponse.json(listEnvelope([]))),
    );
    __resetCatalogCache();
    const res = await api.request('/api/catalog', {}, await createTestEnv());
    const { indicators } = (await res.json()) as { indicators: Array<{ uid: string; description?: string }> };
    expect(indicators.find((i) => i.uid === 'Mean Temperature')?.description).toBe(PROSE);
  });

  test('attaches models/sources from run meta and the project from the instance', async () => {
    server.use(
      http.patch(`${testInstance.url}/runs/`, () =>
        HttpResponse.json(
          listEnvelope([
            { id: 1, model: { name: 'M' }, scenario: { name: 'curpol' }, version: 1, is_default: true },
          ]),
        ),
      ),
      http.patch(`${testInstance.url}/meta/`, () =>
        HttpResponse.json(
          tabulateEnvelope(
            ['run__id', 'key', 'value'],
            [
              [1, 'Model Information', 'MESMER (Beusch et al., 2020)'],
              [1, 'References', 'Schwaab et al., in prep.'],
            ],
          ),
        ),
      ),
      http.patch(`${testInstance.url}/iamc/variables/`, () =>
        HttpResponse.json(
          listEnvelope([
            { id: 7, name: 'Mean Temperature|2011-2020 (Present Day)|Annual|Area|50th Percentile' },
          ]),
        ),
      ),
    );
    __resetCatalogCache();
    const res = await api.request('/api/catalog', {}, await createTestEnv());
    const { indicators } = (await res.json()) as {
      indicators: Array<{ uid: string; models: string[]; sources: string[]; project?: string }>;
    };
    const mt = indicators.find((i) => i.uid === 'Mean Temperature')!;
    expect(mt.models).toEqual(['MESMER (Beusch et al., 2020)']);
    expect(mt.sources).toEqual(['Schwaab et al., in prep.']);
    expect(mt.project).toBe('PROVIDE');
  });
});
