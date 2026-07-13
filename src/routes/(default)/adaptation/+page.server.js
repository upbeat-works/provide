import { loadFromStrapi } from '$utils/apis.js';

export const load = async ({ fetch, parent }) => {
  const { meta } = await parent();
  const caseStudies = await loadFromStrapi(
    'case-study-dynamics',
    fetch,
    ['populate[CoverImage]=*', 'populate[Topics]=*', 'populate[Project]=*', 'populate[Geography]=*', 'populate[Scenarios]=*'].join('&')
  );

  return {
    caseStudies: caseStudies.map((study) => {
      const attrs = study.attributes;
      const city = meta.cities.find((d) => d.uid === attrs.CityUid) || { uid: attrs.CityUid, label: attrs.CityUid };
      const topics = (attrs.Topics?.data ?? []).map((d) => ({ id: d.id, ...d.attributes }));
      return {
        city,
        abstract: attrs.Abstract,
        category: topics[0]?.Title,
        topics,
        project: attrs.Project?.data ? { id: attrs.Project.data.id, ...attrs.Project.data.attributes } : null,
        geography: attrs.Geography?.data ? { id: attrs.Geography.data.id, ...attrs.Geography.data.attributes } : null,
        scenarios: (attrs.Scenarios?.data ?? []).map((d) => ({ id: d.id, ...d.attributes })),
        image: attrs.CoverImage?.data?.attributes ?? null,
      };
    }),
  };
};
