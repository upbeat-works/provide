import { EMBED_UID } from '$routes/(default)/impacts/eu-scoreboard/components/charts/catalog.js';
import { loadChartFromDefinition, selectionsFromUrl } from '$routes/(default)/impacts/eu-scoreboard/controller.server.js';
import { parse } from 'qs';

export const load = async ({ fetch, params, url }) => {
  if (params.embed !== EMBED_UID) return {};
  const { scenario, region, year } = selectionsFromUrl(url);
  const selections = { scenario, region, year };
  const selection = Object.fromEntries(Object.entries(selections).map(([key, uid]) => [key, uid ? { uid, label: uid } : null]));
  const { chart } = parse(url.search, { ignoreQueryPrefix: true, comma: true });
  if (chart === undefined || Object.values(selection).some((value) => !value) || !/^\d{4}$/.test(year)) return { scoreboardChart: undefined, selection };
  if (typeof chart?.decimals === 'string' && chart.decimals.trim()) chart.decimals = Number(chart.decimals);
  if (chart?.hideInEuropeView === 'true') chart.hideInEuropeView = true;
  if (chart?.hideInEuropeView === 'false') chart.hideInEuropeView = false;
  return { scoreboardChart: await loadChartFromDefinition({ definition: chart, fetch, selections }), selection };
};
