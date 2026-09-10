import { beforeEach, describe, expect, test, vi } from 'vitest';
import { buildURL, parseCatalogUrlSelection, replaceCatalogUrlSelection, urlToState } from './url.js';

const catalog = vi.hoisted(() => ({
  selection: undefined,
  setPendingSelection: vi.fn((selection) => {
    catalog.selection = selection;
  }),
}));

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$stores/avoid.js', () => ({
  SELECTED_LIKELIHOOD_LEVEL: { set: vi.fn() },
  LEVEL_OF_IMPACT_ARRAY: { set: vi.fn() },
}));
vi.mock('$stores/catalog-flow.js', () => ({
  catalogFlow: { restoreSelection: catalog.setPendingSelection },
}));

beforeEach(() => {
  catalog.selection = undefined;
  catalog.setPendingSelection.mockClear();
});

describe('parseCatalogUrlSelection', () => {
  test('keeps a source instance for scenario-only entry', () => {
    const url = new URL('https://provide.example/impacts/explore?scenarios[0]=Low%20Demand&instance=source-a');

    expect(parseCatalogUrlSelection(url)).toEqual({ parameters: {}, scenarios: ['Low Demand'], instance: 'source-a' });
  });
  test('keeps canonical shared choices pending with the indicator instance', () => {
    const url = new URL('https://provide.example/impacts/explore?indicator=Heat&instance=provide-internal&geography=DEU&scenarios[0]=Low%20Demand&time=Annual');

    expect(parseCatalogUrlSelection(url)).toEqual({
      indicator: 'Heat',
      instance: 'provide-internal',
      geography: 'DEU',
      scenarios: ['Low Demand'],
      parameters: { time: 'Annual' },
    });
  });

  test('does not translate an incoming old indicator ID', () => {
    const url = new URL('https://provide.example/impacts/explore?indicator=legacy-heat&instance=provide-internal');

    expect(parseCatalogUrlSelection(url)).toEqual({
      indicator: 'legacy-heat',
      instance: 'provide-internal',
      parameters: {},
      scenarios: [],
    });
  });

  test('does not accept a source-bound indicator without its instance', () => {
    const url = new URL('https://provide.example/impacts/explore?indicator=Heat&geography=DEU');

    expect(parseCatalogUrlSelection(url)).toEqual({
      geography: 'DEU',
      parameters: {},
      scenarios: [],
    });
  });

  test.each([
    ['indicator=&instance=provide-internal', 'empty indicator'],
    ['indicator=Heat&instance=', 'empty instance'],
  ])('does not keep an %s choice pending', (query) => {
    const url = new URL(`https://provide.example/impacts/explore?${query}`);

    expect(parseCatalogUrlSelection(url)).toEqual({
      parameters: {},
      scenarios: [],
    });
  });

  test('drops empty values from every catalog choice', () => {
    const url = new URL(
      'https://provide.example/impacts/explore?indicator=%20&instance=%20&geography=%20&time=&reference=%20&frequency=&spatial=%20&indicator_value=&scenarios[0]=&scenarios[1]=%20&scenarios[2]=Low%20Demand'
    );

    expect(parseCatalogUrlSelection(url)).toEqual({
      parameters: {},
      scenarios: ['Low Demand'],
    });
  });
});

describe('replaceCatalogUrlSelection', () => {
  test('replaces the stale selection and round-trips the current Explorer state', () => {
    const current = new URL(
      'https://provide.example/impacts/explore?indicator=Old&instance=old-source&geography=Oldland&scenarios%5B0%5D=Old&reference=Old&context=methodology#impact-time'
    );
    const next = replaceCatalogUrlSelection(current, {
      indicator: { id: 'Annual Maximum Temperature', instance: 'provide-internal' },
      geography: 'Algeria',
      scenarios: ['Stabilisation at 1.5 °C', 'Low Demand'],
      parameters: {
        reference: '2011-2020 (Present Day)',
        time: 'Annual',
        spatial: 'Area',
      },
    });

    expect(parseCatalogUrlSelection(next)).toEqual({
      indicator: 'Annual Maximum Temperature',
      instance: 'provide-internal',
      geography: 'Algeria',
      scenarios: ['Stabilisation at 1.5 °C', 'Low Demand'],
      parameters: {
        reference: '2011-2020 (Present Day)',
        time: 'Annual',
        spatial: 'Area',
      },
    });
    expect(next.searchParams.get('context')).toBe('methodology');
    expect(next.hash).toBe('#impact-time');
  });

  test('removes selection values that are no longer set', () => {
    const current = new URL(
      'https://provide.example/impacts/explore?indicator=Old&instance=old-source&geography=Oldland&scenarios%5B0%5D=Old&reference=Old&context=methodology'
    );
    const next = replaceCatalogUrlSelection(current, { parameters: {}, scenarios: [] });

    expect(parseCatalogUrlSelection(next)).toEqual({ parameters: {}, scenarios: [] });
    expect(next.searchParams.get('context')).toBe('methodology');
  });
});

describe('buildURL', () => {
  test('keeps the selected instance beside its indicator in a shared URL', () => {
    const query = buildURL('explore', {
      indicator: 'Heat',
      instance: 'provide-internal',
    });

    const params = new URLSearchParams(query);
    expect(params.get('indicator')).toBe('Heat');
    expect(params.get('instance')).toBe('provide-internal');
  });

  test('drops empty catalog choices from a shared URL', () => {
    const query = buildURL('explore', {
      indicator: ' ',
      instance: '',
      geography: '',
      scenarios: ['', ' ', 'Low Demand'],
      time: '',
      reference: ' ',
      spatial: '',
      frequency: ' ',
      indicator_value: '',
    });

    expect(new URLSearchParams(query).toString()).toBe('scenarios%5B0%5D=Low+Demand');
  });

  test('does not sort the selected scenario array in place', () => {
    const scenarios = ['Low Demand', 'High Renewables'];

    buildURL('explore', { scenarios });

    expect(scenarios).toEqual(['Low Demand', 'High Renewables']);
  });
});

describe('urlToState', () => {
  test('does not replace the current choice when raw catalog keys are blank', () => {
    catalog.selection = {
      indicator: { id: 'Heat', instance: 'provide-internal' },
      geography: 'DEU',
      parameters: { time: 'Annual' },
      scenarios: ['Low Demand'],
    };

    urlToState('https://provide.example/impacts/explore?indicator=&instance=&geography=&time=&scenarios[0]=');

    expect(catalog.setPendingSelection).not.toHaveBeenCalled();
    expect(catalog.selection).toEqual({
      indicator: { id: 'Heat', instance: 'provide-internal' },
      geography: 'DEU',
      parameters: { time: 'Annual' },
      scenarios: ['Low Demand'],
    });
  });
});
