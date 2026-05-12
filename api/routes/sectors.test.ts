import { describe, test, expect } from 'bun:test';
import { api } from '../index';
import { createTestEnv } from '../test-helpers';

describe('GET /api/sectors', () => {
  test('returns curated sectors with uid, label, icon', async () => {
    const res = await api.request('/api/sectors', {}, createTestEnv());
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      sectors: Array<{
        uid: string;
        label: string;
        icon: string;
        availableGeographies: string[];
        availableScenarios: string[];
      }>;
    };
    expect(Array.isArray(json.sectors)).toBe(true);
    expect(json.sectors.map((s) => s.uid)).toEqual(
      expect.arrayContaining(['terrestrial-climate', 'urban-climate', 'maritime-climate']),
    );
    const terclim = json.sectors.find((s) => s.uid === 'terrestrial-climate');
    expect(terclim).toMatchObject({ label: 'Terrestrial Climate', icon: '⛰️' });
  });

  test('each sector exposes availability arrays of geography and scenario uids', async () => {
    const res = await api.request('/api/sectors', {}, createTestEnv());
    const json = (await res.json()) as {
      sectors: Array<{ availableGeographies: string[]; availableScenarios: string[] }>;
    };
    for (const sector of json.sectors) {
      expect(Array.isArray(sector.availableGeographies)).toBe(true);
      expect(Array.isArray(sector.availableScenarios)).toBe(true);
    }
  });

  test('terrestrial-climate availability includes curpol scenario and DEU geography', async () => {
    const res = await api.request('/api/sectors', {}, createTestEnv());
    const json = (await res.json()) as {
      sectors: Array<{ uid: string; availableGeographies: string[]; availableScenarios: string[] }>;
    };
    const terclim = json.sectors.find((s) => s.uid === 'terrestrial-climate')!;
    expect(terclim.availableScenarios).toContain('curpol');
    expect(terclim.availableGeographies).toContain('DEU');
  });
});
