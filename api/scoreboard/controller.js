import heatStress from './heat-stress.json';
import testing from './testing.json';
import heatStressMap from './heat-stress-map.json';
import testingMap from './testing-map.json';

export const SCOREBOARD_INSTANCE = 'sparccle-internal';
export const SECTORS = [
  { uid: 'heat-stress', label: 'Heat stress' },
  { uid: 'testing', label: 'Testing' },
];

const mapDefinitionsBySector = { 'heat-stress': heatStressMap, testing: testingMap };
const definitionsBySector = { 'heat-stress': heatStress, testing };

// A sector's map names the indicator it is drawn from, and that is what the
// indicators view asks the reader to choose — the hazard is a way of grouping
// indicators, not something that view acts on. Same `sector` behind both, so
// the two views stay one selection.
const indicatorOf = ({ uid, label }) => ({ uid, label: mapDefinitionsBySector[uid]?.title ?? label });

export function getScoreboard(sectorId) {
  const sector = SECTORS.find(({ uid }) => uid === sectorId) ?? SECTORS[0];
  return {
    instance: SCOREBOARD_INSTANCE,
    sectors: SECTORS,
    sector,
    indicators: SECTORS.map(indicatorOf),
    indicator: indicatorOf(sector),
    definitions: definitionsBySector[sector.uid],
    mapDefinition: mapDefinitionsBySector[sector.uid],
  };
}
