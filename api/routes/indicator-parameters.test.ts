import { describe, test, expect } from 'bun:test';
import { api } from '../index';
import { createTestEnv } from '../test-helpers';

describe('GET /api/indicator-parameters', () => {
  test('returns curated indicator parameters with nested options', async () => {
    const res = await api.request('/api/indicator-parameters', {}, createTestEnv());
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      indicatorParameters: Array<{
        uid: string;
        label: string;
        options: Array<{ uid: string; label: string; labelLong?: string }>;
      }>;
    };
    expect(Array.isArray(json.indicatorParameters)).toBe(true);
    expect(json.indicatorParameters.length).toBeGreaterThan(0);
    for (const p of json.indicatorParameters) {
      expect(typeof p.uid).toBe('string');
      expect(typeof p.label).toBe('string');
      expect(Array.isArray(p.options)).toBe(true);
      for (const opt of p.options) {
        expect(typeof opt.uid).toBe('string');
        expect(typeof opt.label).toBe('string');
      }
    }
  });

  test('includes the canonical parameter groups', async () => {
    const res = await api.request('/api/indicator-parameters', {}, createTestEnv());
    const json = (await res.json()) as { indicatorParameters: Array<{ uid: string }> };
    expect(json.indicatorParameters.map((p) => p.uid)).toEqual(
      expect.arrayContaining(['time', 'reference', 'spatial']),
    );
  });
});
