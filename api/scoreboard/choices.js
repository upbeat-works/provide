import { SCOREBOARD_COUNTRIES, scoreboardCountry } from './countries.ts';

export const SCOREBOARD_INSTANCE = 'sparccle-internal';

export function selectMapIndicator(map, indicatorName) {
  const requested = map.indicators.find(({ name }) => name === indicatorName);
  if (requested) return requested;
  return map.indicators.find(({ name }) => name === map.defaultIndicator) ?? map.indicators[0];
}

export function mapBoundaryLevel(indicator, region) {
  if (indicator?.type !== 'choropleth') return undefined;
  if (region === 'all') return indicator.europeLevel;
  return indicator.level;
}

export { SCOREBOARD_COUNTRIES };

export function chartsForRegion(charts, region) {
  return charts.filter((chart) => region !== 'all' || !chart.hideInEuropeView);
}

export function resolveScoreboardChoices(scoreboard, requested = {}) {
  const indicator = selectMapIndicator(scoreboard.map, requested.indicator);
  const scenario = scoreboard.map.scenarios.find(({ id }) => id === requested.scenario) ?? scoreboard.map.scenarios[0];
  const region = scoreboardCountry(requested.region);
  const requestedYear = Number(requested.year);
  const defaultYear = scoreboard.map.years.includes(2050) ? 2050 : scoreboard.map.years[0];
  const year = scoreboard.map.years.includes(requestedYear) ? requestedYear : defaultYear;
  return {
    indicator: indicator?.name,
    scenario: scenario.id,
    region: region?.name ?? 'all',
    year,
  };
}
