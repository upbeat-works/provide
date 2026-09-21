// Builds the scoreboard's country map source from IIASA's `scse-geojson`.
//
// Upstream ships every NUTS level in one file; the scoreboard draws countries,
// so this keeps `LEVL_CODE === 0` and drops the rest. Each feature is stamped
// with the ISO 3166-1 alpha-3 `geoId` the catalog already keys countries on
// (`geographies.geo_id`, what `/scoreboard/map` returns as a value's `uid`), so
// the map joins on the id the API emits rather than on a NUTS code the rest of
// the site knows nothing about.
//
// Coordinates are rounded to 5 decimals (~1 m, far finer than the 1:3M source
// geometry resolves) — upstream carries 15 decimals of float noise, which is
// more than half the file for no visible difference.
//
// The United Kingdom left NUTS, so Eurostat's 2024 edition has no level-0
// feature for it — but the scoreboard speaks for it, and upstream keeps a
// `nuts-with-uk` set for exactly this reason. Its 12 UK NUTS 1 regions are
// dissolved here into the one country the other 39 arrive as.
//
// Run: bun run scripts/build-nuts0-geojson.mjs
import { writeFile } from 'node:fs/promises';
import polygonClipping from 'polygon-clipping';

const COMMIT = 'ec306cb6802bcb733743dfc9556f5432ecba5671';
const raw = (path) => `https://raw.githubusercontent.com/iiasa/scse-geojson/${COMMIT}/${path}`;
const SOURCE = raw('nuts/NUTS_RG_03M_2024_4326.geojson');
const UK_SOURCE = raw('nuts-with-uk/nuts1_updated_uk_regions.geojson');
const TARGET = new URL('../static/data/eu-scoreboard/nuts0_countries.geojson', import.meta.url);
const PRECISION = 5;

// NUTS country codes are ISO 3166-1 alpha-2 but for two deliberate divergences:
// Eurostat codes Greece EL (not GR) and the United Kingdom UK (not GB).
const ALPHA3_BY_NUTS = {
  AL: 'ALB', AT: 'AUT', BA: 'BIH', BE: 'BEL', BG: 'BGR', CH: 'CHE', CY: 'CYP', CZ: 'CZE',
  DE: 'DEU', DK: 'DNK', EE: 'EST', EL: 'GRC', ES: 'ESP', FI: 'FIN', FR: 'FRA', HR: 'HRV',
  HU: 'HUN', IE: 'IRL', IS: 'ISL', IT: 'ITA', LI: 'LIE', LT: 'LTU', LU: 'LUX', LV: 'LVA',
  ME: 'MNE', MK: 'MKD', MT: 'MLT', NL: 'NLD', NO: 'NOR', PL: 'POL', PT: 'PRT', RO: 'ROU',
  RS: 'SRB', SE: 'SWE', SI: 'SVN', SK: 'SVK', TR: 'TUR', UA: 'UKR', UK: 'GBR', XK: 'KOS',
};

const round = (position) => position.map((n) => Number(n.toFixed(PRECISION)));
const roundCoordinates = (coordinates) => (typeof coordinates[0] === 'number' ? round(coordinates) : coordinates.map(roundCoordinates));

async function load(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  const { features } = await response.json();
  return features;
}

const feature = (nutsId, name, geometry) => ({
  type: 'Feature',
  properties: { geoId: ALPHA3_BY_NUTS[nutsId], nutsId, name },
  geometry: { type: geometry.type, coordinates: roundCoordinates(geometry.coordinates) },
});

const [features, ukFeatures] = await Promise.all([load(SOURCE), load(UK_SOURCE)]);

const countries = features.filter(({ properties }) => properties?.LEVL_CODE === 0);
if (!countries.length) throw new Error('No NUTS level 0 features in the source');

const unmapped = countries.map(({ properties }) => properties.NUTS_ID).filter((id) => !ALPHA3_BY_NUTS[id]);
if (unmapped.length) throw new Error(`No alpha-3 for NUTS ${unmapped.join(', ')} — add them to ALPHA3_BY_NUTS`);
if (countries.some(({ properties }) => properties.NUTS_ID === 'UK')) throw new Error('The source now carries UK at level 0 — drop the dissolve below');

// One country, not twelve regions: a union rather than a concatenation, so the
// internal NUTS 1 borders do not survive as strokes on the country outline.
const ukRegions = ukFeatures.filter(({ properties }) => properties?.NUTS_ID?.startsWith('UK'));
if (!ukRegions.length) throw new Error('No UK NUTS 1 regions in the with-UK source');
const asMulti = ({ type, coordinates }) => (type === 'MultiPolygon' ? coordinates : [coordinates]);
const uk = { type: 'MultiPolygon', coordinates: polygonClipping.union(...ukRegions.map(({ geometry }) => asMulti(geometry))) };

const collection = {
  type: 'FeatureCollection',
  features: [...countries.map(({ properties, geometry }) => feature(properties.NUTS_ID, properties.NAME_LATN, geometry)), feature('UK', 'United Kingdom', uk)].sort((a, b) =>
    a.properties.geoId.localeCompare(b.properties.geoId)
  ),
};

await writeFile(TARGET, JSON.stringify(collection));
console.log(`${collection.features.length} countries → ${TARGET.pathname}`);
