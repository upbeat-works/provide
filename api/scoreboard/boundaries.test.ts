import { afterEach, describe, expect, test, vi } from 'vitest';
import { __resetBoundaryCache, boundarySource, filterRegionalBoundaries, loadRegionalBoundaries } from './boundaries';

const austria = { type: 'Feature', properties: { NUTS_ID: 'AT11', CNTR_CODE: 'AT', LEVL_CODE: 2 }, geometry: null } as unknown as GeoJSON.Feature;
const otherLevel = { type: 'Feature', properties: { NUTS_ID: 'AT1', CNTR_CODE: 'AT', LEVL_CODE: 1 }, geometry: null } as unknown as GeoJSON.Feature;
const france = { type: 'Feature', properties: { NUTS_ID: 'FR10', CNTR_CODE: 'FR', LEVL_CODE: 2 }, geometry: null } as unknown as GeoJSON.Feature;
const collection = { type: 'FeatureCollection', features: [austria, otherLevel, france] } as GeoJSON.FeatureCollection;

afterEach(() => {
  __resetBoundaryCache();
  vi.restoreAllMocks();
});

describe('regional NUTS boundaries', () => {
  test('uses the pinned source and returns unchanged matching features', () => {
    expect(boundarySource('NUTS1')).toBe(
      'https://raw.githubusercontent.com/iiasa/scse-geojson/ec306cb6802bcb733743dfc9556f5432ecba5671/nuts-with-uk/nuts1_updated_uk_regions.geojson'
    );
    expect(boundarySource('NUTS2')).toBe(
      'https://raw.githubusercontent.com/iiasa/scse-geojson/ec306cb6802bcb733743dfc9556f5432ecba5671/nuts-with-uk/nuts2_updated_uk_regions.geojson'
    );
    expect(filterRegionalBoundaries(collection, 'AT', 'NUTS2')).toEqual({ type: 'FeatureCollection', features: [austria] });
    expect(filterRegionalBoundaries(collection, 'AT', 'NUTS2').features[0]).toBe(austria);
  });

  test('caches successful source loads by URL', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(collection), { status: 200 }));

    await loadRegionalBoundaries('AT', 'NUTS2', fetcher);
    await loadRegionalBoundaries('FR', 'NUTS2', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('retries a failed source load', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('failed', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(collection), { status: 200 }));

    await expect(loadRegionalBoundaries('AT', 'NUTS2', fetcher)).rejects.toThrow('503');
    await expect(loadRegionalBoundaries('AT', 'NUTS2', fetcher)).resolves.toEqual({ type: 'FeatureCollection', features: [austria] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
