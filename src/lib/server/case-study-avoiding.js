import { scaleLinear } from 'd3-scale';
import { END_AVOIDING_IMPACTS, END_AVOIDING_REFERENCE, URL_PATH_CERTAINTY_LEVEL, URL_PATH_GEOGRAPHY, URL_PATH_INDICATOR, URL_PATH_LEVEL_OF_IMPACT } from '$config';
import { toLegacyAvoidIndicatorUid, toLegacyScenarioUid } from '$lib/catalog/translate.js';
import { loadFromAPI } from '$utils/apis.js';

function requestUrl(dataApiUrl, endpoint, params) {
  const query = new URLSearchParams(params);
  return `${dataApiUrl.replace(/\/$/, '')}/${endpoint}?${query}`;
}

function uniqueIndicator(id, instance, indicatorIndex) {
  const matches = (indicatorIndex.indicators ?? []).filter((indicator) => indicator.id === id && indicator.instance === instance);
  if (matches.length !== 1) return undefined;
  const indicator = matches[0];
  return {
    id: indicator.id,
    uid: indicator.id,
    label: indicator.label,
    unit: indicator.unit,
    instance: indicator.instance,
  };
}

function uniqueScenario(legacyId, scenarios, instance) {
  const matches = scenarios.filter((scenario) => scenario.instance === instance && toLegacyScenarioUid(scenario.id ?? scenario.uid) === legacyId);
  if (matches.length !== 1) return undefined;
  const scenario = matches[0];
  return {
    uid: legacyId,
    id: scenario.id ?? scenario.uid,
    label: scenario.label ?? scenario.id ?? scenario.uid,
    instance: scenario.instance,
  };
}

export async function loadCaseStudyAvoidingTables({ curation, dataApiUrl, fetch, geographyId, indicatorIndex, scenarios, section }) {
  const indicators = (section.Indicators ?? []).map(({ Uid, Instance }) => uniqueIndicator(Uid, Instance, indicatorIndex)).filter(Boolean);
  const studyLocations = (section.StudyLocations ?? [])
    .map(({ Uid }) => curation.studyLocations.find((studyLocation) => studyLocation.uid === Uid))
    .filter(Boolean)
    .map(({ uid, label }) => ({ uid, label }));
  if (!indicators.length || !studyLocations.length) return [];

  const references = await Promise.all(
    indicators.map(async (indicator) => {
      const params = {
        [URL_PATH_GEOGRAPHY]: geographyId,
        [URL_PATH_INDICATOR]: toLegacyAvoidIndicatorUid(indicator.uid),
      };
      const data = await loadFromAPI(requestUrl(dataApiUrl, END_AVOIDING_REFERENCE, params), fetch);
      return { data, indicator };
    })
  );

  const impactRequests = [];
  for (const { data, indicator } of references) {
    const range = data?.impact_levels?.range_of_interest;
    if (!Array.isArray(range) || range.length !== 2) continue;
    for (const impactLevel of scaleLinear().domain(range).ticks(5)) {
      for (const likelihood of curation.likelihoods) {
        const viewLikelihood = { uid: likelihood.uid, value: likelihood.value };
        const params = {
          [URL_PATH_GEOGRAPHY]: geographyId,
          [URL_PATH_INDICATOR]: toLegacyAvoidIndicatorUid(indicator.uid),
          [URL_PATH_LEVEL_OF_IMPACT]: String(impactLevel),
          [URL_PATH_CERTAINTY_LEVEL]: viewLikelihood.uid,
        };
        impactRequests.push(
          loadFromAPI(requestUrl(dataApiUrl, END_AVOIDING_IMPACTS, params), fetch).then((data) => ({
            data,
            impactLevel,
            indicator,
            likelihood: viewLikelihood,
          }))
        );
      }
    }
  }

  const impacts = await Promise.all(impactRequests);
  const tables = [];
  for (const indicator of indicators) {
    for (const studyLocation of studyLocations) {
      const table = [];
      for (const impact of impacts) {
        if (impact.indicator.instance !== indicator.instance || impact.indicator.uid !== indicator.uid) continue;
        const responseScenarios = impact.data?.study_locations?.[studyLocation.uid]?.scenarios ?? {};
        for (const [legacyId, value] of Object.entries(responseScenarios)) {
          const scenario = uniqueScenario(legacyId, scenarios, indicator.instance);
          if (!scenario || !value?.year) continue;
          table.push({
            impactLevel: impact.impactLevel,
            indicator,
            likelihood: impact.likelihood,
            scenario,
            studyLocation,
            year: { uid: value.year, label: value.year },
          });
        }
      }
      if (table.length) tables.push(table);
    }
  }
  return tables;
}
