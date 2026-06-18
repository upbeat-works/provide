import { describe, test, expect } from 'bun:test';
import { http, HttpResponse } from 'msw';
import { api } from '../index';
import { instances } from '../instances';
import { createTestEnv, listEnvelope, server } from '../test-helpers';

const instance = instances[0];

describe('GET /api/indicators', () => {
  test('returns curated indicators joined with ixmp4 variables', async () => {
    server.use(
      http.patch(`${instance.url}/iamc/variables/`, () =>
        HttpResponse.json(
          listEnvelope([
            { id: 1, name: 'terclim-mean-temperature' },
            { id: 2, name: 'terclim-hot-extreme' },
          ]),
        ),
      ),
    );
    const res = await api.request('/api/indicators', {}, createTestEnv());
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      indicators: Array<{
        uid: string;
        label: string;
        unit: string;
        sector: string;
        direction: number;
        parameters: Record<string, string[]>;
        availableScenarios: string[];
        instance: string;
      }>;
    };
    expect(json.indicators).toHaveLength(2);
    const meanTemp = json.indicators.find((i) => i.uid === 'terclim-mean-temperature');
    expect(meanTemp).toMatchObject({
      uid: 'terclim-mean-temperature',
      // For now, the variable name doubles as display label; curated `label`
      // is intentionally overridden.
      label: 'terclim-mean-temperature',
      unit: 'degrees-celsius',
      sector: 'terrestrial-climate',
      direction: -1,
      instance: instance.slug,
    });
    expect(meanTemp?.parameters.time).toEqual(['annual', 'djf', 'mam', 'jja', 'son']);
    expect(Array.isArray(meanTemp?.availableScenarios)).toBe(true);
  });

  test('filters by ?sector=', async () => {
    server.use(
      http.patch(`${instance.url}/iamc/variables/`, () =>
        HttpResponse.json(
          listEnvelope([
            { id: 1, name: 'terclim-mean-temperature' },
            { id: 2, name: 'urbclim-T2M-dayover25' },
          ]),
        ),
      ),
    );
    const res = await api.request('/api/indicators?sector=urban-climate', {}, createTestEnv());
    const json = (await res.json()) as { indicators: Array<{ uid: string; sector: string }> };
    for (const ind of json.indicators) {
      expect(ind.sector).toBe('urban-climate');
    }
    expect(json.indicators.map((i) => i.uid)).toContain('urbclim-T2M-dayover25');
    expect(json.indicators.map((i) => i.uid)).not.toContain('terclim-mean-temperature');
  });

  test('forwards ?q= as an ilike filter to ixmp4', async () => {
    let captured: unknown;
    server.use(
      http.patch(`${instance.url}/iamc/variables/`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json(listEnvelope([]));
      }),
    );
    await api.request('/api/indicators?q=temperature', {}, createTestEnv());
    expect(captured).toEqual({ name__ilike: '*temperature*' });
  });

  test('filters indicators by ?region= using a nested region filter', async () => {
    let capturedFilter: Record<string, unknown> | undefined;
    server.use(
      http.patch(`${instance.url}/iamc/variables/`, async ({ request }) => {
        capturedFilter = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          listEnvelope([{ id: 1, name: 'terclim-mean-temperature' }]),
        );
      }),
    );
    const res = await api.request('/api/indicators?region=DEU', {}, createTestEnv());
    expect(res.status).toBe(200);
    const json = (await res.json()) as { indicators: Array<{ uid: string }> };
    expect(json.indicators.map((i) => i.uid)).toEqual(['terclim-mean-temperature']);
    expect(capturedFilter).toMatchObject({ region: { name: 'DEU' } });
  });

  test('combines ?region= with ?q= so both filters reach ixmp4', async () => {
    let capturedFilter: Record<string, unknown> | undefined;
    server.use(
      http.patch(`${instance.url}/iamc/variables/`, async ({ request }) => {
        capturedFilter = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(listEnvelope([]));
      }),
    );
    await api.request('/api/indicators?region=DEU&q=temperature', {}, createTestEnv());
    expect(capturedFilter).toMatchObject({
      name__ilike: '*temperature*',
      region: { name: 'DEU' },
    });
  });

  test('sends no name filter when ?q is absent', async () => {
    let captured: unknown = {};
    server.use(
      http.patch(`${instance.url}/iamc/variables/`, async ({ request }) => {
        // SDK strips body entirely when filter is empty; tolerate that.
        try {
          captured = await request.json();
        } catch {
          captured = {};
        }
        return HttpResponse.json(listEnvelope([]));
      }),
    );
    await api.request('/api/indicators', {}, createTestEnv());
    expect(captured).toEqual({});
  });
});
