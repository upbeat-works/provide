import { schema } from '../db';
import type { Db } from '../types';

type Option = { uid: string; label: string };
type CatalogGeography = { id: string; label: string; geographyType?: string };
type ParentEdge = { geographyId: string; parentId: string };

// IAMC common region definitions: github.com/IAMconsortium/common-definitions/blob/main/definitions/region/common.yaml
export const WORLD_R9 = ['China (R9)', 'European Union (R9)', 'India (R9)', 'Latin America (R9)', 'Middle East & Africa (R9)', 'Other Asia (R9)', 'Other OECD (R9)', 'Reforming Economies (R9)', 'USA (R9)'];

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

async function catalogRows(db: Db) {
  return Promise.all([db.select().from(schema.geographies), db.select().from(schema.geographyParents)]);
}

export async function loadChildRegions(db: Db, parentId: string): Promise<Option[]> {
  if (parentId === 'World') return worldR9Regions();
  const [geographies, parents] = await catalogRows(db);
  return childRegionsFromCatalog(parentId, geographies, parents);
}

export async function loadSupportedAreas(db: Db, availableRegions: Set<string>): Promise<Option[]> {
  const areas: Option[] = [];
  if (worldR9Regions().some(({ uid }) => availableRegions.has(uid))) areas.push({ uid: 'World', label: 'World' });
  const [geographies, parents] = await catalogRows(db);
  for (const geography of geographies) {
    if (geography.geographyType !== 'continent') continue;
    if (childRegionsFromCatalog(geography.id, geographies, parents).some(({ uid }) => availableRegions.has(uid))) {
      areas.push({ uid: geography.id, label: geography.label });
    }
  }
  return areas.sort((left, right) => left.label.localeCompare(right.label));
}

export async function loadMapRegionOptions(db: Db, geographyType: 'admin0' | 'r9', availableRegions: Set<string>): Promise<Option[]> {
  if (geographyType === 'r9') {
    const regions = worldR9Regions().filter(({ uid }) => availableRegions.has(uid));
    return regions.length ? [{ uid: 'World', label: 'World' }, ...regions] : [];
  }
  const [geographies, parents] = await catalogRows(db);
  const countries = geographies
    .filter(({ id, geographyType, geoId }) => geographyType === 'admin0' && geoId && availableRegions.has(id))
    .map(({ id, label }) => ({ uid: id, label }));
  const continents = geographies
    .filter(({ geographyType }) => geographyType === 'continent')
    .filter(({ id }) => childRegionsFromCatalog(id, geographies, parents).some(({ uid }) => availableRegions.has(uid)))
    .map(({ id, label }) => ({ uid: id, label }));
  return countries.length ? [{ uid: 'World', label: 'World' }, ...continents, ...countries] : [];
}

export async function loadMapMembers(db: Db, geographyType: 'admin0' | 'r9', area: string): Promise<Option[]> {
  if (geographyType === 'r9') {
    if (area === 'World') return worldR9Regions();
    return WORLD_R9.includes(area) ? [{ uid: area, label: area }] : [];
  }
  const [geographies, parents] = await catalogRows(db);
  if (area === 'World') {
    return geographies.filter(({ geographyType, geoId }) => geographyType === 'admin0' && geoId).map(({ id, label }) => ({ uid: id, label }));
  }
  const children = childRegionsFromCatalog(area, geographies, parents);
  if (children.length) return children;
  const country = geographies.find(({ id, geographyType, geoId }) => id === area && geographyType === 'admin0' && geoId);
  return country ? [{ uid: country.id, label: country.label }] : [];
}

export async function loadAdmin0Geographies(db: Db) {
  return (await db.select().from(schema.geographies)).filter(({ geographyType }) => geographyType === 'admin0');
}
