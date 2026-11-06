import { loadFromStrapi, loadGeographies } from '$utils/apis.js';

export const load = async ({ fetch }) => {
  const [geographies, caseStudies] = await Promise.all([
    loadGeographies(fetch),
    loadFromStrapi('case-study-dynamics', fetch, ['populate[CoverImage]=true', 'populate[Topics]=true', 'populate[Project]=true', 'populate[Geography]=true', 'populate[Scenarios]=true'].join('&')),
  ]);
  const cities = geographies.cities ?? [];

  return {
    caseStudies: caseStudies.map((study) => {
      const attrs = study;
      const cityGeo = cities.find((c) => c.geoId === attrs.Slug);
      const city = { uid: attrs.Slug, label: cityGeo?.label ?? attrs.Slug };
      const topics = attrs.Topics ?? [];
      return {
        city,
        abstract: attrs.Abstract,
        category: topics[0]?.Title,
        topics,
        project: attrs.Project ?? null,
        geography: attrs.Geography ?? null,
        scenarios: (attrs.Scenarios ?? []).map((d) => ({
          id: d.id,
          uid: d.UID,
          label: d.Label ?? d.UID,
        })),
        image: attrs.CoverImage ?? null,
      };
    }),
  };
};
