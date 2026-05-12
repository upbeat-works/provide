import { describe, test, expect } from 'bun:test';
import { api } from '../index';
import { createTestEnv } from '../test-helpers';

describe('GET /api/study-locations', () => {
  test('returns the curated study locations', async () => {
    const res = await api.request('/api/study-locations', {}, createTestEnv());
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      studyLocations: Array<{ uid: string; label: string; order: number }>;
    };
    expect(Array.isArray(json.studyLocations)).toBe(true);
    expect(json.studyLocations.length).toBeGreaterThan(0);
    for (const loc of json.studyLocations) {
      expect(typeof loc.uid).toBe('string');
      expect(typeof loc.label).toBe('string');
      expect(typeof loc.order).toBe('number');
    }
  });

  test('includes the city-average location', async () => {
    const res = await api.request('/api/study-locations', {}, createTestEnv());
    const json = (await res.json()) as { studyLocations: Array<{ uid: string }> };
    expect(json.studyLocations.map((l) => l.uid)).toContain('city-average');
  });

  test('accepts a trailing slash on the route', async () => {
    const res = await api.request('/api/study-locations/', {}, createTestEnv());
    expect(res.status).toBe(200);
    const json = (await res.json()) as { studyLocations: unknown[] };
    expect(Array.isArray(json.studyLocations)).toBe(true);
  });
});
