import { catalogContentUrl } from '$lib/utils/apis.js';

async function loadDescription(fetch, collection, { id, signal }) {
  try {
    const response = await fetch(catalogContentUrl(collection, id), { signal });
    if (!response.ok) return undefined;
    const body = await response.json();
    const record = body.data?.find(({ attributes }) => attributes?.UID === id);
    return record?.attributes?.Description || undefined;
  } catch {
    return undefined;
  }
}

export async function loadIndicatorDescription(fetch, { id, signal }) {
  return loadDescription(fetch, 'indicators', { id, signal });
}

export async function loadScenarioDescription(fetch, { id, signal }) {
  return loadDescription(fetch, 'scenarios', { id, signal });
}
