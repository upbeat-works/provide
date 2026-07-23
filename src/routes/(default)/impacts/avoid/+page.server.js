import { generatePageTitle } from '$utils/meta.js';
import { LABEL_AVOID_IMPACTS } from '$config';
import { loadFromStrapi, loadAvoidMeta } from '$lib/utils/apis.js';

export const load = async ({ fetch, parent }) => {
  // Avoid runs on the frozen legacy /meta (avoidMeta) — no ixmp4 catalog. geographies
  // come from the shared impacts layout via parent(), used only for case studies.
  const [{ geographies }, caseStudiesRaw, avoidMeta] = await Promise.all([
    parent(),
    loadFromStrapi('case-study-dynamics', fetch, 'populate[CoverImage]=*'),
    loadAvoidMeta(fetch),
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
    title: generatePageTitle(LABEL_AVOID_IMPACTS),
    caseStudies,
    avoidMeta,
  };
};
