import bbox from '@turf/bbox';

// Countries are drawn from Mapbox's `country-boundaries-v1` tileset rather than
// from our own geo-shape geojson: those shapes are simplified hard enough that
// coastlines and borders go blocky next to the basemap under them, while the
// tileset is vector tiles at the basemap's own resolution. The join is on its
// alpha-3 code, which is the scoreboard's geo id.
export const COUNTRY_CODE_PROPERTY = 'iso_3166_1_alpha_3';
export const COUNTRY_CODE = ['get', COUNTRY_CODE_PROPERTY];

// One country per feature. Without this every disputed border ships a variant
// per worldview and they stack on top of each other.
export const WORLDVIEW_FILTER = ['any', ['==', ['get', 'worldview'], 'all'], ['in', 'US', ['get', 'worldview']]];

// The tileset does not always key a country the way our geo ids do.
const CODE_ALIASES = {
  KOS: ['KOS', 'XKX'], // Kosovo has no ISO-assigned alpha-3; both spellings appear
};

const codesFor = (uid) => CODE_ALIASES[uid] ?? [uid];

// The tiles carry no geometry we can measure, so framing a country needs the
// geo-shape outlines. Returns [minLng, minLat, maxLng, maxLat], or undefined
// when the shapes have no such country.
export function countryBounds(shape, uid) {
  const codes = codesFor(uid);
  const feature = (shape?.features ?? []).find((f) => codes.includes(f.properties?.uid));
  return feature ? bbox(feature) : undefined;
}

// The class a value falls in: the last one whose `min` it reaches.
export function classOf(value, classes = []) {
  if (!Number.isFinite(value)) return undefined;
  return classes.reduce((match, klass) => (value >= klass.min ? klass : match), undefined);
}

export const colorFor = (value, classes) => classOf(value, classes)?.color;

const NUMERIC_COLORS = ['#fff2cc', '#f9d67a', '#ee9f3f', '#d75b2a', '#9f2727'];
const formatNumber = (value) => new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value);

export function numericClasses(values = [], unit = undefined) {
  const finite = values.map(({ value }) => value).filter(Number.isFinite);
  if (!finite.length) return [];
  const minimum = Math.min(...finite);
  const maximum = Math.max(...finite);
  const suffix = unit ? ` ${unit}` : '';
  if (minimum === maximum) return [{ min: minimum, label: `${formatNumber(minimum)}${suffix}`, color: NUMERIC_COLORS[2] }];
  const step = (maximum - minimum) / NUMERIC_COLORS.length;
  return NUMERIC_COLORS.map((color, index) => {
    const start = minimum + step * index;
    const end = index === NUMERIC_COLORS.length - 1 ? maximum : minimum + step * (index + 1);
    return { min: start, label: `${formatNumber(start)}–${formatNumber(end)}${suffix}`, color };
  });
}

const MAP_BOUNDS = {
  admin0: [-25, 34, 45, 72],
  r9: [-180, -60, 180, 85],
};

export const boundsForGeography = (geographyType) => MAP_BOUNDS[geographyType] ?? MAP_BOUNDS.admin0;

export const R9_REGION_PROPERTY = 'I_REGION';
export const R9_REGION = ['get', R9_REGION_PROPERTY];

export function r9FillColor(values = [], classes = []) {
  const cases = values.flatMap((entry) => {
    const color = colorFor(entry.value, classes);
    return color ? [entry.uid, color] : [];
  });
  return cases.length ? ['match', R9_REGION, ...cases, 'transparent'] : 'transparent';
}

export function r9Filter(values = [], classes = []) {
  const uids = values.flatMap((entry) => (colorFor(entry.value, classes) ? [entry.uid] : []));
  return ['in', R9_REGION, ['literal', uids]];
}

// `values` is `[{ uid, value }]` keyed on the geo id (`ITA`). Anything it has no
// value for falls through to the default and stays transparent — outside the
// scoreboard's coverage reads better as plain basemap than as a null class.
export function countryFillColor(values = [], classes = []) {
  const cases = values.flatMap((entry) => {
    const color = colorFor(entry.value, classes);
    return color ? [codesFor(entry.uid), color] : [];
  });
  return cases.length ? ['match', COUNTRY_CODE, ...cases, 'transparent'] : 'transparent';
}

// The reverse of `codesFor`: the geo id behind a code the tileset put on a
// clicked feature. Only the countries offered are searched, so a click on
// something the scoreboard has no value for resolves to nothing rather than to
// a country the view cannot open.
export function uidForCode(code, uids = []) {
  return uids.find((uid) => codesFor(uid).includes(code));
}

// A layer filter matching exactly the given countries (by geo id), one feature
// each. An empty list matches nothing, which is how a layer is switched off.
export function countryFilter(uids = []) {
  return ['all', WORLDVIEW_FILTER, ['in', COUNTRY_CODE, ['literal', uids.flatMap(codesFor)]]];
}

// Borders are drawn for the scored countries only, so the choropleth reads as
// one shape rather than as a world political map.
export function scoredCountryFilter(values = [], classes = []) {
  return countryFilter(values.flatMap((entry) => (colorFor(entry.value, classes) ? [entry.uid] : [])));
}

// The legend's ramp and its tick labels, drawn low to high unless the panel
// reads the other way round (the ranking legend leads with High, to match the
// leaderboard under it).
export function legendOf(classes = [], { highestFirst = false } = {}) {
  const ordered = highestFirst ? [...classes].reverse() : classes;
  return {
    scale: ordered.map(({ color }) => color),
    labels: ordered.map(({ label }) => label),
  };
}
