import { afterEach, describe, expect, test, vi } from 'vitest';
import { filterRegionalBoundaries, loadRegionalBoundaries } from './boundaries';

const austria = { type: 'Feature', properties: { NUTS_ID: 'AT11', CNTR_CODE: 'AT', LEVL_CODE: 2 }, geometry: null } as unknown as GeoJSON.Feature;
const otherLevel = { type: 'Feature', properties: { NUTS_ID: 'AT1', CNTR_CODE: 'AT', LEVL_CODE: 1 }, geometry: null } as unknown as GeoJSON.Feature;
const france = { type: 'Feature', properties: { NUTS_ID: 'FR10', CNTR_CODE: 'FR', LEVL_CODE: 2 }, geometry: null } as unknown as GeoJSON.Feature;
const collection = { type: 'FeatureCollection', features: [austria, otherLevel, france] } as GeoJSON.FeatureCollection;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('regional NUTS boundaries', () => {
  test('returns unchanged matching features', () => {
    expect(filterRegionalBoundaries(collection, 'AT', 'NUTS2')).toEqual({ type: 'FeatureCollection', features: [austria] });
    expect(filterRegionalBoundaries(collection, 'AT', 'NUTS2').features[0]).toBe(austria);
  });

  test.each([
    ['NUTS1' as const, 3, 1],
    ['NUTS2' as const, 9, 2],
  ])('loads packaged Austrian %s boundaries without a network request', async (level, count, levelCode) => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('Network access is not allowed');
    });

    const result = await loadRegionalBoundaries('AT', level);

    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(count);
    expect(result.features.every(({ properties }) => properties?.CNTR_CODE === 'AT' && properties.NUTS_ID && Number(properties.LEVL_CODE) === levelCode)).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });

  test('loads the packaged United Kingdom NUTS2 shapes', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network access is not allowed'));

    const result = await loadRegionalBoundaries('UK', 'NUTS2');

    expect(result.features).toHaveLength(41);
    expect(result.features.every(({ properties, geometry }) => properties?.CNTR_CODE === 'UK' && properties.NUTS_ID?.startsWith('UK') && geometry !== null)).toBe(true);
    expect(new Set(result.features.map(({ geometry }) => geometry.type))).toEqual(new Set(['Polygon', 'MultiPolygon']));
  });
});
