import { schema } from '../db';
import type { Db } from '../types';

type Option = { uid: string; label: string };
type CatalogGeography = { id: string; label: string; geographyType?: string };
type ParentEdge = { geographyId: string; parentId: string };

// IAMC common region definitions: github.com/IAMconsortium/common-definitions/blob/main/definitions/region/common.yaml
export const WORLD_R9 = [
  'China (R9)',
  'European Union (R9)',
  'India (R9)',
  'Latin America (R9)',
  'Middle East & Africa (R9)',
  'Other Asia (R9)',
  'Other OECD (R9)',
  'Reforming Economies (R9)',
  'USA (R9)',
];

export function childRegionsFromCatalog(parentId: string, geographies: CatalogGeography[], parents: ParentEdge[]): Option[] {
  const parent = geographies.find(({ id }) => id === parentId);
  if (parent?.geographyType !== 'continent') return [];
  const childIds = new Set(parents.filter(({ parentId: candidate }) => candidate === parentId).map(({ geographyId }) => geographyId));
  return geographies
    .filter(({ id, geographyType }) => childIds.has(id) && geographyType === 'admin0')
    .map(({ id, label }) => ({ uid: id, label }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function worldR9Regions(): Option[] {
  return WORLD_R9.map((uid) => ({ uid, label: uid }));
}

export async function loadRegionCatalog(db: Db) {
  const [geographies, parents] = await Promise.all([db.select().from(schema.geographies), db.select().from(schema.geographyParents)]);
  return { geographies, parents };
}

type RegionCatalog = Awaited<ReturnType<typeof loadRegionCatalog>>;

export function childRegions(parentId: string, catalog: RegionCatalog): Option[] {
  if (parentId === 'World') return worldR9Regions();
  return childRegionsFromCatalog(parentId, catalog.geographies, catalog.parents);
}

export function supportedAreas(available: Set<string>, catalog: RegionCatalog): Option[] {
  const areas: Option[] = [];
  if (WORLD_R9.some((uid) => available.has(uid))) areas.push({ uid: 'World', label: 'World' });
  for (const geography of catalog.geographies) {
    if (geography.geographyType !== 'continent') continue;
    if (childRegions(geography.id, catalog).some(({ uid }) => available.has(uid))) {
      areas.push({ uid: geography.id, label: geography.label });
    }
  }
  return areas;
}

export function mapRegionOptions(type: 'admin0' | 'r9', available: Set<string>, catalog: RegionCatalog): Option[] {
  if (type === 'r9') {
    const regions = worldR9Regions().filter(({ uid }) => available.has(uid));
    return regions.length ? [{ uid: 'World', label: 'World' }, ...regions] : [];
  }
  const countries = catalog.geographies.filter(({ id, geographyType, geoId }) => geographyType === 'admin0' && geoId && available.has(id)).map(({ id, label }) => ({ uid: id, label }));
  const continents = supportedAreas(new Set(countries.map(({ uid }) => uid)), catalog);
  return countries.length ? [{ uid: 'World', label: 'World' }, ...continents, ...countries] : [];
}

export function mapMembers(type: 'admin0' | 'r9', area: string, catalog: RegionCatalog): Option[] {
  if (type === 'r9') {
    if (area === 'World') return worldR9Regions();
    return WORLD_R9.includes(area) ? [{ uid: area, label: area }] : [];
  }
  if (area === 'World') {
    return catalog.geographies.filter(({ geographyType, geoId }) => geographyType === 'admin0' && geoId).map(({ id, label }) => ({ uid: id, label }));
  }
  const children = childRegions(area, catalog);
  if (children.length) return children;
  const country = catalog.geographies.find(({ id, geographyType, geoId }) => id === area && geographyType === 'admin0' && geoId);
  return country ? [{ uid: country.id, label: country.label }] : [];
}
