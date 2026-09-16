import { browser } from '$app/environment';
import { generatePageTitle } from '$utils/meta.js';
import { LABEL_EU_SCOREBOARD } from '$config';
import { loadResource } from '../components/resource.js';

export const load = async ({ fetch, parent }) => {
  const { scoreboard, scoreboardOptions, selection } = await parent();
  const title = generatePageTitle(`Explore indicators – ${LABEL_EU_SCOREBOARD}`);
  if (scoreboardOptions.status === 'error' || Object.values(selection).some((value) => !value)) return { title, charts: [], map: undefined };
  let map = { definition: scoreboard.mapDefinition, status: 'loading' };
  const charts = scoreboard.definitions.map((definition) => ({ definition, result: { definition, status: 'loading' } }));
  if (browser) {
    map = loadResource('map', scoreboard.sector.uid, selection, fetch).catch(() => ({ definition: scoreboard.mapDefinition, status: 'error', values: [], error: 'Map data could not be loaded.' }));
    for (const chart of charts) {
      chart.result = loadResource(`charts/${encodeURIComponent(chart.definition.chartId)}`, scoreboard.sector.uid, selection, fetch).catch(() => ({
        definition: chart.definition,
        status: 'error',
        data: [],
        error: 'Chart data could not be loaded.',
      }));
    }
  }
  return { title, map, charts };
};
