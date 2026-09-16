export const EMBED_UID = 'eu-scoreboard-chart';

export const graphParamsFor = (definition, sector, selection = {}) => ({
  chartId: definition.chartId,
  sector,
  scenario: selection.scenario?.uid,
  region: selection.region?.uid,
  year: selection.year?.uid,
});
