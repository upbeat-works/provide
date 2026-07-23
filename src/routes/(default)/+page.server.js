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
      // CityUid is the lowercase slug; it matches a city geography's `geoId`, not
      // its `uid` (the ixmp4 id). Keep uid=slug so /adaptation/<slug> links resolve.
      const cityUid = study.attributes.CityUid;
      const cityGeo = (geographies.cities ?? []).find((c) => c.geoId === cityUid);
      return {
        city: { uid: cityUid, label: cityGeo?.label ?? cityUid },
        abstract: study.attributes.Abstract,
        category: study.attributes.Topics?.data?.[0]?.attributes?.Title,
        image: study.attributes.CoverImage?.data?.attributes ?? null,
      };
    }),
  };
};
