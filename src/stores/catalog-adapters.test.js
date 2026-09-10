import { describe, expect, test } from 'vitest';
import {
  advancedFilterControlView,
  filteredIndicatorIds,
  indicatorControlAdapter,
  indicatorFilterInput,
  indicatorFilterKey,
  indicatorScopeMatches,
  indicatorListRequest,
  indicatorSelectionAvailable,
  geographyListRequest,
  listRequestView,
  ownedIndicatorRequest,
  ownedScenarioControlView,
  parameterAdapter,
  percentileChartRequest,
  percentileChartView,
  scenarioDetailLoadKey,
  scenarioControlView,
  scenarioAvailabilityRows,
  scenariosForTimeframe,
  warmingChartRequest,
  warmingChartView,
} from './catalog-adapters.js';

const selectedIndicator = { id: 'Heat', instance: 'primary' };

describe('catalog consumer adapters', () => {
  test.each(['idle', 'loading', 'failure'])('offers no parameter controls during %s details', (status) => {
    const result = parameterAdapter({
      selection: {
        indicator: selectedIndicator,
        parameters: { time: 'Seasonal', stored: 'Keep' },
      },
      request: status === 'failure' ? { status, error: 'offline' } : { status },
      definitions: [],
    });

    expect(result).toEqual([]);
  });

  test('offers labelled parameter controls only for the selected indicator instance', () => {
    const selection = {
      indicator: selectedIndicator,
      parameters: { time: 'Seasonal', old: 'Remove', reference: 'Historic' },
    };
    const definitions = [
      {
        uid: 'time',
        label: 'Time',
        options: [
          { uid: 'Annual', label: 'Annual label' },
          { uid: 'Seasonal', label: 'Seasonal label' },
        ],
      },
      { uid: 'reference', label: 'Reference', options: [{ uid: 'Historic', label: 'Historic label' }] },
    ];
    const mismatched = parameterAdapter({
      selection,
      request: {
        status: 'success',
        data: { id: 'Heat', instance: 'secondary', parameters: [] },
      },
      definitions,
    });

    expect(mismatched).toEqual([]);

    const result = parameterAdapter({
      selection,
      request: {
        status: 'success',
        data: {
          id: 'Heat',
          instance: 'primary',
          parameters: [
            {
              id: 'time',
              label: 'Time source',
              options: [
                { id: 'Annual', label: 'Annual source' },
                { id: 'Seasonal', label: 'Seasonal source' },
              ],
            },
          ],
        },
      },
      definitions,
    });

    expect(result).toEqual([
      {
        uid: 'time',
        label: 'Time',
        options: [
          { uid: 'Annual', label: 'Annual label' },
          { uid: 'Seasonal', label: 'Seasonal label' },
        ],
        description: undefined,
      },
    ]);
  });

  test('adapts scenario availability to the timeframe field used by charts', () => {
    expect(
      scenarioAvailabilityRows({
        status: 'success',
        data: {
          scenarios: [
            { id: 'Selected', label: 'Selected', yearStart: 2020, yearEnd: 2100 },
            { id: 'Background', label: 'Background', yearStart: 2020, yearEnd: 2100 },
          ],
        },
      })
    ).toEqual([
      { uid: 'Selected', label: 'Selected', yearStart: 2020, yearEnd: 2100, endYear: 2100 },
      { uid: 'Background', label: 'Background', yearStart: 2020, yearEnd: 2100, endYear: 2100 },
    ]);
  });

  test('keeps selected colors and other available scenarios in the chart timeframe', () => {
    const selected = { uid: 'Selected', label: 'Selected', endYear: 2100, color: '#f00' };
    const result = scenariosForTimeframe({
      selectedScenarios: [selected],
      allScenarios: [
        { uid: 'Selected', label: 'Selected', endYear: 2100 },
        { uid: 'Background', label: 'Background', endYear: 2100 },
        { uid: 'Extended', label: 'Extended', endYear: 2300 },
      ],
    });

    expect(result).toEqual([selected, { uid: 'Background', label: 'Background', endYear: 2100 }]);
  });

  test('uses mode, geography, and filters in the indicator request identity', () => {
    const filters = { Sector: ['Health'] };
    const geographyFirst = indicatorFilterInput({ mode: 'geography', geography: 'DEU', filters });
    const changedGeography = indicatorFilterInput({ mode: 'geography', geography: 'FRA', filters });
    const indicatorFirst = indicatorFilterInput({ mode: 'indicator', geography: 'FRA', filters });

    expect(geographyFirst).toEqual({ region: 'DEU', filters });
    expect(indicatorFirst).toEqual({ filters });
    expect(indicatorFilterKey(geographyFirst)).not.toBe(indicatorFilterKey(changedGeography));
    expect(indicatorFilterKey(changedGeography)).not.toBe(indicatorFilterKey(indicatorFirst));
  });

  test.each([
    [{ status: 'idle' }, 'loading'],
    [{ status: 'loading' }, 'loading'],
    [{ status: 'failure', error: 'offline' }, 'failure'],
    [{ status: 'success', data: { indicators: [], failedInstances: [] } }, 'empty'],
  ])('maps request state %s without reporting pending data as empty', (request, expectedStatus) => {
    expect(listRequestView({ request, items: [] }).status).toBe(expectedStatus);
  });

  test('uses filtered indicator state only when mode, geography, or filters require it', () => {
    const indexRequest = { status: 'success', data: { indicators: [] } };
    const filteredRequest = { status: 'loading' };

    expect(
      indicatorListRequest({
        mode: 'geography',
        geography: 'DEU',
        filters: {},
        indexRequest,
        filteredRequest,
      })
    ).toBe(filteredRequest);
    expect(
      indicatorListRequest({
        mode: 'indicator',
        geography: 'DEU',
        filters: {},
        indexRequest,
        filteredRequest,
      })
    ).toBe(indexRequest);
    expect(
      indicatorListRequest({
        mode: 'indicator',
        geography: 'DEU',
        filters: { Sector: ['Health'] },
        indexRequest,
        filteredRequest,
      })
    ).toBe(filteredRequest);
  });

  test('uses geography availability only after the base index and indicator pair exist', () => {
    const indexLoading = { status: 'loading' };
    const indexSuccess = { status: 'success', data: { geographies: [] } };
    const availability = { status: 'failure', error: 'offline' };
    const selection = { indicator: selectedIndicator };

    expect(
      geographyListRequest({
        mode: 'indicator',
        selection,
        indexRequest: indexLoading,
        availabilityRequest: availability,
      })
    ).toBe(indexLoading);
    expect(
      geographyListRequest({
        mode: 'indicator',
        selection,
        indexRequest: indexSuccess,
        availabilityRequest: availability,
      })
    ).toBe(availability);
    expect(
      geographyListRequest({
        mode: 'geography',
        selection,
        indexRequest: indexSuccess,
        availabilityRequest: availability,
      })
    ).toBe(indexSuccess);
  });

  test('keeps a selected indicator available when its filtered source failed and exposes retry state', () => {
    const request = {
      status: 'success',
      data: {
        indicators: [{ id: 'Rain', instance: 'secondary' }],
        failedInstances: [{ instance: 'primary', code: 'unavailable' }],
        filters: [],
      },
    };
    const ids = filteredIndicatorIds({ request, selection: { indicator: selectedIndicator } });
    const view = listRequestView({ request, items: [{ uid: 'Rain', instance: 'secondary' }] });

    expect(ids).toEqual(new Set(['secondary\u0000Rain', 'primary\u0000Heat']));
    expect(
      indicatorSelectionAvailable({
        selection: { indicator: selectedIndicator },
        indicators: [{ uid: 'Rain', instance: 'secondary' }],
        request,
      })
    ).toBe(true);
    expect(view).toMatchObject({ status: 'ready', hasPartialFailure: true });
  });

  test('keeps partial-source state on a server-owned indicator response', () => {
    const response = {
      indicators: [{ id: 'Rain', instance: 'secondary' }],
      failedInstances: [{ instance: 'primary', code: 'unavailable' }],
    };

    const request = ownedIndicatorRequest(response);
    const view = listRequestView({ request, items: [{ uid: 'Rain', instance: 'secondary' }] });

    expect(request).toEqual({ status: 'success', data: response });
    expect(view).toMatchObject({ status: 'ready', hasPartialFailure: true });
  });

  test('isolates a server-owned indicator list from runtime filter controls', () => {
    const response = {
      indicators: [{ id: 'Rain', instance: 'secondary' }],
      failedInstances: [{ instance: 'primary', code: 'unavailable' }],
    };

    const control = indicatorControlAdapter({
      ownedRequest: { status: 'success', data: response },
      context: { mode: 'geography', geography: 'DEU', filters: { sector: ['health'] } },
      indexRequest: { status: 'failure', error: 'global index failed' },
      filteredRequest: { status: 'failure', error: 'global filter failed' },
    });

    expect(control).toEqual({
      request: { status: 'success', data: response },
      syncContext: undefined,
      showAdvancedFilters: false,
      ownedRetryStatus: 'success',
      ownedRetryAvailable: true,
    });
  });

  test('matches a successful filtered indicator request only to its active scope', () => {
    const request = {
      status: 'success',
      data: { context: { region: 'DEU', filters: { Sector: ['Health'] } } },
    };

    expect(indicatorScopeMatches(request, { mode: 'geography', geography: 'DEU', filters: { Sector: ['Health'] } })).toBe(true);
    expect(indicatorScopeMatches(request, { mode: 'geography', geography: 'FRA', filters: { Sector: ['Health'] } })).toBe(false);
  });

  test.each([
    [{ status: 'idle' }, { status: 'loading' }],
    [{ status: 'loading' }, { status: 'loading' }],
    [
      { status: 'failure', error: 'offline' },
      { status: 'failure', failedRequest: 'availability' },
    ],
    [{ status: 'success', data: { context: { indicator: selectedIndicator, geography: 'DEU', parameters: {} }, scenarios: [] } }, { status: 'empty' }],
    [{ status: 'success', data: { context: { indicator: selectedIndicator, geography: 'DEU', parameters: {} }, scenarios: [{ id: 'Low' }] } }, { status: 'ready' }],
  ])('gates warming chart requests on matching availability: %s', (availability, expected) => {
    expect(
      warmingChartView({
        combinationAvailable: true,
        availability,
        indicatorScopeRequest: { status: 'success' },
        indicatorScopeContext: { mode: 'indicator', geography: 'DEU', filters: {} },
        selection: { indicator: selectedIndicator, geography: 'DEU', parameters: {} },
      })
    ).toEqual(expected);
  });

  test.each(['loading', 'failure', 'empty'])('does not build a warming request while availability is %s', (view) => {
    expect(
      warmingChartRequest({
        view: { status: view },
        geography: 'DEU',
        indicator: selectedIndicator,
        scenarios: [{ uid: 'Low' }],
        parameters: { time: 'Annual' },
      })
    ).toBeUndefined();
  });

  test('builds a warming request after confirmed non-empty availability', () => {
    expect(
      warmingChartRequest({
        view: { status: 'ready' },
        geography: 'DEU',
        indicator: selectedIndicator,
        scenarios: [{ uid: 'Low' }, { uid: 'High' }],
        parameters: { time: 'Annual' },
      })
    ).toEqual({
      geography: 'DEU',
      indicator: 'Heat',
      instance: 'primary',
      scenarios: ['Low', 'High'],
      time: 'Annual',
    });
  });

  test.each([
    [{ status: 'idle' }, { status: 'loading' }],
    [{ status: 'loading' }, { status: 'loading' }],
    [
      { status: 'failure', error: 'offline' },
      { status: 'failure', failedRequest: 'availability' },
    ],
    [
      {
        status: 'success',
        data: {
          context: { indicator: selectedIndicator, geography: 'DEU', parameters: { time: 'Annual' } },
          scenarios: [{ id: 'Low' }],
        },
      },
      { status: 'ready' },
    ],
  ])('gates percentile charts on matching availability state: %s', (availability, expected) => {
    expect(
      percentileChartView({
        combinationAvailable: true,
        availability,
        indicatorScopeRequest: { status: 'success' },
        indicatorScopeContext: { mode: 'indicator', geography: 'DEU', filters: {} },
        selection: { indicator: selectedIndicator, geography: 'DEU', parameters: { time: 'Annual' } },
      })
    ).toEqual(expected);
  });

  test.each([
    ['idle', { status: 'loading' }],
    ['loading', { status: 'loading' }],
    ['failure', { status: 'failure', failedRequest: 'indicatorScope' }],
  ])('does not plan percentile charts while the indicator filter scope is %s', (status, expected) => {
    expect(
      percentileChartView({
        combinationAvailable: true,
        availability: {
          status: 'success',
          data: {
            context: { indicator: selectedIndicator, geography: 'DEU', parameters: {} },
            scenarios: [{ id: 'Low' }],
          },
        },
        indicatorScopeRequest: status === 'failure' ? { status, error: 'offline' } : { status },
        indicatorScopeContext: { mode: 'indicator', geography: 'DEU', filters: {} },
        selection: { indicator: selectedIndicator, geography: 'DEU', parameters: {} },
      })
    ).toEqual(expected);
  });

  test('keeps both chart axes loading when a successful indicator response belongs to an old scope', () => {
    const selection = { indicator: selectedIndicator, geography: 'DEU', parameters: {} };
    const availability = { status: 'success', data: { context: selection, scenarios: [{ id: 'Low' }] } };
    const indicatorScopeRequest = {
      status: 'success',
      data: { context: { region: 'FRA', filters: { Sector: ['Health'] } } },
    };
    const indicatorScopeContext = { mode: 'geography', geography: 'DEU', filters: { Sector: ['Health'] } };

    expect(percentileChartView({ combinationAvailable: true, availability, indicatorScopeRequest, indicatorScopeContext, selection })).toEqual({ status: 'loading' });
    expect(warmingChartView({ combinationAvailable: true, availability, indicatorScopeRequest, indicatorScopeContext, selection })).toEqual({ status: 'loading' });
  });

  test.each([
    [{ indicator: selectedIndicator, geography: 'ESP', parameters: { time: 'Annual' } }, 'a previous geography'],
    [{ indicator: selectedIndicator, geography: 'DEU', parameters: { time: 'Seasonal' } }, 'previous parameters'],
    [{ indicator: { id: 'Heat', instance: 'secondary' }, geography: 'DEU', parameters: { time: 'Annual' } }, 'a previous instance'],
  ])('rejects percentile availability for %s', (context) => {
    expect(
      percentileChartView({
        combinationAvailable: true,
        availability: { status: 'success', data: { context, scenarios: [{ id: 'Low' }] } },
        indicatorScopeRequest: { status: 'success' },
        indicatorScopeContext: { mode: 'indicator', geography: 'DEU', filters: {} },
        selection: { indicator: selectedIndicator, geography: 'DEU', parameters: { time: 'Annual' } },
      })
    ).toEqual({ status: 'loading' });
  });

  test.each(['hidden', 'loading', 'failure', 'empty'])('does not make a percentile chart request plan while its view is %s', (view) => {
    expect(percentileChartRequest({ status: view }, { indicator: 'Heat' })).toBeUndefined();
  });

  test('makes a percentile chart request plan after matching availability succeeds', () => {
    const request = { indicator: 'Heat', instance: 'primary', geography: 'DEU' };

    expect(percentileChartRequest({ status: 'ready' }, request)).toBe(request);
  });

  test.each([
    [{ status: 'idle' }, 'loading'],
    [{ status: 'loading' }, 'loading'],
    [{ status: 'failure', error: 'offline' }, 'failure'],
    [{ status: 'success', data: { scenarios: [] } }, 'empty'],
    [{ status: 'success', data: { scenarios: [{ id: 'Low' }] } }, 'ready'],
  ])('shows scenario request state as %s', (request, expected) => {
    const items = request.data?.scenarios ?? [];
    expect(scenarioControlView({ request, items }).status).toBe(expected);
  });

  test('uses an owned scenario list without waiting for runtime availability', () => {
    expect(ownedScenarioControlView([{ uid: 'Low' }]).status).toBe('ready');
  });

  test.each([
    [{ status: 'idle' }, 'loading'],
    [{ status: 'loading' }, 'loading'],
    [{ status: 'failure', error: 'offline' }, 'failure'],
    [{ status: 'success', data: { filters: [] } }, 'empty'],
    [{ status: 'success', data: { filters: [{ key: 'Sector' }] } }, 'ready'],
  ])('shows advanced-filter request state as %s', (request, expected) => {
    const groups = request.data?.filters ?? [];
    expect(advancedFilterControlView({ request, groups }).status).toBe(expected);
  });

  test('uses the full selected indicator pair in the scenario detail load key', () => {
    expect(scenarioDetailLoadKey({ scenarioId: 'Low', indicator: selectedIndicator })).toBe('primary\u0000Heat\u0000Low');
    expect(scenarioDetailLoadKey({ scenarioId: 'Low', indicator: { id: 'Heat', instance: 'secondary' } })).toBe('secondary\u0000Heat\u0000Low');
  });
});
