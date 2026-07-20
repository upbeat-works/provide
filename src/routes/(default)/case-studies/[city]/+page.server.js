import { error } from '@sveltejs/kit';
import { loadFromAPI, loadFromStrapi } from '$utils/apis.js';
import { parse } from 'marked';
import qs from 'qs';
import { scaleLinear } from 'd3-scale';
import { each } from 'lodash-es';
import { END_AVOIDING_IMPACTS, END_AVOIDING_REFERENCE, URL_PATH_CERTAINTY_LEVEL, URL_PATH_GEOGRAPHY, URL_PATH_INDICATOR, URL_PATH_LEVEL_OF_IMPACT } from '$config';

export const load = async ({ fetch, parent, params }) => {
  const { geographies, catalog, curation } = await parent();
  const meta = {
    cities: geographies.cities ?? [],
    indicators: catalog.indicators ?? [],
    scenarios: catalog.scenarios ?? [],
    likelihoods: curation.likelihoods ?? [],
    studyLocations: curation.studyLocations ?? [],
  };

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

  // Strapi CityUid is the lowercase slug (e.g. "lisbon"), which matches a city
  // geography's `geoId`, not its `uid` (the ixmp4 id, e.g. "Lisbon"). Expose the
  // city with uid=slug so /adaptation/<slug> links resolve back here.
  const cityGeo = meta.cities.find((c) => c.geoId === caseStudyRaw.CityUid);
  if (!cityGeo) error(404, { message: 'City not found in data' });
  const city = { ...cityGeo, uid: caseStudyRaw.CityUid };

  const loadAvoidingImpactsData = async ({ Indicators = [], StudyLocations = [] }) => {
    if (!Indicators.length || !StudyLocations.length) return [];

    // Load all avoiding impacts reference data
    const refRequests = Indicators.map(({ Uid: indicatorUid }) => {
      const indicator = meta.indicators.find((d) => d.uid === indicatorUid);
      if (!indicator) error(404, { message: `Indicator ${indicatorUid} not found in metadata` });

      const query = qs.stringify({
        [URL_PATH_GEOGRAPHY]: caseStudyRaw.CityUid,
        [URL_PATH_INDICATOR]: indicator.uid,
      });

      return loadFromAPI(`${import.meta.env.VITE_DATA_API_URL}/${END_AVOIDING_REFERENCE}?${query}`, fetch, { indicator });
    });

    const refData = await Promise.all(refRequests);

    // For each indicator load a number of sample impact levels and likelihood
    const dataRequests = refData.reduce((acc, { impact_levels, indicator }) => {
      const impactSteps = scaleLinear().domain(impact_levels.range_of_interest).ticks(5);

      impactSteps.forEach((impactLevel) => {
        meta.likelihoods.forEach((likelihood) => {
          const query = qs.stringify({
            [URL_PATH_GEOGRAPHY]: caseStudyRaw.CityUid,
            [URL_PATH_INDICATOR]: indicator.uid,
            [URL_PATH_LEVEL_OF_IMPACT]: impactLevel,
            [URL_PATH_CERTAINTY_LEVEL]: likelihood.uid,
          });

          acc.push(loadFromAPI(`${import.meta.env.VITE_DATA_API_URL}/${END_AVOIDING_IMPACTS}?${query}`, fetch, { indicator, impactLevel, likelihood }));
        });
      });
      return acc;
    }, []);

    const data = await Promise.all(dataRequests);

    // Process loaded data so we have an array of study location/indicator combinations each
    // containing an array of scenario/impact level/likelihood combinations
    const processedData = refData.reduce((acc, { indicator }) => {
      const indicatorData = data.filter((d) => d.indicator.uid === indicator.uid);

      StudyLocations.forEach(({ Uid: studyLocationUid }) => {
        const studyLocation = meta.studyLocations.find((d) => d.uid === studyLocationUid);
        if (!studyLocation) error(404, { message: `Study location ${studyLocationUid} not found in metadata` });
        const table = [];
        indicatorData.forEach((indicatorDatum) => {
          each(indicatorDatum.study_locations[studyLocationUid].scenarios, ({ year }, scenario) => {
            table.push({
              ...indicatorDatum,
              studyLocation,
              indicator,
              year: { uid: year, label: year },
              scenario: meta.scenarios.find((d) => d.uid === scenario),
            });
          });
        });
        acc.push(table);
      });

      return acc;
    }, []);

    return processedData;
  };

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
                explorerUrl: c.ExplorerUrl,
              };
            case 'future-impacts': {
              // Resolve each snapshot's indicator against the convention catalog.
              // Legacy urbclim-* slugs aren't in the catalog yet, so skip those
              // snapshots instead of 404ing the whole page.
              const resolveSnapshot = (snpsht, extra) => {
                const indicator = meta.indicators.find((d) => d.uid === snpsht.Indicator);
                return indicator ? { indicator, image: snpsht.Image?.data?.attributes, ...extra } : null;
              };
              const impactGeoSnapshots = c.ImpactGeoSnapshot.map((s) => resolveSnapshot(s, { year: s.Year })).filter(Boolean);
              const impactTimeSnapshots = c.ImpactTimeSnapshot.map((s) => resolveSnapshot(s, {})).filter(Boolean);
              // FutureImpacts needs at least one time AND one geo snapshot to
              // render; drop the whole block when that data isn't available.
              if (!impactGeoSnapshots.length || !impactTimeSnapshots.length) return null;
              return {
                type,
                explorerUrl: c.ExplorerUrl,
                impactGeoDescription: c.ImpactGeoDescription,
                impactTimeDescription: c.ImpactTimeDescription,
                impactGeoSnapshots,
                impactTimeSnapshots,
              };
            }
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
      )
    ).filter(Boolean),
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
