import bbox from '@turf/bbox';

// Both choropleths are geojson from IIASA's `scse-geojson` (see the source
// README next to the files), so both join the same way: a feature property
// holding the id the scoreboard keys a value on. Countries are NUTS country
// level stamped with their alpha-3 `geoId`; R9 regions carry the ixmp4 region
// name in `I_REGION`.
export const COUNTRY_SOURCE = '/data/eu-scoreboard/nuts0_countries.geojson';
export const R9_SOURCE = '/data/eu-scoreboard/r9_regions.geojson';

export const COUNTRY_CODE_PROPERTY = 'geoId';
export const COUNTRY_CODE = ['get', COUNTRY_CODE_PROPERTY];
export const R9_REGION_PROPERTY = 'I_REGION';
export const R9_REGION = ['get', R9_REGION_PROPERTY];

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

// The country map draws NUTS, which stops at Europe, so it opens on Europe
// rather than on a world view mostly made of basemap. R9 is global.
const MAP_BOUNDS = {
  admin0: [-12, 34, 34, 61],
  r9: [-180, -60, 180, 85],
};

export const boundsForGeography = (geographyType) => MAP_BOUNDS[geographyType] ?? MAP_BOUNDS.admin0;

// The ids a set of values actually paints. Anything without a class has no
// colour, so it is not drawn and not clickable either.
export const scoredUids = (values = [], classes = []) => values.flatMap((entry) => (colorFor(entry.value, classes) ? [entry.uid] : []));

// `values` is `[{ uid, value }]` keyed on whatever the layer's property holds
// (`ITA` for countries, `European Union (R9)` for R9). Anything it has no value
// for falls through to the default and stays transparent — outside the
// scoreboard's coverage reads better as plain basemap than as a null class.
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
export const r9FillColor = (values, classes) => fillColor(R9_REGION, values, classes);
export const r9Filter = (values, classes) => scoredFilter(R9_REGION, values, classes);

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
