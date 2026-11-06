export const EMBED_UID = 'eu-scoreboard-chart';

export const graphParamsFor = (definition, selection = {}) => ({
  chart: JSON.stringify(definition),
  scenario: selection.scenario?.uid,
  region: selection.region?.uid,
  year: selection.year?.uid,
});
