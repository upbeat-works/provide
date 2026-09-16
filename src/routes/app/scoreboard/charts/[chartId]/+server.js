import { json } from '@sveltejs/kit';
import { getScoreboard } from '$routes/(default)/projects/eu-scoreboard/controller.js';
import { loadChart, selectionsFromUrl } from '$routes/(default)/projects/eu-scoreboard/controller.server.js';

export const GET = async ({ fetch, url, params }) => {
  const chart = await loadChart({ scoreboard: getScoreboard(url.searchParams.get('sector')), fetch, selections: selectionsFromUrl(url), chartId: params.chartId });
  if (!chart) return json({ error: 'Chart not found' }, { status: 404 });
  return json(chart);
};
