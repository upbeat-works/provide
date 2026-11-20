import { EMBED_UID } from '$lib/charts/chart-embed.js';
import { loadChartFromDefinition } from '$lib/server/charts.js';
import { parse } from 'qs';

export const load = async ({ fetch, params, request, url }) => {
  if (params.embed !== EMBED_UID) return {};
  const instance = url.searchParams.get('instance');
  const scenario = url.searchParams.get('scenario');
  const region = url.searchParams.get('region');
  const year = url.searchParams.get('year');
  const selections = { scenario, region, year };
  const selection = Object.fromEntries(Object.entries(selections).map(([key, uid]) => [key, uid ? { uid, label: uid } : null]));
  const { chart } = parse(url.search, { ignoreQueryPrefix: true, comma: true });
  if (!instance || chart === undefined || Object.values(selection).some((value) => !value) || !/^\d{4}$/.test(year)) return { chart: undefined, instance, selection };
  if (typeof chart?.decimals === 'string' && chart.decimals.trim()) chart.decimals = Number(chart.decimals);
  if (chart?.hideInEuropeView === 'true') chart.hideInEuropeView = true;
  if (chart?.hideInEuropeView === 'false') chart.hideInEuropeView = false;
  return { chart: await loadChartFromDefinition({ definition: chart, instance, fetch, selections, signal: request?.signal }), instance, selection };
};
