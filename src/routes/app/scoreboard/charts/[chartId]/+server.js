import { json } from '@sveltejs/kit';
import { loadScoreboardDefinition } from '$utils/apis.js';
import { loadChart, selectionsFromUrl } from '$routes/(default)/impacts/eu-scoreboard/controller.server.js';

export const GET = async ({ fetch, request, url, params }) => {
  const scoreboard = await loadScoreboardDefinition(fetch, { sector: url.searchParams.get('sector') ?? undefined }, { signal: request?.signal });
  const headers = new Headers();
  const chart = await loadChart({
    scoreboard,
    fetch,
    selections: selectionsFromUrl(url),
    chartId: params.chartId,
    signal: request?.signal,
    onEnrichmentFailure() {
      headers.set('Cache-Control', 'no-store');
      headers.set('X-Content-Incomplete', 'true');
    },
  });
  if (!chart) return json({ error: 'Chart not found' }, { status: 404 });
  return json(chart, { headers });
};
