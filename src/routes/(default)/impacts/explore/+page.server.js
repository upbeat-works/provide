import { generatePageTitle } from '$utils/meta.js';
import { LABEL_FUTURE_IMPACTS } from '$config';
import { loadFromStrapi, loadCatalog } from '$lib/utils/apis.js';
import { toCaseStudyLink } from '$lib/catalog/case-study-link.js';

export const load = async ({ fetch }) => {
  // Explore owns the ixmp4 catalog (the expensive variable scan). Geographies
  // arrive via layout data; the case-study join happens client-side.
  const [catalog, caseStudiesRaw] = await Promise.all([
    loadCatalog(fetch),
    loadFromStrapi('case-study-dynamics', fetch, 'populate[CoverImage]=*&populate[Covers]=*'),
  ]);

  const caseStudies = caseStudiesRaw.map(toCaseStudyLink);

  return {
    title: generatePageTitle(LABEL_FUTURE_IMPACTS),
    caseStudies,
    catalog,
  };
};
