import type { ScoreboardVariableReference } from '../views/scoreboard';

export type Option = { uid: string; label: string };
export type RasterMapIndicator = {
  name: string;
  type: 'raster';
  indicator: string;
  reference: string;
  time: string;
  spatial: string;
  unit?: string;
};
export type MapIndicator =
  | { name: string; variable: string; type: 'choropleth'; level: 'NUTS1' | 'NUTS2' }
  | RasterMapIndicator;
export type ChartSeries = Array<Record<string, ScoreboardVariableReference>>;
export type ChartData = {
  variables: string[];
  unitFallback?: string;
  bars?: string[];
  stacks?: string[];
  stackMode?: 'percent';
  line?: string;
  rangeLow?: string;
  rangeHigh?: string;
  x?: string;
  y?: string;
  size?: string;
  groupBy?: string;
  regions?: string[];
  regionLevel?: 'NUTS1' | 'NUTS2';
};
export type BarVariables = ChartData & { bars: string[]; stacks: string[] };
export type Definition = {
  chartId: string;
  chartType: string;
  data: ChartData;
  [key: string]: unknown;
};
export type Selection = { scenario: string; region: string; year: number };
export const option = (uid: string): Option => ({ uid, label: uid });
export const referenceKey = ({ variable, unit }: ScoreboardVariableReference) => JSON.stringify([variable, unit]);
export const uniqueSorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
