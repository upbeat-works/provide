import { loadFromStrapi, loadScoreboardOptions, loadScoreboardChart, loadScoreboardMap } from '$utils/apis.js';
import { toCaseStudyLink } from '$lib/catalog/case-study-link.js';

function reportFailure(operation, reason) {
  console.error('Scoreboard request failed', { operation, reasonName: reason instanceof Error ? reason.name : typeof reason, status: reason?.status });
}

export async function loadOptions({ scoreboard, fetch, selections = {} }) {
  try {
    return await loadScoreboardOptions(fetch, { sector: scoreboard.sector.uid, scenario: selections.scenario, region: selections.region });
  } catch (reason) {
    reportFailure('load-options', reason);
    return { status: 'error', error: 'Choices could not be loaded.', scenarios: [], regions: [], years: [], selection: {} };
  }
}

export async function loadChart({ scoreboard, fetch, selections, chartId }) {
  const definition = scoreboard.definitions.find((item) => item.chartId === chartId);
  if (!definition) return undefined;
  let result;
  try {
    result = await loadScoreboardChart(fetch, { sector: scoreboard.sector.uid, ...selections, chartId });
  } catch (reason) {
    reportFailure('load-chart', reason);
    return { definition, status: 'error', data: [], error: 'Chart data could not be loaded.' };
  }
  if (definition.caseStudyId && result.status === 'ready') {
    try {
      const studies = await loadFromStrapi('case-study-dynamics', fetch, 'populate[CoverImage]=*&populate[Covers]=*', `filters[id][$eq]=${encodeURIComponent(definition.caseStudyId)}`);
      const study = studies.find(({ id }) => String(id) === String(definition.caseStudyId));
      if (study) result = { ...result, caseStudy: toCaseStudyLink(study) };
    } catch (reason) {
      reportFailure('load-case-study', reason);
    }
  }
  return result;
}

export async function loadMap({ scoreboard, fetch, selections }) {
  if (!scoreboard.mapDefinition) return undefined;
  try {
    return await loadScoreboardMap(fetch, { sector: scoreboard.sector.uid, ...selections });
  } catch (reason) {
    reportFailure('load-map', reason);
    return { definition: scoreboard.mapDefinition, status: 'error', values: [], error: 'Map data could not be loaded.' };
  }
}

export const selectionsFromUrl = (url) => ({
  scenario: url.searchParams.get('scenario') ?? undefined,
  region: url.searchParams.get('region') ?? undefined,
  year: url.searchParams.get('year') ?? undefined,
});
