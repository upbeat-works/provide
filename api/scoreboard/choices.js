import { SCOREBOARD_COUNTRIES, scoreboardCountry } from './countries.ts';

export const SCOREBOARD_INSTANCE = 'sparccle-internal';

export function selectMapIndicator(map, indicatorName) {
  const requested = map.indicators.find(({ name }) => name === indicatorName);
  if (requested) return requested;
  return map.indicators.find(({ name }) => name === map.defaultIndicator) ?? map.indicators[0];
}

export { SCOREBOARD_COUNTRIES };

export function resolveScoreboardChoices(scoreboard, requested = {}) {
  const indicator = selectMapIndicator(scoreboard.map, requested.indicator);
  const scenario = scoreboard.map.scenarios.find(({ id }) => id === requested.scenario) ?? scoreboard.map.scenarios[0];
  const region = scoreboardCountry(requested.region) ?? scoreboardCountry('Austria');
  const requestedYear = Number(requested.year);
  const defaultYear = scoreboard.map.years.includes(2050) ? 2050 : scoreboard.map.years[0];
  const year = scoreboard.map.years.includes(requestedYear) ? requestedYear : defaultYear;
  return {
    indicator: indicator?.name,
    scenario: scenario.id,
    region: requested.region === 'all' ? 'all' : region.name,
    year,
  };
}
