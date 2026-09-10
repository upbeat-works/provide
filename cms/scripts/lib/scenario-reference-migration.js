'use strict';

const { ixmp4UidFor } = require('./scenario-uid-map');

function migrateScenario(value) {
  return ixmp4UidFor(value) ?? value;
}

function migrateExplorerUrl(href) {
  if (typeof href !== 'string') return href;
  const url = new URL(href, 'https://provide.local');
  let changed = false;
  for (const [key, value] of url.searchParams.entries()) {
    if (!/^scenarios\[\d+\]$/.test(key)) continue;
    const migrated = migrateScenario(value);
    if (migrated === value) continue;
    url.searchParams.set(key, migrated);
    changed = true;
  }
  if (!changed) return href;
  const absolute = /^[a-z][a-z\d+.-]*:\/\//i.test(href);
  return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}

function planScenarioReferenceMigration(repository) {
  return {
    scenarios: (repository.scenarios ?? []).map((row) => ({ ...row, uid: migrateScenario(row.uid) })),
    explorerUrls: (repository.explorerUrls ?? []).map((row) => ({ ...row, url: migrateExplorerUrl(row.url) })),
  };
}

module.exports = { planScenarioReferenceMigration };
