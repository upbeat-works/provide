import { activeFacetGroupCount } from './facet-selection.js';

const PRESENT_DAY_REFERENCE = '2011-2020 (Present Day)';

function defaultParameterValue(parameter) {
  if (parameter.uid === 'reference' && parameter.options.some(({ uid }) => uid === PRESENT_DAY_REFERENCE)) {
    return PRESENT_DAY_REFERENCE;
  }
  return parameter.options[0]?.uid;
}

export function indicatorIdentityKey(indicator) {
  if (!indicator) return undefined;
  return `${indicator.instance}\u0000${indicator.id}`;
}

export function scenarioAvailabilityRows(request) {
  if (request.status !== 'success') return [];
  return (request.data.scenarios ?? []).map((scenario) => ({
    uid: scenario.id,
    label: scenario.label,
    yearStart: scenario.yearStart,
    yearEnd: scenario.yearEnd,
    endYear: scenario.yearEnd,
  }));
}

export function scenariosForTimeframe({ selectedScenarios = [], allScenarios = [] }) {
  const timeframe = selectedScenarios[0]?.endYear;
  const byUid = new Map();
  for (const scenario of [...selectedScenarios, ...allScenarios]) {
    if (!byUid.has(scenario.uid) && scenario.endYear === timeframe) byUid.set(scenario.uid, scenario);
  }
  return [...byUid.values()];
}

export function parameterAdapter({ selection, request, definitions }) {
  const selected = selection.indicator;
  if (!selected || request.status !== 'success') {
    return { parameters: [], nextValues: null, removedKeys: [] };
  }
  const detail = request.data;
  if (detail.id !== selected.id || detail.instance !== selected.instance) {
    return { parameters: [], nextValues: null, removedKeys: [] };
  }
  const parameters = (detail.parameters ?? []).map((parameter) => {
    const definition = definitions.find(({ uid }) => uid === parameter.id);
    return {
      uid: parameter.id,
      label: definition?.label ?? parameter.label ?? parameter.id,
      options: parameter.options.map((option) => ({
        uid: option.id,
        label: definition?.options?.find(({ uid }) => uid === option.id)?.label ?? option.label ?? option.id,
      })),
      description: definition?.description,
    };
  });
  const detailParameters = new Map((detail.parameters ?? []).map((parameter) => [parameter.id, parameter]));
  const nextValues = Object.fromEntries(parameters.map((parameter) => [parameter.uid, defaultParameterValue(parameter)]).filter(([, value]) => value !== undefined));
  const removedKeys = [];
  for (const [key, value] of Object.entries(selection.parameters ?? {})) {
    const detailParameter = detailParameters.get(key);
    if (detailParameter?.options.some((option) => option.id === value)) {
      nextValues[key] = value;
      continue;
    }
    const definition = definitions.find(({ uid }) => uid === key);
    if (definition?.options?.some(({ uid }) => uid === value)) continue;
    removedKeys.push(key);
  }
  return {
    parameters,
    nextValues,
    removedKeys,
  };
}

export function indicatorFilterInput({ mode, geography, filters }) {
  const hasFilters = activeFacetGroupCount(filters) > 0;
  if (mode === 'geography' && geography) return { region: geography, filters };
  if (hasFilters) return { filters };
  return undefined;
}

export function indicatorFilterKey({ region, filters }) {
  const entries = Object.entries(filters ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, values]) => [key, [...values].sort()]);
  return JSON.stringify({ region, filters: Object.fromEntries(entries) });
}

export function listRequestView({ request, items }) {
  let status = request.status;
  if (status === 'idle') status = 'loading';
  if (status === 'success') status = items.length ? 'ready' : 'empty';
  return {
    status,
    items,
    hasPartialFailure: Boolean(request.data?.failedInstances?.length),
  };
}

export function indicatorListRequest({ mode, geography, filters, indexRequest, filteredRequest }) {
  if (indexRequest.status !== 'success') return indexRequest;
  if (indicatorFilterInput({ mode, geography, filters })) return filteredRequest;
  return indexRequest;
}

export function indicatorScopeMatches(request, context) {
  if (request.status !== 'success') return false;
  const expected = indicatorFilterInput(context);
  if (!expected) return true;
  const actual = request.data?.context;
  if (!actual) return false;
  return indicatorFilterKey(actual) === indicatorFilterKey(expected);
}

export function ownedIndicatorRequest(response) {
  return { status: 'success', data: response };
}

export function indicatorControlAdapter({ ownedRequest, context, indexRequest, filteredRequest }) {
  if (ownedRequest) {
    return {
      request: ownedIndicatorRequest(ownedRequest.data),
      syncContext: undefined,
      showAdvancedFilters: false,
      ownedRetryStatus: ownedRequest.status,
      ownedRetryAvailable: ownedRequest.status !== 'loading',
    };
  }
  return {
    request: indicatorListRequest({ ...context, indexRequest, filteredRequest }),
    syncContext: context,
    showAdvancedFilters: true,
    ownedRetryStatus: undefined,
    ownedRetryAvailable: undefined,
  };
}

export function geographyListRequest({ mode, selection, indexRequest, availabilityRequest }) {
  if (indexRequest.status !== 'success') return indexRequest;
  if (mode === 'indicator' && selection.indicator) return availabilityRequest;
  return indexRequest;
}

export function geographyControlView({ selection, pendingSelection, request, items }) {
  return {
    selectedId: selection.geography,
    pending: Boolean(selection.geography) && pendingSelection.geography === selection.geography,
    list: listRequestView({ request, items }),
  };
}

export function filteredIndicatorIds({ request, selection }) {
  if (request.status !== 'success') return undefined;
  const ids = new Set((request.data.indicators ?? []).map(indicatorIdentityKey));
  const selected = selection.indicator;
  const selectedSourceFailed = selected && (request.data.failedInstances ?? []).some(({ instance }) => instance === selected.instance);
  if (selectedSourceFailed) ids.add(indicatorIdentityKey(selected));
  return ids;
}

export function indicatorSelectionAvailable({ selection, indicators, request }) {
  if (!selection.indicator) return false;
  if (request.status !== 'success') return true;
  if ((request.data.failedInstances ?? []).some(({ instance }) => instance === selection.indicator.instance)) return true;
  const selectedKey = indicatorIdentityKey(selection.indicator);
  return indicators.some((indicator) => indicatorIdentityKey({ id: indicator.uid, instance: indicator.instance }) === selectedKey);
}

function scenarioChartView({ combinationAvailable, availability, indicatorScopeRequest, indicatorScopeContext, selection }) {
  if (!combinationAvailable) return { status: 'hidden' };
  if (indicatorScopeRequest.status === 'idle' || indicatorScopeRequest.status === 'loading') return { status: 'loading' };
  if (indicatorScopeRequest.status === 'failure') return { status: 'failure', failedRequest: 'indicatorScope' };
  if (!indicatorScopeMatches(indicatorScopeRequest, indicatorScopeContext)) return { status: 'loading' };
  if (availability.status === 'idle' || availability.status === 'loading') return { status: 'loading' };
  if (availability.status === 'failure') return { status: 'failure', failedRequest: 'availability' };
  if (!scenarioAvailabilityMatches(availability, selection)) return { status: 'loading' };
  if (!(availability.data.scenarios ?? []).length) return { status: 'empty' };
  return { status: 'ready' };
}

export function warmingChartView(input) {
  return scenarioChartView(input);
}

export function warmingChartRequest({ view, geography, indicator, scenarios, parameters }) {
  if (view.status !== 'ready') return undefined;
  return {
    geography,
    indicator: indicator?.id,
    instance: indicator?.instance,
    scenarios: scenarios.map(({ uid }) => uid),
    ...parameters,
  };
}

function sameParameterValues(left = {}, right = {}) {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  if (leftEntries.length !== rightEntries.length) return false;
  return leftEntries.every(([key, value]) => right[key] === value);
}

export function scenarioAvailabilityMatches(availability, selection) {
  if (availability.status !== 'success') return false;
  const context = availability.data.context;
  if (!context) return false;
  if (indicatorIdentityKey(context.indicator) !== indicatorIdentityKey(selection.indicator)) return false;
  if (context.geography !== selection.geography) return false;
  return sameParameterValues(context.parameters, selection.parameters);
}

export function percentileChartView({ combinationAvailable, availability, indicatorScopeRequest, indicatorScopeContext, selection }) {
  return scenarioChartView({ combinationAvailable, availability, indicatorScopeRequest, indicatorScopeContext, selection });
}

export function percentileChartRequest(view, request) {
  if (view.status !== 'ready') return undefined;
  return request;
}

export async function retryPercentileChartRequest({ view, flow, indicatorScopeContext }) {
  if (view.failedRequest === 'indicatorScope') return flow.retryIndicatorScope(indicatorScopeContext);
  if (view.failedRequest === 'availability') return flow.retryPercentileAvailability();
}

export async function retryWarmingChartRequest({ view, flow, indicatorScopeContext }) {
  if (view.failedRequest === 'indicatorScope') return flow.retryIndicatorScope(indicatorScopeContext);
  if (view.failedRequest === 'availability') return flow.retryWarmingLevelAvailability();
}

export function scenarioControlView({ request, items }) {
  return listRequestView({ request, items });
}

export function ownedScenarioControlView(items) {
  return listRequestView({ request: { status: 'success' }, items });
}

export function advancedFilterControlView({ request, groups }) {
  return listRequestView({ request, items: groups });
}

export function scenarioDetailLoadKey({ scenarioId, indicator }) {
  if (!scenarioId || !indicator?.id || !indicator.instance) return undefined;
  return `${indicator.instance}\u0000${indicator.id}\u0000${scenarioId}`;
}
