import { generatePageTitle } from '$utils/meta.js';
import { LABEL_AVOID_IMPACTS } from '$config';
import { loadFromStrapi, loadMetaData } from '$lib/utils/apis.js';

export const load = async ({ fetch }) => {
  const [meta, caseStudiesRaw] = await Promise.all([
    loadMetaData(fetch),
    loadFromStrapi('case-study-dynamics', fetch, 'populate[CoverImage]=*'),
  ]);

  const caseStudies = caseStudiesRaw.map((study) => ({
    cityUid: study.attributes.CityUid,
    city: meta.cities.find((d) => d.uid === study.attributes.CityUid) || { uid: study.attributes.CityUid, label: study.attributes.CityUid },
    abstract: study.attributes.Abstract,
    category: study.attributes.Category ?? 'CASE STUDY',
    image: study.attributes.CoverImage?.data?.attributes ?? null,
  }));

  return {
    title: generatePageTitle(LABEL_AVOID_IMPACTS),
    caseStudies,
  };
};
