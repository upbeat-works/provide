import { quantileSorted } from 'd3-array';
import colorTokens from '$styles/color-tokens-light.json';
import { parseVariable } from '../../../../../../../api/conventions.ts';
import { barSeriesIndices, chartSeries } from '../../../../../../../api/scoreboard/series.ts';
import { rescaleToBaseUnit } from '$lib/utils/formatting';

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

export const RISK_BANDS = [
  { uid: 'low', label: 'Low risk', color: colorTokens.theme['200'] },
  { uid: 'medium', label: 'Medium risk', color: colorTokens.theme['500'] },
  { uid: 'high', label: 'High risk', color: colorTokens.theme['800'] },
];

export const RISK_ROLES = ['x', 'y', 'size'];

function bandPoints(points, role) {
  const values = points.map((point) => point[role]).filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length) return points;
  const lower = quantileSorted(values, 0.25);
  const upper = quantileSorted(values, 0.75);
  return points.map((point) => {
    const value = point[role];
    if (!Number.isFinite(value)) return point;
    let risk = 'medium';
    if (value < lower) risk = 'low';
    if (value > upper) risk = 'high';
    const { color, ...coordinates } = point;
    return { ...coordinates, risk };
  });
}

const variableLabel = (reference) => {
  const label = reference?.label?.trim();
  if (label) return label;
  const variable = reference?.variable;
  if (!variable) return 'Value';
  const parsed = parseVariable(variable);
  if (parsed.kind === 'faceted') return parsed.indicator;
  return variable.split('|').at(-1)?.trim() || 'Value';
};
const seriesDefinitions = (definition) => definition.series ?? chartSeries(definition.data, definition.chartType);
const roleReference = (definition, role) => seriesDefinitions(definition)?.find((entry) => entry[role])?.[role];
const axisLabel = (reference, unit = reference?.unit) => {
  const label = variableLabel(reference);
  return unit ? `${label} (${unit})` : label;
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

function lineProps(definition, data, colorFor) {
  const definitions = seriesDefinitions(definition);
  const groupBy = definition.data.groupBy;
  const entries = isGrouped(groupBy)
    ? data.flatMap((group) => definitions.map((entry, index) => ({ entry, values: group.series?.[index], group: groupFor(group, groupBy), index })))
    : definitions.map((entry, index) => ({ entry, values: data[index], index }));
  const series = entries.map(({ entry, values: entryValues, group, index }, seriesIndex) => {
    const values = entryValues?.line ?? [];
    const lows = rangeByYear(entryValues?.rangeLow);
    const highs = rangeByYear(entryValues?.rangeHigh);
    let label = variableLabel(entry.line);
    if (group) label = definitions.length === 1 ? group.label : `${group.label} — ${label}`;
    return {
      uid: group ? `${group.uid}-${index}` : String(index),
      label,
      // A grouped chart can be told which colour each group holds, so a
      // country keeps its hue while the picker above the chart adds and removes
      // others. Without that the hue is the series' position, as before.
      color: (group && colorFor?.(group.uid)) ?? seriesColor(seriesIndex),
      values: values.map(({ year, value }) => {
        const point = { year, value };
        const min = lows.get(year);
        const max = highs.get(year);
        if (Number.isFinite(min)) point.min = min;
        if (Number.isFinite(max)) point.max = max;
        return point;
      }),
    };
  }).filter(({ values }) => values.some(({ value }) => Number.isFinite(value)));
  const domainValues = series.flatMap(({ values }) => values.flatMap(({ value, min, max }) => [value, min, max]));
  const unit = roleReference(definition, 'line')?.unit;
  return { series, yLabel: unit, unit, yDomain: paddedDomain(domainValues, 0.06, 0.06) };
}

function stackedRow(region, data, layers) {
  let total = 0;
  const values = data.flatMap((entry, index) => {
    const value = entry?.segment;
    if (!Number.isFinite(value)) return [];
    const start = total;
    total += value;
    return [{ ...layers[index], name: layers[index].label, value, start, end: total }];
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
  const labels = definition.data.stacks ?? definitions.map((entry) => variableLabel(entry.segment));
  const layers = labels.map((label, index) => ({ uid: String(index), label, color: stackColor(index, labels.length) }));
  let rows;
  const groupBy = definition.data.groupBy;
  if (isGrouped(groupBy)) {
    rows = data
      .filter(({ series }) => Array.isArray(series) && series.length === definitions.length && series.some(({ segment }) => Number.isFinite(segment)))
      .flatMap((entry) => {
        const group = groupFor(entry, groupBy);
        if (!definition.data.bars) return [stackedRow(group, entry.series, layers)];
        return barSeriesIndices(definition.data).map((indices, index) => {
          const name = definition.data.bars[index];
          return stackedRow({ uid: `${group.uid}-${name}`, label: `${group.label} — ${name}` }, indices.map((index) => entry.series[index]), layers);
        });
      });
  } else if (definition.data.bars) {
    rows = barSeriesIndices(definition.data).map((indices, index) => {
      const name = definition.data.bars[index];
      return stackedRow({ uid: name, label: name }, indices.map((index) => data[index]), layers);
    });
  } else {
    rows = [stackedRow(selection?.region, data, layers)];
  }
  let unit = roleReference(definition, 'segment')?.unit;
  if (definition.data.stackMode === 'percent') {
    rows = rows.map((row) => {
      if (row.total === 0) return { ...row, values: [] };
      return {
        ...row,
        total: 100,
        values: row.values.map((segment) => ({
          ...segment,
          value: segment.value / row.total * 100,
          start: segment.start / row.total * 100,
          end: segment.end / row.total * 100,
        })),
      };
    });
    unit = '%';
  }
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
  const scatter = definition.chartType === 'scatter';
  const x = roleReference(definition, 'x');
  const y = roleReference(definition, 'y');
  const size = roleReference(definition, 'size');
  const definitions = seriesDefinitions(definition);
  // A role reported in a scale word ("million") is converted into the base unit
  // the definition declares via unitFallback, so the axis shows 3,262 people
  // rather than 0.00326 million.
  const scaleOf = (role) => (value) => rescaleToBaseUnit(value, role?.unit, role?.unitFallback);
  const scaleX = scaleOf(x);
  const scaleY = scaleOf(y);
  const scaleSize = scaleOf(size);
  const displayUnit = (role) => scaleOf(role)(1).unit ?? role?.unit;
  const riskFrom = RISK_ROLES.includes(definition.data.riskFrom) ? definition.data.riskFrom : undefined;
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
      x: Number.isFinite(values?.x) ? scaleX(values.x).value : (values?.x ?? null),
      y: Number.isFinite(values?.y) ? scaleY(values.y).value : (values?.y ?? null),
      size: Number.isFinite(values?.size) ? scaleSize(values.size).value : (values?.size ?? null),
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
  points = points.filter(({ x: xValue, y: yValue, size: sizeValue }) => Number.isFinite(xValue) && Number.isFinite(yValue) && (scatter || (Number.isFinite(sizeValue) && sizeValue > 0)));
  if (riskFrom) points = bandPoints(points, riskFrom);
  return {
    points,
    pointMode: definition.chartType,
    levels: riskFrom
      ? RISK_BANDS.map(({ uid, label, color }) => ({ uid, label, color }))
      : definitions.map((entry, index) => ({ uid: String(index), label: variableLabel(entry.x), color: stackColor(index, definitions.length) })),
    xLabel: axisLabel(x, displayUnit(x)),
    yLabel: axisLabel(y, displayUnit(y)),
    sizeLabel: scatter ? undefined : axisLabel(size, displayUnit(size)),
    xUnit: displayUnit(x),
    yUnit: displayUnit(y),
    sizeUnit: displayUnit(size),
    tooltipLabels: { x: variableLabel(x), y: variableLabel(y), size: variableLabel(size) },
  };
}

export function adaptChartResult(result, selection = {}, { colorFor } = {}) {
  const base = { definition: result.definition, status: result.status, error: result.error };
  if (result.status === 'error') return base;
  const { data = [] } = result;
  const definition = { ...result.definition, series: result.series };
  let definitions;
  try {
    definitions = seriesDefinitions(definition);
  } catch (error) {
    return { ...base, status: 'error', error: error.message };
  }
  if (!Array.isArray(definitions)) return { ...base, status: 'error', error: 'Chart data configuration is invalid.' };
  const groupBy = definition.data.groupBy;
  if (definition.data.bars) {
    if (definition.chartType !== 'stacked_bar' || (groupBy !== undefined && groupBy !== 'region')) return { ...base, status: 'error', error: 'Named bars and stacks require a stacked bar chart grouped by region or ungrouped.' };
    try {
      barSeriesIndices(definition.data);
    } catch (error) {
      return { ...base, status: 'error', error: error.message };
    }
  }
  if (groupBy !== undefined && !isGrouped(groupBy)) return { ...base, status: 'error', error: `Unsupported chart grouping: ${groupBy}` };
  const pointChart = definition.chartType === 'bubble' || definition.chartType === 'scatter';
  if (isGrouped(groupBy) && definition.chartType !== 'stacked_bar' && !pointChart && !(groupBy === 'region' && ['line', 'line_with_range'].includes(definition.chartType))) {
    return { ...base, status: 'error', error: `${groupBy} grouping is not supported for ${definition.chartType}.` };
  }
  if (!pointChart && unitsFor(definition).length > 1) {
    return { ...base, status: 'error', error: 'Chart series must use the same unit.' };
  }
  if (pointChart && !bubbleUnitsMatch(definition)) {
    return { ...base, status: 'error', error: 'Each bubble role must use one unit.' };
  }
  if (result.status === 'empty') return base;
  if ((definition.chartType === 'line' || definition.chartType === 'line_with_range') && !hasFiniteLineValue(isGrouped(groupBy) ? data.flatMap(({ series = [] }) => series) : data)) {
    return { ...base, status: 'empty' };
  }
  if (definition.chartType === 'bubble' && !isGrouped(groupBy) && !hasCompleteBubble(data)) {
    return { ...base, status: 'empty' };
  }
  const scalarSeries = isGrouped(groupBy) ? data.flatMap(({ series = [] }) => series) : data;
  if (definition.chartType === 'stacked_bar' && scalarSeries.some(({ segment }) => Number.isFinite(segment) && segment < 0)) {
    return { ...base, status: 'error', error: 'Stacked bar segments cannot be negative.' };
  }
  let props;
  if (definition.chartType === 'line' || definition.chartType === 'line_with_range') props = lineProps(definition, data, colorFor);
  if (definition.chartType === 'stacked_bar') props = stackedBarProps(definition, data, selection);
  if (pointChart) props = bubbleProps(definition, data);
  if (!props) return { ...base, status: 'error', error: `Unsupported chart type: ${definition.chartType}` };
  if ((definition.chartType === 'stacked_bar' && !props.rows.some(({ values }) => values.length)) || (pointChart && !props.points.length)) return { ...base, status: 'empty' };
  const selectedYear = Number(selection?.year?.uid ?? selection?.year);
  if (Number.isFinite(selectedYear) && selectedYear > 0) props.selectedYear = selectedYear;
  return { ...base, kind: definition.chartType, props, info: infoFor(definition) };
}

export const isChartVisible = (result, selection = {}) => adaptChartResult(result, selection).status !== 'empty';

// Area, not radius, carries the value: a bubble twice the area reads as twice
// the quantity, which taking the square root of the ratio is what gives.
// A floor keeps a small-but-present value visible — scaled strictly, a value a
// few hundredths of the largest lands under a pixel and reads as missing data
// rather than as a small number. Zero and absent values still draw nothing, so
// the floor never invents a bubble where there is no quantity.
export function radiusForArea(value, maximum, maximumRadius = 30, minimumRadius = 3) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.max(minimumRadius, Math.sqrt(value / maximum) * maximumRadius);
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
