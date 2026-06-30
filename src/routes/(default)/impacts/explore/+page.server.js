import { generatePageTitle } from '$utils/meta.js';
import { LABEL_FUTURE_IMPACTS } from '$config';
import { loadFromStrapi } from '$lib/utils/apis.js';

export const load = async ({ fetch, parent }) => {
  const [{ geographies }, caseStudiesRaw] = await Promise.all([
    parent(),
    loadFromStrapi('case-study-dynamics', fetch, 'populate[CoverImage]=*'),
  ]);

  const cities = geographies.cities ?? [];
  const caseStudies = caseStudiesRaw.map((study) => ({
    cityUid: study.attributes.CityUid,
    city: cities.find((d) => d.uid === study.attributes.CityUid) || { uid: study.attributes.CityUid, label: study.attributes.CityUid },
    abstract: study.attributes.Abstract,
    category: study.attributes.Category ?? 'CASE STUDY',
    image: study.attributes.CoverImage?.data?.attributes ?? null,
  }));

  return {
    title: generatePageTitle(LABEL_FUTURE_IMPACTS),
    caseStudies,
  };
};
