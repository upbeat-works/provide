const option = (uid) => (uid ? { uid, label: uid } : null);

export function resolveSelection(options, requested) {
  if (options.status === 'error') {
    return { scenario: option(requested.scenario), region: option(requested.region), year: option(requested.year) };
  }
  if (options.yearStatus === 'error' && requested.year) return { ...options.selection, year: option(requested.year) };
  const year = options.years.find(({ uid }) => uid === requested.year) ?? options.years.find(({ uid }) => uid === '2050') ?? options.years[0] ?? null;
  return { ...options.selection, year };
}
