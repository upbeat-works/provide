import { json } from '@sveltejs/kit';
import { CatalogApiError, loadScenarioTechnicalDetails } from '$lib/server/catalog-api.js';
import { loadScenarioDescription } from '$lib/server/catalog-content.js';

export async function GET({ fetch, params, request, url }) {
  const id = params.id;
  const instance = url.searchParams.get('instance');
  if (!instance) {
    return json({ error: 'Missing required query parameter: instance' }, { status: 400 });
  }

  const descriptionController = new AbortController();
  const signal = request?.signal;
  const descriptionSignal = signal ? AbortSignal.any([signal, descriptionController.signal]) : descriptionController.signal;
  const descriptionPromise = loadScenarioDescription(fetch, { id, signal: descriptionSignal });

  try {
    const technicalDetails = await loadScenarioTechnicalDetails(fetch, { id, instance, signal });
    const { description: editorialDescription, failed } = await descriptionPromise;
    signal?.throwIfAborted();
    const details = { ...technicalDetails };

    if (editorialDescription) {
      details.description = editorialDescription;
    }

    const headers = failed ? { 'Cache-Control': 'no-store', 'X-Content-Incomplete': 'true' } : undefined;
    return json(details, { headers });
  } catch (error) {
    descriptionController.abort();
    await descriptionPromise;
    if (error instanceof CatalogApiError) {
      return json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
