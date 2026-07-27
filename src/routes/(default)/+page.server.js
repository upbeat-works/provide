import { loadFromStrapi, loadGeographies, loadCatalog } from '$utils/apis.js';

export const load = async ({ fetch }) => {
  const [geographies, catalog] = await Promise.all([loadGeographies(fetch), loadCatalog(fetch)]);
  const caseStudies = await loadFromStrapi('case-study-dynamics', fetch, ['populate[CoverImage]=*', 'populate[Topics]=*'].join('&'));

  return {
    // The landing page hosts a functional quick-start selector (SectionExplore),
    // so it needs the geography + catalog slices the stores read.
    geographies,
    catalog,
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
