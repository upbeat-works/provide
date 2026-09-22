import { EMBED_UID } from '$routes/(default)/projects/eu-scoreboard/components/charts/catalog.js';
import { getScoreboard } from '$routes/(default)/projects/eu-scoreboard/controller.js';
import { loadChart, selectionsFromUrl } from '$routes/(default)/projects/eu-scoreboard/controller.server.js';
import { parse } from 'qs';
import { canonicalMapSelection, loadMapAvailability } from '$lib/catalog/map-request.js';
import { catalogApiUrl } from '$lib/utils/apis.js';

export const load = async ({ fetch, params, url }) => {
  if (params.embed === 'impact-geo') {
    const query = parse(url.search.replace(/^\?/, ''));
    const scenarioIds = Array.isArray(query.scenarios) ? query.scenarios : query.scenarios ? [query.scenarios] : [];
    const selection = canonicalMapSelection({
      indicator: { uid: query.indicator, instance: query.instance },
      geography: { uid: query.geography },
      scenarios: scenarioIds.map((uid) => ({ uid })),
      parameters: Object.fromEntries(['reference', 'time', 'spatial', 'frequency', 'indicator_value', 'threshold'].filter((key) => query[key] !== undefined).map((key) => [key, query[key]])),
    });
    const apiBase = catalogApiUrl('').replace(/\/$/, '');
    const mapView = await loadMapAvailability(selection, { base: apiBase, fetcher: fetch });
    return { mapView: selection ? { ...mapView, selection } : mapView };
  }
  if (params.embed !== EMBED_UID) return {};
  const scoreboard = getScoreboard(url.searchParams.get('sector'));
  const chartId = url.searchParams.get('chartId');
  const { scenario, region, year } = selectionsFromUrl(url);
  const selections = { scenario, region, year };
  const selection = Object.fromEntries(Object.entries(selections).map(([key, uid]) => [key, uid ? { uid, label: uid } : null]));
  if (!chartId || Object.values(selection).some((value) => !value)) return { scoreboard, scoreboardChart: undefined, selection };
  return { scoreboard, scoreboardChart: await loadChart({ scoreboard, fetch, selections, chartId }), selection };
};
