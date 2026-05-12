import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { api } from '../index';
import { instances } from '../instances';
import * as ixmp4 from '../ixmp4';
import { createTestEnv } from '../test-helpers';

const instance = instances[0];
const baseQuery = `?indicator=Temperature|Global%20Mean&geography=DEU&scenarios=curpol&instance=${instance.slug}`;

let spy: ReturnType<typeof spyOn<typeof ixmp4, 'fetchImpactTime'>>;

beforeEach(() => {
  spy = spyOn(ixmp4, 'fetchImpactTime').mockResolvedValue({
    yearStart: 2020,
    yearStep: 5,
    data: { curpol: [[0.9, 1.0, 1.1] as [number, number, number]] },
    model: 'MESMER',
    source: 'IIASA',
    title: 'Mean Temperature',
    description: 'Annual mean temperature',
    parameters: {},
    formats: ['csv'],
  });
});

afterEach(() => {
  spy.mockRestore();
});

describe('GET /api/impact-time', () => {
  test('returns 400 when required params are missing', async () => {
    const res = await api.request('/api/impact-time', {}, createTestEnv());
    expect(res.status).toBe(400);
  });

  test('returns the documented response shape', async () => {
    const res = await api.request(`/api/impact-time${baseQuery}`, {}, createTestEnv());
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).toHaveProperty('yearStart');
    expect(json).toHaveProperty('formats', ['csv']);
    expect(json).toHaveProperty('data');
  });

  test('data keys are scenario ids with [min, value, max] tuples', async () => {
    const res = await api.request(`/api/impact-time${baseQuery}`, {}, createTestEnv());
    const json = await res.json() as { data: Record<string, number[][]> };
    expect(Object.keys(json.data)).toContain('curpol');
    expect(json.data.curpol[0]).toHaveLength(3);
  });

  test('routes the query to the requested instance', async () => {
    await api.request(`/api/impact-time${baseQuery}`, {}, createTestEnv());
    expect(spy).toHaveBeenCalled();
    const [arg] = spy.mock.calls[0];
    expect(arg).toMatchObject({ slug: instance.slug });
  });

  test('returns 404 when the instance slug is unknown', async () => {
    const res = await api.request('/api/impact-time?indicator=x&geography=DEU&scenarios=curpol&instance=does-not-exist', {}, createTestEnv());
    expect(res.status).toBe(404);
  });
});
