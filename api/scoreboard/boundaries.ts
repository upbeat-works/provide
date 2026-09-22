export type NutsLevel = 'NUTS1' | 'NUTS2';

const COMMIT = 'ec306cb6802bcb733743dfc9556f5432ecba5671';
const BASE = `https://raw.githubusercontent.com/iiasa/scse-geojson/${COMMIT}/nuts-with-uk`;
const sources: Record<NutsLevel, string> = {
  NUTS1: `${BASE}/nuts1_updated_uk_regions.geojson`,
  NUTS2: `${BASE}/nuts2_updated_uk_regions.geojson`,
};
const cache = new Map<string, GeoJSON.FeatureCollection>();

export const boundarySource = (level: NutsLevel): string => sources[level];

export function filterRegionalBoundaries(collection: GeoJSON.FeatureCollection, countryCode: string, level: NutsLevel): GeoJSON.FeatureCollection {
  const levelCode = Number(level.slice(-1));
  const features = collection.features.filter(({ properties }) => properties?.CNTR_CODE === countryCode && Number(properties.LEVL_CODE) === levelCode);
  return { ...collection, features };
}

export async function loadRegionalBoundaries(countryCode: string, level: NutsLevel, fetcher: typeof fetch = fetch): Promise<GeoJSON.FeatureCollection> {
  const url = boundarySource(level);
  let collection = cache.get(url);
  if (!collection) {
    const response = await fetcher(url);
    if (!response.ok) throw new Error(`Regional boundaries unavailable: ${response.status}`);
    collection = (await response.json()) as GeoJSON.FeatureCollection;
    cache.set(url, collection);
  }
  return filterRegionalBoundaries(collection, countryCode, level);
}

export function __resetBoundaryCache() {
  cache.clear();
}
