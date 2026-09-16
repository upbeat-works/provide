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

export function getScoreboard(sectorId) {
  const sector = SECTORS.find(({ uid }) => uid === sectorId) ?? SECTORS[0];
  return { instance: SCOREBOARD_INSTANCE, sectors: SECTORS, sector, definitions: definitionsBySector[sector.uid], mapDefinition: mapDefinitionsBySector[sector.uid] };
}
