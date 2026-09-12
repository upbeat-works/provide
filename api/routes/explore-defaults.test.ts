import { describe, expect, spyOn, test } from 'bun:test';
import { http, HttpResponse } from 'msw';
import { api } from '../index';
import { schema } from '../db';
import { createTestEnv, listEnvelope, server, testInstance } from '../test-helpers';

describe('GET /api/explore-defaults', () => {
  test('prefers a shared Present Day variable over an earlier reference period', async () => {
    const env = await createTestEnv();
    await env.DB.insert(schema.geographyTypes).values({ id: 'admin0', label: 'Countries' });
    await env.DB.insert(schema.geographies).values({ id: 'France', label: 'France', geographyType: 'admin0' });
    const present = 'Heat|2011-2020 (Present Day)|Seasonal|Point|50th Percentile';
    const preindustrial = 'Heat|1850-1900 (Pre-industrial)|Annual|Area|50th Percentile';
    server.use(
      http.patch(`${testInstance.url}/iamc/variables/`, () => HttpResponse.json(listEnvelope([
        { id: 1, name: preindustrial },
        { id: 2, name: present },
      ]))),
      http.patch(`${testInstance.url}/regions/`, () => HttpResponse.json(listEnvelope([{ id: 1, name: 'France' }]))),
      http.patch(`${testInstance.url}/iamc/datapoints/`, () => HttpResponse.json({ error: 'Datapoints must not be requested' }, { status: 500 }))
    );

    const res = await api.request(`/api/explore-defaults?instance=${testInstance.slug}&scenario=Scenario`, {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      indicator: { id: 'Heat', instance: testInstance.slug },
      geography: 'France',
      parameters: { reference: '2011-2020 (Present Day)', time: 'Seasonal', spatial: 'Point' },
      scenarios: ['Scenario'],
    });
  });

  test('finds a shared generic selection from metadata without reading datapoints', async () => {
    const env = await createTestEnv();
    await env.DB.insert(schema.geographyTypes).values({ id: 'admin0', label: 'Countries' });
    await env.DB.insert(schema.geographies).values([
      { id: 'France', label: 'France', geographyType: 'admin0' },
      { id: 'Germany', label: 'Germany', geographyType: 'admin0' },
    ]);
    const shared = 'Coastal Flooding|2041-2060|Seasonal|Point|50th Percentile';
    const variableFilters: unknown[] = [];
    const regionFilters: unknown[] = [];
    const datapointFilters: unknown[] = [];
    server.use(
      http.patch(`${testInstance.url}/iamc/variables/`, async ({ request }) => {
        const filter = (await request.json()) as { run?: { scenario?: { name__ilike?: string } } };
        variableFilters.push(filter);
        const scenario = filter.run?.scenario?.name__ilike;
        const rows = scenario === 'Scenario A'
          ? [{ id: 1, name: shared }, { id: 2, name: 'Heat|2050|Annual|Area|50th Percentile' }]
          : [{ id: 3, name: shared }, { id: 4, name: 'Heat|2050|Annual|Area|50th Percentile' }];
        return HttpResponse.json(listEnvelope(rows));
      }),
      http.patch(`${testInstance.url}/regions/`, async ({ request }) => {
        const filter = (await request.json()) as { iamc?: { run?: { scenario?: { name__ilike?: string } } } };
        regionFilters.push(filter);
        const scenario = filter.iamc?.run?.scenario?.name__ilike;
        return HttpResponse.json(listEnvelope(scenario === 'Scenario A' ? [{ id: 1, name: 'France' }, { id: 2, name: 'Germany' }] : [{ id: 2, name: 'Germany' }, { id: 3, name: 'Spain' }]));
      }),
      http.patch(`${testInstance.url}/iamc/datapoints/`, () => {
        datapointFilters.push({ unexpected: true });
        return HttpResponse.json({ error: 'Datapoints must not be requested' }, { status: 500 });
      })
    );

    const query = new URLSearchParams({ instance: testInstance.slug });
    query.append('scenario', 'Scenario A');
    query.append('scenario', 'Scenario B');
    const res = await api.request(`/api/explore-defaults?${query}`, {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      indicator: { id: 'Coastal Flooding', instance: testInstance.slug },
      geography: 'Germany',
      parameters: { reference: '2041-2060', time: 'Seasonal', spatial: 'Point' },
      scenarios: ['Scenario A', 'Scenario B'],
    });
    expect(variableFilters).toEqual([
      { run: { scenario: { name__ilike: 'Scenario A' } } },
      { run: { scenario: { name__ilike: 'Scenario B' } } },
    ]);
    expect(regionFilters).toEqual([
      { iamc: { variable: { name: shared }, run: { scenario: { name__ilike: 'Scenario A' } } } },
      { iamc: { variable: { name: shared }, run: { scenario: { name__ilike: 'Scenario B' } } } },
    ]);
    expect(datapointFilters).toHaveLength(0);
  });

  test('rejects missing scenarios and unknown instances', async () => {
    const env = await createTestEnv();
    const missing = await api.request(`/api/explore-defaults?instance=${testInstance.slug}`, {}, env);
    const unknown = await api.request('/api/explore-defaults?instance=unknown&scenario=A', {}, env);
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: 'scenario is required' });
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'Unknown instance: unknown' });
  });

  test('returns 404 when scenarios have no shared impact data', async () => {
    server.use(http.patch(`${testInstance.url}/iamc/variables/`, () => HttpResponse.json(listEnvelope([]))));
    const res = await api.request(`/api/explore-defaults?instance=${testInstance.slug}&scenario=A`, {}, await createTestEnv());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'No shared impact data for the requested scenarios' });
  });

  test('returns 404 when scenarios have no shared region', async () => {
    const env = await createTestEnv();
    await env.DB.insert(schema.geographyTypes).values({ id: 'admin0', label: 'Countries' });
    await env.DB.insert(schema.geographies).values([
      { id: 'France', label: 'France', geographyType: 'admin0' },
      { id: 'Germany', label: 'Germany', geographyType: 'admin0' },
    ]);
    const variable = 'Flooding|2041-2060|Annual|Area|50th Percentile';
    server.use(
      http.patch(`${testInstance.url}/iamc/variables/`, () => HttpResponse.json(listEnvelope([{ id: 1, name: variable }]))),
      http.patch(`${testInstance.url}/regions/`, async ({ request }) => {
        const filter = (await request.json()) as { iamc?: { run?: { scenario?: { name__ilike?: string } } } };
        const region = filter.iamc?.run?.scenario?.name__ilike === 'A' ? 'France' : 'Germany';
        return HttpResponse.json(listEnvelope([{ id: 1, name: region }]));
      })
    );

    const res = await api.request(`/api/explore-defaults?instance=${testInstance.slug}&scenario=A&scenario=B`, {}, env);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'No shared impact data for the requested scenarios' });
  });

  test('returns a safe 502 when the selected source fails', async () => {
    const errorLog = spyOn(console, 'error').mockImplementation(() => {});
    try {
      server.use(http.patch(`${testInstance.url}/iamc/variables/`, () => HttpResponse.json({ private: 'detail' }, { status: 503 })));
      const res = await api.request(`/api/explore-defaults?instance=${testInstance.slug}&scenario=A`, {}, await createTestEnv());
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: 'Explore defaults source unavailable' });
      expect(errorLog).toHaveBeenCalledWith('Explore defaults source unavailable', { instance: testInstance.slug, errorType: 'Error' });
    } finally {
      errorLog.mockRestore();
    }
  });
});
