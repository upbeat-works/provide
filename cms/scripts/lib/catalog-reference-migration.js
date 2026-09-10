'use strict';

const { IXMP4_UID_BY_LEGACY } = require('./scenario-uid-map');

const INSTANCE = 'provide-internal';
const INDICATORS = new Map([
  ['urbclim-T2M-dayoverX', 'Days a Year with Maximum Temperatures Above X°C'],
  ['urbclim-T2M-nightoverX', 'Nights a Year with Minimum Temperatures Above X°C'],
  ['urbclim-WBGT-dayover31', 'Days a Year with Extreme Heat Stress'],
  ['urbclim-WBGT-dayover295', 'Days a Year with Very High Heat Stress'],
  ['urbclim-cooling-degree-hours', 'Cooling Degree Hours'],
  ['urbclim-LWH-int', 'Lost Working Hours per Year for Intense Activities'],
  ['urbclim-heatwave-days', 'Heatwave Days per Year'],
  ['urbclim-heatwaves-population-exposed', 'Population Exposed to Heatwaves'],
]);
const CANONICAL_INDICATORS = new Set(INDICATORS.values());
const VALUE_MAPS = {
  geography: new Map([
    ['lisbon', 'Lisbon'],
    ['islamabad', 'Islamabad'],
  ]),
  scenario: new Map(Object.entries(IXMP4_UID_BY_LEGACY)),
  time: new Map([['annual', 'Annual']]),
  reference: new Map([
    ['absolute', '2011-2020 (Present Day)'],
    ['present-day', '2011-2020 (Present Day)'],
    ['pre-industrial', '1850-1900 (Pre-industrial)'],
  ]),
  spatial: new Map([['area', 'Area']]),
};

function migrateIndicator(value, instance) {
  const canonical = INDICATORS.get(value);
  if (canonical) return { indicator: canonical, instance: INSTANCE };
  if (!CANONICAL_INDICATORS.has(value)) throw new Error(`Unknown indicator: ${value}`);
  if (instance !== INSTANCE) throw new Error(`Canonical indicator ${value} requires instance ${INSTANCE}`);
  return { indicator: value, instance };
}

function mappedValue(map, value, label) {
  if (!value) return value;
  if ([...map.values()].includes(value)) return value;
  const mapped = map.get(value);
  if (!mapped) throw new Error(`Unknown ${label}: ${value}`);
  return mapped;
}

function migrateExplorerUrl(href) {
  const hasControlCharacter = typeof href === 'string' && /[\u0000-\u001f\u007f]/.test(href);
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//') || href !== href.trim() || hasControlCharacter) {
    throw new Error('Unsafe Explorer URL');
  }
  const url = new URL(href, 'https://provide.local');
  if (url.origin !== 'https://provide.local' || !['/impacts/explore', '/impacts/avoid'].includes(url.pathname)) {
    throw new Error('Unsafe Explorer URL');
  }
  const indicator = url.searchParams.get('indicator');
  if (indicator) {
    const migrated = migrateIndicator(indicator, url.searchParams.get('instance'));
    url.searchParams.set('indicator', migrated.indicator);
    url.searchParams.set('instance', migrated.instance);
  }
  const geography = url.searchParams.get('geography');
  if (geography) url.searchParams.set('geography', mappedValue(VALUE_MAPS.geography, geography, 'geography'));
  for (const [key, value] of [...url.searchParams.entries()]) {
    if (/^scenarios\[\d+\]$/.test(key)) {
      url.searchParams.set(key, mappedValue(VALUE_MAPS.scenario, value, 'scenario'));
    }
  }
  for (const key of ['time', 'reference', 'spatial']) {
    const value = url.searchParams.get(key);
    if (value) url.searchParams.set(key, mappedValue(VALUE_MAPS[key], value, key));
  }
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ''}${url.hash}`;
}

function migrateRows(rows, field) {
  return (rows ?? []).map((row) => {
    const migrated = migrateIndicator(row[field], row.instance);
    return { ...row, [field]: migrated.indicator, instance: migrated.instance };
  });
}

function planCatalogReferenceMigration(repository) {
  return {
    impactGeoSnapshots: migrateRows(repository.impactGeoSnapshots, 'indicator'),
    impactTimeSnapshots: migrateRows(repository.impactTimeSnapshots, 'indicator'),
    avoidingIndicators: migrateRows(repository.avoidingIndicators, 'uid'),
    explorerUrls: (repository.explorerUrls ?? []).map((row) => ({ ...row, url: migrateExplorerUrl(row.url) })),
  };
}

module.exports = { planCatalogReferenceMigration };
