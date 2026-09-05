export { default as ChartRenderer } from './ChartRenderer.svelte';
export { default as DashboardChart } from './DashboardChart.svelte';
export { dashboardConfigPath, loadDashboardConfig } from './config';
export type { DashboardConfigSources } from './config';
export { ChartSchemaError, parseChartContract, parseDashboardConfig } from './contracts';
export type {
  AxisSchema,
  BarMarkSchema,
  CartesianSchema,
  ChartCell,
  ChartContract,
  ChartMeta,
  ChartType,
  DashboardChartDefinition,
  DataTable,
  FieldSchema,
  LineMarkSchema,
  MarkSchema,
  PointMarkSchema,
  TableSchema,
} from './contracts';
