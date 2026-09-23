import colorTokens from '$styles/color-tokens-light.json';
import { parseVariable } from '../../../../../../../api/conventions.ts';

// The palette explore's charts use: `$THEME.color.category` is this token file's
// `category` (see ThemeProvider), so importing it here puts both views' charts
// on one set of hues rather than a second, private list.
const CATEGORY = colorTokens.category;
const CATEGORY_COUNT = Object.keys(CATEGORY.base).length;

// One hue per series, in order — the same rule colorScenarios applies in explore.
const seriesColor = (index) => CATEGORY.base[index % CATEGORY_COUNT];

// A stack's segments are cumulative bands of one quantity rather than unrelated
// series, so they step through the theme's blue ramp light-to-dark instead of
// taking several hues. Read off the tokens rather than written out, so the two
// cannot drift; sampled evenly, so any number of segments spans the ramp.
const STACK_RAMP = ['100', '200', '300', '400', '500', '600', '700', '800'].map((step) => colorTokens.theme[step]);
const stackColor = (index, count) => STACK_RAMP[count < 2 ? STACK_RAMP.length - 1 : Math.round((index * (STACK_RAMP.length - 1)) / (count - 1))];

const variableLabel = (reference) => {
  const label = reference?.label?.trim();
  if (label) return label;
  const variable = reference?.variable;
  if (!variable) return 'Value';
  const parsed = parseVariable(variable);
  if (parsed.kind === 'faceted') return parsed.indicator;
  return variable.split('|').at(-1)?.trim() || 'Value';
};
const seriesDefinitions = (definition) => definition.data?.series;
const roleReference = (definition, role) => seriesDefinitions(definition)?.find((entry) => entry[role])?.[role];
const axisLabel = (reference) => {
  const label = variableLabel(reference);
  return reference?.unit ? `${label} (${reference.unit})` : label;
};

function infoFor(definition) {
  const references = seriesDefinitions(definition).flatMap((entry) => Object.values(entry));
  const models = [...new Set(references.map(({ model }) => model).filter(Boolean))];
  const units = [...new Set(references.map(({ unit }) => unit).filter(Boolean))];
  const info = [];
  if (models.length) info.push({ label: 'Model', value: models.join(', ') });
  if (units.length) info.push({ label: 'Unit', value: units.join(', ') });
  return info;
}

function unitsFor(definition) {
  return [
    ...new Set(
      seriesDefinitions(definition)
        .flatMap((entry) => Object.values(entry))
        .map(({ unit }) => unit)
        .filter(Boolean)
    ),
  ];
}

function bubbleUnitsMatch(definition) {
  return ['x', 'y', 'size'].every((role) => new Set(seriesDefinitions(definition).map((entry) => entry[role]?.unit)).size <= 1);
}

const hasFiniteLineValue = (data) => data.some(({ line = [] }) => line.some(({ value }) => Number.isFinite(value)));
const hasCompleteBubble = (data) => data.some(({ x, y, size }) => Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(size) && size > 0);

// Joining by year also lets future validation reject mismatched ranges at this boundary.
const rangeByYear = (points = []) => new Map(points.map(({ year, value }) => [year, value]));

export function splitLineAtGaps(entry) {
  const groups = [];
  for (const point of entry.values ?? []) {
    if (!Number.isFinite(point.value)) {
      if (groups.at(-1)?.length) groups.push([]);
      continue;
    }
    if (!groups.length) groups.push([]);
    groups.at(-1).push(point);
  }
  return groups.filter(({ length }) => length).map((values, index) => ({ ...entry, uid: `${entry.uid}-${index}`, values }));
}

function lineProps(definition, data) {
  const series = seriesDefinitions(definition).map((entry, index) => {
    const values = data[index]?.line ?? [];
    const lows = rangeByYear(data[index]?.rangeLow);
    const highs = rangeByYear(data[index]?.rangeHigh);
    return {
      uid: String(index),
      label: variableLabel(entry.line),
      color: seriesColor(index),
      values: values.map(({ year, value }) => {
        const point = { year, value };
        const min = lows.get(year);
        const max = highs.get(year);
        if (Number.isFinite(min)) point.min = min;
        if (Number.isFinite(max)) point.max = max;
        return point;
      }),
    };
  });
  const domainValues = series.flatMap(({ values }) => values.flatMap(({ value, min, max }) => [value, min, max]));
  const unit = roleReference(definition, 'line')?.unit;
  return { series, yLabel: unit, unit, yDomain: paddedDomain(domainValues, 0.06, 0.06) };
}

function stackedRow(region, data, layers) {
  let total = 0;
  const values = data.map((entry, index) => {
    const value = entry?.segment;
    const start = total;
    total += value;
    return { ...layers[index], name: layers[index].label, value, start, end: total };
  });
  return { uid: region?.uid ?? 'selection', label: region?.label ?? 'Selected region', total, values };
}

// Height sets the band step, and the step sets both the bar and the gap between
// rows — so a shorter chart thins the bars and closes the spacing together,
// which paddingInner alone cannot do (it trades one against the other).
function barHeight(rows) {
  if (rows.length <= 5) return 'h-[300px]';
  if (rows.length <= 10) return 'h-[420px]';
  return 'h-[560px]';
}

function groupFor(entry, groupBy) {
  if (groupBy === 'region') return entry.region;
  if (groupBy === 'scenario') return entry.scenario;
  return undefined;
}

const isGrouped = (groupBy) => groupBy === 'region' || groupBy === 'scenario';

function stackedBarProps(definition, data, selection) {
  const definitions = seriesDefinitions(definition);
  const layers = definitions.map((entry, index) => ({ uid: String(index), label: variableLabel(entry.segment), color: stackColor(index, definitions.length) }));
  let rows;
  const groupBy = definition.data.groupBy;
  if (isGrouped(groupBy)) {
    rows = data
      .filter(({ series }) => Array.isArray(series) && series.length === definitions.length && series.every(({ segment }) => Number.isFinite(segment)))
      .map((entry) => stackedRow(groupFor(entry, groupBy), entry.series, layers));
  } else {
    rows = [stackedRow(selection?.region, data, layers)];
  }
  const unit = roleReference(definition, 'segment')?.unit;
  return {
    rows,
    layers,
    xLabel: unit,
    unit,
    unitLabel: unit,
    height: barHeight(rows),
  };
}

function bubbleProps(definition, data) {
  const x = roleReference(definition, 'x');
  const y = roleReference(definition, 'y');
  const size = roleReference(definition, 'size');
  const definitions = seriesDefinitions(definition);
  const pointFor = (entry, values, group, index) => {
    const seriesLabel = variableLabel(entry.x);
    let label = seriesLabel;
    let uid = String(index);
    if (group) {
      label = group.label;
      uid = `${group.uid}-${index}`;
      if (definitions.length > 1) label = `${group.label} — ${seriesLabel}`;
    }
    return {
      uid,
      label,
      x: values?.x ?? null,
      y: values?.y ?? null,
      size: values?.size ?? null,
      // Same ramp the stacked bar uses, so the two charts' legends match.
      color: stackColor(index, definitions.length),
    };
  };
  let points;
  const groupBy = definition.data.groupBy;
  if (isGrouped(groupBy)) {
    points = data.flatMap((group) => definitions.map((entry, index) => pointFor(entry, group.series?.[index], groupFor(group, groupBy), index)));
  } else {
    points = definitions.map((entry, index) => pointFor(entry, data[index], undefined, index));
  }
  return {
    points: points.filter(({ x: xValue, y: yValue, size: sizeValue }) => Number.isFinite(xValue) && Number.isFinite(yValue) && Number.isFinite(sizeValue) && sizeValue > 0),
    // One swatch per series, the way the stacked bar lists its segments — the
    // legend otherwise showed only the dot-size note and never the colours.
    levels: definitions.map((entry, index) => ({ uid: String(index), label: variableLabel(entry.x), color: stackColor(index, definitions.length) })),
    xLabel: axisLabel(x),
    yLabel: axisLabel(y),
    sizeLabel: axisLabel(size),
    xUnit: x?.unit,
    yUnit: y?.unit,
    sizeUnit: size?.unit,
    tooltipLabels: { x: variableLabel(x), y: variableLabel(y), size: variableLabel(size) },
  };
}

export function adaptChartResult(result, selection = {}) {
  const base = { definition: result.definition, status: result.status, error: result.error };
  if (result.status === 'error') return base;
  const { definition, data = [] } = result;
  const definitions = seriesDefinitions(definition);
  if (!Array.isArray(definitions)) return { ...base, status: 'error', error: 'Chart data configuration is invalid.' };
  const groupBy = definition.data.groupBy;
  if (groupBy !== undefined && !isGrouped(groupBy)) return { ...base, status: 'error', error: `Unsupported chart grouping: ${groupBy}` };
  if (isGrouped(groupBy) && definition.chartType !== 'stacked_bar' && definition.chartType !== 'bubble') {
    return { ...base, status: 'error', error: `${groupBy} grouping is not supported for ${definition.chartType}.` };
  }
  if (definition.chartType !== 'bubble' && unitsFor(definition).length > 1) {
    return { ...base, status: 'error', error: 'Chart series must use the same unit.' };
  }
  if (definition.chartType === 'bubble' && !bubbleUnitsMatch(definition)) {
    return { ...base, status: 'error', error: 'Each bubble role must use one unit.' };
  }
  if (result.status === 'empty') return base;
  if ((definition.chartType === 'line' || definition.chartType === 'line_with_range') && !hasFiniteLineValue(data)) {
    return { ...base, status: 'empty' };
  }
  if (definition.chartType === 'bubble' && !isGrouped(groupBy) && !hasCompleteBubble(data)) {
    return { ...base, status: 'empty' };
  }
  if (definition.chartType === 'stacked_bar' && !isGrouped(groupBy) && data.some(({ segment }) => !Number.isFinite(segment))) {
    return { ...base, status: 'empty' };
  }
  const scalarSeries = isGrouped(groupBy) ? data.flatMap(({ series = [] }) => series) : data;
  if (definition.chartType === 'stacked_bar' && scalarSeries.some(({ segment }) => Number.isFinite(segment) && segment < 0)) {
    return { ...base, status: 'error', error: 'Stacked bar segments cannot be negative.' };
  }
  let props;
  if (definition.chartType === 'line' || definition.chartType === 'line_with_range') props = lineProps(definition, data);
  if (definition.chartType === 'stacked_bar') props = stackedBarProps(definition, data, selection);
  if (definition.chartType === 'bubble') props = bubbleProps(definition, data);
  if (!props) return { ...base, status: 'error', error: `Unsupported chart type: ${definition.chartType}` };
  if ((definition.chartType === 'stacked_bar' && !props.rows.length) || (definition.chartType === 'bubble' && !props.points.length)) return { ...base, status: 'empty' };
  return { ...base, kind: definition.chartType, props, info: infoFor(definition) };
}

export const isChartVisible = (result, selection = {}) => adaptChartResult(result, selection).status !== 'empty';

export function radiusForArea(value, maximum, maximumRadius = 30) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.sqrt(value / maximum) * maximumRadius;
}

export function paddedDomain(values, lowerPadding = 0.12, upperPadding = 0.22) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return undefined;
  const minimum = Math.min(...finite);
  const maximum = Math.max(...finite);
  const spread = maximum - minimum || Math.max(Math.abs(minimum) * 0.1, 1);
  return [minimum - spread * lowerPadding, maximum + spread * upperPadding];
}

export function sampledTicks(values, count = 6) {
  if (values.length <= count) return values;
  const lastIndex = values.length - 1;
  return Array.from({ length: count }, (_, index) => values[Math.round((index * lastIndex) / (count - 1))]);
}
