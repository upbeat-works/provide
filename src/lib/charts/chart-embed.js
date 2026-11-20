export const EMBED_UID = 'chart';
export const EMBED_QUERY_OPTIONS = { arrayFormat: 'comma', commaRoundTrip: true, encodeValuesOnly: true };

export const graphParamsFor = (definition, selection, instance) => ({
  chart: definition,
  instance,
  scenario: selection.scenario?.uid,
  region: selection.region?.uid,
  year: selection.year?.uid,
});
