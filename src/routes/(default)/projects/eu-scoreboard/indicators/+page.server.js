import { generatePageTitle } from '$utils/meta.js';
import { LABEL_EU_SCOREBOARD } from '$config';
import { loadFromStrapi, loadGeographies, loadIndicatorIndex, loadMethodologyScenarios } from '$utils/apis.js';
import { toCaseStudyLink } from '$lib/catalog/case-study-link.js';

export const load = async ({ fetch }) => {
  const [caseStudiesRaw, geographies, indicatorIndex, scenarios] = await Promise.all([
    loadFromStrapi('case-study-dynamics', fetch, 'populate[CoverImage]=*&populate[Covers]=*'),
    loadGeographies(fetch),
    loadIndicatorIndex(fetch),
    loadMethodologyScenarios(fetch),
  ]);

  return {
    title: generatePageTitle(`Explore indicators – ${LABEL_EU_SCOREBOARD}`),
    caseStudies: caseStudiesRaw.map(toCaseStudyLink),
    geographies,
    indicatorIndex,
    scenarios,
  };
};
