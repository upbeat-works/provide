import { PATH_EXPLORE, URL_PATH_INDICATOR, URL_PATH_GEOGRAPHY, URL_PATH_SCENARIOS } from '$config';
import { loadFromStrapi, loadGeographies, loadCatalog } from '$utils/apis.js';
import { buildURL } from '$utils/url.js';
import { get, find, compact, uniq, orderBy } from 'lodash-es';

const STORIES_ORDER_GEOGRAPHY_TYPE = ['admin0', 'eez', 'cities'];
const STORIES_ORDER_MODES = ['explore', 'avoid', 'adaptation'];

export const load = async ({ fetch }) => {
  // Stories + caseStudies still resolve against the catalog/geographies slices;
  // assembled into a local `meta`-shaped view here (this landing logic is slated
  // for cleanup separately).
  const [geographies, catalog] = await Promise.all([loadGeographies(fetch), loadCatalog(fetch)]);
  const meta = { ...geographies, indicators: catalog.indicators, scenarios: catalog.scenarios };
  const storiesRaw = await loadFromStrapi('stories', fetch);
  const caseStudies = await loadFromStrapi('case-study-dynamics', fetch, 'populate[CoverImage]=*');

  const stories = orderBy(
    compact(
      storiesRaw.map(({ attributes }) => {
        const { Title: _title, Order: order, Indicator: _indicatorUID, Type, GeographyType: _GeographyType, Geography: _geographyUID, Scenarios: scenarioUIDs } = attributes;
        let geographyUID = _geographyUID.trim();
        let title = _title?.trim();
        let indicatorUID = _indicatorUID.trim();
        let geographyType = _GeographyType.trim();
        const geography = find(get(meta, [geographyType], []), {
          uid: geographyUID,
        });
        const indicator = find(get(meta, 'indicators', []), {
          uid: indicatorUID,
        });
        const scenarioList = uniq(scenarioUIDs.map(({ UID }) => UID.trim()));
        const scenarios = compact(scenarioList.map((uid) => find(get(meta, 'scenarios', []), { uid }))).slice(0, 3);
        if (geography && indicator && scenarios.length) {
          const query = buildURL(Type, { [URL_PATH_INDICATOR]: indicatorUID, [URL_PATH_GEOGRAPHY]: geographyUID, [URL_PATH_SCENARIOS]: scenarioList });
          return {
            id: `${Type}-${geographyType}`,
            title,
            geography,
            indicator,
            scenarios,
            geographyType,
            mode: Type,
            url: `${PATH_EXPLORE}/${Type}${query}`,
            order,
          };
        } else {
          return false;
        }
      })
    ),
    [(d) => STORIES_ORDER_GEOGRAPHY_TYPE.indexOf(d.geographyType), (d) => STORIES_ORDER_MODES.indexOf(d.mode)]
  );

  return {
    // The landing page hosts a functional quick-start selector (SectionExplore),
    // so it needs the geography + catalog slices the stores read.
    geographies,
    catalog,
    stories,
    caseStudies: caseStudies.map((study) => ({
      city: meta.cities.find((d) => d.uid === study.attributes.CityUid) || { uid: 'nassau', label: 'Nassau' },
      abstract: study.attributes.Abstract,
      category: study.attributes.Category ?? 'CASE STUDY',
      image: study.attributes.CoverImage?.data?.attributes ?? null,
    })),
  };
};
