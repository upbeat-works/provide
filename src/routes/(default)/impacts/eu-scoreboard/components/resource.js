export async function loadResource(resource, sector, selection, fetcher = fetch, { preview } = {}) {
  const params = new URLSearchParams({ sector });
  const dimensions = ['map', 'definition'].includes(resource) ? ['indicator', 'region', 'scenario', 'year'] : ['region', 'scenario', 'year'];
  for (const key of dimensions) {
    const value = selection[key];
    if (value?.uid) params.set(key, value.uid);
  }
  let response;
  if (preview !== undefined) {
    response = await fetcher(`/app/scoreboard/preview/${resource}?${params}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preview),
    });
  } else {
    response = await fetcher(`/app/scoreboard/${resource}?${params}`);
  }
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error ?? 'Data could not be loaded.');
  }
  return response.json();
}

export function mapResourceKey(sector, selection = {}) {
  return [sector, selection.indicator?.uid, selection.region?.uid, selection.scenario?.uid, selection.year?.uid].map((value) => value ?? '').join('|');
}
