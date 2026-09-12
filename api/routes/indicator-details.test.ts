import { describe, expect, spyOn, test } from 'bun:test';
import { http, HttpResponse } from 'msw';
import type { IndicatorDetailsResponse } from '../catalog/contracts';
import { api } from '../index';
import { createTestEnv, listEnvelope, server, tabulateEnvelope, testInstance } from '../test-helpers';

describe('GET /api/indicator-details/:id', () => {
  test('requires an instance', async () => {
    const res = await api.request('/api/indicator-details/Mean%20Temperature', {}, await createTestEnv());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'instance is required' });
  });

  test('rejects an unknown instance without contacting IXMP4', async () => {
    const res = await api.request('/api/indicator-details/Mean%20Temperature?instance=unknown', {}, await createTestEnv());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Unknown instance: unknown' });
  });

  test.each([
    ['Mean*Temperature', 'Mean%2ATemperature'],
    ['Mean?Temperature', 'Mean%3FTemperature'],
  ])('rejects the wildcard indicator ID %s before contacting IXMP4', async (id, encodedId) => {
    let sourceRequests = 0;
    server.use(
      http.post(`${testInstance.managerUrl}/token/obtain/`, () => {
        sourceRequests++;
        return HttpResponse.json({ access: 'fake-token' });
      }),
      http.patch(`${testInstance.url}/iamc/variables/`, () => {
        sourceRequests++;
        return HttpResponse.json(listEnvelope([]));
      })
    );

    const res = await api.request(`/api/indicator-details/${encodedId}?instance=${testInstance.slug}`, {}, await createTestEnv());

    expect(sourceRequests).toBe(0);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: `Invalid indicator id: ${id}` });
  });

  test('returns 404 when the selected instance does not contain the indicator', async () => {
    const res = await api.request(`/api/indicator-details/Missing?instance=${testInstance.slug}`, {}, await createTestEnv());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Indicator not found: Missing' });
  });

  test('returns the exact source-bound technical detail contract', async () => {
    const variables = [
      {
        id: 7,
        name: 'Mean Temperature|2011-2020 (Present Day)|Annual|Area|50th Percentile',
      },
      {
        id: 8,
        name: 'Mean Temperature|1981-2010|Seasonal|Point|95th Percentile',
      },
      {
        id: 9,
        name: 'Mean Temperature|1981-2010|Annual|Area|1.5 °C',
      },
    ];
    let variableFilter: unknown;
    let docsDimensionId: string | null = null;
    let unitFilter: unknown;
    let runFilter: unknown;
    let metaFilter: unknown;
    server.use(
      http.patch(`${testInstance.url}/iamc/variables/`, async ({ request }) => {
        variableFilter = await request.json();
        return HttpResponse.json(listEnvelope(variables));
      }),
      http.get(`${testInstance.url}/docs/iamc/variables/`, ({ request }) => {
        docsDimensionId = new URL(request.url).searchParams.get('dimension_id');
        if (docsDimensionId !== '7') {
          return HttpResponse.json(listEnvelope([{ id: 2, dimension__id: 99, description: 'Unrelated prose.' }]));
        }
        return HttpResponse.json(
          listEnvelope([
            {
              id: 1,
              dimension__id: 7,
              description: 'Temperature of the air near the surface. [°C]',
            },
          ])
        );
      }),
      http.patch(`${testInstance.url}/units/`, async ({ request }) => {
        unitFilter = await request.json();
        return HttpResponse.json(listEnvelope([{ id: 1, name: '°C' }]));
      }),
      http.patch(`${testInstance.url}/runs/`, async ({ request }) => {
        runFilter = await request.json();
        return HttpResponse.json(
          listEnvelope([
            {
              id: 11,
              model: { name: 'M1' },
              scenario: { name: 'Scenario 1' },
              version: 1,
              is_default: true,
            },
            {
              id: 12,
              model: { name: 'M2' },
              scenario: { name: 'Scenario 2' },
              version: 1,
              is_default: true,
            },
          ])
        );
      }),
      http.patch(`${testInstance.url}/meta/`, async ({ request }) => {
        metaFilter = await request.json();
        return HttpResponse.json(
          tabulateEnvelope(
            ['run__id', 'key', 'value'],
            [
              [11, 'Model Information', 'MESMER (Beusch et al., 2020)'],
              [11, 'References', 'Schwaab et al.'],
              [12, 'Model Information', 'MESMER (Beusch et al., 2020)'],
              [12, 'References', '-'],
            ]
          )
        );
      })
    );

    const res = await api.request(`/api/indicator-details/Mean%20Temperature?instance=${testInstance.slug}`, {}, await createTestEnv());
    const json = (await res.json()) as IndicatorDetailsResponse;

    expect(res.status).toBe(200);
    expect(json).toEqual({
      id: 'Mean Temperature',
      instance: testInstance.slug,
      unit: '°C',
      parameters: [
        {
          id: 'time',
          label: 'Time',
          options: [
            { id: 'Annual', label: 'Annual' },
            { id: 'Seasonal', label: 'Seasonal' },
          ],
        },
        {
          id: 'reference',
          label: 'Reference',
          options: [
            { id: '2011-2020 (Present Day)', label: '2011-2020 (Present Day)' },
            { id: '1981-2010', label: '1981-2010' },
          ],
        },
        {
          id: 'spatial',
          label: 'Spatial',
          options: [
            { id: 'Area', label: 'Area' },
            { id: 'Point', label: 'Point' },
          ],
        },
      ],
      models: ['MESMER (Beusch et al., 2020)'],
      sources: ['Schwaab et al.'],
      ixmp4Description: 'Temperature of the air near the surface.',
    });
    expect(variableFilter).toEqual({ name__ilike: 'Mean Temperature|*' });
    expect(docsDimensionId).toBe('7');
    expect(unitFilter).toEqual({
      iamc: {
        variable: {
          name__in: [variables[0].name, variables[1].name],
        },
      },
    });
    expect(runFilter).toEqual({
      default_only: true,
      iamc: { variable: { name__in: variables.map(({ name }) => name) } },
    });
    expect(metaFilter).toEqual({
      key__in: ['Model Information', 'References'],
      run: { id__in: [11, 12] },
    });
    expect(json).not.toHaveProperty('uid');
    expect(json).not.toHaveProperty('legacyUid');
    expect(json.parameters.every((parameter) => parameter.options.every((option) => !('uid' in option)))).toBe(true);
  });

  test('returns a safe 502 response and logs the selected source failure', async () => {
    const errorLog = spyOn(console, 'error').mockImplementation(() => {});
    try {
      server.use(http.post(`${testInstance.managerUrl}/token/obtain/`, () => HttpResponse.json({ upstream: 'private detail' }, { status: 503 })));

      const res = await api.request(`/api/indicator-details/Mean%20Temperature?instance=${testInstance.slug}`, {}, await createTestEnv());

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
