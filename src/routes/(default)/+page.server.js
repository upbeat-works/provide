import { loadFromStrapi, loadGeographies, loadCatalog } from '$utils/apis.js';
import { toProjectSection } from '$lib/content/landing-project.js';

export const load = async ({ fetch }) => {
  const [geographies, catalog] = await Promise.all([loadGeographies(fetch), loadCatalog(fetch)]);
  const [caseStudies, projectSection] = await Promise.all([
    loadFromStrapi('case-study-dynamics', fetch, ['populate[CoverImage]=*', 'populate[Topics]=*'].join('&')),
    // The "About the project" block is editorial content (Strapi single type
    // `landing-project`); `populate=*` stops at the two cards, so ask for the
    // highlights' items too. A missing CMS hides the block, not the page.
    loadFromStrapi(
      'landing-project',
      fetch,
      ['populate[Intro]=*', 'populate[Highlights][populate]=*'].join('&')
    ).catch(() => null),
  ]);

  return {
    // The landing page hosts a functional quick-start selector (SectionExplore),
    // so it needs the geography + catalog slices the stores read.
    geographies,
    catalog,
    projectSection: toProjectSection(projectSection),
    caseStudies: caseStudies.map((study) => {
      // A case study's slug is its own id, not a geography's — but for the
      // city-subject ones it doubles as a geoId, which is how the card gets a label.
      const slug = study.attributes.Slug;
      const cityGeo = (geographies.cities ?? []).find((c) => c.geoId === slug);
      return {
        city: { uid: slug, label: cityGeo?.label ?? slug },
        abstract: study.attributes.Abstract,
        category: study.attributes.Topics?.data?.[0]?.attributes?.Title,
        image: study.attributes.CoverImage?.data?.attributes ?? null,
      };
    }),
  };
};
