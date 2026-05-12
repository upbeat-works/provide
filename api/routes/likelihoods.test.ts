import { describe, test, expect } from 'bun:test';
import { api } from '../index';
import { createTestEnv } from '../test-helpers';

describe('GET /api/likelihoods', () => {
  test('returns curated likelihoods with uid, label, value', async () => {
    const res = await api.request('/api/likelihoods', {}, createTestEnv());
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      likelihoods: Array<{ uid: string; label: string; value: number }>;
    };
    expect(Array.isArray(json.likelihoods)).toBe(true);
    expect(json.likelihoods.length).toBeGreaterThan(0);
    for (const l of json.likelihoods) {
      expect(typeof l.uid).toBe('string');
      expect(typeof l.label).toBe('string');
      expect(typeof l.value).toBe('number');
    }
    expect(json.likelihoods.map((l) => l.uid)).toEqual(
      expect.arrayContaining(['likely', 'very-likely', 'extremely-likely']),
    );
  });
});
