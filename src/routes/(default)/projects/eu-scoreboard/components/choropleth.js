import bbox from '@turf/bbox';

export const COUNTRY_SOURCE = '/data/eu-scoreboard/nuts0_countries.geojson';

export const COUNTRY_CODE_PROPERTY = 'geoId';
export const COUNTRY_CODE = ['get', COUNTRY_CODE_PROPERTY];
export const NUTS_ID_PROPERTY = 'NUTS_ID';
export const NUTS_ID = ['get', NUTS_ID_PROPERTY];

// NUTS covers each member state in full, so France reaches French Guiana and
// Réunion, Spain the Canaries, Portugal the Azores. Their bounding box spans
// half the planet, and framing a map on it puts the reader in the mid-Atlantic
// with Europe a smudge in the corner. Fitting is therefore measured over the
// continental window only; a selection with nothing inside it (were the map
// ever pointed at an outermost region alone) falls back to its true extent.
const CONTINENTAL = { west: -25, south: 34, east: 45, north: 72 };

const withinContinental = ([west, south, east, north]) => west >= CONTINENTAL.west && south >= CONTINENTAL.south && east <= CONTINENTAL.east && north <= CONTINENTAL.north;

// A MultiPolygon's parts are measured one by one so an outermost region is
// dropped without taking the mainland of the same country with it.
function parts(feature) {
  const { type, coordinates } = feature.geometry ?? {};
  if (type !== 'MultiPolygon') return [feature];
  return coordinates.map((polygon) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: polygon } }));
}

const merge = (boxes) => boxes.reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);

export function countriesBounds(shape, uids) {
  const wanted = new Set(uids);
  const features = (shape?.features ?? []).filter(({ properties }) => wanted.has(properties?.[COUNTRY_CODE_PROPERTY]));
  if (!features.length) return undefined;
  const boxes = features.flatMap(parts).map((part) => bbox(part));
  const continental = boxes.filter(withinContinental);
  return merge(continental.length ? continental : boxes);
}

// The class a value falls in: the last one whose `min` it reaches.
export function classOf(value, classes = []) {
  if (!Number.isFinite(value)) return undefined;
  return classes.reduce((match, klass) => (value >= klass.min ? klass : match), undefined);
}

export const colorFor = (value, classes) => classOf(value, classes)?.color;

// The indicator ramp, stated as its two endpoints: every bucket colour is
// interpolated between them, so the number of buckets can change without
// anyone hand-picking colours that drift off the ramp.
const RAMP_FROM = '#FEDB5C';
const RAMP_TO = '#E27B47';
const BUCKET_COUNT = 4;

const channels = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
const toHex = (channel) => Math.round(channel).toString(16).padStart(2, '0');
const mix = (from, to, t) => `#${from.map((channel, index) => toHex(channel + (to[index] - channel) * t)).join('')}`;

const NUMERIC_COLORS = Array.from({ length: BUCKET_COUNT }, (_, index) => mix(channels(RAMP_FROM), channels(RAMP_TO), index / (BUCKET_COUNT - 1)));

const formatNumber = (value) => new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value);

// Equal-width buckets across the range the values actually span, each labelled
// with the range it covers — an indicator map is read for its values, so the
// legend names them rather than ranking them. Numbers only: four labels each
// repeating the unit does not fit the panel, so the panel's subtitle carries it
// once. One value everywhere has no range to divide, so it keeps its own number.
export function numericClasses(values = []) {
  const finite = values.map(({ value }) => value).filter(Number.isFinite);
  if (!finite.length) return [];
  const minimum = Math.min(...finite);
  const maximum = Math.max(...finite);
  if (minimum === maximum) return [{ min: minimum, label: formatNumber(minimum), color: NUMERIC_COLORS[1] }];
  const step = (maximum - minimum) / BUCKET_COUNT;
  return NUMERIC_COLORS.map((color, index) => {
    const start = minimum + step * index;
    const end = index === BUCKET_COUNT - 1 ? maximum : minimum + step * (index + 1);
    return { min: start, label: `${formatNumber(start)}–${formatNumber(end)}`, color };
  });
}

// The ids a set of values actually paints.
export const scoredUids = (values = [], classes = []) => values.flatMap((entry) => (colorFor(entry.value, classes) ? [entry.uid] : []));

export function fillColor(property, values = [], classes = []) {
  const cases = values.flatMap((entry) => {
    const color = colorFor(entry.value, classes);
    return color ? [entry.uid, color] : [];
  });
  return cases.length ? ['match', property, ...cases, 'transparent'] : 'transparent';
}

// A layer filter matching exactly the given ids. An empty list matches nothing,
// which is how a layer is switched off.
export const idFilter = (property, uids = []) => ['in', property, ['literal', uids]];

// Borders are drawn for the scored features only, so the choropleth reads as one
// shape rather than as a political map of the whole region.
export const scoredFilter = (property, values = [], classes = []) => idFilter(property, scoredUids(values, classes));

export const countryFillColor = (values, classes) => fillColor(COUNTRY_CODE, values, classes);
export const countryFilter = (uids) => idFilter(COUNTRY_CODE, uids);
export const scoredCountryFilter = (values, classes) => scoredFilter(COUNTRY_CODE, values, classes);
const regionalValues = (values = []) => values.map(({ region, value }) => ({ uid: region, value }));
export const regionalFillColor = (values, classes) => fillColor(NUTS_ID, regionalValues(values), classes);
export const regionalFilter = (values, classes) => scoredFilter(NUTS_ID, regionalValues(values), classes);

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
