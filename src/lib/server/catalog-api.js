import { CATALOG_TIMEOUT_MS, requestJson } from '$lib/requests/index.js';
import { catalogApiUrl } from '$lib/utils/apis.js';

export class CatalogApiError extends Error {
  constructor(status = 502) {
    super('Catalog API request failed');
    this.name = 'CatalogApiError';
    this.status = status;
  }
}

function errorType(error) {
  if (error instanceof Error) return error.name;
  return 'NonErrorRejection';
}

async function loadTechnicalDetails(fetch, resource, { id, instance, signal }) {
  try {
    const path = `${resource}/${encodeURIComponent(id)}`;
    const url = `${catalogApiUrl(path)}?instance=${encodeURIComponent(instance)}`;
    return await requestJson(url, { fetch, signal, timeoutMs: CATALOG_TIMEOUT_MS });
  } catch (error) {
    signal?.throwIfAborted();
    if (error?.name === 'AbortError') throw error;
    console.error('Catalog technical request failed', {
      resource,
      instance,
      errorType: errorType(error),
    });
    if (error?.name === 'TimeoutError') throw new CatalogApiError(504);
    throw new CatalogApiError(error?.status ?? 502);
  }
}

export async function loadIndicatorTechnicalDetails(fetch, { id, instance, signal }) {
  return loadTechnicalDetails(fetch, 'indicator-details', { id, instance, signal });
}

export async function loadScenarioTechnicalDetails(fetch, { id, instance, signal }) {
  return loadTechnicalDetails(fetch, 'scenario-details', { id, instance, signal });
}
