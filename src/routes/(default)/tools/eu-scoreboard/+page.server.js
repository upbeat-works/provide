import { generatePageTitle } from '$utils/meta.js';
import { LABEL_EU_SCOREBOARD } from '$config';
import { loadFromStrapi } from '$utils/apis.js';
import { toCaseStudyLink } from '$lib/catalog/case-study-link.js';

// The scoreboard's own data has no endpoints yet, so nothing else is fetched
// here — this is where the geography/indicator/scenario slices get loaded when
// they land. Case studies are the exception: they already exist in Strapi and
// feed the footer card, loaded exactly as the explore page does.
export const load = async ({ fetch }) => {
  const caseStudiesRaw = await loadFromStrapi('case-study-dynamics', fetch, 'populate[CoverImage]=*&populate[Covers]=*');

  return {
    title: generatePageTitle(LABEL_EU_SCOREBOARD),
    caseStudies: caseStudiesRaw.map(toCaseStudyLink),
  };
};
