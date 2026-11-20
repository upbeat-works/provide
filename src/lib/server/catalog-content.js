import { catalogContentUrl, catalogScenarioLabelsUrl } from '$lib/utils/apis.js';
import { CMS_TIMEOUT_MS, requestJson } from '$lib/requests/index.js';

async function loadDescription(fetch, collection, { id, signal }) {
  try {
    const body = await requestJson(catalogContentUrl(collection, id), { fetch, signal, timeoutMs: CMS_TIMEOUT_MS });
    const record = body.data.find((record) => record.UID === id);
    return { description: record?.Description || undefined, failed: false };
  } catch {
    return { failed: true };
  }
}

export async function loadIndicatorDescription(fetch, options) {
  return loadDescription(fetch, 'indicators', options);
}

export async function loadScenarioDescription(fetch, options) {
  return loadDescription(fetch, 'scenarios', options);
}

export async function loadScenarioLabels(fetch, { ids, signal, timeout = CMS_TIMEOUT_MS }) {
  const labels = Object.fromEntries(ids.map((id) => [id, id]));
  if (!ids.length) return labels;
  try {
    const body = await requestJson(catalogScenarioLabelsUrl(ids), { fetch, signal, timeoutMs: timeout });
    for (const record of body.data ?? []) {
      const { UID: uid, Label: label } = record;
      if (ids.includes(uid) && label) labels[uid] = label;
    }
  } catch {
    signal?.throwIfAborted();
  }
  return labels;
}
