import { loadFromStrapi } from '$utils/apis.js';
import { toProjectSection } from '$lib/content/landing-project.js';
import { toAnalysisCards } from '$lib/content/landing-analysis-cards.js';

export const load = async ({ fetch }) => {
  const [caseStudies, projectSection, analysisCards] = await Promise.all([
    loadFromStrapi('case-study-dynamics', fetch, ['populate[CoverImage]=*', 'populate[Topics]=*'].join('&')).catch(() => []),
    loadFromStrapi('landing-project', fetch, ['populate[Intro]=*', 'populate[Highlights][populate]=*'].join('&')).catch(() => null),
    loadFromStrapi('landing-analysis-cards', fetch, 'populate[Image]=*').catch(() => []),
  ]);

  return {
    projectSection: toProjectSection(projectSection),
    analysisCards: toAnalysisCards(analysisCards, import.meta.env.VITE_CMS_URL),
    // A CMS that is down or rejecting the read degrades to an empty rail rather
    // than a 500 — the rest of the landing page is static enough to stand alone.
    caseStudies: (caseStudies ?? []).map((study) => {
      const slug = study.attributes.Slug;
      return {
        city: { uid: slug, label: slug },
        abstract: study.attributes.Abstract,
        category: study.attributes.Topics?.data?.[0]?.attributes?.Title,
        image: study.attributes.CoverImage?.data?.attributes ?? null,
      };
    }),
  };
};
