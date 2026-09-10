import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { SELECTED_LIKELIHOOD_LEVEL, LEVEL_OF_IMPACT_ARRAY } from '$stores/avoid.js';
import { catalogFlow } from '$stores/catalog-flow.js';
import {
  URL_PATH_FREQUENCY,
  URL_PATH_INDICATOR_VALUE,
  URL_PATH_CERTAINTY_LEVEL,
  URL_PATH_LEVEL_OF_IMPACT,
  PATH_AVOID,
  URL_PATH_INDICATOR,
  URL_PATH_GEOGRAPHY,
  URL_PATH_SCENARIOS,
  URL_PATH_TIME,
  URL_PATH_REFERENCE,
  URL_PATH_SPATIAL,
  MAX_NUMBER_SELECTABLE_SCENARIOS,
} from '$config';
import { autoType } from 'd3-dsv';
import { parse, stringify } from 'qs';

const catalogUrlKeys = [URL_PATH_INDICATOR, 'instance', URL_PATH_GEOGRAPHY, URL_PATH_SCENARIOS, URL_PATH_TIME, URL_PATH_REFERENCE, URL_PATH_FREQUENCY, URL_PATH_SPATIAL, URL_PATH_INDICATOR_VALUE];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseCatalogUrlSelection(url) {
  const params = parse(url.search.replace(/^\?/, ''));
  const parameters = {};
  for (const key of [URL_PATH_TIME, URL_PATH_REFERENCE, URL_PATH_FREQUENCY, URL_PATH_SPATIAL, URL_PATH_INDICATOR_VALUE]) {
    if (isNonEmptyString(params[key])) parameters[key] = params[key];
  }

  let scenarios = [];
  if (Array.isArray(params[URL_PATH_SCENARIOS])) {
    scenarios = params[URL_PATH_SCENARIOS].filter(isNonEmptyString);
  } else if (isNonEmptyString(params[URL_PATH_SCENARIOS])) {
    scenarios = [params[URL_PATH_SCENARIOS]];
  }

  const selection = {
    parameters,
    scenarios: scenarios.slice(0, MAX_NUMBER_SELECTABLE_SCENARIOS),
  };
  if (isNonEmptyString(params[URL_PATH_GEOGRAPHY])) selection.geography = params[URL_PATH_GEOGRAPHY];
  if (isNonEmptyString(params.instance) && (isNonEmptyString(params[URL_PATH_INDICATOR]) || selection.scenarios.length)) selection.instance = params.instance;
  if (isNonEmptyString(params[URL_PATH_INDICATOR]) && selection.instance) {
    selection.indicator = params[URL_PATH_INDICATOR];
  }
  return selection;
}

export function replaceCatalogUrlSelection(url, selection) {
  const next = new URL(url);
  for (const key of [...next.searchParams.keys()]) {
    if (catalogUrlKeys.includes(key) || key.startsWith(`${URL_PATH_SCENARIOS}[`)) {
      next.searchParams.delete(key);
    }
  }

  if (selection.indicator) {
    next.searchParams.set(URL_PATH_INDICATOR, selection.indicator.id);
    next.searchParams.set('instance', selection.indicator.instance);
  }
  if (isNonEmptyString(selection.geography)) next.searchParams.set(URL_PATH_GEOGRAPHY, selection.geography);
  for (const [index, scenario] of (selection.scenarios ?? []).slice(0, MAX_NUMBER_SELECTABLE_SCENARIOS).entries()) {
    if (isNonEmptyString(scenario)) next.searchParams.set(`${URL_PATH_SCENARIOS}[${index}]`, scenario);
  }
  for (const key of [URL_PATH_TIME, URL_PATH_REFERENCE, URL_PATH_FREQUENCY, URL_PATH_SPATIAL, URL_PATH_INDICATOR_VALUE]) {
    const value = selection.parameters?.[key];
    if (isNonEmptyString(value)) next.searchParams.set(key, value);
  }
  return next;
}

function hasCatalogSelection(selection) {
  if (selection.indicator || selection.geography) return true;
  if (selection.scenarios.length) return true;
  return Object.keys(selection.parameters).length > 0;
}

const urlToStateMapping = [
  { key: URL_PATH_CERTAINTY_LEVEL, apply: (value) => SELECTED_LIKELIHOOD_LEVEL.set(value) },
  {
    key: URL_PATH_LEVEL_OF_IMPACT,
    apply: (value) => LEVEL_OF_IMPACT_ARRAY.set(Array.isArray(value) ? value : [value]),
  },
];

export const parseUrlQuery = (url) => {
  if (!browser) {
    return {};
  }
  const params = parse(url.search.replace(/^\?/, ''));

  // Filter out all values that are strings (not arrays) so we can pass them to autotype
  const stringParams = Object.entries(params)
    .filter(([key, value]) => typeof value === 'string')
    .reduce((memo, [key, value]) => ({ ...memo, [key]: value }), {});
  return {
    ...params,
    ...autoType(stringParams),
  };
};

function removeParamFromURL(param, key, url) {
  if (Array.isArray(param)) {
    param.forEach((p, i) => url.searchParams.delete(`${key}[${i}]`));
  } else {
    url.searchParams.delete(key);
  }
}

export function urlToState(currentUrl) {
  if (!browser) return false;
  const url = new URL(currentUrl);
  const params = parse(url.search.replace(/^\?/, ''));
  if (catalogUrlKeys.some((key) => params[key] != null)) {
    const selection = parseCatalogUrlSelection(url);
    if (hasCatalogSelection(selection)) catalogFlow.restoreSelection(selection);
    for (const key of catalogUrlKeys) {
      if (params[key] != null) removeParamFromURL(params[key], key, url);
    }
  }
  urlToStateMapping.forEach(({ key, apply }) => {
    const param = params[key];
    if (!param) return;
    removeParamFromURL(param, key, url);
    apply(param);
  });
  // `goto` changes `$page.url`, so navigate only when this call consumed a value.
  if (url.href !== String(currentUrl)) {
    goto(url.href, { replaceState: true, noScroll: true, keepFocus: true });
  }
}

export function buildURL(url, params = {}) {
  let indicator;
  const instance = isNonEmptyString(params.instance) ? params.instance : undefined;
  if (isNonEmptyString(params[URL_PATH_INDICATOR]) && instance) {
    indicator = params[URL_PATH_INDICATOR];
  }
  let scenarios = [];
  if (Array.isArray(params[URL_PATH_SCENARIOS])) {
    scenarios = [...params[URL_PATH_SCENARIOS]].filter(isNonEmptyString).sort().slice(0, MAX_NUMBER_SELECTABLE_SCENARIOS);
  }
  const obj = {
    [URL_PATH_INDICATOR]: indicator,
    instance,
    [URL_PATH_GEOGRAPHY]: isNonEmptyString(params[URL_PATH_GEOGRAPHY]) ? params[URL_PATH_GEOGRAPHY] : undefined,
    [URL_PATH_SCENARIOS]: scenarios,
    [URL_PATH_TIME]: isNonEmptyString(params[URL_PATH_TIME]) ? params[URL_PATH_TIME] : undefined,
    [URL_PATH_REFERENCE]: isNonEmptyString(params[URL_PATH_REFERENCE]) ? params[URL_PATH_REFERENCE] : undefined,
    [URL_PATH_SPATIAL]: isNonEmptyString(params[URL_PATH_SPATIAL]) ? params[URL_PATH_SPATIAL] : undefined,
    [URL_PATH_FREQUENCY]: isNonEmptyString(params[URL_PATH_FREQUENCY]) ? params[URL_PATH_FREQUENCY] : undefined,
    [URL_PATH_INDICATOR_VALUE]: isNonEmptyString(params[URL_PATH_INDICATOR_VALUE]) ? params[URL_PATH_INDICATOR_VALUE] : undefined,
  };
  if (url === PATH_AVOID) {
    obj[URL_PATH_LEVEL_OF_IMPACT] = params[URL_PATH_LEVEL_OF_IMPACT];
    obj[URL_PATH_CERTAINTY_LEVEL] = params[URL_PATH_CERTAINTY_LEVEL];
  }

  const query = stringify(obj, {
    encodeValuesOnly: true,
  });
  return `?${query}`;
}

export function checkCurrentLink(href, page) {
  return page?.url?.pathname === href || page?.url?.pathname?.startsWith(href);
}
