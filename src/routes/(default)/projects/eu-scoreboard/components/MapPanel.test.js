// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, expect, test, vi } from 'vitest';
import MapPanel from './MapPanel.svelte';

vi.mock('./ScoreboardMap.svelte', () => import('./MapPanelMap.test.fixture.svelte'));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const option = (uid) => ({ uid, label: uid });
const definition = { name: 'Maximum Air Temperature', type: 'choropleth', level: 'NUTS2' };
const selection = {
  indicator: option(definition.name),
  region: option('Austria'),
  scenario: option('CurrentPolicies'),
  year: option('2050'),
};
const result = (status, values = [], metadata = null) => ({ definition, status, values, metadata });
const props = { definition, result: result('empty'), selection, sector: 'testing' };

test.each([
  ['pending', new Promise(() => {})],
  ['empty', result('empty')],
  ['error', { ...result('error'), error: 'Map data could not be loaded.' }],
])('keeps the selected country and level on the map while values are %s', (_, mapResult) => {
  render(MapPanel, { ...props, result: mapResult });
  const map = screen.getByRole('img', { name: 'Regional scoreboard map' });
  expect(map.dataset.country).toBe('Austria');
  expect(map.dataset.level).toBe('NUTS2');
});

test('retries a failed map with its full identity and treats zero as data', async () => {
  const ready = result('ready', [{ region: 'AT11', value: 0 }], { variable: 'tasmax', model: 'RIME-X', unit: 'K' });
  const fetcher = vi.fn().mockResolvedValue(Response.json(ready));
  vi.stubGlobal('fetch', fetcher);
  render(MapPanel, { ...props, result: { ...result('error'), error: 'Map failed' } });

  await fireEvent.click(screen.getByRole('button', { name: 'Retry map' }));

  await waitFor(() => expect(JSON.parse(screen.getByRole('img', { name: 'Regional scoreboard map' }).dataset.values)).toEqual(ready.values));
  expect(fetcher).toHaveBeenCalledWith(
    '/app/scoreboard/map?sector=testing&indicator=Maximum+Air+Temperature&region=Austria&scenario=CurrentPolicies&year=2050'
  );
  expect(screen.getByText(/RIME-X/)).toBeTruthy();
  expect(screen.getByText(/0 K/)).toBeTruthy();
});

test('passes a ready raster grid to the map and builds its legend from cell values', () => {
  const rasterDefinition = { name: 'Mean Temperature', type: 'raster' };
  const grid = { coordinatesOrigin: [11, 51], resolution: 0.5, data: [[1, null], [2, 3]] };
  const rasterResult = {
    definition: rasterDefinition,
    status: 'ready',
    grid,
    metadata: { unit: '°C' },
  };

  render(MapPanel, {
    ...props,
    definition: rasterDefinition,
    selection: { ...selection, indicator: option(rasterDefinition.name) },
    result: rasterResult,
  });

  const map = screen.getByRole('img', { name: 'Regional scoreboard map' });
  expect(JSON.parse(map.dataset.grid)).toEqual(grid);
  expect(JSON.parse(map.dataset.classes)).toHaveLength(5);
  expect(screen.getAllByText(/°C/)).toHaveLength(1);
  expect(screen.getByText('1.4')).toBeTruthy();
  expect(screen.getByText('3 °C')).toBeTruthy();
});

test('does not paint an old result after indicator and sector change', async () => {
  let finishOld;
  let finishCurrent;
  const oldResult = new Promise((resolve) => {
    finishOld = resolve;
  });
  const currentResult = new Promise((resolve) => {
    finishCurrent = resolve;
  });
  const nextDefinition = { ...definition, name: 'Mean Air Temperature', level: 'NUTS1' };
  const nextSelection = { ...selection, indicator: option(nextDefinition.name) };
  const { rerender } = render(MapPanel, { ...props, result: oldResult });

  await rerender({ ...props, definition: nextDefinition, selection: nextSelection, sector: 'energy', result: currentResult });
  finishOld(result('ready', [{ region: 'AT11', value: 99 }]));
  await Promise.resolve();
  expect(JSON.parse(screen.getByRole('img', { name: 'Regional scoreboard map' }).dataset.values)).toEqual([]);

  const current = { ...result('ready', [{ region: 'AT1', value: 4 }]), definition: nextDefinition };
  finishCurrent(current);
  await waitFor(() => expect(JSON.parse(screen.getByRole('img', { name: 'Regional scoreboard map' }).dataset.values)).toEqual(current.values));
  expect(screen.getByRole('img', { name: 'Regional scoreboard map' }).dataset.level).toBe('NUTS1');
});

test('rekeys comparison requests when indicator or sector changes', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(result('ready', [{ region: 'AT11', value: 2 }], { unit: 'K' })));
  vi.stubGlobal('fetch', fetcher);
  const other = option('1.5C');
  const comparison = {
    compareBy: option('scenario'),
    sides: [selection.scenario, other],
    optionsFor: () => [selection.scenario, other],
  };
  const { rerender } = render(MapPanel, { ...props, result: result('ready', [{ region: 'AT11', value: 1 }]), ...comparison });
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

  const nextDefinition = { ...definition, name: 'Mean Air Temperature' };
  const nextSelection = { ...selection, indicator: option(nextDefinition.name) };
  await rerender({ ...props, definition: nextDefinition, selection: nextSelection, sector: 'energy', result: result('ready', []), ...comparison });
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(fetcher.mock.calls[1][0]).toContain('sector=energy&indicator=Mean+Air+Temperature');
});

test('stops comparison requests and keeps the country outline when the next sector has no map', async () => {
  let finishComparison;
  const fetcher = vi.fn(
    () =>
      new Promise((resolve) => {
        finishComparison = resolve;
      })
  );
  vi.stubGlobal('fetch', fetcher);
  const other = option('1.5C');
  const comparison = {
    compareBy: option('scenario'),
    sides: [selection.scenario, other],
    optionsFor: () => [selection.scenario, other],
  };
  const { rerender } = render(MapPanel, { ...props, result: result('ready', [{ region: 'AT11', value: 1 }]), ...comparison });
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());

  await rerender({
    ...props,
    definition: undefined,
    result: undefined,
    selection: { ...selection, indicator: undefined },
    sector: 'socioeconomic',
    ...comparison,
  });

  expect(fetcher).toHaveBeenCalledOnce();
  expect(screen.getAllByRole('img', { name: 'Regional scoreboard map' })[0].dataset.country).toBe('Austria');
  expect(screen.getAllByText('Regional map data is not available for this sector.')).toHaveLength(2);
  finishComparison(Response.json(result('ready', [{ region: 'AT11', value: 99 }])));
  await Promise.resolve();
  for (const map of screen.getAllByRole('img', { name: 'Regional scoreboard map' })) {
    expect(JSON.parse(map.dataset.values)).toEqual([]);
  }
});
