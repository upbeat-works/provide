import { describe, expect, spyOn, test } from 'bun:test';
import { http, HttpResponse } from 'msw';
import { api } from '../index';
import { schema } from '../db';
import { createTestEnv, listEnvelope, server, testInstance } from '../test-helpers';

describe('GET /api/geography-availability', () => {
  test('requires an indicator and an instance', async () => {
    const env = await createTestEnv();

    const withoutIndicator = await api.request(`/api/geography-availability?instance=${testInstance.slug}`, {}, env);
    const withoutInstance = await api.request('/api/geography-availability?indicator=Mean%20Temperature', {}, env);

    expect(withoutIndicator.status).toBe(400);
    expect(await withoutIndicator.json()).toEqual({ error: 'indicator is required' });
    expect(withoutInstance.status).toBe(400);
    expect(await withoutInstance.json()).toEqual({ error: 'instance is required' });
  });

  test('rejects an unknown instance without contacting IXMP4', async () => {
    const res = await api.request('/api/geography-availability?indicator=Mean%20Temperature&instance=unknown', {}, await createTestEnv());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Unknown instance: unknown' });
  });

  test.each([
    ['Mean*Temperature', 'Mean%2ATemperature'],
    ['Mean?Temperature', 'Mean%3FTemperature'],
  ])('rejects the wildcard indicator ID %s before contacting IXMP4', async (indicator, encodedIndicator) => {
    let sourceRequests = 0;
    server.use(
      http.post(`${testInstance.managerUrl}/token/obtain/`, () => {
        sourceRequests++;
        return HttpResponse.json({ access: 'fake-token' });
      }),
      http.patch(`${testInstance.url}/iamc/variables/`, () => {
        sourceRequests++;
        return HttpResponse.json(listEnvelope([]));
      }),
      http.patch(`${testInstance.url}/regions/`, () => {
        sourceRequests++;
        return HttpResponse.json(listEnvelope([]));
      })
    );

    const res = await api.request(`/api/geography-availability?indicator=${encodedIndicator}&instance=${testInstance.slug}`, {}, await createTestEnv());

    expect(sourceRequests).toBe(0);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: `Invalid indicator id: ${indicator}` });
  });

  test('returns 404 when the selected instance does not contain the indicator', async () => {
    const query = new URLSearchParams({
      indicator: 'Missing',
      instance: testInstance.slug,
    });
    const res = await api.request(`/api/geography-availability?${query}`, {}, await createTestEnv());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Indicator not found: Missing' });
  });

  test('uses every parameter combination and keeps only known geography IDs', async () => {
    const env = await createTestEnv();
    await env.DB.insert(schema.geographyTypes).values({ id: 'admin0', label: 'Countries' });
    await env.DB.insert(schema.geographies).values([
      { id: 'DEU', label: 'Germany', geographyType: 'admin0' },
      { id: 'FRA', label: 'France', geographyType: 'admin0' },
    ]);
    const nonDefaultVariable = 'Mean Temperature|1981-2010|Seasonal|Point|95th Percentile';
    let variableFilter: unknown;
    let variableRequests = 0;
    let regionFilter: unknown;
    server.use(
      http.patch(`${testInstance.url}/iamc/variables/`, async ({ request }) => {
        variableRequests++;
        variableFilter = await request.json();
        return HttpResponse.json(listEnvelope([{ id: 7, name: nonDefaultVariable }]));
      }),
      http.patch(`${testInstance.url}/regions/`, async ({ request }) => {
        regionFilter = await request.json();
        return HttpResponse.json(
          listEnvelope([
            { id: 1, name: 'DEU' },
            { id: 2, name: 'FRA' },
            { id: 3, name: 'World' },
          ])
        );
      })
    );

    const query = new URLSearchParams({
      indicator: 'Mean Temperature',
      instance: testInstance.slug,
    });
    const res = await api.request(`/api/geography-availability?${query}`, {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ geographyIds: ['DEU', 'FRA'] });
    expect(variableFilter).toEqual({ name__ilike: 'Mean Temperature|*' });
    expect(variableRequests).toBe(1);
    expect(regionFilter).toEqual({
      iamc: { variable: { name__in: [nonDefaultVariable] } },
    });
  });

  test('returns an empty success response when the indicator has no geography data', async () => {
    server.use(
      http.patch(`${testInstance.url}/iamc/variables/`, () =>
        HttpResponse.json(
          listEnvelope([
            {
              id: 7,
              name: 'Mean Temperature|2011-2020 (Present Day)|Annual|Area|50th Percentile',
            },
          ])
        )
      ),
      http.patch(`${testInstance.url}/regions/`, () => HttpResponse.json(listEnvelope([])))
    );

    const query = new URLSearchParams({
      indicator: 'Mean Temperature',
      instance: testInstance.slug,
    });
    const res = await api.request(`/api/geography-availability?${query}`, {}, await createTestEnv());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ geographyIds: [] });
  });

  test('finds the same non-default-only pair in both selection orders', async () => {
    const env = await createTestEnv();
    await env.DB.insert(schema.geographyTypes).values({ id: 'admin0', label: 'Countries' });
    await env.DB.insert(schema.geographies).values({
      id: 'France',
      label: 'France',
      geographyType: 'admin0',
    });
    const variable = {
      id: 7,
      name: 'Mean Temperature|1981-2010|Seasonal|Point|95th Percentile',
    };
    const variableFilters: unknown[] = [];
    let regionFilter: unknown;
    server.use(
      http.patch(`${testInstance.url}/iamc/variables/`, async ({ request }) => {
        const filter = (await request.json()) as {
          name__ilike?: string;
          region?: { name?: string };
        };
        variableFilters.push(filter);
        const matchesIndicator = filter.name__ilike === 'Mean Temperature|*';
        const matchesGeography = filter.region?.name === 'France';
        return HttpResponse.json(listEnvelope(matchesIndicator || matchesGeography ? [variable] : []));
      }),
      http.patch(`${testInstance.url}/regions/`, async ({ request }) => {
        regionFilter = await request.json();
        const filter = regionFilter as {
          iamc?: { variable?: { name__in?: string[] } };
        };
        const matchesVariable = filter.iamc?.variable?.name__in?.includes(variable.name);
        return HttpResponse.json(listEnvelope(matchesVariable ? [{ id: 1, name: 'France' }] : []));
      }),
      http.patch(`${testInstance.url}/units/`, () => HttpResponse.json(listEnvelope([{ id: 1, name: '°C' }])))
    );

    const geographyFirst = await api.request('/api/indicators?region=France', {}, env);
    const indicatorFirst = await api.request(`/api/geography-availability?indicator=Mean%20Temperature&instance=${testInstance.slug}`, {}, env);

    expect(geographyFirst.status).toBe(200);
    expect(await geographyFirst.json()).toMatchObject({
      indicators: [
        {
          id: 'Mean Temperature',
          instance: testInstance.slug,
        },
      ],
    });
    expect(indicatorFirst.status).toBe(200);
    expect(await indicatorFirst.json()).toEqual({ geographyIds: ['France'] });
    expect(variableFilters).toEqual([{ region: { name: 'France' } }, { name__ilike: 'Mean Temperature|*' }]);
    expect(regionFilter).toEqual({
      iamc: { variable: { name__in: [variable.name] } },
    });
  });

  test('returns a safe 502 response and logs the selected source failure', async () => {
    const errorLog = spyOn(console, 'error').mockImplementation(() => {});
    try {
      server.use(http.post(`${testInstance.managerUrl}/token/obtain/`, () => HttpResponse.json({ upstream: 'private detail' }, { status: 503 })));
      const query = new URLSearchParams({
        indicator: 'Mean Temperature',
        instance: testInstance.slug,
      });

      const res = await api.request(`/api/geography-availability?${query}`, {}, await createTestEnv());

      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: 'Indicator source unavailable' });
      expect(errorLog).toHaveBeenCalledWith('Indicator source unavailable', {
        instance: testInstance.slug,
        errorType: 'Error',
      });
    } finally {
      errorLog.mockRestore();
    }
  });
});
