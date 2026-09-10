import { URL_PATH_GEOGRAPHY, URL_PATH_GEOGRAPHY_TYPE, URL_PATH_INDICATOR } from '$config';
import { toLegacyGeoId, toLegacyMapIndicatorUid, toLegacyParameterValues, toLegacyScenarioUid } from './translate.js';

export function legacyMapView({ chartView, geography, indicator, scenarios = [], optionValues = {} }) {
  if (chartView.status !== 'ready') return chartView;
  const legacyUrlParams = legacyMapRequestParams({ geography, indicator, optionValues });
  const scenarioPairs = scenarios
    .map((scenario) => ({ scenario, legacyUid: toLegacyScenarioUid(scenario.uid) }))
    .filter(({ legacyUid }) => legacyUid);
  if (!legacyUrlParams.geography || !legacyUrlParams.indicator || !scenarioPairs.length) return { status: 'empty' };
  return { status: 'ready', legacyUrlParams, scenarioPairs };
}

export function legacyMapRequestParams({ geography, indicator, optionValues = {} }) {
  return {
    [URL_PATH_GEOGRAPHY]: toLegacyGeoId(geography),
    [URL_PATH_GEOGRAPHY_TYPE]: geography?.geographyType,
    [URL_PATH_INDICATOR]: toLegacyMapIndicatorUid(indicator),
    ...toLegacyParameterValues(optionValues),
  };
}
