import { buildAvoidMeta } from '$lib/catalog/avoid-meta.js';
import { CATALOG_TIMEOUT_MS, CMS_TIMEOUT_MS, HEAVY_TIMEOUT_MS, requestJson } from '$lib/requests/index.js';

// We use different locals to simulate different versions of the content.
// Version 0: `en` and fallback version
// Version 1: `en-EU`
const ENV_CONTENT_LOCALE = import.meta.env.VITE_STRAPI_LOCALE;
const localCode = ENV_CONTENT_LOCALE ?? 'en';
// These loaders run server-side (in +*.server.js). In a containerised stack the
// server can't resolve the browser origin (e.g. `/api` via nginx), so during SSR
// we prefer an internal service URL when one is provided (VITE_*_INTERNAL, e.g.
// http://api:8080/api). The browser always uses the public value. Both fall back
// to the public URL when no internal one is set (host dev, static prod build).
const SSR = import.meta.env.SSR;
const ENV_URL_CONTENT = (SSR && import.meta.env.VITE_CMS_URL_INTERNAL) || import.meta.env.VITE_CMS_URL;
// Legacy Climate Analytics API — public, resolvable from anywhere; used for
// impact-time, unavoidable-risk, impact-geo, geo-shape, avoiding-*.
const ENV_URL_DATA = import.meta.env.VITE_DATA_API_URL;
// Hono adapter for source-bound catalog resources.
const ENV_URL_API = (SSR && import.meta.env.VITE_API_URL_INTERNAL) || import.meta.env.VITE_API_URL;

const joinUrl = (base, path) => `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

export const catalogApiUrl = (path) => {
  if (!ENV_URL_API) throw new TypeError('Catalog API URL is not configured');
  return joinUrl(ENV_URL_API, path);
};

export const catalogContentUrl = (collection, id) => {
  const query = ['fields[0]=UID', 'fields[1]=Description', `locale=${encodeURIComponent(localCode)}`, 'pagination[limit]=1', `filters[UID][$eq]=${encodeURIComponent(id)}`].join('&');
  return `${joinUrl(ENV_URL_CONTENT, `api/${collection}`)}?${query}`;
};

export const catalogScenarioLabelsUrl = (ids) => {
  if (!ENV_URL_CONTENT) throw new TypeError('Content URL is not configured');
  const query = new URLSearchParams();
  query.set('fields[0]', 'UID');
  query.set('fields[1]', 'Label');
  query.set('locale', localCode);
  query.set('pagination[limit]', String(ids.length));
  ids.forEach((id, index) => query.set(`filters[UID][$in][${index}]`, id));
  return `${joinUrl(ENV_URL_CONTENT, 'api/scenarios')}?${query}`;
};

export async function loadFromStrapi(path, fetch, populate = 'populate=*', qs, { signal, timeoutMs = CATALOG_TIMEOUT_MS } = {}) {
  if (typeof ENV_URL_CONTENT === 'undefined') {
    throw new Error('Content URL is not defined. Check environment variables.');
  }
  if (typeof ENV_CONTENT_LOCALE === 'undefined') {
    console.warn('Content locale is undefined. Using the default locale.');
  }
  const url = `${ENV_URL_CONTENT}/api/${path}?${populate}&locale=${localCode}&pagination[limit]=9999${qs ? `&${qs}` : ''}`;
  const data = await requestJson(url, { fetch, signal, timeoutMs });
  return data.data;
}

export async function loadFromAPI(url, { fetch, signal } = {}) {
  try {
    return await requestJson(url, { fetch, signal, timeoutMs: HEAVY_TIMEOUT_MS });
  } catch (error) {
    signal?.throwIfAborted();
    if (error?.name === 'AbortError') throw error;
    console.warn('Data API request failed', { status: error?.status, errorType: error?.name });
    return undefined;
  }
}

// Singular labels used as a backup when the API doesn't supply one.
const labelsSingular = {
  admin0: 'Country',
  cities: 'City',
};

// The catalog API (Hono adapter) speaks JSON with strict:false trailing slashes.
const apiUrl = (path) => `${catalogApiUrl(path)}/`;

function getJSON(url, svelteFetch, { signal, timeoutMs = CATALOG_TIMEOUT_MS } = {}) {
  return requestJson(url, { fetch: svelteFetch, signal, timeoutMs });
}

// Geography slice — the selectable place tree. Sourced from the `/geographies`
// module (flat rows + types), grouped here into the per-type shape the stores
// consume: `{ geographyTypes, <typeUid>: [...] }`. Pure D1 on the server, so
// this is the cheap slice. Loaded only on the data sections, never globally.
export const loadGeographies = async function (svelteFetch = fetch) {
  const [types, geographies] = await Promise.all([getJSON(apiUrl('geographies/types'), svelteFetch), getJSON(apiUrl('geographies'), svelteFetch)]);

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

export const loadIndicatorIndex = async function (svelteFetch = fetch) {
  const response = await getJSON(apiUrl('indicators'), svelteFetch);
  return {
    ...response,
    indicators: (response.indicators ?? []).map((indicator) => ({
      ...indicator,
      uid: indicator.id,
    })),
  };
};

function gmtSeries(gmt) {
  if (!gmt) return undefined;
  return gmt.data.map(([min, value, max], index) => ({
    year: gmt.yearStart + gmt.yearStep * index,
    min,
    value,
    max,
  }));
}

function emissionsSeries(emissions) {
  if (!emissions) return undefined;
  return emissions.data.map(({ year, value }) => ({ year, value }));
}

export const loadMethodologyScenarios = async function (svelteFetch = fetch, { instance } = {}) {
  let url = apiUrl('methodology-scenarios');
  if (instance !== undefined) url += `?instance=${encodeURIComponent(instance)}`;
  const scenarios = await getJSON(url, svelteFetch);
  return scenarios.map((scenario) => ({
    ...scenario,
    uid: scenario.id,
    startYear: scenario.yearStart,
    endYear: scenario.yearEnd,
    gmt: gmtSeries(scenario.gmt),
    emissions: emissionsSeries(scenario.emissions),
  }));
};

async function scoreboardResource(resource, svelteFetch, selections, fields, options) {
  const params = new URLSearchParams();
  for (const key of fields) {
    if (selections[key] !== undefined) params.set(key, selections[key]);
  }
  return getJSON(`${apiUrl(`scoreboard/${resource}`)}?${params}`, svelteFetch, options);
}

const SCOREBOARD_SHARED_FIELDS = ['sector', 'scenario', 'region', 'year'];

export const loadScoreboardDefinition = (svelteFetch = fetch, selections = {}, options) => scoreboardResource('definition', svelteFetch, selections, ['sector', 'indicator'], options);
export const loadScoreboardMap = (svelteFetch = fetch, selections = {}, { signal } = {}) =>
  scoreboardResource('map', svelteFetch, selections, ['sector', 'indicator', 'scenario', 'region', 'year'], { signal, timeoutMs: HEAVY_TIMEOUT_MS });
export const loadScoreboardChart = (svelteFetch = fetch, selections = {}, { signal } = {}) =>
  scoreboardResource(`charts/${encodeURIComponent(selections.chartId)}`, svelteFetch, selections, SCOREBOARD_SHARED_FIELDS, { signal, timeoutMs: HEAVY_TIMEOUT_MS });

// Curation slice — the transitional study-locations + likelihoods remnants not
// yet derivable from conventions. Tiny static data; loaded only by the sections
// that use it (avoid, adaptation).
export const loadCuration = async function (svelteFetch = fetch) {
  const [studyLocations, likelihoods] = await Promise.all([getJSON(apiUrl('study-locations'), svelteFetch), getJSON(apiUrl('likelihoods'), svelteFetch)]);
  return {
    studyLocations: studyLocations.studyLocations ?? [],
    likelihoods: likelihoods.likelihoods ?? [],
  };
};

// Loads the frozen legacy catalog for the avoid page. Legacy host only — never
// touches the ixmp4 / Hono adapter. Pure shaping lives in `buildAvoidMeta`
// (src/lib/catalog/avoid-meta.js), kept alias-free so it is unit-testable.
export const loadAvoidMeta = async function (svelteFetch = fetch) {
  // Scenario labels come from the frozen /meta itself; only indicator
  // descriptions need Strapi enrichment.
  const [meta, indicators] = await Promise.all([getJSON(`${ENV_URL_DATA}/meta/`, svelteFetch), loadFromStrapi('indicators', svelteFetch, undefined, undefined, { timeoutMs: CMS_TIMEOUT_MS }).catch(() => [])]);
  return buildAvoidMeta(meta, { indicators });
};

export function trimLinebreakAtEnd(str) {
  return (str ?? '').trim().replace(/\n|<br \/>$/g, '');
}
