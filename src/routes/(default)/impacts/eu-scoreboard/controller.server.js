import { loadScoreboardChart, loadScoreboardMap } from '$utils/apis.js';
import { enrichChart } from '$lib/server/charts.js';

function reportFailure(operation, reason) {
  console.error('Scoreboard request failed', { operation, reasonName: reason instanceof Error ? reason.name : typeof reason, status: reason?.status });
}

export async function loadChart({ scoreboard, fetch, selections, chartId, signal, onEnrichmentFailure }) {
  const definition = scoreboard.charts.find((item) => item.chartId === chartId);
  if (!definition) return undefined;
  let result;
  try {
    result = await loadScoreboardChart(fetch, { sector: scoreboard.sector.uid, ...selections, chartId }, { signal });
  } catch (reason) {
    signal?.throwIfAborted();
    if (reason?.name === 'AbortError') throw reason;
    reportFailure('load-chart', reason);
    return { definition, status: 'error', data: [], error: 'Chart data could not be loaded.' };
  }
  return enrichChart(result, fetch, { signal, onEnrichmentFailure });
}

export async function loadMap({ scoreboard, fetch, selections, signal }) {
  if (!scoreboard.indicator) return { status: 'unavailable', values: [], metadata: null };
  const request = { sector: scoreboard.sector.uid, ...selections };
  if (!request.indicator) request.indicator = scoreboard.indicator.name;
  try {
    return await loadScoreboardMap(fetch, request, { signal });
  } catch (reason) {
    signal?.throwIfAborted();
    if (reason?.name === 'AbortError') throw reason;
    reportFailure('load-map', reason);
    return { definition: scoreboard.indicator, status: 'error', values: [], error: 'Map data could not be loaded.' };
  }
}

export const selectionsFromUrl = (url) => ({
  indicator: url.searchParams.get('indicator') ?? undefined,
  scenario: url.searchParams.get('scenario') ?? undefined,
  region: url.searchParams.get('region') ?? undefined,
  year: url.searchParams.get('year') ?? undefined,
});
