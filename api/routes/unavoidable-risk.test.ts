import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { api } from '../index';
import { instances } from '../instances';
import * as ixmp4 from '../ixmp4';
import { createTestEnv } from '../test-helpers';

const instance = instances[0];
const baseQuery = `?indicator=Temperature|Global%20Mean&geography=DEU&scenarios=curpol&instance=${instance.slug}`;

let spy: ReturnType<typeof spyOn<typeof ixmp4, 'fetchEnsemble'>>;

beforeEach(() => {
  spy = spyOn(ixmp4, 'fetchEnsemble').mockResolvedValue({
    thresholds: [0, 1, 2, 3],
    defaultThreshold: 2,
    years: [2030, 2050, 2100],
    today: [0.85, 0.42, 0.15, 0.03],
    data: { curpol: [[1, 1, 1, 1], [1, 1, 0.9, 0.5], [1, 0.9, 0.6, 0.2]] },
    title: 'Mean Temperature',
    description: 'Probability of exceeding threshold',
    model: 'MESMER',
    source: 'IIASA',
    formats: ['csv'],
  });
});

afterEach(() => {
  spy.mockRestore();
});

describe('GET /api/unavoidable-risk', () => {
  test('returns 400 when required params are missing', async () => {
    const res = await api.request('/api/unavoidable-risk', {}, createTestEnv());
    expect(res.status).toBe(400);
  });

  test('returns the documented response shape', async () => {
    const res = await api.request(`/api/unavoidable-risk${baseQuery}`, {}, createTestEnv());
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty('thresholds');
    expect(json).toHaveProperty('defaultThreshold');
    expect(json).toHaveProperty('years');
    expect(json).toHaveProperty('today');
    expect(json).toHaveProperty('data');
    expect(json).toHaveProperty('formats', ['csv']);
  });

  test('data is keyed by scenario id with one row per year, one cell per threshold', async () => {
    const res = await api.request(`/api/unavoidable-risk${baseQuery}`, {}, createTestEnv());
    const json = await res.json() as { thresholds: number[]; years: number[]; data: Record<string, number[][]> };
    expect(json.data.curpol).toHaveLength(json.years.length);
    expect(json.data.curpol[0]).toHaveLength(json.thresholds.length);
  });

  test('today array length matches thresholds length', async () => {
    const res = await api.request(`/api/unavoidable-risk${baseQuery}`, {}, createTestEnv());
    const json = await res.json() as { thresholds: number[]; today: number[] };
    expect(json.today).toHaveLength(json.thresholds.length);
  });

  test('returns 404 when the instance slug is unknown', async () => {
    const res = await api.request('/api/unavoidable-risk?indicator=x&geography=DEU&scenarios=curpol&instance=does-not-exist', {}, createTestEnv());
    expect(res.status).toBe(404);
  });
});
