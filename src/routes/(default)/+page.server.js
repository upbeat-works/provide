import { loadFromStrapi } from '$utils/apis.js';
import { toProjectSection } from '$lib/content/landing-project.js';

export const load = async ({ fetch }) => {
  const [caseStudies, projectSection] = await Promise.all([
    loadFromStrapi('case-study-dynamics', fetch, ['populate[CoverImage]=*', 'populate[Topics]=*'].join('&')),
    loadFromStrapi('landing-project', fetch, ['populate[Intro]=*', 'populate[Highlights][populate]=*'].join('&')).catch(() => null),
  ]);

  return {
    projectSection: toProjectSection(projectSection),
    caseStudies: caseStudies.map((study) => {
      const slug = study.attributes.Slug;
      return {
        city: { uid: slug, label: slug },
        abstract: study.attributes.Abstract,
        category: study.attributes.Topics?.data?.[0]?.attributes?.Title,
        image: study.attributes.CoverImage?.data?.attributes ?? null,
      };
    }),
  };
};
