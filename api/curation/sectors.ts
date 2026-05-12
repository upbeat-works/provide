import sectorsJson from './sectors.json' assert { type: 'json' };

export interface SectorCuration {
  uid: string;
  label: string;
  icon: string;
  availableGeographies: string[];
  availableScenarios: string[];
}

export const sectors: SectorCuration[] = sectorsJson as SectorCuration[];

export const sectorByUid: Record<string, SectorCuration> = Object.fromEntries(
  sectors.map((s) => [s.uid, s]),
);
