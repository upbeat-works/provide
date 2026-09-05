import { describe, expect, test } from 'bun:test';
import { ChartSchemaError } from './contracts';
import { dashboardConfigPath, loadDashboardConfig } from './config';

const charts = [
  {
    id: 'trend',
    title: 'Trend',
    type: 'line',
    dimensions: ['indicator', 'year'],
  },
];

describe('loadDashboardConfig', () => {
  test('loads and validates the chart array for one hazard and sector', () => {
    const sources = { 'heat-stress/health.json': charts };
    expect(loadDashboardConfig(sources, 'heat-stress', 'health')).toEqual(charts);
  });

  test('fails clearly when no chart array exists for the pair', () => {
    expect(() => loadDashboardConfig({}, 'heat-stress', 'health')).toThrow(
      new ChartSchemaError('No dashboard chart config at heat-stress/health.json'),
    );
  });

  test('uses slugs as the file key', () => {
    expect(dashboardConfigPath('heat-stress', 'health')).toBe('heat-stress/health.json');
  });

  test('rejects path parts that are not slugs', () => {
    expect(() => dashboardConfigPath('../heat-stress', 'health')).toThrow(ChartSchemaError);
    expect(() => dashboardConfigPath('heat-stress', 'Human health')).toThrow(ChartSchemaError);
  });
});
