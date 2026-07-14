import { loadFromStrapi, loadGeographies, loadCatalog } from '$utils/apis.js';

export const load = async ({ fetch }) => {
  const [geographies, catalog] = await Promise.all([loadGeographies(fetch), loadCatalog(fetch)]);
  const caseStudies = await loadFromStrapi('case-study-dynamics', fetch, ['populate[CoverImage]=*', 'populate[Topics]=*'].join('&'));

  return {
    // The landing page hosts a functional quick-start selector (SectionExplore),
    // so it needs the geography + catalog slices the stores read.
    geographies,
    catalog,
    caseStudies: caseStudies.map((study) => ({
      city: (geographies.cities ?? []).find((d) => d.uid === study.attributes.CityUid) || { uid: 'nassau', label: 'Nassau' },
      abstract: study.attributes.Abstract,
      category: study.attributes.Topics?.data?.[0]?.attributes?.Title,
      image: study.attributes.CoverImage?.data?.attributes ?? null,
    })),
  };
};
