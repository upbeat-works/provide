import type { ScoreboardVariableReference } from '../views/scoreboard';

export type Option = { uid: string; label: string };
// Interpolated across the map's buckets: two stops for a sequential ramp, three
// or more for a diverging one. Full six-digit hex only; anything else is
// ignored in favour of the default ramp.
export type ColorRamp = string[];
export type RasterMapIndicator = {
  name: string;
  type: 'raster';
  indicator: string;
  reference: string;
  time: string;
  spatial: string;
  unit?: string;
  colorRamp?: ColorRamp;
};
export type MapIndicator =
  | { name: string; variable: string; type: 'choropleth'; level: 'NUTS1' | 'NUTS2'; colorRamp?: ColorRamp; aggregate?: 'sum' }
  | RasterMapIndicator;
export type ChartSeries = Array<Record<string, ScoreboardVariableReference>>;
export type ChartData = {
  variables: string[];
  model?: string;
  unitFallback?: string;
  // Names the role used for percentile bands across the visible points.
  riskFrom?: 'x' | 'y' | 'size';
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
  // Roll the chart's sub-regions up into their countries when the whole of
  // Europe is selected. Only 'sum', and only for extensive quantities — a mean
  // or a rate summed this way is nonsense that still renders, which is why it
  // is declared per chart rather than inferred.
  aggregate?: 'sum';
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
