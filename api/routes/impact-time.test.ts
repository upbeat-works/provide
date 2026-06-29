import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { api } from '../index';
import { instances } from '../instances';
import * as impactTime from '../views/impact-time';
import { createTestEnv } from '../test-helpers';

const instance = instances[0];
const baseQuery = `?indicator=Mean%20Temperature&geography=France&scenarios=Today&instance=${instance.slug}`;

let spy: ReturnType<typeof spyOn<typeof impactTime, 'fetchImpactTime'>>;

beforeEach(() => {
  spy = spyOn(impactTime, 'fetchImpactTime').mockResolvedValue({
    yearStart: 2020,
    yearStep: 5,
    data: { Today: [[0.9, 1.0, 1.1] as [number, number, number]] },
    unit: '°C',
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
    expect(json).toHaveProperty('unit', '°C');
  });

  test('data keys are scenario ids with [min, value, max] tuples', async () => {
    const res = await api.request(`/api/impact-time${baseQuery}`, {}, createTestEnv());
    const json = await res.json() as { data: Record<string, number[][]> };
    expect(Object.keys(json.data)).toContain('Today');
    expect(json.data.Today[0]).toHaveLength(3);
  });

  test('routes the query to the requested instance', async () => {
    await api.request(`/api/impact-time${baseQuery}`, {}, createTestEnv());
    expect(spy).toHaveBeenCalled();
    const [arg] = spy.mock.calls[0];
    expect(arg).toMatchObject({ slug: instance.slug });
  });

  test('forwards the selector params (time/reference/spatial) to the adapter', async () => {
    await api.request(
      `/api/impact-time${baseQuery}&time=December%20-%20February&reference=1850-1900%20(Pre-industrial)&spatial=Area`,
      {},
      createTestEnv(),
    );
    const [, , params] = spy.mock.calls[0];
    expect(params).toMatchObject({
      temporal: 'December - February',
      period: '1850-1900 (Pre-industrial)',
      spatial: 'Area',
    });
  });

  test('returns 404 when the instance slug is unknown', async () => {
    const res = await api.request('/api/impact-time?indicator=x&geography=DEU&scenarios=curpol&instance=does-not-exist', {}, createTestEnv());
    expect(res.status).toBe(404);
  });
});
