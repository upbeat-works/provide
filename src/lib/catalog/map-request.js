const REQUIRED_PARAMETERS = ['reference', 'time', 'spatial'];

export function canonicalMapSelection({ indicator, geography, scenarios = [], parameters = {} } = {}) {
  if (!indicator?.uid || indicator.instance !== 'provide-internal' || !geography?.uid || !scenarios.length) return null;
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
