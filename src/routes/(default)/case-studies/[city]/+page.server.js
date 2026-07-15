import { error } from '@sveltejs/kit';
import { loadFromStrapi } from '$utils/apis.js';
import { parse } from 'marked';

export const load = async ({ fetch, parent, params }) => {
  const { meta } = await parent();

  const caseStudiesRaw = await loadFromStrapi(
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
  );

  const caseStudyOutro = (await loadFromStrapi('case-study-outro', fetch))?.attributes;

  const caseStudyRaw = caseStudiesRaw.find((d) => d.attributes.CityUid === params.city)?.attributes;
  if (!caseStudyRaw) error(404, { message: 'No case study available for this city' });

  const city = meta.cities.find((c) => c.uid === caseStudyRaw.CityUid);
  if (!city) error(404, { message: 'City not found in data' });

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
    scenarios: (caseStudyRaw.Scenarios?.data ?? []).map((d) => {
      const metaScenario = meta.scenarios.find((s) => s.uid === d.attributes.UID);
      return { id: d.id, uid: d.attributes.UID, label: metaScenario?.label ?? d.attributes.UID };
    }),
    mainContent: await Promise.all(
      caseStudyRaw.MainContent.map(async (c) => {
        const type = c.__component.split('.')[1];
        switch (type) {
          case 'avoiding-impacts':
            return {
              type,
              title: c.Title,
              description: c.Description,
              explorerUrl: c.ExplorerUrl,
            };
          case 'future-impacts':
            return {
              type,
              explorerUrl: c.ExplorerUrl,
              impactGeoDescription: c.ImpactGeoDescription,
              impactTimeDescription: c.ImpactTimeDescription,
              impactGeoSnapshots: c.ImpactGeoSnapshot.map((snpsht) => {
                const indicator = meta.indicators.find((d) => d.uid === snpsht.Indicator);
                if (!indicator) error(404, { message: `No indicator found for ${snpsht.Indicator} in geo snapshots future-impacts component` });
                return {
                  indicator,
                  year: snpsht.Year,
                  image: snpsht.Image.data?.attributes,
                };
              }),
              impactTimeSnapshots: c.ImpactTimeSnapshot.map((snpsht) => {
                const indicator = meta.indicators.find((d) => d.uid === snpsht.Indicator);
                if (!indicator) error(404, { message: `No indicator found for ${snpsht.Indicator} in time snapshots future-impacts component` });
                return {
                  indicator,
                  image: snpsht.Image.data?.attributes,
                };
              }),
            };
          case 'image-slider':
            return {
              type,
              explorerUrl: c.ExplorerUrl,
              description: c.Description,
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
    ),
  };

  const caseStudies = caseStudiesRaw.map((study) => {
    const attrs = study.attributes;
    const topics = (attrs.Topics?.data ?? []).map((d) => ({ id: d.id, ...d.attributes }));
    return {
      id: study.id,
      title: attrs.Title,
      city: meta.cities.find((c) => c.uid === attrs.CityUid),
      abstract: attrs.Abstract,
      category: topics[0]?.Title,
      image: attrs.CoverImage?.data?.attributes ?? null,
      project: attrs.Project?.data ? { id: attrs.Project.data.id, ...attrs.Project.data.attributes } : null,
    };
  });

  return { caseStudy, caseStudies, caseStudyOutro: { title: caseStudyOutro?.Title, text: caseStudyOutro?.Text }, author: caseStudy.authors, description: caseStudy.abstract };
};
