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
let rasterSpy: ReturnType<typeof spyOn<typeof view, 'fetchImpactGeoRaster'>>;
let downloadSpy: ReturnType<typeof spyOn<typeof view, 'fetchImpactGeoDownload'>>;

beforeEach(() => {
  rasterSpy = spyOn(view, 'fetchImpactGeoRaster').mockImplementation(async () =>
    new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/tiff' } }));
  downloadSpy = spyOn(view, 'fetchImpactGeoDownload').mockImplementation(async (_config, _params, format) => {
    const contentType = format === 'netcdf' ? 'application/x-netcdf' : 'image/tiff';
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': contentType } });
  });
});

afterEach(() => {
  rasterSpy.mockRestore();
  downloadSpy.mockRestore();
});

describe('GET /api/impact-geo errors', () => {
  test.each([
    { code: 'GEOSERVER_TIMEOUT', status: 504, timeoutMs: 15000, upstreamStatus: undefined, message: 'GeoServer did not respond within 15 seconds. Please try again.' },
    { code: 'GEOSERVER_HTTP_ERROR', status: 502, timeoutMs: undefined, upstreamStatus: 403, message: 'GeoServer WCS request failed with HTTP 403' },
  ])('explains and logs $code with a request ID', async ({ code, status, timeoutMs, upstreamStatus, message }) => {
    const log = spyOn(console, 'error').mockImplementation(() => {});
    rasterSpy.mockRejectedValueOnce(Object.assign(new view.ImpactGeoUpstreamError(message), { code, timeoutMs, upstreamStatus }));
    try {
      const response = await api.request(`/api/impact-geo?${gridQuery}&token=private`, {
        headers: { 'cf-ray': 'test-ray', authorization: 'Basic private' },
      }, env);
      const body = await response.json();
      expect(response.status).toBe(status);
      expect(body).toMatchObject({ error: message, code });
      expect(typeof body.requestId).toBe('string');
      expect(response.headers.get('x-request-id')).toBe(body.requestId);
      const event = JSON.parse(log.mock.calls[0][0]);
      expect(event).toMatchObject({
        event: 'geoserver_request_failed', requestId: body.requestId, cfRay: 'test-ray',
        code, status, operation: 'GetCoverage', elapsedMs: expect.any(Number),
        geoserverHost: 'geo.test', workspace: 'climate-risk-dashboard',
        selection: { indicator: 'Mean Temperature', geography: 'Cameroon', time: 'Annual', scenario: '2020 Climate Policies' },
      });
      if (timeoutMs) expect(body.timeoutMs).toBe(timeoutMs);
      if (upstreamStatus) expect(body.upstreamStatus).toBe(upstreamStatus);
      expect(JSON.stringify([body, log.mock.calls])).not.toMatch(/secret|map-reader|private/);
    } finally {
      log.mockRestore();
    }
  });

  test('does not expose unexpected exception text in its response or logs', async () => {
    const log = spyOn(console, 'error').mockImplementation(() => {});
    rasterSpy.mockRejectedValueOnce(new Error('http://map-reader:secret@geo.test/private'));
    try {
      const response = await api.request(`/api/impact-geo?${gridQuery}`, {}, env);
      const body = await response.json();
      expect(response.status).toBe(502);
      expect(body).toMatchObject({ code: 'GEOSERVER_UPSTREAM_ERROR' });
      expect(typeof body.requestId).toBe('string');
      expect(JSON.stringify([body, log.mock.calls])).not.toMatch(/secret|map-reader|private/);
    } finally {
      log.mockRestore();
    }
  });
});

describe('GET /api/impact-geo', () => {
  test('streams a raster for the browser and forwards the canonical selection', async () => {
    const response = await api.request(`/api/impact-geo?${gridQuery}&frequency=0.5`, {}, env);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/tiff');
    expect(response.headers.has('content-disposition')).toBe(false);
    expect(rasterSpy).toHaveBeenCalledWith({
      url: env.GEOSERVER_URL,
      workspace: 'climate-risk-dashboard',
      username: 'map-reader',
      password: 'secret',
    }, expect.objectContaining({ scenario: '2020 Climate Policies', year: 2030 }));
  });

  test('passes raster chunks through before the upstream download finishes', async () => {
    let upstream: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        upstream = controller;
        controller.enqueue(new Uint8Array([1, 2]));
      },
    });
    rasterSpy.mockResolvedValueOnce(new Response(stream, { headers: { 'content-type': 'image/tiff' } }));
    const response = await api.request(`/api/impact-geo?${gridQuery}`, {}, env);
    const reader = response.body!.getReader();
    expect(await reader.read()).toEqual({ done: false, value: new Uint8Array([1, 2]) });
    upstream!.enqueue(new Uint8Array([3, 4]));
    upstream!.close();
    expect(await reader.read()).toEqual({ done: false, value: new Uint8Array([3, 4]) });
    expect((await reader.read()).done).toBe(true);
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
    for (const query of [gridQuery.replace('provide-internal', 'unknown'), gridQuery.replace('provide-internal', 'sparccle-internal'), `${gridQuery}&format=png`, `${gridQuery}&format=`, `${gridQuery}&frequency=1`, `${gridQuery}&resolution=2`, `${gridQuery}&threshold=90th%20Percentile`, `${gridQuery}&indicator_value=35`, base]) {
      const response = await api.request(`/api/impact-geo?${query}`, {}, env);
      expect([400, 404]).toContain(response.status);
    }
    expect(rasterSpy).not.toHaveBeenCalled();
  });

  test('maps missing configuration, missing coverage, and upstream failure', async () => {
    expect((await api.request(`/api/impact-geo?${gridQuery}`, {}, { ...env, GEOSERVER_URL: undefined })).status).toBe(503);
    rasterSpy.mockRejectedValueOnce(new view.ImpactGeoCoverageNotFoundError('missing'));
    const missing = await api.request(`/api/impact-geo?${gridQuery}`, {}, env);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ message: 'missing', isExpected: true });
    rasterSpy.mockRejectedValueOnce(new view.ImpactGeoUpstreamError('broken'));
    expect((await api.request(`/api/impact-geo?${gridQuery}`, {}, env)).status).toBe(502);
  });

  test('allows anonymous GeoServer configuration and rejects partial credentials safely', async () => {
    const anonymous = { ...env, GEOSERVER_WORKSPACE: undefined, GEOSERVER_USERNAME: undefined, GEOSERVER_PASSWORD: undefined };
    expect((await api.request(`/api/impact-geo?${gridQuery}`, {}, anonymous)).status).toBe(200);
    expect(rasterSpy).toHaveBeenLastCalledWith(expect.objectContaining({ workspace: 'provide', username: undefined, password: undefined }), expect.anything());

    const partial = { ...env, GEOSERVER_USERNAME: 'map-reader', GEOSERVER_PASSWORD: undefined };
    const response = await api.request(`/api/impact-geo?${gridQuery}`, {}, partial);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('map-reader');
    expect(rasterSpy).toHaveBeenCalledTimes(1);
  });
});
