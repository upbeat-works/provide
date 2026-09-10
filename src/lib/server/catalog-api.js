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

async function loadTechnicalDetails(fetch, resource, { id, instance }) {
  try {
    const path = `${resource}/${encodeURIComponent(id)}`;
    const url = `${catalogApiUrl(path)}?instance=${encodeURIComponent(instance)}`;
    const response = await fetch(url);
    if (!response.ok) throw new CatalogApiError(response.status);
    return await response.json();
  } catch (error) {
    console.error('Catalog technical request failed', {
      resource,
      instance,
      errorType: errorType(error),
    });
    if (error instanceof CatalogApiError) throw error;
    throw new CatalogApiError(502);
  }
}

export async function loadIndicatorTechnicalDetails(fetch, { id, instance }) {
  return loadTechnicalDetails(fetch, 'indicator-details', { id, instance });
}

export async function loadScenarioTechnicalDetails(fetch, { id, instance }) {
  return loadTechnicalDetails(fetch, 'scenario-details', { id, instance });
}
