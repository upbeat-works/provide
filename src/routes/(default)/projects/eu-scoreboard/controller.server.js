import { loadFromStrapi, loadScoreboard } from '$utils/apis.js';
import { toCaseStudyLink } from '$lib/catalog/case-study-link.js';

const caseStudyId = (study) => String(study.id);

function safeFailure(reason) {
  if (!(reason instanceof Error)) return { reasonType: typeof reason };
  const failure = { reasonName: reason.name };
  if ('code' in reason && typeof reason.code === 'string') failure.reasonCode = reason.code;
  if ('status' in reason && typeof reason.status === 'number') failure.reasonStatus = reason.status;
  if (reason.cause instanceof Error) {
    failure.causeName = reason.cause.name;
    if ('code' in reason.cause && typeof reason.cause.code === 'string') failure.causeCode = reason.cause.code;
  }
  if ('response' in reason && reason.response && typeof reason.response === 'object' && 'status' in reason.response && typeof reason.response.status === 'number') {
    failure.reasonStatus = reason.response.status;
  }
  const httpStatus = reason.message.match(/HTTP (\d{3})/i)?.[1];
  if (httpStatus && failure.reasonStatus === undefined) failure.reasonStatus = Number(httpStatus);
  return failure;
}

export async function loadCharts({ scoreboard, fetch, selections = {}, chartId }) {
  if (!scoreboard.definitions.length && (!scoreboard.mapDefinition || chartId)) {
    return {
      scenarios: [],
      regions: [],
      years: [],
      selection: { scenario: null, region: null, year: null },
      map: undefined,
      charts: [],
    };
  }
  let result;
  try {
    result = await loadScoreboard(fetch, {
      sector: scoreboard.sector.uid,
      ...selections,
      ...(chartId ? { chartId } : {}),
    });
  } catch (reason) {
    console.error('Scoreboard request failed', {
      operation: 'load-scoreboard',
      sector: scoreboard.sector.uid,
      chartId,
      scenario: selections.scenario,
      region: selections.region,
      year: selections.year,
      ...safeFailure(reason),
    });
    const definitions = chartId ? scoreboard.definitions.filter((definition) => definition.chartId === chartId) : scoreboard.definitions;
    return {
      scenarios: [],
      regions: [],
      years: [],
      selection: { scenario: null, region: null, year: null },
      map: !chartId && scoreboard.mapDefinition ? {
        definition: scoreboard.mapDefinition,
        status: 'error',
        values: [],
        error: 'Map data could not be loaded.',
      } : undefined,
      charts: definitions.map((definition) => ({
        definition,
        status: 'error',
        data: [],
        error: 'Chart data could not be loaded.',
      })),
    };
  }
  const ids = new Set(result.charts.map(({ definition }) => definition.caseStudyId).filter(Boolean).map(String));
  let studiesById = new Map();
  if (ids.size) {
    try {
      const studies = await loadFromStrapi('case-study-dynamics', fetch, 'populate[CoverImage]=*&populate[Covers]=*');
      studiesById = new Map(studies.filter((study) => ids.has(caseStudyId(study))).map((study) => [caseStudyId(study), toCaseStudyLink(study)]));
    } catch (reason) {
      console.error('Scoreboard case studies failed', {
        operation: 'load-case-studies',
        sector: scoreboard.sector.uid,
        chartId,
        caseStudyIds: [...ids],
        ...safeFailure(reason),
      });
      studiesById = new Map();
    }
  }
  return {
    ...result,
    charts: result.charts.map((chart) => {
      const id = chart.definition.caseStudyId;
      if (!id) return chart;
      return { ...chart, caseStudy: studiesById.get(String(id)) };
    }),
  };
}

export const selectionsFromUrl = (url) => ({
  scenario: url.searchParams.get('scenario') ?? undefined,
  region: url.searchParams.get('region') ?? undefined,
  year: url.searchParams.get('year') ?? undefined,
});
