import { loadFromStrapi, loadMetaData } from '$utils/apis.js';

export const load = async ({ fetch }) => {
  const meta = await loadMetaData(fetch);
  const caseStudies = await loadFromStrapi('case-study-dynamics', fetch, ['populate[CoverImage]=*', 'populate[Topics]=*'].join('&'));

  return {
    caseStudies: caseStudies.map((study) => ({
      city: meta.cities.find((d) => d.uid === study.attributes.CityUid) || { uid: 'nassau', label: 'Nassau' },
      abstract: study.attributes.Abstract,
      category: study.attributes.Topics?.data?.[0]?.attributes?.Title,
      image: study.attributes.CoverImage?.data?.attributes ?? null,
    })),
  };
};
