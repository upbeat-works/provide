import { resolveScoreboardChoices, SCOREBOARD_COUNTRIES } from './controller.js';

const option = (uid, label = uid) => ({ uid: String(uid), label: String(label) });

export function createScoreboardOptions(scoreboard, scenarioLabels = {}) {
  return {
    indicators: scoreboard.map.indicators.map(({ name }) => option(name)),
    scenarios: scoreboard.map.scenarios.map(({ id }) => option(id, scenarioLabels[id] ?? id)),
    regions: SCOREBOARD_COUNTRIES.map(({ name }) => option(name)),
    years: scoreboard.map.years.map((year) => option(year)),
  };
}

export function resolveSelection(scoreboard, options, requested) {
  const resolved = resolveScoreboardChoices(scoreboard, requested);
  return Object.fromEntries(
    Object.entries(resolved).map(([key, uid]) => [key, options[`${key}s`].find((candidate) => candidate.uid === String(uid))])
  );
}
