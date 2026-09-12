import { parse } from 'qs';
import { legacyMapView } from '$lib/catalog/legacy-map-request.js';
import { colorScenarios } from './scenarios.js';
import { MAX_NUMBER_SELECTABLE_SCENARIOS } from '$config';
import { formatReadableList } from '$lib/utils/utils.js';

const parameterKeys = ['time', 'reference', 'frequency', 'spatial', 'indicator_value'];

export function parseEmbedParams(url) {
  const params = parse(url.search.replace(/^\?/, ''));
  for (const key of ['year', 'threshold', 'timeframe']) {
    if (typeof params[key] === 'string' && params[key].trim()) params[key] = Number(params[key]);
  }
  params.static = params.static === 'true';
  params.showSatellite = params.showSatellite === 'true';
  return params;
}

function text(value) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function list(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function scenario(uid, endYear) {
  return { uid, label: uid, endYear };
}

export function embedChartContext(params, colors) {
  const parameters = Object.fromEntries(parameterKeys.filter((key) => params[key] != null).map((key) => [key, params[key]]));
  const scenarioIds = list(params.scenarios).map(text).filter(Boolean).slice(0, MAX_NUMBER_SELECTABLE_SCENARIOS);
  const scenarios = colorScenarios(scenarioIds.map((uid) => scenario(uid, params.timeframe)), colors);
  const allScenarios = list(params.allScenarios).map(text).filter(Boolean).map((uid) => scenario(uid, params.timeframe));
  const indicatorId = text(params.indicator);
  const instance = text(params.instance);
  const geographyId = text(params.geography);
  const indicator = indicatorId && instance
    ? {
        uid: indicatorId,
        id: indicatorId,
        instance,
        label: text(params.indicatorLabel) ?? indicatorId,
        unit: text(params.unit) ? { uid: params.unit, label: params.unit } : undefined,
        colorScale: params.colorScale,
        direction: params.direction,
      }
    : undefined;
  const geography = geographyId
    ? { uid: geographyId, id: geographyId, label: text(params.geographyLabel) ?? geographyId, geoId: text(params.geoId), geographyType: text(params.geographyType) }
    : undefined;
  const context = {
    static: Boolean(params.static),
    indicator,
    indicatorLabel: indicator?.label,
    indicatorUnit: indicator?.unit,
    geography,
    scenarios,
    allScenarios,
    parameters,
    indicatorOptions: Object.fromEntries(Object.entries(parameters).map(([key, value]) => [key, { uid: value, label: value }])),
    urlParams: { indicator: params.indicator, instance: params.instance, geography: params.geography, ...parameters },
    view: indicator && geography && scenarios.length ? { status: 'ready' } : { status: 'empty' },
  };
  context.scenarioList = formatReadableList(scenarios, 'label');
  context.mapView = legacyMapView({ chartView: { status: 'ready' }, geography, indicator, scenarios, optionValues: parameters });
  if (!geography?.geoId || !geography.geographyType || !indicator?.unit) context.mapView = { status: 'empty' };
  const warmingReady = context.view.status === 'ready' && allScenarios.length && Number.isFinite(params.timeframe);
  context.warmingView = warmingReady ? { status: 'ready' } : { status: 'empty' };
  return context;
}
