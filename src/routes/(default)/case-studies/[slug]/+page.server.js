import { error } from '@sveltejs/kit';
import { loadCuration, loadFromStrapi, loadGeographies, loadIndicatorIndex, loadMethodologyScenarios } from '$utils/apis.js';
import { parse } from 'marked';
import { loadCaseStudyAvoidingTables } from '$lib/server/case-study-avoiding.js';
import { safeCaseStudyExplorerUrl } from '$lib/catalog/case-study-explorer-url.js';

export const load = async ({ fetch, params }) => {
  const [geographies, indicatorIndex, caseStudiesRaw, caseStudyOutroRaw] = await Promise.all([
    loadGeographies(fetch),
    loadIndicatorIndex(fetch),
    loadFromStrapi(
      'case-study-dynamics',
      fetch,
      [
        `populate[CoverImage]=*`,
        `populate[MainContent][on][future-impacts.future-impacts][populate][ImpactTimeSnapshot][populate]=Image`,
        `populate[MainContent][on][future-impacts.future-impacts][populate][ImpactGeoSnapshot][populate]=Image`,
        `populate[MainContent][on][image-slider.image-slider][populate][ImageSliderPair][populate]=Image1`,
        `populate[MainContent][on][image-slider.image-slider][populate][ImageSliderPair][populate]=Image2`,
        `populate[MainContent][on][avoiding-impacts.avoiding-impacts][populate]=*`,
        `populate[MainContent][on][section.section][populate]=*`,
        `populate[Topics]=*`,
        `populate[Project]=*`,
        `populate[Geography]=*`,
        `populate[Scenarios]=*`,
      ].join('&')
    ),
    loadFromStrapi('case-study-outro', fetch),
  ]);
  const meta = {
    cities: geographies.cities ?? [],
    indicators: indicatorIndex.indicators ?? [],
  };
  const indicatorIndexIncomplete = Boolean(indicatorIndex.failedInstances?.length);
  const caseStudyOutro = caseStudyOutroRaw?.attributes;

  const caseStudyRaw = caseStudiesRaw.find((d) => d.attributes.Slug === params.slug)?.attributes;
  if (!caseStudyRaw) error(404, { message: 'No case study available for this slug' });

  const hasAvoidingImpacts = caseStudyRaw.MainContent.some((content) => content.__component === 'avoiding-impacts.avoiding-impacts');
  if (hasAvoidingImpacts && indicatorIndexIncomplete) {
    error(503, { message: 'Case study indicator data is temporarily unavailable.' });
  }
  let avoidingResources;
  if (hasAvoidingImpacts) {
    const [curation, scenarios] = await Promise.all([loadCuration(fetch), loadMethodologyScenarios(fetch)]);
    avoidingResources = { curation, scenarios };
  }

  // Not every case study is about a city (the adaptation overview isn't), so fall
  // back to a synthetic entry instead of 404ing.
  const cityGeo = meta.cities.find((c) => c.geoId === caseStudyRaw.Slug);
  const city = cityGeo ? { ...cityGeo, uid: caseStudyRaw.Slug } : { uid: caseStudyRaw.Slug, label: caseStudyRaw.Title ?? caseStudyRaw.Slug };

  const caseStudy = {
    city,
    title: caseStudyRaw.Title,
    abstract: caseStudyRaw.Abstract,
    authors: caseStudyRaw.Authors,
    coverImage: caseStudyRaw.CoverImage?.data?.attributes ?? null,
    publicationDate: caseStudyRaw.PublicationDate ?? null,
    topics: (caseStudyRaw.Topics?.data ?? []).map((d) => ({ id: d.id, ...d.attributes })),
    project: caseStudyRaw.Project?.data ? { id: caseStudyRaw.Project.data.id, ...caseStudyRaw.Project.data.attributes } : null,
    geography: caseStudyRaw.Geography?.data ? { id: caseStudyRaw.Geography.data.id, ...caseStudyRaw.Geography.data.attributes } : null,
    scenarios: (caseStudyRaw.Scenarios?.data ?? []).map((d) => ({
      id: d.id,
      uid: d.attributes.UID,
      label: d.attributes.Label ?? d.attributes.UID,
    })),
    mainContent: (
      await Promise.all(
        caseStudyRaw.MainContent.map(async (c) => {
          const type = c.__component.split('.')[1];
          switch (type) {
            case 'avoiding-impacts':
              return {
                type,
                title: c.Title,
                description: c.Description,
                explorerUrl: safeCaseStudyExplorerUrl(c.ExplorerUrl, indicatorIndex),
                data: await loadCaseStudyAvoidingTables({
                  ...avoidingResources,
                  dataApiUrl: import.meta.env.VITE_DATA_API_URL,
                  fetch,
                  geographyId: caseStudyRaw.Slug,
                  indicatorIndex,
                  section: c,
                }),
              };
            case 'future-impacts': {
              if (indicatorIndexIncomplete) {
                error(503, { message: 'Case study indicator data is temporarily unavailable.' });
              }
              const resolveSnapshot = (snpsht, extra) => {
                const matches = meta.indicators.filter((indicator) => indicator.uid === snpsht.Indicator && indicator.instance === snpsht.Instance);
                const indicator = matches.length === 1 ? matches[0] : undefined;
                return indicator ? { indicator, image: snpsht.Image?.data?.attributes, ...extra } : null;
              };
              const impactGeoSnapshots = c.ImpactGeoSnapshot.map((s) => resolveSnapshot(s, { year: s.Year })).filter(Boolean);
              const impactTimeSnapshots = c.ImpactTimeSnapshot.map((s) => resolveSnapshot(s, {})).filter(Boolean);
              if (!impactGeoSnapshots.length || !impactTimeSnapshots.length) return null;
              return {
                type,
                explorerUrl: safeCaseStudyExplorerUrl(c.ExplorerUrl, indicatorIndex),
                impactGeoDescription: c.ImpactGeoDescription,
                impactTimeDescription: c.ImpactTimeDescription,
                impactGeoSnapshots,
                impactTimeSnapshots,
              };
            }
            case 'image-slider':
              return {
                type,
                explorerUrl: safeCaseStudyExplorerUrl(c.ExplorerUrl, indicatorIndex),
                attributeLabel: c.AttributeLabel,
                groupingLabel: c.GroupingLabel,
                allowImageSelection: c.AllowImageSelection,
                showThumbnails: c.ShowThumbnails,
                imagePairs: c.ImageSliderPair.map((img) => ({
                  image1: img.Image1.data?.attributes,
                  image2: img.Image2.data?.attributes,
                  description: img.Description?.trim(),
                  attribute: { uid: img.AttributeValue?.trim(), label: img.AttributeValue?.trim() },
                  group: { uid: img.GroupValue?.trim(), label: img.GroupValue?.trim() },
                })),
              };
            default:
              return {
                type,
                title: c.Title,
                text: parse(c.Text ?? ''),
              };
          }
        })
      )
    ).filter(Boolean),
  };

  const caseStudies = caseStudiesRaw.map((study) => {
    const attrs = study.attributes;
    const topics = (attrs.Topics?.data ?? []).map((d) => ({ id: d.id, ...d.attributes }));
    return {
      id: study.id,
      title: attrs.Title,
      city: meta.cities.find((c) => c.geoId === attrs.Slug) ?? { uid: attrs.Slug, label: attrs.Title ?? attrs.Slug },
      abstract: attrs.Abstract,
      category: topics[0]?.Title,
      image: attrs.CoverImage?.data?.attributes ?? null,
      project: attrs.Project?.data ? { id: attrs.Project.data.id, ...attrs.Project.data.attributes } : null,
    };
  });

  return {
    caseStudy,
    caseStudies,
    caseStudyOutro: { title: caseStudyOutro?.Title, text: caseStudyOutro?.Text ? parse(caseStudyOutro.Text) : null },
    author: caseStudy.authors,
    description: caseStudy.abstract,
  };
};
