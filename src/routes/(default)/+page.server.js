import { loadFromStrapi, loadMetaData } from '$utils/apis.js';
import { toProjectSection } from '$lib/content/landing-project.js';

export const load = async ({ fetch }) => {
  const meta = await loadMetaData(fetch);
  const [caseStudies, projectSection] = await Promise.all([
    loadFromStrapi('case-study-dynamics', fetch, ['populate[CoverImage]=*', 'populate[Topics]=*'].join('&')),
    // The "About the project" block is editorial content (Strapi single type
    // `landing-project`); `populate=*` stops at the two cards, so ask for the
    // highlights' items too. A missing CMS hides the block, not the page.
    loadFromStrapi(
      'landing-project',
      fetch,
      ['populate[Intro]=*', 'populate[Highlights][populate]=*'].join('&')
    ).catch(() => null),
  ]);

  return {
    projectSection: toProjectSection(projectSection),
    caseStudies: caseStudies.map((study) => ({
      city: meta.cities.find((d) => d.uid === study.attributes.CityUid) || { uid: 'nassau', label: 'Nassau' },
      abstract: study.attributes.Abstract,
      category: study.attributes.Topics?.data?.[0]?.attributes?.Title,
      image: study.attributes.CoverImage?.data?.attributes ?? null,
    })),
  };
};
