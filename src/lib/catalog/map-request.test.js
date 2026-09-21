import { describe, expect, test, vi } from 'vitest';
import { canonicalMapSelection, loadMapAvailability, mapGridRequests, sharedMapYears, startMapAvailability } from './map-request.js';

const input = {
  indicator: { uid: 'Mean Temperature', instance: 'provide-internal' },
  geography: { uid: 'Cameroon' },
  scenarios: [{ uid: '2020 Climate Policies' }, { uid: 'Low Demand' }],
  parameters: { reference: '2011-2020 (Present Day)', time: 'Annual', spatial: 'Area', frequency: '0.5' },
};

test('keeps canonical identity and ordered scenarios without legacy mappings', () => {
  expect(canonicalMapSelection(input)).toEqual({
    indicator: 'Mean Temperature', instance: 'provide-internal', geography: 'Cameroon',
    reference: '2011-2020 (Present Day)', time: 'Annual', spatial: 'Area', frequency: '0.5',
    scenarios: ['2020 Climate Policies', 'Low Demand'],
  });
});

test('rejects selectors that the published coverage family does not support', () => {
  expect(canonicalMapSelection({ ...input, parameters: { ...input.parameters, indicator_value: '35' } })).toBeNull();
  expect(canonicalMapSelection({ ...input, parameters: { ...input.parameters, frequency: '1' } })).toBeNull();
  expect(canonicalMapSelection({ ...input, parameters: { ...input.parameters, threshold: '95th Percentile' } })).toBeNull();
});

test('requires shared years for comparisons', () => {
  expect(sharedMapYears({ A: [2030, 2050], B: [2050, 2100] }, ['A', 'B'])).toEqual([2050]);
  expect(sharedMapYears({ A: [2030], B: [] }, ['A', 'B'])).toEqual([]);
});

test('loads availability directly and preserves missing scenarios', async () => {
  const fetcher = vi.fn(async () => Response.json({ scenarios: { '2020 Climate Policies': [2030, 2050], 'Low Demand': [2050] } }));
  const result = await loadMapAvailability(canonicalMapSelection(input), { base: 'https://api.example/api', fetcher });
  expect(fetcher).toHaveBeenCalledTimes(1);
  const url = new URL(fetcher.mock.calls[0][0]);
  expect(url.pathname).toBe('/api/impact-geo/availability/');
  expect(url.searchParams.getAll('scenarios')).toEqual(['2020 Climate Policies', 'Low Demand']);
  expect(result).toMatchObject({ status: 'ready', years: [2050] });
});

test('loads availability from the browser relative API base', async () => {
  const fetcher = vi.fn(async () => Response.json({ scenarios: { '2020 Climate Policies': [2050], 'Low Demand': [2050] } }));
  const result = await loadMapAvailability(canonicalMapSelection(input), { base: '/api', fetcher });
  expect(fetcher).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/impact-geo\/availability\/\?/));
  expect(result).toMatchObject({ status: 'ready', years: [2050] });
});

test('hides selections with a missing scenario and reports service failures for retry', async () => {
  const selection = canonicalMapSelection(input);
  const empty = await loadMapAvailability(selection, {
    base: 'https://api.example/api',
    fetcher: async () => Response.json({ scenarios: { '2020 Climate Policies': [2050], 'Low Demand': [] } }),
  });
  expect(empty).toEqual({ status: 'empty' });
  const failed = await loadMapAvailability(selection, {
    base: 'https://api.example/api',
    fetcher: async () => Response.json({ error: 'GeoServer unavailable' }, { status: 502 }),
  });
  expect(failed).toEqual({ status: 'failure', message: 'GeoServer unavailable' });
});

test('builds one direct grid request per ordered scenario and year', () => {
  const selection = canonicalMapSelection(input);
  expect(mapGridRequests(selection, 2050).map((request) => request.params.scenario)).toEqual(['2020 Climate Policies', 'Low Demand']);
  expect(mapGridRequests(selection, 2050).every((request) => request.base === import.meta.env.VITE_API_URL)).toBe(true);
});

test('ignores an availability response after the selection changes and allows retry', async () => {
  let resolveOld;
  const oldResponse = new Promise((resolve) => { resolveOld = resolve; });
  const views = [];
  const cancel = startMapAvailability(canonicalMapSelection(input), (view) => views.push(view), {
    base: 'https://api.example/api',
    fetcher: () => oldResponse,
  });
  cancel();
  const retry = startMapAvailability(canonicalMapSelection({ ...input, scenarios: [{ uid: 'Low Demand' }] }), (view) => views.push(view), {
    base: 'https://api.example/api',
    fetcher: async () => Response.json({ scenarios: { 'Low Demand': [2050] } }),
  });
  resolveOld(Response.json({ scenarios: { '2020 Climate Policies': [2030], 'Low Demand': [2030] } }));
  await vi.waitFor(() => expect(views.at(-1)).toMatchObject({ status: 'ready', years: [2050] }));
  expect(views).not.toContainEqual(expect.objectContaining({ status: 'ready', years: [2030] }));
  retry();
});
