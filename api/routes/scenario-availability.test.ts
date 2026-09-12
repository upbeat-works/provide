import { describe, expect, spyOn, test } from 'bun:test';
import { http, HttpResponse } from 'msw';
import { api } from '../index';
import { createTestEnv, listEnvelope, server, tabulateEnvelope, testInstance } from '../test-helpers';

const indicatorVariable = {
  id: 1,
  name: 'Mean Temperature|1850-1900 (Pre-industrial)|December - February|Area|1.5 °C',
};

function useIndicatorSource(rows: unknown[][] = [['Impact model', '2020 Climate Policies', 'France', '°C', 1, 2]]) {
  const requests: Array<{ path: string; body: unknown }> = [];
  server.use(
    http.patch(`${testInstance.url}/iamc/variables/`, async ({ request }) => {
      const text = await request.text();
      requests.push({ path: 'variables', body: text ? JSON.parse(text) : undefined });
      return HttpResponse.json(listEnvelope([indicatorVariable]));
    }),
    http.patch(`${testInstance.url}/iamc/datapoints/`, async ({ request }) => {
      requests.push({ path: 'datapoints', body: await request.json() });
      return HttpResponse.json(tabulateEnvelope(['model', 'scenario', 'region', 'unit', '2020', '2100'], rows));
    })
  );
  return requests;
}

describe('GET /api/scenario-availability', () => {
  test('requires indicator, region, and instance', async () => {
    const env = await createTestEnv();
    const missingSelection = await api.request('/api/scenario-availability', {}, env);
    const missingInstance = await api.request('/api/scenario-availability?indicator=Mean%20Temperature&region=France', {}, env);

    expect(missingSelection.status).toBe(400);
    expect(await missingSelection.json()).toEqual({
      error: 'indicator and region query parameters are required',
    });
    expect(missingInstance.status).toBe(400);
    expect(await missingInstance.json()).toEqual({ error: 'instance is required' });
  });

  test('rejects an unknown instance', async () => {
    const res = await api.request('/api/scenario-availability?indicator=Mean%20Temperature&region=France&instance=unknown', {}, await createTestEnv());

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
      http.patch(`${testInstance.url}/iamc/datapoints/`, () => {
        sourceRequests++;
        return HttpResponse.json(tabulateEnvelope([], []));
      })
    );

    const res = await api.request(`/api/scenario-availability?indicator=${encodedIndicator}&region=France&instance=${testInstance.slug}`, {}, await createTestEnv());

    expect(sourceRequests).toBe(0);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: `Invalid indicator id: ${indicator}` });
  });

  test.each(['median', ''])('rejects the invalid axis %j', async (axis) => {
    const res = await api.request(`/api/scenario-availability?indicator=Mean%20Temperature&region=France&instance=${testInstance.slug}&axis=${axis}`, {}, await createTestEnv());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: `Invalid axis: ${axis}` });
  });

  test('returns canonical source availability and forwards the selected facets', async () => {
    const requests = useIndicatorSource();
    const res = await api.request(
      `/api/scenario-availability?indicator=Mean%20Temperature&region=France&time=December%20-%20February&reference=1850-1900%20(Pre-industrial)&spatial=Area&axis=warmingLevel&instance=${testInstance.slug}`,
      {},
      await createTestEnv()
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      scenarios: [
        {
          id: '2020 Climate Policies',
          label: '2020 Climate Policies',
          yearStart: 2020,
          yearEnd: 2100,
        },
      ],
    });
    expect(requests).toEqual([
      {
        path: 'variables',
        body: { name__ilike: 'Mean Temperature|*' },
      },
      {
        path: 'datapoints',
        body: {
          region: { name: 'France' },
          variable: { name: indicatorVariable.name },
          run: { default_only: true },
        },
      },
    ]);
  });

  test('defaults only an absent axis to percentile', async () => {
    const percentileVariable = {
      id: 2,
      name: 'Mean Temperature|2011-2020 (Present Day)|Annual|Area|50th Percentile',
    };
    let datapointFilter: unknown;
    server.use(
      http.patch(`${testInstance.url}/iamc/variables/`, () => HttpResponse.json(listEnvelope([percentileVariable]))),
      http.patch(`${testInstance.url}/iamc/datapoints/`, async ({ request }) => {
        datapointFilter = await request.json();
        return HttpResponse.json(tabulateEnvelope([], []));
      })
    );

    const res = await api.request(`/api/scenario-availability?indicator=Mean%20Temperature&region=France&instance=${testInstance.slug}`, {}, await createTestEnv());

    expect(res.status).toBe(200);
    expect(datapointFilter).toEqual({
      region: { name: 'France' },
      variable: { name: percentileVariable.name },
      run: { default_only: true },
    });
  });

  test.each(['percentile', 'warmingLevel'])('returns 404 when the selected source does not contain the indicator on the %s axis', async (axis) => {
    server.use(http.patch(`${testInstance.url}/iamc/variables/`, () => HttpResponse.json(listEnvelope([]))));

    const res = await api.request(`/api/scenario-availability?indicator=Missing&region=France&instance=${testInstance.slug}&axis=${axis}`, {}, await createTestEnv());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Indicator not found: Missing' });
  });

  test('returns an empty success response for a known indicator with no scenarios', async () => {
    useIndicatorSource([]);

    const res = await api.request(
      `/api/scenario-availability?indicator=Mean%20Temperature&region=France&instance=${testInstance.slug}&reference=1850-1900%20(Pre-industrial)&time=December%20-%20February&axis=warmingLevel`,
      {},
      await createTestEnv()
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ scenarios: [] });
  });

  test('returns a safe 502 when the selected source fails', async () => {
    const errorLog = spyOn(console, 'error').mockImplementation(() => {});
    try {
      server.use(http.post(`${testInstance.managerUrl}/token/obtain/`, () => HttpResponse.json({ upstream: 'private detail' }, { status: 503 })));

      const res = await api.request(`/api/scenario-availability?indicator=Mean%20Temperature&region=France&instance=${testInstance.slug}`, {}, await createTestEnv());

      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: 'Scenario source unavailable' });
      expect(errorLog).toHaveBeenCalledWith('Scenario source unavailable', {
        instance: testInstance.slug,
        errorType: 'Error',
      });
    } finally {
      errorLog.mockRestore();
    }
  });
});
