import { ChartSchemaError, parseDashboardConfig, type DashboardChartDefinition } from './contracts';

export type DashboardConfigSources = Record<string, unknown>;

export function dashboardConfigPath(hazard: string, sector: string): string {
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugPattern.test(hazard) || !slugPattern.test(sector)) {
    throw new ChartSchemaError('Dashboard hazard and sector must be lowercase slugs');
  }
  return `${hazard}/${sector}.json`;
}

export function loadDashboardConfig(
  sources: DashboardConfigSources,
  hazard: string,
  sector: string,
): DashboardChartDefinition[] {
  const path = dashboardConfigPath(hazard, sector);
  const source = sources[path];
  if (source === undefined) {
    throw new ChartSchemaError(`No dashboard chart config at ${path}`);
  }
  return parseDashboardConfig(source);
}
