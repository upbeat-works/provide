import { generatePageTitle } from '$utils/meta.js';
import { LABEL_FUTURE_IMPACTS } from '$config';
import { loadFromStrapi } from '$lib/utils/apis.js';
import { toCaseStudyLink } from '$lib/catalog/case-study-link.js';

export const load = async ({ fetch }) => {
  const caseStudiesRaw = await loadFromStrapi('case-study-dynamics', fetch, 'populate[CoverImage]=*&populate[Covers]=*');

  const caseStudies = caseStudiesRaw.map(toCaseStudyLink);

  return {
    title: generatePageTitle(LABEL_FUTURE_IMPACTS),
    caseStudies,
  };
};
