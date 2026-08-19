import qs from 'qs';

export function buildDataUrl({ endpoint, params, base, fallbackBase, arrayFormat = 'indices' }) {
  const query = qs.stringify(params, { encodeValuesOnly: true, arrayFormat });
  const resolvedBase = (base || fallbackBase).replace(/\/$/, '');
  return `${resolvedBase}/${endpoint}/?${query}`;
}
