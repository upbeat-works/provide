import { describe, test, expect } from 'bun:test';
import { http, HttpResponse } from 'msw';
import { api } from '../index';
import { instances } from '../instances';
import { createTestEnv, listEnvelope, server } from '../test-helpers';

const instance = instances[0];

describe('GET /api/indicators', () => {
  test('collapses raw variable strings into one entry per convention indicator', async () => {
    server.use(
      http.patch(`${instance.url}/iamc/variables/`, () =>
        HttpResponse.json(
          listEnvelope([
            { id: 1, name: 'Mean Temperature|2011-2020 (Present Day)|Annual|Area|50th Percentile' },
            { id: 2, name: 'Mean Temperature|2011-2020 (Present Day)|Annual|Area|1.5 °C' },
            { id: 3, name: 'Fire Season Length|2011-2020 (Present Day)|Annual|Area|95th Percentile' },
          ]),
        ),
      ),
    );
    const res = await api.request('/api/indicators', {}, createTestEnv());
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      indicators: Array<{ uid: string; label: string; instance: string }>;
    };
    // The three variable strings collapse into two searchable indicators.
    expect(json.indicators.map((i) => i.uid).sort()).toEqual(['Fire Season Length', 'Mean Temperature']);
    expect(json.indicators[0]).toMatchObject({ label: json.indicators[0].uid, instance: instance.slug });
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
