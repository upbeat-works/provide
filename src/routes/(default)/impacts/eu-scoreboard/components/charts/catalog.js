export const EMBED_UID = 'eu-scoreboard-chart';
export const EMBED_QUERY_OPTIONS = { arrayFormat: 'comma', commaRoundTrip: true, encodeValuesOnly: true };

export const graphParamsFor = (definition, selection = {}) => ({
  chart: definition,
  scenario: selection.scenario?.uid,
  region: selection.region?.uid,
  year: selection.year?.uid,
});
