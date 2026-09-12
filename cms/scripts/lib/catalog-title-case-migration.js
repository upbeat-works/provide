'use strict';

const TITLE_CASE_INDICATORS = new Map(Object.entries(require('./catalog-indicator-title-case-map.json')));

function titleCaseIndicator(value) {
  return TITLE_CASE_INDICATORS.get(value) ?? value;
}

function titleCaseExplorerUrl(href) {
  if (typeof href !== 'string') return href;
  const url = new URL(href, 'https://provide.local');
  const indicator = url.searchParams.get('indicator');
  if (!indicator) return href;
  const migrated = TITLE_CASE_INDICATORS.get(indicator);
  if (!migrated || migrated === indicator) return href;
  url.searchParams.set('indicator', migrated);
  const absolute = /^[a-z][a-z\d+.-]*:\/\//i.test(href);
  return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}

function migrateRows(rows, field) {
  return (rows ?? []).map((row) => ({ ...row, [field]: titleCaseIndicator(row[field]) }));
}

function planCatalogTitleCaseMigration(repository) {
  return {
    impactGeoSnapshots: migrateRows(repository.impactGeoSnapshots, 'indicator'),
    impactTimeSnapshots: migrateRows(repository.impactTimeSnapshots, 'indicator'),
    avoidingIndicators: migrateRows(repository.avoidingIndicators, 'uid'),
    explorerUrls: (repository.explorerUrls ?? []).map((row) => ({ ...row, url: titleCaseExplorerUrl(row.url) })),
  };
}

module.exports = { planCatalogTitleCaseMigration };
