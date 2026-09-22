import { createScoreboardOptions, resolveSelection } from './selection.js';

export const load = ({ data, url }) => {
  const options = createScoreboardOptions(data.scoreboard, data.scenarioLabels);
  const requested = Object.fromEntries(['indicator', 'scenario', 'region', 'year'].map((key) => [key, url.searchParams.get(key) ?? undefined]));
  return { ...data, ...options, selection: resolveSelection(data.scoreboard, options, requested) };
};
