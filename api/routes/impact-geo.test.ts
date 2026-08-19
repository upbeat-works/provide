import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { api } from '../index';
import type { Env } from '../types';
import * as impactGeoView from '../views/impact-geo';

const query =
  '?indicator=Mean%20Temperature&scenario=2020%20Climate%20Policies&geography=Cameroon&year=2030&time=Annual&reference=2011-2020%20(Present%20Day)&spatial=Area';
const response = {
  coordinatesOrigin: [6.25, 1.25],
  resolution: 2.5,
  resolutions: [2.5],
  formats: ['netcdf', 'geotiff'],
  data: [[0.1]],
  parameters: {
    indicator: 'Mean Temperature',
    scenario: '2020 Climate Policies',
    geography: 'Cameroon',
    year: 2030,
    time: 'Annual',
    reference: '2011-2020 (Present Day)',
    spatial: 'Area',
    frequency: 0.5,
  },
  selectableYears: ['2030', '2050', '2100'],
  model: 'MESMER',
  source: 'IIASA',
  year: 2030,
  showDifference: false,
  title: 'Mean temperature in Cameroon',
  description: 'Temperature change.',
};
const env = { GEOSERVER_URL: 'http://geoserver:8080/geoserver' } as Env['Bindings'];

let spy: ReturnType<typeof spyOn<typeof impactGeoView, 'fetchImpactGeo'>>;

beforeEach(() => {
  spy = spyOn(impactGeoView, 'fetchImpactGeo').mockResolvedValue(response);
});

afterEach(() => spy.mockRestore());

describe('GET /api/impact-geo', () => {
  test('requires the grid identity', async () => {
    const res = await api.request('/api/impact-geo', {}, env);
    expect(res.status).toBe(400);
  });

  test('returns the GeoServer-backed frontend contract', async () => {
    const res = await api.request(`/api/impact-geo${query}`, {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(response);
    expect(spy).toHaveBeenCalledWith(env.GEOSERVER_URL, {
      indicator: 'Mean Temperature',
      scenario: '2020 Climate Policies',
      geography: 'Cameroon',
      year: 2030,
      time: 'Annual',
      reference: '2011-2020 (Present Day)',
      spatial: 'Area',
      frequency: '0.5',
    });
  });

  test('reports selections that are not part of the proof of concept', async () => {
    spy.mockRejectedValueOnce(new impactGeoView.ImpactGeoCoverageNotFoundError('Coverage not found'));
    const res = await api.request(`/api/impact-geo${query.replace('Cameroon', 'Germany')}`, {}, env);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ isExpected: true });
  });
});
