import { generatePageTitle } from '$utils/meta.js';
import { LABEL_EU_SCOREBOARD } from '$config';
import { loadFromStrapi } from '$utils/apis.js';
import { toCaseStudyLink } from '$lib/catalog/case-study-link.js';

// Case studies already exist in Strapi and feed the footer card, loaded exactly
// as the explore page does. The indicators themselves have no endpoints yet.
export const load = async ({ fetch }) => {
  const caseStudiesRaw = await loadFromStrapi('case-study-dynamics', fetch, 'populate[CoverImage]=*&populate[Covers]=*');

  return {
    title: generatePageTitle(`Explore indicators – ${LABEL_EU_SCOREBOARD}`),
    caseStudies: caseStudiesRaw.map(toCaseStudyLink),
  };
};
