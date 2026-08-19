export function resolveImpactGeoYear({ currentYear, availableYears, defaultYear }) {
  if (!availableYears.length) return currentYear ?? defaultYear;
  if (availableYears.includes(currentYear)) return currentYear;
  return availableYears.includes(defaultYear) ? defaultYear : availableYears[0];
}

export function buildImpactGeoRequestConfigs({ base, endpoint, selection, scenarios, year }) {
  return scenarios.map(({ uid: scenario }) => ({
    base,
    endpoint,
    params: { ...selection, scenario, year },
  }));
}
