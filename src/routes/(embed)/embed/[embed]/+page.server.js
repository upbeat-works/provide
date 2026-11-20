import { EMBED_UID } from '$routes/(default)/impacts/eu-scoreboard/components/charts/catalog.js';
import { loadChartFromDefinition, selectionsFromUrl } from '$routes/(default)/impacts/eu-scoreboard/controller.server.js';

export const load = async ({ fetch, params, url }) => {
  if (params.embed !== EMBED_UID) return {};
  const { scenario, region, year } = selectionsFromUrl(url);
  const selections = { scenario, region, year };
  const selection = Object.fromEntries(Object.entries(selections).map(([key, uid]) => [key, uid ? { uid, label: uid } : null]));
  const chart = url.searchParams.get('chart');
  if (chart === null || Object.values(selection).some((value) => !value) || !/^\d{4}$/.test(year)) return { scoreboardChart: undefined, selection };
  return { scoreboardChart: await loadChartFromDefinition({ chart, fetch, selections }), selection };
};
