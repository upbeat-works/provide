import heatStress from './heat-stress.json';
import testing from './testing.json';
import socioeconomic from './socioeconomic.json';
import { SCOREBOARD_COUNTRIES, scoreboardCountry } from './countries.ts';

export const SCOREBOARD_INSTANCE = 'sparccle-internal';

// One list pairs each sector with its definition, so a sector cannot reach
// getScoreboard without one — the two used to be declared separately and a
// sector added to SECTORS alone crashed every scoreboard page load.
const SECTOR_DEFINITIONS = [
  { uid: 'heat-stress', label: 'Heat stress', definition: heatStress },
  { uid: 'testing', label: 'Testing', definition: testing },
  { uid: 'socioeconomic', label: 'Socioeconomic', definition: socioeconomic },
];

export const SECTORS = SECTOR_DEFINITIONS.map(({ uid, label }) => ({ uid, label }));

const definitionsBySector = Object.fromEntries(SECTOR_DEFINITIONS.map(({ uid, definition }) => [uid, definition]));

export function getScoreboard(sectorId, indicatorName) {
  const sector = SECTORS.find(({ uid }) => uid === sectorId) ?? SECTORS[0];
  const definition = definitionsBySector[sector.uid];
  const indicator = definition.map.indicators.find(({ name }) => name === indicatorName) ?? definition.map.indicators[0];
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
  const indicator = scoreboard.map.indicators.find(({ name }) => name === requested.indicator) ?? scoreboard.map.indicators[0];
  const scenario = scoreboard.map.scenarios.find(({ id }) => id === requested.scenario) ?? scoreboard.map.scenarios[0];
  const region = scoreboardCountry(requested.region) ?? scoreboardCountry('Austria');
  const requestedYear = Number(requested.year);
  const defaultYear = scoreboard.map.years.includes(2050) ? 2050 : scoreboard.map.years[0];
  const year = scoreboard.map.years.includes(requestedYear) ? requestedYear : defaultYear;
  return {
    indicator: indicator?.name,
    scenario: scenario.id,
    region: region.name,
    year,
  };
}
