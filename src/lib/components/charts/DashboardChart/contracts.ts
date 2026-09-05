export type ChartType = 'line' | 'bar' | 'scatter' | 'table';

export interface DashboardChartDefinition {
  id: string;
  title: string;
  description?: string;
  type: ChartType;
  dimensions: string[];
}

export type ChartCell = string | number | boolean | null;

export interface DataTable {
  columns: string[];
  values: ChartCell[][];
}

export interface FieldSchema {
  name: string;
  label: string;
  unit?: string;
}

export interface AxisSchema {
  channel: 'x' | 'y';
  field: string;
  scale: 'linear' | 'band';
  domain?: [number, number];
}

interface BaseMarkSchema {
  groups: string[];
}

export interface LineMarkSchema extends BaseMarkSchema {
  type: 'line';
  range?: {
    lower: string;
    upper: string;
  };
}

export interface BarMarkSchema extends BaseMarkSchema {
  type: 'bar';
}

export interface PointMarkSchema extends BaseMarkSchema {
  type: 'point';
  labels: string[];
}

export type MarkSchema = LineMarkSchema | BarMarkSchema | PointMarkSchema;

export interface CartesianSchema {
  layout: 'cartesian';
  fields: FieldSchema[];
  axes: AxisSchema[];
  marks: MarkSchema[];
  palette?: string[];
}

export interface TableSchema {
  layout: 'table';
  fields: FieldSchema[];
  columns: string[];
  rowHeaders: string[];
}

export interface ChartMeta {
  info: Array<{ label: string; value: string }>;
  formats: string[];
}

export interface ChartContract {
  data: DataTable;
  schema: CartesianSchema | TableSchema;
  meta: ChartMeta;
}

export class ChartSchemaError extends Error {}

type UnknownRecord = Record<string, unknown>;

const chartTypes = new Set<ChartType>(['line', 'bar', 'scatter', 'table']);
const chartDefinitionKeys = new Set(['id', 'title', 'description', 'type', 'dimensions']);

function fail(path: string, message: string): never {
  throw new ChartSchemaError(`${path}: ${message}`);
}

function recordAt(input: unknown, path: string): UnknownRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail(path, 'expected an object');
  }
  return input as UnknownRecord;
}

function stringAt(input: unknown, path: string): string {
  if (typeof input !== 'string' || !input.trim()) {
    fail(path, 'expected a non-empty string');
  }
  return input;
}

function stringArrayAt(input: unknown, path: string, options: { minimum?: number } = {}): string[] {
  if (!Array.isArray(input)) {
    fail(path, 'expected an array');
  }
  const values = input.map((value, index) => stringAt(value, `${path}[${index}]`));
  if (values.length < (options.minimum ?? 0)) {
    fail(path, `expected at least ${options.minimum} items`);
  }
  if (new Set(values).size !== values.length) {
    fail(path, 'values must be unique');
  }
  return values;
}

function assertOnlyKeys(value: UnknownRecord, allowed: Set<string>, path: string): void {
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown) {
    fail(path, `unknown field "${unknown}"`);
  }
}

function assertField(field: string, available: Set<string>, path: string): void {
  if (!available.has(field)) {
    fail(path, `field "${field}" is not defined`);
  }
}

export function parseDashboardConfig(input: unknown): DashboardChartDefinition[] {
  if (!Array.isArray(input)) {
    fail('dashboard', 'expected an array');
  }

  const ids = new Set<string>();
  return input.map((item, index) => {
    const path = `dashboard[${index}]`;
    const value = recordAt(item, path);
    assertOnlyKeys(value, chartDefinitionKeys, path);
    const id = stringAt(value.id, `${path}.id`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      fail(`${path}.id`, 'expected a lowercase slug');
    }
    if (ids.has(id)) {
      fail(`${path}.id`, `duplicate chart id "${id}"`);
    }
    ids.add(id);

    const type = stringAt(value.type, `${path}.type`) as ChartType;
    if (!chartTypes.has(type)) {
      fail(`${path}.type`, `unsupported chart type "${type}"`);
    }

    const definition: DashboardChartDefinition = {
      id,
      title: stringAt(value.title, `${path}.title`),
      type,
      dimensions: stringArrayAt(value.dimensions, `${path}.dimensions`, { minimum: 2 }),
    };
    if (value.description !== undefined) {
      if (typeof value.description !== 'string') {
        fail(`${path}.description`, 'expected a string');
      }
      definition.description = value.description;
    }
    return definition;
  });
}

export function parseChartContract(input: unknown): ChartContract {
  const root = recordAt(input, 'contract');
  assertOnlyKeys(root, new Set(['data', 'schema', 'meta']), 'contract');
  const data = parseDataTable(root.data);
  const schema = parseChartSchema(root.schema, new Set(data.columns));
  const meta = parseChartMeta(root.meta);
  validateAxisValues(data, schema);
  validateRangeValues(data, schema);
  return { data, schema, meta };
}

function parseDataTable(input: unknown): DataTable {
  const value = recordAt(input, 'contract.data');
  assertOnlyKeys(value, new Set(['columns', 'values']), 'contract.data');
  const columns = stringArrayAt(value.columns, 'contract.data.columns', { minimum: 1 });
  if (!Array.isArray(value.values)) {
    fail('contract.data.values', 'expected an array');
  }
  const values = value.values.map((row, rowIndex) => {
    if (!Array.isArray(row)) {
      fail(`contract.data.values[${rowIndex}]`, 'expected an array');
    }
    if (row.length !== columns.length) {
      fail(`contract.data.values[${rowIndex}]`, `expected ${columns.length} cells`);
    }
    return row.map((cell, cellIndex) => {
      if (cell === null || ['string', 'number', 'boolean'].includes(typeof cell)) {
        return cell as ChartCell;
      }
      fail(`contract.data.values[${rowIndex}][${cellIndex}]`, 'unsupported cell value');
    });
  });
  return { columns, values };
}

function parseFields(input: unknown, columns: Set<string>): FieldSchema[] {
  if (!Array.isArray(input) || input.length === 0) {
    fail('contract.schema.fields', 'expected a non-empty array');
  }
  const seen = new Set<string>();
  return input.map((item, index) => {
    const path = `contract.schema.fields[${index}]`;
    const value = recordAt(item, path);
    assertOnlyKeys(value, new Set(['name', 'label', 'unit']), path);
    const name = stringAt(value.name, `${path}.name`);
    assertField(name, columns, `${path}.name`);
    if (seen.has(name)) {
      fail(`${path}.name`, `duplicate field "${name}"`);
    }
    seen.add(name);
    const field: FieldSchema = {
      name,
      label: stringAt(value.label, `${path}.label`),
    };
    if (value.unit !== undefined) {
      field.unit = stringAt(value.unit, `${path}.unit`);
    }
    return field;
  });
}

function parseAxis(input: unknown, index: number, fields: Set<string>): AxisSchema {
  const path = `contract.schema.axes[${index}]`;
  const value = recordAt(input, path);
  assertOnlyKeys(value, new Set(['channel', 'field', 'scale', 'domain']), path);
  const channel = stringAt(value.channel, `${path}.channel`);
  if (channel !== 'x' && channel !== 'y') {
    fail(`${path}.channel`, 'expected "x" or "y"');
  }
  const field = stringAt(value.field, `${path}.field`);
  assertField(field, fields, `${path}.field`);
  const scale = stringAt(value.scale, `${path}.scale`);
  if (scale !== 'linear' && scale !== 'band') {
    fail(`${path}.scale`, 'expected "linear" or "band"');
  }
  const axis: AxisSchema = { channel, field, scale };
  if (value.domain !== undefined) {
    if (!Array.isArray(value.domain) || value.domain.length !== 2) {
      fail(`${path}.domain`, 'expected two numbers');
    }
    const [start, end] = value.domain;
    if (typeof start !== 'number' || typeof end !== 'number' || !Number.isFinite(start) || !Number.isFinite(end)) {
      fail(`${path}.domain`, 'expected two finite numbers');
    }
    axis.domain = [start, end];
  }
  return axis;
}

function parseMark(input: unknown, index: number, fields: Set<string>): MarkSchema {
  const path = `contract.schema.marks[${index}]`;
  const value = recordAt(input, path);
  const type = stringAt(value.type, `${path}.type`);
  const groups = stringArrayAt(value.groups, `${path}.groups`);
  groups.forEach((field, groupIndex) => assertField(field, fields, `${path}.groups[${groupIndex}]`));

  if (type === 'bar') {
    assertOnlyKeys(value, new Set(['type', 'groups']), path);
    return { type, groups };
  }
  if (type === 'point') {
    assertOnlyKeys(value, new Set(['type', 'groups', 'labels']), path);
    const labels = stringArrayAt(value.labels, `${path}.labels`, { minimum: 1 });
    labels.forEach((field, labelIndex) => assertField(field, fields, `${path}.labels[${labelIndex}]`));
    return { type, groups, labels };
  }
  if (type === 'line') {
    assertOnlyKeys(value, new Set(['type', 'groups', 'range']), path);
    const mark: LineMarkSchema = { type, groups };
    if (value.range !== undefined) {
      const rangePath = `${path}.range`;
      const range = recordAt(value.range, rangePath);
      assertOnlyKeys(range, new Set(['lower', 'upper']), rangePath);
      const lower = stringAt(range.lower, `${rangePath}.lower`);
      const upper = stringAt(range.upper, `${rangePath}.upper`);
      assertField(lower, fields, `${rangePath}.lower`);
      assertField(upper, fields, `${rangePath}.upper`);
      mark.range = { lower, upper };
    }
    return mark;
  }
  fail(`${path}.type`, `unsupported mark type "${type}"`);
}

function parseChartSchema(input: unknown, columns: Set<string>): CartesianSchema | TableSchema {
  const value = recordAt(input, 'contract.schema');
  const layout = stringAt(value.layout, 'contract.schema.layout');
  if (layout === 'table') {
    assertOnlyKeys(value, new Set(['layout', 'fields', 'columns', 'rowHeaders']), 'contract.schema');
    const fields = parseFields(value.fields, columns);
    const available = new Set(fields.map(({ name }) => name));
    const tableColumns = stringArrayAt(value.columns, 'contract.schema.columns', { minimum: 1 });
    const rowHeaders = stringArrayAt(value.rowHeaders, 'contract.schema.rowHeaders', { minimum: 1 });
    tableColumns.forEach((field, index) => assertField(field, available, `contract.schema.columns[${index}]`));
    rowHeaders.forEach((field, index) => {
      assertField(field, available, `contract.schema.rowHeaders[${index}]`);
      if (!tableColumns.includes(field)) {
        fail(`contract.schema.rowHeaders[${index}]`, 'row header must be a visible column');
      }
    });
    return { layout, fields, columns: tableColumns, rowHeaders };
  }
  if (layout !== 'cartesian') {
    fail('contract.schema.layout', 'expected "cartesian" or "table"');
  }

  assertOnlyKeys(value, new Set(['layout', 'fields', 'axes', 'marks', 'palette']), 'contract.schema');
  const fields = parseFields(value.fields, columns);
  const available = new Set(fields.map(({ name }) => name));
  if (!Array.isArray(value.axes) || value.axes.length !== 2) {
    fail('contract.schema.axes', 'expected one x and one y axis');
  }
  const axes = value.axes.map((axis, index) => parseAxis(axis, index, available));
  if (axes.filter(({ channel }) => channel === 'x').length !== 1 || axes.filter(({ channel }) => channel === 'y').length !== 1) {
    fail('contract.schema.axes', 'expected one x and one y axis');
  }
  if (!Array.isArray(value.marks) || value.marks.length === 0) {
    fail('contract.schema.marks', 'expected a non-empty array');
  }
  const marks = value.marks.map((mark, index) => parseMark(mark, index, available));
  const palette = value.palette === undefined ? undefined : stringArrayAt(value.palette, 'contract.schema.palette', { minimum: 1 });
  const schema: CartesianSchema = { layout, fields, axes, marks };
  if (palette) {
    schema.palette = palette;
  }
  validateMarkScales(schema);
  return schema;
}

function parseChartMeta(input: unknown): ChartMeta {
  const value = recordAt(input, 'contract.meta');
  assertOnlyKeys(value, new Set(['info', 'formats']), 'contract.meta');
  if (!Array.isArray(value.info)) {
    fail('contract.meta.info', 'expected an array');
  }
  const info = value.info.map((item, index) => {
    const path = `contract.meta.info[${index}]`;
    const entry = recordAt(item, path);
    assertOnlyKeys(entry, new Set(['label', 'value']), path);
    return {
      label: stringAt(entry.label, `${path}.label`),
      value: stringAt(entry.value, `${path}.value`),
    };
  });
  const formats = stringArrayAt(value.formats, 'contract.meta.formats');
  return { info, formats };
}

function validateMarkScales(schema: CartesianSchema): void {
  const xAxis = schema.axes.find(({ channel }) => channel === 'x');
  const yAxis = schema.axes.find(({ channel }) => channel === 'y');
  if (!xAxis || !yAxis) {
    fail('contract.schema.axes', 'expected one x and one y axis');
  }
  for (const mark of schema.marks) {
    if (mark.type === 'bar' && (xAxis.scale !== 'band' || yAxis.scale !== 'linear')) {
      fail('contract.schema.marks', 'bar marks require a band x axis and a linear y axis');
    }
    if (mark.type !== 'bar' && (xAxis.scale !== 'linear' || yAxis.scale !== 'linear')) {
      fail('contract.schema.marks', `${mark.type} marks require linear axes`);
    }
  }
}

function validateAxisValues(data: DataTable, schema: CartesianSchema | TableSchema): void {
  if (schema.layout !== 'cartesian') {
    return;
  }
  for (const axis of schema.axes) {
    if (axis.scale !== 'linear') {
      continue;
    }
    const columnIndex = data.columns.indexOf(axis.field);
    for (let rowIndex = 0; rowIndex < data.values.length; rowIndex += 1) {
      const value = data.values[rowIndex][columnIndex];
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
        fail(`contract.data.values[${rowIndex}][${columnIndex}]`, `field "${axis.field}" must be numeric`);
      }
    }
  }
}

function validateRangeValues(data: DataTable, schema: CartesianSchema | TableSchema): void {
  if (schema.layout !== 'cartesian') {
    return;
  }
  for (const mark of schema.marks) {
    if (mark.type !== 'line' || !mark.range) {
      continue;
    }
    const lowerIndex = data.columns.indexOf(mark.range.lower);
    const upperIndex = data.columns.indexOf(mark.range.upper);
    for (let rowIndex = 0; rowIndex < data.values.length; rowIndex += 1) {
      const lower = data.values[rowIndex][lowerIndex];
      const upper = data.values[rowIndex][upperIndex];
      if (lower !== null && (typeof lower !== 'number' || !Number.isFinite(lower))) {
        fail(`contract.data.values[${rowIndex}][${lowerIndex}]`, `field "${mark.range.lower}" must be numeric`);
      }
      if (upper !== null && (typeof upper !== 'number' || !Number.isFinite(upper))) {
        fail(`contract.data.values[${rowIndex}][${upperIndex}]`, `field "${mark.range.upper}" must be numeric`);
      }
      if (typeof lower === 'number' && typeof upper === 'number' && lower > upper) {
        fail(`contract.data.values[${rowIndex}]`, 'line range lower bound must not exceed its upper bound');
      }
    }
  }
}
