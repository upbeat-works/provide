import { loadFromStrapi } from '$utils/apis.js';

export const load = async ({ fetch, parent }) => {
  const { geographies, catalog } = await parent();
  const cities = geographies.cities ?? [];
  const scenarios = catalog.scenarios ?? [];
  const caseStudies = await loadFromStrapi(
    'case-study-dynamics',
    fetch,
    ['populate[CoverImage]=*', 'populate[Topics]=*', 'populate[Project]=*', 'populate[Geography]=*', 'populate[Scenarios]=*'].join('&')
  );

  return {
    caseStudies: caseStudies.map((study) => {
      const attrs = study.attributes;
      // CityUid is the lowercase slug; it matches a city geography's `geoId`, not
      // its `uid` (the ixmp4 id). Keep uid=slug so card links resolve.
      const cityGeo = cities.find((c) => c.geoId === attrs.CityUid);
      const city = { uid: attrs.CityUid, label: cityGeo?.label ?? attrs.CityUid };
      const topics = (attrs.Topics?.data ?? []).map((d) => ({ id: d.id, ...d.attributes }));
      return {
        city,
        abstract: attrs.Abstract,
        category: topics[0]?.Title,
        topics,
        project: attrs.Project?.data ? { id: attrs.Project.data.id, ...attrs.Project.data.attributes } : null,
        geography: attrs.Geography?.data ? { id: attrs.Geography.data.id, ...attrs.Geography.data.attributes } : null,
        scenarios: (attrs.Scenarios?.data ?? []).map((d) => ({
          id: d.id,
          uid: d.attributes.UID,
          label: d.attributes.Label ?? d.attributes.UID,
        })),
        image: attrs.CoverImage?.data?.attributes ?? null,
      };
    }),
  };
};
