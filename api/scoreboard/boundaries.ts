export type NutsLevel = 'NUTS1' | 'NUTS2';

export function filterRegionalBoundaries(collection: GeoJSON.FeatureCollection, countryCode: string | undefined, level: NutsLevel): GeoJSON.FeatureCollection {
  const levelCode = Number(level.slice(-1));
  const features = collection.features.filter(({ properties }) => (countryCode === undefined || properties?.CNTR_CODE === countryCode) && Number(properties.LEVL_CODE) === levelCode);
  return { ...collection, features };
}

async function loadBoundaryCollection(level: NutsLevel): Promise<GeoJSON.FeatureCollection> {
  if (level === 'NUTS1') return (await import('./data/nuts1.json')).default as GeoJSON.FeatureCollection;
  return (await import('./data/nuts2.json')).default as GeoJSON.FeatureCollection;
}

export async function loadRegionalBoundaries(countryCode: string | undefined, level: NutsLevel): Promise<GeoJSON.FeatureCollection> {
  const collection = await loadBoundaryCollection(level);
  return filterRegionalBoundaries(collection, countryCode, level);
}
