import type { ScoreboardVariableReference } from '../views/scoreboard';

export type Option = { uid: string; label: string };
export type MapIndicator =
  | { name: string; variable: string; type: 'choropleth'; level: 'NUTS1' | 'NUTS2' }
  | { name: string; type: 'raster' };
export type Definition = {
  chartId: string;
  chartType: string;
  data: { series: Array<Record<string, ScoreboardVariableReference>>; groupBy?: string; regions?: string[] };
  [key: string]: unknown;
};
export type Selection = { scenario: string; region: string; year: number };
export const option = (uid: string): Option => ({ uid, label: uid });
export const referenceKey = ({ variable, model, unit }: ScoreboardVariableReference) => JSON.stringify([variable, model, unit]);
export const uniqueSorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
