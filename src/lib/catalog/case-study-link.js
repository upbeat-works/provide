const norm = (v) => String(v).toLowerCase();

/** Strapi case-study entry -> the shape findCaseStudy and LinkSection need. */
export function toCaseStudyLink(study) {
  const a = study?.attributes ?? {};
  return {
    slug: a.Slug,
    title: a.Title,
    covers: (a.Covers ?? []).map((c) => c.GeographyId).filter(Boolean),
    isDefault: Boolean(a.IsDefault),
    abstract: a.Abstract,
    category: a.Category ?? 'CASE STUDY',
    image: a.CoverImage?.data?.attributes ?? null,
  };
}

const geographyIds = (geography) => [geography?.uid, geography?.geoId].filter(Boolean).map(norm);

// covers/isDefault is the join; slug is only the link target.
export function findCaseStudy(caseStudies, geography) {
  const ids = geographyIds(geography);
  if (!ids.length) return null;
  const list = caseStudies ?? [];
  return list.find((s) => (s.covers ?? []).some((c) => ids.includes(norm(c)))) ?? list.find((s) => s.isDefault) ?? null;
}
