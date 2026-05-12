import { describe, test, expect } from 'bun:test';
import { api } from '../index';
import { schema } from '../db';
import { createTestEnv } from '../test-helpers';

describe('GET /api/geography-types', () => {
  test('returns curated geography types in legacy uid-keyed shape', async () => {
    const env = createTestEnv();
    await env.DB.insert(schema.geographyTypes).values([
      { id: 'admin0', label: 'Countries', labelSingular: 'Country', order: 1, isAvailable: true },
      { id: 'cities', label: 'Cities', labelSingular: 'City', order: 2, isAvailable: true },
    ]);
    const res = await api.request('/api/geography-types', {}, env);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      geographyTypes: Array<{
        uid: string;
        label: string;
        labelSingular?: string;
        icon: string;
        isAvailable: boolean;
        availableIndicators: string[];
      }>;
    };
    const admin0 = json.geographyTypes.find((t) => t.uid === 'admin0');
    expect(admin0).toMatchObject({
      uid: 'admin0',
      label: 'Countries',
      labelSingular: 'Country',
      icon: '🗺️',
      isAvailable: true,
    });
    expect(admin0?.availableIndicators).toEqual(
      expect.arrayContaining(['terclim-mean-temperature']),
    );
  });

  test('includes types present in curation even when D1 has none', async () => {
    const env = createTestEnv();
    const res = await api.request('/api/geography-types', {}, env);
    const json = (await res.json()) as { geographyTypes: Array<{ uid: string }> };
    expect(json.geographyTypes.map((t) => t.uid)).toEqual(
      expect.arrayContaining(['admin0', 'admin1', 'cities', 'breadbaskets']),
    );
  });

  test('respects the D1 isAvailable flag when present', async () => {
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
