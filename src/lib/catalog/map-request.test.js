import { expect, test } from 'vitest';
import { canonicalMapSelection, mapGridRequests } from './map-request.js';

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
  expect(canonicalMapSelection({ ...input, indicator: { ...input.indicator, instance: 'sparccle-internal' } })).toBeNull();
  expect(canonicalMapSelection({ ...input, parameters: { ...input.parameters, indicator_value: '35' } })).toBeNull();
  expect(canonicalMapSelection({ ...input, parameters: { ...input.parameters, frequency: '1' } })).toBeNull();
  expect(canonicalMapSelection({ ...input, parameters: { ...input.parameters, threshold: '95th Percentile' } })).toBeNull();
});

test('builds one direct grid request per ordered scenario and year', () => {
  const selection = canonicalMapSelection(input);
  expect(mapGridRequests(selection, 2050).map((request) => request.params.scenario)).toEqual(['2020 Climate Policies', 'Low Demand']);
  expect(mapGridRequests(selection, 2050).every((request) => request.base === import.meta.env.VITE_API_URL)).toBe(true);
});
