import { generatePageTitle } from '$utils/meta.js';
import { LABEL_AVOID_IMPACTS } from '$config';
import { loadFromStrapi, loadAvoidMeta } from '$lib/utils/apis.js';
import { toCaseStudyLink } from '$lib/catalog/case-study-link.js';

export const load = async ({ fetch }) => {
  // Avoid runs on the frozen legacy /meta (avoidMeta) — no ixmp4 catalog. The
  // case-study join happens client-side.
  const [caseStudiesRaw, avoidMeta] = await Promise.all([
    loadFromStrapi('case-study-dynamics', fetch, 'populate[CoverImage]=*&populate[Covers]=*'),
    loadAvoidMeta(fetch),
  ]);

  const caseStudies = caseStudiesRaw.map(toCaseStudyLink);

  return {
    title: generatePageTitle(LABEL_AVOID_IMPACTS),
    caseStudies,
    avoidMeta,
  };
};
