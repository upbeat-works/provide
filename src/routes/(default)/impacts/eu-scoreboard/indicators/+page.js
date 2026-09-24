import { browser } from '$app/environment';
import { generatePageTitle } from '$utils/meta.js';
import { LABEL_EU_SCOREBOARD } from '$config';
import { loadResource } from '../components/resource.js';

export const load = async ({ fetch, parent }) => {
  const { scoreboard, selection } = await parent();
  const title = generatePageTitle(`Explore indicators – ${LABEL_EU_SCOREBOARD}`);
  let map;
  if (scoreboard.indicator) map = { definition: scoreboard.indicator, status: 'loading' };
  const charts = scoreboard.charts.map((definition) => ({ definition, result: { definition, status: 'loading' } }));
  if (browser) {
    if (scoreboard.indicator) {
      map = loadResource('map', scoreboard.sector.uid, selection, fetch).catch(() => ({ definition: scoreboard.indicator, status: 'error', values: [], error: 'Map data could not be loaded.' }));
    }
    const chartSelection = { scenario: selection.scenario, region: selection.region, year: selection.year };
    for (const chart of charts) {
      chart.result = loadResource(`charts/${encodeURIComponent(chart.definition.chartId)}`, scoreboard.sector.uid, chartSelection, fetch).catch(() => ({
        definition: chart.definition,
        status: 'error',
        data: [],
        error: 'Chart data could not be loaded.',
      }));
    }
  }
  return { title, map, charts };
};
