import type { Ixmp4Instance } from '../types';
import { instances } from '../instances';

export type IndicatorIndexEntry = {
  id: string;
  label: string;
  unit: string;
  sector?: string;
  instance: string;
};

export type FailedInstance = {
  instance: string;
  code: 'unavailable';
};

export type IndicatorIndexResponse = {
  indicators: IndicatorIndexEntry[];
  failedInstances: FailedInstance[];
};

export type IndicatorFilterGroup = {
  key: string;
  label: string;
  color: string;
  options: Array<{
    value: string;
    count: number;
  }>;
  selected: string[];
};

export type FilteredIndicatorIndexResponse = IndicatorIndexResponse & {
  filters: IndicatorFilterGroup[];
};

export type GeographyAvailabilityResponse = {
  geographyIds: string[];
};

export type IndicatorDetailsResponse = {
  id: string;
  instance: string;
  unit: string;
  parameters: Array<{
    id: string;
    label: string;
    options: Array<{ id: string; label: string }>;
  }>;
  models: string[];
  sources: string[];
  ixmp4Description?: string;
};

export type ScenarioAvailabilityResponse = {
  scenarios: Array<{
    id: string;
    label: string;
    yearStart?: number;
    yearEnd?: number;
  }>;
};

type ScenarioCharacteristics = {
  gmtPeak?: [number, number];
  gmt2100?: number;
  gmt2300?: number;
  coolingRateAfterPeak?: number;
  coolingAfterPeak?: number;
};

export type ScenarioGmtBand = [number | null, number | null, number | null];

export type ScenarioDetailsResponse = {
  id: string;
  label: string;
  instance: string;
  yearStart: number;
  yearStep: number;
  yearEnd: number;
  gmt?: {
    data: ScenarioGmtBand[];
    yearStart: number;
    yearStep: number;
    yearEnd: number;
    model?: string;
    unit?: string;
  };
  characteristics: ScenarioCharacteristics;
};

export type ExploreDefaultsResponse = {
  indicator: { id: string; instance: string };
  geography: string;
  parameters: { reference: string; time: string; spatial: string };
  scenarios: string[];
};

export type RequestError = {
  status: 400 | 404;
  error: string;
};

export function parseRequiredInstance(value: string | undefined): Ixmp4Instance | RequestError {
  if (!value) return { status: 400, error: 'instance is required' };
  const instance = instances.find(({ slug }) => slug === value);
  if (!instance) return { status: 404, error: `Unknown instance: ${value}` };
  return instance;
}

export function validateCanonicalIndicatorId(value: string): RequestError | undefined {
  if (/[*?]/.test(value)) {
    return { status: 400, error: `Invalid indicator id: ${value}` };
  }
  return undefined;
}
