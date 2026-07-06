import { get } from 'lodash-es';
import { KEY_CHARACTERISTICS, KEY_SCENARIO_YEAR_DESCRIPTION, SCENARIO_DATA_KEYS } from '$config';

// We use different locals to simulate different versions of the content.
// Version 0: `en` and fallback version
// Version 1: `en-EU`
const ENV_CONTENT_LOCALE = import.meta.env.VITE_STRAPI_LOCALE;
const localCode = ENV_CONTENT_LOCALE ?? 'en';
const ENV_URL_CONTENT = import.meta.env.VITE_CMS_URL;
// Legacy Climate Analytics API — used for impact-time, unavoidable-risk,
// impact-geo, geo-shape, avoiding-impacts, avoiding-reference.
const ENV_URL_DATA = import.meta.env.VITE_DATA_API_URL;
// New Hono adapter — used for the indicator catalogue surface (/meta and
// related). Falls back to the legacy URL until the cutover is complete.
const ENV_URL_API = import.meta.env.VITE_API_URL ?? ENV_URL_DATA;

export const loadFromStrapi = function (path, fetch, populate = 'populate=*', qs) {
  return new Promise(async (resolve, reject) => {
    if (typeof ENV_URL_CONTENT === 'undefined') {
      reject(new Error('Content URL is not defined. Check environment variables.'));
    }
    if (typeof ENV_CONTENT_LOCALE === 'undefined') {
      console.warn(`Content version variable in undefined. Fallback version is used.`);
    }
    const url = `${ENV_URL_CONTENT}/api/${path}?${populate}&locale=${localCode}&pagination[limit]=9999${qs ? `&${qs}` : ''}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      resolve(data.data);
    } catch (e) {
      console.warn(`Failed to fetch url ${url} with error ${e}.`);
      reject(new Error('Failed to fetch.'));
    }
  });
};

// Load data from Climate Analytics API
// We use the fetch function provided by Svelte if provided.
export const loadFromAPI = async function (url, svelteFetch = fetch, props = {}) {
  try {
    const res = await svelteFetch(url);
    if (!res.ok) {
      console.warn(`loadFromAPI ${url} → HTTP ${res.status}`);
      return undefined;
    }
    const data = await res.json();
    return { ...props, ...data };
  } catch (e) {
    console.warn(`loadFromAPI ${url} threw:`, e);
    return undefined;
  }
};

// Singular labels used as a backup when the API doesn't supply one.
const labelsSingular = {
  admin0: 'Country',
  cities: 'City',
};

// The catalog API (Hono adapter) speaks JSON with strict:false trailing slashes.
const apiUrl = (path) => `${ENV_URL_API}/${path}/`;

async function getJSON(url, svelteFetch = fetch) {
  const res = await svelteFetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

// Geography slice — the selectable place tree. Sourced from the `/geographies`
// module (flat rows + types), grouped here into the per-type shape the stores
// consume: `{ geographyTypes, <typeUid>: [...] }`. Pure D1 on the server, so
// this is the cheap slice. Loaded only on the data sections, never globally.
export const loadGeographies = async function (svelteFetch = fetch) {
  const [types, geographies] = await Promise.all([
    getJSON(apiUrl('geographies/types'), svelteFetch),
    getJSON(apiUrl('geographies'), svelteFetch),
  ]);

  const geographyTypes = types.map((t) => ({
    uid: t.id,
    label: t.label,
    labelSingular: t.labelSingular ?? labelsSingular[t.id] ?? t.label,
    order: t.order ?? undefined,
    isAvailable: t.isAvailable ?? true,
    isSelectable: t.isSelectable ?? true,
  }));

  const byType = {};
  for (const g of geographies) {
    (byType[g.geographyType] ??= []).push({
      uid: g.id,
      label: g.label,
      geoId: g.geoId ?? undefined,
      parents: g.parents ?? [],
    });
  }

  return { geographyTypes, ...byType };
};

// Catalog slice — the searchable indicators (+ their parameter dimensions) and
// the scenario universe, from the `/catalog` module (the expensive ixmp4 scan),
// merged with the Strapi descriptions the UI shows. This is the slice that used
// to make `/meta` slow, so it loads only where charts/selectors live.
export const loadCatalog = async function (svelteFetch = fetch) {
  const [descriptionIndicators, descriptionScenarios, catalog] = await Promise.all([
    loadFromStrapi('indicators', svelteFetch),
    loadFromStrapi('scenarios', svelteFetch),
    getJSON(apiUrl('catalog'), svelteFetch),
  ]);

  return {
    indicatorParameters: catalog.indicatorParameters,
    indicators: catalog.indicators.map((indicator) => ({
      ...indicator,
      description: get(
        descriptionIndicators.find((d) => d.attributes.UID === indicator.uid),
        ['attributes', 'Description'],
      ),
    })),
    scenarios: catalog.scenarios.map((scenario) => {
      // Find the correct scenario in the list coming from Strapi
      const currentScenario = descriptionScenarios.find((d) => d.attributes.UID === scenario.uid);
      if (typeof currentScenario === 'undefined') {
        console.warn(`Scenario could not be found. This may be caused by a mismatch of the content versions.`);
      }
      const description = get(currentScenario, ['attributes', 'Description']);
      const descriptionYears = get(currentScenario, ['attributes', 'ScenarioCharacteristics'], [])
        .map(({ Year: year, Description: description }) => (year && description ? { year, description } : false))
        .filter((d) => Boolean(d))
        .sort((a, b) => a.year - b.year);

      // Convention scenarios carry no timeline data ({uid,label} only), so these
      // keys resolve to null as before — preserved so timeline components that
      // read them keep their existing (empty) behaviour.
      const timelineData = Object.fromEntries(
        SCENARIO_DATA_KEYS.map((key) => {
          if (!scenario.hasOwnProperty(key)) return [key, null];
          const { data, yearStart, yearStep } = scenario[key];
          if (!data) return [key, null];
          const seriesData = data.map((datum, i) => {
            const hasRange = datum.length > 1;
            const obj = { year: yearStart + yearStep * i, value: datum };
            if (hasRange) {
              obj['value'] = datum[1];
              obj['min'] = datum[0];
              obj['max'] = datum[2];
            }
            return obj;
          });
          return [key, seriesData];
        }),
      );

      return {
        ...scenario,
        description,
        ...timelineData,
        [KEY_SCENARIO_YEAR_DESCRIPTION]: descriptionYears,
        [KEY_CHARACTERISTICS]: scenario.characteristics,
      };
    }),
  };
};

// Curation slice — the transitional study-locations + likelihoods remnants not
// yet derivable from conventions. Tiny static data; loaded only by the sections
// that use it (avoid, adaptation).
export const loadCuration = async function (svelteFetch = fetch) {
  const [studyLocations, likelihoods] = await Promise.all([
    getJSON(apiUrl('study-locations'), svelteFetch),
    getJSON(apiUrl('likelihoods'), svelteFetch),
  ]);
  return {
    studyLocations: studyLocations.studyLocations ?? [],
    likelihoods: likelihoods.likelihoods ?? [],
  };
};

export function trimLinebreakAtEnd(str) {
  return (str ?? '').trim().replace(/\n|<br \/>$/g, '');
}
