import { readTopics, validateTopic } from './topics.js';
import { SCOREBOARD_INSTANCE, selectMapIndicator } from './choices.js';

export { SCOREBOARD_INSTANCE, SCOREBOARD_COUNTRIES, resolveScoreboardChoices } from './choices.js';

export function getScoreboard(sectorId, indicatorName, { directory } = {}) {
  const topics = readTopics(directory);
  const definition = topics.find(({ uid }) => uid === sectorId) ?? topics[0];
  return scoreboardDefinition(definition, topics, indicatorName);
}

export function previewScoreboard(topic, indicatorName) {
  validateTopic(topic);
  const definition = { ...topic, uid: 'preview' };
  return scoreboardDefinition(definition, [definition], indicatorName);
}

function scoreboardDefinition(definition, topics, indicatorName) {
  return {
    instance: SCOREBOARD_INSTANCE,
    sectors: topics.map(({ uid, label }) => ({ uid, label })),
    sector: { uid: definition.uid, label: definition.label },
    map: definition.map,
    charts: definition.charts,
    indicator: selectMapIndicator(definition.map, indicatorName),
  };
}
