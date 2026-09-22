import bbox from '@turf/bbox';
import intersect from '@turf/intersect';

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

export function rasterFeatures(grid, classes = [], mask = undefined) {
  const features = [];
  const [originX, originY] = grid?.coordinatesOrigin ?? [];
  const resolution = grid?.resolution;
  if (!Number.isFinite(originX) || !Number.isFinite(originY) || !Number.isFinite(resolution) || resolution <= 0 || !Array.isArray(grid?.data)) {
    return { type: 'FeatureCollection', features };
  }
  const half = resolution / 2;
  for (const [column, values] of grid.data.entries()) {
    if (!Array.isArray(values)) continue;
    for (const [row, value] of values.entries()) {
      const color = colorFor(value, classes);
      if (!color) continue;
      const x = originX + column * resolution;
      const y = originY + row * resolution;
      const cell = {
        type: 'Feature',
        properties: { value, color },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [x - half, y - half], [x + half, y - half], [x + half, y + half],
            [x - half, y + half], [x - half, y - half],
          ]],
        },
      };
      const feature = mask ? intersect(cell, mask) : cell;
      if (!feature) continue;
      feature.properties = { value, color };
      features.push(feature);
    }
  }
  return { type: 'FeatureCollection', features };
}

const NUMERIC_COLORS = ['#fff2cc', '#f9d67a', '#ee9f3f', '#d75b2a', '#9f2727'];
const formatNumber = (value) => new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value);

export function numericClasses(values = [], unit = undefined) {
  const finite = values.map(({ value }) => value).filter(Number.isFinite);
  if (!finite.length) return [];
  const minimum = Math.min(...finite);
  const maximum = Math.max(...finite);
  const suffix = unit ? ` ${unit}` : '';
  if (minimum === maximum) return [{ min: minimum, max: maximum, label: `${formatNumber(minimum)}${suffix}`, color: NUMERIC_COLORS[2] }];
  const step = (maximum - minimum) / NUMERIC_COLORS.length;
  return NUMERIC_COLORS.map((color, index) => {
    const start = minimum + step * index;
    const end = index === NUMERIC_COLORS.length - 1 ? maximum : minimum + step * (index + 1);
    return { min: start, max: end, label: `${formatNumber(start)}–${formatNumber(end)}${suffix}`, color };
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
function boundaryLabels(classes, highestFirst, unit) {
  if (!classes.length || !classes.every(({ min, max }) => Number.isFinite(min) && Number.isFinite(max))) return [];
  let boundaries = [classes[0].min, ...classes.map(({ max }) => max)];
  if (highestFirst) boundaries = [classes[0].max, ...classes.map(({ min }) => min)];
  if (boundaries.length === 2 && boundaries[0] === boundaries[1]) boundaries = [boundaries[0]];
  return boundaries.map((value, index) => {
    const suffix = unit && index === boundaries.length - 1 ? ` ${unit}` : '';
    return `${formatNumber(value)}${suffix}`;
  });
}

export function legendOf(classes = [], { highestFirst = false, labelMode = 'classes', unit = undefined } = {}) {
  const ordered = highestFirst ? [...classes].reverse() : classes;
  const legend = {
    scale: ordered.map(({ color }) => color),
    labels: ordered.map(({ label }) => label),
  };
  if (labelMode === 'boundaries') legend.ticks = boundaryLabels(ordered, highestFirst, unit);
  return legend;
}
