import { generatePageTitle } from '$utils/meta.js';
import { LABEL_EU_SCOREBOARD } from '$config';
import { loadMethodologyScenarios } from '$utils/apis.js';

export const load = async ({ fetch }) => ({
  title: generatePageTitle(LABEL_EU_SCOREBOARD),
  scenarios: await loadMethodologyScenarios(fetch),
});
