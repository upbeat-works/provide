import heatStress from './heat-stress.json';
import testing from './testing.json';
import socioeconomic from './socioeconomic.json';
import { SCOREBOARD_COUNTRIES, scoreboardCountry } from './countries.ts';

export const SCOREBOARD_INSTANCE = 'sparccle-internal';
export const SECTORS = [
  { uid: 'heat-stress', label: 'Heat stress' },
  { uid: 'testing', label: 'Testing' },
  { uid: 'socioeconomic', label: 'Socioeconomic' },
];

const definitionsBySector = { 'heat-stress': heatStress, testing, socioeconomic };

function selectMapIndicator(map, indicatorName) {
  const requested = map.indicators.find(({ name }) => name === indicatorName);
  if (requested) return requested;
  return map.indicators.find(({ name }) => name === map.defaultIndicator) ?? map.indicators[0];
}

export function getScoreboard(sectorId, indicatorName) {
  const sector = SECTORS.find(({ uid }) => uid === sectorId) ?? SECTORS[0];
  const definition = definitionsBySector[sector.uid];
  const indicator = selectMapIndicator(definition.map, indicatorName);
  return {
    instance: SCOREBOARD_INSTANCE,
    sectors: SECTORS,
    sector,
    map: definition.map,
    charts: definition.charts,
    indicator,
  };
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
