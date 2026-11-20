import { loadScoreboardDefinition } from '$utils/apis.js';
import { loadScenarioLabels } from '$lib/server/catalog-content.js';

export const load = async ({ url, fetch, request }) => {
  const scoreboard = await loadScoreboardDefinition(fetch, { sector: url.searchParams.get('sector') ?? undefined, indicator: url.searchParams.get('indicator') ?? undefined }, { signal: request?.signal });
  const ids = scoreboard.map.scenarios.map(({ id }) => id);
  const scenarioLabels = await loadScenarioLabels(fetch, { ids, signal: request?.signal });
  return { scoreboard, scenarioLabels };
};
