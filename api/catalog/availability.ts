import type { Platform } from '@iiasa/ixmp4-ts';
import { parseVariable } from '../conventions';

export type IndicatorVariableGroup = {
  id: string;
  names: string[];
  percentileNames: string[];
};

export function groupIndicatorVariableNames(names: string[]): IndicatorVariableGroup[] {
  const groups = new Map<string, IndicatorVariableGroup>();
  for (const name of names) {
    const variable = parseVariable(name);
    if (variable.kind !== 'faceted' || !variable.indicator) continue;
    const group = groups.get(variable.indicator) ?? {
      id: variable.indicator,
      names: [],
      percentileNames: [],
    };
    group.names.push(name);
    if (variable.value?.kind === 'percentile') group.percentileNames.push(name);
    groups.set(variable.indicator, group);
  }
  return [...groups.values()];
}

export function indicatorIdsFromVariableNames(names: string[]): string[] {
  return groupIndicatorVariableNames(names).map(({ id }) => id);
}

export async function geographyIdsForIndicator(platform: Platform, indicator: string, loadedGroups?: IndicatorVariableGroup[]): Promise<string[]> {
  let groups = loadedGroups;
  if (!groups) {
    const variables = await platform.iamc.variables.list({ name_ilike: `${indicator}|*` });
    groups = groupIndicatorVariableNames(variables.map(({ name }) => name));
  }
  const group = groups.find(({ id }) => id === indicator);
  const variableNames = group?.names ?? [];
  if (variableNames.length === 0) return [];

  const regions = await platform.regions.list({
    iamc: { variable: { name_in: variableNames } },
  });
  return [...new Set(regions.map(({ name }) => name))];
}
