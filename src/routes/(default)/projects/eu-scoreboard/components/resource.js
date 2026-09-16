export async function loadResource(resource, sector, selection, fetcher = fetch) {
  const params = new URLSearchParams({ sector });
  for (const [key, value] of Object.entries(selection)) if (value?.uid) params.set(key, value.uid);
  const response = await fetcher(`/app/scoreboard/${resource}?${params}`);
  if (!response.ok) throw new Error('Data could not be loaded.');
  return response.json();
}
