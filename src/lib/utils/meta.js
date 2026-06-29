import { TITLE_PROJECT, TITLE_SITE, KEY_SCENARIO_ENDYEAR, KEY_SCENARIO_STARTYEAR, DEFAULT_STARTYEAR } from '$config';
import { get } from 'lodash-es';

export function generatePageTitle(title_page) {
  return [title_page, TITLE_SITE, TITLE_PROJECT].filter(Boolean).join(' – ');
}

// The scenario's end year. Convention scenarios carry no year metadata, so it's
// injected onto the scenario from ixmp4 availability (AVAILABLE_SCENARIOS);
// fall back to 0 when absent (bare scenario, or none selected yet).
export function extractEndYear(scenario) {
  return scenario?.[KEY_SCENARIO_ENDYEAR] ?? 0;
}

export function extractStartYear(scenario) {
  return get(scenario, KEY_SCENARIO_STARTYEAR, DEFAULT_STARTYEAR);
}
