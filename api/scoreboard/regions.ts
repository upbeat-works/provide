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
