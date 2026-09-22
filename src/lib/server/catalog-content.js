import { catalogContentUrl, catalogScenarioLabelsUrl } from '$lib/utils/apis.js';

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

export async function loadScenarioLabels(fetch, { ids, timeout = 1000 }) {
  const labels = Object.fromEntries(ids.map((id) => [id, id]));
  if (!ids.length) return labels;
  const controller = new AbortController();
  let timer;
  try {
    const timeoutResult = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Scenario label request timed out'));
      }, timeout);
    });
    const request = async () => {
      const response = await fetch(catalogScenarioLabelsUrl(ids), { signal: controller.signal });
      if (!response.ok) return undefined;
      return response.json();
    };
    const body = await Promise.race([request(), timeoutResult]);
    if (!body) return labels;
    for (const record of body.data ?? []) {
      const { UID: uid, Label: label } = record.attributes ?? record;
      if (ids.includes(uid) && label) labels[uid] = label;
    }
  } catch {
    return labels;
  } finally {
    clearTimeout(timer);
  }
  return labels;
}
