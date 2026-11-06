import { EMBED_UID } from '$routes/(default)/impacts/eu-scoreboard/components/charts/catalog.js';
import { loadChartFromDefinition, selectionsFromUrl } from '$routes/(default)/impacts/eu-scoreboard/controller.server.js';
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
  const { scenario, region, year } = selectionsFromUrl(url);
  const selections = { scenario, region, year };
  const selection = Object.fromEntries(Object.entries(selections).map(([key, uid]) => [key, uid ? { uid, label: uid } : null]));
  const chart = url.searchParams.get('chart');
  if (chart === null || Object.values(selection).some((value) => !value) || !/^\d{4}$/.test(year)) return { scoreboardChart: undefined, selection };
  return { scoreboardChart: await loadChartFromDefinition({ chart, fetch, selections }), selection };
};
