import { loadFromStrapi } from '$utils/apis.js';

export const load = async ({ fetch, parent }) => {
  const { meta } = await parent();
  const caseStudies = await loadFromStrapi('case-study-dynamics', fetch, 'populate[CoverImage]=*');

  return {
    caseStudies: caseStudies.map((study) => {
      const attrs = study.attributes;
      const city = meta.cities.find((d) => d.uid === attrs.CityUid) || { uid: attrs.CityUid, label: attrs.CityUid };
      return {
        city,
        abstract: attrs.Abstract,
        category: attrs.Topics,
        image: attrs.CoverImage?.data?.attributes ?? null,
      };
    }),
  };
};
