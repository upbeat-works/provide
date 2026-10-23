import { json } from '@sveltejs/kit';
import { loadScoreboardDefinition } from '$utils/apis.js';
import { loadChart, selectionsFromUrl } from '$routes/(default)/impacts/eu-scoreboard/controller.server.js';

export const GET = async ({ fetch, url, params }) => {
  const scoreboard = await loadScoreboardDefinition(fetch, { sector: url.searchParams.get('sector') ?? undefined });
  const chart = await loadChart({ scoreboard, fetch, selections: selectionsFromUrl(url), chartId: params.chartId });
  if (!chart) return json({ error: 'Chart not found' }, { status: 404 });
  return json(chart);
};
