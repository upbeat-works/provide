import { getScoreboard } from './controller.js';
import { loadScenarioLabels } from '$lib/server/catalog-content.js';

export const load = async ({ url, fetch }) => {
  const scoreboard = getScoreboard(url.searchParams.get('sector'), url.searchParams.get('indicator'));
  const ids = scoreboard.map.scenarios.map(({ id }) => id);
  const scenarioLabels = await loadScenarioLabels(fetch, { ids });
  return { scoreboard, scenarioLabels };
};
