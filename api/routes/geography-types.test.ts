import { describe, test, expect } from 'bun:test';
import { api } from '../index';
import { schema } from '../db';
import { createTestEnv } from '../test-helpers';

describe('GET /api/geography-types', () => {
  test('returns geography types from D1 in order', async () => {
    const env = createTestEnv();
    await env.DB.insert(schema.geographyTypes).values([
      { id: 'cities', label: 'Cities', labelSingular: 'City', order: 2, isAvailable: true },
      { id: 'admin0', label: 'Countries', labelSingular: 'Country', order: 1, isAvailable: true },
    ]);
    const res = await api.request('/api/geography-types', {}, env);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      geographyTypes: Array<{
        uid: string;
        label: string;
        labelSingular?: string;
        order?: number;
        isAvailable: boolean;
      }>;
    };
    expect(json.geographyTypes.map((t) => t.uid)).toEqual(['admin0', 'cities']);
    expect(json.geographyTypes[0]).toMatchObject({
      uid: 'admin0',
      label: 'Countries',
      labelSingular: 'Country',
      order: 1,
      isAvailable: true,
    });
  });

  test('returns empty list when D1 has no rows', async () => {
    const env = createTestEnv();
    const res = await api.request('/api/geography-types', {}, env);
    const json = (await res.json()) as { geographyTypes: unknown[] };
    expect(json.geographyTypes).toEqual([]);
  });

  test('reflects the D1 isAvailable flag', async () => {
    const env = createTestEnv();
    await env.DB.insert(schema.geographyTypes).values({
      id: 'admin0',
      label: 'Countries',
      isAvailable: false,
    });
    const res = await api.request('/api/geography-types', {}, env);
    const json = (await res.json()) as {
      geographyTypes: Array<{ uid: string; isAvailable: boolean }>;
    };
    const admin0 = json.geographyTypes.find((t) => t.uid === 'admin0')!;
    expect(admin0.isAvailable).toBe(false);
  });
});
