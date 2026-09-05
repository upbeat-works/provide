import type {
  AxisSchema,
  ChartCell,
  ChartContract,
  FieldSchema,
  LineMarkSchema,
  MarkSchema,
  TableSchema,
} from './contracts';
import { NA_STRING, formatValue } from '../../../utils/formatting.js';

export type ChartRecord = Record<string, ChartCell>;

export interface ChartGroup {
  key: string;
  label: string;
  color: string;
  records: ChartRecord[];
}

export interface MarkModel {
  schema: MarkSchema;
  groups: ChartGroup[];
}

export interface CartesianModel {
  layout: 'cartesian';
  fields: Map<string, FieldSchema>;
  xAxis: AxisSchema;
  yAxis: AxisSchema;
  xDomain: [number, number] | ChartCell[];
  yDomain: [number, number];
  marks: MarkModel[];
  legend: Array<{ uid: string; label: string; color: string }>;
}

export interface TableModel {
  layout: 'table';
  fields: Map<string, FieldSchema>;
  schema: TableSchema;
  records: ChartRecord[];
}

export type ChartModel = CartesianModel | TableModel;

export function recordsFromTable(contract: ChartContract): ChartRecord[] {
  return contract.data.values.map((values) =>
    Object.fromEntries(contract.data.columns.map((column, index) => [column, values[index]])),
  );
}

export function buildChartModel(contract: ChartContract, defaultPalette: string[]): ChartModel {
  const records = recordsFromTable(contract);
  const fields = new Map(contract.schema.fields.map((field) => [field.name, field]));
  if (contract.schema.layout === 'table') {
    return {
      layout: 'table',
      fields,
      schema: contract.schema,
      records,
    };
  }

  const xAxis = contract.schema.axes.find(({ channel }) => channel === 'x');
  const yAxis = contract.schema.axes.find(({ channel }) => channel === 'y');
  if (!xAxis || !yAxis) {
    throw new Error('A cartesian chart needs one x and one y axis.');
  }

  const palette = contract.schema.palette ?? defaultPalette;
  const colors = palette.length ? palette : ['currentColor'];
  const colorByKey = new Map<string, string>();
  const colorFor = (key: string): string => {
    const known = colorByKey.get(key);
    if (known) {
      return known;
    }
    const color = colors[colorByKey.size % colors.length];
    colorByKey.set(key, color);
    return color;
  };

  const marks = contract.schema.marks.map((schema) => ({
    schema,
    groups: groupsForMark(records, schema, xAxis, yAxis, colorFor),
  }));
  const visibleRecords = [...new Set(marks.flatMap(({ groups }) => groups.flatMap(({ records }) => records)))];

  const legendByKey = new Map<string, { uid: string; label: string; color: string }>();
  for (const mark of marks) {
    if (!mark.schema.groups.length) {
      continue;
    }
    for (const group of mark.groups) {
      if (!legendByKey.has(group.key)) {
        legendByKey.set(group.key, { uid: group.key, label: group.label, color: group.color });
      }
    }
  }

  return {
    layout: 'cartesian',
    fields,
    xAxis,
    yAxis,
    xDomain: domainForAxis(visibleRecords, xAxis, marks),
    yDomain: domainForAxis(visibleRecords, yAxis, marks),
    marks,
    legend: [...legendByKey.values()],
  };
}

export function formatRecordValue(record: ChartRecord, field: FieldSchema): string {
  const value = record[field.name];
  if (value === null || value === undefined) {
    return NA_STRING;
  }
  if (typeof value === 'number') {
    return formatValue(value, field.unit);
  }
  return String(value);
}

export function lineRangeFields(mark: LineMarkSchema): string[] {
  if (!mark.range) {
    return [];
  }
  return [mark.range.lower, mark.range.upper];
}

function groupsForMark(
  records: ChartRecord[],
  mark: MarkSchema,
  xAxis: AxisSchema,
  yAxis: AxisSchema,
  colorFor: (key: string) => string,
): ChartGroup[] {
  const groups = new Map<string, ChartGroup>();
  for (const record of records) {
    if (!recordFitsMark(record, mark, xAxis, yAxis)) {
      continue;
    }
    const parts = mark.groups.map((field) => [field, record[field]]);
    const key = JSON.stringify(parts);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label: parts.map(([, value]) => String(value ?? NA_STRING)).join(' · '),
        color: colorFor(key),
        records: [],
      };
      groups.set(key, group);
    }
    group.records.push(record);
  }

  const result = [...groups.values()];
  if (mark.type === 'line') {
    for (const group of result) {
      group.records.sort((a, b) => Number(a[xAxis.field]) - Number(b[xAxis.field]));
    }
  }
  return result;
}

function recordFitsMark(record: ChartRecord, mark: MarkSchema, xAxis: AxisSchema, yAxis: AxisSchema): boolean {
  const x = record[xAxis.field];
  const y = record[yAxis.field];
  if (mark.type === 'line') {
    return typeof x === 'number' && Number.isFinite(x) && (y === null || (typeof y === 'number' && Number.isFinite(y)));
  }
  if (mark.type === 'bar') {
    const validCategory = typeof x === 'string' || (typeof x === 'number' && Number.isFinite(x));
    return validCategory && typeof y === 'number' && Number.isFinite(y);
  }
  return typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y);
}

function domainForAxis(records: ChartRecord[], axis: AxisSchema, marks: MarkModel[]): [number, number] | ChartCell[] {
  if (axis.domain) {
    return axis.domain;
  }
  if (axis.scale === 'band') {
    const values: ChartCell[] = [];
    for (const record of records) {
      const value = record[axis.field];
      if (value !== null && !values.includes(value)) {
        values.push(value);
      }
    }
    return values;
  }

  const values = numericValues(records, axis.field);
  const isY = axis.channel === 'y';
  if (isY) {
    for (const mark of marks) {
      if (mark.schema.type !== 'line') {
        continue;
      }
      for (const rangeField of lineRangeFields(mark.schema)) {
        values.push(...numericValues(records, rangeField));
      }
    }
  }
  const includeZero = isY && marks.some(({ schema }) => schema.type === 'bar');
  return numericDomain(values, { baseline: includeZero ? 'zero' : 'extent' });
}

function numericValues(records: ChartRecord[], field: string): number[] {
  return records
    .map((record) => record[field])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

function numericDomain(values: number[], options: { baseline: 'zero' | 'extent' }): [number, number] {
  if (!values.length) {
    return [0, 1];
  }
  let minimum = Math.min(...values);
  let maximum = Math.max(...values);
  if (options.baseline === 'zero') {
    minimum = Math.min(0, minimum);
    maximum = Math.max(0, maximum);
  }
  if (minimum === maximum) {
    if (minimum === 0) {
      return [0, 1];
    }
    const padding = Math.abs(minimum) * 0.1;
    return [minimum - padding, maximum + padding];
  }
  return [minimum, maximum];
}
