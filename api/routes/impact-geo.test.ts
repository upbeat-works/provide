import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { api } from '../index';
import type { Env } from '../types';
import * as view from '../views/impact-geo';

const base = 'indicator=Mean%20Temperature&geography=Cameroon&reference=2011-2020%20(Present%20Day)&time=Annual&spatial=Area&instance=provide-internal';
const gridQuery = `${base}&scenario=2020%20Climate%20Policies&year=2030`;
const env = {
  GEOSERVER_URL: 'http://geo.test/geoserver',
  GEOSERVER_WORKSPACE: 'climate-risk-dashboard',
  GEOSERVER_USERNAME: 'map-reader',
  GEOSERVER_PASSWORD: 'secret',
} as Env['Bindings'];
let availabilitySpy: ReturnType<typeof spyOn<typeof view, 'fetchImpactGeoAvailability'>>;
let gridSpy: ReturnType<typeof spyOn<typeof view, 'fetchImpactGeoGrid'>>;
let downloadSpy: ReturnType<typeof spyOn<typeof view, 'fetchImpactGeoDownload'>>;

beforeEach(() => {
  availabilitySpy = spyOn(view, 'fetchImpactGeoAvailability').mockResolvedValue({
    '2020 Climate Policies': [2030, 2050], Low: [],
  });
  gridSpy = spyOn(view, 'fetchImpactGeoGrid').mockResolvedValue({
    coordinatesOrigin: [9, 3], resolution: 2, resolutions: [2], data: [[0.8]],
    parameters: { indicator: 'Mean Temperature', geography: 'Cameroon', reference: '2011-2020 (Present Day)',
      time: 'Annual', spatial: 'Area', scenario: '2020 Climate Policies', frequency: 0.5 },
    formats: ['netcdf', 'geotiff'], year: 2030, showDifference: false,
  });
  downloadSpy = spyOn(view, 'fetchImpactGeoDownload').mockImplementation(async (_config, _params, format) => {
    const contentType = format === 'netcdf' ? 'application/x-netcdf' : 'image/tiff';
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': contentType } });
  });
});

afterEach(() => {
  availabilitySpy.mockRestore();
  gridSpy.mockRestore();
  downloadSpy.mockRestore();
});

describe('GET /api/impact-geo/availability', () => {
  test('loads all scenario years in one adapter call', async () => {
    const response = await api.request(`/api/impact-geo/availability?${base}&scenarios=2020%20Climate%20Policies&scenarios=Low`, {}, env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ scenarios: { '2020 Climate Policies': [2030, 2050], Low: [] } });
    expect(availabilitySpy).toHaveBeenCalledTimes(1);
  });

  test('returns no availability for another configured instance', async () => {
    const response = await api.request(`/api/impact-geo/availability?${base.replace('provide-internal', 'sparccle-internal')}&scenarios=Low`, {}, env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ scenarios: { Low: [] } });
    expect(availabilitySpy).not.toHaveBeenCalled();
  });
});

describe('GET /api/impact-geo', () => {
  test('returns the grid and forwards the canonical selection', async () => {
    const response = await api.request(`/api/impact-geo?${gridQuery}&frequency=0.5`, {}, env);
    expect(response.status).toBe(200);
    expect((await response.json() as { year: number }).year).toBe(2030);
    expect(gridSpy).toHaveBeenCalledWith({
      url: env.GEOSERVER_URL,
      workspace: 'climate-risk-dashboard',
      username: 'map-reader',
      password: 'secret',
    }, expect.objectContaining({ scenario: '2020 Climate Policies', year: 2030 }));
  });

  test('streams a GeoTIFF attachment from the same selection', async () => {
    const response = await api.request(`/api/impact-geo?${gridQuery}&format=geotiff`, {}, env);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/tiff');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="impact-geo_2020-climate-policies_2030.tif"');
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3]);
    expect(downloadSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ year: 2030 }), 'geotiff');
  });

  test('streams a NetCDF attachment from the same selection', async () => {
    const response = await api.request(`/api/impact-geo?${gridQuery}&format=netcdf&resolution=native`, {}, env);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/x-netcdf');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="impact-geo_2020-climate-policies_2030.nc"');
    expect(downloadSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ year: 2030 }), 'netcdf');
  });

  test('validates instance, selection params, format, resolution, frequency, and threshold', async () => {
    for (const query of [gridQuery.replace('provide-internal', 'unknown'), `${gridQuery}&format=png`, `${gridQuery}&format=`, `${gridQuery}&frequency=1`, `${gridQuery}&resolution=2`, `${gridQuery}&threshold=90th%20Percentile`, `${gridQuery}&indicator_value=35`, base]) {
      const response = await api.request(`/api/impact-geo?${query}`, {}, env);
      expect([400, 404]).toContain(response.status);
    }
    expect(gridSpy).not.toHaveBeenCalled();
  });

  test('maps missing configuration, missing coverage, and upstream failure', async () => {
    expect((await api.request(`/api/impact-geo?${gridQuery}`, {}, { ...env, GEOSERVER_URL: undefined })).status).toBe(503);
    gridSpy.mockRejectedValueOnce(new view.ImpactGeoCoverageNotFoundError('missing'));
    const missing = await api.request(`/api/impact-geo?${gridQuery}`, {}, env);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ message: 'missing', isExpected: true });
    gridSpy.mockRejectedValueOnce(new view.ImpactGeoUpstreamError('broken'));
    expect((await api.request(`/api/impact-geo?${gridQuery}`, {}, env)).status).toBe(502);
  });

  test('allows anonymous GeoServer configuration and rejects partial credentials safely', async () => {
    const anonymous = { ...env, GEOSERVER_WORKSPACE: undefined, GEOSERVER_USERNAME: undefined, GEOSERVER_PASSWORD: undefined };
    expect((await api.request(`/api/impact-geo?${gridQuery}`, {}, anonymous)).status).toBe(200);
    expect(gridSpy).toHaveBeenLastCalledWith(expect.objectContaining({ workspace: 'provide', username: undefined, password: undefined }), expect.anything());

    const partial = { ...env, GEOSERVER_USERNAME: 'map-reader', GEOSERVER_PASSWORD: undefined };
    const response = await api.request(`/api/impact-geo?${gridQuery}`, {}, partial);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('map-reader');
    expect(gridSpy).toHaveBeenCalledTimes(1);
  });
});
