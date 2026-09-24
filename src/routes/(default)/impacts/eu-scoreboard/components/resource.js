export async function loadResource(resource, sector, selection, fetcher = fetch) {
  const params = new URLSearchParams({ sector });
  const dimensions = resource === 'map' ? ['indicator', 'region', 'scenario', 'year'] : ['region', 'scenario', 'year'];
  for (const key of dimensions) {
    const value = selection[key];
    if (value?.uid) params.set(key, value.uid);
  }
  const response = await fetcher(`/app/scoreboard/${resource}?${params}`);
  if (!response.ok) throw new Error('Data could not be loaded.');
  return response.json();
}

export function mapResourceKey(sector, selection = {}) {
  return [sector, selection.indicator?.uid, selection.region?.uid, selection.scenario?.uid, selection.year?.uid].map((value) => value ?? '').join('|');
}
