import { describe, test, expect, beforeEach } from 'bun:test';
import { http, HttpResponse } from 'msw';
import { api } from '../index';
import { schema } from '../db';
import { createTestEnv, listEnvelope, server, testInstance } from '../test-helpers';
import type { Env } from '../types';

let env: Env['Bindings'];

beforeEach(() => {
  env = createTestEnv();
});

describe('GET /api/geographies', () => {
  test('returns all geographies', async () => {
    await env.DB.insert(schema.geographyTypes).values({ id: 'admin0', label: 'Countries' });
    await env.DB.insert(schema.geographies).values([
      { id: 'DEU', label: 'Germany', geographyType: 'admin0' },
      { id: 'FRA', label: 'France', geographyType: 'admin0' },
    ]);

    const res = await api.request('/api/geographies', {}, env);
    expect(res.status).toBe(200);
    const json = await res.json() as Array<{ id: string }>;
    expect(json.map((g) => g.id).sort()).toEqual(['DEU', 'FRA']);
  });

  test('filters by ?type=', async () => {
    await env.DB.insert(schema.geographyTypes).values([
      { id: 'admin0', label: 'Countries' },
      { id: 'cities', label: 'Cities' },
    ]);
    await env.DB.insert(schema.geographies).values([
      { id: 'DEU', label: 'Germany', geographyType: 'admin0' },
      { id: 'berlin', label: 'Berlin', geographyType: 'cities' },
    ]);

    const res = await api.request('/api/geographies?type=cities', {}, env);
    expect(res.status).toBe(200);
    const json = await res.json() as Array<{ id: string; geographyType: string }>;
    expect(json).toHaveLength(1);
    expect(json[0].id).toBe('berlin');
  });

  test('GET /api/geographies/types returns ordered types', async () => {
    await env.DB.insert(schema.geographyTypes).values([
      { id: 'b', label: 'B', order: 1 },
      { id: 'a', label: 'A', order: 0 },
    ]);
    const res = await api.request('/api/geographies/types', {}, env);
    expect(res.status).toBe(200);
    const json = await res.json() as Array<{ id: string }>;
    expect(json.map((t) => t.id)).toEqual(['a', 'b']);
  });

  test('GET /api/geographies/:id returns single geography', async () => {
    await env.DB.insert(schema.geographyTypes).values({ id: 'admin0', label: 'Countries' });
    await env.DB.insert(schema.geographies).values({ id: 'DEU', label: 'Germany', geographyType: 'admin0' });
    const res = await api.request('/api/geographies/DEU', {}, env);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { id: string };
    expect(json.id).toBe('DEU');
  });

  test('GET /api/geographies/:id returns 404 when not found', async () => {
    const res = await api.request('/api/geographies/XXX', {}, env);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });

  test('filters by ?indicator= using ixmp4 regions intersected with the platform DB', async () => {
    await env.DB.insert(schema.geographyTypes).values({ id: 'admin0', label: 'Countries' });
    await env.DB.insert(schema.geographies).values([
      { id: 'DEU', label: 'Germany', geographyType: 'admin0' },
      { id: 'FRA', label: 'France', geographyType: 'admin0' },
      { id: 'JPN', label: 'Japan', geographyType: 'admin0' },
    ]);
    let capturedFilter: Record<string, unknown> | undefined;
    server.use(
      http.patch(`${testInstance.url}/regions/`, async ({ request }) => {
        capturedFilter = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          listEnvelope([
            { id: 1, name: 'DEU' },
            { id: 2, name: 'FRA' },
          ]),
        );
      }),
    );
    const res = await api.request(
      '/api/geographies?indicator=terclim-mean-temperature',
      {},
      env,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as Array<{ id: string }>;
    expect(json.map((g) => g.id).sort()).toEqual(['DEU', 'FRA']);
    expect(capturedFilter).toMatchObject({
      iamc: { variable: { name: 'terclim-mean-temperature' } },
    });
  });

  test('combines ?indicator= with ?type= to narrow on both axes', async () => {
    await env.DB.insert(schema.geographyTypes).values([
      { id: 'admin0', label: 'Countries' },
      { id: 'cities', label: 'Cities' },
    ]);
    await env.DB.insert(schema.geographies).values([
      { id: 'DEU', label: 'Germany', geographyType: 'admin0' },
      { id: 'berlin', label: 'Berlin', geographyType: 'cities' },
    ]);
    server.use(
      http.patch(`${testInstance.url}/regions/`, () =>
        HttpResponse.json(
          listEnvelope([
            { id: 1, name: 'DEU' },
            { id: 2, name: 'berlin' },
          ]),
        ),
      ),
    );
    const res = await api.request(
      '/api/geographies?indicator=terclim-mean-temperature&type=cities',
      {},
      env,
    );
    const json = (await res.json()) as Array<{ id: string }>;
    expect(json.map((g) => g.id)).toEqual(['berlin']);
  });

  test('returns empty when ixmp4 has no regions for ?indicator=', async () => {
    await env.DB.insert(schema.geographyTypes).values({ id: 'admin0', label: 'Countries' });
    await env.DB.insert(schema.geographies).values({
      id: 'DEU',
      label: 'Germany',
      geographyType: 'admin0',
    });
    const res = await api.request(
      '/api/geographies?indicator=does-not-exist',
      {},
      env,
    );
    const json = (await res.json()) as Array<unknown>;
    expect(json).toEqual([]);
  });
});
