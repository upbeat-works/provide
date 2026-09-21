const REQUIRED_PARAMETERS = ['reference', 'time', 'spatial'];

export function canonicalMapSelection({ indicator, geography, scenarios = [], parameters = {} } = {}) {
  if (!indicator?.uid || !indicator.instance || !geography?.uid || !scenarios.length) return null;
  if (REQUIRED_PARAMETERS.some((key) => !parameters[key])) return null;
  if (parameters.indicator_value !== undefined) return null;
  if (parameters.frequency !== undefined && String(parameters.frequency) !== '0.5') return null;
  if (parameters.threshold !== undefined && parameters.threshold !== '50th Percentile') return null;
  const selection = {
    indicator: indicator.uid,
    instance: indicator.instance,
    geography: geography.uid,
    reference: parameters.reference,
    time: parameters.time,
    spatial: parameters.spatial,
    scenarios: scenarios.map(({ uid }) => uid),
  };
  if (parameters.frequency !== undefined) selection.frequency = String(parameters.frequency);
  if (parameters.threshold !== undefined) selection.threshold = parameters.threshold;
  return selection;
}

export function sharedMapYears(availability, scenarios) {
  if (!scenarios.length) return [];
  const first = availability[scenarios[0]] ?? [];
  return first.filter((year) => scenarios.every((scenario) => (availability[scenario] ?? []).includes(year))).sort((a, b) => a - b);
}

function availabilityUrl(selection, base) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(selection)) {
    if (key === 'scenarios') {
      for (const scenario of value) params.append('scenarios', scenario);
    } else {
      params.set(key, value);
    }
  }
  return `${base.replace(/\/$/, '')}/impact-geo/availability/?${params}`;
}

export async function loadMapAvailability(selection, { base = import.meta.env.VITE_API_URL, fetcher = fetch } = {}) {
  if (!selection || !base) return { status: 'empty' };
  try {
    const response = await fetcher(availabilityUrl(selection, base));
    const body = await response.json();
    if (!response.ok || body.message || body.error) {
      return { status: 'failure', message: body.message ?? body.error ?? `Request failed with status code: ${response.status}` };
    }
    const availability = body.scenarios ?? {};
    const years = sharedMapYears(availability, selection.scenarios);
    if (!years.length || selection.scenarios.some((scenario) => !(availability[scenario]?.length))) return { status: 'empty' };
    return { status: 'ready', selection, availability, years };
  } catch (error) {
    return { status: 'failure', message: error instanceof Error ? error.message : String(error) };
  }
}

export function startMapAvailability(selection, set, options) {
  let current = true;
  set({ status: 'loading', selection });
  loadMapAvailability(selection, options).then((view) => {
    if (current) set(view);
  });
  return () => {
    current = false;
  };
}

export function mapGridRequests(selection, year) {
  if (!selection || !Number.isFinite(year)) return [];
  const { scenarios, ...params } = selection;
  return scenarios.map((scenario) => ({
    endpoint: 'impact-geo',
    base: import.meta.env.VITE_API_URL,
    arrayFormat: 'repeat',
    params: { ...params, scenario, year },
  }));
}
