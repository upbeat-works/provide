import { error } from '@sveltejs/kit';
import { catalogApiUrl, loadFromStrapi } from '$utils/apis.js';
import { toCaseStudyLink } from '$lib/catalog/case-study-link.js';
import { validateChart } from '../../../api/scoreboard/charts';
import { instances } from '../../../api/instances';

function reportFailure(operation, reason) {
  console.error('Chart request failed', { operation, reasonName: reason instanceof Error ? reason.name : typeof reason, status: reason?.status });
}

export async function loadChartFromDefinition({ definition, instance, fetch, selections }) {
  if (!instances.some(({ slug }) => slug === instance)) error(404, `Unknown instance: ${instance}`);
  try {
    validateChart(definition);
  } catch (reason) {
    error(400, reason.message);
  }
  let result;
  try {
    const response = await fetch(`${catalogApiUrl('charts')}?${new URLSearchParams({ instance, ...selections })}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(definition),
    });
    if (!response.ok) throw new Error('Chart request failed');
    result = await response.json();
  } catch (reason) {
    reportFailure('load-chart-definition', reason);
    return { definition, status: 'error', data: [], error: 'Chart data could not be loaded.' };
  }
  return enrichChart(result, fetch);
}

export async function enrichChart(result, fetch) {
  const definition = result.definition;
  if (definition?.caseStudyId && result.status === 'ready') {
    try {
      const studies = await loadFromStrapi('case-study-dynamics', fetch, 'populate[CoverImage]=true&populate[Covers]=true', `filters[documentId][$eq]=${encodeURIComponent(definition.caseStudyId)}`);
      const study = studies.find(({ documentId }) => documentId === String(definition.caseStudyId));
      if (study) result = { ...result, caseStudy: toCaseStudyLink(study) };
    } catch (reason) {
      reportFailure('load-case-study', reason);
    }
  }
  return result;
}
