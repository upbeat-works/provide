import { DEFAULT_FORMAT_UID, UID_NO_UNIT, KEY_LABEL, KEY_LABEL_LONG } from '$src/config';
import { formatDefaultLocale, formatLocale } from 'd3-format';
import { maxBy, uniq } from 'lodash-es';

export const NA_STRING = '—';
export const FORMAT_CURRENCY = '$,.0f';
export const FORMAT_INTEGER = ',.0f';
export const FORMAT_EMISSION = '.0s';
export const FORMAT_FLOAT = ',.1f';
export const FORMAT_YEAR = '.0f';
export const FORMAT_CELSIUS = '.1f';
export const FORMAT_WARMING = '+.2f';
export const FORMAT_PERCENT = '.0%';
export const FORMAT_DEGREE = '.3~f';

export const FORMAT_PERCENT_DECIMALS = (d = 0) => f(`,.${d}%`);
export const FORMAT_DEFAULT_DECIMALS = (d = 1) => f(`,.${d}f`);

export const KEY_DEGREES_CELSIUS = 'degrees-celsius';
export const KEY_DEGREES_WARMING = 'degrees-warming';

// the basic formatting function sued
const f = formatLocale({
  ...formatDefaultLocale,
  decimal: '.',
  currency: ['', ' €'],
  percent: ' %',
  nan: NA_STRING,
  thousands: ',',
  grouping: [3],
}).format;

// functions based on indicator type
const indicatorFormats = {
  integer: f(FORMAT_INTEGER),
  currency: f(FORMAT_CURRENCY),
  float: f(FORMAT_FLOAT),
  percent: f(FORMAT_PERCENT),
  'percent-in-range': f('.0f'),
  year: f(FORMAT_YEAR),
  [KEY_DEGREES_CELSIUS]: f(FORMAT_CELSIUS),
  [KEY_DEGREES_WARMING]: f(FORMAT_WARMING),
  'gigaton-co2eq-year': f(FORMAT_EMISSION),
  degree: f(FORMAT_DEGREE),

  // format for anything else
  default: (value) => adaptiveDefault(value),
};

function adaptiveDefault(value) {
  if (!Number.isFinite(value)) return NA_STRING;
  const magnitude = Math.abs(value);
  if (magnitude === 0) return '0';
  if (magnitude >= 1) return f(FORMAT_INTEGER)(value);
  return f('.3~g')(value);
}

// Scale words carry magnitude, not meaning: ixmp4 reports NUTS2 population in
// "million", so a regional count arrives as 0.00326. Multiplying back into the
// base unit the chart declares puts the axis in numbers a reader recognises.
const SCALE_UNITS = { thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 };

export function rescaleToBaseUnit(value, unit, baseUnit) {
  const factor = SCALE_UNITS[String(unit ?? '').trim().toLowerCase()];
  if (!factor || !baseUnit || !Number.isFinite(value)) return { value, unit };
  return { value: value * factor, unit: baseUnit };
}

export const isScaleUnit = (unit) => Boolean(SCALE_UNITS[String(unit ?? '').trim().toLowerCase()]);

// Axis ticks are the one place where space is tight enough to want SI prefixes:
// 41,844 reads as 42k without crowding its neighbours.
export const formatCompact = (value, unit = DEFAULT_FORMAT_UID) => {
  if (!Number.isFinite(value)) return NA_STRING;
  if (value === 0) return '0';
  const displayValue = unit === 'percent' ? value * 100 : value;
  if (Math.abs(displayValue) >= 10000) return f('.3~s')(displayValue);
  return f(',.12~g')(displayValue);
};

// Display labels per unit id. Consumers (charts, axes, sentence formatting)
// look up unit.label / unit.labelLong from here. ixmp4 instances must use
// one of these unit ids on their timeseries to get correct formatting.
export const unitLabels = {
  [KEY_DEGREES_CELSIUS]: { label: '°C', labelLong: 'degrees Celsius' },
  [KEY_DEGREES_WARMING]: { label: '°C', labelLong: 'degrees Celsius' },
  'gigaton-co2eq-year': { label: 'GtCO₂eq/yr', labelLong: 'Gigaton of CO2 equivalent per year' },
  'days-year': { label: 'd/yr', labelLong: 'Days per Year' },
  'hours-year': { label: 'h/yr', labelLong: 'Hours per Year' },
};

const suffixes = {
  [KEY_DEGREES_CELSIUS]: ' °C',
  [KEY_DEGREES_WARMING]: ' °C',
  degree: ' °',
};

export const formatValue = (value, indicatorId = DEFAULT_FORMAT_UID, { addSuffix = true, formatter: customFormatter = undefined, decimals, matchDecimals = false } = {}) => {
  value = parseFloat(value);
  if (matchDecimals) {
    decimals = getDecimals(value);
  }
  if (typeof decimals !== 'undefined' && typeof customFormatter === 'undefined') {
    customFormatter = getFormatter(indicatorId, decimals);
  }
  const formatter = customFormatter || indicatorFormats[indicatorId] || indicatorFormats['default'];
  const str = formatter(value);
  let suffix = addSuffix ? suffixes[indicatorId] : '';
  // Natural-language units (e.g. "°C", "days/year") aren't in the registry; the
  // unit string is its own suffix.
  if (addSuffix && !suffix && isNaturalLanguageUnit(indicatorId)) {
    suffix = ` ${indicatorId}`;
  }
  return suffix ? str + suffix : str;
};

export const formatPercentPoints = (value) => `${formatValue(value, 'percent-in-range')} %`;

// A unit id that the format registry knows nothing about is treated as a
// natural-language unit — its string is used verbatim as the display suffix.
function isNaturalLanguageUnit(id) {
  return (
    typeof id === 'string' &&
    Boolean(id) &&
    id !== UID_NO_UNIT &&
    !(id in indicatorFormats) &&
    !(id in unitLabels) &&
    !(id in suffixes)
  );
}

function getFormatter(unit, decimals) {
  switch (unit) {
    case 'percent':
      return FORMAT_PERCENT_DECIMALS(decimals);
    default:
      return FORMAT_DEFAULT_DECIMALS(decimals);
  }
}

export function formatRange(range, unit, minDecimals = 0) {
  // This function formats a range of values with all resulting strings to be unique
  const decimalsMax = 4;
  let decimals = minDecimals;
  let formatter = getFormatter(unit, decimals);
  let values = range.map((d) => formatValue(d, unit, { formatter }));
  while (
    values.some((value, index) => values.indexOf(value) !== index) && // Check if values have any dublicates
    decimals < decimalsMax
  ) {
    decimals += 1;
    formatter = getFormatter(unit, decimals);
    values = range.map((d) => formatValue(d, unit, { formatter })); // Reformat values with one more decimal
  }
  return {
    decimals,
    values,
  };
}

export function findDecimalsForDistinctValues(values, unit, minDecimals = 0, maxDecimals = 4) {
  // This function formats a values of values with all resulting strings to be unique
  // First, it filters out all non-numeric values and NaNs. We also don’t want zeros as they would always result in zero. Then, it finds the unique values.
  // The unique list of values help us to only consider numbers that are different from each other before formatting.
  const validValues = uniq(values.filter((v) => typeof v === 'number' && !isNaN(v) && v !== 0));
  const decimalsMax = maxDecimals;
  let decimals = minDecimals;
  let formatter = getFormatter(unit, decimals);
  let strings = validValues.map((d) => formatValue(d, unit, { formatter }));
  while (
    strings.some((value, index) => strings.indexOf(value) !== index) && // Check if strings have any dublicates
    decimals < decimalsMax
  ) {
    decimals += 1;
    formatter = getFormatter(unit, decimals);
    strings = validValues.map((d) => formatValue(d, unit, { formatter })); // Reformat values with one more decimal
  }
  return decimals;
}

function getDecimals(value) {
  if (typeof value !== 'undefined') {
    if (value % 1 != 0) {
      // We need to first parse the value to a float to remove any white spaces or percentage signs
      // Next, we need a string so that we can split it by the decimal point
      // Finally, we need to get the length of the second part of the split string
      // If no decimal point is found, the length is 0
      return parseFloat(value).toString().split('.')?.[1]?.length || 0;
    }
  }
  return 0;
}

export function findMostDecimals(values) {
  return getDecimals(maxBy(values, (v) => getDecimals(v)));
}

export function formatUnit(unit, { inSentence = false, isLabelLong = false } = {}) {
  if (unit?.[KEY_LABEL] && ((unit?.uid !== KEY_DEGREES_CELSIUS && unit?.uid !== KEY_DEGREES_WARMING) || inSentence)) {
    if (unit.uid !== UID_NO_UNIT) {
      const label = isLabelLong || inSentence ? unit[KEY_LABEL_LONG] ?? unit[KEY_LABEL] : unit[KEY_LABEL];
      if (inSentence) {
        return ` in ${label}`;
      }
      return `&#8239;${label}`;
    }
  }
  return '';
}
