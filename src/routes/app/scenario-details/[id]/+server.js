import { json } from '@sveltejs/kit';
import { CatalogApiError, loadScenarioTechnicalDetails } from '$lib/server/catalog-api.js';
import { loadScenarioDescription } from '$lib/server/catalog-content.js';

const OPTIONAL_DESCRIPTION_LIMIT_MS = 1000;

export async function GET({ fetch, params, url }) {
  const id = params.id;
  const instance = url.searchParams.get('instance');
  if (!instance) {
    return json({ error: 'Missing required query parameter: instance' }, { status: 400 });
  }

  const descriptionController = new AbortController();
  const descriptionTimer = setTimeout(() => descriptionController.abort(), OPTIONAL_DESCRIPTION_LIMIT_MS);
  const descriptionResultsPromise = Promise.allSettled([loadScenarioDescription(fetch, { id, signal: descriptionController.signal })]).finally(() => clearTimeout(descriptionTimer));

  try {
    const technicalDetails = await loadScenarioTechnicalDetails(fetch, { id, instance });
    const [descriptionResult] = await descriptionResultsPromise;
    const details = { ...technicalDetails };

    if (descriptionResult.status === 'fulfilled' && descriptionResult.value) {
      details.description = descriptionResult.value;
    }

    return json(details);
  } catch (error) {
    descriptionController.abort();
    await descriptionResultsPromise;
    if (error instanceof CatalogApiError) {
      return json({ error: error.message }, { status: error.status });
    }
    throw error;
  } finally {
    clearTimeout(descriptionTimer);
  }
}
