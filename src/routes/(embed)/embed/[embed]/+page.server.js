import { EMBED_UID } from '$routes/(default)/projects/eu-scoreboard/components/charts/catalog.js';
import { getScoreboard } from '$routes/(default)/projects/eu-scoreboard/controller.js';
import { loadCharts, selectionsFromUrl } from '$routes/(default)/projects/eu-scoreboard/controller.server.js';

export const load = async ({ fetch, params, url }) => {
  if (params.embed !== EMBED_UID) return {};
  const scoreboard = getScoreboard(url.searchParams.get('sector'));
  const chartId = url.searchParams.get('chartId');
  if (!chartId) return { scoreboard, scoreboardChart: undefined };
  const result = await loadCharts({ scoreboard, fetch, selections: selectionsFromUrl(url), chartId });
  return { scoreboard, scoreboardChart: result.charts[0], selection: result.selection };
};
